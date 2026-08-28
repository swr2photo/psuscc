import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HomeFeedCreatePayload } from '../types';
import { isHomeVideo } from '../homeMedia';
import { supabase } from '@/lib/supabase';
import type {
  HomePost,
  HomePostComment,
  HomeStory,
  HomeStoryGroup,
  HomeFeedProfile,
  MyPostEngagement,
} from '../types';
import { uploadHomeFeedMedia } from '../uploadHomeMedia';
import { notifyHomePostLike } from '../homeLikeNotify';
import {
  normalizeComment,
  normalizePost,
  normalizeStory,
  unwrapProfile,
} from '../normalizeHomeFeed';
import type { User } from '@supabase/supabase-js';

async function ensureProfileRow(user: User) {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    full_name:
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      'สมาชิก',
    avatar_url:
      (user.user_metadata?.avatar_url as string | undefined) ||
      (user.user_metadata?.picture as string | undefined) ||
      null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[home] ensureProfileRow', error.message);
  }
}

const STORY_BASE =
  'id, user_id, image_url, media_type, duration_ms, caption, location_label, tagged_user_ids, allow_replies, expires_at, created_at';
const STORY_WITH_PROFILES = `${STORY_BASE}, profiles ( id, full_name, avatar_url, email )`;

const POST_BASE =
  'id, user_id, image_url, caption, is_hidden, location_label, tagged_user_ids, allow_comments, allow_likes, created_at';
const POST_WITH_COUNTS = `${POST_BASE}, like_count, comment_count`;
const POST_WITH_PROFILES = `${POST_WITH_COUNTS}, profiles ( id, full_name, avatar_url, email )`;

const COMMENT_BASE = 'id, post_id, user_id, body, created_at';
const COMMENT_WITH_PROFILES = `${COMMENT_BASE}, profiles ( id, full_name, avatar_url, email )`;

async function insertHomeRow(
  table: 'home_posts' | 'home_stories',
  full: Record<string, unknown>,
  minimal: Record<string, unknown>,
): Promise<string> {
  let res = await supabase.from(table).insert(full).select('id').single();
  if (res.error && /column|schema cache/i.test(res.error.message)) {
    res = await supabase.from(table).insert(minimal).select('id').single();
  }
  if (res.error) throw res.error;
  return res.data.id as string;
}

function buildStoryRows(userId: string, mediaUrl: string, p: HomeFeedCreatePayload) {
  const caption = p.caption?.trim() || null;
  const media = Array.isArray(p.media) ? p.media[0] : p.media;
  if (!media) {
    throw new Error('ไม่พบไฟล์สื่อสำหรับสตอรี');
  }
  const isVideo = isHomeVideo(media);
  const minimal = {
    user_id: userId,
    image_url: mediaUrl,
    caption,
    ...(isVideo ? {} : { media_type: 'image' as const }),
  };
  const full = {
    ...minimal,
    media_type: isVideo ? 'video' : 'image',
    duration_ms: isVideo ? (media.durationMs ?? null) : null,
    location_label: p.locationLabel?.trim() || null,
    tagged_user_ids: p.taggedUserIds?.length ? p.taggedUserIds : [],
    allow_replies: p.allowReplies !== false,
  };
  return { full, minimal };
}

function buildPostRows(userId: string, imageUrl: string, p: HomeFeedCreatePayload) {
  const caption = p.caption?.trim() || null;
  const minimal = { user_id: userId, image_url: imageUrl, caption };
  const full = {
    ...minimal,
    location_label: p.locationLabel?.trim() || null,
    tagged_user_ids: p.taggedUserIds?.length ? p.taggedUserIds : [],
    allow_comments: p.allowComments !== false,
    allow_likes: p.allowLikes !== false,
  };
  return { full, minimal };
}

async function attachProfiles<T extends { user_id: string }>(
  rows: T[],
): Promise<(T & { profiles: HomeFeedProfile | null })[]> {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (!ids.length) {
    return rows.map((r) => ({ ...r, profiles: null }));
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', ids);
  if (error) {
    console.warn('[home] attachProfiles', error.message);
    return rows.map((r) => ({ ...r, profiles: null }));
  }
  const map = new Map((data ?? []).map((p) => [p.id, p as HomeFeedProfile]));
  return rows.map((r) => ({ ...r, profiles: map.get(r.user_id) ?? null }));
}

export function groupStoriesByUser(stories: HomeStory[]): HomeStoryGroup[] {
  const map = new Map<string, HomeStoryGroup>();
  for (const s of stories) {
    const profile = s.profiles;
    const existing = map.get(s.user_id);
    if (existing) {
      existing.stories.push(s);
    } else {
      map.set(s.user_id, {
        userId: s.user_id,
        displayName: profile?.full_name?.trim() || 'สมาชิก',
        avatarUrl: profile?.avatar_url ?? null,
        stories: [s],
      });
    }
  }
  for (const g of map.values()) {
    g.stories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return [...map.values()].sort(
    (a, b) =>
      new Date(b.stories[b.stories.length - 1]!.created_at).getTime() -
      new Date(a.stories[a.stories.length - 1]!.created_at).getTime(),
  );
}

export function useHomeStories() {
  return useQuery({
    queryKey: ['home', 'stories'],
    queryFn: async () => {
      let res = await supabase
        .from('home_stories')
        .select(STORY_WITH_PROFILES)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (res.error && /relationship|profiles/i.test(res.error.message)) {
        const plain = await supabase
          .from('home_stories')
          .select(STORY_BASE)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true });
        if (plain.error) throw plain.error;
        const withProfiles = await attachProfiles(plain.data ?? []);
        return withProfiles.map((r) => normalizeStory(r as Record<string, unknown>));
      }

      if (res.error && /column|location_label|tagged_user|allow_replies|media_type|duration_ms/i.test(res.error.message)) {
        const legacy = await supabase
          .from('home_stories')
          .select('id, user_id, image_url, caption, expires_at, created_at')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true });
        if (legacy.error) throw legacy.error;
        const withProfiles = await attachProfiles(legacy.data ?? []);
        return withProfiles.map((r) => normalizeStory(r as Record<string, unknown>));
      }

      if (res.error) throw res.error;
      return (res.data ?? []).map((r) => normalizeStory(r as Record<string, unknown>));
    },
  });
}

export function useHomePosts() {
  return useQuery({
    queryKey: ['home', 'posts'],
    queryFn: async () => {
      let select = POST_WITH_PROFILES;
      let res = await supabase
        .from('home_posts')
        .select(select)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (res.error && /like_count|comment_count/i.test(res.error.message)) {
        select = `${POST_BASE}, profiles ( id, full_name, avatar_url, email )`;
        res = await supabase
          .from('home_posts')
          .select(select)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
      }

      if (res.error && /relationship|profiles/i.test(res.error.message)) {
        const plain = await supabase
          .from('home_posts')
          .select(POST_WITH_COUNTS)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
        if (plain.error && /like_count|comment_count/i.test(plain.error.message)) {
          const minimal = await supabase
            .from('home_posts')
            .select(POST_BASE)
            .eq('is_hidden', false)
            .order('created_at', { ascending: false });
          if (minimal.error) throw minimal.error;
          const withProfiles = await attachProfiles(minimal.data ?? []);
          return withProfiles.map((r) => normalizePost(r as Record<string, unknown>));
        }
        if (plain.error) throw plain.error;
        const withProfiles = await attachProfiles(plain.data ?? []);
        return withProfiles.map((r) => normalizePost(r as Record<string, unknown>));
      }

      if (res.error && /column|location_label|tagged_user|allow_comments|allow_likes/i.test(res.error.message)) {
        const legacy = await supabase
          .from('home_posts')
          .select('id, user_id, image_url, caption, is_hidden, created_at')
          .eq('is_hidden', false)
          .order('created_at', { ascending: false });
        if (legacy.error) throw legacy.error;
        const withProfiles = await attachProfiles(legacy.data ?? []);
        return withProfiles.map((r) => normalizePost(r as Record<string, unknown>));
      }

      if (res.error) throw res.error;
      return (res.data ?? []).map((r) => normalizePost(r as unknown as Record<string, unknown>));
    },
  });
}

export function useCreateHomeStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: HomeFeedCreatePayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      await ensureProfileRow(user);
      const media = Array.isArray(payload.media) ? payload.media[0] : payload.media;
      if (!media) {
        throw new Error('ไม่พบไฟล์สื่อสำหรับสตอรี');
      }
      const mediaUrl = await uploadHomeFeedMedia(user.id, media);
      const { full, minimal } = buildStoryRows(user.id, mediaUrl, payload);
      return insertHomeRow('home_stories', full, minimal);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home', 'stories'] });
    },
  });
}

export function useCreateHomePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: HomeFeedCreatePayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      await ensureProfileRow(user);
      
      const mediaList = Array.isArray(payload.media) ? payload.media : [payload.media];
      
      for (const m of mediaList) {
        if (isHomeVideo(m)) {
          throw new Error('โพสต์รองรับเฉพาะรูปภาพ — ใช้สตอรีสำหรับวิดีโอ');
        }
      }

      const uploadPromises = mediaList.map(m => uploadHomeFeedMedia(user.id, m));
      const urls = await Promise.all(uploadPromises);
      const mediaUrl = urls.join(',');

      const { full, minimal } = buildPostRows(user.id, mediaUrl, payload);
      return insertHomeRow('home_posts', full, minimal);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home', 'posts'] });
    },
  });
}

export function useDeleteHomePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('home_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home', 'posts'] });
    },
  });
}

export function useMyPostEngagement(postIds: string[]) {
  const key = postIds.length ? [...postIds].sort().join(',') : '';
  return useQuery({
    queryKey: ['home', 'my-engagement', key],
    enabled: postIds.length > 0,
    queryFn: async (): Promise<MyPostEngagement> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { likedIds: new Set(), savedIds: new Set() };

      const [likesRes, savesRes] = await Promise.all([
        supabase.from('home_post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id),
        supabase.from('home_post_saves').select('post_id').in('post_id', postIds).eq('user_id', user.id),
      ]);
      if (likesRes.error) throw likesRes.error;
      if (savesRes.error) throw savesRes.error;

      return {
        likedIds: new Set((likesRes.data ?? []).map((r) => r.post_id as string)),
        savedIds: new Set((savesRes.data ?? []).map((r) => r.post_id as string)),
      };
    },
  });
}

export function useHomePostComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['home', 'comments', postId],
    enabled: enabled && !!postId,
    queryFn: async () => {
      let res = await supabase
        .from('home_post_comments')
        .select(COMMENT_WITH_PROFILES)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (res.error && /relationship|profiles/i.test(res.error.message)) {
        const plain = await supabase
          .from('home_post_comments')
          .select(COMMENT_BASE)
          .eq('post_id', postId)
          .order('created_at', { ascending: true });
        if (plain.error) throw plain.error;
        const withProfiles = await attachProfiles(plain.data ?? []);
        return withProfiles.map((r) => normalizeComment(r as Record<string, unknown>));
      }

      if (res.error) throw res.error;
      return (res.data ?? []).map((r) => normalizeComment(r as Record<string, unknown>));
    },
  });
}

export function useToggleHomePostLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      if (liked) {
        const { error } = await supabase
          .from('home_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from('home_post_likes').insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
      void notifyHomePostLike(postId, user.id);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home', 'posts'] });
      void qc.invalidateQueries({ queryKey: ['home', 'my-engagement'] });
    },
  });
}

export function useToggleHomePostSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, saved }: { postId: string; saved: boolean }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      if (saved) {
        const { error } = await supabase
          .from('home_post_saves')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from('home_post_saves').insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home', 'my-engagement'] });
    },
  });
}

export function useCreateHomePostComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('กรุณาพิมพ์คอมเมนต์');

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('กรุณาเข้าสู่ระบบ');

      const { data, error } = await supabase
        .from('home_post_comments')
        .insert({ post_id: postId, user_id: user.id, body: trimmed })
        .select(COMMENT_BASE)
        .single();
      if (error) throw error;
      return normalizeComment(data as Record<string, unknown>);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['home', 'comments', vars.postId] });
      void qc.invalidateQueries({ queryKey: ['home', 'posts'] });
    },
  });
}
