import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  Check,
  X,
  ExternalLink,
  User,
  Mail,
  Activity,
  Utensils,
  ChevronRight,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { notifyUser } from '@/lib/notifications';
import { ActionSheet } from '@/components/ui/action-sheet';
import { HeaderRight } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { isTablet } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';

const VERIFY_LIST_PAD = 32;
const VERIFY_COL_GAP = 12;

export default function VerifyRegistrationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const verifyCardW = useMemo(() => {
    if (!isTablet) return undefined;
    return (windowWidth - VERIFY_LIST_PAD - VERIFY_COL_GAP * 2) / 3;
  }, [windowWidth]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReg, setSelectedReg] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchRegistrations = async (mode: 'initial' | 'pull' | 'silent' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'pull') setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('event_registrations')
        .select(
          `
        *,
        events ( title )
      `
        )
        .order('created_at', { ascending: false });

      if (error) {
        Toast.show({ type: 'error', text1: 'ดึงข้อมูลไม่สำเร็จ', text2: error.message });
      } else if (data) {
        const registrationsWithProfiles = await Promise.all(
          data.map(async (reg) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('prefix, first_name, last_name, full_name, email')
              .eq('id', reg.user_id)
              .single();

            return {
              ...reg,
              profiles: profile || {
                full_name: 'ยังไม่ได้ตั้งชื่อ',
                email: 'กำลังตรวจสอบ...',
                first_name: '',
                last_name: '',
                prefix: '',
              },
            };
          })
        );
        setRegistrations(registrationsWithProfiles);
      }
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'pull') setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRegistrations('initial');
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!selectedReg) return;
    setIsUpdating(true);
    const { error } = await supabase
      .from('event_registrations')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      Toast.show({ type: 'error', text1: 'ล้มเหลว', text2: error.message });
    } else {
      const eventTitle = selectedReg.events?.title || 'กิจกรรม';
      let title = '';
      let body = '';
      let type = 'info';

      if (newStatus === 'registered') {
        title = 'การสมัครกิจกรรมสำเร็จ!';
        body = `การสมัครกิจกรรม "${eventTitle}" ของคุณได้รับการอนุมัติแล้ว`;
        type = 'success';
      } else if (newStatus === 'rejected') {
        title = 'การสมัครกิจกรรมไม่สำเร็จ';
        body = `การสมัครกิจกรรม "${eventTitle}" ของคุณไม่ได้รับการอนุมัติ กรุณาตรวจสอบหลักฐานการโอนเงินอีกครั้ง`;
        type = 'error';
      }

      if (title) {
        await notifyUser(selectedReg.user_id, title, body, {
          type,
          event_id: selectedReg.event_id,
        });
      }

      Toast.show({ type: 'success', text1: 'สำเร็จ', text2: `ปรับสถานะเป็น ${newStatus} แล้ว` });
      setSelectedReg(null);
      fetchRegistrations('silent');
    }
    setIsUpdating(false);
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const fullName = reg.profiles?.full_name?.toLowerCase() || '';
    const email = reg.profiles?.email?.toLowerCase() || '';
    const eventTitle = reg.events?.title?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query) || eventTitle.includes(query);
  });

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        verifyCardW != null ? { width: verifyCardW } : { width: '100%' },
      ]}
      onPress={() => setSelectedReg(item)}
    >
      <View
        style={[
          styles.statusBadge,
          item.status === 'registered' ? styles.statusSuccess : styles.statusPending,
        ]}
      >
        <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
      </View>
      <View style={styles.cardMain}>
        <Text style={styles.cardTitle}>{item.events?.title}</Text>
        <Text style={[styles.cardUser, { color: theme.text }]}>{item.profiles?.full_name}</Text>
        <Text style={[styles.cardEmail, { color: theme.mutedForeground }]}>
          {item.profiles?.email}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: 'ตรวจสอบการสมัคร',
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.background },
          headerRight: () => <HeaderRight />,
          headerSearchBarOptions: {
            placeholder: 'ค้นหาชื่อ หรือกิจกรรม...',
            onChangeText: (event) => setSearchQuery(event.nativeEvent.text),
          },
        }}
      />

      <AppStatusBar />

      <View style={styles.contentMaxWidth}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.text} />
          </View>
        ) : (
          <FlatList
            data={filteredRegistrations}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            numColumns={isTablet ? 3 : 1}
            key={isTablet ? 'tablet-3' : 'mobile'}
            columnWrapperStyle={isTablet ? { gap: VERIFY_COL_GAP } : undefined}
            onRefresh={() => fetchRegistrations('pull')}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.empty, { color: theme.mutedForeground }]}>
                  ไม่พบข้อมูลการสมัคร
                </Text>
                <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                  ลองปรับปรุงคำค้นหาใหม่ดูนะครับ
                </Text>
              </View>
            }
          />
        )}
      </View>

      <ActionSheet
        visible={!!selectedReg}
        onClose={() => setSelectedReg(null)}
        title="รายละเอียดการสมัคร"
      >
        <View style={styles.modalContentWrapper}>
          <ScrollView style={{ padding: 24 }}>
            <View style={styles.detailSection}>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                ข้อมูลส่วนตัว
              </Text>
              <View style={styles.detailRow}>
                <User size={18} color={theme.mutedForeground} />
                <Text style={[styles.detailText, { color: theme.text }]}>
                  {selectedReg?.profiles?.full_name}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Mail size={18} color={theme.mutedForeground} />
                <Text style={[styles.detailText, { color: theme.text }]}>
                  {selectedReg?.profiles?.email}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                ข้อมูลสุขภาพ
              </Text>
              <View style={styles.detailRow}>
                <Utensils size={18} color={theme.mutedForeground} />
                <Text style={[styles.detailText, { color: theme.text }]}>
                  อาหารที่แพ้: {selectedReg?.allergies || '-'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Activity size={18} color={theme.mutedForeground} />
                <Text style={[styles.detailText, { color: theme.text }]}>
                  โรคประจำตัว: {selectedReg?.medical_notes || '-'}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                หลักฐานการชำระเงิน
              </Text>
              {selectedReg?.slip_url ? (
                <View style={[styles.slipContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Image
                    source={{ uri: selectedReg.slip_url }}
                    style={styles.slipImg}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={styles.externalBtn}
                    onPress={() => {
                      if (selectedReg?.slip_url) {
                        Platform.OS === 'web'
                          ? window.open(selectedReg.slip_url, '_blank')
                          : Alert.alert('เปิดลิงก์', selectedReg.slip_url);
                      }
                    }}
                  >
                    <ExternalLink size={16} color="#3B82F6" />
                    <Text style={styles.externalText}>ดูรูปขนาดเต็ม</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.noSlip, { color: theme.mutedForeground }]}>
                  ไม่ได้แนบสลิป (กิจกรรมฟรี)
                </Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.approveBtn, isUpdating && { opacity: 0.5 }]}
                onPress={() => selectedReg?.id && handleUpdateStatus(selectedReg.id, 'registered')}
                disabled={isUpdating}
              >
                <Check size={20} color="#FFF" />
                <Text style={styles.btnText}>อนุมัติ (สำเร็จ)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rejectBtn, isUpdating && { opacity: 0.5 }]}
                onPress={() => selectedReg?.id && handleUpdateStatus(selectedReg.id, 'rejected')}
                disabled={isUpdating}
              >
                <X size={20} color="#FFF" />
                <Text style={styles.btnText}>ปฏิเสธ (สลิปผิด)</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 50 }} />
          </ScrollView>
        </View>
      </ActionSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  contentMaxWidth: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: isTablet ? 12 : 0,
  },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#6366f1', marginBottom: 2 },
  cardUser: { fontSize: 18, fontWeight: '900' },
  cardEmail: { fontSize: 14, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 12 },
  statusSuccess: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF9C3' },
  statusText: { fontSize: 12, fontWeight: '900', color: '#166534' },
  detailSection: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  detailText: { fontSize: 17, fontWeight: '600' },
  slipContainer: {
    width: '100%',
    height: 350,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  slipImg: { width: '100%', height: '100%' },
  externalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderRadius: 12,
  },
  externalText: { fontSize: 13, color: '#3B82F6', fontWeight: '900' },
  noSlip: { fontStyle: 'italic', fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  empty: { fontSize: 20, fontWeight: '900' },
  emptySub: { fontSize: 16, marginTop: 6, fontWeight: '600' },
  modalContentWrapper: { width: '100%', maxWidth: 600, alignSelf: 'center' },
});
