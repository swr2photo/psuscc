import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Search, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { Stack } from 'expo-router';
import { HeaderRightPillsSeparated } from '@/components/ui/header-right';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography } from '@/constants/theme';
import { flexFill } from '@/constants/layout';
import { stackMainScrollProps } from '@/constants/scroll-insets';
import { stackTransparentHeader } from '@/constants/stack-header';
import { useTranslation } from 'react-i18next';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_CHIPS = ['กิจกรรม', 'ค่าย', 'เสื้อ', 'อุปกรณ์', 'ลิมิเต็ด'];
const SUGGESTIONS = [
  { id: 'trend-1', title: 'ค่ายวิทย์ภาคฤดูร้อน', meta: 'เปิดรับสมัคร' },
  { id: 'trend-2', title: 'Starter Pack', meta: 'คอลเลกชันใหม่' },
  { id: 'trend-3', title: 'กิจกรรมกีฬา', meta: 'ยอดนิยม' },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(
    useCallback(async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['activities'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'categories'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'products'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'shipping'] }),
      ]);
    }, [queryClient]),
  );

  return (
    <View style={[styles.container, flexFill, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: 'ค้นหา',
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          ...stackTransparentHeader(colorScheme),
          headerRight: () => <HeaderRightPillsSeparated />,
          headerTitleStyle: { color: theme.text, ...Typography.pageTitle },
        }}
      />

      <ScrollView
        {...stackMainScrollProps}
        style={flexFill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            flexGrow: 1,
            paddingTop: insets.top + (Platform.OS === 'ios' ? 52 : 56),
          },
        ]}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>ยอดนิยม</Text>
          <View style={styles.chipRow}>
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={[styles.chip, { backgroundColor: theme.secondary }]}
              >
                <Text style={[styles.chipText, { color: theme.mutedForeground }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>แนะนำสำหรับคุณ</Text>
          <View
            style={[
              styles.suggestionList,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {SUGGESTIONS.map((item) => (
              <TouchableOpacity key={item.id} style={styles.suggestionItem}>
                <View style={[styles.suggestionIcon, { backgroundColor: theme.primary + '15' }]}>
                  <Search size={18} color={theme.primary} />
                </View>
                <View style={styles.suggestionTextWrap}>
                  <Text style={[styles.suggestionTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.suggestionMeta, { color: theme.mutedForeground }]}>
                    {item.meta}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionList: {
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  suggestionMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
