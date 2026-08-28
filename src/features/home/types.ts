import type { HomeCapturedMedia } from './homeMedia';

export interface HomeStory {
  id: string;
  user_id: string;
  image_url: string;
  media_type?: 'image' | 'video';
  duration_ms?: number | null;
  caption: string | null;
  location_label?: string | null;
  tagged_user_ids?: string[];
  allow_replies?: boolean;
  expires_at: string;
  created_at: string;
  profiles?: HomeFeedProfile | null;
}
export interface HomePost {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  is_hidden: boolean;
  like_count: number;
  comment_count: number;
  location_label?: string | null;
  tagged_user_ids?: string[];
  allow_comments?: boolean;
  allow_likes?: boolean;
  created_at: string;
  profiles?: HomeFeedProfile | null;
}

export type HomeFeedCreatePayload = {
  media: HomeCapturedMedia | HomeCapturedMedia[];
  caption?: string;
  locationLabel?: string;
  taggedUserIds?: string[];
  allowComments?: boolean;
  allowLikes?: boolean;
  allowReplies?: boolean;
};

export interface HomePostComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: HomeFeedProfile | null;
}

export type MyPostEngagement = {
  likedIds: Set<string>;
  savedIds: Set<string>;
};

export interface HomeFeedProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
}

export type HomeStoryGroup = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  stories: HomeStory[];
};

export type HomeStoryView = {
  story_id: string;
  user_id: string;
  viewed_at: string;
  profiles?: HomeFeedProfile | null;
};

export type HomeStoryReply = {
  id: string;
  story_id: string;
  user_id: string;
  body: string;
  reply_type: 'reply' | 'message';
  created_at: string;
  profiles?: HomeFeedProfile | null;
};
