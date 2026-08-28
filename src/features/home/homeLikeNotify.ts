import { notifyUser } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

function likerDisplayName(profile: { full_name?: string | null; email?: string | null } | null): string {
  return profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'สมาชิก';
}

async function ownerWantsNotifications(ownerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('notifications_enabled')
    .eq('id', ownerId)
    .maybeSingle();
  return data?.notifications_enabled !== false;
}

/** แจ้งเจ้าของโพสต์เมื่อมีคนกดถูกใจ (ไม่แจ้งตัวเอง) */
export async function notifyHomePostLike(postId: string, likerId: string): Promise<void> {
  try {
    const { data: post } = await supabase
      .from('home_posts')
      .select('user_id, allow_likes')
      .eq('id', postId)
      .maybeSingle();
    if (!post || post.user_id === likerId || post.allow_likes === false) return;
    if (!(await ownerWantsNotifications(post.user_id))) return;

    const { data: liker } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', likerId)
      .maybeSingle();

    const name = likerDisplayName(liker);
    await notifyUser(post.user_id, 'ถูกใจโพสต์ของคุณ', `${name} กดถูกใจโพสต์ของคุณ`, {
      type: 'home_post_like',
      post_id: postId,
      liker_id: likerId,
    });
  } catch (e) {
    console.warn('[home] notifyHomePostLike', e);
  }
}

/** แจ้งเจ้าของสตอรีเมื่อมีคนกดถูกใจ */
export async function notifyHomeStoryLike(storyId: string, likerId: string): Promise<void> {
  try {
    const { data: story } = await supabase
      .from('home_stories')
      .select('user_id')
      .eq('id', storyId)
      .maybeSingle();
    if (!story || story.user_id === likerId) return;
    if (!(await ownerWantsNotifications(story.user_id))) return;

    const { data: liker } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', likerId)
      .maybeSingle();

    const name = likerDisplayName(liker);
    await notifyUser(story.user_id, 'ถูกใจสตอรีของคุณ', `${name} กดถูกใจสตอรีของคุณ`, {
      type: 'home_story_like',
      story_id: storyId,
      story_owner_id: story.user_id,
      liker_id: likerId,
    });
  } catch (e) {
    console.warn('[home] notifyHomeStoryLike', e);
  }
}
