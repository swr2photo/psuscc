import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import type { HomePost } from '@/features/home/types';
import type { AppTheme } from '@/hooks/use-theme';
import {
  useDeleteHomePost,
  useToggleHomePostLike,
  useToggleHomePostSave,
} from '@/features/home/api/useHomeFeed';
import { saveHomePostImageToDevice, shareHomePostExternally } from '@/features/home/homePostActions';
import { HomePostCommentsSheet } from '@/components/home/HomePostCommentsSheet';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import { supabase } from '@/lib/supabase';
import { getReadableStorageUrl, STORAGE_BUCKET_HOME_FEED } from '@/lib/supabase-storage';

type Props = {
  post: HomePost;
  theme: AppTheme;
  formatTime: (iso: string) => string;
  liked: boolean;
  saved: boolean;
};

function displayHandle(profile: HomePost['profiles'], userId: string): string {
  const name = profile?.full_name?.trim();
  if (name) return name.replace(/\s+/g, '_').toLowerCase().slice(0, 24);
  return `user_${userId.slice(0, 6)}`;
}

export const HomeUserFeedPost = memo(
  function HomeUserFeedPost({ post, theme, formatTime, liked, saved }: Props) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const del = useDeleteHomePost();
  const toggleLike = useToggleHomePostLike();
  const toggleSave = useToggleHomePostSave();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const profile = post.profiles;
  const handle = displayHandle(profile, post.user_id);
  const avatarUri = profile?.avatar_url;
  const likeCount = Math.max(0, post.like_count ?? 0);
  const commentCount = Math.max(0, post.comment_count ?? 0);
  const allowLikes = post.allow_likes !== false;
  const allowComments = post.allow_comments !== false;

  const imageUrls = useMemo(() => {
    return post.image_url.includes(',') ? post.image_url.split(',') : [post.image_url];
  }, [post.image_url]);

  const [resolvedUrls, setResolvedUrls] = useState<string[]>(imageUrls);

  useEffect(() => {
    let active = true;
    const resolve = async () => {
      try {
        const resolved = await Promise.all(
          imageUrls.map((url) => getReadableStorageUrl(STORAGE_BUCKET_HOME_FEED, url))
        );
        if (active) {
          setResolvedUrls(resolved.map((r, i) => r || imageUrls[i]));
        }
      } catch (err) {
        console.error('Failed to resolve image URLs:', err);
      }
    };
    resolve();
    return () => {
      active = false;
    };
  }, [imageUrls]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const requireAuth = async () =>
    ensureAuthedOrGoAuth(router, { message: 'เข้าสู่ระบบเพื่อโต้ตอบกับโพสต์' });

  const onLike = async () => {
    if (!allowLikes) {
      Alert.alert('โพสต์นี้', 'เจ้าของโพสต์ปิดการถูกใจ');
      return;
    }
    if (!(await requireAuth())) return;
    try {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleLike.mutateAsync({ postId: post.id, liked });
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e instanceof Error ? e.message : '');
    }
  };

  const onSave = async () => {
    if (!(await requireAuth())) return;
    try {
      const nowSaved = await toggleSave.mutateAsync({ postId: post.id, saved });
      Toast.show({
        type: 'success',
        text1: nowSaved ? 'บันทึกโพสต์แล้ว' : 'เลิกบันทึกโพสต์',
      });
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e instanceof Error ? e.message : '');
    }
  };

  const onShare = async () => {
    await shareHomePostExternally(post, handle);
  };

  const onSaveImage = async () => {
    setSavingImage(true);
    try {
      await saveHomePostImageToDevice(resolvedUrls[activeImageIndex] || imageUrls[activeImageIndex] || post.image_url);
      Toast.show({ type: 'success', text1: 'บันทึกรูปแล้ว' });
    } catch (e) {
      Alert.alert('บันทึกรูปไม่สำเร็จ', e instanceof Error ? e.message : '');
    } finally {
      setSavingImage(false);
    }
  };

  const openShareMenu = () => {
    if (Platform.OS === 'ios') {
      const { ActionSheetIOS } = require('react-native');
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['ยกเลิก', 'แชร์ไปแอปอื่น', 'บันทึกรูปลงเครื่อง'],
          cancelButtonIndex: 0,
        },
        (index: number) => {
          if (index === 1) void onShare();
          if (index === 2) void onSaveImage();
        },
      );
      return;
    }
    Alert.alert('แชร์โพสต์', undefined, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'แชร์ไปแอปอื่น', onPress: () => void onShare() },
      { text: 'บันทึกรูปลงเครื่อง', onPress: () => void onSaveImage() },
    ]);
  };

  const onComment = async () => {
    if (!allowComments) {
      Alert.alert('โพสต์นี้', 'เจ้าของโพสต์ปิดความคิดเห็น');
      return;
    }
    if (!(await requireAuth())) return;
    setCommentsOpen(true);
  };

  const onMore = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isOwner = user?.id === post.user_id;

    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'แชร์ไปแอปอื่น', onPress: () => void onShare() },
      { text: 'บันทึกรูปลงเครื่อง', onPress: () => void onSaveImage() },
    ];
    if (isOwner) {
      buttons.push({
        text: 'ลบโพสต์',
        style: 'destructive',
        onPress: () => {
          Alert.alert('ลบโพสต์', 'ต้องการลบโพสต์นี้หรือไม่?', [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'ลบ',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  try {
                    await del.mutateAsync(post.id);
                  } catch (e) {
                    Alert.alert('ลบไม่สำเร็จ', e instanceof Error ? e.message : '');
                  }
                })();
              },
            },
          ]);
        },
      });
    }
    buttons.unshift({ text: 'ยกเลิก', style: 'cancel' });
    Alert.alert('ตัวเลือกโพสต์', undefined, buttons);
  };

  return (
    <View style={[styles.card, { borderBottomColor: theme.border }]}>
      <View style={styles.header}>
        {avatarUri ?
          <Image source={avatarUri} style={styles.avatar} contentFit="cover" transition={200} />
        : <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{(profile?.full_name?.[0] ?? 'U').toUpperCase()}</Text>
          </View>
        }
        <View style={{ flex: 1 }}>
          <Text style={[styles.username, { color: theme.text }]} numberOfLines={1}>
            {handle}
          </Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>โพสต์ชุมชน</Text>
        </View>
        <TouchableOpacity hitSlop={12} onPress={() => void onMore()}>
          <MoreHorizontal size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {resolvedUrls.length > 1 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const x = e.nativeEvent.contentOffset.x;
              const w = e.nativeEvent.layoutMeasurement.width;
              if (w > 0) setActiveImageIndex(Math.round(x / w));
            }}
            scrollEventThrottle={16}
          >
            {resolvedUrls.map((url, i) => (
              <Image
                key={i}
                source={url}
                style={[styles.media, { width: windowWidth, backgroundColor: theme.secondary }]}
                contentFit="cover"
                transition={200}
              />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {resolvedUrls.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === activeImageIndex ? theme.primary : theme.mutedForeground + '40' },
                ]}
              />
            ))}
          </View>
        </View>
      ) : (
        <Image source={resolvedUrls[0] || post.image_url} style={[styles.media, { backgroundColor: theme.secondary }]} contentFit="cover" transition={200} />
      )}

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          {allowLikes ?
            <TouchableOpacity
              onPress={() => void onLike()}
              hitSlop={8}
              disabled={toggleLike.isPending}
              style={styles.actionTap}
            >
              <Heart
                size={26}
                color={liked ? '#E1306C' : theme.text}
                fill={liked ? '#E1306C' : 'transparent'}
                strokeWidth={1.75}
              />
            </TouchableOpacity>
          : null}
          {allowComments ?
            <TouchableOpacity onPress={() => void onComment()} hitSlop={8} style={[styles.actionTap, styles.gap]}>
              <MessageCircle size={26} color={theme.text} strokeWidth={1.75} />
            </TouchableOpacity>
          : null}
          <TouchableOpacity
            onPress={() => void openShareMenu()}
            hitSlop={8}
            style={[styles.actionTap, styles.gap]}
            disabled={savingImage}
          >
            {savingImage ?
              <ActivityIndicator size="small" color={theme.text} />
            : <Send size={24} color={theme.text} strokeWidth={1.75} />}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => void onSave()} hitSlop={8} disabled={toggleSave.isPending}>
          <Bookmark
            size={24}
            color={saved ? theme.text : theme.text}
            fill={saved ? theme.text : 'transparent'}
            strokeWidth={1.75}
          />
        </TouchableOpacity>
      </View>

      {allowLikes && likeCount > 0 ?
        <Text style={[styles.counts, { color: theme.text }]}>
          {likeCount.toLocaleString()} ถูกใจ
        </Text>
      : null}

      <View style={styles.caption}>
        {post.location_label?.trim() ?
          <Text style={[styles.location, { color: theme.mutedForeground }]}>
            📍 {post.location_label.trim()}
          </Text>
        : null}
        {post.caption?.trim() ?
          <Text style={[styles.captionBody, { color: theme.text }]}>
            <Text style={styles.bold}>{handle} </Text>
            {post.caption.trim()}
          </Text>
        : null}
        {allowComments && commentCount > 0 ?
          <TouchableOpacity onPress={() => void onComment()}>
            <Text style={[styles.viewComments, { color: theme.mutedForeground }]}>
              ดูความคิดเห็นทั้ง {commentCount} รายการ
            </Text>
          </TouchableOpacity>
        : null}
        <Text style={[styles.time, { color: theme.mutedForeground }]}>{formatTime(post.created_at)}</Text>
      </View>

      <HomePostCommentsSheet
        visible={commentsOpen}
        post={post}
        theme={theme}
        onClose={() => setCommentsOpen(false)}
        formatTime={formatTime}
      />
    </View>
  );
},
(prevProps, nextProps) => {
  return (
    prevProps.liked === nextProps.liked &&
    prevProps.saved === nextProps.saved &&
    prevProps.theme === nextProps.theme &&
    prevProps.post.like_count === nextProps.post.like_count &&
    prevProps.post.comment_count === nextProps.post.comment_count &&
    prevProps.post.image_url === nextProps.post.image_url &&
    prevProps.post.caption === nextProps.post.caption &&
    prevProps.post.location_label === nextProps.post.location_label &&
    prevProps.post.created_at === nextProps.post.created_at &&
    prevProps.post.profiles?.avatar_url === nextProps.post.profiles?.avatar_url &&
    prevProps.post.profiles?.full_name === nextProps.post.profiles?.full_name
  );
});

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  username: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
  media: {
    width: '100%',
    aspectRatio: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    marginBottom: 10,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionsLeft: { flexDirection: 'row', alignItems: 'center' },
  actionTap: { padding: 2 },
  gap: { marginLeft: 12 },
  counts: {
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  caption: { paddingHorizontal: 14, paddingBottom: 16 },
  location: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  captionBody: { fontSize: 14, lineHeight: 19 },
  bold: { fontWeight: '700' },
  viewComments: {
    fontSize: 14,
    marginTop: 6,
  },
  time: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
});
