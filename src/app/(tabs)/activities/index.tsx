import { AppStatusBar } from '@/components/ui/app-status-bar';
import { Event, useActivities } from '@/features/activities/api/useActivities';
import { useMyRegistrations } from '@/features/activities/api/useMyRegistrations';
import { getPublicEventStatus, publicStatusToneColor } from '@/features/activities/event-status';
import { useRouter, Stack, Link } from 'expo-router';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Code,
  FlaskConical,
  Gamepad2,
  Palette,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { HeaderNotificationButton } from '@/components/ui/header-right';
import {
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Share,
} from 'react-native';
import { HeaderRightPillsSeparated } from '@/components/ui/header-right';
import { SkeletonActivityList } from '@/components/ui/skeleton-presets';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography } from '@/constants/theme';
import { nestedHorizontalScrollProps, stackMainScrollProps, withScrollRefresh } from '@/constants/scroll-insets';
import { flexFill } from '@/constants/layout';
import { stackTransparentHeader } from '@/constants/stack-header';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';

const CATEGORIES = [
  { id: 'All', name: 'ทั้งหมด', icon: Sparkles, color: '#6366f1' },
  { id: 'Academic', name: 'วิชาการ', icon: Code, color: '#3b82f6' },
  { id: 'Art', name: 'ศิลปะ', icon: Palette, color: '#ec4899' },
  { id: 'Science', name: 'วิทยาศาสตร์', icon: FlaskConical, color: '#10b981' },
  { id: 'Sports', name: 'กีฬา', icon: Trophy, color: '#f59e0b' },
  { id: 'Game', name: 'เกม', icon: Gamepad2, color: '#8b5cf6' },
];

const ACTIVITY_GRID_GAP = 16;

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ActivitiesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isTablet = windowWidth >= 768;
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const gridCols = isTablet ? 3 : 1;
  const activityCardWidth = useMemo(() => {
    if (!isTablet) return undefined;
    const hPad = 64;
    const cols = 3;
    const gaps = ACTIVITY_GRID_GAP * (cols - 1);
    return (windowWidth - hPad - gaps) / cols;
  }, [windowWidth, isTablet]);

  const { data: activities, isPending, isError, error, refetch } = useActivities();
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());
  const { data: myRegistrations } = useMyRegistrations();

  const [now, setNow] = useState(new Date());

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isAlreadyRegistered = (eventId: string) =>
    myRegistrations?.some((reg) => reg.event_id === eventId);

  const formatDateThai = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredByCategory =
    activities?.filter((a) => selectedCategory === 'All' || a.category === selectedCategory) || [];

  const searchTrim = searchQuery.trim().toLowerCase();
  const filteredBySearch =
    searchTrim === ''
      ? filteredByCategory
      : filteredByCategory.filter((a) => a.title.toLowerCase().includes(searchTrim));

  const listData = useMemo(() => {
    return [...filteredBySearch].sort((a, b) => {
      const sa = getPublicEventStatus(now, a);
      const sb = getPublicEventStatus(now, b);
      if (sa.active !== sb.active) return sa.active ? -1 : 1;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
  }, [filteredBySearch, now]);

  const hasAnyActivities = (activities?.length ?? 0) > 0;

  const handleSharePress = async (eventTitle: string, eventId: string) => {
    try {
      await Share.share({
        message: `เข้าร่วมกิจกรรมกับเรา: ${eventTitle} ดูรายละเอียดได้ที่แอปพลิเคชันของเรา!`,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const renderActivityItem = ({ item, index }: { item: Event; index: number }) => {
    const isRegistered = isAlreadyRegistered(item.id);
    const status = getPublicEventStatus(now, item);

    const cardContent = (
      <Animated.View
        entering={FadeInDown.duration(400).delay(Math.min(index * 50, 400))}
        style={[
          styles.activityCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
          isTablet && activityCardWidth != null && { width: activityCardWidth, marginHorizontal: 0 },
          !isTablet && styles.activityCardFullWidth,
          !status.active && !isRegistered && styles.activityCardDisabled,
        ]}
      >
        <View style={styles.activityCardHeader}>
          {item.cover_url ? (
            Platform.OS === 'ios' ? (
              <Link.AppleZoom>
                <Image source={{ uri: item.cover_url }} style={styles.activityCardCover} />
              </Link.AppleZoom>
            ) : (
              <Image source={{ uri: item.cover_url }} style={styles.activityCardCover} />
            )
          ) : (
            <View
              style={[
                styles.activityCardCover,
                {
                  backgroundColor: theme.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <Sparkles size={48} color={theme.muted} />
            </View>
          )}
          <View
            style={[
              styles.activityBadge,
              {
                backgroundColor: isRegistered
                  ? theme.primary
                  : publicStatusToneColor(theme, status.tone),
              },
            ]}
          >
            <Text style={styles.activityBadgeText}>
              {isRegistered ? 'ลงทะเบียนแล้ว' : status.label}
            </Text>
          </View>
          {item.price > 0 && (
            <View style={[styles.activityPriceTag, { backgroundColor: theme.surface + 'F0' }]}>
              <Text style={[styles.activityPriceText, { color: theme.text }]}>{item.price}฿</Text>
            </View>
          )}
        </View>

        <View style={styles.activityCardBody}>
          <Text style={[styles.activityTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.activityMetaRow}>
            <View style={[styles.activityMetaItem, { backgroundColor: theme.secondary }]}>
              <View style={[styles.metaIconWrapper, { backgroundColor: theme.surface }]}>
                <CalendarDays size={14} color={theme.primary} />
              </View>
              <Text style={[styles.activityMetaText, { color: theme.mutedForeground }]}>
                {formatDateThai(item.start_date)}
              </Text>
            </View>
            <View style={[styles.activityMetaItem, { backgroundColor: theme.secondary }]}>
              <View style={[styles.metaIconWrapper, { backgroundColor: theme.surface }]}>
                <Users size={14} color={theme.primary} />
              </View>
              <Text style={[styles.activityMetaText, { color: theme.mutedForeground }]}>
                รับ {item.capacity} คน
                {typeof item.current_participants === 'number' && item.capacity > 0
                  ? ` · เหลือ ${Math.max(0, item.capacity - item.current_participants)} ที่`
                  : ''}
              </Text>
            </View>
          </View>

          {isRegistered && (
            <View style={[styles.registeredStatusRow, { borderTopColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: theme.success + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={14} color={theme.success} />
                </View>
                <Text style={[styles.registeredStatusText, { color: theme.success }]}>
                  สมัครเข้าร่วมแล้ว
                </Text>
              </View>
              <View style={styles.detailLink}>
                <Text style={[styles.detailLinkText, { color: theme.primary }]}>ดูรายละเอียด</Text>
                <ChevronRight size={14} color={theme.primary} />
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    );

    if (Platform.OS === 'ios') {
      return (
        <Link href={{ pathname: '/event-detail', params: { id: item.id } }} asChild>
          <Link.Trigger>
            <TouchableOpacity activeOpacity={0.9}>
              {cardContent}
            </TouchableOpacity>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction
              title="ดูรายละเอียด"
              icon="info.circle"
              onPress={() => router.push({ pathname: '/event-detail', params: { id: item.id } })}
            />
            {!isRegistered && status.active && (
              <Link.MenuAction
                title="สมัครเข้าร่วมกิจกรรม"
                icon="plus.circle"
                onPress={() => router.push({ pathname: '/event-detail', params: { id: item.id } })}
              />
            )}
            {isRegistered && (
              <Link.MenuAction
                title="ไปที่แชทกลุ่ม"
                icon="message"
                onPress={() => router.push({ pathname: '/chat-room', params: { id: item.id, title: item.title } })}
              />
            )}
            <Link.MenuAction
              title="แชร์กิจกรรม"
              icon="square.and.arrow.up"
              onPress={() => handleSharePress(item.title, item.id)}
            />
          </Link.Menu>
        </Link>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/event-detail', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        {cardContent}
      </TouchableOpacity>
    );
  };

  const stackScreenOptions = {
    title: 'กิจกรรม',
    headerTransparent: true,
    headerShadowVisible: false,
    headerTitleAlign: 'center' as const,
    headerStyle: {
      backgroundColor: 'transparent',
    },
    headerRight: () => (
      <View style={{ paddingRight: 8 }}>
        <HeaderNotificationButton transparent={true} />
      </View>
    ),
    headerTitleStyle: {
       color: theme.text,
       fontSize: 18,
       fontWeight: '900' as const,
       textShadowColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
       textShadowOffset: { width: 0, height: 1 },
       textShadowRadius: 2,
    },
  };

  const listHeader = (
    <View style={{ backgroundColor: theme.background }}>
      <View style={[styles.categoryTabsContainer, { backgroundColor: theme.background }]}>
        <ScrollView
          {...nestedHorizontalScrollProps}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsScroll}
        >
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.8}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.secondary,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
              >
                <CatIcon size={14} color={isSelected ? '#FFF' : theme.mutedForeground} />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isSelected ? '#FFF' : theme.text },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={[styles.searchRow, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <Search size={20} color={theme.mutedForeground} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="ค้นหาชื่อกิจกรรม..."
          placeholderTextColor={theme.mutedForeground}
          style={[styles.searchInput, { color: theme.text }]}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <X size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const listEmptyOnly =
    isPending ? (
      <SkeletonActivityList count={isTablet ? 6 : 3} />
    ) : isError ? (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitleText, { color: theme.text }]}>โหลดข้อมูลไม่สำเร็จ</Text>
        <Text style={[styles.emptySubText, { color: theme.mutedForeground }]}>
          {(error as Error)?.message ?? 'ตรวจการเชื่อมต่อหรือรีเฟรช'}
        </Text>
        <TouchableOpacity
          style={[styles.clearFilterBtn, { borderColor: theme.primary, marginTop: 16 }]}
          onPress={() => refetch()}
        >
          <Text style={[styles.clearFilterBtnText, { color: theme.primary }]}>ลองใหม่</Text>
        </TouchableOpacity>
      </View>
    ) : !hasAnyActivities ? (
      <View style={styles.emptyContainer}>
        <View
          style={[styles.emptyIconCircle, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <Search size={48} color={theme.muted} />
        </View>
        <Text style={[styles.emptyTitleText, { color: theme.text }]}>ไม่พบค่ายในขณะนี้</Text>
        <Text style={[styles.emptySubText, { color: theme.mutedForeground }]}>
          กลับมาตรวจสอบใหม่ภายหลังนะครับ
        </Text>
      </View>
    ) : listData.length === 0 ? (
      <View style={styles.emptyContainer}>
        <View
          style={[styles.emptyIconCircle, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <Search size={48} color={theme.muted} />
        </View>
        <Text style={[styles.emptyTitleText, { color: theme.text }]}>ไม่พบกิจกรรมในตัวกรองนี้</Text>
        <Text style={[styles.emptySubText, { color: theme.mutedForeground }]}>
          ลองเปลี่ยนหมวด หรือล้างคำค้นหา
        </Text>
        <TouchableOpacity
          style={[styles.clearFilterBtn, { borderColor: theme.primary }]}
          onPress={() => {
            setSelectedCategory('All');
            setSearchQuery('');
          }}
        >
          <Text style={[styles.clearFilterBtnText, { color: theme.primary }]}>ล้างตัวกรอง</Text>
        </TouchableOpacity>
      </View>
    ) : null;

  const listBody =
    listEmptyOnly ??
    listData.map((item, index) => (
      <View key={item.id} style={styles.activityCardWrap}>
        {renderActivityItem({ item, index })}
      </View>
    ));

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.mainContainer, flexFill, { backgroundColor: theme.background }]}>
        <Stack.Screen options={stackScreenOptions} />
        <ScrollView
          style={flexFill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.activitiesList,
            styles.activitiesListWeb,
            {
              paddingHorizontal: isTablet ? 32 : 24,
              paddingTop: 16,
              paddingBottom: 100,
            },
          ]}
        >
          {listHeader}
          {listBody}
        </ScrollView>
      </View>
    );
  }


  return (
    <View style={[styles.mainContainer, flexFill, { backgroundColor: theme.background }]}>
      <Stack.Screen options={stackScreenOptions} />

      <AppStatusBar backgroundColor="transparent" style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View style={[styles.contentLayer, flexFill]}>
        <FlatList
          {...stackMainScrollProps}
          style={flexFill}
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderActivityItem}
          numColumns={gridCols}
          key={isTablet ? `tablet-${gridCols}` : 'mobile'}
          contentContainerStyle={[
            styles.activitiesList,
            {
              paddingHorizontal: isTablet ? 32 : 24,
              paddingTop: insets.top + 60,
              paddingBottom: isTablet ? 32 : 120,
            },
          ]}
          {...withScrollRefresh(
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />,
          )}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={isTablet ? { justifyContent: 'space-between', gap: ACTIVITY_GRID_GAP } : undefined}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmptyOnly}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  contentMaxWidth: {
    width: '100%',
  },
  categoryTabsContainer: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  categoryTabsScroll: {
    paddingHorizontal: 24,
    gap: 24,
  },
  categoryTab: {
    paddingVertical: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabText: {
    fontSize: 15,
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 3,
    borderRadius: 3,
  },
  contentLayer: { flex: 1 },
  activitiesList: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  activitiesListWeb: {
    maxWidth: '100%',
    overflow: 'hidden',
  },
  activityCardWrap: {
    width: '100%',
    maxWidth: '100%',
  },
  activityCardFullWidth: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
  },
  activityCard: {
    borderRadius: 36,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
  },
  activityCardDisabled: { opacity: 0.9 },
  activityCardHeader: { height: 190, width: '100%', position: 'relative' },
  activityCardCover: { width: '100%', height: '100%', resizeMode: 'cover' },
  activityBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  activityBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityPriceTag: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  activityPriceText: { fontSize: 14, fontWeight: '900' },
  activityCardBody: { padding: 24 },
  activityTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  activityMetaRow: { flexDirection: 'row', gap: 16 },
  activityMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  metaIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMetaText: { fontSize: 14, fontWeight: '700' },
  registeredStatusRow: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  registeredStatusText: { fontSize: 14, fontWeight: '800' },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLinkText: { fontSize: 14, fontWeight: '800' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  emptyTitleText: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  emptySubText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 0 },
  clearFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
  clearFilterBtnText: { fontSize: 15, fontWeight: '800' },
});
