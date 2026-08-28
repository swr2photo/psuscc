import { supabase } from '@/lib/supabase';

interface ProfileCache {
  avatarUrl: string | null;
  lastFetched: number;
}

let cachedProfile: ProfileCache | null = null;
let currentFetchPromise: Promise<string | null> | null = null;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Gets the cached avatar URL or fetches it if not available/expired.
 * Handles concurrent calls by returning the same promise for all simultaneous requests.
 */
export const getCachedAvatarUrl = async (): Promise<string | null> => {
  const now = Date.now();
  
  // 1. Return from cache if still valid
  if (cachedProfile && (now - cachedProfile.lastFetched < CACHE_TTL)) {
    return cachedProfile.avatarUrl;
  }

  // 2. If a fetch is already in progress, wait for it
  if (currentFetchPromise) {
    return currentFetchPromise;
  }

  // 3. Start a new fetch and store the promise
  currentFetchPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single();

      const avatarUrl = profile?.avatar_url || null;
      cachedProfile = { avatarUrl, lastFetched: Date.now() };
      return avatarUrl;
    } catch (e) {
      console.error('Error fetching profile avatar:', e);
      return null;
    } finally {
      currentFetchPromise = null; // Clear promise lock
    }
  })();

  return currentFetchPromise;
};

export const clearProfileCache = () => {
  cachedProfile = null;
  currentFetchPromise = null;
};
