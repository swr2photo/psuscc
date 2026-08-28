import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { ActionSheet } from '@/components/ui/action-sheet';
import {
  profileDisplayName,
  useStoryLikerIds,
  useStoryReplies,
  useStoryViewers,
} from '@/features/home/api/useStoryEngagement';
import type { HomeStoryReply, HomeStoryView } from '@/features/home/types';
import type { AppTheme } from '@/hooks/use-theme';

type Tab = 'viewers' | 'replies';

type Props = {
  visible: boolean;
  storyId: string;
  theme: AppTheme;
  onClose: () => void;
  formatTime: (iso: string) => string;
};

function Avatar({
  uri,
  name,
  theme,
}: {
  uri: string | null | undefined;
  name: string;
  theme: AppTheme;
}) {
  if (uri) return <Image source={{ uri }} style={styles.avatar} />;
  return (
    <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
      <Text style={styles.avatarLetter}>{name[0]?.toUpperCase() ?? 'U'}</Text>
    </View>
  );
}

export function HomeStoryInsightsSheet({
  visible,
  storyId,
  theme,
  onClose,
  formatTime,
}: Props) {
  const [tab, setTab] = useState<Tab>('viewers');
  const { data: viewers = [], isPending: loadingViewers } = useStoryViewers(storyId, visible);
  const { data: replies = [], isPending: loadingReplies } = useStoryReplies(storyId, visible);
  const { data: likerIds } = useStoryLikerIds(storyId, visible);

  const renderViewer = ({ item }: { item: HomeStoryView }) => {
    const name = profileDisplayName(item.profiles);
    const liked = (likerIds instanceof Set) && likerIds.has(item.user_id);
    return (
      <View style={styles.row}>
        <Avatar uri={item.profiles?.avatar_url} name={name} theme={theme} />
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>
            ดูเมื่อ {formatTime(item.viewed_at)}
          </Text>
        </View>
        {liked ?
          <Heart size={18} color="#ff3040" fill="#ff3040" />
        : null}
      </View>
    );
  };

  const renderReply = ({ item }: { item: HomeStoryReply }) => {
    const name = profileDisplayName(item.profiles);
    return (
      <View style={styles.row}>
        <Avatar uri={item.profiles?.avatar_url} name={name} theme={theme} />
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {name}
            {item.reply_type === 'message' ?
              <Text style={{ color: theme.mutedForeground, fontWeight: '500' }}> · ข้อความ</Text>
            : null}
          </Text>
          <Text style={[styles.replyBody, { color: theme.text }]}>{item.body}</Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const loading = tab === 'viewers' ? loadingViewers : loadingReplies;
  const empty =
    tab === 'viewers' ?
      !loadingViewers && viewers.length === 0
    : !loadingReplies && replies.length === 0;

  return (
    <ActionSheet visible={visible} onClose={onClose} title="สตอรีของคุณ" maxHeight={560}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'viewers' && { borderBottomColor: theme.text }]}
          onPress={() => setTab('viewers')}
        >
          <Text style={[styles.tabLabel, { color: tab === 'viewers' ? theme.text : theme.mutedForeground }]}>
            ผู้ชม ({viewers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'replies' && { borderBottomColor: theme.text }]}
          onPress={() => setTab('replies')}
        >
          <Text style={[styles.tabLabel, { color: tab === 'replies' ? theme.text : theme.mutedForeground }]}>
            ข้อความ ({replies.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ?
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      : empty ?
        <View style={styles.center}>
          <Text style={{ color: theme.mutedForeground, fontWeight: '600' }}>
            {tab === 'viewers' ? 'ยังไม่มีผู้ชม' : 'ยังไม่มีข้อความตอบกลับ'}
          </Text>
        </View>
      : tab === 'viewers' ?
        <FlatList
          data={viewers}
          keyExtractor={(item) => item.user_id}
          renderItem={renderViewer}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      : <FlatList
          data={replies}
          keyExtractor={(item) => item.id}
          renderItem={renderReply}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
        />}
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.35)',
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontWeight: '700', fontSize: 14 },
  list: { maxHeight: 400 },
  center: { paddingVertical: 32, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontWeight: '700', fontSize: 15 },
  sub: { fontSize: 12, marginTop: 2 },
  replyBody: { fontSize: 14, marginTop: 4, lineHeight: 19 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarLetter: { color: '#fff', fontWeight: '800', textAlign: 'center', lineHeight: 44 },
});
