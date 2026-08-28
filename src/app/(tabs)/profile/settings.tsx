import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  UserCircle,
  Bookmark,
  Archive,
  Activity,
  Bell,
  Clock,
  ShoppingBag,
  LayoutDashboard,
  LifeBuoy,
  Shield,
  Info,
  Globe,
  QrCode,
  History,
  Lock,
  CreditCard,
  ShieldCheck,
  Moon,
  Mail,
  Star,
  LogOut,
  ScanFace,
  Fingerprint,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AppTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { changeLanguage as updateLang } from '@/lib/i18n';
import Toast from 'react-native-toast-message';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import {
  enableBiometric,
  getBiometricStatus,
  getBiometricType,
  isBiometricSupported,
} from '@/lib/biometrics';

const PAGE_BG_LIGHT = '#FAFAFA';
const ADMIN_EMAILS = ['doralaikon.th@gmail.com'];

function SettingsSection({
  theme,
  title,
  right,
  sectionGap,
  children,
}: {
  theme: AppTheme;
  title: string;
  right?: React.ReactNode;
  sectionGap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: sectionGap ? 8 : 0 }}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{title}</Text>
        {right}
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  );
}

type RowIcon = typeof UserCircle;

type SettingsRowData = {
  id: string;
  icon: RowIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  rightHint?: string;
  badge?: boolean;
};

function SettingsRow({
  theme,
  icon: Icon,
  title,
  subtitle,
  onPress,
  isLast,
  rightHint,
  badge,
}: {
  theme: AppTheme;
  icon: RowIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  isLast?: boolean;
  rightHint?: string;
  badge?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.secondary }]}>
        <Icon size={22} color={theme.text} strokeWidth={2} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleRow}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
          {badge ? <View style={styles.dot} /> : null}
        </View>
        {subtitle ? <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {rightHint ? <Text style={[styles.rowHint, { color: theme.mutedForeground }]}>{rightHint}</Text> : null}
      <ChevronRight size={20} color={theme.mutedForeground} />
    </TouchableOpacity>
  );
}

function SettingsSwitchRow({
  theme,
  icon: Icon,
  title,
  subtitle,
  value,
  onValueChange,
  isLast,
}: {
  theme: AppTheme;
  icon: RowIcon;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.secondary }]}>
        <Icon size={22} color={theme.text} strokeWidth={2} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { t, i18n } = useTranslation();

  const [query, setQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [isBiometricSupportedState, setIsBiometricSupportedState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: row } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (cancelled) return;
      const emailAdmin = ADMIN_EMAILS.includes(user.email || '');
      setIsAdmin(row?.role === 'admin' || emailAdmin);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkBiometrics = async () => {
    const supported = await isBiometricSupported();
    setIsBiometricSupportedState(supported);
    if (supported) {
      const type = await getBiometricType();
      setBiometricType(type);
      const status = await getBiometricStatus();
      setBiometricEnabled(status);
    }
  };

  useEffect(() => {
    checkBiometrics();
  }, []);

  const toggleBiometric = async (value: boolean) => {
    try {
      await enableBiometric(value);
      setBiometricEnabled(value);
      Toast.show({
        type: 'success',
        text1: value ? 'เปิดใช้งานความปลอดภัยสำเร็จ' : 'ปิดใช้งานความปลอดภัยแล้ว',
      });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: e instanceof Error ? e.message : 'ไม่สามารถเปลี่ยนค่าการตั้งค่าได้',
      });
    }
  };

  const handleLanguageToggle = async () => {
    const newLang = i18n.language === 'th' ? 'en' : 'th';
    await updateLang(newLang);
    Toast.show({
      type: 'success',
      text1: newLang === 'en' ? 'Switched to English' : 'เปลี่ยนเป็นภาษาไทยแล้ว',
    });
  };

  const q = query.trim().toLowerCase();
  const matches = (r: SettingsRowData) =>
    !q || r.title.toLowerCase().includes(q) || (r.subtitle?.toLowerCase().includes(q) ?? false);

  const keywordMatch = (words: string[]) =>
    !q || words.some((w) => w.toLowerCase().includes(q) || q.includes(w.toLowerCase().slice(0, 4)));

  const accountCenterRows: SettingsRowData[] = useMemo(
    () => [
      {
        id: 'center',
        icon: UserCircle,
        title: 'ศูนย์บัญชี',
        subtitle: 'รหัสผ่าน ความปลอดภัย ข้อมูลส่วนตัว การเชื่อมต่อ',
        onPress: () => router.push('/complete-profile'),
      },
    ],
    [router],
  );

  const myAccountRows: SettingsRowData[] = useMemo(
    () => [
      {
        id: 'history',
        icon: History,
        title: t('profile.history') || 'ประวัติกิจกรรม',
        onPress: () => router.push('/my-activities'),
      },
      {
        id: 'password',
        icon: Lock,
        title: t('profile.change_password') || 'เปลี่ยนรหัสผ่าน',
        onPress: () =>
          Toast.show({
            type: 'info',
            text1: 'ฟีเจอร์นี้กำลังมาเร็วๆ นี้',
            text2: 'กรุณาตรวจสอบการตั้งค่าอีเมลของคุณ',
          }),
      },
      {
        id: 'pay',
        icon: CreditCard,
        title: 'การชำระเงิน',
        subtitle: 'พร้อมเพย์',
        onPress: () => Toast.show({ type: 'info', text1: 'การชำระเงิน', text2: 'เร็วๆ นี้' }),
      },
      {
        id: 'privacy_acc',
        icon: ShieldCheck,
        title: 'ความเป็นส่วนตัว',
        onPress: () => Toast.show({ type: 'info', text1: 'ความเป็นส่วนตัว', text2: 'เร็วๆ นี้' }),
      },
    ],
    [router, t],
  );

  const adminRows: SettingsRowData[] = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        id: 'adm_dash',
        icon: LayoutDashboard,
        title: 'Admin Dashboard',
        onPress: () => router.push('/(admin)/dashboard'),
      },
      {
        id: 'adm_menu',
        icon: ShieldCheck,
        title: 'Admin Menu',
        onPress: () => router.push('/(admin)/admin-menu'),
      },
    ];
  }, [isAdmin, router]);

  const useRows: SettingsRowData[] = useMemo(
    () => [
      {
        id: 'saved',
        icon: Bookmark,
        title: 'ที่บันทึกไว้',
        subtitle: 'กิจกรรมและเนื้อหาที่คุณบันทึก',
        onPress: () => router.push('/my-activities'),
      },
      {
        id: 'archive',
        icon: Archive,
        title: 'คลัง',
        subtitle: 'กิจกรรมที่เสร็จแล้วและเก็บถาวร',
        onPress: () => router.push('/my-activities'),
      },
      {
        id: 'activity',
        icon: Activity,
        title: 'กิจกรรมของคุณ',
        subtitle: 'การโต้ตอบ การสมัคร และประวัติ',
        onPress: () => router.push('/my-activities'),
      },
      {
        id: 'notif_page',
        icon: Bell,
        title: 'จัดการการแจ้งเตือน',
        onPress: () => router.push('/notifications'),
      },
      {
        id: 'time',
        icon: Clock,
        title: 'การจัดการเวลาใช้แอป',
        onPress: () =>
          Alert.alert(
            'การจัดการเวลา',
            'ตั้งค่า Screen Time หรือการแจ้งเตือนได้จากการตั้งค่าของเครื่อง',
          ),
      },
      {
        id: 'store',
        icon: ShoppingBag,
        title: 'ร้านค้า PSUSCC',
        onPress: () => router.push('/(tabs)/store'),
      },
    ],
    [router],
  );

  const supportRows: SettingsRowData[] = useMemo(
    () => [
      {
        id: 'contact',
        icon: Mail,
        title: 'ติดต่อทีมงาน',
        onPress: () => Toast.show({ type: 'info', text1: 'ติดต่อทีมงาน PSUSCC' }),
      },
      {
        id: 'rate',
        icon: Star,
        title: 'คะแนนแอป',
        onPress: () => Toast.show({ type: 'info', text1: 'ขอบคุณสำหรับการให้คะแนน', text2: 'เร็วๆ นี้' }),
      },
    ],
    [],
  );

  const helpRows: SettingsRowData[] = useMemo(
    () => [
      {
        id: 'help',
        icon: LifeBuoy,
        title: 'ความช่วยเหลือ',
        onPress: () => Toast.show({ type: 'info', text1: 'ติดต่อทีมงาน PSUSCC' }),
      },
      {
        id: 'privacy',
        icon: Shield,
        title: 'ศูนย์ความเป็นส่วนตัว',
        onPress: () =>
          Toast.show({ type: 'info', text1: 'นโยบายความเป็นส่วนตัว', text2: 'เร็วๆ นี้' }),
      },
      {
        id: 'about',
        icon: Info,
        title: 'เกี่ยวกับ',
        subtitle: 'PSUSCC App',
        onPress: () =>
          Alert.alert('PSUSCC', 'แอปพลิเคชันสำหรับนักศึกษาและชุมชน PSUSCC', [{ text: 'ตกลง' }]),
      },
    ],
    [],
  );

  const moreRows: SettingsRowData[] = useMemo(
    () => [
      {
        id: 'scanner',
        icon: QrCode,
        title: 'สแกน QR เช็กอิน',
        onPress: () => router.push('/checkin-scanner'),
      },
    ],
    [router],
  );

  const filterList = (rows: SettingsRowData[]) => rows.filter(matches);

  const mergedAccount = useMemo(() => {
    return [...accountCenterRows, ...myAccountRows].filter(matches);
  }, [accountCenterRows, myAccountRows, q]);

  const showAppSettings =
    keywordMatch([
      'การแจ้งเตือน',
      'โหมด',
      'face',
      'touch',
      'ภาษา',
      'language',
      'แจ้ง',
      'มืด',
      'biometric',
    ]) || !q;

  return (
    <View
      style={[styles.root, { backgroundColor: colorScheme === 'dark' ? theme.background : PAGE_BG_LIGHT }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <AppStatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <View
        style={[
          styles.topNav,
          { paddingTop: insets.top + 8, backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backHit}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
        >
          <ChevronLeft size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.text }]} numberOfLines={1}>
          การตั้งค่าและกิจกรรม
        </Text>
        <View style={styles.backHit} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={[styles.searchWrap, { backgroundColor: theme.surface }]}>
          <Search size={18} color={theme.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ค้นหา"
            placeholderTextColor={theme.mutedForeground}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={styles.body}>
          {mergedAccount.length > 0 ? (
            <SettingsSection theme={theme} title="บัญชีของคุณ" right={<Text style={styles.psBadge}>PSUSCC</Text>}>
              {mergedAccount.map((r, i, arr) => (
                <SettingsRow
                  key={r.id}
                  theme={theme}
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  onPress={r.onPress}
                  isLast={i === arr.length - 1}
                />
              ))}
            </SettingsSection>
          ) : null}

          {isAdmin && filterList(adminRows).length > 0 ? (
            <SettingsSection theme={theme} title="ผู้ดูแลระบบ" sectionGap>
              {filterList(adminRows).map((r, i, arr) => (
                <SettingsRow
                  key={r.id}
                  theme={theme}
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  onPress={r.onPress}
                  isLast={i === arr.length - 1}
                />
              ))}
            </SettingsSection>
          ) : null}

          {filterList(useRows).length > 0 ? (
            <SettingsSection theme={theme} title="วิธีที่คุณใช้แอป" sectionGap>
              {filterList(useRows).map((r, i, arr) => (
                <SettingsRow
                  key={r.id}
                  theme={theme}
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  onPress={r.onPress}
                  isLast={i === arr.length - 1}
                />
              ))}
            </SettingsSection>
          ) : null}

          {showAppSettings ? (
            <SettingsSection theme={theme} title={t('profile.settings_group') || 'การตั้งค่าแอป'} sectionGap>
              <SettingsSwitchRow
                theme={theme}
                icon={Bell}
                title={t('profile.notifications') || 'การแจ้งเตือน'}
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                isLast={false}
              />
              <SettingsSwitchRow
                theme={theme}
                icon={Moon}
                title={t('profile.dark_mode') || 'โหมดกลางคืน'}
                value={isDarkMode}
                onValueChange={(val) => {
                  setIsDarkMode(val);
                  Toast.show({ type: 'info', text1: 'กรุณาเปลี่ยนโหมดในตั้งค่าของระบบ' });
                }}
                isLast={!isBiometricSupportedState}
              />
              {isBiometricSupportedState ? (
                <SettingsSwitchRow
                  theme={theme}
                  icon={biometricType === 'face' ? ScanFace : Fingerprint}
                  title={`ใช้ ${biometricType === 'face' ? 'Face ID' : 'Touch ID'}`}
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  isLast={false}
                />
              ) : null}
              <SettingsRow
                theme={theme}
                icon={Globe}
                title={t('profile.language') || 'ภาษา (Language)'}
                subtitle={i18n.language === 'th' ? 'ไทย' : 'English'}
                onPress={handleLanguageToggle}
                isLast
              />
            </SettingsSection>
          ) : null}

          {filterList(supportRows).length > 0 ? (
            <SettingsSection theme={theme} title={t('profile.support_group') || 'สนับสนุน'} sectionGap>
              {filterList(supportRows).map((r, i, arr) => (
                <SettingsRow
                  key={r.id}
                  theme={theme}
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  onPress={r.onPress}
                  isLast={i === arr.length - 1}
                />
              ))}
            </SettingsSection>
          ) : null}

          {filterList(helpRows).length > 0 ? (
            <SettingsSection theme={theme} title="ช่วยเหลือและข้อมูล" sectionGap>
              {filterList(helpRows).map((r, i, arr) => (
                <SettingsRow
                  key={r.id}
                  theme={theme}
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  onPress={r.onPress}
                  isLast={i === arr.length - 1}
                />
              ))}
            </SettingsSection>
          ) : null}

          {filterList(moreRows).length > 0 ? (
            <SettingsSection theme={theme} title="เพิ่มเติมจาก PSUSCC" sectionGap>
              {filterList(moreRows).map((r, i, arr) => (
                <SettingsRow
                  key={r.id}
                  theme={theme}
                  icon={r.icon}
                  title={r.title}
                  subtitle={r.subtitle}
                  onPress={r.onPress}
                  isLast={i === arr.length - 1}
                />
              ))}
            </SettingsSection>
          ) : null}

          <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
            <Text style={[styles.footerSectionTitle, { color: theme.mutedForeground }]}>การเข้าสู่ระบบ</Text>
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => Toast.show({ type: 'info', text1: 'เร็วๆ นี้' })}
            >
              <Text style={styles.linkBlue}>เพิ่มบัญชี</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.logoutBtn,
              { backgroundColor: colorScheme === 'dark' ? '#450a0a' : '#FEF2F2' },
            ]}
            onPress={() => router.push('/logout')}
            activeOpacity={0.8}
          >
            <View style={[styles.logoutIconWrapper, { backgroundColor: theme.surface }]}>
              <LogOut size={20} color="#EF4444" />
            </View>
            <Text style={styles.logoutText}>{t('common.logout') || 'ออกจากระบบ'}</Text>
          </TouchableOpacity>

          <Text style={[styles.versionText, { color: theme.muted }]}>Version 1.0.0 (Build 2024)</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  body: { paddingTop: 8 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  psBadge: { fontSize: 12, fontWeight: '900', color: '#6366f1' },
  card: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
    minHeight: 56,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  rowHint: { fontSize: 13, marginRight: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  footerSectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12 },
  footerLink: { paddingVertical: 10 },
  linkBlue: { fontSize: 15, fontWeight: '700', color: '#3B82F6' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 24,
    gap: 16,
  },
  logoutIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 15, fontWeight: '900', color: '#EF4444' },
  versionText: { textAlign: 'center', marginTop: 24, fontSize: 12, fontWeight: '600' },
});
