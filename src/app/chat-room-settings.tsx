import type { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/use-theme';
import { useChatRoomMeta, useSaveChatRoomMeta } from '@/features/chat/api/useChatRoomMeta';
import { useChatNicknames, useSaveMyNickname } from '@/features/chat/api/useChatNicknames';
import { useEventMembers } from '@/features/chat/api/useChat';
import {
  CHAT_THEME_LABELS,
  chatThemeRowPreview,
  type ChatThemeKey,
} from '@/features/chat/chatThemePresets';
import {
  DEFAULT_CHAT_PREFS,
  loadChatPrefs,
  saveChatPrefs,
  type ChatLocalPrefs,
} from '@/features/chat/chatLocalPrefs';
import * as ImagePicker from 'expo-image-picker';
import { uploadChatRoomAvatar } from '@/features/chat/uploadChatImage';
import Toast from 'react-native-toast-message';
import {
  ChevronLeft,
  Search,
  Users,
  Bell,
  BellOff,
  MoreHorizontal,
  Palette,
  ChevronRight,
  SquarePen,
  Lock,
  MessageCircle,
  ImageIcon,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { fetchIsAppAdmin } from '@/lib/isAdmin';

type ExpandedSection = null | 'theme' | 'nick' | 'notify' | 'admin';

function QuickAction({
  Icon,
  label,
  onPress,
  tint,
  labelColor,
}: {
  Icon: typeof Search;
  label: string;
  onPress: () => void;
  tint: string;
  labelColor: string;
}) {
  return (
    <TouchableOpacity style={styles.qaCol} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.qaCircle, { backgroundColor: `${tint}22` }]}>
        <Icon size={26} color={tint} strokeWidth={2} />
      </View>
      <Text style={[styles.qaLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SettingsMenuRow({
  icon: Icon,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon: typeof Palette;
  title: string;
  subtitle?: string;
  onPress: () => void;
  right?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.65}>
      <View style={styles.menuLeft}>
        <Icon size={24} color={theme.text} strokeWidth={2} />
        <View style={styles.menuTextCol}>
          <Text style={[styles.menuTitle, { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.menuSubtitle, { color: theme.mutedForeground }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      {right ?? <ChevronRight size={20} color={theme.mutedForeground} />}
    </TouchableOpacity>
  );
}

function useRecentChatImages(eventId: string) {
  return useQuery({
    queryKey: ['chat-images-strip', eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('image_url')
        .eq('event_id', eventId)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(16);
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.image_url as string | null)
        .filter((u): u is string => !!u && u.length > 0);
    },
  });
}

const winW = Dimensions.get('window').width;

export default function ChatRoomSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { id: eventId, title: titleParam } = useLocalSearchParams<{ id: string; title?: string }>();

  const { data: meta, isLoading: metaLoading, refetch } = useChatRoomMeta(eventId || '');
  const saveMeta = useSaveChatRoomMeta(eventId || '');
  const { data: nicknameMap } = useChatNicknames(eventId || '');
  const saveNickname = useSaveMyNickname(eventId || '');
  const { data: eventMembers } = useEventMembers(eventId || '');
  const { data: mediaUrls } = useRecentChatImages(eventId || '');

  const [groupName, setGroupName] = useState('');
  const [nickname, setNickname] = useState('');
  const [prefs, setPrefs] = useState<ChatLocalPrefs>({ ...DEFAULT_CHAT_PREFS });
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [membersModal, setMembersModal] = useState(false);
  const [moreModal, setMoreModal] = useState(false);

  useEffect(() => {
    void (async () => {
      setIsAdminUser(await fetchIsAppAdmin());
    })();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setGroupName(meta?.chat_room_display_name ?? '');
    void loadChatPrefs(eventId).then(setPrefs);
  }, [eventId, meta?.chat_room_display_name]);

  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || !eventId) return;
      setNickname(nicknameMap?.[u.user.id] ?? '');
    })();
  }, [eventId, nicknameMap]);

  const titleFallback = meta?.title ?? (typeof titleParam === 'string' ? titleParam : '') ?? '';
  const headerTitle = groupName?.trim() || meta?.chat_room_display_name || titleFallback || 'แชทกลุ่ม';
  const themeSubtitle = CHAT_THEME_LABELS[prefs.theme];

  const screenBg = isDark ? theme.background : '#FFFFFF';
  const subtleBorder = isDark ? theme.border : '#EBEBEB';
  const qaLabelClr = theme.text;

  const pickAvatar = async () => {
    if (!isAdminUser) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ไม่ได้รับสิทธิ์', 'กรุณาเปิดการเข้าถึงรูปภาพ');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (!r.canceled && r.assets[0]) setAvatarAsset(r.assets[0]);
  };

  const saveGroupAndAvatar = async () => {
    if (!eventId) return;
    if (!isAdminUser) {
      Toast.show({
        type: 'info',
        text1: 'สิทธิ์ไม่เพียงพอ',
        text2: 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ชื่อห้องและรูปห้องแชทได้',
      });
      return;
    }
    setSaving(true);
    try {
      let photoUrl: string | null = meta?.chat_room_photo_url ?? null;
      if (avatarAsset) {
        photoUrl = await uploadChatRoomAvatar(eventId, avatarAsset);
      }
      await saveMeta.mutateAsync({
        displayName: groupName.trim() || null,
        photoUrl,
      });
      setAvatarAsset(null);
      await refetch();
      Toast.show({ type: 'success', text1: 'บันทึกข้อมูลกลุ่มแล้ว' });
      setExpanded(null);
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'บันทึกไม่สำเร็จ',
        text2: e instanceof Error ? e.message : 'ตรวจสอบสิทธิ์อัปเดตกิจกรรมบน Supabase',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveNick = async () => {
    if (!eventId) return;
    try {
      await saveNickname.mutateAsync(nickname);
      Toast.show({ type: 'success', text1: 'บันทึกชื่อเล่นแล้ว' });
    } catch (e: unknown) {
      Toast.show({
        type: 'error',
        text1: 'บันทึกชื่อเล่นไม่สำเร็จ',
        text2: e instanceof Error ? e.message : 'ลองใหม่',
      });
    }
  };

  const updatePref = useCallback(
    async (patch: Partial<ChatLocalPrefs>) => {
      if (!eventId) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await saveChatPrefs(eventId, patch);
    },
    [eventId, prefs],
  );

  const openSearchInChat = () => {
    if (!eventId) return;
    router.replace({
      pathname: '/chat-room',
      params: {
        id: eventId,
        title: headerTitle,
        openChatSearch: '1',
      },
    });
  };

  const toggleExpanded = (key: ExpandedSection) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  const previewUri = avatarAsset?.uri ?? meta?.chat_room_photo_url ?? meta?.cover_url ?? undefined;

  const themePreviewGrad = useMemo(() => chatThemeRowPreview(prefs.theme), [prefs.theme]);

  const mediaStrip = useMemo(() => mediaUrls?.slice(0, 12) ?? [], [mediaUrls]);

  if (!eventId) {
    return (
      <View style={[styles.center, { backgroundColor: screenBg, paddingTop: insets.top }]}>
        <Text style={{ color: theme.mutedForeground }}>ไม่พบกิจกรรม</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={[styles.topBar, { paddingTop: insets.top, borderBottomColor: subtleBorder }]}>
        <TouchableOpacity
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.topBarBack}
          accessibilityRole="button"
          accessibilityLabel="กลับ"
        >
          <ChevronLeft size={28} color={theme.text} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {metaLoading && !meta ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            activeOpacity={isAdminUser ? 0.85 : 1}
            onPress={isAdminUser ? pickAvatar : undefined}
            disabled={!isAdminUser}
            style={styles.heroTap}
          >
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.heroAvatar} />
            ) : (
              <View style={[styles.heroAvatarPh, { backgroundColor: theme.secondary }]}>
                <ImageIcon size={40} color={theme.mutedForeground} />
              </View>
            )}
            <Text style={[styles.heroName, { color: theme.text }]}>{headerTitle}</Text>
            {!isAdminUser ? (
              <Text style={[styles.heroHint, { color: theme.mutedForeground }]}>
                รูปและชื่อกลุ่มแก้ได้เฉพาะผู้ดูแลระบบ
              </Text>
            ) : (
              <Text style={[styles.heroHint, { color: theme.primary }]}>แตะรูปเพื่อเปลี่ยน</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.quickRow, { borderBottomColor: subtleBorder }]}>
            <QuickAction
              Icon={Users}
              label="สมาชิก"
              tint="#E11D48"
              labelColor={qaLabelClr}
              onPress={() => setMembersModal(true)}
            />
            <QuickAction Icon={Search} label="ค้นหา" tint="#2563EB" labelColor={qaLabelClr} onPress={openSearchInChat} />
            <QuickAction
              Icon={prefs.notifyNewMessages ? Bell : BellOff}
              label={prefs.notifyNewMessages ? 'แจ้งเตือน' : 'ปิดเสียง'}
              tint="#CA8A04"
              labelColor={qaLabelClr}
              onPress={() => void updatePref({ notifyNewMessages: !prefs.notifyNewMessages })}
            />
            <QuickAction
              Icon={MoreHorizontal}
              label="เพิ่มเติม"
              tint={theme.text}
              labelColor={qaLabelClr}
              onPress={() => setMoreModal(true)}
            />
          </View>

          <View style={styles.menuBlock}>
            <SettingsMenuRow
              icon={Palette}
              title="ธีมห้องแชท"
              subtitle={themeSubtitle}
              onPress={() => toggleExpanded('theme')}
              right={
                <View style={styles.themeRowRight}>
                  <LinearGradient colors={[themePreviewGrad[0], themePreviewGrad[1]]} style={styles.themeSwatch} />
                  <ChevronRight
                    size={20}
                    color={theme.mutedForeground}
                    style={{ transform: [{ rotate: expanded === 'theme' ? '-90deg' : '0deg' }] }}
                  />
                </View>
              }
            />
            {expanded === 'theme' && (
              <View style={[styles.accordion, { borderColor: subtleBorder, backgroundColor: theme.surface }]}>
                <View style={styles.chipRow}>
                  {(Object.keys(CHAT_THEME_LABELS) as ChatThemeKey[]).map((key) => {
                    const on = prefs.theme === key;
                    const g = chatThemeRowPreview(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => void updatePref({ theme: key })}
                        style={[
                          styles.themeChip,
                          {
                            borderColor: on ? theme.primary : theme.border,
                            backgroundColor: on ? theme.secondary : theme.background,
                          },
                        ]}
                      >
                        <LinearGradient colors={[g[0], g[1]]} style={styles.themeChipDot} />
                        <Text
                          style={{ color: theme.text, fontWeight: on ? '800' : '600', fontSize: 12 }}
                          numberOfLines={1}
                        >
                          {CHAT_THEME_LABELS[key]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <SettingsMenuRow
              icon={SquarePen}
              title="ชื่อเล่นในแชท"
              subtitle={nickname.trim() ? nickname : 'ใช้ชื่อจากโปรไฟล์'}
              onPress={() => toggleExpanded('nick')}
              right={
                <ChevronRight
                  size={20}
                  color={theme.mutedForeground}
                  style={{ transform: [{ rotate: expanded === 'nick' ? '-90deg' : '0deg' }] }}
                />
              }
            />
            {expanded === 'nick' && (
              <View style={[styles.accordion, { borderColor: subtleBorder, backgroundColor: theme.surface }]}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="ชื่อที่แสดงในห้องนี้"
                  placeholderTextColor={theme.mutedForeground}
                  maxLength={40}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                />
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: theme.border }]}
                  onPress={() => void saveNick()}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>บันทึกชื่อเล่น</Text>
                </TouchableOpacity>
              </View>
            )}

            <SettingsMenuRow
              icon={Bell}
              title="การแจ้งเตือน"
              subtitle="ตั้งค่าในเครื่อง (พุชจะเชื่อมในรุ่นถัดไป)"
              onPress={() => toggleExpanded('notify')}
              right={
                <ChevronRight
                  size={20}
                  color={theme.mutedForeground}
                  style={{ transform: [{ rotate: expanded === 'notify' ? '-90deg' : '0deg' }] }}
                />
              }
            />
            {expanded === 'notify' && (
              <View style={[styles.accordion, { borderColor: subtleBorder, backgroundColor: theme.surface }]}>
                <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
                  <Text style={{ color: theme.text, flex: 1 }}>แจ้งเตือนข้อความใหม่</Text>
                  <Switch
                    value={prefs.notifyNewMessages}
                    onValueChange={(v) => void updatePref({ notifyNewMessages: v })}
                  />
                </View>
                <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
                  <Text style={{ color: theme.text, flex: 1 }}>กล่าวถึงเท่านั้น</Text>
                  <Switch
                    value={prefs.notifyMentionsOnly}
                    onValueChange={(v) => void updatePref({ notifyMentionsOnly: v })}
                  />
                </View>
                <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                  <Text style={{ color: theme.text, flex: 1 }}>ช่วงเงียบ (ภายหลัง)</Text>
                  <Switch
                    value={prefs.quietHoursPlaceholder}
                    onValueChange={(v) => void updatePref({ quietHoursPlaceholder: v })}
                  />
                </View>
              </View>
            )}

            {isAdminUser && (
              <>
                <SettingsMenuRow
                  icon={Lock}
                  title="จัดการกลุ่ม (แอดมิน)"
                  subtitle="ชื่อและรูปห้องแชท"
                  onPress={() => toggleExpanded('admin')}
                  right={
                    <ChevronRight
                      size={20}
                      color={theme.mutedForeground}
                      style={{ transform: [{ rotate: expanded === 'admin' ? '-90deg' : '0deg' }] }}
                    />
                  }
                />
                {expanded === 'admin' && (
                  <View style={[styles.accordion, { borderColor: subtleBorder, backgroundColor: theme.surface }]}>
                    <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>ชื่อห้องแชท</Text>
                    <TextInput
                      value={groupName}
                      onChangeText={setGroupName}
                      placeholder={titleFallback || 'ชื่อกลุ่ม'}
                      placeholderTextColor={theme.mutedForeground}
                      style={[
                        styles.input,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    />
                    <Text style={[styles.smallHint, { color: theme.mutedForeground }]}>
                      เว้นว่างใช้ชื่อกิจกรรม ({titleFallback || '—'})
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: theme.text, opacity: saving ? 0.6 : 1 },
                      ]}
                      disabled={saving}
                      onPress={() => void saveGroupAndAvatar()}
                    >
                      <Text style={[styles.primaryBtnText, { color: theme.background }]}>
                        บันทึกชื่อและรูปกลุ่ม
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.65}
              onPress={() =>
                Toast.show({
                  type: 'info',
                  text1: 'ความเป็นส่วนตัว',
                  text2: 'ฟีเจอร์นี้จะมาในรุ่นถัดไป',
                })
              }
            >
              <View style={styles.menuLeft}>
                <Lock size={24} color={theme.text} strokeWidth={2} />
                <View style={styles.menuTextCol}>
                  <Text style={[styles.menuTitle, { color: theme.text }]}>ความเป็นส่วนตัวและความปลอดภัย</Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              activeOpacity={0.65}
              onPress={() =>
                Toast.show({
                  type: 'info',
                  text1: 'แจ้งปัญหา',
                  text2: 'ติดต่อผู้ดูแลระบบหรือสำนักกิจกรรม',
                })
              }
            >
              <View style={styles.menuLeft}>
                <MessageCircle size={24} color={theme.text} strokeWidth={2} />
                <View style={styles.menuTextCol}>
                  <Text style={[styles.menuTitle, { color: theme.text }]}>มีบางอย่างไม่ทำงาน</Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.mediaSectionTitle, { color: theme.mutedForeground }]}>สื่อที่แชร์</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaStrip}>
            {mediaStrip.length === 0
              ? [0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[styles.mediaThumbPh, styles.mediaThumbSpacing, { backgroundColor: theme.secondary }]}
                  />
                ))
              : mediaStrip.map((uri, i) => (
                  <Image
                    key={`${uri}-${i}`}
                    source={{ uri }}
                    style={[styles.mediaThumb, styles.mediaThumbSpacing]}
                  />
                ))}
          </ScrollView>
        </ScrollView>
      )}

      <Modal
        visible={membersModal}
        animationType="slide"
        {...(Platform.OS === 'ios' ? { presentationStyle: 'pageSheet' as const } : {})}
        onRequestClose={() => setMembersModal(false)}
      >
        <View style={[styles.modalSheet, { paddingTop: insets.top, backgroundColor: screenBg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: subtleBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>สมาชิกในแชท</Text>
            <TouchableOpacity onPress={() => setMembersModal(false)} hitSlop={12}>
              <Text style={{ color: theme.primary, fontWeight: '700' }}>ปิด</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {eventMembers?.map((m) => {
              const nick = nicknameMap?.[m.id]?.trim();
              const line = nick ? `${nick} (${m.full_name})` : m.full_name;
              return (
                <View key={m.id} style={styles.memberLine}>
                  <Image
                    source={{
                      uri: m.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
                    }}
                    style={styles.memberAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: theme.text }]}>{line}</Text>
                    <Text style={[styles.memberEmail, { color: theme.mutedForeground }]}>{m.email}</Text>
                  </View>
                </View>
              );
            })}
            {(!eventMembers || eventMembers.length === 0) && (
              <Text style={{ color: theme.mutedForeground, textAlign: 'center' }}>ยังไม่มีสมาชิก</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={moreModal} transparent animationType="fade" onRequestClose={() => setMoreModal(false)}>
        <View style={styles.moreWrap}>
          <TouchableOpacity style={styles.moreBackdropTouch} activeOpacity={1} onPress={() => setMoreModal(false)} />
          <View style={[styles.moreSheet, { backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={styles.moreItem}
              onPress={() => {
                setMoreModal(false);
                openSearchInChat();
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>ค้นหาในแชท</Text>
            </TouchableOpacity>
            {isAdminUser && (
              <TouchableOpacity
                style={styles.moreItem}
                onPress={() => {
                  setMoreModal(false);
                  setExpanded('admin');
                }}
              >
                <Text style={{ color: theme.text, fontSize: 16 }}>แก้ชื่อและรูปกลุ่ม</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.moreItem} onPress={() => setMoreModal(false)}>
              <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarBack: { width: 44, height: 40, justifyContent: 'center' },
  scroll: { paddingBottom: 48 },
  heroTap: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E5E5',
  },
  heroAvatarPh: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  heroHint: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  qaCol: { width: (winW - 24) / 4, alignItems: 'center' },
  qaCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaLabel: { fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  menuBlock: { paddingTop: 8 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  menuTextCol: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '600' },
  menuSubtitle: { fontSize: 13, marginTop: 3 },
  themeRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeSwatch: { width: 36, height: 36, borderRadius: 18 },
  accordion: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
  },
  themeChipDot: { width: 22, height: 22, borderRadius: 11 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  smallHint: { fontSize: 12, marginTop: 6 },
  primaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mediaSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 20,
    textTransform: 'uppercase',
  },
  mediaStrip: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  mediaThumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: '#EEE' },
  mediaThumbPh: { width: 88, height: 88, borderRadius: 12 },
  mediaThumbSpacing: { marginRight: 8 },
  modalSheet: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  memberLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#CCC' },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberEmail: { fontSize: 13, marginTop: 2 },
  moreWrap: { flex: 1, justifyContent: 'flex-end' },
  moreBackdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  moreSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
    paddingTop: 8,
  },
  moreItem: { paddingVertical: 16, alignItems: 'center' },
});
