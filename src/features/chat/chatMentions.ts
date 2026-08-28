import type { EventMember } from '@/features/chat/api/useChat';

/** เก็บในฐานข้อมูล — ไม่เป็น UUID เพื่อเลี่ยงสับสนกับ id ผู้ใช้ */
export const EVERYONE_MENTION_STORAGE_ID = 'everyone' as const;

export const DISPLAY_EVERYONE_MENTION_LABEL = 'ทุกคน';

const TOKEN_INNER =
  `(?:everyone|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})`;

/** ใช้อ้างอิง pattern (แหล่ง .source เมื่อประกอบ RegExp ใหม่) */
export const MENTION_STORAGE_INNER_PATTERN = TOKEN_INNER;

export const MENTION_BRACE_RE = new RegExp(`@\\{${TOKEN_INNER}\\}`, 'g');

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function memberMentionLabel(
  member: EventMember,
  nicknameMap: Record<string, string> | undefined,
  allMembers: EventMember[],
): string {
  const nick = nicknameMap?.[member.id]?.trim();
  const base = (nick || member.full_name || member.email.split('@')[0]).trim();

  const dups =
    nick && nick.length > 0
      ? allMembers.filter((m) => nicknameMap?.[m.id]?.trim() === nick)
      : allMembers.filter((m) => {
          const bn = nicknameMap?.[m.id]?.trim() || m.full_name;
          return bn === member.full_name;
        });

  if (dups.length <= 1) return base;
  const hint = member.email.split('@')[0]?.slice(0, 14) ?? '';
  return hint.length > 0 ? `${base} (${hint})` : `${base}`;
}

export function normalizeMentionQuery(s: string): string {
  return s.trim().toLowerCase().normalize('NFC');
}

export function filterMembersForMention(
  query: string,
  members: EventMember[],
  nicknameMap: Record<string, string> | undefined,
): EventMember[] {
  const q = normalizeMentionQuery(query);
  if (!q.length) return [...members];
  return members.filter((m) => {
    const label = normalizeMentionQuery(memberMentionLabel(m, nicknameMap, members));
    const full = normalizeMentionQuery(m.full_name);
    const nick = normalizeMentionQuery(nicknameMap?.[m.id] ?? '');
    const email = normalizeMentionQuery(m.email);
    return label.includes(q) || full.includes(q) || nick.includes(q) || email.includes(q);
  });
}

export function getOpenMentionAtCursor(
  full: string,
  cursor: number,
): { start: number; end: number; query: string } | null {
  if (cursor < 1) return null;
  const upto = Math.min(cursor, full.length);
  const before = full.slice(0, upto);
  const lineStart = Math.max(before.lastIndexOf('\n') + 1, 0);
  const slice = before.slice(lineStart);
  const relAt = slice.lastIndexOf('@');
  if (relAt < 0) return null;
  const at = lineStart + relAt;
  const prev = at === 0 ? ' ' : full[at - 1];
  if (!/[\s\n\t]/.test(prev) && at > 0) return null;

  const afterAt = full.slice(at + 1, upto);
  if (afterAt.startsWith('{')) return null;
  if (afterAt.includes('\n')) return null;
  const query = afterAt;
  const limit = 80;
  if (query.length > limit) return null;
  return { start: at, end: upto, query };
}

export function splitMessageWithMentions(
  raw: string,
  resolveDisplay: (userId: string) => string,
): ({ type: 'text'; text: string } | { type: 'mention'; label: string })[] {
  const out: ({ type: 'text'; text: string } | { type: 'mention'; label: string })[] = [];
  const re = new RegExp(`@\\{(${TOKEN_INNER})\\}`, 'gi');
  let last = 0;
  for (const m of raw.matchAll(re)) {
    const idx = m.index ?? -1;
    const innerRaw = m[1];
    if (idx < 0 || !innerRaw) continue;
    const inner = innerRaw.toLowerCase();
    if (idx > last) out.push({ type: 'text', text: raw.slice(last, idx) });
    if (inner === EVERYONE_MENTION_STORAGE_ID) {
      out.push({ type: 'mention', label: `@${DISPLAY_EVERYONE_MENTION_LABEL}` });
    } else {
      out.push({ type: 'mention', label: `@${resolveDisplay(innerRaw)}` });
    }
    last = idx + m[0].length;
  }
  if (last < raw.length) out.push({ type: 'text', text: raw.slice(last) });
  return out;
}

export function mentionsStoredToDisplay(
  stored: string,
  members: EventMember[],
  nicknameMap?: Record<string, string>,
): string {
  const re = new RegExp(`@\\{(${TOKEN_INNER})\\}`, 'gi');
  const memberById = new Map(members.map((x) => [x.id, x]));
  return stored.replace(re, (_full, cap: string) => {
    const inner = cap.toLowerCase();
    if (inner === EVERYONE_MENTION_STORAGE_ID) {
      return `@${DISPLAY_EVERYONE_MENTION_LABEL} `;
    }
    const row = memberById.get(cap);
    if (!row) return '@สมาชิก ';
    return `@${memberMentionLabel(row, nicknameMap, members)} `;
  });
}

export function mentionsDisplayToStored(
  display: string,
  members: EventMember[],
  nicknameMap: Record<string, string> | undefined,
  options?: { allowEveryone?: boolean },
):
  | { ok: true; value: string }
  | {
      ok: false;
      reason: string;
    } {
  const allowEveryone = options?.allowEveryone ?? false;
  if (!allowEveryone) {
    const everyoneRx = new RegExp(`@${escapeRegExp(DISPLAY_EVERYONE_MENTION_LABEL)}`, 'gu');
    if (everyoneRx.test(display)) {
      return { ok: false, reason: 'แท็ก @ทุกคนได้เฉพาะแอดมิน' };
    }
  }

  const sortedMembers = [...members].sort((a, b) => {
    const la = memberMentionLabel(a, nicknameMap, members).length;
    const lb = memberMentionLabel(b, nicknameMap, members).length;
    return lb - la;
  });

  let out = display;
  if (allowEveryone) {
    out = out.replace(
      new RegExp(`@${escapeRegExp(DISPLAY_EVERYONE_MENTION_LABEL)}(?=\\s|$|\\n|[.,!?])`, 'gu'),
      `@{${EVERYONE_MENTION_STORAGE_ID}} `,
    );
  }

  for (const m of sortedMembers) {
    const label = memberMentionLabel(m, nicknameMap, members);
    const rx = new RegExp(`@${escapeRegExp(label)}(?=\\s|$|\\n|[.,!?])`, 'gu');
    out = out.replace(rx, `@{${m.id}} `);
  }

  if (!allowEveryone && out.includes(`@{${EVERYONE_MENTION_STORAGE_ID}}`)) {
    return { ok: false, reason: 'แท็ก @ทุกคนได้เฉพาะแอดมิน' };
  }

  return { ok: true, value: out.replace(/\u00a0/g, ' ') };
}

export function expandMentionsForSearch(
  raw: string,
  members: EventMember[],
  nicknameMap?: Record<string, string>,
): string {
  return mentionsStoredToDisplay(raw, members, nicknameMap);
}

export function mentionsEveryoneMatchesQuery(query: string, isAdmin: boolean): boolean {
  if (!isAdmin) return false;
  const q = normalizeMentionQuery(query);
  if (!q.length) return true;
  const full = DISPLAY_EVERYONE_MENTION_LABEL.toLowerCase();
  return full.startsWith(q) || 'everyone'.startsWith(q) || q.startsWith('ev');
}
