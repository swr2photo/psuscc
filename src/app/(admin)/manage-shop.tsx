import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useShopCategories } from '@/features/shop/api/useShopCatalog';
import type { ShopProduct } from '@/features/shop/types';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function useAdminShopProducts() {
  return useQuery({
    queryKey: ['admin', 'shop_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*, shop_product_variants(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        base_price: row.base_price != null ? Number(row.base_price) : null,
        image_urls: (row.image_urls as string[]) ?? [],
        shop_product_variants: (row.shop_product_variants ?? []).map((v: Record<string, unknown>) => ({
          ...v,
          price: Number(v.price),
        })),
      })) as ShopProduct[];
    },
  });
}

export default function ManageShopScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: categories = [] } = useShopCategories();
  const { data: rows = [], isLoading } = useAdminShopProducts();

  const onDelete = (p: ShopProduct) => {
    Alert.alert('ลบสินค้า', p.name, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('shop_products').delete().eq('id', p.id);
          if (error) Alert.alert('ผิดพลาด', error.message);
          else qc.invalidateQueries({ queryKey: ['admin', 'shop_products'] });
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'จัดการร้านค้า',
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
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <Text className="text-base font-black text-foreground">สินค้า</Text>
            <Text className="text-sm text-muted-foreground font-medium mt-1">
              แตะรายการเพื่อแก้ไข · {categories.length} หมวด
            </Text>
          </View>
          <Button
            label="+ สินค้าใหม่"
            className="rounded-2xl px-4"
            onPress={() => router.push('/(admin)/shop-product-edit')}
          />
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme.primary} />
            <Text className="mt-4 text-muted-foreground font-medium">กำลังโหลดสินค้า...</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 28 }}
            renderItem={({ item }) => (
              <Card className="p-5 mb-3 bg-card border-border">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({
                      pathname: '/(admin)/shop-product-edit',
                      params: { id: item.id },
                    })
                  }
                >
                  <Text className="text-foreground font-black text-base" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-muted-foreground font-semibold mt-1">
                    {item.is_published ? 'เผยแพร่' : 'ฉบับร่าง'} ·{' '}
                    {item.product_type === 'apparel' ? 'เสื้อผ้า' : 'ทั่วไป'}
                  </Text>
                </TouchableOpacity>

                <View className="flex-row items-center justify-end mt-4">
                  <Button
                    variant="destructive"
                    label="ลบ"
                    className="rounded-2xl px-4"
                    onPress={() => onDelete(item)}
                  />
                </View>
              </Card>
            )}
            ListEmptyComponent={
              <Card className="p-6 bg-card border-border">
                <Text className="text-foreground font-bold">ยังไม่มีสินค้า</Text>
                <Text className="text-muted-foreground mt-2">
                  กด “สินค้าใหม่” เพื่อเริ่มเพิ่มสินค้าในร้าน
                </Text>
              </Card>
            }
          />
        )}
      </View>
    </View>
  );
}
