import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useMemo, useState } from 'react';
import { Check, ChevronRight, MapPin, Package, Send, Truck } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import {
  useShopOrderDetail,
  useAttachShopSlip,
  invokeVerifyShopSlip,
  invokeTrackParcel,
} from '@/features/shop/api/useShopOrders';
import type { ShopOrderItem, ShopOrderStatus } from '@/features/shop/types';
import {
  canReviewShopOrder,
  useOrderProductReviews,
} from '@/features/shop/api/useShopReviews';
import { ShopReviewForm } from '@/features/shop/components/ShopReviewForm';
import { SkeletonOrderDetail } from '@/components/ui/skeleton-presets';
import { flexFill } from '@/constants/layout';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';

/** Shopee-style accent (teal banner in reference UI) */
const BANNER_GREEN = '#2D937F';
const ORANGE_ACCENT = '#D35400';

const STATUS_LABEL: Record<ShopOrderStatus, string> = {
  pending_payment: 'รอแนบสลิป',
  payment_review: 'กำลังตรวจสลิป',
  paid: 'ชำระแล้ว',
  fulfilling: 'เตรียมจัดส่ง',
  shipped: 'จัดส่งแล้ว',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
  payment_failed: 'สลิปไม่ผ่าน',
};

export default function StoreOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useShopOrderDetail(id ?? null);
  const { data: orderReviews = [] } = useOrderProductReviews(id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh(() => refetch());
  const attachSlip = useAttachShopSlip();
  const [showSlip, setShowSlip] = useState(false);
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ productId: string; productName: string } | null>(
    null,
  );
  const trackingEvents = useMemo(
    () => extractTrackingEvents(data?.shipment?.raw_response),
    [data?.shipment?.raw_response],
  );
  const trackingStageIndex = useMemo(
    () => getCurrentStageIndex(trackingEvents),
    [trackingEvents],
  );
  const reviewedProductIds = useMemo(
    () => new Set(orderReviews.map((r) => r.product_id)),
    [orderReviews],
  );

  const pickAndUploadSlip = async () => {
    if (!id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'อนุญาตเข้าถึงรูปเพื่อแนบสลิป');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];

    try {
      const filePath = `shop-slips/${Date.now()}-${id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('slips')
        .upload(filePath, decode(asset.base64!), { contentType: asset.mimeType || 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('slips').getPublicUrl(filePath);

      await attachSlip.mutateAsync({ orderId: id, slipUrl: pub.publicUrl });
      await refetch();
      Alert.alert('แนบสลิปแล้ว', 'กด «ตรวจสอบสลิป» เพื่อยืนยันกับ SlipOK');
    } catch (e: unknown) {
      Alert.alert('อัปโหลดไม่สำเร็จ', e instanceof Error ? e.message : String(e));
    }
  };

  const runVerify = async () => {
    if (!id) return;
    try {
      const res = await invokeVerifyShopSlip(id);
      await refetch();
      if (res.verified) Alert.alert('สำเร็จ', 'ชำระเงินยืนยันแล้ว');
      else Alert.alert('ไม่ผ่าน', (res.message as string) || 'ตรวจสอบสลิปไม่ผ่าน');
    } catch (e: unknown) {
      Alert.alert('ผิดพลาด', e instanceof Error ? e.message : String(e));
    }
  };

  const runTrack = async () => {
    if (!id) return;
    try {
      await invokeTrackParcel(id);
      await qc.invalidateQueries({ queryKey: ['shop', 'order', id] });
      await refetch();
      Alert.alert('อัปเดต', 'ดึงสถานะพัสดุแล้ว');
    } catch (e: unknown) {
      Alert.alert('ผิดพลาด', e instanceof Error ? e.message : String(e));
    }
  };

  if (isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen
          options={{
            title: 'รายละเอียดคำสั่งซื้อ',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.surface },
            headerShadowVisible: false,
          }}
        />
        <SkeletonOrderDetail />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', padding: 24 }}>
        <Stack.Screen
          options={{
            title: 'รายละเอียดคำสั่งซื้อ',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.surface },
            headerShadowVisible: false,
          }}
        />
        <Text style={{ color: theme.text, textAlign: 'center', fontWeight: '700' }}>
          ไม่พบคำสั่งซื้อ
        </Text>
        <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={{ color: theme.primary, fontWeight: '800' }}>ลองอีกครั้ง</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { order, items, shipment } = data;
  const st = order.status as ShopOrderStatus;
  const canReview = canReviewShopOrder(st);
  const openReviewForItem = (item: ShopOrderItem) => {
    setReviewTarget({
      productId: item.product_id,
      productName: item.shop_products?.name ?? 'สินค้า',
    });
  };
  const openNextReview = () => {
    const pending = items.filter((it) => !reviewedProductIds.has(it.product_id));
    if (pending.length === 0) {
      Alert.alert('รีวิวครบแล้ว', 'คุณรีวิวสินค้าในคำสั่งซื้อนี้แล้ว');
      return;
    }
    openReviewForItem(pending[0]);
  };
  const pageBg = theme.background;
  const cardBg = theme.surface;
  const carrierLabel = order.shop_shipping_methods?.name ?? 'ไปรษณีย์ไทย';
  const trackingLine =
    shipment?.last_status ??
    (shipment?.tracking_number ? 'กำลังอัปเดตสถานะพัสดุ…' : 'รอแอดมินใส่เลขพัสดุ');
  const trackingWhen = trackingEvents[0]?.when
    ? formatDetailDateTime(trackingEvents[0].when)
    : shipment?.updated_at
      ? formatDetailDateTime(shipment.updated_at)
      : '';
  const bannerMessage = orderStatusBannerMessage(st);
  const addr = order.shop_user_addresses;
  const addrLineCompact =
    addr &&
    [
      addr.address_line,
      [addr.subdistrict_name, addr.district_name, addr.province_name].filter(Boolean).join(' '),
      addr.postal_code,
    ]
      .filter(Boolean)
      .join(' · ');
  const showShippingCard =
    shipment?.tracking_number != null ||
    ['paid', 'fulfilling', 'shipped', 'completed'].includes(st);

  return (
    <View style={[flexFill, { backgroundColor: pageBg }]}>
      <Stack.Screen
        options={{
          title: 'รายละเอียดคำสั่งซื้อ',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: cardBg },
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={flexFill}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BANNER_GREEN} />
        }
      >
        <View style={[styles.statusBannerFull, { backgroundColor: BANNER_GREEN }]}>
          <Text style={styles.statusBannerText}>{bannerMessage}</Text>
        </View>

        <View style={styles.pagePad}>
          {showShippingCard ? (
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <TouchableOpacity style={styles.cardRowHead} activeOpacity={0.7} onPress={runTrack}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>ข้อมูลการจัดส่ง</Text>
                <ChevronRight size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
              {shipment?.tracking_number ? (
                <Text style={[styles.trackingCarrier, { color: theme.text }]}>
                  {carrierLabel}: {shipment.tracking_number}
                </Text>
              ) : (
                <Text style={[styles.trackingCarrier, { color: theme.mutedForeground }]}>
                  {carrierLabel} — ยังไม่มีเลขพัสดุ
                </Text>
              )}
              <View style={styles.trackingStatusRow}>
                <Truck size={18} color={BANNER_GREEN} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.trackingStatusText, { color: BANNER_GREEN }]}>{trackingLine}</Text>
                  {trackingWhen ? (
                    <Text style={[styles.trackingWhen, { color: theme.mutedForeground }]}>{trackingWhen}</Text>
                  ) : null}
                </View>
              </View>
              {trackingEvents.length ? (
                <View style={{ marginTop: 14 }}>
                  <TrackingStepper stageIndex={trackingStageIndex} />
                </View>
              ) : null}
              {trackingEvents.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: theme.text, fontWeight: '800', marginBottom: 8 }}>รายละเอียดเส้นทาง</Text>
                  <TrackingTimeline events={trackingEvents} />
                </View>
              ) : null}
              {['paid', 'fulfilling', 'shipped', 'completed'].includes(st) ? (
                <TouchableOpacity
                  style={[styles.outlineBtnSm, { borderColor: theme.border, marginTop: 12 }]}
                  onPress={runTrack}
                >
                  <Text style={{ color: theme.text, fontWeight: '800' }}>อัปเดตสถานะพัสดุ</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {addr ? (
            <View style={[styles.card, { backgroundColor: cardBg, marginTop: 12 }]}>
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 10 }]}>ที่อยู่ในการจัดส่ง</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <MapPin size={18} color={theme.mutedForeground} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>
                    {addr.full_name} · {addr.phone}
                  </Text>
                  <Text style={{ color: theme.mutedForeground, marginTop: 6, lineHeight: 20 }} numberOfLines={addressExpanded ? undefined : 2}>
                    {addrLineCompact || addr.address_line}
                  </Text>
                  <TouchableOpacity onPress={() => setAddressExpanded((v) => !v)} style={{ marginTop: 6 }}>
                    <Text style={{ color: '#2563eb', fontWeight: '700' }}>
                      {addressExpanded ? 'ย่อ' : 'ดูเพิ่มเติม'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: cardBg, marginTop: 12 }]}>
            <TouchableOpacity
              style={styles.storeRow}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/store')}
            >
              <View style={styles.mallBadge}>
                <Text style={styles.mallBadgeText}>PSU</Text>
              </View>
              <Text style={[styles.storeName, { color: theme.text }]} numberOfLines={1}>
                PSU SCC Store
              </Text>
              <ChevronRight size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
            {items.map((it) => (
              <OrderItemRow
                key={it.id}
                item={it}
                themeText={theme.text}
                themeMuted={theme.mutedForeground}
                themePrimary={theme.primary}
                canReview={canReview}
                reviewed={reviewedProductIds.has(it.product_id)}
                onReview={() => openReviewForItem(it)}
              />
            ))}
            <TouchableOpacity style={styles.totalRow} activeOpacity={0.85}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>รวมคำสั่งซื้อ</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>
                  ฿{Number(order.total).toFixed(0)}
                </Text>
                <ChevronRight size={16} color={theme.mutedForeground} />
              </View>
            </TouchableOpacity>
          </View>

          {st === 'pending_payment' ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.primary, marginTop: 16 }]}
              onPress={pickAndUploadSlip}
              disabled={attachSlip.isPending}
            >
              <Text style={styles.btnText}>แนบสลิปโอนเงิน</Text>
            </TouchableOpacity>
          ) : null}

          {order.slip_url ? (
            <View style={[styles.card, { backgroundColor: cardBg, marginTop: 12 }]}>
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 8 }]}>สลิปโอนเงิน</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowSlip(true)}
                style={[styles.slipRow, { borderColor: '#e5e7eb', backgroundColor: '#fafafa' }]}
              >
                <Image source={{ uri: order.slip_url }} style={styles.slipThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '900' }} numberOfLines={1}>
                    ดูสลิป
                  </Text>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}
                  >
                    <PaymentStatusBadge status={st} verifiedAt={order.payment_verified_at} />
                    <Text style={{ color: theme.mutedForeground, fontWeight: '700' }} numberOfLines={1}>
                      แตะเพื่อขยาย
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>
          ) : null}

          {st === 'payment_review' ? (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#0ea5e9', marginTop: 16 }]}
              onPress={runVerify}
            >
              <Text style={styles.btnText}>ตรวจสอบสลิป (SlipOK)</Text>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.card, { backgroundColor: cardBg, marginTop: 12 }]}>
            <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 12 }]}>บริการหลังการขาย</Text>
            <TouchableOpacity style={styles.afterSaleRow} activeOpacity={0.7}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>ติดต่อสโมสร</Text>
              <ChevronRight size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.afterSaleRow,
                { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
              ]}
              activeOpacity={0.7}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>คำถามที่พบบ่อย</Text>
              <ChevronRight size={18} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: cardBg,
            borderTopColor: theme.border,
            paddingBottom: 12 + insets.bottom,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 8,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.footerBtnOutline, { borderColor: theme.border, backgroundColor: cardBg }]}
          onPress={() => router.push('/(tabs)/store')}
        >
          <Text style={[styles.footerBtnOutlineText, { color: theme.text }]}>ซื้ออีกครั้ง</Text>
        </TouchableOpacity>
        {canReview ?
          <TouchableOpacity
            style={[styles.footerBtnOrange, { borderColor: ORANGE_ACCENT, backgroundColor: cardBg }]}
            onPress={openNextReview}
          >
            <Text style={[styles.footerBtnOrangeText, { color: ORANGE_ACCENT }]}>ให้คะแนน</Text>
          </TouchableOpacity>
        : null}
      </View>

      {order.slip_url && showSlip ? (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowSlip(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>สลิป</Text>
              <TouchableOpacity onPress={() => setShowSlip(false)} hitSlop={12}>
                <Text style={{ color: theme.primary, fontWeight: '900' }}>ปิด</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12 }}>
              <Image source={{ uri: order.slip_url }} style={styles.slipFull} />
            </View>
          </View>
        </View>
      ) : null}

      {reviewTarget && id ?
        <ShopReviewForm
          visible
          onClose={() => setReviewTarget(null)}
          orderId={id}
          productId={reviewTarget.productId}
          productName={reviewTarget.productName}
        />
      : null}
    </View>
  );
}

function orderStatusBannerMessage(st: ShopOrderStatus): string {
  switch (st) {
    case 'completed':
      return 'คำสั่งซื้อของคุณสำเร็จแล้ว';
    case 'shipped':
      return 'พัสดุกำลังจัดส่งถึงคุณ';
    case 'fulfilling':
      return 'ร้านกำลังเตรียมจัดส่ง';
    case 'paid':
      return 'ชำระเงินเรียบร้อย รอจัดส่ง';
    case 'payment_review':
      return 'กำลังตรวจสอบการชำระเงิน';
    case 'pending_payment':
      return 'รอชำระเงิน';
    case 'payment_failed':
      return 'การชำระเงินไม่ผ่าน กรุณาตรวจสอบสลิป';
    case 'cancelled':
      return 'คำสั่งซื้อถูกยกเลิก';
    default:
      return STATUS_LABEL[st] ?? 'สถานะคำสั่งซื้อ';
  }
}

function formatDetailDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  const dd = `${d.getDate()}`.padStart(2, '0');
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mi = `${d.getMinutes()}`.padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi} น.`;
}

function OrderItemRow({
  item,
  themeText,
  themeMuted,
  themePrimary,
  canReview,
  reviewed,
  onReview,
}: {
  item: ShopOrderItem;
  themeText: string;
  themeMuted: string;
  themePrimary: string;
  canReview: boolean;
  reviewed: boolean;
  onReview: () => void;
}) {
  const prod = item.shop_products;
  const variant = item.shop_product_variants;
  const img = prod?.image_urls?.[0];
  const name = prod?.name ?? 'สินค้า';
  const sub = variant?.size_label ? `#${variant.size_label}` : null;
  const lineTotal = Number(item.unit_price) * item.quantity;

  return (
    <View style={styles.productRow}>
      {img ? (
        <Image source={{ uri: img }} style={styles.productThumb} />
      ) : (
        <View style={[styles.productThumb, { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }]}>
          <Package size={22} color={themeMuted} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ color: themeText, fontWeight: '700', flex: 1 }} numberOfLines={2}>
            {name}
          </Text>
          <Text style={{ color: themeMuted, fontWeight: '600' }}>x{item.quantity}</Text>
        </View>
        {sub ? (
          <Text style={{ color: themeMuted, marginTop: 4, fontSize: 13 }}>{sub}</Text>
        ) : null}
        <Text style={{ color: themeText, fontWeight: '900', marginTop: 8 }}>
          ฿{lineTotal.toFixed(0)}
        </Text>
        {canReview ?
          reviewed ?
            <Text style={{ color: themeMuted, marginTop: 8, fontSize: 13, fontWeight: '600' }}>
              รีวิวแล้ว ✓
            </Text>
          : <TouchableOpacity onPress={onReview} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ color: themePrimary, fontWeight: '800', fontSize: 13 }}>เขียนรีวิว</Text>
            </TouchableOpacity>
        : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBannerFull: { paddingVertical: 14, paddingHorizontal: 16 },
  statusBannerText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pagePad: { paddingHorizontal: 12, paddingTop: 12 },
  card: {
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '900', fontSize: 16 },
  trackingCarrier: { marginTop: 10, fontWeight: '700', fontSize: 14 },
  trackingStatusRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 },
  trackingStatusText: { fontWeight: '800', fontSize: 14 },
  trackingWhen: { marginTop: 4, fontSize: 13 },
  outlineBtnSm: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  mallBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  mallBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  storeName: { flex: 1, fontWeight: '800', fontSize: 15 },
  productRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  productThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#f3f4f6' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
  },
  afterSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerBtnOutlineText: { fontWeight: '800' },
  footerBtnOrange: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerBtnOrangeText: { fontWeight: '800' },
  btn: { marginTop: 20, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  slipRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  slipThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#00000010' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    justifyContent: 'center',
    zIndex: 50,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    borderRadius: 18,
    padding: 14,
  },
  slipFull: { width: '100%', height: 420, borderRadius: 14, resizeMode: 'contain' },
});

type TrackingEvent = { when: string; status: string; location?: string };
type TrackingStage = 'รับเข้าระบบ' | 'ระหว่างขนส่ง' | 'ออกไปนำจ่าย' | 'นำจ่ายสำเร็จ';

function PaymentStatusBadge({
  status,
  verifiedAt,
}: {
  status: ShopOrderStatus;
  verifiedAt: string | null;
}) {
  const { theme } = useTheme();

  const isPaid = status === 'paid' || status === 'fulfilling' || status === 'shipped' || status === 'completed';
  const isReview = status === 'payment_review';
  const isFailed = status === 'payment_failed';

  const label = isPaid
    ? 'ชำระเงินสำเร็จ'
    : isReview
      ? 'กำลังตรวจสอบ'
      : isFailed
        ? 'ชำระเงินไม่ผ่าน'
        : 'รอชำระเงิน';

  const bg = isPaid ? '#16a34a20' : isReview ? '#0ea5e920' : isFailed ? '#ef444420' : '#64748b20';
  const border = isPaid ? '#16a34a' : isReview ? '#0ea5e9' : isFailed ? '#ef4444' : theme.border;
  const fg = isPaid ? '#16a34a' : isReview ? '#0ea5e9' : isFailed ? '#ef4444' : theme.mutedForeground;

  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Text style={{ color: fg, fontWeight: '900', fontSize: 12 }}>
        {label}
        {isPaid && verifiedAt ? '' : ''}
      </Text>
    </View>
  );
}

function extractTrackingEvents(raw: unknown): TrackingEvent[] {
  if (!raw || typeof raw !== 'object') return [];
  const root = raw as Record<string, unknown>;
  const response = (root.response as Record<string, unknown> | undefined) ?? undefined;
  const itemsAny = response?.items as unknown;
  const first = pickFirstItemFromItems(itemsAny) ?? undefined;

  const eventsAny =
    (first?.events as Record<string, unknown>[] | undefined) ??
    (first?.event as Record<string, unknown>[] | undefined) ??
    undefined;
  if (!eventsAny?.length) return [];

  return eventsAny
    .map((e) => {
      const when =
        (e.datetime as string | undefined) ??
        (e.date as string | undefined) ??
        (e.time as string | undefined) ??
        '';
      const codeRaw =
        (e.status_code as string | number | undefined) ??
        (e.status_id as string | number | undefined) ??
        (e.code as string | number | undefined) ??
        (e.status as string | number | undefined) ??
        undefined;

      const statusRaw =
        (e.status_description as string | undefined) ??
        (e.status_detail as string | undefined) ??
        (typeof e.status === 'string' ? (e.status as string) : undefined) ??
        'อัปเดตสถานะ';
      const status = normalizeThaiPostStatus(codeRaw, statusRaw);
      const location =
        (e.location as string | undefined) ??
        (e.location_name as string | undefined) ??
        (e.post_office as string | undefined) ??
        undefined;
      return { when, status, location };
    })
    .filter((x) => x.when || x.status)
    .sort((a, b) => parseWhen(b.when) - parseWhen(a.when));
}

function pickFirstItemFromItems(itemsAny: unknown): Record<string, unknown> | null {
  if (!itemsAny) return null;
  if (Array.isArray(itemsAny)) {
    const first = itemsAny[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }
  if (typeof itemsAny === 'object') {
    const obj = itemsAny as Record<string, unknown>;
    const firstKey = Object.keys(obj)[0];
    if (!firstKey) return null;
    const val = obj[firstKey];
    if (Array.isArray(val)) {
      const first = val[0];
      return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
    }
  }
  return null;
}

function normalizeThaiPostStatus(codeRaw: unknown, status: string): string {
  const code = toStatusCode(codeRaw);
  if (code != null) {
    // Based on Thailand Post "Status Item" codes:
    // 1xx = accepted, 2xx = transit/customs, 3xx = out for delivery, 5xx = delivered.
    if (code >= 100 && code < 200) return 'รับเข้าระบบ';
    if (code >= 200 && code < 300) return 'ระหว่างขนส่ง';
    if (code >= 300 && code < 500) return 'ออกไปนำจ่าย';
    if (code >= 500 && code < 600) return 'นำจ่ายสำเร็จ';
    // 901 = money transferred; keep it as delivered step in this UI.
    if (code === 901) return 'นำจ่ายสำเร็จ';
  }

  const s = String(status || '').trim();
  const sl = s.toLowerCase();

  // Normalize common Thailand Post statuses into 4 user-friendly steps.
  if (
    s.includes('รับเข้าระบบ') ||
    s.includes('รับฝาก') ||
    s.includes('รับจาก') ||
    (s.includes('รับ') && s.includes('เข้าระบบ')) ||
    sl.includes('accept') ||
    sl.includes('posted') ||
    sl.includes('receive')
  ) {
    return 'รับเข้าระบบ';
  }

  if (
    s.includes('ระหว่างขนส่ง') ||
    s.includes('อยู่ระหว่างการขนส่ง') ||
    s.includes('ส่งต่อ') ||
    s.includes('ศูนย์') ||
    sl.includes('in transit') ||
    sl.includes('transport')
  ) {
    return 'ระหว่างขนส่ง';
  }

  if (s.includes('ออกไปนำจ่าย') || (s.includes('นำจ่าย') && (s.includes('ออก') || sl.includes('out for delivery')))) {
    return 'ออกไปนำจ่าย';
  }

  if (
    s.includes('นำจ่ายสำเร็จ') ||
    s.includes('นำจ่ายเรียบร้อย') ||
    (s.includes('นำจ่าย') && (s.includes('สำเร็จ') || s.includes('เรียบร้อย'))) ||
    sl.includes('delivered')
  ) {
    return 'นำจ่ายสำเร็จ';
  }

  return s || 'อัปเดตสถานะ';
}

function toStatusCode(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string') {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function getCurrentStageIndex(events: TrackingEvent[]): number {
  // Find the highest stage seen in events (delivered wins).
  let idx = -1;
  for (const ev of events) {
    const i = stageIndexFromStatus(ev.status);
    if (i > idx) idx = i;
  }
  return Math.max(0, idx);
}

function stageIndexFromStatus(status: string): number {
  const s = String(status || '').trim();
  if (s === 'นำจ่ายสำเร็จ') return 3;
  if (s === 'ออกไปนำจ่าย') return 2;
  if (s === 'ระหว่างขนส่ง') return 1;
  if (s === 'รับเข้าระบบ') return 0;
  return 0;
}

function parseWhen(when: string): number {
  // Supports ISO datetime; otherwise falls back to 0.
  const t = Date.parse(when);
  return Number.isFinite(t) ? t : 0;
}

function TrackingStepper({ stageIndex }: { stageIndex: number }) {
  const { theme } = useTheme();
  // Thailand Post vibe: red progress, green delivered.
  const TP_RED = '#E11D48';
  const TP_GREEN = '#16A34A';

  const steps: { title: TrackingStage; Icon: typeof Package }[] = [
    { title: 'รับเข้าระบบ', Icon: Package },
    { title: 'ระหว่างขนส่ง', Icon: Truck },
    { title: 'ออกไปนำจ่าย', Icon: Send },
    { title: 'นำจ่ายสำเร็จ', Icon: Check },
  ];

  const delivered = stageIndex >= 3;

  return (
    <View style={{ marginTop: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {steps.map((s, i) => {
          const done = i <= stageIndex;
          const lineDone = i < stageIndex;
          const isLast = i === steps.length - 1;
          const accent = isLast ? TP_GREEN : TP_RED;
          const circleBg = done && (!isLast || delivered) ? accent : theme.background;
          const circleBorder = done && (!isLast || delivered) ? accent : theme.border;
          const iconColor = done && (!isLast || delivered) ? '#fff' : theme.mutedForeground;
          const labelColor = done ? theme.text : theme.mutedForeground;

          return (
            <View key={s.title} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
                {i !== 0 ? (
                  <View
                    style={{
                      height: 3,
                      flex: 1,
                      backgroundColor: lineDone ? TP_RED : theme.border,
                      borderRadius: 99,
                      marginRight: 10,
                    }}
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}

                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: circleBg,
                    borderWidth: 2,
                    borderColor: circleBorder,
                  }}
                >
                  <s.Icon size={20} color={iconColor} />
                </View>

                {i !== steps.length - 1 ? (
                  <View
                    style={{
                      height: 3,
                      flex: 1,
                      backgroundColor: i < stageIndex ? TP_RED : theme.border,
                      borderRadius: 99,
                      marginLeft: 10,
                    }}
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
              </View>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: '800',
                  color: labelColor,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {s.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  const { theme } = useTheme();
  const TP_GREEN = '#16A34A';
  const shown = events;

  return (
    <View style={{ marginTop: 6 }}>
      {shown.map((ev, idx) => {
        const isLast = idx === shown.length - 1;
        return (
          <View key={`${ev.when}-${idx}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 18, alignItems: 'center' }}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: TP_GREEN,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                <Check size={12} color="#fff" />
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    backgroundColor: TP_GREEN,
                    marginTop: 6,
                    marginBottom: 6,
                    borderRadius: 99,
                    opacity: 0.25,
                  }}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>{ev.status}</Text>
              <Text style={{ color: theme.mutedForeground, marginTop: 2 }}>
                {ev.when || '—'}
                {ev.location ? ` · ${ev.location}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
