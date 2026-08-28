import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import type { HomeStoryGroup } from '@/features/home/types';
import type { AppTheme } from '@/hooks/use-theme';
import { nestedHorizontalScrollProps } from '@/constants/scroll-insets';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import { openHomeCreate } from '@/features/home/openHomeCreate';

const STORY_SIZE = 72;
const RING = 3;

type Props = {
  storyGroups: HomeStoryGroup[];
  currentUserId: string | null;
  currentUserAvatar: string | null;
  theme: AppTheme;
  isGuest: boolean;
};

export function HomeStoriesRow({
  storyGroups,
  currentUserId,
  currentUserAvatar,
  theme,
  isGuest,
}: Props) {
  const router = useRouter();

  const myGroup = currentUserId ? storyGroups.find((g) => g.userId === currentUserId) : null;
  const others = storyGroups.filter((g) => g.userId !== currentUserId);
  const myLatest = myGroup?.stories[myGroup.stories.length - 1];

  const openCreateStory = async () => {
    const ok = await ensureAuthedOrGoAuth(router, { message: 'เข้าสู่ระบบเพื่อเพิ่มสตอรี' });
    if (ok) openHomeCreate(router, 'story');
  };

  const openViewer = (userId: string) => {
    router.push(`/(tabs)/home/story/${userId}`);
  };

  const onOwnPress = () => {
    if (myGroup && currentUserId) openViewer(currentUserId);
    else void openCreateStory();
  };

  return (
    <ScrollView
      {...nestedHorizontalScrollProps}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <TouchableOpacity style={styles.storyItem} onPress={onOwnPress} activeOpacity={0.85}>
        <View style={[styles.ring, myGroup ? styles.ringActive : { borderColor: theme.border }]}>
          {myLatest?.image_url ?
            <Image source={myLatest.image_url} style={styles.avatar} contentFit="cover" transition={200} />
          : currentUserAvatar ?
            <Image source={currentUserAvatar} style={styles.avatar} contentFit="cover" transition={200} />
          : <View style={[styles.inner, { backgroundColor: theme.secondary }]}>
              <Plus size={28} color={theme.primary} strokeWidth={2} />
            </View>
          }
          {!isGuest ?
            <TouchableOpacity
              style={styles.addBadge}
              onPress={(e) => {
                e.stopPropagation?.();
                void openCreateStory();
              }}
              hitSlop={8}
            >
              <Plus size={14} color="#fff" strokeWidth={3} />
            </TouchableOpacity>
          : null}
        </View>
        <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
          {isGuest ? 'เข้าสู่ระบบ' : 'สตอรีของคุณ'}
        </Text>
      </TouchableOpacity>

      {others.map((group) => (
        <TouchableOpacity
          key={group.userId}
          style={styles.storyItem}
          onPress={() => openViewer(group.userId)}
          activeOpacity={0.85}
        >
          <View style={[styles.ring, styles.ringActive]}>
            {group.avatarUrl ?
              <Image source={group.avatarUrl} style={styles.avatar} contentFit="cover" transition={200} />
            : group.stories[group.stories.length - 1]?.image_url ?
              <Image
                source={group.stories[group.stories.length - 1]!.image_url}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
              />
            : <View style={[styles.inner, { backgroundColor: theme.secondary }]}>
                <Text style={{ color: theme.text, fontWeight: '800' }}>
                  {group.displayName[0]?.toUpperCase() ?? 'U'}
                </Text>
              </View>
            }
          </View>
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            {group.displayName.length > 10 ? `${group.displayName.slice(0, 9)}…` : group.displayName}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 16,
  },
  storyItem: {
    width: STORY_SIZE + 8,
    alignItems: 'center',
  },
  ring: {
    width: STORY_SIZE + RING * 2,
    height: STORY_SIZE + RING * 2,
    borderRadius: (STORY_SIZE + RING * 2) / 2,
    borderWidth: RING,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringActive: {
    borderColor: '#E1306C',
  },
  inner: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
  },
  addBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3897f0',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    width: STORY_SIZE + 12,
  },
});
