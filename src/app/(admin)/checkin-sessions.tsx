import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  QrCode as QrIcon,
  RefreshCw,
  Power,
  X,
  Locate,
  Search,
  ChevronRight,
  Users,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Toast from 'react-native-toast-message';

import { ActionSheet } from '@/components/ui/action-sheet';
import { HeaderRight } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { useTheme } from '@/hooks/use-theme';
import { useActivities } from '@/features/activities/api/useActivities';
import {
  CheckinSession,
  useCheckinSessions,
  useDeleteCheckinSession,
  useRegenerateCheckinToken,
  useToggleCheckinSession,
  useUpsertCheckinSession,
} from '@/features/checkin/api/useCheckinSessions';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';

type FilterMode = 'today' | 'all' | 'active';

export default function CheckinSessionsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: sessions, isLoading, refetch } = useCheckinSessions(undefined, true);
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());
  const { data: events, isLoading: eventsLoading, isError: eventsLoadError } = useActivities();
  const upsert = useUpsertCheckinSession();
  const deleteSession = useDeleteCheckinSession();
  const toggleActive = useToggleCheckinSession();
  const regenerateToken = useRegenerateCheckinToken();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('today');

  const [editing, setEditing] = useState<Partial<CheckinSession> | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [qrViewerSession, setQrViewerSession] = useState<CheckinSession | null>(null);

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    mode: 'date' | 'time';
    field: 'start_time' | 'end_time';
  }>({ visible: false, mode: 'time', field: 'start_time' });

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const todayISO = new Date().toISOString().split('T')[0];
    return sessions.filter((s) => {
      if (filter === 'today' && s.session_date !== todayISO) return false;
      if (filter === 'active' && !s.is_active) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.events?.title?.toLowerCase().includes(q) ||
        s.location_name?.toLowerCase().includes(q)
      );
    });
  }, [sessions, search, filter]);

  const stats = useMemo(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    const todayList = sessions?.filter((s) => s.session_date === todayISO) ?? [];
    return {
      todayCount: todayList.length,
      activeNow: todayList.filter(
        (s) =>
          s.is_active &&
          new Date(s.start_time) <= now &&
          new Date(s.end_time) >= now,
      ).length,
      totalSessions: sessions?.length ?? 0,
    };
  }, [sessions, now]);

  const sessionStatus = (s: CheckinSession): { label: string; color: string } => {
    if (!s.is_active) return { label: 'ปิดใช้งาน', color: '#94A3B8' };
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    if (now < start) return { label: 'ยังไม่เริ่ม', color: '#3B82F6' };
    if (now > end) return { label: 'หมดเวลา', color: '#EF4444' };
    return { label: 'กำลังเปิด', color: '#10B981' };
  };

  const openCreate = () => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 4);
    setEditing({
      title: 'เช็กอิน ' + new Date().toLocaleDateString('th-TH'),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_active: true,
      enforce_location: true,
      location_radius: 100,
      location_name: '',
      location_lat: null,
      location_lng: null,
      event_id: null,
    });
    setEventPickerOpen(false);
    setEditorOpen(true);
  };

  const openEdit = (s: CheckinSession) => {
    setEditing({ ...s });
    setEventPickerOpen(false);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editing?.title?.trim()) {
      Toast.show({ type: 'error', text1: 'กรอกชื่อ session ก่อน' });
      return;
    }
    if (!editing.start_time || !editing.end_time) {
      Toast.show({ type: 'error', text1: 'เลือกเวลาเริ่ม/สิ้นสุดก่อน' });
      return;
    }
    if (new Date(editing.end_time) <= new Date(editing.start_time)) {
      Toast.show({ type: 'error', text1: 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม' });
      return;
    }

    try {
      await upsert.mutateAsync({
        id: editing.id,
        event_id: editing.event_id ?? null,
        title: editing.title.trim(),
        start_time: editing.start_time,
        end_time: editing.end_time,
        is_active: editing.is_active ?? true,
        location_name: editing.location_name ?? null,
        location_lat: editing.location_lat ?? null,
        location_lng: editing.location_lng ?? null,
        location_radius: editing.location_radius ?? 100,
        enforce_location: editing.enforce_location ?? true,
      });
      Toast.show({ type: 'success', text1: editing.id ? 'อัปเดตแล้ว' : 'สร้าง QR แล้ว' });
      setEditorOpen(false);
      setEditing(null);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'บันทึกไม่สำเร็จ', text2: e.message });
    }
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      try {
        await deleteSession.mutateAsync(id);
        Toast.show({ type: 'success', text1: 'ลบ session แล้ว' });
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'ลบไม่สำเร็จ', text2: e.message });
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('ลบ session นี้?')) performDelete();
    } else {
      Alert.alert('ยืนยันลบ', 'ลบ session และผู้เช็กอินทั้งหมด?', [
        { text: 'ยกเลิก' },
        { text: 'ลบ', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  const handleToggleActive = async (s: CheckinSession) => {
    try {
      await toggleActive.mutateAsync({ id: s.id, isActive: !s.is_active });
      Toast.show({
        type: 'success',
        text1: !s.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งานชั่วคราว',
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'ไม่สำเร็จ', text2: e.message });
    }
  };

  const handleRegenerateToken = (s: CheckinSession) => {
    const performRegenerate = async () => {
      try {
        await regenerateToken.mutateAsync(s.id);
        Toast.show({ type: 'success', text1: 'สร้างโทเคนใหม่แล้ว', text2: 'QR ของเดิมจะใช้ไม่ได้แล้ว' });
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'ไม่สำเร็จ', text2: e.message });
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('สร้างโทเคนใหม่? QR เดิมจะใช้ไม่ได้แล้ว')) performRegenerate();
    } else {
      Alert.alert('ยืนยัน', 'สร้างโทเคนใหม่? QR เดิมจะใช้ไม่ได้แล้ว', [
        { text: 'ยกเลิก' },
        { text: 'สร้างใหม่', onPress: performRegenerate },
      ]);
    }
  };

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง' });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setEditing((prev) => ({
        ...(prev || {}),
        location_lat: loc.coords.latitude,
        location_lng: loc.coords.longitude,
      }));
      Toast.show({ type: 'success', text1: 'ใช้พิกัดปัจจุบันแล้ว' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'อ่านพิกัดไม่ได้', text2: e.message });
    }
  };

  const showPicker = (field: 'start_time' | 'end_time', mode: 'date' | 'time') => {
    if (Platform.OS === 'web') {
      Toast.show({
        type: 'info',
        text1: 'เลือกวัน/เวลาบนเว็บ',
        text2: 'กรุณาใช้แอปมือถือ หรือกรอก/ปรับในช่องอื่น (รองรับเร็วๆ นี้)',
      });
      return;
    }
    setPickerConfig({ visible: true, mode, field });
  };

  const handlePickerChange = (_e: any, date?: Date) => {
    if (Platform.OS === 'android') {
      if (_e?.type === 'dismissed') {
        setPickerConfig((p) => ({ ...p, visible: false }));
        return;
      }
    }

    // Android ส่งครั้งแรกโดยไม่มี date บ่อยครั้ง — อย่าปิด dialog ในกรณีนี้ (เดิมทำให้ปิกเกอร์หายทันที)
    if (!date || Number.isNaN(date.getTime())) {
      return;
    }

    const cur = editing?.[pickerConfig.field]
      ? new Date(editing[pickerConfig.field] as string)
      : new Date();
    if (pickerConfig.mode === 'date') {
      cur.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    } else {
      cur.setHours(date.getHours(), date.getMinutes(), 0, 0);
    }
    setEditing((prev) => ({ ...(prev || {}), [pickerConfig.field]: cur.toISOString() }));

    // หลังเลือกใน dialog ของ Android (ไม่ใช้ inline) ให้ปิดทุกครั้งที่ได้วันที่/เวลาที่ถูกต้อง
    if (Platform.OS === 'android') {
      setPickerConfig((p) => ({ ...p, visible: false }));
    }
  };

  const formatTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
  const formatDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '-';

  const ListHeader = (
    <View>
      <View style={styles.hero}>
        <View style={[styles.heroBlob, { backgroundColor: isDark ? '#2A2A2A' : '#E0E7FF' }]} />
        <Text style={[styles.heroLabel, { color: theme.mutedForeground }]}>ADMIN · CHECK-IN</Text>
        <Text style={[styles.heroTitle, { color: theme.text }]}>QR เช็กอินแต่ละวัน</Text>
        <Text style={[styles.heroSub, { color: theme.mutedForeground }]}>
          สร้าง QR Code ตั้งเวลาเปิด-ปิด และกำหนดพื้นที่ที่อนุญาตให้สแกน
        </Text>

        <View style={styles.statsRow}>
          <StatBox
            label="QR วันนี้"
            value={stats.todayCount}
            tint="#6366f1"
            theme={theme}
          />
          <StatBox
            label="กำลังเปิดอยู่"
            value={stats.activeNow}
            tint="#10B981"
            theme={theme}
            highlight
          />
          <StatBox
            label="ทั้งหมด"
            value={stats.totalSessions}
            tint={isDark ? '#3F3F46' : '#0F172A'}
            theme={theme}
          />
        </View>
      </View>

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
          placeholder="ค้นหา session, สถานที่ หรือกิจกรรม"
          placeholderTextColor={theme.mutedForeground}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={14} color={theme.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersRow}>
        {(
          [
            { key: 'today', label: 'วันนี้' },
            { key: 'active', label: 'เปิดอยู่' },
            { key: 'all', label: 'ทั้งหมด' },
          ] as { key: FilterMode; label: string }[]
        ).map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              activeOpacity={0.85}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? theme.text : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: active ? theme.background : theme.mutedForeground },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(admin)/checkin-summary')}
          style={[
            styles.summaryBtn,
            { backgroundColor: theme.primary + '15', borderColor: theme.primary + '40' },
          ]}
        >
          <Users size={14} color={theme.primary} />
          <Text style={[styles.summaryBtnText, { color: theme.primary }]}>สรุปยอด</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'ระบบเช็กอิน',
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

      {isLoading && !sessions ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.text} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={[styles.list, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
          renderItem={({ item }) => {
            const status = sessionStatus(item);
            return (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleWrap}>
                    <View style={styles.cardTitleRow}>
                      <View style={[styles.cardStatusDot, { backgroundColor: status.color }]} />
                      <Text style={[styles.cardStatusText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                    <Text
                      style={[styles.cardTitle, { color: theme.text }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    {item.events?.title ? (
                      <Text
                        style={[styles.cardEvent, { color: theme.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {item.events.title}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={() => setQrViewerSession(item)}
                    style={[
                      styles.qrPreview,
                      { backgroundColor: '#FFF', borderColor: theme.border },
                    ]}
                    activeOpacity={0.85}
                  >
                    <QRCode value={item.qr_token} size={64} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.metaGrid, { borderColor: theme.border }]}>
                  <MetaCell
                    icon={<CalendarIcon size={12} color={theme.mutedForeground} />}
                    text={formatDate(item.session_date)}
                    theme={theme}
                  />
                  <MetaCell
                    icon={<Clock size={12} color={theme.mutedForeground} />}
                    text={`${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}
                    theme={theme}
                  />
                  <MetaCell
                    icon={<MapPin size={12} color={theme.mutedForeground} />}
                    text={
                      item.location_lat != null
                        ? `${item.location_name || 'พิกัด'} · ${item.location_radius}ม.`
                        : 'ไม่เปิด geofence'
                    }
                    theme={theme}
                  />
                </View>

                <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
                  <TouchableOpacity
                    onPress={() => setQrViewerSession(item)}
                    style={[styles.actionPrimary, { backgroundColor: theme.text }]}
                    activeOpacity={0.85}
                  >
                    <QrIcon size={14} color={theme.background} />
                    <Text style={[styles.actionPrimaryText, { color: theme.background }]}>
                      ดู QR
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleToggleActive(item)}
                    style={[
                      styles.actionGhost,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Power size={14} color={item.is_active ? '#EF4444' : '#10B981'} />
                    <Text style={[styles.actionGhostText, { color: theme.text }]}>
                      {item.is_active ? 'ปิด' : 'เปิด'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openEdit(item)}
                    style={[
                      styles.actionGhost,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Edit3 size={14} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={[styles.actionDanger]}
                    activeOpacity={0.85}
                  >
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <QrIcon size={28} color={theme.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                ยังไม่มี QR วันนี้
              </Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                สร้าง QR session แรกของวันเพื่อให้ผู้เข้าร่วมสแกนเช็กอินได้
              </Text>
              <TouchableOpacity
                onPress={openCreate}
                style={[styles.emptyCta, { backgroundColor: theme.text }]}
                activeOpacity={0.9}
              >
                <Plus size={16} color={theme.background} />
                <Text style={[styles.emptyCtaText, { color: theme.background }]}>
                  สร้าง QR ใหม่
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Apple-style Separate Bottom Toolbar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom,
        }}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={{
            height: 60,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            borderTopWidth: 0.5,
            borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            onPress={() => router.push('/(admin)/checkin-summary')}
          >
             <Users size={20} color={theme.primary} />
             <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 17 }}>สรุปผล</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
             <Text style={{ color: theme.mutedForeground, fontSize: 13, fontWeight: '500' }}>
               {filtered.length} เซสชัน
             </Text>
          </View>

          <TouchableOpacity
            onPress={openCreate}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={22} color="#FFF" />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* ---------- Editor ---------- */}
      <ActionSheet
        visible={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEventPickerOpen(false);
        }}
        title={editing?.id ? 'แก้ไข QR Session' : 'สร้าง QR Session'}
      >
        <ScrollView
          style={{ paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <Text style={[styles.label, { color: theme.mutedForeground }]}>ชื่อ session *</Text>
          <TextInput
            value={editing?.title || ''}
            onChangeText={(t) => setEditing((p) => ({ ...(p || {}), title: t }))}
            placeholder="เช่น เช็กอินเช้า, ลงทะเบียนหน้างาน"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <Text style={[styles.label, { color: theme.mutedForeground }]}>กิจกรรม (ถ้ามี)</Text>
          <TouchableOpacity
            onPress={() => setEventPickerOpen((v) => !v)}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>
              {events?.find((e) => e.id === editing?.event_id)?.title || 'ไม่ผูกกับกิจกรรม'}
            </Text>
            <ChevronRight
              size={16}
              color={theme.mutedForeground}
              style={{
                transform: [{ rotate: eventPickerOpen ? '90deg' : '0deg' }],
              }}
            />
          </TouchableOpacity>

          {eventPickerOpen ? (
            <View
              style={[
                styles.eventInlineWrap,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            >
              {eventsLoading ? (
                <ActivityIndicator style={{ paddingVertical: 24 }} color={theme.text} />
              ) : eventsLoadError ? (
                <Text style={[styles.eventInlineError, { color: '#EF4444' }]}>
                  โหลดรายการกิจกรรมไม่สำเร็จ
                </Text>
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 260 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setEditing((p) => ({ ...(p || {}), event_id: null }));
                      setEventPickerOpen(false);
                    }}
                    style={[
                      styles.eventOption,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700' }}>
                      ไม่ผูกกับกิจกรรม
                    </Text>
                  </TouchableOpacity>
                  {(events?.length ?? 0) === 0 ? (
                    <Text style={[styles.eventInlineEmpty, { color: theme.mutedForeground }]}>
                      ยังไม่มีกิจกรรม — สร้างที่เมนูจัดการกิจกรรมก่อน
                    </Text>
                  ) : (
                    events?.map((e) => (
                      <TouchableOpacity
                        key={e.id}
                        onPress={() => {
                          setEditing((p) => ({ ...(p || {}), event_id: e.id }));
                          setEventPickerOpen(false);
                        }}
                        style={[
                          styles.eventOption,
                          {
                            backgroundColor:
                              editing?.event_id === e.id ? theme.primary + '20' : theme.surface,
                            borderColor:
                              editing?.event_id === e.id ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: editing?.event_id === e.id ? theme.primary : theme.text,
                            fontWeight: '700',
                          }}
                          numberOfLines={2}
                        >
                          {e.title}
                        </Text>
                        {e.location ? (
                          <Text
                            style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 4 }}
                          >
                            {e.location}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>ช่วงเวลาเปิด-ปิด</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <DatePill
              label="เริ่มเปิด"
              value={editing?.start_time}
              theme={theme}
              onPressDate={() => showPicker('start_time', 'date')}
              onPressTime={() => showPicker('start_time', 'time')}
            />
            <DatePill
              label="ปิดเช็กอิน"
              value={editing?.end_time}
              theme={theme}
              onPressDate={() => showPicker('end_time', 'date')}
              onPressTime={() => showPicker('end_time', 'time')}
            />
          </View>

          {pickerConfig.visible && Platform.OS === 'ios' ? (
            <View
              style={[
                styles.inlinePicker,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <View style={styles.inlinePickerHeader}>
                <Text style={[styles.inlinePickerTitle, { color: theme.text }]}>
                  {pickerConfig.mode === 'date' ? 'เลือกวันที่' : 'เลือกเวลา'}
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerConfig((p) => ({ ...p, visible: false }))}
                  style={[styles.inlinePickerDone, { backgroundColor: theme.text }]}
                >
                  <Text style={{ color: theme.background, fontWeight: '900', fontSize: 14 }}>
                    เสร็จสิ้น
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={
                  editing?.[pickerConfig.field]
                    ? new Date(editing[pickerConfig.field] as string)
                    : new Date()
                }
                mode={pickerConfig.mode}
                is24Hour
                display="spinner"
                themeVariant={isDark ? 'dark' : 'light'}
                onChange={handlePickerChange}
                style={{ height: 220, width: '100%' }}
              />
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>พื้นที่ที่อนุญาต</Text>

          <View
            style={[
              styles.toggleRow,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>
                บังคับเช็กอินในพื้นที่ (geofence)
              </Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                ปิดออปชันนี้เพื่อให้สแกนได้จากที่ใดก็ได้
              </Text>
            </View>
            <Switch
              value={editing?.enforce_location ?? true}
              onValueChange={(v) =>
                setEditing((p) => ({ ...(p || {}), enforce_location: v }))
              }
            />
          </View>

          <Text style={[styles.label, { color: theme.mutedForeground }]}>ชื่อสถานที่</Text>
          <TextInput
            value={editing?.location_name || ''}
            onChangeText={(t) => setEditing((p) => ({ ...(p || {}), location_name: t }))}
            placeholder="เช่น อาคารกิจกรรม, หอประชุม"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.mutedForeground }]}>ละติจูด</Text>
              <TextInput
                value={editing?.location_lat?.toString() || ''}
                onChangeText={(t) =>
                  setEditing((p) => ({
                    ...(p || {}),
                    location_lat: t ? Number(t) : null,
                  }))
                }
                keyboardType="numeric"
                placeholder="13.7563"
                placeholderTextColor={theme.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.mutedForeground }]}>ลองจิจูด</Text>
              <TextInput
                value={editing?.location_lng?.toString() || ''}
                onChangeText={(t) =>
                  setEditing((p) => ({
                    ...(p || {}),
                    location_lng: t ? Number(t) : null,
                  }))
                }
                keyboardType="numeric"
                placeholder="100.5018"
                placeholderTextColor={theme.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={useMyLocation}
            activeOpacity={0.85}
            style={[
              styles.locateBtn,
              { borderColor: theme.border, backgroundColor: theme.secondary },
            ]}
          >
            <Locate size={14} color={theme.text} />
            <Text style={[styles.locateBtnText, { color: theme.text }]}>
              ใช้ตำแหน่งปัจจุบันของฉัน
            </Text>
          </TouchableOpacity>

          <Text style={[styles.label, { color: theme.mutedForeground }]}>
            รัศมีที่อนุญาต (เมตร)
          </Text>
          <TextInput
            value={editing?.location_radius?.toString() || '100'}
            onChangeText={(t) =>
              setEditing((p) => ({
                ...(p || {}),
                location_radius: t ? Math.max(10, Number(t)) : 100,
              }))
            }
            keyboardType="numeric"
            placeholder="100"
            placeholderTextColor={theme.mutedForeground}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <View
            style={[
              styles.toggleRow,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                marginTop: 16,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>
                เปิดใช้งานทันที
              </Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
                เปิด/ปิดในภายหลังได้จากปุ่ม Power
              </Text>
            </View>
            <Switch
              value={editing?.is_active ?? true}
              onValueChange={(v) =>
                setEditing((p) => ({ ...(p || {}), is_active: v }))
              }
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={upsert.isPending}
            activeOpacity={0.85}
            style={[styles.saveBtnFull, { backgroundColor: theme.text }]}
          >
            {upsert.isPending ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={[styles.saveText, { color: theme.background }]}>บันทึก QR</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 80 }} />
        </ScrollView>
      </ActionSheet>

      <ActionSheet
        visible={!!qrViewerSession}
        onClose={() => setQrViewerSession(null)}
        title="QR สำหรับเช็กอิน"
      >
        {qrViewerSession && (
          <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
            <View
              style={[
                styles.qrBigBox,
                { backgroundColor: '#FFF', borderColor: theme.border },
              ]}
            >
              <QRCode
                value={qrViewerSession.qr_token}
                size={250}
                backgroundColor="#FFF"
                color="#000"
              />
            </View>
            <Text style={[styles.qrTitle, { color: theme.text }]} numberOfLines={2}>
              {qrViewerSession.title}
            </Text>
            <Text style={[styles.qrSub, { color: theme.mutedForeground }]}>
              {formatDate(qrViewerSession.session_date)} ·{' '}
              {formatTime(qrViewerSession.start_time)} -{' '}
              {formatTime(qrViewerSession.end_time)}
            </Text>
            <Text
              style={[styles.qrToken, { color: theme.mutedForeground }]}
              selectable
            >
              {qrViewerSession.qr_token}
            </Text>

            <View style={styles.qrActionsRow}>
              <TouchableOpacity
                style={[styles.qrAction, { backgroundColor: theme.secondary }]}
                onPress={() => handleRegenerateToken(qrViewerSession)}
                activeOpacity={0.85}
              >
                <RefreshCw size={14} color={theme.text} />
                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>
                  สร้างโทเคนใหม่
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.qrAction,
                  { backgroundColor: theme.primary + '20' },
                ]}
                onPress={() => {
                  setQrViewerSession(null);
                  router.push({
                    pathname: '/(admin)/checkin-attendees',
                    params: { sessionId: qrViewerSession.id },
                  });
                }}
                activeOpacity={0.85}
              >
                <Users size={14} color={theme.primary} />
                <Text
                  style={{ color: theme.primary, fontWeight: '800', fontSize: 13 }}
                >
                  ดูผู้เช็กอิน
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.qrHint, { color: theme.mutedForeground }]}>
              ผู้เข้าร่วมเปิดแอปและสแกน QR นี้เพื่อเช็กอิน
            </Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </ActionSheet>

      {/* Native picker (Android) — อยู่นอก ActionSheet เพื่อให้ dialog ระบบโผล่เหนือโมดัลแผ่นล่าง */}
      {Platform.OS === 'android' && pickerConfig.visible && (
        <DateTimePicker
          value={
            editing?.[pickerConfig.field]
              ? new Date(editing[pickerConfig.field] as string)
              : new Date()
          }
          mode={pickerConfig.mode}
          display="default"
          is24Hour
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}

// =====================================================
// Subcomponents
// =====================================================

function StatBox({
  label,
  value,
  tint,
  theme,
  highlight,
}: {
  label: string;
  value: number;
  tint: string;
  theme: any;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.statBox,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.statDot, { backgroundColor: tint }]} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>{label}</Text>
      {highlight && <View style={[styles.statRing, { borderColor: tint }]} />}
    </View>
  );
}

function MetaCell({
  icon,
  text,
  theme,
}: {
  icon: React.ReactNode;
  text: string;
  theme: any;
}) {
  return (
    <View style={styles.metaCell}>
      {icon}
      <Text style={[styles.metaText, { color: theme.mutedForeground }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function DatePill({
  label,
  value,
  theme,
  onPressDate,
  onPressTime,
}: {
  label: string;
  value?: string | null;
  theme: any;
  onPressDate: () => void;
  onPressTime: () => void;
}) {
  const formatDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('th-TH', {
          year: '2-digit',
          month: 'short',
          day: 'numeric',
        })
      : 'เลือก';
  const formatTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '--:--';
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.labelSmall, { color: theme.mutedForeground }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
        <TouchableOpacity
          onPress={onPressDate}
          style={[
            styles.timeBtn,
            { backgroundColor: theme.surface, borderColor: theme.border, flex: 1 },
          ]}
        >
          <CalendarIcon size={12} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
            {formatDate(value)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPressTime}
          style={[
            styles.timeBtn,
            { backgroundColor: theme.surface, borderColor: theme.border, width: 80 },
          ]}
        >
          <Clock size={12} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
            {formatTime(value)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 140, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  hero: {
    paddingTop: 4,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  heroBlob: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.5,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroSub: { fontSize: 13, fontWeight: '600', marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  statRing: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    opacity: 0.4,
  },

  searchWrap: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },

  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '800' },
  summaryBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  summaryBtnText: { fontSize: 12, fontWeight: '800' },

  // Card
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitleWrap: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardStatusDot: { width: 8, height: 8, borderRadius: 4 },
  cardStatusText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  cardTitle: { fontSize: 17, fontWeight: '900', marginTop: 4, letterSpacing: -0.3 },
  cardEvent: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  qrPreview: {
    width: 78,
    height: 78,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },

  metaGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metaCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '45%',
  },
  metaText: { fontSize: 12, fontWeight: '700' },

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  actionPrimary: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionPrimaryText: { fontSize: 13, fontWeight: '800' },
  actionGhost: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  actionGhostText: { fontSize: 13, fontWeight: '800' },
  actionDanger: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { fontSize: 14, fontWeight: '900' },

  // Empty
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
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  emptyCtaText: { fontSize: 14, fontWeight: '900' },

  // Modal / Editor
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  label: { fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  labelSmall: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: { height: 1, marginVertical: 22 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
  },
  locateBtnText: { fontSize: 13, fontWeight: '800' },
  saveBtnFull: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  saveText: { fontSize: 15, fontWeight: '900' },
  timeBtn: {
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },

  // Event picker (inline ในแผ่นแก้ไข — หลีกเลี่ยง Modal ซ้อน)
  eventInlineWrap: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    overflow: 'hidden',
  },
  eventInlineError: { paddingVertical: 16, paddingHorizontal: 8, fontSize: 13, fontWeight: '600' },
  eventInlineEmpty: { paddingVertical: 16, paddingHorizontal: 8, fontSize: 13, fontWeight: '600' },

  // Event picker
  eventOption: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },

  // QR viewer
  qrBigBox: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  qrTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  qrSub: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  qrToken: { fontSize: 11, fontWeight: '700', marginTop: 12, fontFamily: 'monospace' },
  qrActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  qrAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
  },
  qrHint: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  inlinePicker: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inlinePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  inlinePickerTitle: { fontSize: 16, fontWeight: '900' },
  inlinePickerDone: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
});
