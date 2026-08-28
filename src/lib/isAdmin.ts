import { supabase } from '@/lib/supabase';

/** เชื่อมกับ public.is_admin() ใน migration (profiles.role / whitelist อีเมลในฐานข้อมูล) */
export async function fetchIsAppAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.warn('[isAdmin]', error.message);
    return false;
  }
  return Boolean(data);
}
