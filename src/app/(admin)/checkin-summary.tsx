import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ChevronRight,
  Layers,
} from 'lucide-react-native';
import * as XLSX from 'xlsx';
import Toast from 'react-native-toast-message';

import { HeaderRight } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { useTheme } from '@/hooks/use-theme';
import {
  useCheckinSummary,
  useSessionCheckins,
  useCheckinSummaryByEvent,
} from '@/features/checkin/api/useCheckinSummary';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';

export default function CheckinSummaryScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const { data: summary, isLoading, refetch } = useCheckinSummary();
  const {
    data: byEvent,
    refetch: refetchByEvent,
    isLoading: isLoadingByEvent,
  } = useCheckinSummaryByEvent();
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.all([refetch(), refetchByEvent()]);
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    params.sessionId ?? null,
  );

  useEffect(() => {
    if (params.sessionId) setSelectedSessionId(params.sessionId);
  }, [params.sessionId]);

  const groupedByDate = useMemo(() => {
    const groups: Record<
      string,
      { date: string; sessions: NonNullable<typeof summary>; total: number }
    > = {};
    (summary ?? []).forEach((s) => {
      const key = s.session_date;
      if (!groups[key]) {
        groups[key] = { date: key, sessions: [] as any, total: 0 };
      }
      groups[key].sessions.push(s);
      groups[key].total += Number(s.success_count) || 0;
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [summary]);

  const grandTotal = useMemo(
    () =>
      (summary ?? []).reduce((acc, s) => acc + (Number(s.success_count) || 0), 0),
    [summary],
  );

  const todayTotal = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (summary ?? [])
      .filter((s) => s.session_date === today)
      .reduce((acc, s) => acc + (Number(s.success_count) || 0), 0);
  }, [summary]);

  const formatDateThai = (iso: string) => {
    return new Date(iso).toLocaleDateString('th-TH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'สรุปการเช็กอิน',
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

      {isLoading && !summary && isLoadingByEvent && !byEvent ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
        >
          <View style={styles.heroBox}>
            <View
              style={[
                styles.heroBlob,
                { backgroundColor: isDark ? '#2A2A2A' : '#DCFCE7' },
              ]}
            />
            <Text style={[styles.heroLabel, { color: theme.mutedForeground }]}>
              SUMMARY · DAILY
            </Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>ยอดเช็กอินวันนี้</Text>
            <Text style={[styles.heroBigNumber, { color: theme.text }]}>{todayTotal}</Text>
            <Text style={[styles.heroSub, { color: theme.mutedForeground }]}>
              ทั้งหมดสะสม {grandTotal} ครั้ง
            </Text>
          </View>

          <View style={styles.eventSection}>
            <View style={styles.eventSectionHeader}>
              <Layers size={18} color={theme.primary} />
              <Text style={[styles.eventSectionTitle, { color: theme.text }]}>
                สรุปตามกิจกรรม
              </Text>
            </View>
            <Text style={[styles.eventSectionHint, { color: theme.mutedForeground }]}>
              คน = จำนวนคนไม่ซ้ำที่เช็กอินสำเร็จ · ครั้ง = รวมทุกรอบ/ทุกวัน
            </Text>

            {isLoadingByEvent && !byEvent ? (
              <ActivityIndicator
                style={{ marginVertical: 20 }}
                color={theme.text}
              />
            ) : (byEvent?.length ?? 0) === 0 ? (
              <View
                style={[
                  styles.eventEmptyBox,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.eventEmptyText, { color: theme.mutedForeground }]}>
                  ยังไม่มีข้อมูลแยกตามกิจกรรม — สร้าง QR เช็กอินแล้วเลือกผูกกับกิจกรรม
                </Text>
              </View>
            ) : (
              (byEvent ?? []).map((ev) => (
                <TouchableOpacity
                  key={ev.event_id}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/(admin)/event-participants',
                      params: {
                        eventId: ev.event_id,
                        eventTitle: ev.event_title,
                      },
                    })
                  }
                  style={[
                    styles.eventCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.eventCardTitle, { color: theme.text }]}
                      numberOfLines={2}
                    >
                      {ev.event_title}
                    </Text>
                    <View style={styles.eventStatRow}>
                      <View style={styles.eventStatCell}>
                        <Text style={[styles.eventStatValue, { color: theme.text }]}>
                          {ev.unique_attendees}
                        </Text>
                        <Text style={[styles.eventStatLabel, { color: theme.mutedForeground }]}>
                          คน
                        </Text>
                      </View>
                      <View style={styles.eventStatCell}>
                        <Text style={[styles.eventStatValue, { color: theme.text }]}>
                          {ev.success_checkins}
                        </Text>
                        <Text style={[styles.eventStatLabel, { color: theme.mutedForeground }]}>
                          ครั้งสำเร็จ
                        </Text>
                      </View>
                      <View style={styles.eventStatCell}>
                        <Text style={[styles.eventStatValue, { color: theme.text }]}>
                          {ev.session_count}
                        </Text>
                        <Text style={[styles.eventStatLabel, { color: theme.mutedForeground }]}>
                          รอบ QR
                        </Text>
                      </View>
                      <View style={styles.eventStatCell}>
                        <Text
                          style={[
                            styles.eventStatValue,
                            { color: ev.out_of_range_count > 0 ? '#F59E0B' : theme.mutedForeground },
                          ]}
                        >
                          {ev.out_of_range_count}
                        </Text>
                        <Text style={[styles.eventStatLabel, { color: theme.mutedForeground }]}>
                          นอกพื้นที่
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={20} color={theme.mutedForeground} />
                </TouchableOpacity>
              ))
            )}
          </View>

          {groupedByDate.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <Users size={28} color={theme.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {(byEvent?.length ?? 0) > 0
                  ? 'ยังไม่มีรายละเอียดแยกรายวัน'
                  : 'ยังไม่มีการเช็กอิน'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                {(byEvent?.length ?? 0) > 0
                  ? 'ข้อมูลด้านบนสรุปตามกิจกรรมจากฐานข้อมูลแล้ว — ส่วนรายวันจะแสดงเมื่อมีรอบเช็กอินที่บันทึกได้'
                  : 'เมื่อมีผู้เช็กอินผ่าน QR ระบบจะแสดงรายงานที่นี่อัตโนมัติ'}
              </Text>
            </View>
          ) : (
            groupedByDate.map((group) => (
              <View key={group.date} style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayTitle, { color: theme.text }]}>
                    {formatDateThai(group.date)}
                  </Text>
                  <View
                    style={[styles.dayBadge, { backgroundColor: theme.primary + '15' }]}
                  >
                    <Text style={[styles.dayBadgeText, { color: theme.primary }]}>
                      {group.total} เช็กอิน
                    </Text>
                  </View>
                </View>

                {group.sessions.map((s) => {
                  const start = new Date(s.start_time);
                  const end = new Date(s.end_time);
                  const now = new Date();
                  const isLive = s.is_active && now >= start && now <= end;
                  return (
                    <TouchableOpacity
                      key={s.session_id}
                      activeOpacity={0.85}
                      onPress={() =>
                        setSelectedSessionId((prev) =>
                          prev === s.session_id ? null : s.session_id,
                        )
                      }
                      style={[
                        styles.sessionCard,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.titleRow}>
                            {isLive && (
                              <View style={styles.liveDot}>
                                <View style={styles.liveDotInner} />
                              </View>
                            )}
                            <Text
                              style={[styles.sessionTitle, { color: theme.text }]}
                              numberOfLines={1}
                            >
                              {s.title}
                            </Text>
                          </View>
                          {s.event_title ? (
                            <Text
                              style={[styles.eventName, { color: theme.mutedForeground }]}
                              numberOfLines={1}
                            >
                              {s.event_title}
                            </Text>
                          ) : null}
                          <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                              <Clock size={11} color={theme.mutedForeground} />
                              <Text
                                style={[styles.metaText, { color: theme.mutedForeground }]}
                              >
                                {formatTime(s.start_time)} - {formatTime(s.end_time)}
                              </Text>
                            </View>
                            {s.location_name ? (
                              <View style={styles.metaItem}>
                                <CalendarIcon size={11} color={theme.mutedForeground} />
                                <Text
                                  style={[
                                    styles.metaText,
                                    { color: theme.mutedForeground },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {s.location_name}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.bigCount}>
                          <Text style={[styles.bigCountValue, { color: theme.text }]}>
                            {s.success_count}
                          </Text>
                          <Text
                            style={[styles.bigCountLabel, { color: theme.mutedForeground }]}
                          >
                            success
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.miniStatsRow, { borderTopColor: theme.border }]}>
                        <MiniStat
                          icon={<CheckCircle2 size={12} color="#10B981" />}
                          value={s.success_count}
                          label="สำเร็จ"
                          theme={theme}
                        />
                        <MiniStat
                          icon={<AlertTriangle size={12} color="#F59E0B" />}
                          value={s.out_of_range_count}
                          label="นอกพื้นที่"
                          theme={theme}
                        />
                        <MiniStat
                          icon={<XCircle size={12} color="#EF4444" />}
                          value={s.duplicate_count}
                          label="ซ้ำ"
                          theme={theme}
                        />
                        <View style={{ flex: 0.5 }} />
                        <ChevronRight size={16} color={theme.mutedForeground} />
                      </View>

                      {selectedSessionId === s.session_id && (
                        <SessionDetailPanel
                          sessionId={s.session_id}
                          sessionTitle={s.title}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

function SessionDetailPanel({
  sessionId,
  sessionTitle,
}: {
  sessionId: string;
  sessionTitle: string;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, isLoading } = useSessionCheckins(sessionId, { status: 'success' });

  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      Toast.show({ type: 'error', text1: 'ไม่มีข้อมูลให้ส่งออก' });
      return;
    }
    if (Platform.OS !== 'web') {
      Toast.show({
        type: 'info',
        text1: 'ฟังก์ชันส่งออก Excel รองรับเฉพาะเว็บ',
        text2: 'เปิดเว็บแล้วลองใหม่อีกครั้ง',
      });
      return;
    }
    try {
      const rows = data.map((c, idx) => ({
        ลำดับ: idx + 1,
        ชื่อ: c.profiles?.full_name || '-',
        อีเมล: c.profiles?.email || '-',
        เวลาเช็กอิน: new Date(c.checkin_at).toLocaleString('th-TH'),
        สถานะ: c.status,
        ระยะห่าง: c.distance_meters != null ? `${c.distance_meters} m` : '-',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checkins');
      XLSX.writeFile(wb, `เช็กอิน_${sessionTitle}.xlsx`);
      Toast.show({ type: 'success', text1: 'ดาวน์โหลดสำเร็จ' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'ส่งออกล้มเหลว', text2: e?.message });
    }
  };

  if (isLoading) {
    return (
      <View style={detailStyles.box}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={[detailStyles.box, { borderColor: theme.border }]}>
        <Text style={{ color: theme.mutedForeground, fontSize: 13, fontWeight: '600' }}>
          ยังไม่มีผู้เช็กอินใน session นี้
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[detailStyles.box, { borderColor: theme.border, backgroundColor: theme.background }]}
    >
      <View style={detailStyles.headerRow}>
        <Text style={[detailStyles.headerText, { color: theme.text }]}>
          ผู้เช็กอินสำเร็จ ({data.length})
        </Text>
        <View style={detailStyles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/(admin)/checkin-attendees',
                params: { sessionId },
              })
            }
            style={[detailStyles.fullBtn, { backgroundColor: theme.primary + '22' }]}
            activeOpacity={0.85}
          >
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '900' }}>
              ดูเต็มหน้าจอ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExportExcel}
            style={[detailStyles.exportBtn, { backgroundColor: theme.secondary }]}
            activeOpacity={0.85}
          >
            <Download size={14} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>
              Excel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {data.map((row) => (
        <View
          key={row.id}
          style={[detailStyles.row, { borderBottomColor: theme.border }]}
        >
          <View style={[detailStyles.avatar, { backgroundColor: theme.secondary }]}>
            <Text style={{ color: theme.text, fontWeight: '900' }}>
              {row.profiles?.full_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
              {row.profiles?.full_name || 'ไม่ระบุชื่อ'}
            </Text>
            <Text
              style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: '600' }}
              numberOfLines={1}
            >
              {new Date(row.checkin_at).toLocaleTimeString('th-TH')} ·{' '}
              {row.profiles?.email || '-'}
            </Text>
          </View>
          <View
            style={[
              detailStyles.badge,
              {
                backgroundColor:
                  row.status === 'success'
                    ? 'rgba(16,185,129,0.15)'
                    : row.status === 'out_of_range'
                      ? 'rgba(245,158,11,0.15)'
                      : 'rgba(239,68,68,0.15)',
              },
            ]}
          >
            <Text
              style={{
                color:
                  row.status === 'success'
                    ? '#10B981'
                    : row.status === 'out_of_range'
                      ? '#F59E0B'
                      : '#EF4444',
                fontWeight: '900',
                fontSize: 10,
                textTransform: 'uppercase',
              }}
            >
              {row.status}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function MiniStat({
  icon,
  value,
  label,
  theme,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  theme: any;
}) {
  return (
    <View style={styles.miniStat}>
      {icon}
      <Text style={[styles.miniStatValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: theme.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  box: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fullBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerText: { fontSize: 13, fontWeight: '900' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroBox: {
    padding: 22,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 22,
  },
  heroBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.6,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { fontSize: 18, fontWeight: '900', marginTop: 6, letterSpacing: -0.3 },
  heroBigNumber: { fontSize: 64, fontWeight: '900', marginTop: 6, letterSpacing: -2 },
  heroSub: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  daySection: { marginBottom: 22 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  dayTitle: { fontSize: 16, fontWeight: '900' },
  dayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dayBadgeText: { fontSize: 12, fontWeight: '900' },

  sessionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(16,185,129,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  sessionTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  eventName: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '700' },

  bigCount: { alignItems: 'flex-end', marginLeft: 14 },
  bigCountValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  bigCountLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },

  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatValue: { fontSize: 13, fontWeight: '900' },
  miniStatLabel: { fontSize: 11, fontWeight: '700' },

  eventSection: { marginBottom: 22 },
  eventSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eventSectionTitle: { fontSize: 16, fontWeight: '900' },
  eventSectionHint: { fontSize: 11, fontWeight: '600', marginBottom: 12, lineHeight: 16 },
  eventEmptyBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  eventEmptyText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  eventCardTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  eventStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventStatCell: {
    minWidth: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  eventStatValue: { fontSize: 17, fontWeight: '900' },
  eventStatLabel: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
