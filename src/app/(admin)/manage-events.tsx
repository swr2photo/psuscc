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
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useActivities, Event } from '@/features/activities/api/useActivities';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  Edit3,
  Trash2,
  Camera,
  Calendar as CalendarIcon,
  ChevronsUpDown,
  Search,
  Users,
  MapPin,
  CircleDollarSign,
  Sparkles,
  X,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ActionSheet } from '@/components/ui/action-sheet';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { HeaderRight } from '@/components/ui/header-right';
import { BlurView } from 'expo-blur';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';

type StatusFilter = 'all' | 'open' | 'closed';

const CARD_GRID_COLUMNS = 3;
const CARD_GRID_GAP = 8;
const LIST_HORIZONTAL_PAD = 16;

/** แปลงค่าวันที่จาก API ให้เป็นสตริง ISO ที่ใช้ในฟอร์มได้ */
function toEditableDateIso(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export default function ManageEventsScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    location?: string;
    locationLat?: string;
    locationLng?: string;
    placeId?: string;
  }>();
  const { width: screenW } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const gridContentW = screenW - LIST_HORIZONTAL_PAD * 2;
  const eventCardWidth =
    (gridContentW - CARD_GRID_GAP * (CARD_GRID_COLUMNS - 1)) / CARD_GRID_COLUMNS;

  const { data: events, isLoading, refetch } = useActivities();
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  /** ให้ showPicker / เปิด Modal ใช้ snapshot ฟอร์มล่าสุดหลังอัปเดตวันที่ (ไม่พึ่ง closure เก่า) */
  const editingEventRef = useRef(editingEvent);
  editingEventRef.current = editingEvent;
  const [isSaving, setIsSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    mode: 'date' | 'time';
    field: string;
  }>({
    visible: false,
    mode: 'date',
    field: '',
  });

  // กันเคสเปิดฟอร์มแล้ว popup ค้างจากครั้งก่อน (โดยเฉพาะ iOS overlay ใน ActionSheet)
  useEffect(() => {
    if (isModalVisible) {
      setPickerConfig({ visible: false, mode: 'date', field: '' });
    }
  }, [isModalVisible]);

  /** ให้ onChange ของ DateTimePicker อ่าน field/mode ล่าสุดเสมอ (กัน stale closure บน iOS) */
  const pickerConfigRef = useRef(pickerConfig);
  pickerConfigRef.current = pickerConfig;

  /**
   * iOS: spinner ใน Modal ซ้อน ActionSheet บางครั้งไม่ sync ค่าเข้า editingEvent จาก onChange เดียวกับ Android
   * — เก็บค่าหมุนใน draft แล้วกด "เสร็จสิ้น" ค่อย commit (แบบ Calendar / ฟอร์มระบบ)
   */
  const [iosPickerDraft, setIosPickerDraft] = useState(() => new Date());
  /** อ่านค่าจากล้อวันที่ตอนกดเสร็จสิ้น — กันค่าใน closure ไม่ตรงกับ state บน iOS */
  const iosPickerDraftRef = useRef<Date>(iosPickerDraft);
  iosPickerDraftRef.current = iosPickerDraft;

  const stats = useMemo(() => {
    const total = events?.length ?? 0;
    const open = events?.filter((e) => e.status === 'open').length ?? 0;
    const closed = total - open;
    return { total, open, closed };
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      const matchSearch =
        !search.trim() ||
        e.title?.toLowerCase().includes(search.trim().toLowerCase()) ||
        e.location?.toLowerCase().includes(search.trim().toLowerCase());
      const matchStatus = statusFilter === 'all' ? true : e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [events, search, statusFilter]);

  // รับค่าจากหน้า pick-location แล้วเติมกลับในฟอร์ม
  useEffect(() => {
    if (!isModalVisible) return;
    const nextLocation = routeParams.location ? String(routeParams.location) : '';
    const nextLat = routeParams.locationLat ? Number(routeParams.locationLat) : NaN;
    const nextLng = routeParams.locationLng ? Number(routeParams.locationLng) : NaN;
    const nextPlaceId = routeParams.placeId ? String(routeParams.placeId) : '';
    if (!nextLocation && !Number.isFinite(nextLat) && !Number.isFinite(nextLng) && !nextPlaceId) return;

    setEditingEvent((prev: any) => ({
      ...(prev || {}),
      ...(nextLocation ? { location: nextLocation } : null),
      ...(Number.isFinite(nextLat) ? { location_lat: nextLat } : null),
      ...(Number.isFinite(nextLng) ? { location_lng: nextLng } : null),
      ...(nextPlaceId ? { location_place_id: nextPlaceId } : null),
    }));

    // ล้าง params เพื่อกันเติมซ้ำตอน rerender
    router.setParams({ location: undefined, locationLat: undefined, locationLng: undefined, placeId: undefined } as any);
  }, [isModalVisible, routeParams.location, routeParams.locationLat, routeParams.locationLng, routeParams.placeId, router]);

  const showPicker = (field: string, mode: 'date' | 'time') => {
    const cur = editingEventRef.current;
    if (Platform.OS === 'ios') {
      const raw = cur?.[field];
      const initial = raw ? new Date(raw) : new Date();
      const next = Number.isNaN(initial.getTime()) ? new Date() : initial;
      iosPickerDraftRef.current = next;
      setIosPickerDraft(next);
    }
    setPickerConfig({ visible: true, mode, field });
  };

  const commitIosPicker = () => {
    const { field, mode } = pickerConfigRef.current;
    if (!field) {
      setPickerConfig((p) => ({ ...p, visible: false }));
      return;
    }
    const d = iosPickerDraftRef.current;
    if (Number.isNaN(d.getTime())) {
      setPickerConfig((p) => ({ ...p, visible: false }));
      return;
    }
    setEditingEvent((prev: any) => {
      const base = prev?.[field] ? new Date(prev[field]) : new Date();
      if (mode === 'date') {
        base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      } else {
        base.setHours(d.getHours(), d.getMinutes(), 0, 0);
      }
      return {
        ...(prev || {}),
        [field]: base.toISOString(),
      };
    });
    setPickerConfig((p) => ({ ...p, visible: false }));
  };

  const dismissIosPicker = () => {
    setPickerConfig((p) => ({ ...p, visible: false }));
  };

  const handleNativeDateChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android' && _event?.type === 'dismissed') {
      setPickerConfig((p) => ({ ...p, visible: false }));
      return;
    }
    if (!date || Number.isNaN(date.getTime())) {
      return;
    }

    const { field, mode } = pickerConfigRef.current;
    if (!field) return;

    setEditingEvent((prev: any) => {
      const base = prev?.[field] ? new Date(prev[field]) : new Date();
      if (mode === 'date') {
        base.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      } else {
        base.setHours(date.getHours(), date.getMinutes(), 0, 0);
      }
      return {
        ...(prev || {}),
        [field]: base.toISOString(),
      };
    });

    if (Platform.OS === 'android' || Platform.OS === 'web') {
      setPickerConfig((p) => ({ ...p, visible: false }));
    }
    // iOS ใช้ commitIosPicker + iosPickerDraft แทน — อย่าปิดปิกเกอร์ที่นี่
  };

  const handleIosSpinnerChange = (_event: unknown, date?: Date) => {
    if (!date || Number.isNaN(date.getTime())) return;
    iosPickerDraftRef.current = date;
    setIosPickerDraft(date);
  };

  const pickImage = async (type: 'cover' | 'detail') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: type === 'cover',
      allowsMultipleSelection: type === 'detail',
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      Toast.show({ type: 'info', text1: 'กำลังอัปโหลดรูปภาพ...' });
      try {
        const uploadedUrls: string[] = [];
        for (const asset of result.assets) {
          if (!asset.base64) continue;
          const filePath = `events/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('certificates')
            .upload(filePath, decode(asset.base64), { contentType: 'image/jpeg' });

          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('certificates').getPublicUrl(filePath);
          uploadedUrls.push(data.publicUrl);
        }

        if (type === 'cover') {
          setEditingEvent((prev: any) => ({ ...prev, cover_url: uploadedUrls[0] }));
        } else {
          setEditingEvent((prev: any) => {
            const currentImages = prev?.detail_images || [];
            return { ...prev, detail_images: [...currentImages, ...uploadedUrls] };
          });
        }
        Toast.show({ type: 'success', text1: `อัปโหลดสำเร็จ ${uploadedUrls.length} รูป` });
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'อัปโหลดล้มเหลว', text2: err.message });
      }
    }
  };

  const handleSave = async () => {
    if (!editingEvent?.title || !editingEvent?.start_date) {
      Toast.show({ type: 'error', text1: 'ข้อมูลไม่ครบ', text2: 'กรุณากรอกชื่อและวันที่จัดงาน' });
      return;
    }
    setIsSaving(true);
    try {
      let maxCheckins: number | null = null;
      const maxStr = String((editingEvent as any).max_checkins_per_user ?? '').trim();
      if (maxStr !== '') {
        const n = parseInt(maxStr, 10);
        if (!Number.isFinite(n) || n < 1) {
          Toast.show({
            type: 'error',
            text1: 'จำนวนครั้งเช็กอินไม่ถูกต้อง',
            text2: 'ใส่ตัวเลข ≥ 1 หรือเว้นว่างหากไม่จำกัด',
          });
          setIsSaving(false);
          return;
        }
        maxCheckins = n;
      }

      const payload = {
        title: editingEvent.title,
        description: editingEvent.description,
        location: editingEvent.location,
        // stop using link-based maps; store real coordinates instead
        map_url: null,
        location_lat: editingEvent.location_lat ?? null,
        location_lng: editingEvent.location_lng ?? null,
        location_place_id: editingEvent.location_place_id ?? null,
        price: Number(editingEvent.price) || 0,
        capacity: Number(editingEvent.capacity) || 0,
        max_checkins_per_user: maxCheckins,
        start_date: editingEvent.start_date,
        end_date: editingEvent.end_date,
        reg_start_date: editingEvent.reg_start_date,
        reg_end_date: editingEvent.reg_end_date,
        cover_url: editingEvent.cover_url,
        detail_images: editingEvent.detail_images || [],
        schedule: editingEvent.schedule || [],
        chat_type: editingEvent.chat_type || 'none',
        chat_link: editingEvent.chat_link || '',
        status: editingEvent.status || 'open',
      };
      const { error } = editingEvent.id
        ? await supabase.from('events').update(payload).eq('id', editingEvent.id)
        : await supabase.from('events').insert([payload]);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'บันทึกสำเร็จ' });
      setIsModalVisible(false);
      refetch();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'ล้มเหลว', text2: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    const performDelete = async () => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (!error) {
        Toast.show({ type: 'success', text1: 'ลบเรียบร้อย' });
        refetch();
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('ลบกิจกรรมนี้?')) performDelete();
    } else {
      Alert.alert('ยืนยันลบ', 'ข้อมูลจะหายถาวร', [
        { text: 'ยกเลิก' },
        { text: 'ลบ', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  const openCreate = () => {
    const now = new Date().toISOString();
    setPickerConfig({ visible: false, mode: 'date', field: '' });
    setEditingEvent({
      schedule: [],
      detail_images: [],
      price: 0,
      capacity: 0,
      status: 'open',
      start_date: now,
      end_date: now,
      reg_start_date: now,
      reg_end_date: now,
      location_lat: null,
      location_lng: null,
      location_place_id: null,
    });
    setIsModalVisible(true);
  };

  const openEdit = (item: Event) => {
    const now = new Date().toISOString();
    const start = toEditableDateIso(item.start_date);
    const end = toEditableDateIso(item.end_date);
    const regS = toEditableDateIso(item.reg_start_date);
    const regE = toEditableDateIso(item.reg_end_date);

    setPickerConfig({ visible: false, mode: 'date', field: '' });
    setEditingEvent({
      ...item,
      start_date: start ?? (item.start_date as string) ?? now,
      end_date: end ?? (item.end_date as string) ?? (start ?? now),
      reg_start_date: regS ?? (item.reg_start_date as string) ?? now,
      reg_end_date: regE ?? (item.reg_end_date as string) ?? (regS ?? now),
      detail_images: (item as any).detail_images || [],
      schedule: item.schedule || [],
      price: item.price ?? 0,
      capacity: item.capacity ?? 0,
      max_checkins_per_user:
        item.max_checkins_per_user != null ? String(item.max_checkins_per_user) : '',
      status: item.status || 'open',
      location_lat: (item as any).location_lat ?? null,
      location_lng: (item as any).location_lng ?? null,
      location_place_id: (item as any).location_place_id ?? null,
    });
    setIsModalVisible(true);
  };

  const formatDate = (iso: string | null | undefined) => {
    if (iso == null || String(iso).trim() === '') return 'ไม่ระบุวันที่';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'ไม่ระบุวันที่';
    try {
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return 'ไม่ระบุวันที่';
    }
  };

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return 'ไม่ระบุวันที่';
    try {
      return new Date(iso).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'วันที่ไม่ถูกต้อง';
    }
  };

  // ---------- Header / List header ----------
  const ListHeader = (
    <View>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={[styles.heroBlobOne, { backgroundColor: isDark ? '#2A2A2A' : '#E0E7FF' }]} />
        <View style={[styles.heroBlobTwo, { backgroundColor: isDark ? '#1F1F1F' : '#F1F5F9' }]} />

        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.mutedForeground }]}>
              ADMIN · MANAGE
            </Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>จัดการค่าย / กิจกรรม</Text>
            <Text style={[styles.heroSub, { color: theme.mutedForeground }]}>
              ดู สร้าง และแก้ไขกิจกรรมทั้งหมดในที่เดียว
            </Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={styles.statsRow}>
          <StatCard
            label="ทั้งหมด"
            value={stats.total}
            tint={isDark ? '#3F3F46' : '#0F172A'}
            theme={theme}
          />
          <StatCard
            label="กำลังเปิด"
            value={stats.open}
            tint="#22C55E"
            theme={theme}
            highlight
          />
          <StatCard
            label="ปิดแล้ว"
            value={stats.closed}
            tint="#F87171"
            theme={theme}
          />
        </View>
      </View>

      {/* Search */}
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
          placeholder="ค้นหาชื่อค่าย หรือสถานที่"
          placeholderTextColor={theme.mutedForeground}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={8}
            style={[styles.searchClear, { backgroundColor: theme.secondary }]}
          >
            <X size={12} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter pills */}
      <View style={styles.filtersRow}>
        {(
          [
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'open', label: 'เปิดอยู่' },
            { key: 'closed', label: 'ปิดแล้ว' },
          ] as { key: StatusFilter; label: string }[]
        ).map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setStatusFilter(f.key)}
              activeOpacity={0.85}
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
      </View>

      <Text style={[styles.listTitle, { color: theme.text }]}>
        รายการทั้งหมด <Text style={{ color: theme.mutedForeground, fontWeight: '600' }}>·  {filteredEvents.length}</Text>
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerRight: () => <HeaderRight />,
        }}
      />
      <AppStatusBar />

      {isLoading && !events ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          numColumns={CARD_GRID_COLUMNS}
          columnWrapperStyle={styles.gridRowWrap}
          contentContainerStyle={[styles.listGrid, { paddingBottom: 80 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
          }
          renderItem={({ item }) => (
            <EventCard
              item={item}
              theme={theme}
              isDark={isDark}
              columnWidth={eventCardWidth}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              onParticipants={() =>
                router.push({
                  pathname: '/(admin)/event-participants',
                  params: { eventId: item.id, eventTitle: item.title },
                })
              }
              formatDate={formatDate}
              formatDateTime={formatDateTime}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Sparkles size={28} color={theme.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>ยังไม่มีกิจกรรม</Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                สร้างกิจกรรมแรกของคุณเพื่อเริ่มจัดการผู้สมัครและเอกสารต่างๆ
              </Text>
              <TouchableOpacity
                onPress={openCreate}
                style={[styles.emptyCta, { backgroundColor: theme.text }]}
                activeOpacity={0.85}
              >
                <Plus size={16} color={theme.background} />
                <Text style={[styles.emptyCtaText, { color: theme.background }]}>สร้างกิจกรรมใหม่</Text>
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
            onPress={() => Alert.alert('Coming Soon', 'Bulk selection mode will be available in a future update.')}
          >
            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 17 }}>เลือก</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
             <Text style={{ color: theme.mutedForeground, fontSize: 13, fontWeight: '500' }}>
               {filteredEvents.length} กิจกรรม
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

      {/* ---------- Edit Modal ---------- */}
      <ActionSheet
        visible={isModalVisible}
        onClose={() => {
          setPickerConfig({ visible: false, mode: 'date', field: '' });
          setIsModalVisible(false);
        }}
        title={editingEvent?.id ? 'แก้ไขข้อมูลค่าย' : 'สร้างค่ายใหม่'}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 20 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
          <Text style={[styles.modalSectionTitle, { color: theme.text }]}>รูปปกค่าย (16:9)</Text>
          <TouchableOpacity
            style={[
              styles.coverPicker,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => pickImage('cover')}
          >
            {editingEvent?.cover_url ? (
              <Image source={{ uri: editingEvent.cover_url }} style={styles.imageFull} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Camera size={28} color={theme.mutedForeground} />
                <Text style={[styles.imageLabel, { color: theme.mutedForeground }]}>
                  อัปโหลดรูปปก
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.label, { color: theme.mutedForeground }]}>ชื่อค่าย/กิจกรรม *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholderTextColor={theme.mutedForeground}
            value={editingEvent?.title || ''}
            onChangeText={(t) => setEditingEvent((prev: any) => ({ ...prev, title: t }))}
          />

          <Text style={[styles.label, { color: theme.mutedForeground }]}>รายละเอียดกิจกรรม</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
                height: 100,
                textAlignVertical: 'top',
              },
            ]}
            placeholderTextColor={theme.mutedForeground}
            multiline
            value={editingEvent?.description || ''}
            onChangeText={(t) => setEditingEvent((prev: any) => ({ ...prev, description: t }))}
            placeholder="ระบุเนื้อหาหลักของค่าย..."
          />

          <Text style={[styles.label, { color: theme.mutedForeground }]}>สถานที่จัดค่าย</Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                justifyContent: 'center',
              },
            ]}
            activeOpacity={0.8}
            onPress={() =>
              router.push({
                pathname: '/(admin)/pick-location',
                params: {
                  initial: editingEvent?.location || '',
                  returnTo: '/(admin)/manage-events',
                },
              })
            }
          >
            <Text style={{ color: editingEvent?.location ? theme.text : theme.mutedForeground, fontWeight: '600' }}>
              {editingEvent?.location || 'แตะเพื่อเลือกสถานที่'}
            </Text>
            {Number.isFinite(Number(editingEvent?.location_lat)) && Number.isFinite(Number(editingEvent?.location_lng)) ? (
              <Text style={{ color: theme.mutedForeground, fontWeight: '600', marginTop: 6, fontSize: 12 }}>
                พิกัด: {Number(editingEvent.location_lat).toFixed(5)}, {Number(editingEvent.location_lng).toFixed(5)}
              </Text>
            ) : null}
          </TouchableOpacity>

          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            เลือกจากแผนที่จริง (ค้นหา + ปักหมุด) แล้วระบบจะเก็บ lat/lng และ place_id
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.mutedForeground }]}>ราคา (บาท)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                keyboardType="numeric"
                placeholderTextColor={theme.mutedForeground}
                value={editingEvent?.price?.toString() || ''}
                onChangeText={(t) => setEditingEvent((prev: any) => ({ ...prev, price: t }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.mutedForeground }]}>จำนวนรับ (คน)</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                keyboardType="numeric"
                placeholderTextColor={theme.mutedForeground}
                value={editingEvent?.capacity?.toString() || ''}
                onChangeText={(t) => setEditingEvent((prev: any) => ({ ...prev, capacity: t }))}
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.modalSectionTitle, { color: theme.text }]}>รูปรายละเอียดค่าย</Text>
          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            ใส่รูปบรรยากาศ/ตารางกิจกรรม/รายละเอียด (หลายรูปได้)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 8, paddingRight: 10 }}
          >
            <TouchableOpacity
              onPress={() => pickImage('detail')}
              activeOpacity={0.85}
              style={[
                styles.detailAddTile,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel="เพิ่มรูปรายละเอียด"
            >
              <Plus size={22} color={theme.mutedForeground} />
              <Text style={[styles.detailAddText, { color: theme.mutedForeground }]}>เพิ่มรูป</Text>
            </TouchableOpacity>

            {(editingEvent?.detail_images || []).map((url: string, idx: number) => (
              <View key={`${url}-${idx}`} style={styles.detailImgWrap}>
                <Image source={{ uri: url }} style={styles.detailImg} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() =>
                    setEditingEvent((prev: any) => {
                      const cur = (prev?.detail_images || []) as string[];
                      return { ...prev, detail_images: cur.filter((_: string, i: number) => i !== idx) };
                    })
                  }
                  activeOpacity={0.85}
                  style={[styles.detailRemoveBtn, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
                  accessibilityRole="button"
                  accessibilityLabel="ลบรูป"
                >
                  <X size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: theme.mutedForeground }]}>
            จำกัดเช็กอินต่อคน (ครั้งในค่ายนี้)
          </Text>
          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            นับรวมทุกรอบ QR ของค่ายนี้ · เว้นว่าง = ไม่จำกัดจำนวนครั้ง
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            keyboardType="numeric"
            placeholder="เช่น 5 (เว้นว่าง = ไม่จำกัด)"
            placeholderTextColor={theme.mutedForeground}
            value={String((editingEvent as any)?.max_checkins_per_user ?? '')}
            onChangeText={(t) =>
              setEditingEvent((prev: any) => ({ ...prev, max_checkins_per_user: t as any }))
            }
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.modalSectionTitle, { color: theme.text }]}>ระยะเวลาสมัคร</Text>
          <View
            style={[
              styles.dateGroupedCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <AdminDatePopupRow
              label="เริ่มรับสมัคร"
              value={editingEvent?.reg_start_date}
              onPress={() => showPicker('reg_start_date', 'date')}
              theme={theme}
              format={formatDate}
              isLast={false}
            />
            <AdminDatePopupRow
              label="ปิดรับสมัคร"
              value={editingEvent?.reg_end_date}
              onPress={() => showPicker('reg_end_date', 'date')}
              theme={theme}
              format={formatDate}
              isLast
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.modalSectionTitle, { color: theme.text }]}>ช่วงเวลาจัดงาน</Text>
          <View
            style={[
              styles.dateGroupedCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <AdminDatePopupRow
              label="วันเริ่มงาน"
              value={editingEvent?.start_date}
              onPress={() => showPicker('start_date', 'date')}
              theme={theme}
              format={formatDate}
              isLast={false}
            />
            <AdminDatePopupRow
              label="วันจบงาน"
              value={editingEvent?.end_date}
              onPress={() => showPicker('end_date', 'date')}
              theme={theme}
              format={formatDate}
              isLast
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtnFull, { backgroundColor: theme.text }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <Text style={[styles.saveText, { color: theme.background }]}>บันทึกข้อมูลทั้งหมด</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 100 }} />
          </ScrollView>

          {/* iOS: render picker overlay INSIDE ActionSheet (avoid Modal-on-Modal issues) */}
          {Platform.OS === 'ios' && pickerConfig.visible ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View style={styles.iosPickerContainer}>
                <BlurView
                  intensity={isDark ? 60 : 90}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  onPress={dismissIosPicker}
                  accessibilityLabel="ปิด"
                />
                <View style={[styles.iosPickerContent, { backgroundColor: theme.surface }]}>
                  <View style={[styles.iosPickerHeader, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.iosPickerTitle, { color: theme.text }]}>
                      {pickerConfig.mode === 'date' ? 'เลือกวันที่' : 'เลือกเวลา'}
                    </Text>
                    <TouchableOpacity
                      onPress={commitIosPicker}
                      style={[styles.iosPickerDoneBtn, { backgroundColor: theme.text }]}
                      accessibilityLabel="ยืนยันวันที่"
                    >
                      <Text style={[styles.iosPickerDoneText, { color: theme.background }]}>
                        เสร็จสิ้น
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <DateTimePicker
                    value={iosPickerDraft}
                    mode={pickerConfig.mode as any}
                    is24Hour={true}
                    display="spinner"
                    themeVariant={isDark ? 'dark' : 'light'}
                    onChange={handleIosSpinnerChange}
                    style={styles.iosPicker}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ActionSheet>

      {/* --- Android & Web: system / inline picker --- */}
      {(Platform.OS === 'android' || Platform.OS === 'web') && pickerConfig.visible && (
        <DateTimePicker
          value={
            editingEvent && pickerConfig.field && editingEvent[pickerConfig.field]
              ? new Date(editingEvent[pickerConfig.field])
              : new Date()
          }
          mode={pickerConfig.mode as any}
          is24Hour={true}
          onChange={handleNativeDateChange}
        />
      )}

    </View>
  );
}

// =====================================================
// Subcomponents
// =====================================================

function StatCard({
  label,
  value,
  tint,
  theme,
  highlight,
}: {
  label: string;
  value: number;
  tint: string;
  theme: typeof Colors.light;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.statDot, { backgroundColor: tint }]} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>{label}</Text>
      {highlight && <View style={[styles.statRing, { borderColor: tint }]} />}
    </View>
  );
}

/**
 * Apple HIG–style pop-up row: leading label, trailing value + chevrons (cf. Pop-up buttons).
 * @see https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons
 */
function AdminDatePopupRow({
  label,
  value,
  onPress,
  theme,
  format,
  isLast,
}: {
  label: string;
  value?: string | null;
  onPress: () => void;
  theme: typeof Colors.light;
  format: (iso: string | null | undefined) => string;
  isLast: boolean;
}) {
  const raw = value == null ? '' : String(value).trim();
  const hasValue = raw.length > 0;
  const formatted = hasValue ? format(raw) : '';
  const isPlaceholder = !hasValue || formatted === 'ไม่ระบุวันที่';
  const display = isPlaceholder ? 'เลือกวันที่' : formatted;

  return (
    <>
      <TouchableOpacity
        style={styles.datePopupRow}
        onPress={onPress}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
      >
        <Text style={[styles.datePopupLabel, { color: theme.text }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.datePopupTrailing}>
          <Text
            style={[
              styles.datePopupValue,
              {
                color: isPlaceholder ? theme.mutedForeground : theme.text,
                fontWeight: isPlaceholder ? '500' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {display}
          </Text>
          <ChevronsUpDown size={16} color={theme.mutedForeground} strokeWidth={2.25} />
        </View>
      </TouchableOpacity>
      {!isLast ? <View style={[styles.datePopupSeparator, { backgroundColor: theme.border }]} /> : null}
    </>
  );
}

function EventCard({
  item,
  theme,
  isDark,
  columnWidth,
  onEdit,
  onDelete,
  onParticipants,
  formatDate,
  formatDateTime,
}: {
  item: Event;
  theme: typeof Colors.light;
  isDark: boolean;
  columnWidth: number;
  onEdit: () => void;
  onDelete: () => void;
  onParticipants: () => void;
  formatDate: (iso: string | null | undefined) => string;
  formatDateTime: (iso: string | null | undefined) => string;
}) {
  const isOpen = item.status === 'open';
  const statusColor = isOpen ? '#22C55E' : '#F87171';
  const statusLabel = isOpen ? 'เปิด' : 'ปิด';
  const coverH = Math.max(76, Math.round(columnWidth * 0.56));

  return (
    <View
      style={[
        styles.cardGrid,
        {
          width: columnWidth,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Cover */}
      <View style={styles.coverWrap}>
        {item.cover_url ? (
          <Image
            source={{ uri: item.cover_url }}
            style={[styles.cardCoverGrid, { height: coverH }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.cardCoverGrid,
              {
                height: coverH,
                backgroundColor: isDark ? '#262626' : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Sparkles size={20} color={theme.mutedForeground} />
          </View>
        )}

        {/* Status */}
        <View
          style={[
            styles.statusBadgeGrid,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.93)' },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text
            style={[
              styles.statusTextGrid,
              { color: isDark ? '#F5F5F5' : '#0F172A' },
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Body — compact */}
      <View style={styles.cardBodyGrid}>
        <Text style={[styles.cardTitleGrid, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.metaRowGrid}>
          <CalendarIcon size={10} color={theme.mutedForeground} />
          <Text style={[styles.metaTextGrid, { color: theme.mutedForeground }]} numberOfLines={1}>
            {formatDate(item.start_date)}
          </Text>
        </View>

        <View style={styles.metaRowGrid}>
          <Users size={10} color={theme.mutedForeground} />
          <Text style={[styles.metaTextGrid, { color: theme.mutedForeground }]} numberOfLines={1}>
            {(item.current_participants ?? 0)}/{item.capacity ?? 0}
          </Text>
        </View>
        <View style={styles.metaRowGrid}>
          <CircleDollarSign size={10} color={theme.mutedForeground} />
          <Text style={[styles.metaTextGrid, { color: theme.mutedForeground }]} numberOfLines={1}>
            {item.price && item.price > 0 ? `฿${item.price}` : 'ฟรี'}
          </Text>
        </View>

        {item.location ? (
          <View style={styles.metaRowGrid}>
            <MapPin size={10} color={theme.mutedForeground} />
            <Text style={[styles.metaTextGrid, { color: theme.mutedForeground }]} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.regHintGrid, { color: theme.mutedForeground }]} numberOfLines={1}>
          ปิดสมัคร {formatDateTime(item.reg_end_date)}
        </Text>
      </View>

      {/* Actions — icon row */}
      <View style={[styles.cardActionsGrid, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.actionIconBtn, { backgroundColor: theme.text }]}
          onPress={onParticipants}
          activeOpacity={0.85}
          accessibilityLabel="ผู้เข้าร่วม"
        >
          <Users size={15} color={theme.background} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionIconBtn, { backgroundColor: theme.secondary, borderColor: theme.border, borderWidth: 1 }]}
          onPress={onEdit}
          activeOpacity={0.85}
          accessibilityLabel="แก้ไข"
        >
          <Edit3 size={15} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionIconBtn, { backgroundColor: 'rgba(248,113,113,0.14)' }]}
          onPress={onDelete}
          activeOpacity={0.85}
          accessibilityLabel="ลบ"
        >
          <Trash2 size={15} color="#F87171" />
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
  /** กริด 3 คอลัมน์ — ช่องว่างแนวนอนอยู่ใน `columnWrapperStyle` */
  listGrid: {
    paddingHorizontal: LIST_HORIZONTAL_PAD,
    paddingBottom: 140,
    paddingTop: 0,
  },
  gridRowWrap: {
    gap: CARD_GRID_GAP,
    marginBottom: CARD_GRID_GAP,
    justifyContent: 'flex-start',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  hero: {
    paddingTop: 4,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  heroBlobOne: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.6,
  },
  heroBlobTwo: {
    position: 'absolute',
    top: 60,
    left: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.6,
  },
  heroRow: {
    paddingTop: 6,
    paddingBottom: 18,
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
  heroSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
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

  // Search
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
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filters
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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

  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 6,
    letterSpacing: -0.2,
  },

  // Event grid card (3 / row)
  cardGrid: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  coverWrap: { position: 'relative' },
  cardCoverGrid: { width: '100%' },
  statusBadgeGrid: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '88%',
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusTextGrid: { fontSize: 9, fontWeight: '900', letterSpacing: 0.2 },

  cardBodyGrid: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6, gap: 4 },
  cardTitleGrid: { fontSize: 11, fontWeight: '800', letterSpacing: -0.2, lineHeight: 14, minHeight: 28 },
  metaRowGrid: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTextGrid: { fontSize: 9, fontWeight: '700', flexShrink: 1 },
  regHintGrid: { fontSize: 8, fontWeight: '700', marginTop: 2 },

  cardActionsGrid: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  actionIconBtn: {
    flex: 1,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Modal
  modalSectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  coverPicker: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 2,
    overflow: 'hidden',
    marginTop: 12,
  },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  imageLabel: { fontSize: 12, fontWeight: '800' },
  imageFull: { width: '100%', height: '100%' },
  label: { fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 6 },
  hint: { fontSize: 12, fontWeight: '600', marginBottom: 8, lineHeight: 17 },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: { height: 1, marginVertical: 22 },
  /** Grouped list container — inset grouped style (cf. iOS Form / Calendar). */
  dateGroupedCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  datePopupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  datePopupLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    paddingRight: 12,
  },
  datePopupTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '52%',
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  datePopupValue: {
    fontSize: 17,
    textAlign: 'right',
    flexShrink: 1,
  },
  datePopupSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },

  detailAddTile: {
    width: 92,
    height: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailAddText: { fontSize: 12, fontWeight: '800' },
  detailImgWrap: {
    width: 92,
    height: 92,
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailImg: { width: '100%', height: '100%' },
  detailRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnFull: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  saveText: { fontSize: 15, fontWeight: '900' },

  // iOS Picker Modal
  iosPickerContainer: { flex: 1, justifyContent: 'flex-end' },
  iosPickerContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 22,
    borderBottomWidth: 1,
  },
  iosPickerTitle: { fontSize: 17, fontWeight: '900' },
  iosPickerDoneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  iosPickerDoneText: { fontWeight: '900', fontSize: 14 },
  iosPicker: { height: 250, width: '100%' },
});
