import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useChat, type ChatMessage, type EventMember } from '@/features/chat/api/useChat';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Send, CheckCheck, Info, X, Settings, Search, Camera, Mic, Images, Plus, Reply, Copy, Trash2, Languages, Pin, Undo2, MoreHorizontal, Play } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { supabase } from '@/lib/supabase';
import {
  STORAGE_BUCKET_CHAT_ATTACHMENTS,
  getReadableStorageUrl,
} from '@/lib/supabase-storage';
import { ActionSheet } from '@/components/ui/action-sheet';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useChatRoomMeta } from '@/features/chat/api/useChatRoomMeta';
import { useChatNicknames } from '@/features/chat/api/useChatNicknames';
import { useHiddenMessageIds } from '@/features/chat/api/useHiddenMessageIds';
import { ChatSearchModal } from '@/features/chat/components/ChatSearchModal';
import { ChatVoiceBubble } from '@/features/chat/components/ChatVoiceBubble';
import { ChatCameraModal } from '@/components/chat/ChatCameraModal';
import { FormattedChatMessageBody } from '@/features/chat/components/FormattedChatMessageBody';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { ChatThemeKey } from '@/features/chat/chatThemePresets';
import { resolveChatTheme } from '@/features/chat/chatThemePresets';
import { loadChatPrefs } from '@/features/chat/chatLocalPrefs';
import { fetchIsAppAdmin } from '@/lib/isAdmin';
import {
  filterMembersForMention,
  getOpenMentionAtCursor,
  memberMentionLabel,
  mentionsDisplayToStored,
  mentionsEveryoneMatchesQuery,
  mentionsStoredToDisplay,
  DISPLAY_EVERYONE_MENTION_LABEL,
} from '@/features/chat/chatMentions';

const ZWSP = '\u200B';

function formatVoiceLabel(ms?: number | null): string {
  if (ms == null || ms <= 0) return '0:00';
  const s = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function messageShowsCaption(raw: string): boolean {
  return raw.replace(new RegExp(ZWSP, 'g'), '').trim().length > 0;
}

/** แปลง URL storage ให้โหลดได้ (signed ถ้า bucket ไม่ public) */
function ChatAttachmentImage({
  storedUrl,
  width,
  height,
  onPress,
}: {
  storedUrl: string;
  width: number;
  height: number;
  onPress: () => void;
}) {
  const [uri, setUri] = useState(storedUrl);

  useEffect(() => {
    setUri(storedUrl);
    let cancelled = false;
    const isLocal =
      storedUrl.startsWith('file') ||
      storedUrl.startsWith('content') ||
      storedUrl.startsWith('asset') ||
      storedUrl.startsWith('ph');
    if (isLocal) {
      setUri(storedUrl);
      return undefined;
    }
    void getReadableStorageUrl(STORAGE_BUCKET_CHAT_ATTACHMENTS, storedUrl).then((u) => {
      if (!cancelled && u) setUri(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.chatImageClip, { width, height, backgroundColor: '#f0f0f0' }]}>
        <ExpoImage
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      </View>
    </TouchableOpacity>
  );
}

function LightboxImage({ storedUrl }: { storedUrl: string }) {
  const [uri, setUri] = useState(storedUrl);
  useEffect(() => {
    setUri(storedUrl);
    let cancelled = false;
    const isLocal =
      storedUrl.startsWith('file') ||
      storedUrl.startsWith('content') ||
      storedUrl.startsWith('asset') ||
      storedUrl.startsWith('ph');
    if (isLocal) {
      setUri(storedUrl);
      return undefined;
    }
    void getReadableStorageUrl(STORAGE_BUCKET_CHAT_ATTACHMENTS, storedUrl).then((u) => {
      if (!cancelled && u) setUri(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  return (
    <ExpoImage
      source={{ uri }}
      style={styles.lightboxImage}
      contentFit="contain"
      transition={200}
    />
  );
}

function ChatAttachmentVideo({
  storedUrl,
  width,
  height,
}: {
  storedUrl: string;
  width: number;
  height: number;
}) {
  const [uri, setUri] = useState(storedUrl);

  useEffect(() => {
    let cancelled = false;
    const isLocal =
      storedUrl.startsWith('file') ||
      storedUrl.startsWith('content') ||
      storedUrl.startsWith('asset') ||
      storedUrl.startsWith('ph');
    if (isLocal) {
      setUri(storedUrl);
      return undefined;
    }
    void getReadableStorageUrl(STORAGE_BUCKET_CHAT_ATTACHMENTS, storedUrl).then((u) => {
      if (!cancelled && u) setUri(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl]);

  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
  });

  return (
    <View style={[styles.chatImageClip, { width, height, backgroundColor: '#000' }]}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.videoPlayOverlay}>
        <Play size={24} color="#FFF" fill="#FFF" opacity={0.8} />
      </View>
    </View>
  );
}

/** Instagram Direct–inspired group chat: single back control, flat bubbles, compact composer. */
export default function ChatRoomScreen() {
  const { eventId: eventIdParam, id: idParam, title: routeTitle, openChatSearch } = useLocalSearchParams<{
    eventId?: string;
    id?: string;
    title?: string;
    openChatSearch?: string;
  }>();
  const eventId = eventIdParam ?? idParam ?? '';
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { theme, isDark } = useTheme();
  const {
    messages,
    sendMessage,
    sendVoice,
    isLoading,
    members,
    markAsRead,
    reloadMessages,
    refetchMembers,
    unsendOwnMessage,
    hideMessageForSelf,
    adminPinChatMessage,
    adminUnpinChat,
    adminClearEventChat,
  } = useChat(eventId);

  const { data: hiddenMessageIds } = useHiddenMessageIds();
  const { data: chatMeta, refetch: refetchChatMeta } = useChatRoomMeta(eventId);
  const { data: nicknameMap } = useChatNicknames(eventId);

  const [chatThemeKey, setChatThemeKey] = useState<ChatThemeKey>('default');
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [messageActionSheet, setMessageActionSheet] = useState<ChatMessage | null>(null);
  const [chatSearchModalVisible, setChatSearchModalVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    void loadChatPrefs(eventId).then((p) => setChatThemeKey(p.theme));
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      if (!eventId) return;
      void loadChatPrefs(eventId).then((p) => setChatThemeKey(p.theme));
      qc.invalidateQueries({ queryKey: ['chat-room-meta', eventId] });
      qc.invalidateQueries({ queryKey: ['chat-nicknames', eventId] });
      qc.invalidateQueries({ queryKey: ['chat-message-hidden-self'] });
      void fetchIsAppAdmin().then(setIsAppAdmin);
    }, [eventId, qc]),
  );

  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages.length]);

  const [text, setText] = useState('');
  const [composerCaretBump, setComposerCaretBump] = useState(0);
  const composerCaretRef = useRef(0);
  const [pendingImage, setPendingImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const voiceStopBusyRef = useRef(false);
  const [recordedVoice, setRecordedVoice] = useState<{ uri: string; dur: number } | null>(null);
  const isDiscardingVoice = useRef(false);

  const bubbleImageWidth = Math.min(260, windowWidth * 0.68);

  const clearedMs = chatMeta?.chat_cleared_at
    ? new Date(chatMeta.chat_cleared_at).getTime()
    : 0;

  const visibleMessages = useMemo(() => {
    const list = messages.filter((m) => {
      if ((hiddenMessageIds instanceof Set) && hiddenMessageIds.has(m.id)) return false;
      const t = new Date(m.created_at).getTime();
      if (clearedMs > 0 && t <= clearedMs) return false;
      return true;
    });
    return list;
  }, [messages, hiddenMessageIds, clearedMs]);

  const pinnedMessage = useMemo(() => {
    if (!chatMeta?.chat_pinned_message_id) return null;
    return messages.find((m) => m.id === chatMeta.chat_pinned_message_id) ?? null;
  }, [chatMeta?.chat_pinned_message_id, messages]);

  const ct = resolveChatTheme(chatThemeKey, theme, isDark);
  const igBlue = '#0095f6';
  const hairline = StyleSheet.hairlineWidth > 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.06)';
  const rootBg = chatThemeKey === 'default' ? theme.background : ct.surfaceChat;
  const surfaceChat = chatThemeKey === 'default' ? theme.background : ct.surfaceChat;
  const headerIconColor = chatThemeKey === 'default' ? theme.text : ct.text;
  const headerTitleColor = chatThemeKey === 'default' ? theme.text : ct.text;
  const headerSubColor = chatThemeKey === 'default' ? theme.mutedForeground : ct.muted;
  const inputBg = chatThemeKey === 'default' ? (isDark ? '#1C1C1E' : '#F2F2F7') : ct.inputBg;
  const searchFg = ct.text;
  const statusBarStyle = chatThemeKey === 'default' ? (isDark ? 'light' : 'dark') : 'light';

  const bubbleMeBg = ct.bubbleMe;
  const bubbleOther = ct.bubbleOther;
  const bubbleOtherText = chatThemeKey === 'default' ? theme.text : ct.bubbleOtherText;
  const composerIconTint =
    chatThemeKey === 'default' ? (isDark ? '#E5E5E5' : '#262626') : headerIconColor;
  const composerPillBorder =
    chatThemeKey === 'mint' ? 'rgba(22,101,52,0.35)' : hairline;

  const trimmedRoomName = (chatMeta?.chat_room_display_name ?? '').trim();
  const resolvedChatTitle = trimmedRoomName || chatMeta?.title || routeTitle || 'แชทกลุ่ม';

  const resolvedHeaderAvatar =
    chatMeta?.chat_room_photo_url ||
    chatMeta?.cover_url ||
    members?.[0]?.avatar_url ||
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ไม่ได้รับสิทธิ์', 'กรุณาเปิดการเข้าถึงรูปภาพในการตั้งค่า');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.82,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) setPendingImage(result.assets[0]);
  };

  const pickFromCamera = () => {
    setCameraVisible(true);
  };

  const onCameraCapture = (asset: ImagePicker.ImagePickerAsset) => {
    setPendingImage(asset);
  };

  const openAttachMenu = () => {
    Alert.alert('แนบรูป', undefined, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'เลือกจากแกลเลอรี่', onPress: () => void pickFromLibrary() },
      { text: 'ถ่ายรูป', onPress: () => void pickFromCamera() },
    ]);
  };

  const restorePlaybackAudioMode = useCallback(async () => {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
  }, []);

  const cancelVoiceRecording = useCallback(async () => {
    if (recState.isRecording) {
      isDiscardingVoice.current = true;
      await recorder.stop();
      await restorePlaybackAudioMode();
      isDiscardingVoice.current = false;
    } else if (recordedVoice) {
      setRecordedVoice(null);
    }
  }, [recState.isRecording, recordedVoice, recorder, restorePlaybackAudioMode]);

  const handleSendVoice = async () => {
    if (!recordedVoice) return;
    try {
      await sendVoice(recordedVoice.uri, recordedVoice.dur);
      setRecordedVoice(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (e: unknown) {
      Alert.alert('ส่งไม่สำเร็จ', e instanceof Error ? e.message : 'ลองใหม่');
    }
  };

  const toggleVoiceRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('ข้อความเสียง', 'ใช้บันทึกและส่งเสียงได้บนแอปมือถือ (iOS / Android) เท่านั้น');
      return;
    }
    const authOk = await ensureAuthedOrGoAuth(router, { message: 'กรุณาเข้าสู่ระบบก่อนบันทึกเสียง' });
    if (!authOk) return;

    if (voiceStopBusyRef.current) return;

    if (recState.isRecording) {
      voiceStopBusyRef.current = true;
      try {
        const { durationMillis } = recorder.getStatus();
        await recorder.stop();
        await restorePlaybackAudioMode();
        const localUri = recorder.uri;
        if (localUri && !isDiscardingVoice.current) {
          setRecordedVoice({ uri: localUri, dur: durationMillis });
        }
      } catch (e: unknown) {
        await restorePlaybackAudioMode();
        Alert.alert('บันทึกเสียง', e instanceof Error ? e.message : 'ลองใหม่');
      } finally {
        voiceStopBusyRef.current = false;
      }
      return;
    }

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('ไมโครโฟน', 'เปิดการอนุญาตไมโครโฟนในการตั้งค่าระบบ');
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        allowsRecording: true,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: unknown) {
      await restorePlaybackAudioMode();
      Alert.alert('เริ่มบันทึกไม่สำเร็จ', e instanceof Error ? e.message : 'ลองใหม่');
    }
  }, [
    recState.isRecording,
    recorder,
    restorePlaybackAudioMode,
    router,
    sendVoice,
  ]);

  const onStickerPress = useCallback(() => {
    Alert.alert('สติกเกอร์', 'ฟีเจอร์นี้จะมาในรุ่นถัดไป');
  }, []);

  const composerCanSend = !!text.trim() || !!pendingImage;

  const openComposerMention = useMemo(
    () => getOpenMentionAtCursor(text, composerCaretRef.current),
    [text, composerCaretBump],
  );

  const mentionPickerMembers = useMemo(() => {
    if (!openComposerMention || !members?.length) return [];
    return filterMembersForMention(openComposerMention.query, members, nicknameMap).slice(0, 48);
  }, [openComposerMention, members, nicknameMap]);

  const showEveryonePicker = useMemo(() => {
    if (!openComposerMention || !isAppAdmin) return false;
    return mentionsEveryoneMatchesQuery(openComposerMention.query, true);
  }, [openComposerMention, isAppAdmin]);

  const onComposerSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { start, end } = e.nativeEvent.selection;
      composerCaretRef.current = Math.max(start, end);
      setComposerCaretBump((x) => x + 1);
    },
    [],
  );

  const applyComposerMention = useCallback(
    (m: EventMember) => {
      const { query, start, end } = openComposerMention!;
      const display = memberMentionLabel(m, nicknameMap, members ?? []);
      const stored = `@{${m.id}}`;
      const before = text.substring(0, start);
      const after = text.substring(end);
      setText(`${before}${display}${after}`);
      const nextPos = start + display.length;
      composerCaretRef.current = nextPos;
      setComposerCaretBump((x) => x + 1);
    },
    [openComposerMention, text, nicknameMap, members],
  );

  const applyComposerEveryone = useCallback(() => {
    const { query, start, end } = openComposerMention!;
    const display = `@${DISPLAY_EVERYONE_MENTION_LABEL}`;
    const before = text.substring(0, start);
    const after = text.substring(end);
    setText(`${before}${display}${after}`);
    const nextPos = start + display.length;
    composerCaretRef.current = nextPos;
    setComposerCaretBump((x) => x + 1);
  }, [openComposerMention, text]);

  const onComposerChangeText = (val: string) => {
    setText(val);
  };

  const handleSend = async () => {
    const raw = text.trim();
    if (!raw && !pendingImage) return;

    // ตรวจสอบว่าผู้ใช้ล็อกอินอยู่ก่อนส่ง
    const authOk = await ensureAuthedOrGoAuth(router, { message: 'กรุณาเข้าสู่ระบบก่อนส่งข้อความ' });
    if (!authOk) return;

    const converted = mentionsDisplayToStored(raw, members ?? [], nicknameMap, {
      allowEveryone: isAppAdmin,
    });
    if (!converted.ok) {
      Alert.alert('ส่งข้อความไม่ได้', converted.reason);
      return;
    }

    // เก็บค่าเดิมไว้ก่อนเผื่อส่งไม่สำเร็จจะได้คืนกลับ
    const prevText = text;
    const prevImage = pendingImage;
    setText('');
    setPendingImage(null);

    let mt: 'text' | 'announcement' = 'text';
    if (isAppAdmin && raw.startsWith('/ประกาศ')) mt = 'announcement';

    try {
      await sendMessage(converted.value, prevImage, { messageType: mt });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (e: unknown) {
      console.warn('[chat] send error', e);
      // คืนข้อความกลับให้ผู้ใช้ไม่เสียข้อความที่พิมพ์
      setText(prevText);
      setPendingImage(prevImage);
      Toast.show({
        type: 'error',
        text1: 'ส่งข้อความไม่สำเร็จ',
        text2: e instanceof Error ? e.message : 'ลองใหม่อีกครั้ง',
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await reloadMessages();
    setRefreshing(false);
  };

  const onJumpToMessage = (msgId: string) => {
    const idx = visibleMessages.findIndex((m) => m.id === msgId);
    if (idx >= 0) {
      flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.45 });
    }
  };

  const onReadReceiptPress = useCallback((count: number) => {
    if (count > 0) {
      setShowMembersModal(true);
    }
  }, []);

  const resolveSenderLabel = useCallback(
    (item: ChatMessage) => {
      const name = nicknameMap?.[item.user_id]?.trim() || item.profiles.full_name;
      return name;
    },
    [nicknameMap],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isMe = item.user_id === currentUserId;
      const prev = visibleMessages[index - 1];
      const next = visibleMessages[index + 1];

      const samePrev = prev?.user_id === item.user_id;
      const sameNext = next?.user_id === item.user_id;
      const tightTop = samePrev;
      const tightBottom = sameNext;

      const annBorder =
        item.type === 'announcement'
          ? {
              borderWidth: 2,
              borderColor: '#FFD700',
              shadowColor: '#FFD700',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 4,
            }
          : {};

      return (
        <View style={{ marginBottom: tightBottom ? 2 : 10 }}>
          {!samePrev && !isMe && (
            <View style={styles.senderHeader}>
              <ExpoImage
                source={{
                  uri:
                    item.profiles.avatar_url ||
                    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
                }}
                style={styles.bubbleAvatar}
              />
              <Text style={[styles.senderName, { color: headerSubColor }]}>
                {resolveSenderLabel(item)}
              </Text>
            </View>
          )}

          <Pressable
            onLongPress={() => setMessageActionSheet(item)}
            delayLongPress={350}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.messageRow, isMe ? styles.rowEnd : styles.rowStart]}>
              {!isMe && <View style={{ width: 34 }} />}

              {item.audio_url ? (
                <ChatVoiceBubble
                  storedUrl={item.audio_url}
                  durationMs={item.audio_duration_ms}
                  isMe={isMe}
                  accent={igBlue}
                  bubbleMe={bubbleMeBg}
                  bubbleOther={bubbleOther}
                  bubbleOtherText={bubbleOtherText}
                />
              ) : item.image_url ? (
                <View
                  style={[
                    styles.imageMessageCol,
                    isMe ? styles.imageMessageColEnd : styles.imageMessageColStart,
                  ]}
                >
                  <ChatAttachmentImage
                    storedUrl={item.image_url}
                    width={bubbleImageWidth}
                    height={bubbleImageWidth * 1.2}
                    onPress={() => setLightboxUri(item.image_url!)}
                  />
                  {messageShowsCaption(item.content) && (
                    <View
                      style={[
                        styles.mediaCaptionBubble,
                        isMe
                          ? {
                              backgroundColor: bubbleMeBg,
                              borderTopRightRadius: tightTop ? 6 : 18,
                              borderBottomRightRadius: tightBottom ? 6 : 18,
                              borderTopLeftRadius: 18,
                              borderBottomLeftRadius: 18,
                            }
                          : {
                              backgroundColor: bubbleOther,
                              borderTopRightRadius: 18,
                              borderBottomRightRadius: 18,
                              borderTopLeftRadius: tightTop ? 6 : 18,
                              borderBottomLeftRadius: tightBottom ? 6 : 18,
                            },
                      ]}
                    >
                      <FormattedChatMessageBody
                        content={item.content.replace(new RegExp(ZWSP, 'g'), '')}
                        baseColor={isMe ? '#FFF' : bubbleOtherText}
                        mentionColor={isMe ? '#DBEAFE' : igBlue}
                        members={members ?? []}
                        nicknameMap={nicknameMap}
                      />
                      {isMe && (
                        <TouchableOpacity
                          onPress={() => onReadReceiptPress(item.read_count ?? 0)}
                          style={styles.readRow}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <CheckCheck
                            size={14}
                            color={
                              (item.read_count ?? 0) > 0
                                ? 'rgba(255,255,255,0.95)'
                                : 'rgba(255,255,255,0.55)'
                            }
                          />
                          {(item.read_count ?? 0) > 0 && (
                            <Text style={styles.readCount}>{item.read_count}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ) : item.video_url ? (
                <View
                  style={[
                    styles.imageMessageCol,
                    isMe ? styles.imageMessageColEnd : styles.imageMessageColStart,
                  ]}
                >
                  <ChatAttachmentVideo
                    storedUrl={item.video_url}
                    width={bubbleImageWidth}
                    height={bubbleImageWidth * 1.2}
                  />
                  {messageShowsCaption(item.content) ? (
                    <View
                      style={[
                        styles.mediaCaptionBubble,
                        isMe
                          ? {
                              backgroundColor: bubbleMeBg,
                              borderTopRightRadius: tightTop ? 6 : 18,
                              borderBottomRightRadius: tightBottom ? 6 : 18,
                              borderTopLeftRadius: 18,
                              borderBottomLeftRadius: 18,
                            }
                          : {
                              backgroundColor: bubbleOther,
                              borderTopRightRadius: 18,
                              borderBottomRightRadius: 18,
                              borderTopLeftRadius: tightTop ? 6 : 18,
                              borderBottomLeftRadius: tightBottom ? 6 : 18,
                            },
                      ]}
                    >
                      <FormattedChatMessageBody
                        content={item.content.replace(new RegExp(ZWSP, 'g'), '')}
                        baseColor={isMe ? '#FFF' : bubbleOtherText}
                        mentionColor={isMe ? '#DBEAFE' : igBlue}
                        members={members ?? []}
                        nicknameMap={nicknameMap}
                      />
                      {isMe && (
                        <TouchableOpacity
                          onPress={() => onReadReceiptPress(item.read_count ?? 0)}
                          style={styles.readRow}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <CheckCheck
                            size={14}
                            color={
                              (item.read_count ?? 0) > 0
                                ? 'rgba(255,255,255,0.95)'
                                : 'rgba(255,255,255,0.55)'
                            }
                          />
                          {(item.read_count ?? 0) > 0 && (
                            <Text style={styles.readCount}>{item.read_count}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    isMe && (
                      <TouchableOpacity
                        onPress={() => onReadReceiptPress(item.read_count ?? 0)}
                        style={[styles.readRow, styles.readRowUnderImage]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <CheckCheck
                          size={14}
                          color={
                            (item.read_count ?? 0) > 0 ? theme.success : theme.mutedForeground
                          }
                        />
                        {(item.read_count ?? 0) > 0 && (
                          <Text style={[styles.readCountOnSurface, { color: theme.mutedForeground }]}>
                            {item.read_count}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  )}
                </View>
              ) : (
                <View
                  style={[
                    styles.bubble,
                    annBorder,
                    isMe
                      ? {
                          backgroundColor: bubbleMeBg,
                          alignSelf: 'flex-end',
                          borderTopLeftRadius: 20,
                          borderBottomLeftRadius: 20,
                          borderTopRightRadius: tightTop ? 6 : 20,
                          borderBottomRightRadius: tightBottom ? 6 : 20,
                        }
                      : {
                          backgroundColor: bubbleOther,
                          alignSelf: 'flex-start',
                          borderTopRightRadius: 20,
                          borderBottomRightRadius: 20,
                          borderTopLeftRadius: tightTop ? 6 : 20,
                          borderBottomLeftRadius: tightBottom ? 6 : 20,
                        },
                  ]}
                >
                  <FormattedChatMessageBody
                    content={item.content.replace(new RegExp(ZWSP, 'g'), '')}
                    baseColor={isMe ? '#FFF' : bubbleOtherText}
                    mentionColor={isMe ? '#DBEAFE' : igBlue}
                    members={members ?? []}
                    nicknameMap={nicknameMap}
                  />
                  {isMe && (
                    <TouchableOpacity
                      onPress={() => onReadReceiptPress(item.read_count ?? 0)}
                      style={styles.readRow}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <CheckCheck
                        size={14}
                        color={
                          (item.read_count ?? 0) > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)'
                        }
                      />
                      {(item.read_count ?? 0) > 0 && (
                        <Text style={styles.readCount}>{item.read_count}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </Pressable>
        </View>
      );
    },
    [
      bubbleImageWidth,
      bubbleOther,
      bubbleOtherText,
      currentUserId,
      bubbleMeBg,
      igBlue,
      members,
      nicknameMap,
      visibleMessages,
      onReadReceiptPress,
      headerSubColor,
      resolveSenderLabel,
      theme.success,
      theme.mutedForeground,
    ],
  );

  const ListHeader = useMemo(() => (
    <View style={styles.chatIntroContainer}>
      <Image source={{ uri: resolvedHeaderAvatar }} style={styles.chatIntroAvatar} />
      <Text style={[styles.chatIntroTitle, { color: theme.text }]}>
        {resolvedChatTitle}
      </Text>
      <Text style={[styles.chatIntroDesc, { color: theme.mutedForeground }]}>
        ยินดีต้อนรับสู่ห้องแชทกิจกรรม!{'\n'}
        ใช้สำหรับพูดคุย ประสานงาน และติดตามประกาศ{'\n'}
        สำคัญต่างๆ ภายในกิจกรรมนี้
      </Text>
      <View style={[styles.chatIntroDivider, { backgroundColor: hairline }]} />
    </View>
  ), [resolvedHeaderAvatar, resolvedChatTitle, theme.text, theme.mutedForeground, hairline]);

  if (!eventId) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <AppStatusBar style={isDark ? 'light' : 'dark'} />
        <Text style={{ color: theme.mutedForeground }}>ไม่พบกิจกรรม</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: igBlue, fontWeight: '600' }}>กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: rootBg }]}>
      <AppStatusBar style={statusBarStyle} />

      {/* IG-style thin header — using BlurView for a premium native feel */}
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 6,
            borderBottomWidth: 0.5,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          },
        ]}
      >
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.headerBackHit} 
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <ChevronLeft size={28} color={headerIconColor} strokeWidth={2.5} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => setShowMembersModal(true)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: resolvedHeaderAvatar }} style={styles.headerAvatar} />
          <View style={styles.headerTitles}>
            <Text style={[styles.headerTitle, { color: headerTitleColor, fontWeight: '800' }]} numberOfLines={1}>
              {resolvedChatTitle}
            </Text>
            <Text style={[styles.headerSub, { color: headerSubColor, fontWeight: '600' }]} numberOfLines={1}>
              {members?.length ?? 0} สมาชิก · แตะเพื่อรายชื่อ
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => setChatSearchModalVisible(true)}
            style={styles.headerIconBtn}
            accessibilityLabel="ค้นหาในแชต"
            activeOpacity={0.7}
          >
            <Search size={22} color={headerIconColor} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/chat-room-settings',
                params: { id: eventId, title: resolvedChatTitle },
              })
            }
            style={styles.headerIconBtn}
            accessibilityLabel="ตั้งค่าแชท"
            activeOpacity={0.7}
          >
            <Settings size={22} color={headerIconColor} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </BlurView>

      <View
        style={{
          flex: 1,
          backgroundColor: ct.wallpaperGradient ? 'transparent' : surfaceChat,
        }}
      >
        {ct.wallpaperGradient ? (
          <>
            <LinearGradient
              colors={[ct.wallpaperGradient[0], ct.wallpaperGradient[1]]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0.45, y: 0 }}
              end={{ x: 0.55, y: 1 }}
            />
            {ct.wallpaperEmoji ? (
              <Text
                style={[styles.chatWallEmoji, { color: bubbleOtherText }]}
                allowFontScaling={false}
              >
                {ct.wallpaperEmoji}
              </Text>
            ) : null}
          </>
        ) : null}

        {pinnedMessage ? (
          <TouchableOpacity
            onPress={() => onJumpToMessage(pinnedMessage.id)}
            activeOpacity={0.85}
            style={[
              styles.pinnedBar,
              { backgroundColor: surfaceChat, borderBottomColor: hairline },
            ]}
          >
            <Pin size={16} color={igBlue} strokeWidth={2.4} />
            <Text style={[styles.pinnedTitle, { color: theme.text }]} numberOfLines={1}>
              ปักหมุด:{' '}
              {mentionsStoredToDisplay(
                pinnedMessage.content.replace(/\u200B/g, ''),
                members ?? [],
                nicknameMap,
              ).trim()}
            </Text>
            {isAppAdmin ? (
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('ถอดปักหมุด', 'ยืนยันถอดปักหมุดข้อความนี้ในแชทนี้?', [
                    { text: 'ยกเลิก', style: 'cancel' },
                    {
                      text: 'ถอด',
                      style: 'destructive',
                      onPress: () =>
                        void adminUnpinChat()
                          .then(async () => {
                            await refetchChatMeta();
                            Toast.show({ type: 'success', text1: 'ถอดปักหมุดแล้ว' });
                          })
                          .catch((e: unknown) =>
                            Toast.show({
                              type: 'error',
                              text1: 'ถอดปักหมุดไม่ได้',
                              text2: e instanceof Error ? e.message : '',
                            }),
                          ),
                    },
                  ])
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 18 }} />
            )}
          </TouchableOpacity>
        ) : null}
        {isLoading && messages.length === 0 ? (
          <View style={styles.flexCenter}>
            <ActivityIndicator color={igBlue} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListHeaderComponent={ListHeader}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: 12 + insets.bottom,
                backgroundColor: ct.wallpaperGradient ? 'transparent' : surfaceChat,
                flexGrow: 1,
              },
            ]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                  viewPosition: 0.45,
                });
              }, 280);
            }}
            refreshControl={
              <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={igBlue} />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {pendingImage && (
          <View
            style={[
              styles.pendingRow,
              { backgroundColor: surfaceChat, borderTopColor: hairline, paddingHorizontal: 12 },
            ]}
          >
            <Image source={{ uri: pendingImage.uri }} style={styles.pendingThumb} resizeMode="cover" />
            <Text style={[styles.pendingLabel, { color: headerSubColor }]} numberOfLines={1}>
              แนบรูปแล้ว — พิมพ์คำอธิบาย (ไม่บังคับ) แล้วกดส่ง
            </Text>
            <TouchableOpacity
              onPress={() => setPendingImage(null)}
              style={styles.pendingClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="ลบรูปที่เลือก"
            >
              <X size={20} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}
        {openComposerMention && ((members?.length ?? 0) > 0 || showEveryonePicker) ? (
          <View
            style={[
              styles.mentionPopover,
              { borderBottomColor: hairline, backgroundColor: surfaceChat },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 176 }}>
              {showEveryonePicker ? (
                <TouchableOpacity
                  onPress={() => applyComposerEveryone()}
                  style={[styles.mentionRowHit, { borderBottomColor: hairline }]}
                >
                  <View style={[styles.mentionRowAvatar, styles.mentionEveryoneGlyph]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: igBlue }}>@</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.mentionRowTitle, { color: theme.text }]} numberOfLines={1}>
                      ทุกคนในกลุ่ม (@{DISPLAY_EVERYONE_MENTION_LABEL})
                    </Text>
                    <Text
                      style={[styles.mentionRowSub, { color: theme.mutedForeground }]}
                      numberOfLines={1}
                    >
                      เฉพาะแอดมินของระบบ
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {mentionPickerMembers.length === 0 && !showEveryonePicker ? (
                <Text style={[styles.mentionEmpty, { color: theme.mutedForeground }]}>
                  ไม่พบสมาชิกตามที่พิมพ์
                </Text>
              ) : null}
              {mentionPickerMembers.map((member) => {
                const subtitle = nicknameMap?.[member.id]?.trim()
                  ? member.full_name
                  : member.email;
                const rowTitle = memberMentionLabel(member, nicknameMap, members ?? []);
                return (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => applyComposerMention(member)}
                    style={[styles.mentionRowHit, { borderBottomColor: hairline }]}
                  >
                    <Image
                      source={{
                        uri:
                          member.avatar_url ||
                          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
                      }}
                      style={styles.mentionRowAvatar}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.mentionRowTitle, { color: theme.text }]} numberOfLines={1}>
                        {rowTitle}
                      </Text>
                      <Text
                        style={[styles.mentionRowSub, { color: theme.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        <View
          style={[
            styles.composerWrap,
            {
              backgroundColor: surfaceChat,
              borderTopColor: hairline,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View
            style={[
              styles.composerPill,
              {
                backgroundColor: inputBg,
                borderColor: composerPillBorder,
              },
            ]}
          >
            {recState.isRecording || recordedVoice ? (
              <Animated.View
                entering={FadeIn}
                exiting={FadeOut}
                style={styles.recordingPillInner}
              >
                <View style={[styles.recordingDot, recState.isRecording && styles.recordingDotActive]} />
                <Text
                  style={[
                    styles.recordingTimer,
                    { color: chatThemeKey === 'default' ? theme.text : searchFg },
                  ]}
                >
                  {recState.isRecording ? 'กำลังอัด… ' : 'อัดเสียงแล้ว '}{' '}
                  {formatVoiceLabel(recState.isRecording ? recState.durationMillis : recordedVoice?.dur)}
                </Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={cancelVoiceRecording}
                  style={styles.composerIconHit}
                  accessibilityLabel="ยกเลิกการอัด"
                >
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={recState.isRecording ? () => void toggleVoiceRecording() : () => void handleSendVoice()}
                  style={[styles.composerIconHit, { marginLeft: 10 }]}
                  accessibilityLabel={recState.isRecording ? 'หยุดอัด' : 'ส่งเสียง'}
                >
                  {recState.isRecording ? (
                    <View style={[styles.stopBtnInner, { backgroundColor: igBlue }]} />
                  ) : (
                    <Send size={22} color={igBlue} strokeWidth={2.2} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => void pickFromCamera()}
                  style={[styles.composerCamFab, { backgroundColor: bubbleMeBg }]}
                  accessibilityLabel="ถ่ายรูป"
                  activeOpacity={0.85}
                >
                  <Camera size={22} color="#FFFFFF" strokeWidth={2.4} />
                </TouchableOpacity>

                <TextInput
                  style={[
                    styles.composerInput,
                    { color: chatThemeKey === 'default' ? theme.text : searchFg },
                  ]}
                  placeholder={
                    isAppAdmin
                      ? 'พิมข้อความ… @ชื่อสมาชิก • /ประกาศ • /ลบห้องแชท'
                      : 'พิมข้อความ… @ชื่อสมาชิก'
                  }
                  placeholderTextColor={headerSubColor}
                  value={text}
                  onChangeText={onComposerChangeText}
                  onSelectionChange={onComposerSelectionChange}
                  multiline
                  maxLength={2000}
                />

                <View style={styles.composerIconRow}>
                  <TouchableOpacity
                    style={styles.composerIconHit}
                    onPress={() => void toggleVoiceRecording()}
                    accessibilityLabel="บันทึกเสียง"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Mic size={22} color={composerIconTint} strokeWidth={2.15} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.composerIconHit}
                    onPress={() => void pickFromLibrary()}
                    accessibilityLabel="แกลเลอรี่"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Images size={22} color={composerIconTint} strokeWidth={2.15} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.composerIconHit}
                    onPress={onStickerPress}
                    accessibilityLabel="สติกเกอร์"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text
                      style={[styles.composerStickerGlyph, { color: composerIconTint }]}
                      allowFontScaling={false}
                    >
                      🙂
                    </Text>
                  </TouchableOpacity>
                  {composerCanSend ? (
                    <TouchableOpacity
                      style={styles.composerIconHit}
                      onPress={() => void handleSend()}
                      accessibilityLabel="ส่งข้อความ"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Send size={22} color={igBlue} strokeWidth={2.2} style={{ marginLeft: 1 }} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.composerIconHit}
                      onPress={openAttachMenu}
                      accessibilityLabel="ตัวเลือกเพิ่มเติม"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Plus size={24} color={composerIconTint} strokeWidth={2.2} />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!lightboxUri}
        animationType="fade"
        transparent
        onRequestClose={() => setLightboxUri(null)}
      >
        <View style={styles.lightboxBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setLightboxUri(null)}
            accessibilityLabel="ปิด"
          />
          <View style={styles.lightboxContent} pointerEvents="box-none">
            {lightboxUri ? <LightboxImage storedUrl={lightboxUri} /> : null}
          </View>
          <TouchableOpacity
            style={[styles.lightboxClose, { top: insets.top + 8 }]}
            onPress={() => setLightboxUri(null)}
          >
            <X size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>

      {cameraVisible && (
        <ChatCameraModal
          visible={cameraVisible}
          onClose={() => setCameraVisible(false)}
          onCapture={onCameraCapture}
        />
      )}

      <ActionSheet
        visible={!!messageActionSheet}
        onClose={() => setMessageActionSheet(null)}
        title="ตัวเลือกข้อความ"
      >
        <View style={{ padding: 16, gap: 12 }}>
          {messageActionSheet?.user_id === currentUserId && (
            <TouchableOpacity
              onPress={() => {
                unsendOwnMessage(messageActionSheet!.id);
                setMessageActionSheet(null);
              }}
              style={styles.actionRow}
            >
              <Trash2 size={20} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 16 }}>ยกเลิกการส่ง</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={() => {
              hideMessageForSelf(messageActionSheet!.id);
              setMessageActionSheet(null);
            }}
            style={styles.actionRow}
          >
            <Undo2 size={20} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>ซ่อนสำหรับฉัน</Text>
          </TouchableOpacity>

          {isAppAdmin && (
            <TouchableOpacity
              onPress={() => {
                adminPinChatMessage(messageActionSheet!.id);
                setMessageActionSheet(null);
              }}
              style={styles.actionRow}
            >
              <Pin size={20} color={igBlue} />
              <Text style={{ color: igBlue, fontWeight: '600', fontSize: 16 }}>ปักหมุดข้อความ</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              Clipboard.setStringAsync(messageActionSheet!.content);
              setMessageActionSheet(null);
              Toast.show({ type: 'success', text1: 'คัดลอกข้อความแล้ว' });
            }}
            style={styles.actionRow}
          >
            <Copy size={20} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>คัดลอกข้อความ</Text>
          </TouchableOpacity>
        </View>
      </ActionSheet>

      <Modal
        visible={showMembersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View style={[styles.root, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: hairline, paddingVertical: 12 }]}>
            <Text style={[styles.headerTitle, { color: theme.text, marginLeft: 20 }]}>
              สมาชิกกลุ่ม
            </Text>
            <TouchableOpacity
              onPress={() => setShowMembersModal(false)}
              style={{ padding: 10, marginRight: 10 }}
            >
              <Text style={{ color: igBlue, fontWeight: '700' }}>ปิด</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {members?.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <Image
                  source={{
                    uri:
                      m.avatar_url ||
                      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
                  }}
                  style={styles.memberAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: theme.text }]}>
                    {nicknameMap?.[m.id]?.trim() || m.full_name}
                  </Text>
                  {nicknameMap?.[m.id]?.trim() ? (
                    <Text style={[styles.memberEmail, { color: theme.mutedForeground }]}>
                      {m.full_name}
                    </Text>
                  ) : (
                    <Text style={[styles.memberEmail, { color: theme.mutedForeground }]}>
                      {m.email}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <ChatSearchModal
        visible={chatSearchModalVisible}
        onClose={() => setChatSearchModalVisible(false)}
        messages={messages}
        onSelectMessage={onJumpToMessage}
        resolveSenderLabel={resolveSenderLabel}
        members={members}
        nicknameMap={nicknameMap}
        foreground={headerTitleColor}
        mutedForeground={headerSubColor}
        accent={ct.accent}
        surface={surfaceChat}
        dividerColor={hairline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  flexCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerBackHit: { paddingHorizontal: 12, paddingVertical: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eee' },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSub: { fontSize: 11.5, marginTop: 1 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  headerIconBtn: { padding: 8 },
  pinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  pinnedTitle: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  listContent: { paddingHorizontal: 14, paddingTop: 10 },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    marginTop: 6,
  },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#eee' },
  senderName: { fontSize: 12, fontWeight: '600' },
  messageRow: { flexDirection: 'row', width: '100%' },
  rowStart: { justifyContent: 'flex-start' },
  rowEnd: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderCurve: 'continuous',
  },
  imageMessageCol: { maxWidth: '100%' },
  imageMessageColEnd: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  imageMessageColStart: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  chatImageClip: { borderRadius: 16, overflow: 'hidden' },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  mediaCaptionBubble: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderCurve: 'continuous',
    maxWidth: '85%',
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    gap: 3,
  },
  readRowUnderImage: { marginTop: 4, marginRight: 4 },
  readCount: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  readCountOnSurface: { fontSize: 10, fontWeight: '700' },
  mentionPopover: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  mentionPopoverHint: { fontSize: 12, fontWeight: '600', paddingHorizontal: 4, paddingBottom: 8 },
  mentionEveryoneGlyph: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  mentionEmpty: { paddingHorizontal: 12, paddingVertical: 14, fontWeight: '500', fontSize: 14 },
  mentionRowHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mentionRowAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ccc' },
  mentionRowTitle: { fontSize: 15, fontWeight: '700' },
  mentionRowSub: { fontSize: 12.5, marginTop: 2 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pendingThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#ccc' },
  pendingLabel: { flex: 1, fontSize: 12, fontWeight: '600' },
  pendingClear: { padding: 6 },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 48,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    gap: 4,
    maxHeight: Platform.OS === 'ios' ? 132 : 120,
  },
  composerCamFab: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 1,
    marginRight: 2,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    paddingHorizontal: 4,
    marginBottom: Platform.OS === 'ios' ? 2 : 0,
  },
  composerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 5 : 4,
    gap: 2,
  },
  composerIconHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerStickerGlyph: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '500',
  },
  recordingPillInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    height: 44,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
    marginRight: 10,
  },
  recordingDotActive: {
    backgroundColor: '#EF4444',
  },
  recordingTimer: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  stopBtnInner: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  sheetScroll: { maxHeight: 420 },
  sheetScrollInner: { padding: 20, paddingBottom: 32 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ccc' },
  memberName: { fontSize: 16, fontWeight: '700' },
  chatIntroContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  chatIntroAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    backgroundColor: '#E2E8F0',
  },
  chatIntroTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  chatIntroDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  chatIntroDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    opacity: 0.5,
  },
  memberEmail: { fontSize: 13, marginTop: 2 },
  msgSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  msgSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  msgSheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  msgSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  msgSheetRowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  msgSheetRowDanger: {
    color: '#FF453A',
    fontWeight: '600',
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  lightboxContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  lightboxImage: { width: '100%', flex: 1, minHeight: 200 },
  chatWallEmoji: {
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    fontSize: 200,
    opacity: 0.09,
    pointerEvents: 'none',
  },
  lightboxClose: {
    position: 'absolute',
    right: 16,
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
