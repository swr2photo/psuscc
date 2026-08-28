import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useHiddenMessageIds() {
  return useQuery({
    queryKey: ['chat-message-hidden-self'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from('chat_message_hidden')
        .select('message_id')
        .eq('user_id', user.id);

      if (error || !data) return new Set<string>();

      return new Set(data.map((r) => r.message_id as string));
    },
    staleTime: 15_000,
  });
}

export function useHideChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      const { error } = await supabase
        .from('chat_message_hidden')
        .insert({ message_id: messageId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chat-message-hidden-self'] });
    },
  });
}
