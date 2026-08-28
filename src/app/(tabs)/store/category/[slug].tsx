import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { PackageSearch } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flexFill } from '@/constants/layout';
import { AppleStoreLayout as L } from '@/constants/apple-store-ui';
import { stackMainScrollProps, withScrollRefresh } from '@/constants/scroll-insets';
import { useShopCategories, useShopProducts } from '@/features/shop/api/useShopCatalog';
import { navigateToShopProduct } from '@/features/shop/navigateToProduct';
import { AppleStoreProductTile } from '@/components/shop/apple-store-product-tile';
import { ShopCategoryIcon } from '@/components/shop/shop-category-icon';
import { useAppleStorePalette } from '@/hooks/use-apple-store-palette';
import { useContentWidth } from '@/hooks/use-content-width';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { normalizeRouteParam } from '@/lib/utils';
import { isTablet } from '@/lib/utils';
import { WebStaticGrid } from '@/components/ui/web-static-grid';

const GRID_GAP = 14;
const H_PAD = L.hPad;

export default function StoreCategoryScreen() {
  const insets = useSafeAreaInsets();
  const rawSlug = useLocalSearchParams<{ slug: string | string[] }>().slug;
  const slug = normalizeRouteParam(rawSlug) ?? 'all';
  const palette = useAppleStorePalette();
  const contentWidth = useContentWidth();
  const gridCols = isTablet ? 3 : 2;
  const tileWidth = useMemo(() => {
    const gaps = GRID_GAP * (gridCols - 1);
    return (contentWidth - H_PAD * 2 - gaps) / gridCols;
  }, [contentWidth, gridCols]);

  const { data: categories = [] } = useShopCategories();
  const {
    data: products = [],
    isPending,
    isError,
    refetch,
  } = useShopProducts(slug === 'all' ? 'all' : slug);

  const title = useMemo(() => {
    if (slug === 'all') return 'สินค้าทั้งหมด';
    return categories.find((c) => c.slug === slug)?.name ?? 'หมวดสินค้า';
  }, [slug, categories]);

  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: palette.background },
        count: {
          color: palette.textSecondary,
          fontSize: 15,
          fontWeight: '500',
          marginTop: 4,
        },
        gridPad: { paddingHorizontal: H_PAD, paddingBottom: 24 },
        columnWrapper: {
          justifyContent: 'space-between',
          marginBottom: GRID_GAP,
          gap: GRID_GAP,
        },
        empty: {
          marginHorizontal: H_PAD,
          marginTop: 24,
          padding: 32,
          alignItems: 'center',
          backgroundColor: palette.card,
          borderRadius: L.radiusLg,
        },
        emptyText: { color: palette.textSecondary, marginTop: 12, fontSize: 15 },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        retry: {
          marginTop: 16,
          backgroundColor: palette.link,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 999,
        },
        retryText: { color: '#fff', fontWeight: '600' },
      }),
    [palette],
  );

  const renderItem = (item: (typeof products)[0]) => (
    <AppleStoreProductTile
      product={item}
      width={tileWidth}
      palette={palette}
      onPress={() => navigateToShopProduct(item.id)}
    />
  );

  const listHeader = (
    <View style={{ height: 16 }} />
  );

  const empty = (
    <View style={styles.empty}>
      <PackageSearch size={32} color={palette.textSecondary} />
      <Text style={styles.emptyText}>ยังไม่มีสินค้าในหมวดนี้</Text>
      <TouchableOpacity style={styles.retry} onPress={() => void refetch()}>
        <Text style={styles.retryText}>รีเฟรช</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, flexFill]}>
      <Stack.Screen
        options={{
          title,
          headerShadowVisible: true,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerBackTitle: '',
        }}
      />

      {isError ?
        <View style={styles.centered}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>โหลดไม่สำเร็จ</Text>
          <TouchableOpacity style={styles.retry} onPress={() => void refetch()}>
            <Text style={styles.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </View>
      : isPending ?
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.textSecondary} />
        </View>
      : Platform.OS === 'web' ?
        <ScrollView
          {...stackMainScrollProps}
          style={flexFill}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          {...withScrollRefresh(
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.text} />,
          )}
        >
          {listHeader}
          <View style={styles.gridPad}>
            {products.length === 0 ?
              empty
            : <WebStaticGrid
                data={products}
                numColumns={gridCols}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                columnWrapperStyle={styles.columnWrapper}
              />
            }
          </View>
        </ScrollView>
      : <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={gridCols}
          key={`cat-grid-${gridCols}`}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={empty}
          columnWrapperStyle={gridCols > 1 ? styles.columnWrapper : undefined}
          contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => renderItem(item)}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.text} />
          }
        />
      }
    </View>
  );
}
