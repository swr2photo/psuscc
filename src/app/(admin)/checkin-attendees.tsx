import {
  View,
  Text,
  StyleSheet,
  Platform,
  FlatList,
  SectionList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import type { SectionListData } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import {
  ChevronLeft,
  Search,
  Trash2,
  UserCheck,
  Users,
  ChevronRight,
} from 'lucide-react-native';

import { HeaderRight } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { ActionSheet } from '@/components/ui/action-sheet';
import { useActivities } from '@/features/activities/api/useActivities';
import { useTheme } from '@/hooks/use-theme';
import {
  useCheckinSummary,
  useSessionCheckins,
  useAdminAllSuccessCheckins,
  useDeleteCheckin,
  type CheckinDetail,
  type AdminCheckinRow,
} from '@/features/checkin/api/useCheckinSummary';

function eventCoverUri(e: { cover_url?: string | null; detail_image_url?: string | null } | undefined) {
  return e?.cover_url || e?.detail_image_url || null;
}

function formatShortSessionDate(iso: string | null | undefined) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

type AttendeeSection = SectionListData<AdminCheckinRow> & {
  sectionKey: string;
  bannerUrl: string | null;
  eventTitle: string;
  sessionLine: string;
  memberCount: number;
};

/** จัดกลุ่มตามค่าย → รอบ QR เรียงชื่อค่ายแล้วตามวันที่รอบ */
function buildAttendeeSections(rows: AdminCheckinRow[]): AttendeeSection[] {
  if (!rows.length) return [];
  const map = new Map<string, AdminCheckinRow[]>();
  for (const r of rows) {
    const k = `${r.event_id ?? 'none'}::${r.session_id}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  const sections: AttendeeSection[] = [];
  for (const data of map.values()) {
    data.sort((a, b) => new Date(b.checkin_at).getTime() - new Date(a.checkin_at).getTime());
    const first = data[0];
    const bannerUrl = first.event_cover_url ?? null;
    const eventTitle = first.event_title || 'ไม่ผูกค่าย';
    const datePart = formatShortSessionDate(first.session_date);
    const sessionLine =
      [first.session_title, datePart].filter(Boolean).join(' · ') || 'รอบไม่ระบุ';
    const sectionKey = `${first.event_id ?? 'none'}::${first.session_id}`;
    sections.push({
      key: sectionKey,
      sectionKey,
      bannerUrl,
      eventTitle,
      sessionLine,
      memberCount: data.length,
      data,
    });
  }
  sections.sort((a, b) => {
    const t = a.eventTitle.localeCompare(b.eventTitle, 'th');
    if (t !== 0) return t;
    const da = a.data[0]?.session_date || '';
    const db = b.data[0]?.session_date || '';
    return db.localeCompare(da);
  });
  return sections;
}

/**
 * แอดมินดูรายชื่อผู้เช็กอิน
 * - ตามรอบ QR: เลือก session แล้วค้นหาในคนรอบนั้น
 * - ค้นหาทั้งหมด: ดูทุกคนที่เช็กอินสำเร็จ กรองตามค่าย + ค้นชื่อ/อีเมล
 */
export default function CheckinAttendeesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : undefined;

  const { data: events } = useActivities();
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } =
    useCheckinSummary();
  const {
    data: attendees,
    isLoading: loadingAttendees,
    refetch: refetchAttendees,
  } = useSessionCheckins(sessionId, { status: 'success' });

  const [listTab, setListTab] = useState<'session' | 'all'>('session');
  const [eventFilterId, setEventFilterId] = useState<string | null>(null);
  const [campPickerOpen, setCampPickerOpen] = useState(false);

  const {
    data: allCheckins,
    isLoading: loadingAllCheckins,
    refetch: refetchAllCheckins,
  } = useAdminAllSuccessCheckins(eventFilterId);

  const deleteCheckin = useDeleteCheckin();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const sessionMeta = useMemo(
    () => summary?.find((s) => s.session_id === sessionId),
    [summary, sessionId],
  );

  useEffect(() => {
    setSearch('');
  }, [sessionId, listTab, eventFilterId]);

  const filtered = useMemo(() => {
    if (!attendees) return [];
    const q = search.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter((a) => {
      const name = a.profiles?.full_name?.toLowerCase() ?? '';
      const email = a.profiles?.email?.toLowerCase() ?? '';
      return name.includes(q) || email.includes(q);
    });
  }, [attendees, search]);

  const filteredAll = useMemo(() => {
    if (!allCheckins) return [];
    const q = search.trim().toLowerCase();
    if (!q) return allCheckins;
    return allCheckins.filter((a) => {
      const name = a.profiles?.full_name?.toLowerCase() ?? '';
      const email = a.profiles?.email?.toLowerCase() ?? '';
      const st = (a.session_title || '').toLowerCase();
      const et = (a.event_title || '').toLowerCase();
      return name.includes(q) || email.includes(q) || st.includes(q) || et.includes(q);
    });
  }, [allCheckins, search]);

  const attendeeSections = useMemo(() => buildAttendeeSections(filteredAll), [filteredAll]);

  const sessionEventBanner = useMemo(() => {
    if (!sessionMeta?.event_id || !events?.length) return null;
    const ev = events.find((e) => e.id === sessionMeta.event_id);
    return ev ? eventCoverUri(ev) : null;
  }, [sessionMeta, events]);

  const onRefresh = async () => {
    setRefreshing(true);
    const tasks: Promise<unknown>[] = [refetchSummary()];
    if (sessionId) tasks.push(refetchAttendees());
    if (!sessionId && listTab === 'all') tasks.push(refetchAllCheckins());
    await Promise.all(tasks);
    setRefreshing(false);
  };

  const formatDateThai = (iso: string) =>
    new Date(iso).toLocaleDateString('th-TH', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const promptDeleteCheckin = (item: CheckinDetail) => {
    const name = item.profiles?.full_name?.trim() || 'ผู้ใช้';
    Alert.alert(
      'ลบรายการเช็กอิน',
      `ลบการเช็กอินของ ${name} ออกจากระบบหรือไม่\nผู้ใช้จะสแกนเช็กอินใหม่ได้ตามจำนวนครั้งที่ค่ายอนุญาต`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: () =>
            deleteCheckin.mutate(item.id, {
              onError: (err) =>
                Alert.alert(
                  'ลบไม่สำเร็จ',
                  err instanceof Error ? err.message : String(err),
                ),
            }),
        },
      ],
    );
  };

  const isDeletingRow = (id: string) =>
    deleteCheckin.isPending && deleteCheckin.variables === id;

  /** แถวในโหมดจัดกลุ่ม (ชื่อค่าย/รอบอยู่ที่หัวข้อแล้ว) */
  const renderRowAll = ({ item, index }: { item: AdminCheckinRow; index: number }) => (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.indexCol, { color: theme.mutedForeground }]}>{index + 1}</Text>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.avatarLetter, { color: theme.text }]}>
            {(item.profiles?.full_name || '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.rowMain}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {item.profiles?.full_name || 'ไม่ระบุชื่อ'}
        </Text>
        <Text style={[styles.email, { color: theme.mutedForeground }]} numberOfLines={1}>
          {item.profiles?.email || '—'}
        </Text>
        <Text style={[styles.time, { color: theme.mutedForeground }]}>
          เช็กอินเมื่อ {new Date(item.checkin_at).toLocaleString('th-TH')}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => promptDeleteCheckin(item)}
        disabled={deleteCheckin.isPending}
        accessibilityLabel="ลบรายการเช็กอิน"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isDeletingRow(item.id) ? (
          <ActivityIndicator size="small" color={theme.error} />
        ) : (
          <Trash2 size={20} color={theme.error} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: SectionListData<AdminCheckinRow> }) => {
    const s = section as AttendeeSection;
    return (
      <View
        style={[styles.sectionCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <View style={styles.sectionHeaderRow}>
          {s.bannerUrl ? (
            <Image
              source={{ uri: s.bannerUrl }}
              style={styles.sectionBanner}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.sectionBannerPlaceholder, { backgroundColor: theme.secondary }]}>
              <Users size={26} color={theme.mutedForeground} />
            </View>
          )}
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, { color: theme.text }]} numberOfLines={2}>
              {s.eventTitle}
            </Text>
            <Text
              style={[styles.sectionSub, { color: theme.mutedForeground }]}
              numberOfLines={2}
            >
              {s.sessionLine}
            </Text>
            <Text style={[styles.sectionCount, { color: theme.primary }]}>
              ผู้เช็กอิน {s.memberCount} คน
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRow = ({ item, index }: { item: CheckinDetail; index: number }) => (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.indexCol, { color: theme.mutedForeground }]}>{index + 1}</Text>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.avatarLetter, { color: theme.text }]}>
            {(item.profiles?.full_name || '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.rowMain}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {item.profiles?.full_name || 'ไม่ระบุชื่อ'}
        </Text>
        <Text style={[styles.email, { color: theme.mutedForeground }]} numberOfLines={1}>
          {item.profiles?.email || '—'}
        </Text>
        <Text style={[styles.time, { color: theme.mutedForeground }]}>
          เช็กอินเมื่อ {new Date(item.checkin_at).toLocaleString('th-TH')}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => promptDeleteCheckin(item)}
        disabled={deleteCheckin.isPending}
        accessibilityLabel="ลบรายการเช็กอิน"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isDeletingRow(item.id) ? (
          <ActivityIndicator size="small" color={theme.error} />
        ) : (
          <Trash2 size={20} color={theme.error} />
        )}
      </TouchableOpacity>
    </View>
  );

  const sessionPicker = (
    <View style={styles.pickerSection}>
      <Text style={[styles.pickerTitle, { color: theme.mutedForeground }]}>
        เลือกรอบเช็กอินเพื่อดูรายชื่อ
      </Text>
      {loadingSummary && !summary ? (
        <ActivityIndicator color={theme.text} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={summary ?? []}
          keyExtractor={(s) => s.session_id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing && !sessionId}
              onRefresh={onRefresh}
              tintColor={theme.text}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.mutedForeground }]}>
              ยังไม่มี session ในระบบ — สร้าง QR ที่ &quot;จัดการ QR เช็กอิน&quot; ก่อน
            </Text>
          }
          renderItem={({ item }) => {
            const ev = events?.find((e) => e.id === item.event_id);
            const thumb = ev ? eventCoverUri(ev) : null;
            return (
              <TouchableOpacity
                style={[
                  styles.sessionPickCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/checkin-attendees',
                    params: { sessionId: item.session_id },
                  })
                }
              >
                {thumb ? (
                  <Image
                    source={{ uri: thumb }}
                    style={styles.sessionPickThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.sessionPickThumbPlaceholder,
                      { backgroundColor: theme.secondary },
                    ]}
                  >
                    <Users size={22} color={theme.mutedForeground} />
                  </View>
                )}
                <View style={styles.sessionPickText}>
                  <Text style={[styles.pickTitle, { color: theme.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.pickSub, { color: theme.mutedForeground }]}>
                    {formatDateThai(item.session_date)} · {item.event_title || 'ไม่ผูกกิจกรรม'}
                  </Text>
                </View>
                <View style={[styles.pickBadge, { backgroundColor: theme.primary + '18' }]}>
                  <Text style={[styles.pickBadgeText, { color: theme.primary }]}>
                    {item.success_count} คน
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  const listHeader = sessionId ? (
    <>
      {sessionEventBanner ? (
        <Image
          source={{ uri: sessionEventBanner }}
          style={[styles.sessionDetailBanner, { borderColor: theme.border }]}
          resizeMode="cover"
        />
      ) : null}
      {sessionMeta && (
        <View style={[styles.metaBanner, { backgroundColor: theme.secondary }]}>
          <Text style={[styles.metaTitle, { color: theme.text }]} numberOfLines={2}>
            {sessionMeta.title}
          </Text>
          <Text style={[styles.metaSub, { color: theme.mutedForeground }]}>
            {formatDateThai(sessionMeta.session_date)}
            {sessionMeta.event_title ? ` · ${sessionMeta.event_title}` : ''}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Search size={18} color={theme.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="ค้นหาชื่อหรืออีเมล"
          placeholderTextColor={theme.mutedForeground}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>
      <Text style={[styles.countLine, { color: theme.mutedForeground }]}>
        ผู้เช็กอินสำเร็จ {filtered.length} คน
        {search.trim() ? ` (จากทั้งหมด ${attendees?.length ?? 0})` : ''}
      </Text>
    </>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'รายชื่อผู้เช็กอิน',
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

      {!sessionId ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                {
                  backgroundColor: listTab === 'session' ? theme.text : theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setListTab('session')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: listTab === 'session' ? theme.background : theme.mutedForeground },
                ]}
              >
                ตามรอบ QR
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                {
                  backgroundColor: listTab === 'all' ? theme.text : theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setListTab('all')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: listTab === 'all' ? theme.background : theme.mutedForeground },
                ]}
              >
                ค้นหาทั้งหมด
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroHint}>
            <Users size={22} color={theme.primary} />
            <Text style={[styles.heroHintText, { color: theme.text }]}>
              {listTab === 'session'
                ? 'เลือกรอบ QR — มีรูปค่ายกำกับ และดูรายชื่อในรอบนั้น'
                : 'จัดกลุ่มตามค่ายและรอบ QR มีแบนเนอร์ค่าย ค้นหาชื่อ / อีเมล / ชื่อรอบได้'}
            </Text>
          </View>

          {listTab === 'session' ? (
            sessionPicker
          ) : (
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={[
                  styles.filterRow,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => setCampPickerOpen(true)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.filterLabel, { color: theme.mutedForeground }]}>
                    กรองค่าย
                  </Text>
                  <Text style={[styles.filterValue, { color: theme.text }]} numberOfLines={1}>
                    {eventFilterId
                      ? events?.find((e) => e.id === eventFilterId)?.title || '—'
                      : 'ทุกค่าย'}
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.mutedForeground} />
              </TouchableOpacity>

              <View
                style={[
                  styles.searchWrap,
                  { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 8 },
                ]}
              >
                <Search size={18} color={theme.mutedForeground} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="ค้นหา ชื่อ, อีเมล, ชื่อค่าย หรือชื่อรอบ QR"
                  placeholderTextColor={theme.mutedForeground}
                  style={[styles.searchInput, { color: theme.text }]}
                />
              </View>
              <Text style={[styles.countLine, { color: theme.mutedForeground, marginBottom: 10 }]}>
                {filteredAll.length} รายการ · {attendeeSections.length} กลุ่ม (ค่าย + รอบ QR)
                {search.trim() && allCheckins
                  ? ` · จากทั้งหมด ${allCheckins.length} รายการ`
                  : ''}
              </Text>

              {loadingAllCheckins && !allCheckins ? (
                <View style={styles.center}>
                  <ActivityIndicator size="large" color={theme.text} />
                </View>
              ) : (
                <SectionList<AdminCheckinRow, AttendeeSection>
                  sections={attendeeSections}
                  keyExtractor={(item) => item.id}
                  renderSectionHeader={renderSectionHeader}
                  renderItem={renderRowAll}
                  stickySectionHeadersEnabled={Platform.OS === 'ios'}
                  contentContainerStyle={[styles.listContent, { paddingHorizontal: 0 }]}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={theme.text}
                    />
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyBox}>
                      <UserCheck size={40} color={theme.mutedForeground} />
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        {allCheckins?.length === 0
                          ? 'ยังไม่มีผู้เช็กอินสำเร็จในระบบ'
                          : 'ไม่พบรายการตามคำค้นหา'}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={styles.changeRow}>
            <TouchableOpacity
              onPress={() => router.replace('/(admin)/checkin-attendees')}
              style={styles.changeBtn}
              activeOpacity={0.8}
            >
              <ChevronLeft size={18} color={theme.primary} />
              <Text style={[styles.changeBtnText, { color: theme.primary }]}>
                เลือกรอบอื่น
              </Text>
            </TouchableOpacity>
          </View>
          {loadingAttendees && !attendees ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.text} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderRow}
              ListHeaderComponent={
                <View>
                  {listHeader}
                  {filtered.length === 0 && !loadingAttendees && (
                    <View style={styles.emptyBox}>
                      <UserCheck size={40} color={theme.mutedForeground} />
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        {attendees?.length === 0
                          ? 'ยังไม่มีผู้เช็กอินสำเร็จในรอบนี้'
                          : 'ไม่พบชื่อตามคำค้นหา'}
                      </Text>
                    </View>
                  )}
                </View>
              }
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.text}
                />
              }
            />
          )}
        </>
      )}

      <ActionSheet visible={campPickerOpen} onClose={() => setCampPickerOpen(false)} title="เลือกค่าย">
        <ScrollView style={{ paddingHorizontal: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={[
              styles.campOption,
              styles.campOptionRow,
              {
                backgroundColor: !eventFilterId ? theme.primary + '18' : theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={() => {
              setEventFilterId(null);
              setCampPickerOpen(false);
            }}
          >
            <View style={[styles.campThumbPlaceholder, { backgroundColor: theme.secondary }]}>
              <Users size={20} color={theme.mutedForeground} />
            </View>
            <Text style={{ color: theme.text, fontWeight: '800' }}>ทุกค่าย</Text>
          </TouchableOpacity>
          {events?.map((e) => {
            const uri = eventCoverUri(e);
            return (
            <TouchableOpacity
              key={e.id}
              style={[
                styles.campOption,
                styles.campOptionRow,
                {
                  backgroundColor:
                    eventFilterId === e.id ? theme.primary + '18' : theme.surface,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => {
                setEventFilterId(e.id);
                setCampPickerOpen(false);
              }}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.campThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.campThumbPlaceholder, { backgroundColor: theme.secondary }]}>
                  <Users size={20} color={theme.mutedForeground} />
                </View>
              )}
              <Text
                style={{ color: theme.text, fontWeight: '700', flex: 1, minWidth: 0 }}
                numberOfLines={2}
              >
                {e.title}
              </Text>
            </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ActionSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    marginBottom: 8,
  },
  heroHintText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabBtnText: { fontSize: 13, fontWeight: '900' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },
  filterLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  filterValue: { fontSize: 15, fontWeight: '800' },
  campOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  campOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  campThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  campThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSection: { flex: 1 },
  pickerTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sessionPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  sessionPickThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  sessionPickThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionPickText: { flex: 1, minWidth: 0 },
  pickTitle: { fontSize: 16, fontWeight: '900' },
  pickSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  pickBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pickBadgeText: { fontSize: 13, fontWeight: '900' },
  empty: { textAlign: 'center', padding: 24, fontSize: 14, fontWeight: '600' },

  changeRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  changeBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  changeBtnText: { fontSize: 14, fontWeight: '800' },

  metaBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
  },
  sessionDetailBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 128,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  metaTitle: { fontSize: 16, fontWeight: '900' },
  metaSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600' },
  countLine: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  listContent: { paddingBottom: 40 },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  sectionBanner: {
    width: 76,
    height: 76,
    borderRadius: 14,
  },
  sectionBannerPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  sectionSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  sectionCount: { fontSize: 12, fontWeight: '900', marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  indexCol: { width: 22, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 18, fontWeight: '900' },
  rowMain: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '800' },
  email: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  time: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  deleteBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
});
