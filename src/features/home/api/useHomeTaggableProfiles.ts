import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HomeFeedProfile } from '../types';

export function useHomeTaggableProfiles(search: string) {
  const q = search.trim();
  return useQuery({
    queryKey: ['home', 'taggable-profiles', q],
    queryFn: async (): Promise<HomeFeedProfile[]> => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .order('full_name', { ascending: true })
        .limit(40);

      if (q.length >= 1) {
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as HomeFeedProfile[];
    },
    staleTime: 30_000,
  });
}
