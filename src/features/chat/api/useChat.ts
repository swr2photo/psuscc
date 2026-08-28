import type { ImagePickerAsset } from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';
import { useCallback, useEffect, useState } from 'react';
import { uploadChatImage, uploadChatVoiceRecording } from '@/features/chat/uploadChatImage';

export interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
  video_url?: string | null;
  type: 'text' | 'announcement';
  unsent_at?: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  read_count?: number;
}

export interface EventMember {
  id: string;
  full_name: string;
  avatar_url: string;
  email: string;
}

export const useEventMembers = (eventId: string) => {
  return useQuery({
    queryKey: ['event-members', eventId],
    queryFn: async () => {
      // ดึงรายชื่อคนลงทะเบียนในกิจกรรมนี้
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          profiles (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'registered');

      if (error) throw error;
      return data.map(r => r.profiles) as unknown as EventMember[];
    },
    enabled: !!eventId,
  });
};

async function fetchMessagesWithReads(eventId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      profiles (
        full_name,
        avatar_url
      ),
      message_reads (count)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[chat] fetch messages', error);
    return [];
  }

  const mapped = data.map((m) => ({
    ...m,
    read_count: (m as { message_reads?: { count: number }[] }).message_reads?.[0]?.count || 0,
  })) as ChatMessage[];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const unreadMessageIds = data.filter((m) => m.user_id !== user.id).map((m) => m.id);
    if (unreadMessageIds.length > 0) {
      const reads = unreadMessageIds.map((msgId) => ({
        message_id: msgId,
        user_id: user.id,
      }));
      await supabase.from('message_reads').upsert(reads, { onConflict: 'message_id,user_id' });
    }
  }

  return mapped;
}

type MessagesInsertRow = {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
  video_url?: string | null;
  type?: string;
  created_at: string;
};

async function enrichMessageFromInsertRow(row: MessagesInsertRow): Promise<ChatMessage> {
  const { data: userData } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', row.user_id)
    .single();

  return {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    content: row.content,
    image_url: row.image_url ?? null,
    audio_url: row.audio_url ?? null,
    audio_duration_ms: row.audio_duration_ms ?? null,
    video_url: row.video_url ?? null,
    type: row.type === 'announcement' ? 'announcement' : 'text',
    created_at: row.created_at,
    unsent_at: (row as { unsent_at?: string | null }).unsent_at ?? null,
    profiles:
      userData ?? {
        full_name: 'ผู้ใช้',
        avatar_url: '',
      },
    read_count: 0,
  };
}

export const useChatMessages = (eventId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const reloadMessages = useCallback(async () => {
    if (!eventId) return;
    const next = await fetchMessagesWithReads(eventId);
    setMessages((prev) => {
      // อย่าทับข้อความในจอเป็นค่าว่างเมื่อเรามีอยู่ — ป้องกันกรณี RLS/policy ผิดพลาดแล้ว insert ได้แต่ select ไม่ได้
      if (next.length === 0 && prev.length > 0) {
        console.warn('[chat] reloadMessages returned 0 rows but local has', prev.length, '— keeping local (possible RLS issue)');
        return prev;
      }
      return next;
    });
  }, [eventId]);

  const pushOptimisticMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  }, []);

  /** ผูก optimistic id → row จาก DB; ถ้ามี realtime แทรก row เดียวกันจะ dedupe ด้วย id */
  const finalizeOptimisticMessage = useCallback(async (tempId: string, row: MessagesInsertRow) => {
    const msg = await enrichMessageFromInsertRow(row);
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === tempId ? msg : m));
      const seen = new Set<string>();
      return next
        .filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }, []);

  const dropOptimisticMessage = useCallback((tempId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }, []);

  /** เติมข้อความที่เพิ่ง insert จากฝั่งเรา เผื่อ Realtime/publication ไม่ยิง event (ข้อความจะโผล่ทันที) */
  const appendMessageFromInsertRow = useCallback(async (row: MessagesInsertRow) => {
    const msg = await enrichMessageFromInsertRow(row);
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;

    void reloadMessages();

    /** topic ไม่ควรเป็นแค่ eventId เดิมซ้ำ — client จะ reuse channel ที่ subscribe แล้ว และ .on() ครั้งใหม่พัง */
    const channelTopic = `event-chat-${eventId}:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // ฟังข้อความใหม่แบบ Realtime (ผูก .on ทั้งหมดแล้วค่อย subscribe ครั้งเดียว)
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, email')
            .eq('id', payload.new.user_id)
            .single();

          const newMessage = {
            ...payload.new,
            profiles: userData || {
              full_name: 'ผู้ใช้',
              avatar_url: '',
              email: 'Unknown',
            },
            read_count: 0,
          } as unknown as ChatMessage;

          setMessages((prev) => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // บันทึกการอ่านสำหรับข้อความใหม่
          const { data: { user } } = await supabase.auth.getUser();
          if (user && payload.new.user_id !== user.id) {
            await supabase.from('message_reads').upsert({
              message_id: payload.new.id,
              user_id: user.id
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> & { id: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id ? ({ ...m, ...row, profiles: m.profiles } as ChatMessage) : m,
            ),
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
        },
        (payload: any) => {
          // อัปเดตจำนวนคนอ่านแบบ Realtime
          setMessages(prev => prev.map(m => 
            m.id === payload.new.message_id 
              ? { ...m, read_count: (m.read_count || 0) + 1 } 
              : m
          ));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId]); // เฉพาะ eventId — เลี่ยง effect ใหม่จาก identity reloadMessages และ reuse channel เดิม

  return {
    messages,
    reloadMessages,
    appendMessageFromInsertRow,
    pushOptimisticMessage,
    finalizeOptimisticMessage,
    dropOptimisticMessage,
  };
};

export const useSendMessage = () => {
  return useMutation({
    mutationFn: async ({
      event_id,
      content,
      image_url = null,
      audio_url = null,
      audio_duration_ms = null,
      video_url = null,
      type = 'text',
    }: {
      event_id: string;
      content: string;
      image_url?: string | null;
      audio_url?: string | null;
      audio_duration_ms?: number | null;
      video_url?: string | null;
      type?: 'text' | 'announcement';
    }) => {
      // ใช้ getSession() (อ่านจาก local) แทน getUser() (network call) เพื่อความเร็ว
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.warn('[chat] useSendMessage: no session found — user likely not logged in');
        throw new Error('กรุณาเข้าสู่ระบบก่อนส่งข้อความ');
      }

      // สร้าง row แบบ dynamic — ไม่ส่งคอลัมน์ที่ค่าเป็น null เพื่อป้องกัน PGRST204
      // กรณี migration ยังไม่ได้ apply (เช่น video_url, audio_url ยังไม่มีในฐานข้อมูล)
      const row: Record<string, unknown> = {
        event_id,
        content,
        user_id: session.user.id,
        type,
      };
      if (image_url) row.image_url = image_url;
      if (audio_url) row.audio_url = audio_url;
      if (audio_duration_ms != null) row.audio_duration_ms = audio_duration_ms;
      if (video_url) row.video_url = video_url;

      const { data, error } = await supabase
        .from('messages')
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error('[chat] insert message failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          event_id,
        });
        throw error;
      }
      return data;
    },
  });
};

export const useChat = (eventId: string) => {
  const qc = useQueryClient();
  const membersQuery = useEventMembers(eventId);
  const {
    messages,
    reloadMessages,
    pushOptimisticMessage,
    finalizeOptimisticMessage,
    dropOptimisticMessage,
  } = useChatMessages(eventId);
  const sendMutation = useSendMessage();

  const sendVoiceRecording = useCallback(
    async (localUri: string, durationMillis: number) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนส่งข้อความ');

      const MIN_MS = 550;
      if (durationMillis < MIN_MS) {
        Toast.show({ type: 'info', text1: 'สั้นเกินไป', text2: 'กดค้างบันทึกให้ยาวกว่านี้สักครู่' });
        return;
      }

      const tempId = `opt-v-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        event_id: eventId,
        user_id: user.id,
        content: '\u200B',
        image_url: null,
        audio_url: localUri,
        audio_duration_ms: Math.round(durationMillis),
        type: 'text',
        created_at: new Date().toISOString(),
        profiles: { full_name: 'คุณ', avatar_url: '' },
        read_count: 0,
      };

      pushOptimisticMessage(optimistic);

      void (async () => {
        try {
          const uploadedUrl = await uploadChatVoiceRecording(eventId, localUri);
          const inserted = await sendMutation.mutateAsync({
            event_id: eventId,
            content: '\u200B',
            image_url: null,
            audio_url: uploadedUrl,
            audio_duration_ms: Math.round(durationMillis),
            type: 'text',
          });

          await finalizeOptimisticMessage(tempId, inserted as MessagesInsertRow);
          void reloadMessages();
        } catch (e: unknown) {
          console.warn('[chat] voice send failed', e);
          dropOptimisticMessage(tempId);
          Toast.show({
            type: 'error',
            text1: 'ส่งเสียงไม่สำเร็จ',
            text2: e instanceof Error ? e.message : 'ลองใหม่',
          });
        }
      })();
    },
    [
      eventId,
      sendMutation,
      pushOptimisticMessage,
      finalizeOptimisticMessage,
      dropOptimisticMessage,
      reloadMessages,
    ],
  );

  /**
   * แสดงข้อความบนจอทันที … caption ควรเป็นรูปแบบเก็บ (มี @{uuid} / @{everyone})
   */
  const sendMessage = useCallback(
    async (
      caption: string,
      localAsset: ImagePickerAsset | null,
      opts?: { messageType?: 'text' | 'announcement' },
    ) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนส่งข้อความ');

      const cap = caption.trim();
      if (!cap && !localAsset) return;

      const mt = opts?.messageType ?? 'text';
      const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const isVideo = localAsset?.type === 'video' || localAsset?.uri?.toLowerCase().endsWith('.mp4') || localAsset?.uri?.toLowerCase().endsWith('.mov');

      const optimistic: ChatMessage = {
        id: tempId,
        event_id: eventId,
        user_id: user.id,
        content: cap || '\u200B',
        image_url: !isVideo ? localAsset?.uri ?? null : null,
        video_url: isVideo ? localAsset?.uri ?? null : null,
        audio_url: null,
        audio_duration_ms: null,
        type: mt,
        created_at: new Date().toISOString(),
        profiles: { full_name: 'คุณ', avatar_url: '' },
        read_count: 0,
      };

      pushOptimisticMessage(optimistic);

      void (async () => {
        try {
          let imageUrl: string | null = null;
          let videoUrl: string | null = null;
          
          if (localAsset) {
            if (isVideo) {
              const { uploadChatVideo } = await import('@/features/chat/uploadChatImage');
              videoUrl = await uploadChatVideo(eventId, localAsset.uri);
            } else {
              imageUrl = await uploadChatImage(eventId, localAsset);
            }
          }

          const inserted = await sendMutation.mutateAsync({
            event_id: eventId,
            content: cap || (imageUrl || videoUrl ? '\u200B' : ''),
            image_url: imageUrl,
            video_url: videoUrl,
            audio_url: null,
            audio_duration_ms: null,
            type: mt,
          });

          await finalizeOptimisticMessage(tempId, inserted as MessagesInsertRow);
          void reloadMessages();
        } catch (e: unknown) {
          console.warn('[chat] optimistic send failed', e);
          dropOptimisticMessage(tempId);

          // สร้างข้อความ error ที่เข้าใจง่าย
          let errMsg = 'ลองใหม่';
          if (e instanceof Error) {
            if (e.message.includes('row-level security') || e.message.includes('policy')) {
              errMsg = 'คุณอาจยังไม่ได้ลงทะเบียนในกิจกรรมนี้';
            } else if (e.message.includes('Unauthorized') || e.message.includes('เข้าสู่ระบบ')) {
              errMsg = 'กรุณาเข้าสู่ระบบแล้วลองใหม่';
            } else {
              errMsg = e.message;
            }
          }

          Toast.show({
            type: 'error',
            text1: 'ส่งข้อความไม่สำเร็จ',
            text2: errMsg,
            position: 'top',
            visibilityTime: 4000,
          });
        }
      })();
    },
    [
      eventId,
      sendMutation,
      pushOptimisticMessage,
      finalizeOptimisticMessage,
      dropOptimisticMessage,
      reloadMessages,
    ],
  );

  const unsendOwnMessage = useCallback(
    async (messageId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('messages')
        .update({
          unsent_at: now,
          content: '\u200B',
          image_url: null,
          audio_url: null,
          audio_duration_ms: null,
        })
        .eq('id', messageId)
        .eq('user_id', user.id);
      if (error) throw error;
      void reloadMessages();
    },
    [reloadMessages],
  );

  const hideMessageForSelf = useCallback(
    async (messageId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Unauthorized');
      const { error } = await supabase.from('chat_message_hidden').insert({
        message_id: messageId,
        user_id: user.id,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['chat-message-hidden-self'] });
    },
    [qc],
  );

  const adminPinChatMessage = useCallback(
    async (messageId: string) => {
      if (!eventId) return;
      const { error } = await supabase.rpc('admin_pin_event_chat_message', {
        p_event_id: eventId,
        p_message_id: messageId,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['chat-room-meta', eventId] });
    },
    [eventId, qc],
  );

  const adminUnpinChat = useCallback(async () => {
    if (!eventId) return;
    const { error } = await supabase.rpc('admin_unpin_event_chat', {
      p_event_id: eventId,
    });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['chat-room-meta', eventId] });
  }, [eventId, qc]);

  const adminClearEventChat = useCallback(async () => {
    if (!eventId) return;
    const { error } = await supabase.rpc('admin_clear_event_chat', {
      p_event_id: eventId,
    });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['chat-room-meta', eventId] });
    void reloadMessages();
  }, [eventId, qc, reloadMessages]);

  const markAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!messages?.length) return;

    const unreadMessageIds = messages
      .filter((m) => m.user_id !== user.id)
      .map((m) => m.id);

    if (unreadMessageIds.length === 0) return;

    const reads = unreadMessageIds.map((message_id) => ({
      message_id,
      user_id: user.id,
    }));

    await supabase.from('message_reads').upsert(reads, { onConflict: 'message_id,user_id' });
  };

  return {
    messages,
    members: membersQuery.data,
    isLoading: membersQuery.isLoading,
    sendMessage,
    sendVoice: sendVoiceRecording,
    markAsRead,
    reloadMessages,
    unsendOwnMessage,
    hideMessageForSelf,
    adminPinChatMessage,
    adminUnpinChat,
    adminClearEventChat,
    refetchMembers: () => membersQuery.refetch(),
  };
};
