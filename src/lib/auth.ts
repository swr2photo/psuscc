import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { mmkvStorage } from '@/lib/mmkv';

const REACT_QUERY_PERSIST_KEY = 'REACT_QUERY_OFFLINE_CACHE';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export async function logout(): Promise<void> {
  // Best-effort cleanup: always try to remove local traces
  try {
    // Force local sign-out so the device session is cleared even if global revoke isn't desired.
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // ignore
  }

  try {
    await mmkvStorage.multiRemove([REACT_QUERY_PERSIST_KEY, BIOMETRIC_ENABLED_KEY]);
  } catch {
    // ignore
  }

  try {
    queryClient.clear();
  } catch {
    // ignore
  }
}

