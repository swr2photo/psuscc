import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, ChevronRight, Store, Tag } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { useShopCartQuery, useRemoveCartItem, useUpdateCartQty } from '@/features/shop/api/useShopCart';
import type { ShopCartItem } from '@/features/shop/types';
import { SkeletonCartPage } from '@/components/ui/skeleton-presets';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import { navigateToShopProduct } from '@/features/shop/navigateToProduct';
import { flexFill } from '@/constants/layout';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';

/** Shopee-style primary orange */
const SHOPEE_ORANGE = '#EE4D2D';
const PAGE_BG = '#F5F5F5';
const CARD_RADIUS = 10;

export default function StoreCartScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: items = [], isPending, refetch: refetchCart } = useShopCartQuery();
  const { refreshing, onRefresh } = usePullToRefresh(() => refetchCart());
  const remove = useRemoveCartItem();
  const updateQty = useUpdateCartQty();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectionInit = useRef(false);
  const cartIdsSigRef = useRef<string>('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const sig = items.map((i) => i.id).sort().join(',');
    if (!items.length) {
      setSelected(new Set());
      selectionInit.current = false;
      cartIdsSigRef.current = '';
      return;
    }

    if (!selectionInit.current) {
      setSelected(new Set(items.map((i) => i.id)));
      selectionInit.current = true;
      cartIdsSigRef.current = sig;
      return;
    }

    if (sig === cartIdsSigRef.current) {
      return;
    }
    cartIdsSigRef.current = sig;

    setSelected((prev) => {
      const idSet = new Set(items.map((i) => i.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (idSet.has(id)) next.add(id);
      }
      for (const it of items) {
        if (!prev.has(it.id)) next.add(it.id);
      }
      return next;
    });
  }, [items]);

  const selectedList = useMemo(() => items.filter((it) => selected.has(it.id)), [items, selected]);
  const allSelected = items.length > 0 && selectedList.length === items.length;
  const selectedCount = selectedList.length;

  const selectedSubtotal = useMemo(
    () => selectedList.reduce((s, it) => s + it.shop_product_variants.price * it.quantity, 0),
    [selectedList],
  );

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  }, [allSelected, items]);

  const toggleStoreAll = useCallback(() => {
    const ids = items.map((i) => i.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, [items, selected]);

  const goCheckout = () => {
    if (!selectedCount) {
      Alert.alert('เลือกสินค้า', 'กรุณาเลือกสินค้าที่ต้องการชำระเงิน');
      return;
    }
    ensureAuthedOrGoAuth(router, { message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }).then((ok) => {
      if (!ok) return;
      const ids = selectedList.map((i) => i.id).join(',');
      router.push({ pathname: '/(tabs)/store/checkout', params: { selected: ids } });
    });
  };

  const pageBg = isDark ? theme.background : PAGE_BG;
  const cardBg = theme.surface;

  if (isPending) {
    return (
      <View style={[styles.root, flexFill, { backgroundColor: pageBg }]}>
        <Stack.Screen options={{ title: 'รถเข็น' }} />
        <SkeletonCartPage />
      </View>
    );
  }

  return (
    <View style={[styles.root, flexFill, { backgroundColor: pageBg }]}>
      <Stack.Screen
        options={{
          title: `รถเข็น (${items.length})`,
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: cardBg },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setEditMode((v) => !v)}
              style={{ marginRight: Platform.OS === 'ios' ? 0 : 16 }}
              hitSlop={12}
            >
              <Text style={{ color: SHOPEE_ORANGE, fontWeight: '800', fontSize: 15 }}>
                {editMode ? 'เสร็จสิ้น' : 'แก้ไข'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {!items.length ? (
        <ScrollView
          style={flexFill}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: 80,
          }}
          refreshControl={
            <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SHOPEE_ORANGE} />
          }
        >
          <View style={styles.center}>
            <Text style={{ color: theme.mutedForeground, fontWeight: '700' }}>ตะกร้าว่าง</Text>
            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.replace('/(tabs)/store')}>
              <Text style={{ color: SHOPEE_ORANGE, fontWeight: '800' }}>ไปเลือกสินค้า</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            style={flexFill}
            contentContainerStyle={{
              padding: 10,
              paddingBottom: 120 + insets.bottom,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SHOPEE_ORANGE} />
            }
          >
            <View style={[styles.storeCard, { backgroundColor: cardBg }]}>
              <View style={styles.storeHeader}>
                <CartCheck checked={items.every((i) => selected.has(i.id))} onToggle={toggleStoreAll} />
                <Store size={16} color={theme.text} />
                <Text style={[styles.storeName, { color: theme.text }]} numberOfLines={1}>
                  PSU SCC Store
                </Text>
                <ChevronRight size={16} color={theme.mutedForeground} />
                <View style={{ flex: 1 }} />
                {editMode ? (
                  <Text style={{ color: SHOPEE_ORANGE, fontWeight: '700', fontSize: 13 }}>เลือกลบ</Text>
                ) : null}
              </View>

              {items.map((item) => (
                <CartLine
                  key={item.id}
                  item={item}
                  checked={selected.has(item.id)}
                  onToggleCheck={() => toggleItem(item.id)}
                  editMode={editMode}
                  onInc={() => updateQty.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                  onDec={() => updateQty.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                  onRemove={() =>
                    remove.mutate(item.id, {
                      onError: (e) => Alert.alert('ผิดพลาด', e.message),
                    })
                  }
                  onOpenProduct={() =>
                    navigateToShopProduct(item.shop_product_variants.product_id)
                  }
                  themeText={theme.text}
                  themeMuted={theme.mutedForeground}
                />
              ))}

              <TouchableOpacity style={styles.voucherRow} activeOpacity={0.7}>
                <Tag size={16} color={SHOPEE_ORANGE} />
                <Text style={[styles.voucherText, { color: theme.text }]} numberOfLines={1}>
                  โค้ดส่วนลดร้าน (เร็ว ๆ นี้)
                </Text>
                <ChevronRight size={16} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={[styles.promoHint, { backgroundColor: cardBg }]}>
              <Text style={{ color: theme.mutedForeground, fontSize: 13 }} numberOfLines={2}>
                เลือกสินค้าแล้วกดชำระเงิน — จัดส่งตามวิธีที่เลือกในหน้าชำระเงิน
              </Text>
            </View>
          </ScrollView>

          <View
            style={[
              styles.stickyFooter,
              {
                backgroundColor: cardBg,
                borderTopColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            <View style={styles.footerTop}>
              <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll} activeOpacity={0.75}>
                <CartCheck checked={allSelected} onToggle={toggleAll} />
                <Text style={{ color: theme.text, fontWeight: '700', marginLeft: 10 }}>ทั้งหมด</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <Text style={{ color: theme.mutedForeground, fontSize: 13, marginRight: 6 }}>รวม</Text>
              <Text style={styles.footerTotal}>฿{selectedSubtotal.toFixed(0)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={goCheckout} activeOpacity={0.9}>
              <Text style={styles.checkoutBtnText}>
                ชำระเงิน ({selectedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function CartCheck({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={[
        styles.checkbox,
        {
          borderColor: checked ? SHOPEE_ORANGE : '#c7c7cc',
          backgroundColor: checked ? SHOPEE_ORANGE : 'transparent',
        },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {checked ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
    </TouchableOpacity>
  );
}

function CartLine({
  item,
  checked,
  onToggleCheck,
  editMode,
  onInc,
  onDec,
  onRemove,
  onOpenProduct,
  themeText,
  themeMuted,
}: {
  item: ShopCartItem;
  checked: boolean;
  onToggleCheck: () => void;
  editMode: boolean;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onOpenProduct: () => void;
  themeText: string;
  themeMuted: string;
}) {
  const v = item.shop_product_variants;
  const p = v.shop_products;
  const img = p.image_urls?.[0];
  const variantLabel = v.size_label ? `${v.size_label}` : 'ตัวเลือกเริ่มต้น';

  return (
    <View style={styles.lineWrap}>
      <View style={styles.lineRow}>
        <CartCheck checked={checked} onToggle={onToggleCheck} />
        {img ? (
          <Image source={{ uri: img }} style={styles.lineThumb} />
        ) : (
          <View style={[styles.lineThumb, { backgroundColor: '#eee' }]} />
        )}
        <View style={styles.lineBody}>
          <Text style={[styles.lineTitle, { color: themeText }]} numberOfLines={2}>
            {p.name}
          </Text>
          <TouchableOpacity
            style={[styles.variantPill, { backgroundColor: '#f0f0f0' }]}
            onPress={onOpenProduct}
            activeOpacity={0.8}
          >
            <Text style={{ color: themeMuted, fontSize: 13 }} numberOfLines={1}>
              {variantLabel}
            </Text>
            <ChevronDown size={14} color={themeMuted} />
          </TouchableOpacity>
          <View style={styles.priceQtyRow}>
            <Text style={styles.linePrice}>฿{v.price.toFixed(0)}</Text>
            <View style={styles.qtyBox}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={onDec}
                disabled={item.quantity <= 1}
              >
                <Text style={{ color: item.quantity <= 1 ? '#ccc' : themeText, fontSize: 18, fontWeight: '700' }}>
                  −
                </Text>
              </TouchableOpacity>
              <Text style={[styles.qtyNum, { color: themeText }]}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={onInc}>
                <Text style={{ color: themeText, fontSize: 18, fontWeight: '700' }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          {editMode ? (
            <TouchableOpacity onPress={onRemove} style={styles.removeLink}>
              <Text style={{ color: '#ee4d2d', fontWeight: '800' }}>ลบ</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storeCard: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    marginBottom: 10,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  storeName: { flex: 1, fontWeight: '800', fontSize: 15 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  lineRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
    gap: 10,
  },
  lineThumb: {
    width: 88,
    height: 88,
    borderRadius: 4,
  },
  lineBody: { flex: 1, minWidth: 0 },
  lineTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  variantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
    maxWidth: '100%',
  },
  priceQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  linePrice: { fontSize: 16, fontWeight: '900', color: SHOPEE_ORANGE },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  qtyNum: {
    minWidth: 32,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e8e8e8',
    paddingVertical: 6,
  },
  removeLink: { marginTop: 8, alignSelf: 'flex-start' },
  voucherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  voucherText: { flex: 1, fontWeight: '600', fontSize: 14 },
  promoHint: {
    padding: 14,
    borderRadius: CARD_RADIUS,
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  footerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectAllRow: { flexDirection: 'row', alignItems: 'center' },
  footerTotal: { fontSize: 18, fontWeight: '900', color: SHOPEE_ORANGE },
  checkoutBtn: {
    backgroundColor: SHOPEE_ORANGE,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
