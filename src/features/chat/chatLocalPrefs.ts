import { mmkvStorage } from '@/lib/mmkv';

import type { ChatThemeKey } from '@/features/chat/chatThemePresets';

const storageKey = (eventId: string) => `@psuscc/chat_prefs_v1/${eventId}`;

export interface ChatLocalPrefs {
  theme: ChatThemeKey;
  notifyNewMessages: boolean;
  notifyMentionsOnly: boolean;
  quietHoursPlaceholder: boolean;
}

export const DEFAULT_CHAT_PREFS: ChatLocalPrefs = {
  theme: 'default',
  notifyNewMessages: true,
  notifyMentionsOnly: false,
  quietHoursPlaceholder: false,
};

export async function loadChatPrefs(eventId: string): Promise<ChatLocalPrefs> {
  if (!eventId) return { ...DEFAULT_CHAT_PREFS };
  try {
    const raw = await mmkvStorage.getItem(storageKey(eventId));
    if (!raw) return { ...DEFAULT_CHAT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ChatLocalPrefs>;
    return { ...DEFAULT_CHAT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_CHAT_PREFS };
  }
}

export async function saveChatPrefs(eventId: string, prefs: Partial<ChatLocalPrefs>): Promise<void> {
  if (!eventId) return;
  const merged = { ...(await loadChatPrefs(eventId)), ...prefs };
  await mmkvStorage.setItem(storageKey(eventId), JSON.stringify(merged));
}
