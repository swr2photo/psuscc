import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { flexFill } from '@/constants/layout';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Search,
  MessageCircle,
  ChevronRight,
  Store,
  PackageSearch,
  Coins,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/use-theme';
import { invokeTrackParcel, useShopOrders } from '@/features/shop/api/useShopOrders';
import { useShopProducts } from '@/features/shop/api/useShopCatalog';
import type { ShopOrder, ShopOrderStatus } from '@/features/shop/types';
import type { ShopProduct } from '@/features/shop/types';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonOrdersList } from '@/components/ui/skeleton-presets';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { isTablet } from '@/lib/utils';
import { navigateToShopProduct } from '@/features/shop/navigateToProduct';

const SHOPEE_ORANGE = '#EE4D2D';
const PAGE_BG = '#F5F5F5';
const SHIP_BANNER_BG = '#E8F8F2';
const REC_GRID_H_PAD = 32;
const GRID_GAP = 8;

type TabId = 'all' | 'to_pay' | 'to_ship' | 'to_receive' | 'completed' | 'returns';

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'to_pay', label: 'ที่ต้องชำระ' },
  { id: 'to_ship', label: 'ที่ต้องจัดส่ง' },
  { id: 'to_receive', label: 'ที่ต้องได้รับ' },
  { id: 'completed', label: 'สำเร็จ' },
  { id: 'returns', label: 'การคืนเงิน/คืนสินค้า' },
];

const TAB_STATUSES: Record<TabId, ShopOrderStatus[] | null> = {
  all: null,
  to_pay: ['pending_payment', 'payment_review', 'payment_failed'],
  to_ship: ['paid', 'fulfilling'],
  to_receive: ['shipped'],
  completed: ['completed'],
  returns: ['cancelled'],
};

function unwrapJoin<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

type OrderLineRow = {
  id: string;
  order_id: string;
  quantity: number;
  unit_price: number;
  shop_products: { name: string; image_urls: string[] } | null;
  shop_product_variants: { size_label: string | null; price: number } | null;
};

function shopeeHeadlineStatus(status: ShopOrderStatus): string {
  switch (status) {
    case 'pending_payment':
    case 'payment_review':
    case 'payment_failed':
      return 'ที่ต้องชำระ';
    case 'paid':
    case 'fulfilling':
      return 'ที่ต้องจัดส่ง';
    case 'shipped':
      return 'ที่ต้องได้รับ';
    case 'completed':
      return 'สำเร็จ';
    case 'cancelled':
      return 'ยกเลิก';
    default:
      return status;
  }
}

const THAI_MO_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function estimateDeliveryRange(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d1 = new Date(t + 2 * 86400000);
  const d2 = new Date(t + 4 * 86400000);
  return `${d1.getDate()} ${THAI_MO_SHORT[d1.getMonth()]} - ${d2.getDate()} ${THAI_MO_SHORT[d2.getMonth()]}`;
}

function rateDeadlineThai(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 14 * 86400000);
  return `${d.getDate()} ${THAI_MO_SHORT[d.getMonth()]}`;
}

function displayGridPrice(p: ShopProduct): number {
  const v = p.shop_product_variants ?? [];
  if (v.length === 0) return p.base_price ?? 0;
  return Math.min(...v.map((x) => x.price));
}

export default function StoreOrdersScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const recGridCols = isTablet ? 3 : 2;
  const recCardW = useMemo(() => {
    const gaps = GRID_GAP * (recGridCols - 1);
    return (windowWidth - REC_GRID_H_PAD - gaps) / recGridCols;
  }, [windowWidth, recGridCols]);
  const { data: orders = [], isPending, refetch } = useShopOrders();
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());
  const { data: catalog = [] } = useShopProducts('all');
  const [tab, setTab] = useState<TabId>('all');
  const [autoUpdating, setAutoUpdating] = useState(false);
  const lastAutoUpdateRef = useRef<number>(0);

  const orderIds = useMemo(() => (orders as ShopOrder[]).map((o) => o.id), [orders]);

  const { data: rawLines = [], isLoading: linesLoading } = useQuery({
    queryKey: ['shop', 'orders', 'lines', orderIds.join(',')],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_order_items')
        .select(
          `
          id,
          order_id,
          quantity,
          unit_price,
          shop_products ( name, image_urls ),
          shop_product_variants ( size_label, price )
        `,
        )
        .in('order_id', orderIds);
      if (error) throw error;
      return data as unknown as Record<string, unknown>[];
    },
  });

  const linesByOrder = useMemo(() => {
    const m: Record<string, OrderLineRow[]> = {};
    for (const row of rawLines) {
      const r = row as {
        id: string;
        order_id: string;
        quantity: number;
        unit_price: unknown;
        shop_products?: unknown;
        shop_product_variants?: unknown;
      };
      const line: OrderLineRow = {
        id: r.id,
        order_id: r.order_id,
        quantity: r.quantity,
        unit_price: Number(r.unit_price),
        shop_products: unwrapJoin(r.shop_products as OrderLineRow['shop_products']),
        shop_product_variants: unwrapJoin(r.shop_product_variants as OrderLineRow['shop_product_variants']),
      };
      if (!m[line.order_id]) m[line.order_id] = [];
      m[line.order_id].push(line);
    }
    return m;
  }, [rawLines]);

  const filteredOrders = useMemo(() => {
    const list = orders as ShopOrder[];
    const allowed = TAB_STATUSES[tab];
    if (!allowed) return list;
    return list.filter((o) => allowed.includes(o.status));
  }, [orders, tab]);

  const candidates = useMemo(() => {
    const now = Date.now();
    const maxAgeMs = 30 * 60 * 1000;
    return (orders as ShopOrder[])
      .map((o) => ({
        id: o.id,
        tracking: o.shop_shipments?.tracking_number ?? null,
        updatedAt: o.shop_shipments?.updated_at ?? null,
        lastStatus: o.shop_shipments?.last_status ?? null,
      }))
      .filter((x) => !!x.tracking)
      .filter((x) => {
        if (!x.updatedAt) return true;
        if (!x.lastStatus) return true;
        const t = Date.parse(x.updatedAt);
        if (!Number.isFinite(t)) return true;
        return now - t > maxAgeMs;
      })
      .slice(0, 3);
  }, [orders]);

  useEffect(() => {
    if (isPending) return;
    if (!candidates.length) return;
    const now = Date.now();
    if (now - lastAutoUpdateRef.current < 60_000) return;

    let cancelled = false;
    lastAutoUpdateRef.current = now;

    (async () => {
      try {
        setAutoUpdating(true);
        for (const c of candidates) {
          if (cancelled) return;
          await invokeTrackParcel(c.id, c.tracking ?? undefined);
        }
      } finally {
        if (!cancelled) {
          setAutoUpdating(false);
          await refetch();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidates, isPending, refetch]);

  const recommend = useMemo(() => catalog.slice(0, 20), [catalog]);

  const listHeader = useCallback(
    () => (
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => setTab(t.id)} activeOpacity={0.7}>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? SHOPEE_ORANGE : theme.mutedForeground, fontWeight: active ? '900' : '600' },
                  ]}
                >
                  {t.label}
                </Text>
                {active ? <View style={styles.tabUnderline} /> : <View style={styles.tabUnderlinePlaceholder} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    ),
    [tab, theme.mutedForeground],
  );

  const listFooter = useCallback(() => {
    if (!recommend.length) return null;
    return (
      <View style={styles.recSection}>
        <View style={styles.recTitleRow}>
          <View style={[styles.recLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.recTitle, { color: theme.mutedForeground }]}>คุณอาจจะชอบสิ่งนี้</Text>
          <View style={[styles.recLine, { backgroundColor: theme.border }]} />
        </View>
        <View style={styles.recGrid}>
          {recommend.map((p) => {
            const img = p.image_urls?.[0];
            const price = displayGridPrice(p);
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.recCard,
                  { width: recCardW, backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => navigateToShopProduct(p.id)}
                activeOpacity={0.9}
              >
                <View style={styles.recImageWrap}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.recImage} />
                  ) : (
                    <View style={[styles.recImage, { backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }]}>
                      <PackageSearch size={28} color={theme.mutedForeground} />
                    </View>
                  )}
                  {price > 0 && p.base_price && p.base_price > price ? (
                    <View style={styles.discBadge}>
                      <Text style={styles.discBadgeText}>
                        -{Math.round((1 - price / p.base_price) * 100)}%
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.recName, { color: theme.text }]} numberOfLines={2}>
                  {p.name}
                </Text>
                <Text style={styles.recPrice}>฿{price.toFixed(0)}</Text>
                <Text style={[styles.recSold, { color: theme.mutedForeground }]}>ขายได้ 1พัน+ ชิ้น</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }, [recommend, router, theme, recCardW]);

  if (isPending) {
    return (
      <View style={[styles.root, { backgroundColor: PAGE_BG, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity style={styles.topIcon} onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: theme.text }]}>การซื้อของฉัน</Text>
          <View style={styles.topRight}>
            <View style={styles.topIcon} />
            <View style={styles.topIcon} />
          </View>
        </View>
        <SkeletonOrdersList />
      </View>
    );
  }

  return (
    <View style={[styles.root, flexFill, { backgroundColor: PAGE_BG, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.topIcon} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.text }]}>การซื้อของฉัน</Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.topIcon} onPress={() => Alert.alert('ค้นหา', 'เร็วๆ นี้')} hitSlop={8}>
            <Search size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIcon} onPress={() => Alert.alert('แชท', 'เร็วๆ นี้')} hitSlop={8}>
            <MessageCircle size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {(() => {
        const emptyOrders = (
          <View style={styles.emptyWrap}>
            {linesLoading && orderIds.length > 0 ? (
              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <Skeleton width={160} height={20} borderRadius={10} />
                <Skeleton width="70%" height={14} borderRadius={7} tone="muted" style={{ marginTop: 12 }} />
              </View>
            ) : (
              <>
                <View style={[styles.emptyIcon, { backgroundColor: theme.secondary }]}>
                  <Store size={40} color={theme.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.mutedForeground }]}>ยังไม่มีการสั่งซื้อ</Text>
              </>
            )}
          </View>
        );
        const contentStyle = {
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 24 + insets.bottom,
          flexGrow: 1,
        } as const;
        const refresh = (
          <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SHOPEE_ORANGE} />
        );

        if (Platform.OS === 'web') {
          return (
            <ScrollView
              style={flexFill}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={contentStyle}
              refreshControl={refresh}
            >
              {listHeader()}
              {filteredOrders.length ?
                filteredOrders.map((item) => (
                  <OrderCard
                    key={item.id}
                    order={item}
                    lines={linesByOrder[item.id] ?? []}
                    onOpenDetail={() => router.push(`/store/order/${item.id}`)}
                    onTrack={() => router.push(`/store/order/${item.id}`)}
                    onBuyAgain={() => router.push('/(tabs)/store')}
                    theme={theme}
                  />
                ))
              : emptyOrders}
              {listFooter()}
            </ScrollView>
          );
        }

        return (
          <FlatList
            style={flexFill}
            data={filteredOrders}
            keyExtractor={(o) => o.id}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={contentStyle}
            refreshControl={refresh}
            ListEmptyComponent={emptyOrders}
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                lines={linesByOrder[item.id] ?? []}
                onOpenDetail={() => router.push(`/store/order/${item.id}`)}
                onTrack={() => router.push(`/store/order/${item.id}`)}
                onBuyAgain={() => router.push('/(tabs)/store')}
                theme={theme}
              />
            )}
          />
        );
      })()}
    </View>
  );
}

function OrderCard({
  order,
  lines,
  onOpenDetail,
  onTrack,
  onBuyAgain,
  theme,
}: {
  order: ShopOrder;
  lines: OrderLineRow[];
  onOpenDetail: () => void;
  onTrack: () => void;
  onBuyAgain: () => void;
  theme: import('@/hooks/use-theme').AppTheme;
}) {
  const statusHeadline = shopeeHeadlineStatus(order.status);
  const lineCount = lines.length || 1;
  const first = lines[0];

  return (
    <View style={[styles.orderCard, { backgroundColor: theme.surface }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={onOpenDetail}>
        <View style={styles.shopRow}>
          <View style={styles.mallBadge}>
            <Text style={styles.mallBadgeText}>Mall</Text>
          </View>
          <Text style={[styles.shopName, { color: theme.text }]} numberOfLines={1}>
            PSUSCC Official Shop
          </Text>
          <Text style={styles.statusOrange}>{statusHeadline}</Text>
        </View>

        {first ? (
          lines.slice(0, 3).map((line) => {
            const img = line.shop_products?.image_urls?.[0];
            const name = line.shop_products?.name ?? 'สินค้า';
            const variant = line.shop_product_variants?.size_label;
            const listPrice = line.shop_product_variants?.price;
            const linePay = line.unit_price * line.quantity;
            const listTotal = listPrice != null ? listPrice * line.quantity : null;
            const showStrike = listTotal != null && listTotal > linePay + 0.01;

            return (
              <View key={line.id} style={styles.lineRow}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.lineImg} />
                ) : (
                  <View style={[styles.lineImg, { backgroundColor: theme.border }]} />
                )}
                <View style={styles.lineMid}>
                  <Text style={[styles.lineTitle, { color: theme.text }]} numberOfLines={2}>
                    {name}
                  </Text>
                  {variant ? (
                    <Text style={[styles.lineVariant, { color: theme.mutedForeground }]}>{variant}</Text>
                  ) : null}
                  <View style={styles.linePriceRow}>
                    {showStrike ? (
                      <Text style={styles.strikePrice}>฿{listTotal!.toFixed(0)} </Text>
                    ) : null}
                    <Text style={[styles.payPrice, { color: theme.text }]}>฿{line.unit_price.toFixed(0)}</Text>
                  </View>
                </View>
                <Text style={[styles.lineQty, { color: theme.mutedForeground }]}>x{line.quantity}</Text>
              </View>
            );
          })
        ) : (
          <View style={styles.lineRow}>
            <View style={[styles.lineImg, { backgroundColor: theme.border }]} />
            <View style={styles.lineMid}>
              <Text style={{ color: theme.mutedForeground }}>กำลังโหลดรายการสินค้า…</Text>
            </View>
          </View>
        )}

        <Text style={[styles.summaryLine, { color: theme.text }]}>
          สินค้ารวม {lineCount} รายการ: ฿{Number(order.total).toFixed(0)}
        </Text>

        {order.status === 'shipped' ? (
          <TouchableOpacity style={styles.shipBanner} onPress={onOpenDetail} activeOpacity={0.85}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shipBannerTitle}>คาดว่าจะได้รับใน {estimateDeliveryRange(order.created_at)}</Text>
              <Text style={styles.shipBannerSub} numberOfLines={2}>
                {order.shop_shipments?.last_status ?? 'พัสดุของคุณอยู่ระหว่างการจัดส่ง'}
              </Text>
            </View>
            <ChevronRight size={20} color="#2D937F" />
          </TouchableOpacity>
        ) : null}

        {order.status === 'completed' ? (
          <TouchableOpacity style={styles.coinRow} onPress={() => Alert.alert('ให้คะแนน', 'เร็วๆ นี้')} activeOpacity={0.85}>
            <Coins size={18} color="#CA8A04" />
            <Text style={styles.coinText} numberOfLines={1}>
              ให้คะแนนภายใน {rateDeadlineThai(order.created_at)} เพื่อรับ Coins
            </Text>
            <ChevronRight size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      <View style={styles.cardActions}>
        {order.status === 'shipped' ? (
          <TouchableOpacity style={styles.btnOutlineOrange} onPress={onTrack}>
            <Text style={styles.btnOutlineOrangeText}>ติดตามคำสั่งซื้อ</Text>
          </TouchableOpacity>
        ) : null}
        {order.status === 'completed' ? (
          <>
            <TouchableOpacity style={styles.btnOutlineBlack} onPress={onBuyAgain}>
              <Text style={[styles.btnOutlineBlackText, { color: theme.text }]}>ซื้ออีกครั้ง</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutlineOrange}
              onPress={() => Alert.alert('ให้คะแนน', 'เร็วๆ นี้')}
            >
              <Text style={styles.btnOutlineOrangeText}>ให้คะแนน</Text>
            </TouchableOpacity>
          </>
        ) : null}
        {order.status === 'pending_payment' ||
        order.status === 'payment_review' ||
        order.status === 'payment_failed' ||
        order.status === 'paid' ||
        order.status === 'fulfilling' ? (
          <TouchableOpacity style={styles.btnOutlineOrange} onPress={onOpenDetail}>
            <Text style={styles.btnOutlineOrangeText}>ดูรายละเอียด</Text>
          </TouchableOpacity>
        ) : null}
        {order.status === 'cancelled' ? (
          <TouchableOpacity style={styles.btnOutlineOrange} onPress={onOpenDetail}>
            <Text style={styles.btnOutlineOrangeText}>ดูรายละเอียด</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topIcon: { padding: 8 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  tabRow: { paddingVertical: 8, paddingHorizontal: 4, gap: 4 },
  tabItem: { paddingHorizontal: 12, paddingBottom: 8, alignItems: 'center' },
  tabLabel: { fontSize: 13 },
  tabUnderline: {
    marginTop: 6,
    height: 2,
    width: '100%',
    backgroundColor: SHOPEE_ORANGE,
    borderRadius: 1,
  },
  tabUnderlinePlaceholder: { marginTop: 6, height: 2, width: '100%' },
  orderCard: {
    borderRadius: 10,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  mallBadge: {
    backgroundColor: SHOPEE_ORANGE,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  mallBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  shopName: { flex: 1, fontWeight: '800', fontSize: 14 },
  statusOrange: { color: SHOPEE_ORANGE, fontWeight: '800', fontSize: 13 },
  lineRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  lineImg: { width: 72, height: 72, borderRadius: 6, backgroundColor: '#eee' },
  lineMid: { flex: 1, minWidth: 0, justifyContent: 'flex-start' },
  lineTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  lineVariant: { fontSize: 12, marginTop: 4 },
  linePriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  strikePrice: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  payPrice: { fontSize: 14, fontWeight: '800' },
  lineQty: { fontSize: 13, fontWeight: '700', alignSelf: 'flex-start' },
  summaryLine: { fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 10 },
  shipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SHIP_BANNER_BG,
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  shipBannerTitle: { fontSize: 13, fontWeight: '800', color: '#166534' },
  shipBannerSub: { fontSize: 12, color: '#15803D', marginTop: 4, fontWeight: '600' },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 6,
  },
  coinText: { flex: 1, fontSize: 12, color: '#854D0E', fontWeight: '700' },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  btnOutlineBlack: {
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnOutlineBlackText: { fontSize: 13, fontWeight: '800' },
  btnOutlineOrange: {
    borderWidth: 1,
    borderColor: SHOPEE_ORANGE,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnOutlineOrangeText: { color: SHOPEE_ORANGE, fontSize: 13, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, minHeight: 220 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  recSection: { marginTop: 20, paddingBottom: 16 },
  recTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  recLine: { flex: 1, height: StyleSheet.hairlineWidth },
  recTitle: { fontSize: 13, fontWeight: '700' },
  recGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  recCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    marginBottom: 0,
  },
  recImageWrap: { position: 'relative', borderRadius: 6, overflow: 'hidden' },
  recImage: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  discBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: SHOPEE_ORANGE,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  recName: { fontSize: 12, fontWeight: '700', marginTop: 8, minHeight: 32, lineHeight: 16 },
  recPrice: { fontSize: 15, fontWeight: '900', color: SHOPEE_ORANGE, marginTop: 6 },
  recSold: { fontSize: 10, marginTop: 4 },
});
