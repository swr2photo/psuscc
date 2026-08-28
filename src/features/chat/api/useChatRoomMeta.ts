import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ChatRoomMetaRow {
  id: string;
  title: string;
  chat_room_display_name: string | null;
  chat_room_photo_url: string | null;
  cover_url: string | null;
  chat_cleared_at: string | null;
  chat_pinned_message_id: string | null;
  chat_pinned_at: string | null;
  chat_pinned_by: string | null;
}

export function useChatRoomMeta(eventId: string) {
  return useQuery({
    queryKey: ['chat-room-meta', eventId],
    queryFn: async (): Promise<ChatRoomMetaRow | null> => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, title, chat_room_display_name, chat_room_photo_url, cover_url, chat_cleared_at, chat_pinned_message_id, chat_pinned_at, chat_pinned_by',
        )
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw error;
      return (data as ChatRoomMetaRow) ?? null;
    },
    enabled: !!eventId,
  });
}

export function useSaveChatRoomMeta(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { displayName: string | null; photoUrl: string | null }) => {
      const { error } = await supabase
        .from('events')
        .update({
          chat_room_display_name: payload.displayName?.trim() || null,
          chat_room_photo_url: payload.photoUrl?.trim() || null,
        })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chat-room-meta', eventId] });
      await qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
