import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CheckinSummaryRow {
  session_id: string;
  event_id: string | null;
  title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  location_name: string | null;
  event_title: string | null;
  success_count: number;
  out_of_range_count: number;
  duplicate_count: number;
  total_attempts: number;
}

export interface CheckinDetail {
  id: string;
  session_id: string;
  event_id: string | null;
  user_id: string;
  checkin_at: string;
  user_lat: number | null;
  user_lng: number | null;
  distance_meters: number | null;
  status: string;
  note: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

/** รายการเช็กอินสำหรับแอดมิน (มีชื่อรอบ / ค่าย) */
export interface AdminCheckinRow extends CheckinDetail {
  session_title?: string | null;
  session_date?: string | null;
  event_title?: string | null;
  /** รูปปกค่าย (จาก events.cover_url หรือ detail_image_url) */
  event_cover_url?: string | null;
}

export interface CheckinSummaryByEventRow {
  event_id: string;
  event_title: string;
  success_checkins: number;
  unique_attendees: number;
  out_of_range_count: number;
  session_count: number;
}

export const useCheckinSummary = () => {
  return useQuery<CheckinSummaryRow[]>({
    queryKey: ['checkin_summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_checkin_daily_summary')
        .select('*');
      if (error) throw error;
      return (data as CheckinSummaryRow[]) || [];
    },
    refetchInterval: 15000,
  });
};

export const useCheckinSummaryByEvent = () => {
  return useQuery<CheckinSummaryByEventRow[]>({
    queryKey: ['checkin_summary_by_event'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_checkin_summary_by_event')
        .select('*');
      if (error) throw error;
      return (data as CheckinSummaryByEventRow[]) || [];
    },
    refetchInterval: 15000,
  });
};

export const useSessionCheckins = (
  sessionId?: string,
  options?: { status?: 'success' | 'out_of_range' | 'all' },
) => {
  const statusFilter = options?.status === 'all' || !options?.status ? null : options.status;

  return useQuery<CheckinDetail[]>({
    queryKey: ['checkins_for_session', sessionId, statusFilter ?? 'all'],
    enabled: !!sessionId,
    queryFn: async () => {
      let q = supabase
        .from('checkins')
        .select('*')
        .eq('session_id', sessionId!)
        .order('checkin_at', { ascending: false });

      if (statusFilter) {
        q = q.eq('status', statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;

      // hydrate with profile info
      const rows = (data as CheckinDetail[]) || [];
      const withProfiles = await Promise.all(
        rows.map(async (row) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle();
          return { ...row, profiles: profile || null } as CheckinDetail;
        }),
      );
      return withProfiles;
    },
    refetchInterval: 15000,
  });
};

/** แอดมิน: รายการเช็กอินสำเร็จทั้งหมด (อาจกรองเฉพาะค่าย event_id) */
export const useAdminAllSuccessCheckins = (eventIdFilter?: string | null) => {
  return useQuery<AdminCheckinRow[]>({
    queryKey: ['admin_all_success_checkins', eventIdFilter ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('checkins')
        .select(
          `
          *,
          checkin_sessions ( title, session_date ),
          events ( title, cover_url, detail_image_url )
        `,
        )
        .eq('status', 'success')
        .order('checkin_at', { ascending: false })
        .limit(2500);

      if (eventIdFilter) {
        q = q.eq('event_id', eventIdFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      const raw = (data || []) as any[];

      const userIds = [...new Set(raw.map((r) => r.user_id))];
      const profileMap = new Map<
        string,
        { full_name: string | null; email: string | null; avatar_url: string | null }
      >();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);
        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
      }

      return raw.map((r): AdminCheckinRow => {
        const sess = r.checkin_sessions;
        const ev = r.events;
        const cover =
          (ev?.cover_url as string | null | undefined) ||
          (ev?.detail_image_url as string | null | undefined) ||
          null;
        return {
          id: r.id,
          session_id: r.session_id,
          event_id: r.event_id,
          user_id: r.user_id,
          checkin_at: r.checkin_at,
          user_lat: r.user_lat,
          user_lng: r.user_lng,
          distance_meters: r.distance_meters,
          status: r.status,
          note: r.note,
          profiles: profileMap.get(r.user_id) ?? null,
          session_title: sess?.title ?? null,
          session_date: sess?.session_date ?? null,
          event_title: ev?.title ?? null,
          event_cover_url: cover,
        };
      });
    },
    refetchInterval: 20000,
  });
};

export const useMyCheckins = () => {
  return useQuery<CheckinDetail[]>({
    queryKey: ['my_checkins'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('checkin_at', { ascending: false });
      if (error) throw error;
      return (data as CheckinDetail[]) || [];
    },
  });
};

/** แอดมินลบรายการเช็กอิน (ต้องมี RLS checkins_admin_delete) */
export const useDeleteCheckin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (checkinId: string) => {
      const { error } = await supabase.from('checkins').delete().eq('id', checkinId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkins_for_session'] });
      qc.invalidateQueries({ queryKey: ['admin_all_success_checkins'] });
      qc.invalidateQueries({ queryKey: ['checkin_summary'] });
      qc.invalidateQueries({ queryKey: ['checkin_summary_by_event'] });
      qc.invalidateQueries({ queryKey: ['my_checkins'] });
    },
  });
};
