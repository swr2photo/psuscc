import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StoreHeaderCartButton } from '@/components/ui/store-header-cart-button';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { ChevronRight } from 'lucide-react-native';

import { nestedHorizontalScrollProps, stackMainScrollProps, withScrollRefresh } from '@/constants/scroll-insets';
import { flexFill } from '@/constants/layout';
import { useShopCategories, useShopProducts } from '@/features/shop/api/useShopCatalog';
import { navigateToShopProduct } from '@/features/shop/navigateToProduct';
import { navigateToShopCategory } from '@/features/shop/navigateToShopCategory';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useContentWidth } from '@/hooks/use-content-width';
import { AppleStoreLayout as L } from '@/constants/apple-store-ui';
import type { AppleStorePalette } from '@/constants/apple-store-ui';
import { useAppleStorePalette } from '@/hooks/use-apple-store-palette';
import { AppleStoreCategoryTile } from '@/components/shop/apple-store-category-tile';
import { AppleStoreDiscoverCard } from '@/components/shop/apple-store-discover-card';
import { AppleStoreProductTile } from '@/components/shop/apple-store-product-tile';
import { ShopCategoryIcon } from '@/components/shop/shop-category-icon';
import { discoverHighlightLabel, pickDiscoverProduct } from '@/features/shop/productDisplay';

const CATEGORY_TILE_W = 148;
const PRODUCT_TILE_W = 160;
const HOME_PREVIEW_COUNT = 8;

function createStyles(p: AppleStorePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: p.background,
    },
    scroll: {
      flexGrow: 1,
    },
    sectionTitle: {
      color: p.text,
      fontSize: L.sectionTitleSize,
      fontWeight: '700',
      letterSpacing: -0.6,
      paddingHorizontal: L.hPad,
      marginBottom: 14,
    },
    sectionHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: L.hPad,
      marginBottom: 14,
    },
    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      color: p.link,
      fontSize: 15,
      fontWeight: '600',
    },
    sectionGap: {
      height: 32,
    },
    hScroll: {
      paddingHorizontal: L.hPad,
      gap: 12,
      paddingBottom: 4,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: p.chip,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
    },
    chipText: {
      color: p.chipText,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    footerLinks: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      marginTop: 36,
      paddingHorizontal: L.hPad,
    },
    footerLink: {
      color: p.link,
      fontSize: 15,
      fontWeight: '600',
    },
    footerDot: {
      color: p.textSecondary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    errorTitle: {
      color: p.text,
      fontSize: 17,
      fontWeight: '600',
    },
    errorSub: {
      color: p.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 18,
      backgroundColor: p.link,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 999,
    },
    retryText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 15,
    },
  });
}

function SectionTitle({ children, styles }: { children: string; styles: any }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Horizontal({
  children,
  styles,
  contentStyle,
}: {
  children: React.ReactNode;
  styles: any;
  contentStyle?: object;
}) {
  return (
    <ScrollView
      {...nestedHorizontalScrollProps}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScroll, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const contentWidth = useContentWidth();
  const palette = useAppleStorePalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const discoverWidth = contentWidth - L.hPad * 2;

  const {
    data: categories = [],
    isLoading: catLoading,
    isError: catError,
    error: catErr,
    refetch: refetchCats,
  } = useShopCategories();

  const {
    data: allProducts = [],
    isLoading: prodLoading,
    isError: prodError,
    error: prodErr,
    refetch: refetchProducts,
  } = useShopProducts('all');

  const discover = useMemo(() => pickDiscoverProduct(allProducts), [allProducts]);

  const categoryTiles = useMemo(() => {
    const tiles: { slug: string; label: string }[] = [{ slug: 'all', label: 'ทั้งหมด' }];
    for (const c of categories) {
      tiles.push({ slug: c.slug, label: c.name });
    }
    return tiles;
  }, [categories]);

  const chips = useMemo(
    () => [{ slug: 'all', label: 'ทั้งหมด' }, ...categories.map((c) => ({ slug: c.slug, label: c.name }))],
    [categories]
  );

  const previewProducts = useMemo(() => allProducts.slice(0, HOME_PREVIEW_COUNT), [allProducts]);

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await Promise.allSettled([refetchCats(), refetchProducts()]);
  });

  const hasData = (categories?.length ?? 0) > 0 || (allProducts?.length ?? 0) > 0;
  const isActuallyLoading = (catLoading || prodLoading) && !hasData;
  const hasError = (catError || prodError) && !hasData;

  return (
    <View style={[styles.container, flexFill]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'ร้านค้า',
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTitleStyle: {
            color: palette.text,
            fontSize: 18,
            fontWeight: '900',
            textShadowColor: palette.background === '#000' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          } as any,
          headerLeft: () => null,
          headerBackVisible: false,
          headerRight: () => (
            <View style={{ paddingRight: 8 }}>
              <StoreHeaderCartButton variant="appleStore" transparent={true} />
            </View>
          ),
        }}
      />

      <AppStatusBar backgroundColor={palette.background} style={palette.statusBar} />

      {hasError ? (
        <View style={[styles.centered, { paddingTop: insets.top + 100 }]}>
          <Text style={styles.errorTitle}>โหลดร้านค้าไม่สำเร็จ</Text>
          <Text style={styles.errorSub}>
            {((catErr ?? prodErr) as Error)?.message ?? 'ลองรีเฟรชอีกครั้ง'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          {...stackMainScrollProps}
          style={flexFill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + (Platform.OS === 'ios' ? 52 : 56),
              paddingBottom: 120 + insets.bottom,
            },
          ]}
          {...withScrollRefresh(
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.text} />
          )}
        >
          {isActuallyLoading ? (
            <View style={{ paddingVertical: 120, alignItems: 'center' }}>
              <ActivityIndicator color={palette.textSecondary} />
            </View>
          ) : (
            <>
              <SectionTitle styles={styles}>สินค้า</SectionTitle>
              <Horizontal styles={styles}>
                {categoryTiles.map((tile) => (
                  <AppleStoreCategoryTile
                    key={tile.slug}
                    slug={tile.slug}
                    label={tile.label}
                    width={CATEGORY_TILE_W}
                    palette={palette}
                    onPress={() => navigateToShopCategory(tile.slug)}
                  />
                ))}
              </Horizontal>

              <View style={styles.sectionGap} />
              <SectionTitle styles={styles}>หมวดหมู่</SectionTitle>
              <Horizontal styles={styles}>
                {chips.map((chip) => (
                  <TouchableOpacity
                    key={chip.slug}
                    onPress={() => navigateToShopCategory(chip.slug)}
                    style={styles.chip}
                    activeOpacity={0.85}
                  >
                    <ShopCategoryIcon slug={chip.slug} size={17} color={palette.chipText} strokeWidth={2.25} />
                    <Text style={styles.chipText}>{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </Horizontal>

              {discover ? (
                <>
                  <View style={styles.sectionGap} />
                  <SectionTitle styles={styles}>พบสิ่งใหม่</SectionTitle>
                  <View style={{ paddingHorizontal: L.hPad }}>
                    <AppleStoreDiscoverCard
                      product={discover.product}
                      width={discoverWidth}
                      palette={palette}
                      highlightLabel={discoverHighlightLabel(discover.reason)}
                      onPress={() => navigateToShopProduct(discover.product.id)}
                    />
                  </View>
                </>
              ) : null}

              {previewProducts.length > 0 ? (
                <>
                  <View style={styles.sectionGap} />
                  <View style={styles.sectionHeadRow}>
                    <Text style={[styles.sectionTitle, { marginBottom: 0, paddingHorizontal: 0, flex: 1 }]}>
                      สินค้าทั้งหมด
                    </Text>
                    <TouchableOpacity
                      style={styles.seeAll}
                      onPress={() => navigateToShopCategory('all')}
                      hitSlop={8}
                    >
                      <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
                      <ChevronRight size={18} color={palette.link} />
                    </TouchableOpacity>
                  </View>
                  <Horizontal styles={styles} contentStyle={{ paddingRight: L.hPad }}>
                    {previewProducts.map((p) => (
                      <AppleStoreProductTile
                        key={p.id}
                        product={p}
                        width={PRODUCT_TILE_W}
                        palette={palette}
                        onPress={() => navigateToShopProduct(p.id)}
                      />
                    ))}
                  </Horizontal>
                </>
              ) : null}

              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/store/orders')}>
                  <Text style={styles.footerLink}>คำสั่งซื้อของฉัน</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/store/cart')}>
                  <Text style={styles.footerLink}>ตะกร้า</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
