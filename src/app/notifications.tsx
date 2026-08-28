import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { flexFill } from '@/constants/layout';
import { stackTransparentHeader } from '@/constants/stack-header';
import { withScrollRefresh } from '@/constants/scroll-insets';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter, Stack } from 'expo-router';
import { useNotifications, Notification } from '@/features/notifications/api/useNotifications';
import { Bell, CheckCircle2, Info, AlertTriangle, MailOpen } from 'lucide-react-native';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { useTheme } from '@/hooks/use-theme';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { stackMainScrollProps } from '@/constants/scroll-insets';

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const { theme, isDark } = useTheme();
  const { notifications, isLoading, markAsRead, markAllAsRead, refetch } = useNotifications();
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await refetch();
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'home_post_like':
      case 'home_story_like':
        return <Bell size={20} color="#E1306C" />;
      case 'success':
        return <CheckCircle2 size={20} color="#10B981" />;
      case 'warning':
        return <AlertTriangle size={20} color="#F59E0B" />;
      case 'error':
        return <AlertTriangle size={20} color="#EF4444" />;
      default:
        return <Info size={20} color="#3B82F6" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const unreadBg = isDark ? 'rgba(99,102,241,0.10)' : '#F8FAFC';
    const iconBgRead = isDark ? theme.secondary : '#F1F5F9';
    const iconBgUnread = isDark ? 'rgba(99,102,241,0.18)' : '#EEF2FF';
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
          !item.is_read && { backgroundColor: unreadBg },
        ]}
        activeOpacity={0.7}
        onPress={() => {
          if (!item.is_read) markAsRead.mutate(item.id);
          const data = item.data as Record<string, string> | undefined;
          if (data?.event_id) {
            router.push({ pathname: '/event-detail', params: { id: data.event_id } });
            return;
          }
          if (data?.type === 'home_post_like' || data?.post_id) {
            router.push('/(tabs)/home');
            return;
          }
          if (data?.type === 'home_story_like' && data?.story_owner_id) {
            router.push(`/(tabs)/home/story/${data.story_owner_id}`);
          }
        }}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: item.is_read ? iconBgRead : iconBgUnread },
          ]}
        >
          {getIcon(item.type || 'info')}
        </View>
        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text
              style={[
                styles.title,
                { color: theme.text },
                !item.is_read && styles.unreadText,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[styles.time, { color: theme.mutedForeground }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <Text style={[styles.message, { color: theme.mutedForeground }]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
        {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: theme.text }]} />}
      </TouchableOpacity>
    );
  };

  const emptyBox = (
    <View style={styles.emptyBox}>
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Bell size={48} color={theme.mutedForeground} />
      </View>
      <Text style={[styles.emptyText, { color: theme.text }]}>ไม่มีการแจ้งเตือนใหม่</Text>
      <Text style={[styles.emptySubText, { color: theme.mutedForeground }]}>
        เมื่อมีกิจกรรมใหม่ๆ หรือความคืบหน้า{'\n'}เราจะแจ้งให้คุณทราบที่นี่ครับ
      </Text>
    </View>
  );

  const listItems = (notifications || []).map((item) => (
    <View key={item.id}>{renderItem({ item })}</View>
  ));

  return (
    <View style={[styles.container, flexFill, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'การแจ้งเตือน',
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          ...stackTransparentHeader(colorScheme),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => markAllAsRead.mutate()}
              style={[styles.markAllButton, { backgroundColor: theme.secondary }]}
              activeOpacity={0.75}
              disabled={markAllAsRead.isPending}
            >
              <MailOpen size={20} color={theme.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <AppStatusBar />

      {isLoading && notifications === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : Platform.OS === 'web' ? (
        <ScrollView
          style={flexFill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          {...withScrollRefresh(
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />,
          )}
        >
          {notifications?.length ? listItems : emptyBox}
        </ScrollView>
      ) : (
        <FlatList
          {...stackMainScrollProps}
          style={flexFill}
          data={notifications || []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={emptyBox}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...flexFill },
  list: { paddingBottom: 100 },

  markAllButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 18,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  unreadText: { fontWeight: '900' },
  time: { fontSize: 11, fontWeight: '600' },
  message: { fontSize: 14, lineHeight: 20 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 12,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  emptyText: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  emptySubText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
});
