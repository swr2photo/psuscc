import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  type?: string;
  created_at: string;
}

export const useNotifications = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel: any = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Unique channel name with timestamp to avoid reuse conflicts
      const channelName = `notifications:${user.id}:${Date.now()}`;
      
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('🔔 Realtime: Subscribed to notifications');
          }
        });
    };

    setup();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  const { data: notifications, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return (data ?? []).map((row) => {
        const r = row as Notification & { body?: string };
        return {
          ...r,
          message: r.message ?? r.body ?? '',
          type: r.type ?? (r.data as { type?: string } | undefined)?.type,
        };
      });
    },
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    notifications,
    isLoading,
    isRefetching,
    error,
    refetch,
    markAsRead,
    markAllAsRead,
  };
};
