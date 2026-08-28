import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';
import { notifyUser } from '@/lib/notifications';

interface RegisterPayload {
  event_id: string;
  allergies?: string;
  medical_notes?: string;
  slip_url?: string;
}

export const useRegisterActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const err = new Error('กรุณาล็อกอินก่อนสมัครกิจกรรม');
        (err as any).code = 'AUTH_REQUIRED';
        throw err;
      }

      // 1. ดึงข้อมูลกิจกรรมปัจจุบัน (ดึง current_participants และ capacity มาเช็ค)
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('title, capacity, current_participants')
        .eq('id', payload.event_id)
        .single();

      if (eventError) throw eventError;

      // 2. ตรวจสอบว่าเต็มหรือยัง (ใช้ค่า current_participants ที่ Sync จาก Server)
      if (event.current_participants >= event.capacity) {
        throw new Error('ขออภัย กิจกรรมนี้มีผู้สมัครเต็มจำนวนแล้ว');
      }
      
      // 3. บันทึกข้อมูลการสมัคร
      const { data, error } = await supabase
        .from('event_registrations')
        .insert([
          {
            event_id: payload.event_id,
            user_id: user.id,
            allergies: payload.allergies,
            medical_notes: payload.medical_notes,
            slip_url: payload.slip_url,
            status: 'registered'
          },
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') throw new Error('คุณได้ลงทะเบียนกิจกรรมนี้ไปแล้ว');
        throw error;
      }
      return { ...data, event_title: event.title };
    },
    onSuccess: async (data: any) => {
      Toast.show({
        type: 'success',
        text1: 'ลงทะเบียนสำเร็จ! 🎉',
        text2: 'เราได้รับข้อมูลการสมัครและหลักฐานการโอนเงินแล้ว',
      });

      // แจ้งเตือนผู้ใช้ (บันทึก DB + Push)
      await notifyUser(
        data.user_id,
        'สมัครกิจกรรมสำเร็จ',
        `คุณได้ลงทะเบียนกิจกรรม "${data.event_title}" เรียบร้อยแล้ว ขณะนี้กำลังรอแอดมินตรวจสอบสลิป`,
        { type: 'success', event_id: data.event_id }
      );

      // สั่งให้ทุกหน้าที่เกี่ยวข้องดึงข้อมูลใหม่ทันที
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['my_registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin_dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'ลงทะเบียนไม่สำเร็จ',
        text2: error.message,
      });
    }
  });
};
