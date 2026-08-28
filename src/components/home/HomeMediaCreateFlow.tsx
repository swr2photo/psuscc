import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Camera,
  ChevronRight,
  MapPin,
  MessageCircle,
  Heart,
  UserPlus,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { flexFill } from '@/constants/layout';
import { useCreateHomePost, useCreateHomeStory } from '@/features/home/api/useHomeFeed';
import { useHomeTaggableProfiles } from '@/features/home/api/useHomeTaggableProfiles';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import { goBackOrReplace } from '@/lib/goBack';
import { formatHomeFeedError } from '@/features/home/homeFeedErrors';
import {
  defaultPostComposeSettings,
  type HomeFeedComposeSettings,
} from '@/features/home/homeFeedComposeTypes';
import { ActionSheet } from '@/components/ui/action-sheet';
import type { HomeFeedProfile } from '@/features/home/types';
import Toast from 'react-native-toast-message';
import {
  peekHomeCreateDraft,
  setHomeCreateDraft,
  clearHomeCreateDraft,
  consumeHomeCreateDraft,
} from '@/features/home/homeCreateDraft';
import { deleteCapturedMediaFile } from '@/features/home/fixFrontCameraPhoto';
import {
  isHomeVideo,
  type HomeCapturedMedia,
  type HomeMediaPickMode,
} from '@/features/home/homeMedia';
import { HomeCreateCamera } from '@/components/home/HomeCreateCamera';
import { HomeStoryPreview } from '@/components/home/HomeStoryPreview';

type Props = {
  initialMode: HomeMediaPickMode;
  initialUseGallery?: boolean;
};

type Step = 'camera' | 'preview' | 'compose';

export function HomeMediaCreateFlow({ initialMode, initialUseGallery }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { theme } = useTheme();
  const createPost = useCreateHomePost();
  const createStory = useCreateHomeStory();

  const [mode, setMode] = useState<HomeMediaPickMode>(initialMode);
  const [step, setStep] = useState<Step>(initialUseGallery ? 'camera' : 'camera');
  const [mediaList, setMediaList] = useState<HomeCapturedMedia[]>([]);
  const [settings, setSettings] = useState<HomeFeedComposeSettings>(defaultPostComposeSettings);
  const [tagSheet, setTagSheet] = useState(false);
  const [locationSheet, setLocationSheet] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [taggedProfiles, setTaggedProfiles] = useState<HomeFeedProfile[]>([]);

  const { data: tagCandidates = [], isPending: loadingTags } = useHomeTaggableProfiles(tagSearch);

  const isPending = createPost.isPending || createStory.isPending;
  const isPost = mode === 'post';
  const stepRef = useRef<Step>(step);
  stepRef.current = step;

  const resetFlow = useCallback(() => {
    setStep('camera');
    setMediaList([]);
    setMode(initialMode);
    setSettings(defaultPostComposeSettings);
    setTaggedProfiles([]);
    setTagSearch('');
    setLocationDraft('');
    clearHomeCreateDraft();
  }, [initialMode]);

  /** กู้คืนหลังกล้อง native ทำให้หน้าจอรีโมนต — ไม่รันตอนอยู่หน้า compose/preview แล้ว */
  useFocusEffect(
    useCallback(() => {
      const draft = peekHomeCreateDraft();
      if (draft && stepRef.current === 'camera') {
        setMediaList(Array.isArray(draft.media) ? draft.media : [draft.media]);
        setMode(draft.mode);
        setStep(draft.step === 'preview' ? 'preview' : 'compose');
        consumeHomeCreateDraft();
      }
    }, []),
  );

  useEffect(() => {
    if (step === 'preview' || step === 'compose') {
      clearHomeCreateDraft();
    }
  }, [step]);

  const onCaptured = useCallback((captured: HomeCapturedMedia | HomeCapturedMedia[], flowMode: HomeMediaPickMode) => {
    const list = Array.isArray(captured) ? captured : [captured];
    const nextStep = flowMode === 'story' ? 'preview' : 'compose';
    // สำหรับโพสต์ ถ้าเลือกหลายรูป เราจะส่งแค่รูปแรกไปใน draft (ข้อจำกัด draft) หรือส่งทั้งก้อนถ้า handle ไหว
    setHomeCreateDraft(list[0], flowMode, nextStep === 'preview' ? 'preview' : 'compose');
    setMediaList(list);
    setMode(flowMode);
    setStep(nextStep);
  }, []);

  const goToCompose = useCallback(() => {
    if (mediaList.length === 0) return;
    setHomeCreateDraft(mediaList[0], mode, 'compose');
    setStep('compose');
  }, [mediaList, mode]);

  const onSubmit = async () => {
    if (mediaList.length === 0) {
      Alert.alert('เลือกสื่อก่อน', 'กรุณาถ่ายหรือเลือกรูป/วิดีโอก่อนแชร์');
      return;
    }
    const ok = await ensureAuthedOrGoAuth(router);
    if (!ok) return;

    const payload = {
      media: isPost ? mediaList : mediaList[0],
      caption: settings.caption,
      locationLabel: settings.locationLabel,
      taggedUserIds: settings.taggedUserIds,
      allowComments: settings.allowComments,
      allowLikes: settings.allowLikes,
      allowReplies: settings.allowReplies,
    };

    try {
      if (isPost) {
        await createPost.mutateAsync(payload);
        Toast.show({ type: 'success', text1: 'แชร์โพสต์แล้ว' });
      } else {
        await createStory.mutateAsync(payload);
        Toast.show({ type: 'success', text1: 'แชร์สตอรีแล้ว' });
      }
      const uploadedUris = mediaList.map(m => m.uri);
      resetFlow();
      uploadedUris.forEach(uri => void deleteCapturedMediaFile(uri));
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert(
        isPost ? 'โพสต์ไม่สำเร็จ' : 'สตอรีไม่สำเร็จ',
        formatHomeFeedError(e, 'ไม่สามารถอัปโหลดได้'),
      );
    }
  };

  const toggleTag = (profile: HomeFeedProfile) => {
    const exists = settings.taggedUserIds.includes(profile.id);
    if (exists) {
      setSettings((s) => ({
        ...s,
        taggedUserIds: s.taggedUserIds.filter((id) => id !== profile.id),
      }));
      setTaggedProfiles((list) => list.filter((p) => p.id !== profile.id));
    } else if (settings.taggedUserIds.length >= 10) {
      Alert.alert('แท็กเพื่อน', 'แท็กได้สูงสุด 10 คน');
    } else {
      setSettings((s) => ({ ...s, taggedUserIds: [...s.taggedUserIds, profile.id] }));
      setTaggedProfiles((list) => [...list, profile]);
    }
  };

  const tagSummary = useMemo(() => {
    if (!taggedProfiles.length) return 'เลือกเพื่อน';
    if (taggedProfiles.length === 1) return taggedProfiles[0]!.full_name?.trim() || '1 คน';
    return `${taggedProfiles[0]?.full_name?.trim() ?? 'เพื่อน'} และอีก ${taggedProfiles.length - 1} คน`;
  }, [taggedProfiles]);

  const closeFlow = () => {
    resetFlow();
    goBackOrReplace(router);
  };

  if (step === 'camera') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        {isFocused ? (
          <HomeCreateCamera
            mode={mode}
            onModeChange={setMode}
            onClose={closeFlow}
            onCaptured={onCaptured}
            initialGallery={initialUseGallery}
            multiple={isPost}
          />
        ) : (
          <View style={[flexFill, { backgroundColor: '#000' }]} />
        )}
      </>
    );
  }

  if (step === 'preview' && mediaList.length > 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <HomeStoryPreview
          media={mediaList[0]}
          onBack={() => {
            setMediaList([]);
            setStep('camera');
            clearHomeCreateDraft();
          }}
          onNext={goToCompose}
        />
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[flexFill, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: isPost ? 'ตั้งค่าโพสต์' : 'ตั้งค่าสตอรี',
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                if (isPost) {
                  setMediaList([]);
                  setStep('camera');
                  clearHomeCreateDraft();
                } else {
                  setStep('preview');
                }
              }}
              hitSlop={8}
            >
              <Text style={{ color: theme.primary, fontWeight: '600' }}>ย้อนกลับ</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.composeBody, { paddingBottom: insets.bottom + 100 }]}
      >
        <View style={styles.previewContainer}>
          {mediaList.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 100 }}>
              {mediaList.map((m, i) => (
                <View key={i} style={[styles.thumb, { marginRight: 8, borderColor: theme.border, backgroundColor: theme.secondary }]}>
                  <Image source={{ uri: m.uri }} style={styles.thumbImg} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.thumb, { borderColor: theme.border, backgroundColor: theme.secondary }]}>
              {mediaList[0] ?
                isHomeVideo(mediaList[0]) ?
                  <ComposeVideoThumb uri={mediaList[0].uri} />
                : <Image source={{ uri: mediaList[0].uri }} style={styles.thumbImg} />
              : <Camera size={24} color={theme.mutedForeground} />}
            </View>
          )}
          <TextInput
            style={[styles.captionInput, { color: theme.text }]}
            placeholder={isPost ? 'เขียนคำบรรยายที่นี่…' : 'เพิ่มข้อความบนสตอรีของคุณ…'}
            placeholderTextColor={theme.mutedForeground}
            multiline
            maxLength={isPost ? 1000 : 120}
            value={settings.caption}
            onChangeText={(caption) => setSettings((s) => ({ ...s, caption }))}
          />
        </View>

        {!isPost ?
          <Text style={[styles.storyHint, { color: theme.mutedForeground }]}>
            {mediaList[0] && isHomeVideo(mediaList[0]) ?
              'วิดีโอสตอรี (ไม่เกิน 1 นาที) · แสดง 24 ชั่วโมง'
            : 'สตอรีจะแสดง 24 ชั่วโมง'}
          </Text>
        : null}

        <View style={styles.optionList}>
          <OptionRow
            icon={<UserPlus size={22} color={theme.text} />}
            label="แท็กเพื่อน"
            value={tagSummary}
            theme={theme}
            onPress={() => setTagSheet(true)}
          />
          <OptionRow
            icon={<MapPin size={22} color={theme.text} />}
            label="เพิ่มสถานที่"
            value={settings.locationLabel || 'ไม่ระบุ'}
            theme={theme}
            onPress={() => {
              setLocationDraft(settings.locationLabel);
              setLocationSheet(true);
            }}
          />
          {isPost ?
            <>
              <ToggleRow
                icon={<MessageCircle size={22} color={theme.text} />}
                label="อนุญาตความคิดเห็น"
                value={settings.allowComments}
                onValueChange={(allowComments) => setSettings((s) => ({ ...s, allowComments }))}
                theme={theme}
              />
              <ToggleRow
                icon={<Heart size={22} color={theme.text} />}
                label="อนุญาตถูกใจ"
                value={settings.allowLikes}
                onValueChange={(allowLikes) => setSettings((s) => ({ ...s, allowLikes }))}
                theme={theme}
              />
            </>
          : <ToggleRow
              icon={<MessageCircle size={22} color={theme.text} />}
              label="อนุญาตตอบกลับสตอรี"
              value={settings.allowReplies}
              onValueChange={(allowReplies) => setSettings((s) => ({ ...s, allowReplies }))}
              theme={theme}
            />
          }
        </View>
      </ScrollView>

      <View
        style={[
          styles.shareBar,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: 'transparent',
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: isPost ? theme.primary : '#E1306C' }]}
          disabled={mediaList.length === 0 || isPending}
          onPress={() => void onSubmit()}
          activeOpacity={0.8}
        >
          {isPending ?
            <ActivityIndicator color="#fff" />
          : <Text style={styles.shareBtnText}>{isPost ? 'แชร์ไปยังฟีด' : 'แชร์ไปยังสตอรี'}</Text>}
        </TouchableOpacity>
      </View>

      <ActionSheet visible={tagSheet} onClose={() => setTagSheet(false)} title="แท็กเพื่อน">
        <View style={styles.sheetInner}>
          <TextInput
            style={[styles.sheetSearch, { color: theme.text, borderColor: theme.border }]}
            placeholder="ค้นหาชื่อหรืออีเมล"
            placeholderTextColor={theme.mutedForeground}
            value={tagSearch}
            onChangeText={setTagSearch}
          />
          {loadingTags ?
            <ActivityIndicator style={{ marginTop: 16 }} color={theme.primary} />
          : <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {tagCandidates.map((p) => {
                const selected = settings.taggedUserIds.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.tagRow, selected && { backgroundColor: theme.secondary }]}
                    onPress={() => toggleTag(p)}
                  >
                    <Text style={{ color: theme.text, fontWeight: selected ? '700' : '500' }}>
                      {p.full_name?.trim() || p.email?.split('@')[0] || 'สมาชิก'}
                    </Text>
                    {selected ?
                      <Text style={{ color: theme.primary, fontWeight: '700' }}>✓</Text>
                    : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          }
          <TouchableOpacity
            style={[styles.sheetDone, { backgroundColor: theme.primary }]}
            onPress={() => setTagSheet(false)}
          >
            <Text style={styles.shareBtnText}>เสร็จ</Text>
          </TouchableOpacity>
        </View>
      </ActionSheet>

      <ActionSheet visible={locationSheet} onClose={() => setLocationSheet(false)} title="สถานที่">
        <View style={styles.sheetInner}>
          <TextInput
            style={[styles.sheetSearch, { color: theme.text, borderColor: theme.border }]}
            placeholder="เช่น มหาวิทยาลัยสงขลานครินทร์"
            placeholderTextColor={theme.mutedForeground}
            value={locationDraft}
            onChangeText={setLocationDraft}
          />
          <TouchableOpacity
            style={[styles.sheetDone, { backgroundColor: theme.primary }]}
            onPress={() => {
              setSettings((s) => ({ ...s, locationLabel: locationDraft.trim() }));
              setLocationSheet(false);
            }}
          >
            <Text style={styles.shareBtnText}>บันทึก</Text>
          </TouchableOpacity>
        </View>
      </ActionSheet>
    </KeyboardAvoidingView>
  );
}

function ComposeVideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={styles.thumbImg} contentFit="cover" nativeControls={false} />;
}

function OptionRow({
  icon,
  label,
  value,
  theme,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.optionRow, { borderBottomColor: theme.border }]} onPress={onPress}>
      {icon}
      <Text style={[styles.optionLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.optionValue, { color: theme.mutedForeground }]} numberOfLines={1}>
        {value}
      </Text>
      <ChevronRight size={18} color={theme.mutedForeground} />
    </TouchableOpacity>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
  theme,
}: {
  icon: ReactNode;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={[styles.optionRow, { borderBottomColor: theme.border }]}>
      {icon}
      <Text style={[styles.optionLabel, { color: theme.text, flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  composeBody: { paddingHorizontal: 20, paddingTop: 20 },
  previewContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(128,128,128,0.05)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  captionInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    fontWeight: '500',
    paddingTop: 4,
  },
  storyHint: { fontSize: 12, marginTop: 4, marginBottom: 12, fontWeight: '500', paddingHorizontal: 4 },
  optionList: {
    marginTop: 12,
    backgroundColor: 'rgba(128,128,128,0.05)',
    borderRadius: 20,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: { fontSize: 15, fontWeight: '700', width: 140 },
  optionValue: { flex: 1, fontSize: 14, textAlign: 'right', fontWeight: '500' },
  shareBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    zIndex: 100,
  },
  shareBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  sheetInner: { paddingHorizontal: 16, paddingBottom: 8 },
  sheetSearch: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  sheetDone: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
