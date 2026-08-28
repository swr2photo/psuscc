import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** เก็บเป็น Record เพื่อให้เข้ากับ React Query persist (Map ถูกกลับมาเป็น object ธรรมดาและไม่มี .get()) */
export function useChatNicknames(eventId: string) {
  return useQuery({
    queryKey: ['chat-nicknames', eventId],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!eventId) return {};
      const { data, error } = await supabase
        .from('event_chat_nicknames')
        .select('user_id, nickname')
        .eq('event_id', eventId);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const row of data ?? []) {
        const uid = row.user_id as string;
        const n = row.nickname as string;
        if (uid) out[uid] = n;
      }
      return out;
    },
    enabled: !!eventId,
  });
}

export function useSaveMyNickname(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nicknameTrim: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      const trimmed = nicknameTrim.trim();
      if (!trimmed) {
        await supabase
          .from('event_chat_nicknames')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);
        return;
      }
      const { error } = await supabase.from('event_chat_nicknames').upsert(
        {
          event_id: eventId,
          user_id: user.id,
          nickname: trimmed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chat-nicknames', eventId] });
    },
  });
}
