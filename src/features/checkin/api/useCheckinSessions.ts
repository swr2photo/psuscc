import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CheckinSession {
  id: string;
  event_id: string | null;
  session_date: string; // YYYY-MM-DD
  title: string;
  qr_token: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_radius: number;
  enforce_location: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  events?: {
    id: string;
    title: string;
    max_checkins_per_user?: number | null;
  } | null;
}

export interface CheckinSessionInput {
  id?: string;
  event_id?: string | null;
  title: string;
  start_time: string;
  end_time: string;
  is_active?: boolean;
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_radius?: number;
  enforce_location?: boolean;
}

const generateToken = () => {
  const arr = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const useCheckinSessions = (eventId?: string, isAdmin = false) => {
  return useQuery<CheckinSession[]>({
    queryKey: ['checkin_sessions', eventId ?? 'all', isAdmin],
    queryFn: async () => {
      // Admins can see everything including qr_token, others use safe view
      const table = isAdmin ? 'checkin_sessions' : 'v_checkin_sessions_safe';
      
      let query = supabase
        .from(table)
        .select('*, events(id, title, max_checkins_per_user)')
        .order('session_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (eventId) query = query.eq('event_id', eventId);

      const { data, error } = await query;
      if (error) throw error;
      return (data as CheckinSession[]) || [];
    },
  });
};

export const useUpsertCheckinSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckinSessionInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

      const sessionDate = new Date(input.start_time).toISOString().split('T')[0];

      if (input.id) {
        const { data, error } = await supabase
          .from('checkin_sessions')
          .update({
            event_id: input.event_id ?? null,
            title: input.title,
            start_time: input.start_time,
            end_time: input.end_time,
            is_active: input.is_active ?? true,
            location_name: input.location_name ?? null,
            location_lat: input.location_lat ?? null,
            location_lng: input.location_lng ?? null,
            location_radius: input.location_radius ?? 100,
            enforce_location: input.enforce_location ?? true,
            session_date: sessionDate,
          })
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw error;
        return data as CheckinSession;
      }

      const { data, error } = await supabase
        .from('checkin_sessions')
        .insert([
          {
            event_id: input.event_id ?? null,
            title: input.title,
            qr_token: generateToken(),
            session_date: sessionDate,
            start_time: input.start_time,
            end_time: input.end_time,
            is_active: input.is_active ?? true,
            location_name: input.location_name ?? null,
            location_lat: input.location_lat ?? null,
            location_lng: input.location_lng ?? null,
            location_radius: input.location_radius ?? 100,
            enforce_location: input.enforce_location ?? true,
            created_by: user.id,
          },
        ])
        .select('*')
        .single();
      if (error) throw error;
      return data as CheckinSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkin_sessions'] });
      qc.invalidateQueries({ queryKey: ['checkin_summary'] });
    },
  });
};

export const useDeleteCheckinSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checkin_sessions').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkin_sessions'] });
      qc.invalidateQueries({ queryKey: ['checkin_summary'] });
    },
  });
};

export const useToggleCheckinSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('checkin_sessions')
        .update({ is_active: isActive })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as CheckinSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkin_sessions'] });
    },
  });
};

export const useRegenerateCheckinToken = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('checkin_sessions')
        .update({ qr_token: generateToken() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as CheckinSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkin_sessions'] });
    },
  });
};
