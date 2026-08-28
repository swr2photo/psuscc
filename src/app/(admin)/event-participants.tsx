import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Activity, Utensils, ChevronRight, Download, Users, Search, ExternalLink, Phone, Mail } from 'lucide-react-native';
import { BackButton } from '@/components/ui/back-button';
import { useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import * as XLSX from 'xlsx';
import { ActionSheet } from '@/components/ui/action-sheet';
import { useTheme } from '@/hooks/use-theme';

export default function EventParticipantsScreen() {
  const router = useRouter();
  const { eventId, eventTitle } = useLocalSearchParams<{ eventId: string; eventTitle: string }>();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'registered' | 'pending'>('all');

  const fetchParticipants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('event_registrations')
      .select(
        `
        *,
        profiles:user_id (
          full_name,
          email,
          phone,
          avatar_url
        )
      `
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      Toast.show({ type: 'error', text1: 'ดึงข้อมูลไม่สำเร็จ', text2: error.message });
    } else {
      setParticipants(data || []);
    }
    setLoading(false);
  };

  const handleExportExcel = () => {
    if (participants.length === 0) {
      Toast.show({ type: 'error', text1: 'ไม่มีข้อมูล', text2: 'ไม่มีรายชื่อผู้สมัครให้ส่งออก' });
      return;
    }

    try {
      const excelData = participants.map((p, index) => ({
        ลำดับ: index + 1,
        'ชื่อ-นามสกุล': p.profiles?.full_name || 'ไม่ระบุ',
        อีเมล: p.profiles?.email || '-',
        เบอร์โทร: p.profiles?.phone || '-',
        สถานะ: p.status === 'registered' ? 'ยืนยันแล้ว' : 'รอตรวจสอบ/ปฏิเสธ',
        มีสลิป: p.slip_url ? 'มี' : 'ไม่มี',
        อาหารที่แพ้: p.allergies || '-',
        โรคประจำตัว: p.medical_notes || '-',
        วันที่สมัคร: new Date(p.created_at).toLocaleString('th-TH'),
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

      if (Platform.OS === 'web') {
        const fileName = `รายชื่อ_${eventTitle || 'กิจกรรม'}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        Toast.show({
          type: 'success',
          text1: 'ดาวน์โหลดสำเร็จ',
          text2: 'ไฟล์ Excel ถูกสร้างเรียบร้อยแล้ว',
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'ขออภัย',
          text2: 'ฟังก์ชันนี้รองรับการใช้งานผ่านเว็บเท่านั้น',
        });
      }
    } catch (error) {
      console.error('Export Error:', error);
      Toast.show({ type: 'error', text1: 'เกิดข้อผิดพลาด', text2: 'ไม่สามารถสร้างไฟล์ได้' });
    }
  };

  useEffect(() => {
    if (eventId) fetchParticipants();
  }, [eventId]);

  const filteredParticipants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      const name = (p.profiles?.full_name || '').toLowerCase();
      const email = (p.profiles?.email || '').toLowerCase();
      const phone = (p.profiles?.phone || '').toLowerCase();
      const matchQ = !q || name.includes(q) || email.includes(q) || phone.includes(q);
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'registered'
            ? p.status === 'registered'
            : p.status !== 'registered';
      return matchQ && matchStatus;
    });
  }, [participants, query, statusFilter]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={() => setSelectedUser(item)}
    >
      <View style={[styles.avatarMini, { backgroundColor: theme.secondary }]}>
        <Text style={[styles.avatarMiniText, { color: theme.text }]}>
          {item.profiles?.full_name?.[0] || '?'}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: theme.text }]}>
          {item.profiles?.full_name || 'ไม่มีชื่อ'}
        </Text>
        <Text style={[styles.cardEmail, { color: theme.mutedForeground }]}>
          {item.profiles?.email || '-'}
        </Text>
        {item.profiles?.phone ? (
          <Text style={[styles.cardPhone, { color: theme.mutedForeground }]}>{item.profiles.phone}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor:
              item.status === 'registered' ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)',
          },
        ]}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: 'bold',
            color: item.status === 'registered' ? '#22C55E' : '#F59E0B',
          }}
        >
          {(item.status || 'UNKNOWN').toUpperCase()}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <BackButton style={styles.backBtn} onPress={() => router.back()} />
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {eventTitle || 'รายชื่อผู้สมัคร'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.mutedForeground }]}>
            ทั้งหมด {participants.length} คน
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: theme.secondary }]}
          onPress={handleExportExcel}
        >
          <Download size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={filteredParticipants}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{ paddingBottom: 12 }}>
              <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Search size={16} color={theme.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="ค้นหาชื่อ / อีเมล / เบอร์"
                  placeholderTextColor={theme.mutedForeground}
                  style={[styles.searchInput, { color: theme.text }]}
                />
              </View>
              <View style={styles.filtersRow}>
                {[
                  { key: 'all', label: 'ทั้งหมด' },
                  { key: 'registered', label: 'ยืนยันแล้ว' },
                  { key: 'pending', label: 'รอตรวจสอบ' },
                ].map((f) => {
                  const active = statusFilter === (f.key as any);
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setStatusFilter(f.key as any)}
                      activeOpacity={0.85}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor: active ? theme.text : theme.surface,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: active ? theme.background : theme.mutedForeground }}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={48} color={theme.mutedForeground} />
              <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                ยังไม่มีผู้สมัครในกิจกรรมนี้
              </Text>
            </View>
          }
        />
      )}

      <ActionSheet
        visible={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="ข้อมูลผู้สมัคร"
      >
        <ScrollView style={styles.modalBody}>
          <View style={styles.profileHeader}>
            <View
              style={[
                styles.avatarLarge,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.avatarLargeText, { color: theme.text }]}>
                {selectedUser?.profiles?.full_name?.[0]}
              </Text>
            </View>
            <Text style={[styles.detailName, { color: theme.text }]}>
              {selectedUser?.profiles?.full_name}
            </Text>
            <Text style={[styles.detailEmail, { color: theme.mutedForeground }]}>
              {selectedUser?.profiles?.email}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
              ข้อมูลค่ายนี้
            </Text>
            <View
              style={[
                styles.infoBox,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <View style={styles.infoRow}>
                <Mail size={18} color={theme.text} />
                <Text style={[styles.infoText, { color: theme.text }]}>
                  อีเมล: {selectedUser?.profiles?.email || '-'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Phone size={18} color={theme.text} />
                <Text style={[styles.infoText, { color: theme.text }]}>
                  เบอร์โทร: {selectedUser?.profiles?.phone || '-'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Utensils size={18} color={theme.text} />
                <Text style={[styles.infoText, { color: theme.text }]}>
                  อาหารที่แพ้: {selectedUser?.allergies || 'ไม่มี'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Activity size={18} color={theme.text} />
                <Text style={[styles.infoText, { color: theme.text }]}>
                  โรคประจำตัว: {selectedUser?.medical_notes || 'ไม่มี'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Users size={18} color={theme.text} />
                <Text style={[styles.infoText, { color: theme.text }]}>
                  สถานะ: {selectedUser?.status || '-'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoText, { color: theme.text }]}>
                  วันที่สมัคร: {selectedUser?.created_at ? new Date(selectedUser.created_at).toLocaleString('th-TH') : '-'}
                </Text>
              </View>
            </View>
          </View>

          {selectedUser?.slip_url && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                หลักฐานการโอนเงิน
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!selectedUser?.slip_url) return;
                  if (Platform.OS === 'web') window.open(selectedUser.slip_url, '_blank');
                }}
                activeOpacity={0.85}
                style={[styles.openSlipBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <ExternalLink size={16} color={theme.text} />
                <Text style={[styles.openSlipText, { color: theme.text }]}>เปิดลิงก์สลิป (เว็บ)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Platform.OS === 'web' ? window.open(selectedUser.slip_url, '_blank') : null
                }
                style={[styles.slipWrapper, { backgroundColor: theme.background }]}
              >
                <Image
                  source={{ uri: selectedUser.slip_url }}
                  style={styles.slipPreview}
                  resizeMode="contain"
                />
                <Text style={[styles.tapToView, { color: theme.text }]}>
                  แตะเพื่อดูรูปขนาดเต็ม
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </ActionSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 12 },
  exportBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  list: { padding: 16, gap: 12 },
  card: {
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarMiniText: { fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: 'bold' },
  cardEmail: { fontSize: 12 },
  cardPhone: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100, gap: 12 },
  emptyText: { fontSize: 16 },
  modalBody: { padding: 24 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  filtersRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterPill: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  profileHeader: { alignItems: 'center', marginBottom: 32 },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  avatarLargeText: { fontSize: 32, fontWeight: 'bold' },
  detailName: { fontSize: 22, fontWeight: 'bold' },
  detailEmail: { fontSize: 14, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  infoBox: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 15 },
  slipWrapper: { width: '100%', borderRadius: 16, overflow: 'hidden', padding: 12 },
  slipPreview: { width: '100%', height: 350 },
  tapToView: { textAlign: 'center', marginTop: 12, fontWeight: 'bold', fontSize: 12 },
  openSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  openSlipText: { fontSize: 13, fontWeight: '800' },
});
