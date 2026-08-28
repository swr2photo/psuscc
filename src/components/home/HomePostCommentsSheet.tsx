import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import { ActionSheet } from '@/components/ui/action-sheet';
import {
  useCreateHomePostComment,
  useHomePostComments,
} from '@/features/home/api/useHomeFeed';
import type { HomePost, HomePostComment } from '@/features/home/types';
import type { AppTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  post: HomePost;
  theme: AppTheme;
  onClose: () => void;
  formatTime: (iso: string) => string;
};

function commentAuthor(c: HomePostComment): string {
  return c.profiles?.full_name?.trim() || 'สมาชิก';
}

export function HomePostCommentsSheet({ visible, post, theme, onClose, formatTime }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const { data: comments, isPending } = useHomePostComments(post.id, visible);
  const create = useCreateHomePostComment();

  const onSend = async () => {
    const text = draft.trim();
    if (!text || create.isPending) return;
    try {
      await create.mutateAsync({ postId: post.id, body: text });
      setDraft('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ส่งคอมเมนต์ไม่สำเร็จ';
      if (msg.includes('home_post_comments') || msg.includes('schema')) {
        Alert.alert('ตั้งค่าไม่ครบ', 'ยังไม่ได้รัน migration add_home_post_engagement บน Supabase');
      } else {
        Alert.alert('ส่งไม่สำเร็จ', msg);
      }
    }
  };

  return (
    <ActionSheet visible={visible} onClose={onClose} title="ความคิดเห็น" maxHeight={520}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {isPending ?
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
          </View>
        : !comments?.length ?
          <View style={styles.center}>
            <Text style={{ color: theme.mutedForeground, fontWeight: '600' }}>ยังไม่มีความคิดเห็น</Text>
            <Text style={{ color: theme.mutedForeground, fontSize: 13, marginTop: 4 }}>
              เป็นคนแรกที่คอมเมนต์
            </Text>
          </View>
        : <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                {item.profiles?.avatar_url ?
                  <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
                : <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                    <Text style={styles.avatarLetter}>
                      {commentAuthor(item)[0]?.toUpperCase() ?? 'U'}
                    </Text>
                  </View>
                }
                <View style={styles.commentBody}>
                  <Text style={[styles.commentMeta, { color: theme.text }]}>
                    <Text style={styles.commentName}>{commentAuthor(item)}</Text>
                    {'  '}
                    {item.body}
                  </Text>
                  <Text style={[styles.commentTime, { color: theme.mutedForeground }]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            )}
          />
        }

        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 8),
              backgroundColor: theme.surface,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
            ]}
            placeholder="เพิ่มความคิดเห็น…"
            placeholderTextColor={theme.mutedForeground}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={() => void onSend()}
            disabled={!draft.trim() || create.isPending}
            style={[
              styles.sendBtn,
              {
                backgroundColor: draft.trim() ? theme.primary : theme.secondary,
                opacity: create.isPending ? 0.6 : 1,
              },
            ]}
          >
            {create.isPending ?
              <ActivityIndicator size="small" color="#fff" />
            : <Send size={18} color={draft.trim() ? '#fff' : theme.mutedForeground} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 13 },
  commentBody: { flex: 1 },
  commentMeta: { fontSize: 14, lineHeight: 19 },
  commentName: { fontWeight: '700' },
  commentTime: { fontSize: 11, marginTop: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
