import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { HomeFeedProfile, HomeStoryReply, HomeStoryView, HomeStory } from '../types';
import { normalizeStoryReply, normalizeStoryView } from '../normalizeHomeFeed';
import { notifyHomeStoryLike } from '../homeLikeNotify';

const VIEW_BASE = 'story_id, user_id, viewed_at';
const VIEW_WITH_PROFILES = `${VIEW_BASE}, profiles ( id, full_name, avatar_url, email )`;

const REPLY_BASE = 'id, story_id, user_id, body, reply_type, created_at';
const REPLY_WITH_PROFILES = `${REPLY_BASE}, profiles ( id, full_name, avatar_url, email )`;

async function attachProfiles<T extends { user_id: string }>(
  rows: T[],
): Promise<(T & { profiles: HomeFeedProfile | null })[]> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (!ids.length) return rows.map((r) => ({ ...r, profiles: null }));
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', ids);
  if (error) {
    return rows.map((r) => ({ ...r, profiles: null }));
  }
  const map = new Map((data ?? []).map((p) => [p.id, p as HomeFeedProfile]));
  return rows.map((r) => ({ ...r, profiles: map.get(r.user_id) ?? null }));
}

export function useRecordStoryView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: story } = await supabase
        .from('home_stories')
        .select('user_id')
        .eq('id', storyId)
        .maybeSingle();
      if (!story || story.user_id === user.id) return;

      const row = { story_id: storyId, user_id: user.id, viewed_at: new Date().toISOString() };
      const { error } = await supabase.from('home_story_views').upsert(row, {
        onConflict: 'story_id,user_id',
      });
      if (error) {
        if (/schema|relation|does not exist|42P01/i.test(error.message)) return;
        const { error: updateErr } = await supabase
          .from('home_story_views')
          .update({ viewed_at: row.viewed_at })
          .eq('story_id', storyId)
          .eq('user_id', user.id);
        if (updateErr) throw updateErr;
      }
    },
    onSuccess: (_d, storyId) => {
      void qc.invalidateQueries({ queryKey: ['home', 'story', storyId, 'viewers'] });
    },
  });
}

export function useStoryViewers(storyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['home', 'story', storyId, 'viewers'],
    enabled: enabled && !!storyId,
    queryFn: async (): Promise<HomeStoryView[]> => {
      let res = await supabase
        .from('home_story_views')
        .select(VIEW_WITH_PROFILES)
        .eq('story_id', storyId)
        .order('viewed_at', { ascending: false });

      if (res.error && /relationship|profiles|schema|relation/i.test(res.error.message)) {
        const plain = await supabase
          .from('home_story_views')
          .select(VIEW_BASE)
          .eq('story_id', storyId)
          .order('viewed_at', { ascending: false });
        if (plain.error) throw plain.error;
        const withProfiles = await attachProfiles(plain.data ?? []);
        return withProfiles.map((r) => normalizeStoryView(r as Record<string, unknown>));
      }
      if (res.error) throw res.error;
      return (res.data ?? []).map((r) => normalizeStoryView(r as Record<string, unknown>));
    },
  });
}

export function useStoryLikerIds(storyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['home', 'story', storyId, 'likers'],
    enabled: enabled && !!storyId,
    queryFn: async () => {
      const res = await supabase
        .from('home_story_likes')
        .select('user_id')
        .eq('story_id', storyId);
      if (res.error) throw res.error;
      return new Set((res.data ?? []).map((r) => r.user_id as string));
    },
  });
}

export function useStoryReplies(storyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['home', 'story', storyId, 'replies'],
    enabled: enabled && !!storyId,
    queryFn: async (): Promise<HomeStoryReply[]> => {
      let res = await supabase
        .from('home_story_replies')
        .select(REPLY_WITH_PROFILES)
        .eq('story_id', storyId)
        .order('created_at', { ascending: true });

      if (res.error && /relationship|profiles|schema|relation/i.test(res.error.message)) {
        const plain = await supabase
          .from('home_story_replies')
          .select(REPLY_BASE)
          .eq('story_id', storyId)
          .order('created_at', { ascending: true });
        if (plain.error) throw plain.error;
        const withProfiles = await attachProfiles(plain.data ?? []);
        return withProfiles.map((r) => normalizeStoryReply(r as Record<string, unknown>));
      }
      if (res.error) throw res.error;
      return (res.data ?? []).map((r) => normalizeStoryReply(r as Record<string, unknown>));
    },
  });
}

export function useStoryLiked(storyId: string) {
  return useQuery({
    queryKey: ['home', 'story', storyId, 'liked'],
    enabled: !!storyId,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const res = await supabase
        .from('home_story_likes')
        .select('user_id')
        .eq('story_id', storyId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (res.error && /schema|relation/i.test(res.error.message)) return false;
      if (res.error) throw res.error;
      return !!res.data;
    },
  });
}

export function useToggleStoryLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storyId, liked }: { storyId: string; liked: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      if (liked) {
        const { error } = await supabase
          .from('home_story_likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', user.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from('home_story_likes')
        .insert({ story_id: storyId, user_id: user.id });
      if (error) throw error;
      void notifyHomeStoryLike(storyId, user.id);
      return true;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['home', 'story', vars.storyId, 'liked'] });
      void qc.invalidateQueries({ queryKey: ['home', 'story', vars.storyId, 'likers'] });
    },
  });
}

export function useSendStoryReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storyId,
      body,
      replyType = 'message',
    }: {
      storyId: string;
      body: string;
      replyType?: 'reply' | 'message';
    }) => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('กรุณาพิมพ์ข้อความ');

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      const { data, error } = await supabase
        .from('home_story_replies')
        .insert({
          story_id: storyId,
          user_id: user.id,
          body: trimmed,
          reply_type: replyType,
        })
        .select(REPLY_BASE)
        .single();
      if (error) throw error;
      return normalizeStoryReply({ ...data, profiles: null } as Record<string, unknown>);
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['home', 'story', vars.storyId, 'replies'] });
    },
  });
 }
 
 export function useDeleteStory() {
   const qc = useQueryClient();
   return useMutation({
     mutationFn: async (storyId: string) => {
       const { error } = await supabase.from('home_stories').delete().eq('id', storyId);
       if (error) throw error;
     },
     onSuccess: () => {
       void qc.invalidateQueries({ queryKey: ['home', 'stories'] });
     },
   });
 }
 
 export function useUpdateStory() {
   const qc = useQueryClient();
   return useMutation({
     mutationFn: async ({ storyId, updates }: { storyId: string; updates: Partial<HomeStory> }) => {
       const { error } = await supabase.from('home_stories').update(updates).eq('id', storyId);
       if (error) throw error;
     },
     onSuccess: (_d, vars) => {
       void qc.invalidateQueries({ queryKey: ['home', 'stories'] });
       void qc.invalidateQueries({ queryKey: ['home', 'story', vars.storyId] });
     },
   });
 }
 
 export function profileDisplayName(p: HomeFeedProfile | null | undefined): string {
  return p?.full_name?.trim() || p?.email?.split('@')[0] || 'สมาชิก';
}
