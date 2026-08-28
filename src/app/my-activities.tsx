import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { flexFill } from '@/constants/layout';
import { withScrollRefresh } from '@/constants/scroll-insets';
import { useRouter, Stack } from 'expo-router';
import { useMyRegistrations, MyRegistration } from '@/features/activities/api/useMyRegistrations';
import { Calendar, Info, MessageCircle, RefreshCcw, Filter } from 'lucide-react-native';
import { AppToolbar } from '@/components/ui/app-toolbar';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { HeaderRight } from '@/components/ui/header-right';
import { useTheme } from '@/hooks/use-theme';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useMemo, useState } from 'react';

type TimeFilter = 'all' | 'upcoming' | 'past';

function isMyEventEnded(
  ev: MyRegistration['events'] | undefined,
  now: Date,
): boolean {
  if (!ev) return false;
  const end = ev.end_date ? new Date(ev.end_date) : null;
  const start =
    ev.start_date ? new Date(ev.start_date) : ev.event_date ? new Date(ev.event_date) : null;
  if (end && !Number.isNaN(+end)) return now > end;
  if (start && !Number.isNaN(+start)) return now > start;
  return false;
}

function registrationStatusThai(status: string): string {
  switch (status.toLowerCase()) {
    case 'registered':
      return 'ลงทะเบียนแล้ว';
    case 'pending':
    case 'waiting':
      return 'รอยืนยัน';
    case 'cancelled':
    case 'canceled':
      return 'ยกเลิกแล้ว';
    case 'rejected':
      return 'ไม่ผ่านการอนุมัติ';
    default:
      return status;
  }
}

function timeFilterOptionLabel(mode: TimeFilter): string {
  switch (mode) {
    case 'all':
      return 'ทั้งหมด';
    case 'upcoming':
      return 'ยังไม่จบ';
    case 'past':
      return 'จบแล้ว';
  }
}

export default function MyActivitiesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data: myEvents, isLoading, refetch } = useMyRegistrations();
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const filteredEvents = useMemo(() => {
    if (!myEvents?.length) return myEvents ?? [];
    const now = new Date();
    if (timeFilter === 'all') return myEvents;
    return myEvents.filter((item) => {
      const ended = isMyEventEnded(item.events, now);
      return timeFilter === 'past' ? ended : !ended;
    });
  }, [myEvents, timeFilter]);

  const formatDateThai = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: MyRegistration }) => {
    const isRegistered = item.status === 'registered';
    const event = item.events as any;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() =>
          router.push({
            pathname: '/event-detail',
            params: { id: item.event_id },
          })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.eventTitle, { color: theme.text }]}>{event?.title || 'กิจกรรม'}</Text>
          <View
            style={[
              styles.statusBadge,
              isRegistered ? styles.statusSuccess : styles.statusPending,
              (item.status === 'cancelled' || item.status === 'canceled') && styles.statusCancelled,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: isRegistered
                    ? theme.success
                    : item.status === 'cancelled' || item.status === 'canceled'
                      ? theme.error
                      : theme.warning,
                },
              ]}
            >
              {registrationStatusThai(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Calendar size={14} color={theme.mutedForeground} />
          <Text style={[styles.infoText, { color: theme.mutedForeground }]}>
            {formatDateThai(event?.start_date || event?.event_date)}
            {event?.end_date ? ` - ${formatDateThai(event?.end_date)}` : ''}
          </Text>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Info size={14} color={theme.text} />
            <Text style={[styles.viewDetail, { color: theme.text }]}>ดูรายละเอียด / กำหนดการ</Text>
          </View>
          {isRegistered && (
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: theme.text }]}
              onPress={(e) => {
                e.stopPropagation();
                router.push({
                  pathname: '/chat-room',
                  params: { id: item.event_id, title: event?.title },
                });
              }}
            >
              <MessageCircle size={16} color={theme.background} />
              <Text style={[styles.chatBtnText, { color: theme.background }]}>แชทกลุ่ม</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const openTimeFilter = () => {
    Alert.alert('ตัวกรองตามช่วงเวลา', 'เลือกช่วงกิจกรรมที่ต้องการแสดง', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: `ทั้งหมด${timeFilter === 'all' ? ' ✓' : ''}`,
        onPress: () => setTimeFilter('all'),
      },
      {
        text: `ยังไม่จบ${timeFilter === 'upcoming' ? ' ✓' : ''}`,
        onPress: () => setTimeFilter('upcoming'),
      },
      {
        text: `จบแล้ว${timeFilter === 'past' ? ' ✓' : ''}`,
        onPress: () => setTimeFilter('past'),
      },
    ]);
  };

  const toolbarItems = [
    { type: 'action' as const, label: 'รีเฟรช', icon: RefreshCcw, onPress: () => refetch() },
    { type: 'spacer' as const },
    {
      type: 'action' as const,
      label: `ตัวกรอง (${timeFilterOptionLabel(timeFilter)})`,
      icon: Filter,
      onPress: openTimeFilter,
    },
  ];

  const emptyList = !filteredEvents?.length ? (
    <View style={styles.emptyBox}>
      <Calendar size={48} color={theme.mutedForeground} />
      {!myEvents?.length ? (
        <>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            คุณยังไม่มีกิจกรรมที่สมัครไว้
          </Text>
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: theme.text }]}
            onPress={() => router.push('/(tabs)/activities')}
          >
            <Text style={[styles.findBtnText, { color: theme.background }]}>
              ไปค้นหากิจกรรมกันเลย!
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            ไม่มีรายการตามตัวกรอง ({timeFilterOptionLabel(timeFilter)})
          </Text>
          <TouchableOpacity
            style={[styles.findBtn, { backgroundColor: theme.text }]}
            onPress={() => setTimeFilter('all')}
          >
            <Text style={[styles.findBtnText, { color: theme.background }]}>ล้างตัวกรอง</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  ) : null;

  const listCards =
    filteredEvents?.map((item) => <View key={item.id}>{renderItem({ item })}</View>) ?? null;

  return (
    <View style={[flexFill, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'กิจกรรมของฉัน',
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.background },
          headerRight: () => <HeaderRight />,
        }}
      />

      <AppStatusBar />

      {isLoading && myEvents === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : Platform.OS === 'web' ? (
        <>
          <ScrollView
            style={flexFill}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { flexGrow: 1, paddingBottom: 80 }]}
            {...withScrollRefresh(
              <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />,
            )}
          >
            {emptyList ?? listCards}
          </ScrollView>
          <AppToolbar items={toolbarItems} />
        </>
      ) : (
        <>
          <FlatList
            style={flexFill}
            data={filteredEvents}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { flexGrow: 1, paddingBottom: 12 }]}
            refreshControl={
              <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
            }
            ListEmptyComponent={emptyList}
          />
          <AppToolbar items={toolbarItems} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventTitle: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusSuccess: { backgroundColor: 'rgba(34,197,94,0.18)' },
  statusPending: { backgroundColor: 'rgba(245,158,11,0.18)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.15)' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  infoText: { fontSize: 14 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 16,
  },
  viewDetail: { fontSize: 14, fontWeight: '500' },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  chatBtnText: { fontSize: 14, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { fontSize: 16, fontWeight: '500' },
  findBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  findBtnText: { fontWeight: 'bold' },
});
