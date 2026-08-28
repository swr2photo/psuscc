import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronUp, Heart, Send, MoreVertical, Trash2, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { HomeStory } from '@/features/home/types';
import {
  useDeleteStory,
  useSendStoryReply,
  useStoryLiked,
  useStoryViewers,
  useToggleStoryLike,
  useUpdateStory,
} from '@/features/home/api/useStoryEngagement';
import { HomeStoryInsightsSheet } from '@/components/home/HomeStoryInsightsSheet';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import type { AppTheme } from '@/hooks/use-theme';

type Props = {
  story: HomeStory;
  ownerDisplayName: string;
  isOwner: boolean;
  theme: AppTheme;
  bottomInset: number;
  formatTime: (iso: string) => string;
};

export function HomeStoryViewerChrome({
  story,
  ownerDisplayName,
  isOwner,
  theme,
  bottomInset,
  formatTime,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [insightsOpen, setInsightsOpen] = useState(false);
  const allowReplies = story.allow_replies !== false;

  const { data: liked = false } = useStoryLiked(story.id);
  const toggleLike = useToggleStoryLike();
  const sendReply = useSendStoryReply();
  const { data: viewers = [] } = useStoryViewers(story.id, isOwner);

  const deleteStory = useDeleteStory();
  const updateStory = useUpdateStory();

  const onLike = async () => {
    if (isOwner) return;
    if (!(await ensureAuthedOrGoAuth(router, { message: 'เข้าสู่ระบบเพื่อกดใจสตอรี' }))) return;
    try {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleLike.mutateAsync({ storyId: story.id, liked });
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e instanceof Error ? e.message : '');
    }
  };

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sendReply.isPending) return;
    if (!allowReplies) {
      Alert.alert('สตอรีนี้', 'เจ้าของปิดการตอบกลับ');
      return;
    }
    if (!(await ensureAuthedOrGoAuth(router, { message: 'เข้าสู่ระบบเพื่อส่งข้อความ' }))) return;
    try {
      await sendReply.mutateAsync({ storyId: story.id, body: text, replyType: 'message' });
      setDraft('');
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('ส่งแล้ว', `ข้อความถึง ${ownerDisplayName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ส่งไม่สำเร็จ';
      if (msg.includes('home_story_replies') || msg.includes('schema')) {
        Alert.alert('ตั้งค่าไม่ครบ', 'รัน migration add_home_story_engagement บน Supabase');
      } else {
        Alert.alert('ส่งไม่สำเร็จ', msg);
      }
    }
  };

  const onManage = () => {
    Alert.alert('จัดการสตอรี', undefined, [
      {
        text: allowReplies ? 'ปิดการตอบกลับ' : 'เปิดการตอบกลับ',
        onPress: async () => {
          try {
            await updateStory.mutateAsync({
              storyId: story.id,
              updates: { allow_replies: !allowReplies },
            });
          } catch (e) {
            Alert.alert('ผิดพลาด', e instanceof Error ? e.message : 'ไม่สามารถบันทึกได้');
          }
        },
      },
      {
        text: 'ลบสตอรีนี้',
        style: 'destructive',
        onPress: () => {
          Alert.alert('ลบสตอรี', 'ยืนยันที่จะลบสตอรีนี้หรือไม่? ข้อมูลทั้งหมดจะหายไป', [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'ลบออก',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteStory.mutateAsync(story.id);
                  router.back();
                } catch (e) {
                  Alert.alert('ลบไม่สำเร็จ', e instanceof Error ? e.message : '');
                }
              },
            },
          ]);
        },
      },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  };

  if (isOwner) {
    return (
      <>
        <View style={[styles.ownerBar, { paddingBottom: bottomInset + 12 }]}>
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.ownerPill}
              onPress={() => setInsightsOpen(true)}
              activeOpacity={0.85}
            >
              <ChevronUp size={18} color="#fff" />
              <Text style={styles.ownerPillText}>
                {viewers.length > 0 ? `${viewers.length} คนดูแล้ว` : 'ดูผู้ชมและข้อความ'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.manageBtn} onPress={onManage}>
              <MoreVertical size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <HomeStoryInsightsSheet
          visible={insightsOpen}
          storyId={story.id}
          theme={theme}
          onClose={() => setInsightsOpen(false)}
          formatTime={formatTime}
        />
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.viewerBar, { paddingBottom: bottomInset + 8 }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.inputRow}>
        {allowReplies ?
          <TextInput
            style={styles.input}
            placeholder={`ส่งข้อความถึง ${ownerDisplayName}…`}
            placeholderTextColor="rgba(255,255,255,0.55)"
            value={draft}
            onChangeText={setDraft}
            maxLength={280}
            returnKeyType="send"
            onSubmitEditing={() => void onSend()}
          />
        : <Text style={styles.disabledHint}>ปิดการตอบกลับสตอรีนี้</Text>}
        <TouchableOpacity
          onPress={() => void onLike()}
          style={styles.iconBtn}
          disabled={toggleLike.isPending}
          hitSlop={8}
        >
          <Heart
            size={26}
            color={liked ? '#ff3040' : '#fff'}
            fill={liked ? '#ff3040' : 'transparent'}
          />
        </TouchableOpacity>
        {allowReplies ?
          <TouchableOpacity
            onPress={() => void onSend()}
            style={styles.iconBtn}
            disabled={!draft.trim() || sendReply.isPending}
            hitSlop={8}
          >
            {sendReply.isPending ?
              <ActivityIndicator color="#fff" size="small" />
            : <Send size={24} color={draft.trim() ? '#3897f0' : 'rgba(255,255,255,0.4)'} />}
          </TouchableOpacity>
        : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  ownerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  ownerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ownerPillText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  viewerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
    paddingHorizontal: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 80,
  },
  disabledHint: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manageBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
