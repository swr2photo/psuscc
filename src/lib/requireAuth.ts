import { supabase } from '@/lib/supabase';
import { isWebPlatform } from '@/lib/webGuest';
import type { Router } from 'expo-router';

export async function ensureAuthedOrGoAuth(
  router: Router,
  opts?: { message?: string; redirectTo?: string },
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return true;

  const msg = opts?.message ?? 'กรุณาเข้าสู่ระบบก่อนทำรายการ';
  // Keep it simple: route to auth switch screen
  router.push({
    pathname: isWebPlatform() ? '/(auth)/add' : '/(auth)',
    params: opts?.redirectTo ? { redirectTo: opts.redirectTo } : undefined,
  } as never);

  // Optional lightweight feedback (screens already show what to do)
  // Avoid importing Toast here to keep deps minimal.
  console.log(msg);
  return false;
}

