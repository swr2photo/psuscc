import { mmkvStorage } from '@/lib/mmkv';
import type { Session } from '@supabase/supabase-js';

export type LocalAuthProvider = 'google' | 'email' | 'phone' | 'unknown';

export type LocalAuthAccount = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  provider?: LocalAuthProvider;
  lastUsedAt: number;
};

const KEY = 'local_auth_accounts_v1';
const MAX_ACCOUNTS = 8;

function dedupeByUserId(list: LocalAuthAccount[]): LocalAuthAccount[] {
  const map = new Map<string, LocalAuthAccount>();
  for (const a of list) {
    map.set(a.userId, a);
  }
  return Array.from(map.values());
}

function sortNewestFirst(list: LocalAuthAccount[]): LocalAuthAccount[] {
  return [...list].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

function inferProvider(session: Session): LocalAuthProvider {
  const providers = session.user.app_metadata?.providers;
  if (Array.isArray(providers)) {
    if (providers.includes('google')) return 'google';
    if (providers.includes('email')) return 'email';
    if (providers.includes('phone')) return 'phone';
  }
  return 'unknown';
}

function readDisplayName(session: Session): string | null {
  const md = session.user.user_metadata as Record<string, unknown> | null;
  const full = (md?.full_name as string | undefined) ?? (md?.name as string | undefined);
  return full?.trim() ? full.trim() : null;
}

function readAvatarUrl(session: Session): string | null {
  const md = session.user.user_metadata as Record<string, unknown> | null;
  const pic = (md?.avatar_url as string | undefined) ?? (md?.picture as string | undefined);
  return pic?.trim() ? pic.trim() : null;
}

export async function listLocalAccounts(): Promise<LocalAuthAccount[]> {
  const raw = await mmkvStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const safe = parsed
      .map((x) => x as Partial<LocalAuthAccount>)
      .filter((x) => typeof x.userId === 'string' && typeof x.lastUsedAt === 'number')
      .map((x) => ({
        userId: x.userId!,
        lastUsedAt: x.lastUsedAt!,
        email: x.email ?? null,
        phone: x.phone ?? null,
        displayName: x.displayName ?? null,
        avatarUrl: x.avatarUrl ?? null,
        provider: (x.provider as LocalAuthProvider) ?? 'unknown',
      }));
    return sortNewestFirst(dedupeByUserId(safe)).slice(0, MAX_ACCOUNTS);
  } catch {
    return [];
  }
}

export async function upsertLocalAccountFromSession(session: Session): Promise<void> {
  const base: LocalAuthAccount = {
    userId: session.user.id,
    email: session.user.email ?? null,
    phone: session.user.phone ?? null,
    displayName: readDisplayName(session),
    avatarUrl: readAvatarUrl(session),
    provider: inferProvider(session),
    lastUsedAt: Date.now(),
  };

  const prev = await listLocalAccounts();
  const next = sortNewestFirst(dedupeByUserId([base, ...prev])).slice(0, MAX_ACCOUNTS);
  await mmkvStorage.setItem(KEY, JSON.stringify(next));
}

export async function removeLocalAccount(userId: string): Promise<void> {
  const prev = await listLocalAccounts();
  const next = prev.filter((a) => a.userId !== userId);
  await mmkvStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearLocalAccounts(): Promise<void> {
  await mmkvStorage.removeItem(KEY);
}

