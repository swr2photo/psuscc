import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface MyRegistration {
  id: string;
  status: string;
  created_at: string;
  event_id: string;
  events: {
    title: string;
    start_date?: string | null;
    end_date?: string | null;
    event_date?: string | null;
    location?: string | null;
    image_color?: string | null;
    cover_url?: string | null;
  };
}

export const useMyRegistrations = () => {
  return useQuery<MyRegistration[]>({
    queryKey: ['my_registrations'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('event_registrations')
        .select(
          `
          id,
          status,
          created_at,
          event_id,
          events (
            title,
            start_date,
            end_date,
            event_date,
            location,
            cover_url
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    },
  });
};
