import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useDashboardData } from '@/features/admin/api/useDashboardData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Clock, ChevronRight, Megaphone, Users } from 'lucide-react-native';
import { cn, isTablet } from '@/lib/utils';
import { HeaderRight } from '@/components/ui/header-right';
import { AppStatusBar } from '@/components/ui/app-status-bar';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const regCardWidth = useMemo(() => {
    if (!isTablet) return undefined;
    const pad = 48;
    const gaps = 16 * 2;
    return (windowWidth - pad - gaps) / 3;
  }, [windowWidth]);
  const { data, isLoading, isError, error, refetch } = useDashboardData();
  const { refreshing, onRefresh } = usePullToRefresh(useCallback(() => refetch(), [refetch]));

  if (isLoading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#6366f1" />
        <Text className="mt-4 text-muted-foreground font-medium">กำลังโหลดข้อมูล Dashboard...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#FDFDFF]">
      <Stack.Screen
        options={{
          title: 'แดชบอร์ด',
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTintColor: '#0F172A',
          headerRight: () => <HeaderRight />,
        }}
      />
      <AppStatusBar style="dark" />

      <View style={styles.contentMaxWidth} className="flex-1 px-6 pt-4">
        <View style={styles.statsRow}>
          <Card className="flex-1 p-6 mr-4 bg-white border-zinc-100">
            <View className="w-10 h-10 rounded-xl bg-zinc-50 items-center justify-center mb-4">
              <ShoppingBag size={20} color="#0F172A" />
            </View>
            <Text className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              คนลงทะเบียนรวม
            </Text>
            <Text className="text-4xl font-black mt-1">{data?.totalRegistrations || 0}</Text>
          </Card>
          <Card className="flex-1 p-6 border-orange-100 bg-orange-50/20">
            <View className="w-10 h-10 rounded-xl bg-orange-100 items-center justify-center mb-4">
              <Clock size={20} color="#f97316" />
            </View>
            <Text className="text-sm font-bold text-orange-600 uppercase tracking-wider">
              สลิปที่รอเช็ค
            </Text>
            <Text className="text-4xl font-black mt-1 text-orange-700">
              {data?.pendingOrders || 0}
            </Text>
          </Card>
          {isTablet && (
            <Card className="flex-1 p-6 border-blue-100 bg-blue-50/20 ml-4">
              <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center mb-4">
                <Users size={20} color="#3b82f6" />
              </View>
              <Text className="text-sm font-bold text-blue-600 uppercase tracking-wider">
                แอดมินออนไลน์
              </Text>
              <Text className="text-4xl font-black mt-1 text-blue-700">1</Text>
            </Card>
          )}
        </View>

        {/* ปุ่มส่งประกาศ */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(admin)/send-notification')}
          className="mb-8 mt-6 overflow-hidden rounded-2xl border border-[#6366f1]/20 bg-[#6366f1]/5"
        >
          <View className="p-6 flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              <View className="w-14 h-14 rounded-full bg-[#6366f1] items-center justify-center">
                <Megaphone size={28} color="white" />
              </View>
              <View>
                <Text className="text-xl font-bold text-[#6366f1]">ส่งประกาศใหม่</Text>
                <Text className="text-sm text-[#6366f1]/70">แจ้งเตือนผู้ใช้ทุกคนผ่านมือถือ</Text>
              </View>
            </View>
            <ChevronRight size={24} color="#6366f1" />
          </View>
        </TouchableOpacity>

        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-black text-[#0F172A]">การลงทะเบียนล่าสุด</Text>
          <Button
            variant="link"
            size="sm"
            label="ดูทั้งหมด"
            onPress={() => router.push('/(admin)/verify-registrations')}
          />
        </View>

        <FlatList
          data={data?.recentRegistrations}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          numColumns={isTablet ? 3 : 1}
          key={isTablet ? 'tablet-3' : 'mobile'}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          columnWrapperStyle={isTablet ? { gap: 8 } : undefined}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card
              style={
                isTablet && regCardWidth != null
                  ? { width: regCardWidth, marginHorizontal: 4, flexGrow: 0 }
                  : {}
              }
              className="mb-3 bg-white border-zinc-100"
            >
              <View className="p-5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-4 flex-1">
                  <View className="w-12 h-12 rounded-full bg-zinc-50 items-center justify-center border border-zinc-100 overflow-hidden">
                    {item.profiles?.avatar_url ? (
                      <Image source={{ uri: item.profiles.avatar_url }} className="w-full h-full" />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-blue-50">
                        <Text className="font-bold text-sm text-blue-600">
                          {item.profiles?.full_name
                            ? item.profiles.full_name[0].toUpperCase()
                            : 'U'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      style={{ fontSize: 17, fontWeight: '700', color: '#0F172A' }}
                      numberOfLines={1}
                    >
                      {item.profiles?.full_name || item.profiles?.email || 'Unknown User'}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Text className="text-[12px] text-zinc-400 font-bold">
                        Size: {item.size || 'N/A'}
                      </Text>
                      <Text className="text-[12px] text-zinc-300">|</Text>
                      <Text
                        className="text-[12px] text-muted-foreground font-semibold"
                        numberOfLines={1}
                      >
                        {item.events?.title || 'กิจกรรมทั่วไป'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Badge
                  variant={item.status === 'pending' ? 'outline' : 'default'}
                  className={cn(
                    item.status === 'pending' ? 'bg-orange-50 border-orange-200' : 'bg-green-500'
                  )}
                >
                  <Text
                    className={cn(
                      'text-[10px] font-black uppercase',
                      item.status === 'pending' ? 'text-orange-600' : 'text-white'
                    )}
                  >
                    {item.status}
                  </Text>
                </Badge>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View className="py-20 items-center justify-center">
              <Text className="text-muted-foreground italic font-medium">
                ยังไม่มีรายการลงทะเบียน
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentMaxWidth: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
  },
});
