import { ShieldCheck, TrendingUp } from 'lucide-react-native';
import { useActivities } from '@/features/activities/api/useActivities';
import { useMyRegistrations } from '@/features/activities/api/useMyRegistrations';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { HeaderNotificationButton } from '@/components/ui/header-right';
import { HomeComposeButton } from '@/components/home/HomeComposeButton';
import { HomeUserFeedPost } from '@/components/home/HomeUserFeedPost';
import {
  groupStoriesByUser,
  useHomePosts,
  useHomeStories,
  useMyPostEngagement,
} from '@/features/home/api/useHomeFeed';
import type { HomePost } from '@/features/home/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography } from '@/constants/theme';
import { stackMainScrollProps, withScrollRefresh } from '@/constants/scroll-insets';
import { flexFill } from '@/constants/layout';
import { stackTransparentHeader } from '@/constants/stack-header';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useAuthSession } from '@/hooks/use-auth-session';
import { isWebPlatform } from '@/lib/webGuest';
import { GuestWebBanner } from '@/components/views/GuestWebBanner';
import { useContentWidth } from '@/hooks/use-content-width';
import { HOME_ANNOUNCEMENT_SLIDES } from '@/constants/home-announcement-slides';
import type { HomeAnnouncementSlide } from '@/constants/home-announcement-slides';
import { HomeAnnouncementCarousel } from '@/components/home/HomeAnnouncementCarousel';
import { HomeStoriesRow } from '@/components/home/HomeStoriesRow';
import { HomeFeedPost } from '@/components/home/HomeFeedPost';

const ADMIN_EMAILS = ['doralaikon.th@gmail.com'];
const H_PAD = 16;

function formatTimeAgo(iso: string, lang: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'th' ? 'เมื่อสักครู่' : 'Just now';
  if (mins < 60) return lang === 'th' ? `${mins} นาทีที่แล้ว` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'th' ? `${hrs} ชั่วโมงที่แล้ว` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'th' ? `${days} วันที่แล้ว` : `${days}d ago`;
}

export default function MainMenuScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const contentWidth = useContentWidth();
  const bannerWidth = contentWidth - H_PAD * 2;
  const { isGuest } = useAuthSession();

  const {
    data: allActivities,
    isPending: loadingAll,
    isError: activitiesError,
    error: activitiesErr,
    refetch: refetchAll,
  } = useActivities();
  const { data: myRegistrations } = useMyRegistrations();
  const { data: homeStories, refetch: refetchStories } = useHomeStories();
  const { data: homePosts, refetch: refetchPosts } = useHomePosts();
  const postIds = useMemo(() => (homePosts ?? []).map((p) => p.id), [homePosts]);
  const { data: myEngagement, refetch: refetchEngagement } = useMyPostEngagement(postIds);

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserId(null);
        setCurrentUserAvatar(null);
        return;
      }
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, avatar_url')
        .eq('id', user.id)
        .single();
      if (profile) {
        const isEmailAdmin = ADMIN_EMAILS.includes(user.email || '');
        setIsAdmin(profile.role === 'admin' || isEmailAdmin);
        setCurrentUserAvatar(profile.avatar_url ?? null);
      }
    };
    void fetchProfile();
  }, []);

  const storyGroups = useMemo(
    () => groupStoriesByUser(homeStories ?? []),
    [homeStories],
  );

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetchAll(), refetchStories(), refetchPosts(), refetchEngagement()]);
  });

  const formatDate = (iso?: string) => {
    if (!iso) return t('home.no_date') || 'ยังไม่ระบุวันที่';
    return new Date(iso).toLocaleDateString(i18n.language === 'th' ? 'th-TH' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const registeredIds = useMemo(
    () => new Set(myRegistrations?.map((r) => r.event_id) ?? []),
    [myRegistrations],
  );

  const announcementSlides = useMemo((): HomeAnnouncementSlide[] => {
    const fromEvents = (allActivities ?? [])
      .filter((a) => a.cover_url && a.status === 'open')
      .slice(0, 4)
      .map((a) => ({
        id: `evt-${a.id}`,
        imageUrl: a.cover_url!,
        title: a.title,
        subtitle: formatDate(a.start_date),
        link: { type: 'event' as const, id: a.id },
      }));
    const merged = [...HOME_ANNOUNCEMENT_SLIDES, ...fromEvents];
    const seen = new Set<string>();
    return merged.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [allActivities, i18n.language]);

  const feedActivities = useMemo(() => {
    const list = [...(allActivities ?? [])];
    list.sort(
      (a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime(),
    );
    return list;
  }, [allActivities]);

  const feedItems = useMemo(() => {
    type Item =
      | { kind: 'post'; id: string; at: number; post: HomePost }
      | {
          kind: 'event';
          id: string;
          at: number;
          event: NonNullable<typeof allActivities>[number];
        };
    const items: Item[] = [];
    for (const p of homePosts ?? []) {
      items.push({ kind: 'post', id: `post-${p.id}`, at: Date.parse(p.created_at), post: p });
    }
    items.sort((a, b) => b.at - a.at);
    return items;
  }, [homePosts, feedActivities, allActivities]);

  const renderHeader = () => {
    if (loadingAll) return null;
    return (
      <View style={{ width: '100%' }}>
        {isWebPlatform() && isGuest ? (
          <View style={{ paddingHorizontal: H_PAD, paddingTop: 8 }}>
            <GuestWebBanner />
          </View>
        ) : null}

        <View style={{ marginTop: -8 }}>
          <HomeStoriesRow
            storyGroups={storyGroups}
            currentUserId={currentUserId}
            currentUserAvatar={currentUserAvatar}
            theme={theme}
            isGuest={isGuest}
          />
        </View>

        {announcementSlides.length > 0 ? (
          <View style={{ paddingHorizontal: H_PAD, marginBottom: 8 }}>
            <HomeAnnouncementCarousel
              slides={announcementSlides}
              width={bannerWidth}
              theme={theme}
            />
          </View>
        ) : null}

        {activitiesError ? (
          <View style={styles.errorBox}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>โหลดฟีดไม่สำเร็จ</Text>
            <Text style={{ color: theme.mutedForeground, marginTop: 6 }}>
              {(activitiesErr as Error)?.message ?? 'ลองรีเฟรช'}
            </Text>
            <TouchableOpacity
              onPress={() => refetchAll()}
              style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.retryText}>ลองใหม่</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingAll || activitiesError) return null;
    return (
      <View style={{ width: '100%', paddingBottom: 100 }}>
        {feedItems.length === 0 ? (
          <View style={styles.errorBox}>
            <Text style={{ color: theme.mutedForeground, fontWeight: '600' }}>
              ยังไม่มีโพสต์หรือกิจกรรม
            </Text>
          </View>
        ) : null}

        {isAdmin ? (
          <View style={styles.adminSection}>
            <Text style={[styles.adminTitle, { color: theme.text }]}>Admin</Text>
            <View style={styles.bentoGrid}>
              <TouchableOpacity
                style={[
                  styles.bentoCard,
                  { flex: 1.5, backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => router.push('/(admin)/admin-menu')}
              >
                <View style={[styles.bentoIcon, { backgroundColor: theme.primary + '20' }]}>
                  <ShieldCheck size={24} color={theme.primary} />
                </View>
                <Text style={[styles.bentoHead, { color: theme.text }]}>แอดมิน</Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 12, fontWeight: '600' }}>
                  จัดการระบบหลังบ้าน
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.bentoCard,
                  { flex: 1, backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => router.push('/(admin)/dashboard')}
              >
                <View style={[styles.bentoIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <TrendingUp size={24} color="#FFF" />
                </View>
                <Text style={styles.bentoHeadWhite}>Stats</Text>
                <Text style={styles.bentoSubWhite}>ดูสถิติรวม</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderFeedItem = ({ item }: { item: typeof feedItems[number] }) => {
    if (item.kind === 'post') {
      return (
        <HomeUserFeedPost
          post={item.post}
          theme={theme}
          formatTime={(iso) => formatTimeAgo(iso, i18n.language)}
          liked={!!(myEngagement?.likedIds instanceof Set && myEngagement.likedIds.has(item.post.id))}
          saved={!!(myEngagement?.savedIds instanceof Set && myEngagement.savedIds.has(item.post.id))}
        />
      );
    }
    return (
      <HomeFeedPost
        event={item.event}
        theme={theme}
        formatDate={formatDate}
        isRegistered={!!(registeredIds instanceof Set && registeredIds.has(item.event.id))}
      />
    );
  };

  return (
    <View style={[styles.mainContainer, flexFill, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          headerTitle: t('home.title') || 'หน้าหลัก',
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTransparent: true,
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTitleStyle: {
             color: theme.text,
             fontSize: 18,
             fontWeight: '900',
             textShadowColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
             textShadowOffset: { width: 0, height: 1 },
             textShadowRadius: 2,
          } as any,
          headerLeft: () => (
            <View style={{ paddingLeft: 8 }}>
              <HomeComposeButton />
            </View>
          ),
          headerRight: () => (
            <View style={{ paddingRight: 8 }}>
              <HeaderNotificationButton transparent={true} />
            </View>
          ),
        }}
      />

      {loadingAll ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={[styles.contentMaxWidth, flexFill, { maxWidth: contentWidth }]}>
          <FlashList
            {...stackMainScrollProps}
            data={activitiesError ? [] : feedItems}
            renderItem={renderFeedItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <PullToRefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
              />
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  scrollGrow: { flexGrow: 1, paddingBottom: 100 },
  contentMaxWidth: {
    width: '100%',
    alignSelf: 'center',
  },
  loadingBox: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  errorBox: {
    paddingHorizontal: H_PAD,
    paddingVertical: 32,
    alignItems: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  adminSection: {
    paddingHorizontal: H_PAD,
    marginTop: 24,
    marginBottom: 16,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  bentoGrid: {
    flexDirection: 'row',
    height: 160,
    gap: 12,
  },
  bentoCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  bentoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bentoHead: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  bentoHeadWhite: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  bentoSubWhite: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
});
