import { ActionSheet } from '@/components/ui/action-sheet';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, Stack } from 'expo-router';
import {
  Film,
  LayoutGrid,
  Link2,
  Package,
  Phone,
  Plus,
  Tag,
  User,
  Wallet,
  Camera,
  LayoutDashboard,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { ProfileHeaderActions } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography } from '@/constants/theme';
import { flexFill } from '@/constants/layout';
import { nestedHorizontalScrollProps, stackMainScrollProps } from '@/constants/scroll-insets';
import { SkeletonProfilePage } from '@/components/ui/skeleton-presets';
import { useMyRegistrations } from '@/features/activities/api/useMyRegistrations';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { isWebPlatform } from '@/lib/webGuest';
import { GuestProfilePanel } from '@/components/views/GuestProfilePanel';

const IG_GRID_GAP = 2;
/** ตรงกับ `contentMaxWidth` — ใช้คำนวณกริด 3 คอลัมน์ให้พอดีกับแถวเดียว */
const PROFILE_CONTENT_MAX_W = 800;
const ADMIN_EMAILS = ['doralaikon.th@gmail.com'];

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Profile Data
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileTab, setProfileTab] = useState<'grid' | 'reels' | 'tagged'>('grid');

  const { width: windowWidth } = useWindowDimensions();
  const { data: myRegistrations = [], refetch: refetchRegistrations } = useMyRegistrations();

  const profileContentWidth = Math.min(windowWidth, PROFILE_CONTENT_MAX_W);
  const gridCellSize = useMemo(
    () => (profileContentWidth - IG_GRID_GAP * 2) / 3,
    [profileContentWidth],
  );

  const username = useMemo(() => {
    const email = session?.user?.email ?? '';
    const local = email.split('@')[0];
    return local || 'profile';
  }, [session?.user?.email]);

  const profileStackOptions = useMemo(() => {
    const headerIos = Platform.OS === 'ios';

    return {
      headerShown: true as const,
      title: username,
      headerLargeTitle: false,
      headerTransparent: true,
      headerShadowVisible: false,
      headerTitleAlign: 'center' as const,
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTitleStyle: {
         color: theme.text,
         fontSize: 18,
         fontWeight: '900' as const,
         textShadowColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
         textShadowOffset: { width: 0, height: 1 },
         textShadowRadius: 2,
      },
      headerLeft: () => null,
      headerRight: () => (
        <View style={{ paddingRight: 8 }}>
          <ProfileHeaderActions transparent={true} />
        </View>
      ),
    };
  }, [colorScheme, theme.background, theme.text, username]);

  const regCount = myRegistrations.length;
  const uniqueEvents = useMemo(
    () => new Set(myRegistrations.map((r) => r.event_id)).size,
    [myRegistrations],
  );
  const recentActivityCount = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return myRegistrations.filter((r) => {
      const t = Date.parse(r.created_at);
      return Number.isFinite(t) && t >= cutoff;
    }).length;
  }, [myRegistrations]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async (silent = false) => {
    try {
      if (!silent && !profile) {
        setLoading(true);
      }
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();

        if (error) throw error;
        setProfile(data);
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setAvatarUrl(data.avatar_url || null);

        const isEmailAdmin = ADMIN_EMAILS.includes(currentSession.user.email || '');
        setIsAdmin(data.role === 'admin' || isEmailAdmin);
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh: onPullRefresh } = usePullToRefresh(async () => {
    await Promise.allSettled([fetchProfile(true), refetchRegistrations()]);
  });

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Toast.show({ type: 'error', text1: 'กรุณากรอกชื่อ-นามสกุล' });
      return;
    }

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'บันทึกสำเร็จ',
        text2: 'ข้อมูลโปรไฟล์ของคุณถูกอัปเดตแล้ว',
      });
      setShowEditModal(false);
      fetchProfile(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'ผิดพลาด', text2: err.message });
    } finally {
      setUpdating(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadAvatar(result.assets[0].base64);
    }
  };

  const uploadAvatar = async (base64: string) => {
    try {
      setUpdating(true);
      const filePath = `avatars/${session.user.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, decode(base64), { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('profiles').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      Toast.show({ type: 'success', text1: 'เปลี่ยนรูปโปรไฟล์สำเร็จ' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'อัปโหลดรูปไม่สำเร็จ', text2: err.message });
    } finally {
      setUpdating(false);
    }
  };

  if (!loading && !session && isWebPlatform()) {
    return (
      <View style={[styles.mainContainer, flexFill, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            ...profileStackOptions,
            title: 'โปรไฟล์',
          }}
        />
        <AppStatusBar
          backgroundColor={Platform.OS === 'ios' ? 'transparent' : undefined}
          style={colorScheme === 'dark' ? 'light' : 'dark'}
        />
        <ScrollView
          style={flexFill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}
        >
          <GuestProfilePanel />
        </ScrollView>
      </View>
    );
  }

  if (loading && !profile) {
    return (
      <View style={[styles.mainContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen options={profileStackOptions} />
        <AppStatusBar
          backgroundColor={Platform.OS === 'ios' ? 'transparent' : undefined}
          style={colorScheme === 'dark' ? 'light' : 'dark'}
        />
        <ScrollView
          {...stackMainScrollProps}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              flexGrow: 1,
              paddingTop: insets.top + (Platform.OS === 'ios' ? 52 : 56),
            },
          ]}
        >
          <SkeletonProfilePage />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.background }]}>
      <Stack.Screen options={profileStackOptions} />
      <AppStatusBar
        backgroundColor={Platform.OS === 'ios' ? 'transparent' : undefined}
        style={colorScheme === 'dark' ? 'light' : 'dark'}
      />

      <ScrollView
        {...stackMainScrollProps}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (Platform.OS === 'ios' ? 52 : 56),
            paddingBottom: 120 + insets.bottom,
          },
        ]}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.primary} />
        }
      >
        <View style={styles.contentMaxWidth}>
          <View style={styles.igHeadRow}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.igAvatarWrap}>
              <View style={[styles.igAvatarRing, { borderColor: theme.border }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.igAvatarImg} resizeMode="cover" />
                ) : (
                  <View
                    style={[
                      styles.igAvatarImg,
                      { backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center' },
                    ]}
                  >
                    <User size={40} color={theme.primary} />
                  </View>
                )}
              </View>
              <View style={[styles.igAddStory, { backgroundColor: '#000', borderColor: theme.background }]}>
                <Plus size={14} color="#FFF" strokeWidth={3} />
              </View>
            </TouchableOpacity>

            <View style={styles.igStats}>
              <TouchableOpacity style={styles.igStatCol} onPress={() => router.push('/my-activities')} activeOpacity={0.7}>
                <Text style={[styles.igStatNum, { color: theme.text }]}>{regCount}</Text>
                <Text style={[styles.igStatLab, { color: theme.text }]}>โพสต์</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.igStatCol} onPress={() => router.push('/my-activities')} activeOpacity={0.7}>
                <Text style={[styles.igStatNum, { color: theme.text }]}>{uniqueEvents}</Text>
                <Text style={[styles.igStatLab, { color: theme.text }]}>ค่าย</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.igStatCol} onPress={() => router.push('/(tabs)/store')} activeOpacity={0.7}>
                <Text style={[styles.igStatNum, { color: theme.text }]}>—</Text>
                <Text style={[styles.igStatLab, { color: theme.text }]}>ร้านค้า</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.igDisplayName, { color: theme.text }]}>{profile?.full_name || 'เพื่อนใหม่'}</Text>
          {phone ? <Text style={[styles.igBio, { color: theme.text }]}>โทร {phone}</Text> : null}
          <TouchableOpacity style={styles.igLinkRow} onPress={() => router.push('/my-activities')} activeOpacity={0.7}>
            <Link2 size={14} color={theme.primary} />
            <Text style={[styles.igLinkText, { color: theme.primary }]} numberOfLines={1}>
              ดูกิจกรรมของฉัน + อีกจาก PSUSCC
            </Text>
          </TouchableOpacity>

          <ScrollView
            {...nestedHorizontalScrollProps}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.igPillScroll}
            contentContainerStyle={styles.igPillRow}
          >
            <TouchableOpacity style={[styles.igPill, { backgroundColor: theme.secondary }]} onPress={() => router.push('/my-activities')}>
              <Package size={14} color={theme.text} />
              <Text style={[styles.igPillText, { color: theme.text }]} numberOfLines={1}>
                กิจกรรมของฉัน
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.igPill, { backgroundColor: theme.secondary }]} onPress={() => router.push('/(tabs)/store')}>
              <Wallet size={14} color={theme.text} />
              <Text style={[styles.igPillText, { color: theme.text }]} numberOfLines={1}>
                ร้านค้า
              </Text>
            </TouchableOpacity>
            {isAdmin ? (
              <TouchableOpacity
                style={[styles.igPill, { backgroundColor: theme.secondary }]}
                onPress={() => router.push('/(admin)/dashboard')}
              >
                <LayoutDashboard size={14} color={theme.text} />
                <Text style={[styles.igPillText, { color: theme.text }]} numberOfLines={1}>
                  Admin
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.igDashBanner, { backgroundColor: theme.secondary }]}
            onPress={() => router.push('/my-activities')}
            activeOpacity={0.85}
          >
            <Text style={[styles.igDashTitle, { color: theme.text }]}>แดชบอร์ดกิจกรรม</Text>
            <Text style={[styles.igDashSub, { color: theme.mutedForeground }]}>
              {recentActivityCount} กิจกรรมใน 30 วันที่ผ่านมา
            </Text>
          </TouchableOpacity>

          <View style={styles.igBtnRow}>
            <TouchableOpacity style={[styles.igBtnGray, { backgroundColor: theme.secondary }]} onPress={() => setShowEditModal(true)}>
              <Text style={[styles.igBtnGrayText, { color: theme.text }]}>แก้ไขโปรไฟล์</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.igBtnGray, { backgroundColor: theme.secondary }]}
              onPress={() => router.push('/(tabs)/profile/share')}
            >
              <Text style={[styles.igBtnGrayText, { color: theme.text }]}>แชร์โปรไฟล์</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.igBtnGray, { backgroundColor: theme.secondary }]}
              onPress={() => {
                const em = session?.user?.email;
                if (em) Toast.show({ type: 'info', text1: em });
              }}
            >
              <Text style={[styles.igBtnGrayText, { color: theme.text }]}>ติดต่อ</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.igTabBar, { borderColor: theme.border }]}>
            <TouchableOpacity style={styles.igTabHit} onPress={() => setProfileTab('grid')} activeOpacity={0.7}>
              <LayoutGrid size={22} color={profileTab === 'grid' ? theme.text : theme.mutedForeground} />
              {profileTab === 'grid' ? <View style={[styles.igTabLine, { backgroundColor: theme.text }]} /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.igTabHit} onPress={() => setProfileTab('reels')} activeOpacity={0.7}>
              <Film size={22} color={profileTab === 'reels' ? theme.text : theme.mutedForeground} />
              {profileTab === 'reels' ? <View style={[styles.igTabLine, { backgroundColor: theme.text }]} /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.igTabHit} onPress={() => setProfileTab('tagged')} activeOpacity={0.7}>
              <Tag size={22} color={profileTab === 'tagged' ? theme.text : theme.mutedForeground} />
              {profileTab === 'tagged' ? <View style={[styles.igTabLine, { backgroundColor: theme.text }]} /> : null}
            </TouchableOpacity>
          </View>

          {profileTab === 'grid' ? (
            <View style={styles.igGrid}>
              {myRegistrations.map((item) => {
                const cover = item.events?.cover_url;
                const title = item.events?.title ?? '';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.igCell, { width: gridCellSize, height: gridCellSize }]}
                    onPress={() => router.push({ pathname: '/event-detail', params: { id: item.event_id } })}
                    activeOpacity={0.9}
                  >
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.igCellImg} resizeMode="cover" />
                    ) : (
                      <View
                        style={[
                          styles.igCellImg,
                          { backgroundColor: theme.secondary, alignItems: 'center', justifyContent: 'center' },
                        ]}
                      >
                        <Text style={{ fontSize: 18, fontWeight: '900', color: theme.primary }}>{title.slice(0, 1)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {myRegistrations.length === 0 ? (
                <View style={styles.igGridEmpty}>
                  <Text style={[styles.igGridEmptyText, { color: theme.mutedForeground }]}>
                    ยังไม่มีกิจกรรมในกริด — ไปสมัครค่ายกันเลย
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/activities')}>
                    <Text style={{ color: theme.primary, fontWeight: '800', marginTop: 8 }}>ดูกิจกรรม</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : profileTab === 'reels' ? (
            <View style={styles.igTabEmpty}>
              <Text style={{ color: theme.mutedForeground, fontWeight: '700' }}>ยังไม่มีรีล</Text>
            </View>
          ) : (
            <View style={styles.igTabEmpty}>
              <Text style={{ color: theme.mutedForeground, fontWeight: '700' }}>ยังไม่มีการแท็ก</Text>
            </View>
          )}

        </View>
      </ScrollView>

      {/* --- EDIT PROFILE MODAL --- */}
      <ActionSheet
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="แก้ไขข้อมูลส่วนตัว"
      >
        <View style={[styles.modalContentWrapper, { backgroundColor: theme.surface }]}>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.editAvatarRow}>
              <TouchableOpacity onPress={pickImage} style={styles.editAvatarContainer}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.editAvatarImg} resizeMode="cover" />
                ) : (
                  <View
                    style={[styles.editAvatarPlaceholder, { backgroundColor: theme.secondary }]}
                  >
                    <User size={32} color={theme.primary} />
                  </View>
                )}
                <View
                  style={[
                    styles.editCameraBadge,
                    { backgroundColor: theme.primary, borderColor: theme.surface },
                  ]}
                >
                  <Camera size={12} color="#FFF" />
                </View>
              </TouchableOpacity>
              <View style={styles.editAvatarInfo}>
                <Text style={[styles.editAvatarTitle, { color: theme.text }]}>รูปโปรไฟล์</Text>
                <Text style={[styles.editAvatarSub, { color: theme.mutedForeground }]}>
                  ขนาดที่แนะนำ 500x500 px
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>
                ชื่อ-นามสกุล
              </Text>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: theme.secondary, borderColor: theme.border },
                ]}
              >
                <User size={18} color={theme.muted} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="ชื่อจริง และนามสกุล"
                  placeholderTextColor={theme.muted}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>
                เบอร์โทรศัพท์
              </Text>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: theme.secondary, borderColor: theme.border },
                ]}
              >
                <Phone size={18} color={theme.muted} />
                <TextInput
                  style={[styles.textInput, { color: theme.text }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="เช่น 08x-xxx-xxxx"
                  placeholderTextColor={theme.muted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.vibrantSavePassBtn,
                { backgroundColor: theme.primary },
                updating && { opacity: 0.7 },
              ]}
              onPress={handleUpdateProfile}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.vibrantSavePassBtnText}>
                  {t('common.save') || 'บันทึกข้อมูล'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ActionSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  igHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },
  igAvatarWrap: { position: 'relative' },
  igAvatarRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  igAvatarImg: { width: '100%', height: '100%', borderRadius: 42 },
  igAddStory: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  igStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  igStatCol: { alignItems: 'center', minWidth: 56 },
  igStatNum: { fontSize: 18, fontWeight: '900' },
  igStatLab: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  igDisplayName: { paddingHorizontal: 16, marginTop: 14, fontSize: 14, fontWeight: '800' },
  igBio: { paddingHorizontal: 16, marginTop: 4, fontSize: 14, fontWeight: '500' },
  igLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  igLinkText: { flex: 1, fontSize: 13, fontWeight: '700' },
  igPillScroll: { marginTop: 12 },
  igPillRow: { paddingHorizontal: 16, gap: 8, paddingRight: 24 },
  igPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  igPillText: { fontSize: 12, fontWeight: '800', maxWidth: 140 },
  igDashBanner: { marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 12 },
  igDashTitle: { fontSize: 15, fontWeight: '900' },
  igDashSub: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  igBtnRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  igBtnGray: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  igBtnGrayText: { fontSize: 13, fontWeight: '800' },
  igTabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    marginHorizontal: 0,
  },
  igTabHit: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  igTabLine: { width: 28, height: 2, borderRadius: 1, marginTop: 8 },
  igGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: IG_GRID_GAP, marginTop: IG_GRID_GAP },
  igCell: { overflow: 'hidden' },
  igCellImg: { width: '100%', height: '100%' },
  igGridEmpty: { width: '100%', paddingVertical: 36, paddingHorizontal: 24, alignItems: 'center' },
  igGridEmptyText: { textAlign: 'center', fontWeight: '700', lineHeight: 22 },
  igTabEmpty: { paddingVertical: 40, alignItems: 'center' },
  menuDivider: { height: 10, marginTop: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 120 },
  contentMaxWidth: { width: '100%', maxWidth: 800, alignSelf: 'center' },

  // Hero Profile
  profileHero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatarWrapper: {
    width: 110,
    height: 110,
    borderRadius: 40,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 10,
    position: 'relative',
    borderWidth: 1,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 36 },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileMainInfo: { alignItems: 'center' },
  profileNameText: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  profileEmailText: { fontSize: 14, fontWeight: '600', marginTop: 4 },

  editProfileSmallBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editProfileBtnText: { fontSize: 13, fontWeight: '800' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 12, fontWeight: '700' },
  statDivider: { width: 1, height: 40 },

  // Menu
  menuContainer: { paddingHorizontal: 16, marginTop: 8 },
  sectionHeader: { marginTop: 24, marginBottom: 12, paddingLeft: 8 },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuGroup: {
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
    padding: 14,
    gap: 16,
    borderBottomWidth: 1,
  },
  menuIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuTextContent: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '800' },
  menuValue: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
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

  // Modal
  modalContentWrapper: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  modalBody: { padding: 24 },
  editAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 32 },
  editAvatarContainer: { position: 'relative' },
  editAvatarImg: { width: 80, height: 80, borderRadius: 28 },
  editAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  editAvatarInfo: { flex: 1 },
  editAvatarTitle: { fontSize: 16, fontWeight: '900' },
  editAvatarSub: { fontSize: 13, fontWeight: '600', marginTop: 4 },

  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '800', marginBottom: 10, marginLeft: 4 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    height: 60,
  },
  textInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600' },
  vibrantSavePassBtn: {
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  vibrantSavePassBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
