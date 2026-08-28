import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type AdminOrderRow = {
  id: string;
  status: string;
  total: number;
  user_id: string;
  profiles?: { full_name: string; email: string; avatar_url: string | null } | null;
  shop_user_addresses:
    | {
        full_name: string;
        phone: string;
        address_line: string;
        province_name: string | null;
        district_name: string | null;
        subdistrict_name: string | null;
        postal_code: string | null;
      }
    | {
        full_name: string;
        phone: string;
        address_line: string;
        province_name: string | null;
        district_name: string | null;
        subdistrict_name: string | null;
        postal_code: string | null;
      }[]
    | null;
  shop_shipments: { tracking_number: string | null }[] | null;
};

function firstAddr(
  row: AdminOrderRow,
): { full_name?: string; phone?: string; address_line?: string } | null {
  const x = row.shop_user_addresses as unknown;
  if (!x) return null;
  if (Array.isArray(x)) return (x[0] as { full_name?: string; phone?: string; address_line?: string }) ?? null;
  return x as { full_name?: string; phone?: string; address_line?: string };
}

function shipmentTracking(row: AdminOrderRow): string {
  const s = row.shop_shipments;
  if (!s?.length) return '';
  return s[0]?.tracking_number ?? '';
}

function useAdminShopOrders() {
  return useQuery({
    queryKey: ['admin', 'shop_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(
          `id, user_id, status, total,
          shop_user_addresses ( full_name, phone, address_line, province_name, district_name, subdistrict_name, postal_code ),
          shop_shipments ( tracking_number )`,
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      const withProfiles = await Promise.all(
        (data ?? []).map(async (o) => {
          const row = o as unknown as AdminOrderRow;
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle();
          return {
            ...row,
            profiles:
              profile || { full_name: 'รอกรอกข้อมูลโปรไฟล์', email: 'ยังไม่มีข้อมูล', avatar_url: null },
          } as AdminOrderRow;
        }),
      );
      return withProfiles;
    },
  });
}

export default function ShopAdminOrdersScreen() {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useAdminShopOrders();
  const [trackEdits, setTrackEdits] = useState<Record<string, string>>({});

  const updateShipment = useMutation({
    mutationFn: async ({ orderId, tracking }: { orderId: string; tracking: string }) => {
      const { error } = await supabase.from('shop_shipments').upsert(
        {
          order_id: orderId,
          tracking_number: tracking.trim(),
          carrier: 'thai_post',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id' },
      );
      if (error) throw error;
      const { error: oerr } = await supabase
        .from('shop_orders')
        .update({ status: 'shipped', updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (oerr) throw oerr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'shop_orders'] }),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: 'คำสั่งซื้อร้านค้า' }} />
        <ActivityIndicator color={theme.primary} />
        <Text className="mt-4 text-muted-foreground font-medium">กำลังโหลดคำสั่งซื้อ...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'คำสั่งซื้อร้านค้า',
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.background },
        }}
      />

      <AppStatusBar style="dark" />

      <View className="flex-1 px-6 pt-4">
        <Text className="text-sm text-muted-foreground font-medium mb-3">
          ใส่เลขพัสดุเพื่อบันทึกและอัปเดตสถานะเป็น “shipped”
        </Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingBottom: 28 }}
        renderItem={({ item }) => {
          const existing = shipmentTracking(item);
          const value = trackEdits[item.id] ?? existing;
          const addr = firstAddr(item);
          return (
            <Card className="p-5 mb-3 bg-card border-border">
              <Text className="text-muted-foreground text-xs font-semibold">{item.id.slice(0, 8)}</Text>
              <Text className="text-foreground font-black mt-2">
                ฿{Number(item.total).toFixed(0)} · {item.status}
              </Text>
              {item.profiles ? (
                <Text className="text-muted-foreground font-medium mt-2">
                  ผู้สั่ง: {item.profiles.full_name} · {item.profiles.email}
                </Text>
              ) : null}
              {addr ? (
                <Text className="text-muted-foreground font-medium mt-1">
                  จัดส่ง: {addr.full_name ?? '-'} · {addr.phone ?? '-'}
                </Text>
              ) : null}
              {addr?.address_line ? <Text className="text-muted-foreground mt-1">{addr.address_line}</Text> : null}
              <TextInput
                placeholder="เลขพัสดุไปรษณีย์ไทย"
                placeholderTextColor={theme.muted}
                value={value}
                onChangeText={(t) => setTrackEdits((m) => ({ ...m, [item.id]: t }))}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 12,
                  fontWeight: '700',
                  color: theme.text,
                  backgroundColor: theme.surface,
                }}
              />
              <View className="mt-3">
                <Button
                  label="บันทึกเลขพัสดุ"
                  loading={updateShipment.isPending}
                  className="rounded-2xl"
                  onPress={() => {
                    const t = value.trim();
                    if (!t) {
                      Alert.alert('กรอกเลขพัสดุ');
                      return;
                    }
                    updateShipment.mutate(
                      { orderId: item.id, tracking: t },
                      { onError: (e) => Alert.alert('ผิดพลาด', e.message) },
                    );
                  }}
                />
              </View>
            </Card>
          );
        }}
      />
      </View>
    </View>
  );
}
