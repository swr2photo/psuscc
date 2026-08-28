import type {
  HomeFeedProfile,
  HomePost,
  HomePostComment,
  HomeStory,
  HomeStoryReply,
  HomeStoryView,
} from './types';

export function unwrapProfile(raw: unknown): HomeFeedProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw)) return (raw[0] as HomeFeedProfile) ?? null;
  return raw as HomeFeedProfile;
}

export function normalizePost(row: Record<string, unknown>): HomePost {
  const raw = row as unknown as HomePost;
  return {
    ...raw,
    like_count: Number(raw.like_count ?? 0),
    comment_count: Number(raw.comment_count ?? 0),
    allow_comments: raw.allow_comments !== false,
    allow_likes: raw.allow_likes !== false,
    tagged_user_ids: Array.isArray(raw.tagged_user_ids) ? raw.tagged_user_ids : [],
    profiles: unwrapProfile(row.profiles),
  };
}

export function normalizeStory(row: Record<string, unknown>): HomeStory {
  const raw = row as unknown as HomeStory;
  const mediaType = raw.media_type === 'video' ? 'video' : 'image';
  return {
    ...raw,
    media_type: mediaType,
    duration_ms: raw.duration_ms ?? null,
    allow_replies: raw.allow_replies !== false,
    tagged_user_ids: Array.isArray(raw.tagged_user_ids) ? raw.tagged_user_ids : [],
    profiles: unwrapProfile(row.profiles),
  };
}

export function normalizeComment(row: Record<string, unknown>): HomePostComment {
  return {
    ...(row as unknown as HomePostComment),
    profiles: unwrapProfile(row.profiles),
  };
}

export function normalizeStoryView(row: Record<string, unknown>): HomeStoryView {
  return {
    ...(row as unknown as HomeStoryView),
    profiles: unwrapProfile(row.profiles),
  };
}

export function normalizeStoryReply(row: Record<string, unknown>): HomeStoryReply {
  const raw = row as unknown as HomeStoryReply;
  return {
    ...raw,
    reply_type: raw.reply_type === 'reply' ? 'reply' : 'message',
    profiles: unwrapProfile(row.profiles),
  };
}
