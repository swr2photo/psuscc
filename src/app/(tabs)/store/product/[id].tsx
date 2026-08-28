import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Search,
  Share2,
  ShoppingCart,
  MoreVertical,
  ChevronRight,
  Truck,
  Shield,
  MessageCircle,
  Minus,
  Plus,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { flexFill } from '@/constants/layout';
import { stackMainScrollProps } from '@/constants/scroll-insets';
import { useContentWidth } from '@/hooks/use-content-width';
import { useShopProduct, useShopProducts, useShopShippingMethods } from '@/features/shop/api/useShopCatalog';
import { useAddToCart, useShopCartQuery } from '@/features/shop/api/useShopCart';
import type { ShopProduct, ShopProductVariant } from '@/features/shop/types';
import { useShopProductRouteId } from '@/hooks/use-shop-product-route-id';
import { navigateToShopProduct } from '@/features/shop/navigateToProduct';
import {
  resolveShopProductPrice,
  formatUnitsSoldLabel,
  shopProductStockLabel,
  shopProductTotalStock,
  shopProductTypeLabel,
} from '@/features/shop/productDisplay';
import { ProductReviewsSection } from '@/features/shop/components/ProductReviewsSection';

const SHOPEE_ORANGE = '#EE4D2D';
const FOOTER_TEAL = '#00BFA5';
const PAGE_BG = '#F5F5F5';
const FOOTER_BAR_HEIGHT = 64;

const useNativeHeroHeader = Platform.OS !== 'web';

export default function StoreProductScreen() {
  const id = useShopProductRouteId();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = usePullToRefresh(
    useCallback(async () => {
      const tasks: Promise<unknown>[] = [
        queryClient.refetchQueries({ queryKey: ['shop', 'products'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'cart'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'shipping'] }),
      ];
      if (id) {
        tasks.push(queryClient.refetchQueries({ queryKey: ['shop', 'product', id] }));
        tasks.push(queryClient.refetchQueries({ queryKey: ['shop', 'reviews', id] }));
      }
      await Promise.all(tasks);
    }, [queryClient, id]),
  );
  const {
    data: productFromApi,
    isPending,
    isError,
    error,
    refetch,
  } = useShopProduct(id ?? null);
  const { data: cartItems = [] } = useShopCartQuery();
  const addToCart = useAddToCart();
  const { data: shippingMethods = [] } = useShopShippingMethods();
  const { data: allProducts = [] } = useShopProducts('all');

  const product = useMemo(() => {
    if (productFromApi) return productFromApi;
    if (!id) return undefined;
    return allProducts.find((p) => p.id === id);
  }, [productFromApi, allProducts, id]);

  const [selectedVariant, setSelectedVariant] = useState<ShopProductVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const contentWidth = useContentWidth();
  const heroSide = Math.max(contentWidth, 280);

  const variants = product?.shop_product_variants ?? [];
  const images = useMemo(() => {
    const urls = product?.image_urls?.filter(Boolean) ?? [];
    return urls.length ? urls : [];
  }, [product?.image_urls]);

  const displayVariant = useMemo(() => {
    if (variants.length === 0) return null;
    if (selectedVariant) return selectedVariant;
    return variants[0];
  }, [variants, selectedVariant]);

  const stock = displayVariant?.stock_quantity ?? 0;
  const { price, comparePrice } = product
    ? resolveShopProductPrice(product, displayVariant)
    : { price: 0, comparePrice: null };
  const stockLabel = shopProductStockLabel(stock);
  const soldLabel = product ? formatUnitsSoldLabel(product.units_sold ?? 0) : null;
  const categoryName = product?.shop_categories?.name ?? null;

  const cartCount = useMemo(() => cartItems.reduce((n, it) => n + it.quantity, 0), [cartItems]);
  const cartBadge = cartCount > 99 ? '99+' : String(cartCount || '');

  const related = useMemo(() => {
    if (!product) return [];
    const sameCategory = allProducts.filter(
      (p) => p.id !== product.id && product.category_id && p.category_id === product.category_id,
    );
    const pool = sameCategory.length ? sameCategory : allProducts.filter((p) => p.id !== product.id);
    return pool.slice(0, 8);
  }, [allProducts, product]);

  const shipping = shippingMethods[0];
  const freeOver = shipping?.free_over_amount ?? null;
  const shippingLine =
    freeOver != null && price >= freeOver ? 'ส่งฟรี' : shipping ? `ค่าส่ง ฿${shipping.base_fee.toFixed(0)} ขึ้นไป` : 'คำนวณค่าส่งเมื่อสั่งซื้อ';

  const onShare = useCallback(async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `${product.name}\n฿${Number(price).toFixed(0)}`,
        ...Platform.select({ ios: {}, android: { title: product.name } }),
      });
    } catch {
      /* cancelled */
    }
  }, [product, price]);

  const resolveVariantId = useCallback(() => {
    if (displayVariant?.id) return displayVariant.id;
    if (variants.length === 1) return variants[0].id;
    return undefined;
  }, [displayVariant?.id, variants]);

  const addOrBuy = async (mode: 'cart' | 'buy') => {
    if (!product) return;
    const variantId = resolveVariantId();
    if (!variantId) {
      Alert.alert('เลือกตัวเลือก', 'กรุณาเลือกตัวเลือกสินค้า');
      return;
    }
    if (stock <= 0) {
      Alert.alert('สินค้าหมด', 'สินค้ารายการนี้หมดชั่วคราว');
      return;
    }
    const n = Math.max(1, Math.min(qty, stock));
    try {
      await addToCart.mutateAsync({ variantId, quantity: n });
      if (mode === 'buy') {
        router.push('/(tabs)/store/checkout');
      } else {
        Alert.alert('เพิ่มแล้ว', 'สินค้าอยู่ในตะกร้า', [
          { text: 'ช้อปต่อ', style: 'cancel' },
          { text: 'ไปตะกร้า', onPress: () => router.push('/(tabs)/store/cart') },
        ]);
      }
    } catch (e: unknown) {
      Alert.alert('ผิดพลาด', e instanceof Error ? e.message : 'ไม่สามารถดำเนินการได้');
    }
  };

  const onGalleryMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / heroSide);
      if (idx >= 0 && idx < images.length) setImgIndex(idx);
    },
    [images.length, heroSide],
  );

  const headerRight = () => (
    <View style={styles.headerRightCluster}>
      <TouchableOpacity onPress={onShare} hitSlop={8} style={styles.headerIconBtn}>
        <Share2 size={22} color={theme.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/store/cart')}
        hitSlop={8}
        style={styles.headerIconBtn}
      >
        <View>
          <ShoppingCart size={22} color={theme.text} />
          {cartCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartBadge}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );

  const stackHeaderOptions = {
    title: product?.name ?? 'รายละเอียดสินค้า',
    headerShown: !useNativeHeroHeader,
    headerTintColor: theme.text,
    headerStyle: { backgroundColor: theme.surface },
    headerShadowVisible: false,
    headerBackTitle: '',
    headerRight,
  } as const;

  if (!id) {
    return (
      <View style={[styles.center, flexFill, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'ไม่พบสินค้า', headerShown: !useNativeHeroHeader }} />
        <Text style={{ color: theme.text, marginBottom: 16 }}>ไม่พบรหัสสินค้าที่ระบุ</Text>
        <TouchableOpacity 
          style={[styles.retryBtn, { backgroundColor: SHOPEE_ORANGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }]} 
          onPress={() => router.replace('/(tabs)/store')}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>ไปที่ร้านค้า</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isPending && !product) {
    return (
      <View style={[styles.center, flexFill, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ ...stackHeaderOptions, title: 'รายละเอียดสินค้า' }} />
        <ActivityIndicator color={SHOPEE_ORANGE} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.center, flexFill, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ ...stackHeaderOptions, title: 'รายละเอียดสินค้า' }} />
        <Text style={{ color: theme.text, textAlign: 'center', paddingHorizontal: 24 }}>
          {isError ? (error instanceof Error ? error.message : 'โหลดสินค้าไม่สำเร็จ') : 'ไม่พบสินค้า'}
        </Text>
        <TouchableOpacity style={styles.backBtnBare} onPress={() => refetch()}>
          <Text style={{ color: SHOPEE_ORANGE, fontWeight: '800' }}>ลองอีกครั้ง</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.mutedForeground, marginTop: 8 }}>กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showVariantStrip = variants.length > 1;
  const paymentHint =
    process.env.EXPO_PUBLIC_PAYMENT_BANK?.trim() ?
      `โอนเงิน · ${process.env.EXPO_PUBLIC_PAYMENT_BANK.trim()}`
    : 'ชำระด้วยการโอนเงินและแนบสลิปยืนยัน';

  const footerEl = (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.footerTeal, { backgroundColor: FOOTER_TEAL }]}>
        <TouchableOpacity style={styles.footerSplitBtn} onPress={() => Alert.alert('แชท', 'เปิดใช้แชทกับร้านเร็วๆ นี้')}>
          <MessageCircle size={22} color="#fff" />
          <Text style={styles.footerSplitText}>แชทเลย</Text>
        </TouchableOpacity>
        <View style={styles.footerTealDivider} />
        <TouchableOpacity
          style={styles.footerSplitBtn}
          onPress={() => addOrBuy('cart')}
          disabled={addToCart.isPending}
        >
          <ShoppingCart size={22} color="#fff" />
          <Text style={styles.footerSplitText}>เพิ่มไปยัง{'\n'}รถเข็น</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.footerBuy, { backgroundColor: SHOPEE_ORANGE }]}
        onPress={() => addOrBuy('buy')}
        disabled={addToCart.isPending}
      >
        {addToCart.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.footerBuyTop}>ซื้อโดยใช้โค้ด</Text>
            <Text style={styles.footerBuyPrice}>฿{Number(price).toFixed(0)}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const scrollBody = (
    <>
        <View style={[styles.heroWrap, { height: heroSide }]}>
          {images.length > 0 ? (
            Platform.OS === 'web' ? (
              <Image
                source={{ uri: images[imgIndex] ?? images[0] }}
                style={{ width: '100%', height: heroSide }}
                resizeMode="cover"
              />
            ) : (
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri, i) => `${uri}-${i}`}
                onMomentumScrollEnd={onGalleryMomentumEnd}
                getItemLayout={(_, index) => ({
                  length: heroSide,
                  offset: heroSide * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: heroSide, height: heroSide }}
                    resizeMode="cover"
                  />
                )}
              />
            )
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: theme.border, height: heroSide }]} />
          )}

          {useNativeHeroHeader ? (
            <View style={[styles.heroOverlayHeader, { paddingTop: insets.top + 6 }]}>
              <TouchableOpacity
                style={[styles.iconCircle, { backgroundColor: isDark ? '#0008' : '#fff' }]}
                onPress={() => router.back()}
                hitSlop={12}
              >
                <ArrowLeft size={22} color={isDark ? '#fff' : '#222'} />
              </TouchableOpacity>
              <View style={[styles.searchPill, { backgroundColor: isDark ? '#0008' : '#f3f4f6' }]}>
                <Search size={16} color={theme.mutedForeground} />
                <Text style={[styles.searchPlaceholder, { color: theme.mutedForeground }]} numberOfLines={1}>
                  {product.name.slice(0, 42)}
                  {product.name.length > 42 ? '…' : ''}
                </Text>
              </View>
              <View style={styles.headerRightCluster}>
                <TouchableOpacity onPress={onShare} hitSlop={8} style={styles.headerIconBtn}>
                  <Share2 size={22} color={isDark ? '#fff' : '#222'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/store/cart')}
                  hitSlop={8}
                  style={styles.headerIconBtn}
                >
                  <View>
                    <ShoppingCart size={22} color={isDark ? '#fff' : '#222'} />
                    {cartCount > 0 ? (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{cartBadge}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={8}
                  style={styles.headerIconBtn}
                  onPress={() =>
                    Alert.alert('เพิ่มเติม', undefined, [
                      { text: 'แชร์สินค้า', onPress: onShare },
                      { text: 'ปิด', style: 'cancel' },
                    ])
                  }
                >
                  <MoreVertical size={22} color={isDark ? '#fff' : '#222'} />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {images.length > 1 ? (
            <View style={styles.imgPager}>
              <Text style={styles.imgPagerText}>
                {imgIndex + 1}/{images.length}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {showVariantStrip ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>
                {variants.length} ตัวเลือกสินค้า
              </Text>
              <HorizontalScroller style={styles.variantScroll}>
                {variants.map((v) => {
                  const active = displayVariant?.id === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      onPress={() => setSelectedVariant(v)}
                      style={[
                        styles.variantThumb,
                        {
                          borderColor: active ? SHOPEE_ORANGE : theme.border,
                          borderWidth: active ? 2 : 1,
                        },
                      ]}
                    >
                      {images[0] ? (
                        <Image source={{ uri: images[0] }} style={styles.variantThumbImg} />
                      ) : (
                        <View style={[styles.variantThumbImg, { backgroundColor: theme.border }]} />
                      )}
                      <Text style={[styles.variantThumbLabel, { color: theme.text }]} numberOfLines={1}>
                        {v.size_label || `฿${v.price}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </HorizontalScroller>
            </>
          ) : null}

          <View style={styles.priceRow}>
            {comparePrice != null ? (
              <Text style={[styles.priceCompare, { color: theme.mutedForeground }]}>
                ฿{comparePrice.toFixed(0)}
              </Text>
            ) : null}
            <Text style={styles.priceMain}>฿{Number(price).toFixed(0)}</Text>
            {soldLabel ?
              <Text style={[styles.soldText, { color: theme.mutedForeground }]}>{soldLabel}</Text>
            : null}
            <Text style={[styles.soldText, { color: theme.mutedForeground }]}>{stockLabel}</Text>
          </View>

          <View style={styles.titleRow}>
            {categoryName ? (
              <View style={[styles.recBadge, { backgroundColor: theme.secondary }]}>
                <Text style={[styles.recBadgeText, { color: theme.text }]}>{categoryName}</Text>
              </View>
            ) : null}
            <Text style={[styles.title, { color: theme.text }]}>{product.name}</Text>
          </View>

          <View style={[styles.infoRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.infoRowInner} activeOpacity={0.7}>
              <Truck size={20} color="#22C55E" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: theme.text }]}>
                  {shipping?.name ?? 'การจัดส่ง'}
                </Text>
                <Text style={[styles.infoSub, { color: theme.mutedForeground }]}>{shippingLine}</Text>
              </View>
              <ChevronRight size={20} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.infoRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.infoRowInner} activeOpacity={0.7}>
              <Shield size={20} color={SHOPEE_ORANGE} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: theme.text }]}>การชำระเงิน</Text>
                <Text style={[styles.infoSub, { color: theme.mutedForeground }]}>{paymentHint}</Text>
              </View>
              <ChevronRight size={20} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <ShopBlock
          theme={theme}
          related={related}
          productCount={allProducts.length}
          categoryName={categoryName}
          onOpenStore={() => router.push('/(tabs)/store')}
          onProductPress={(pid) => navigateToShopProduct(pid)}
        />

        <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 8 }]}>
          <View style={styles.rowChevron}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>ข้อมูลสินค้า</Text>
          </View>
          <View style={[styles.attrRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.attrLabel, { color: theme.mutedForeground }]}>ประเภท</Text>
            <Text style={[styles.attrValue, { color: theme.text }]}>
              {shopProductTypeLabel(product.product_type)}
            </Text>
          </View>
          <View style={[styles.attrRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.attrLabel, { color: theme.mutedForeground }]}>คงเหลือ</Text>
            <Text style={[styles.attrValue, { color: theme.text }]}>{stockLabel}</Text>
          </View>
          {displayVariant?.sku ? (
            <View style={[styles.attrRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.attrLabel, { color: theme.mutedForeground }]}>SKU</Text>
              <Text style={[styles.attrValue, { color: theme.text }]}>{displayVariant.sku}</Text>
            </View>
          ) : null}
          {displayVariant?.size_label ? (
            <View style={[styles.attrRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.attrLabel, { color: theme.mutedForeground }]}>ตัวเลือก</Text>
              <Text style={[styles.attrValue, { color: theme.text }]}>{displayVariant.size_label}</Text>
            </View>
          ) : null}
          {product.description?.trim() ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.detailBlock}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>รายละเอียด</Text>
                <Text style={[styles.desc, { color: theme.mutedForeground }]}>{product.description.trim()}</Text>
              </View>
            </>
          ) : null}
        </View>

        {id ?
          <ProductReviewsSection
            productId={id}
            ratingAvg={product.rating_avg}
            reviewCount={product.review_count}
            theme={theme}
            isDark={isDark}
          />
        : null}

        <View style={styles.qtyBar}>
          <Text style={[styles.qtyLabel, { color: theme.text }]}>จำนวน</Text>
          <View style={[styles.qtyStepper, { borderColor: theme.border }]}>
            <TouchableOpacity
              onPress={() => setQty((q) => Math.max(1, q - 1))}
              style={styles.qtyStepBtn}
              disabled={qty <= 1}
            >
              <Minus size={18} color={qty <= 1 ? theme.muted : theme.text} />
            </TouchableOpacity>
            <Text style={[styles.qtyNum, { color: theme.text }]}>{qty}</Text>
            <TouchableOpacity onPress={() => setQty((q) => q + 1)} style={styles.qtyStepBtn}>
              <Plus size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, flexFill, styles.column, { backgroundColor: PAGE_BG }]}>
        <Stack.Screen options={stackHeaderOptions} />
        <ScrollView
          style={[flexFill, styles.scroll]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {scrollBody}
        </ScrollView>
        {footerEl}
      </View>
    );
  }

  return (
    <View style={[styles.root, flexFill, styles.column, { backgroundColor: PAGE_BG }]}>
      <Stack.Screen options={stackHeaderOptions} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        {...stackMainScrollProps}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 16 }]}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SHOPEE_ORANGE} />
        }
      >
        {scrollBody}
      </ScrollView>

      {footerEl}
    </View>
  );
}

/** Nested horizontal ScrollView breaks parent scroll height on react-native-web. */
function HorizontalScroller({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (Platform.OS === 'web') {
    return <View style={[styles.webHorizontalRow, style]}>{children}</View>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
      {children}
    </ScrollView>
  );
}

function ShopBlock({
  theme,
  related,
  productCount,
  categoryName,
  onOpenStore,
  onProductPress,
}: {
  theme: import('@/hooks/use-theme').AppTheme;
  related: ShopProduct[];
  productCount: number;
  categoryName: string | null;
  onOpenStore: () => void;
  onProductPress: (id: string) => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 8 }]}>
      <View style={styles.shopHeader}>
        <View style={styles.shopAvatar}>
          <Text style={{ fontWeight: '900', color: SHOPEE_ORANGE, fontSize: 12 }}>PS</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.shopName, { color: theme.text }]}>ร้านค้า PSUSCC</Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 2 }}>
            {categoryName ?
              `หมวด ${categoryName}`
            : productCount > 0 ?
              `${productCount} รายการสินค้า`
            : 'ร้านค้านักศึกษา'}
          </Text>
        </View>
        <TouchableOpacity style={styles.viewShopBtn} onPress={onOpenStore}>
          <Text style={styles.viewShopBtnText}>ดูร้านค้า</Text>
        </TouchableOpacity>
      </View>

      {related.length ? (
        <>
          <TouchableOpacity style={styles.bestTitleRow} activeOpacity={0.7} onPress={onOpenStore}>
            <Text style={[styles.bestTitle, { color: theme.text }]}>สินค้าที่เกี่ยวข้อง</Text>
            <ChevronRight size={20} color={theme.mutedForeground} />
          </TouchableOpacity>
          <HorizontalScroller>
            {related.map((p) => {
              const img = p.image_urls?.[0];
              const minP =
                p.shop_product_variants?.length ?
                  Math.min(...p.shop_product_variants.map((v) => v.price))
                : p.base_price ?? 0;
              const totalStock = shopProductTotalStock(p);
              const relStockLabel =
                (p.shop_product_variants?.length ?? 0) > 0 ? shopProductStockLabel(totalStock) : null;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.relCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => onProductPress(p.id)}
                >
                  {img ?
                    <Image source={{ uri: img }} style={styles.relImg} />
                  : <View style={[styles.relImg, { backgroundColor: theme.border }]} />}
                  <Text style={[styles.relTitle, { color: theme.text }]} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.relPrice}>฿{minP.toFixed(0)}</Text>
                  {relStockLabel ?
                    <Text style={[styles.relSold, { color: theme.mutedForeground }]}>{relStockLabel}</Text>
                  : null}
                </TouchableOpacity>
              );
            })}
          </HorizontalScroller>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  retryBtn: {},
  column: { flexDirection: 'column', minHeight: 0 },
  scroll: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  scrollContent: { width: '100%', flexGrow: 0 },
  webHorizontalRow: {
    flexDirection: 'row',
    gap: 8,
    maxWidth: '100%',
    overflow: 'scroll',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtnBare: { marginTop: 16, padding: 12 },
  heroWrap: {
    width: '100%',
    backgroundColor: '#fff',
    position: 'relative',
    overflow: 'hidden',
  },
  heroPlaceholder: { width: '100%' },
  heroOverlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    minWidth: 0,
  },
  searchPlaceholder: { flex: 1, fontSize: 13 },
  headerRightCluster: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  cartBadge: {
    position: 'absolute',
    right: -8,
    top: -6,
    backgroundColor: SHOPEE_ORANGE,
    borderRadius: 10,
    minWidth: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  imgPager: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#0006',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imgPagerText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  promoRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
  },
  promoChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ skewX: '-8deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoChipText: { color: '#fff', fontSize: 10, fontWeight: '800', transform: [{ skewX: '8deg' }] },
  card: {
    marginHorizontal: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionLabel: { fontSize: 13, marginBottom: 8 },
  variantScroll: { marginBottom: 12, marginHorizontal: -4 },
  variantThumb: {
    width: 72,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  variantThumbImg: { width: '100%', aspectRatio: 1 },
  variantThumbLabel: { fontSize: 11, padding: 4, textAlign: 'center', fontWeight: '600' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  priceCompare: { fontSize: 16, textDecorationLine: 'line-through' },
  priceMain: { fontSize: 28, fontWeight: '900', color: SHOPEE_ORANGE },
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  attrLabel: { fontSize: 14 },
  attrValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  priceMeta: { flexDirection: 'row', alignItems: 'center' },
  priceAfterCode: { fontSize: 12, color: SHOPEE_ORANGE, fontWeight: '700' },
  soldText: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
  titleRow: { marginTop: 12 },
  recBadge: {
    alignSelf: 'flex-start',
    backgroundColor: SHOPEE_ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  recBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  infoRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoTitle: { fontSize: 14, fontWeight: '700' },
  infoSub: { fontSize: 12, marginTop: 4 },
  infoHint: { fontSize: 11, marginTop: 6, fontWeight: '600' },
  shopHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
  },
  shopName: { fontSize: 15, fontWeight: '800' },
  viewShopBtn: {
    borderWidth: 1,
    borderColor: SHOPEE_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  viewShopBtnText: { color: SHOPEE_ORANGE, fontSize: 12, fontWeight: '800' },
  shopStats: {
    flexDirection: 'row',
    marginTop: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  shopStatCol: { flex: 1, alignItems: 'center' },
  shopStatDivider: { width: StyleSheet.hairlineWidth },
  shopStatNum: { fontSize: 16, fontWeight: '900' },
  shopStatLabel: { fontSize: 11, marginTop: 4 },
  bestTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 10,
  },
  bestTitle: { fontSize: 14, fontWeight: '800' },
  relCard: {
    width: 118,
    marginRight: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
  },
  relImg: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  relTitle: { fontSize: 11, marginTop: 6, minHeight: 28, fontWeight: '600' },
  relPrice: { fontSize: 13, fontWeight: '900', color: SHOPEE_ORANGE, marginTop: 4 },
  relSold: { fontSize: 10, marginTop: 2 },
  rowChevron: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rowTitle: { fontWeight: '800', fontSize: 14 },
  rowValue: { flex: 1, fontSize: 13, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  detailBlock: { paddingBottom: 4 },
  detailHead: { fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 22 },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  reviewScore: { fontSize: 22, fontWeight: '900' },
  reviewMeta: { flex: 1, fontSize: 13 },
  aiCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  aiTitle: { fontWeight: '800', fontSize: 13 },
  aiBody: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  reviewSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  sampleReview: { paddingBottom: 8 },
  reviewer: { fontSize: 12 },
  reviewVariant: { fontSize: 12, marginTop: 8 },
  reviewText: { fontSize: 13, lineHeight: 20, marginTop: 8 },
  qtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  qtyLabel: { fontWeight: '800', fontSize: 14 },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyStepBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  qtyNum: { minWidth: 36, textAlign: 'center', fontWeight: '800', fontSize: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    minHeight: FOOTER_BAR_HEIGHT,
  },
  footerTeal: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 4,
    minWidth: 0,
    maxHeight: 64,
  },
  footerTealDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#ffffff44' },
  footerSplitBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  footerSplitText: { color: '#fff', fontSize: 10, fontWeight: '800', textAlign: 'center', lineHeight: 13 },
  footerBuy: {
    flex: 6,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    maxHeight: 64,
  },
  footerBuyTop: { color: '#fff', fontSize: 13, fontWeight: '800' },
  footerBuyPrice: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 2 },
});
