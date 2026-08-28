import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CheckinSession } from './useCheckinSessions';

export interface PerformCheckinInput {
  qrToken: string;
  userLat?: number | null;
  userLng?: number | null;
}

export interface PerformCheckinResult {
  status:
    | 'success'
    | 'out_of_range'
    | 'expired'
    | 'duplicate'
    | 'inactive'
    | 'limit_reached';
  message: string;
  session?: CheckinSession;
  distanceMeters?: number;
  /** ชื่อค่าย/กิจกรรม (จาก events.title) */
  campName?: string | null;
  /** จำนวนครั้งเช็กอินสำเร็จในค่ายนี้แล้ว (หลังทำรายการล่าสุด หรือตอนถูกบล็อก) */
  eventCheckinCount?: number;
  /** โควต้าสูงสุดต่อคน; null = ไม่จำกัด */
  eventCheckinMax?: number | null;
}

export const usePerformCheckin = () => {
  const qc = useQueryClient();
  return useMutation<PerformCheckinResult, Error, PerformCheckinInput>({
    mutationFn: async ({ qrToken, userLat, userLng }) => {
      const { data, error } = await supabase.rpc('perform_checkin', {
        p_qr_token: qrToken,
        p_lat: userLat ?? null,
        p_lng: userLng ?? null,
      });

      if (error) {
        console.error('Checkin RPC Error:', error);
        throw new Error(error.message || 'เกิดข้อผิดพลาดในการเช็กอิน');
      }

      return data as PerformCheckinResult;
    },
    onSuccess: (res) => {
      if (res.status === 'success') {
        qc.invalidateQueries({ queryKey: ['checkin_summary'] });
        qc.invalidateQueries({ queryKey: ['my_checkins'] });
      }
    },
  });
};
