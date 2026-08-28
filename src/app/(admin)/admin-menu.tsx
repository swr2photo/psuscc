import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  Users,
  Calendar,
  Bell,
  ShieldCheck,
  BarChart3,
  CheckSquare,
  ChevronRight,
  FileBadge,
  QrCode,
  ClipboardCheck,
  UserCheck,
  Sparkles,
} from 'lucide-react-native';
import { HeaderRight } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { useTheme } from '@/hooks/use-theme';

export default function AdminMenuScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const MENU_GROUPS = [
    {
      title: 'การจัดการกิจกรรม',
      items: [
        {
          label: 'จัดการอีเวนต์',
          sub: 'สร้าง แก้ไข และลบกิจกรรม',
          icon: Calendar,
          color: '#6366f1',
          path: '/(admin)/manage-events',
        },
        {
          label: 'ตรวจสอบการสมัคร',
          sub: 'ยืนยันสลิปและข้อมูลผู้สมัคร',
          icon: CheckSquare,
          color: '#10b981',
          path: '/(admin)/verify-registrations',
        },
        {
          label: 'รายชื่อผู้เข้าร่วม',
          sub: 'ดูข้อมูลและส่งออกไฟล์รายชื่อ',
          icon: Users,
          color: '#3b82f6',
          path: '/(admin)/event-participants',
        },
      ],
    },
    {
      title: 'ระบบเช็กอินด้วย QR',
      items: [
        {
          label: 'จัดการ QR เช็กอิน',
          sub: 'สร้าง QR แต่ละวัน · กำหนดเวลา/พื้นที่',
          icon: QrCode,
          color: '#0ea5e9',
          path: '/(admin)/checkin-sessions',
        },
        {
          label: 'สรุปยอดเช็กอิน',
          sub: 'รายงานต่อวันและรายชื่อผู้เช็กอิน',
          icon: ClipboardCheck,
          color: '#14b8a6',
          path: '/(admin)/checkin-summary',
        },
        {
          label: 'รายชื่อผู้เช็กอิน',
          sub: 'ตามรอบ QR หรือค้นหาทั้งระบบ · กรองค่ายได้',
          icon: UserCheck,
          color: '#22c55e',
          path: '/(admin)/checkin-attendees',
        },
      ],
    },
    {
      title: 'การสื่อสารและระบบ',
      items: [
        {
          label: 'ส่งการแจ้งเตือน',
          sub: 'ส่ง Push Notification ถึงผู้ใช้',
          icon: Bell,
          color: '#f59e0b',
          path: '/(admin)/send-notification',
        },
        {
          label: 'แดชบอร์ดสถิติ',
          sub: 'ดูสรุปภาพรวมและรายได้',
          icon: BarChart3,
          color: '#ec4899',
          path: '/(admin)/dashboard',
        },
        {
          label: 'แก้ไขเกียรติบัตร',
          sub: 'ปรับแต่งดีไซน์เกียรติบัตร',
          icon: FileBadge,
          color: '#8b5cf6',
          path: '/(admin)/certificate-editor',
        },
      ],
    },
    {
      title: 'ร้านค้า',
      items: [
        {
          label: 'จัดการสินค้า',
          sub: 'เพิ่ม แก้ไข คลัง ไซส์ ช่วงขาย',
          icon: Sparkles,
          color: '#db2777',
          path: '/(admin)/manage-shop',
        },
        {
          label: 'คำสั่งซื้อร้านค้า',
          sub: 'เลขพัสดุและสถานะ',
          icon: ClipboardCheck,
          color: '#dd8d50',
          path: '/(admin)/shop-admin-orders',
        },
        {
          label: 'ตั้งค่าขนส่ง / ไปรษณีย์ไทย',
          sub: 'ค่าจัดส่งและ token ติดตามพัสดุ',
          icon: ShieldCheck,
          color: '#7e71da',
          path: '/(admin)/shop-settings',
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.background },
          headerRight: () => <HeaderRight />,
          headerBackButtonDisplayMode: 'minimal',
          headerBackTitle: '',
        }}
      />

      <AppStatusBar />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.welcomeCard,
            { backgroundColor: isDark ? theme.surface : '#0F172A' },
          ]}
        >
          <View style={styles.welcomeHeader}>
            <View style={styles.shieldIcon}>
              <ShieldCheck size={28} color="#FFF" />
            </View>
            <View>
              <Text style={styles.welcomeTitle}>ผู้ดูแลระบบ</Text>
              <Text style={styles.welcomeSub}>จัดการข้อมูลและระบบหลังบ้าน</Text>
            </View>
          </View>
        </View>

        {MENU_GROUPS.map((group, gIdx) => (
          <View key={gIdx} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
              {group.title}
            </Text>
            <View
              style={[
                styles.cardContainer,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              {group.items.map((item, iIdx) => (
                <TouchableOpacity
                  key={iIdx}
                  style={[
                    styles.menuItem,
                    { borderBottomColor: theme.border },
                    iIdx === group.items.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => router.push(item.path as any)}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
                    <item.icon size={22} color={item.color} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.menuSubLabel, { color: theme.mutedForeground }]}>
                      {item.sub}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={theme.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backBtnText, { color: theme.text }]}>กลับไปหน้าหลัก</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  welcomeCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
  },
  welcomeHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  shieldIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  welcomeSub: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardContainer: {
    borderRadius: 28,
    padding: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '800' },
  menuSubLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },

  backBtn: {
    marginTop: 12,
    alignItems: 'center',
    padding: 16,
  },
  backBtnText: { fontWeight: '800', fontSize: 15 },
});
