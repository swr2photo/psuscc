import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, MapPin, Tag, Ticket, Truck } from 'lucide-react-native';
import { useTheme, type AppTheme } from '@/hooks/use-theme';
import { useThaiAddress } from '@/hooks/useThaiAddress';
import { useShopCartQuery } from '@/features/shop/api/useShopCart';
import { useShopShippingMethods } from '@/features/shop/api/useShopCatalog';
import { useSaveShopAddress, useShopAddresses } from '@/features/shop/api/useShopAddresses';
import { usePlaceShopOrder } from '@/features/shop/api/useShopOrders';
import type { ShopShippingMethod } from '@/features/shop/types';
import type { ProvinceOpt, DistrictOpt, SubDistrictOpt } from '@/hooks/useThaiAddress';
import * as Clipboard from 'expo-clipboard';
import type { ShopUserAddress } from '@/features/shop/types';
import { SkeletonCheckoutPage } from '@/components/ui/skeleton-presets';
import { flexFill } from '@/constants/layout';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';

type PickerField = 'province' | 'district' | 'subdistrict' | null;

const PAYMENT_BANK = process.env.EXPO_PUBLIC_PAYMENT_BANK ?? 'พร้อมเพย์';
const PAYMENT_ACCOUNT_NAME = process.env.EXPO_PUBLIC_PAYMENT_ACCOUNT_NAME ?? '';
const PROMPTPAY_ID = process.env.EXPO_PUBLIC_PROMPTPAY_ID ?? '';

const SHOPEE_ORANGE = '#EE4D2D';
const PAGE_BG = '#F5F5F5';
const GREEN_BORDER = '#52c41a';
const GREEN_SOFT = '#f6ffed';

export default function StoreCheckoutScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selected: selectedParam } = useLocalSearchParams<{ selected?: string }>();
  const selectedIds = useMemo(() => {
    if (!selectedParam?.trim()) return null;
    return new Set(selectedParam.split(',').map((s) => s.trim()).filter(Boolean));
  }, [selectedParam]);
  const { provinces, getDistricts, getSubDistricts, composeAddress } = useThaiAddress();
  const queryClient = useQueryClient();
  const { refreshing, onRefresh: onPullRefresh } = usePullToRefresh(
    useCallback(async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['shop', 'cart'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'addresses'] }),
        queryClient.refetchQueries({ queryKey: ['shop', 'shipping'] }),
      ]);
    }, [queryClient]),
  );
  const { data: cartItems = [], isPending: cartPending } = useShopCartQuery();
  const cartItemsForOrder = useMemo(() => {
    if (!selectedIds?.size) return cartItems;
    return cartItems.filter((c) => selectedIds.has(c.id));
  }, [cartItems, selectedIds]);
  const { data: shippingMethods = [] } = useShopShippingMethods();
  const { data: savedAddresses = [], isLoading: addrLoading } = useShopAddresses();
  const saveAddress = useSaveShopAddress();
  const placeOrder = usePlaceShopOrder();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [detailLine, setDetailLine] = useState('');
  const [province, setProvince] = useState<ProvinceOpt | null>(null);
  const [district, setDistrict] = useState<DistrictOpt | null>(null);
  const [subDistrict, setSubDistrict] = useState<SubDistrictOpt | null>(null);
  const [shipping, setShipping] = useState<ShopShippingMethod | null>(null);

  const [picker, setPicker] = useState<PickerField>(null);
  const [addrExpanded, setAddrExpanded] = useState(false);
  const [noteToSeller, setNoteToSeller] = useState('');

  const districts = useMemo(() => (province ? getDistricts(province.id) : []), [province, getDistricts]);
  const subDistricts = useMemo(
    () => (district ? getSubDistricts(district.id) : []),
    [district, getSubDistricts],
  );

  const subtotal = useMemo(
    () =>
      cartItemsForOrder.reduce((s, it) => s + it.shop_product_variants.price * it.quantity, 0),
    [cartItemsForOrder],
  );

  const shippingFee =
    shipping && subtotal >= (shipping.free_over_amount ?? Number.POSITIVE_INFINITY)
      ? 0
      : (shipping?.base_fee ?? 0);

  const total = subtotal + shippingFee;

  const itemPieces = useMemo(
    () => cartItemsForOrder.reduce((n, it) => n + it.quantity, 0),
    [cartItemsForOrder],
  );

  const shippingSaved =
    shipping && shipping.base_fee > 0 && shippingFee === 0 && subtotal >= (shipping.free_over_amount ?? Number.POSITIVE_INFINITY)
      ? shipping.base_fee
      : 0;

  const addressSummaryLine = useMemo(() => {
    if (!detailLine.trim() && !province) return 'แตะเพื่อกรอกที่อยู่จัดส่ง';
    const tail = [subDistrict?.name, district?.name, province?.name].filter(Boolean).join(' ');
    const zip = subDistrict?.zipCode ? ` ${subDistrict.zipCode}` : '';
    return `${detailLine.trim()}${tail ? ` · ${tail}` : ''}${zip}`.trim();
  }, [detailLine, province, district, subDistrict]);

  function applySavedAddress(a: ShopUserAddress) {
    setFullName(a.full_name ?? '');
    setPhone(a.phone ?? '');
    setDetailLine(a.address_line ?? '');

    if (a.province_id && a.province_name) setProvince({ id: a.province_id, name: a.province_name });
    if (a.district_id && a.district_name && a.province_id)
      setDistrict({ id: a.district_id, name: a.district_name, provinceId: a.province_id });
    if (a.subdistrict_id && a.subdistrict_name && a.district_id)
      setSubDistrict({
        id: a.subdistrict_id,
        name: a.subdistrict_name,
        zipCode: a.postal_code ? parseInt(a.postal_code, 10) || 0 : 0,
        districtId: a.district_id,
      });
  }

  useEffect(() => {
    if (shipping || !shippingMethods.length) return;
    setShipping(shippingMethods[0]);
  }, [shipping, shippingMethods]);

  useEffect(() => {
    if (!savedAddresses.length) return;
    // Auto-select default address (or most recent) once
    if (selectedAddressId) return;
    const def = savedAddresses.find((a) => a.is_default) ?? savedAddresses[0];
    applySavedAddress(def);
    setSelectedAddressId(def.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses]);

  const copyPromptPay = async () => {
    if (!PROMPTPAY_ID) return;
    await Clipboard.setStringAsync(PROMPTPAY_ID);
    Alert.alert('คัดลอกแล้ว', PROMPTPAY_ID);
  };

  const onSubmit = async () => {
    const ok = await ensureAuthedOrGoAuth(router, { message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    if (!ok) return;

    if (!fullName.trim() || !phone.trim() || !detailLine.trim() || !province || !district || !subDistrict) {
      Alert.alert('กรอกไม่ครบ', 'กรุณากรอกชื่อ เบอร์โทร ที่อยู่ และเลือก จังหวัด อำเภอ ตำบล');
      return;
    }
    if (!shipping) {
      Alert.alert('เลือกการจัดส่ง', 'กรุณาเลือกวิธีจัดส่ง');
      return;
    }
    if (!cartItemsForOrder.length) {
      Alert.alert('ไม่มีสินค้า', 'กรุณาเลือกสินค้าในตะกร้าหรือเพิ่มสินค้าก่อน');
      return;
    }

    const addressLine = composeAddress({
      detail: detailLine,
      province: province.name,
      district: district.name,
      subDistrict: subDistrict.name,
      zipCode: String(subDistrict.zipCode),
    });

    try {
      const addressId = await saveAddress.mutateAsync({
        id: selectedAddressId ?? undefined,
        full_name: fullName.trim(),
        phone: phone.trim(),
        address_line: addressLine,
        province_id: province.id,
        district_id: district.id,
        subdistrict_id: subDistrict.id,
        province_name: province.name,
        district_name: district.name,
        subdistrict_name: subDistrict.name,
        postal_code: String(subDistrict.zipCode),
        is_default: true,
      });

      setSelectedAddressId(addressId);

      const lines = cartItemsForOrder.map((c) => ({
        variant_id: c.variant_id,
        quantity: c.quantity,
      }));

      const orderId = await placeOrder.mutateAsync({
        lines,
        shipping_method_id: shipping.id,
        user_address_id: addressId,
      });

      router.replace(`/store/order/${orderId}`);
    } catch (e: unknown) {
      Alert.alert('ไม่สำเร็จ', getErrorMessage(e));
    }
  };

  const renderPicker = () => {
    let data: { key: string; label: string; onPick: () => void }[] = [];
    if (picker === 'province') {
      data = provinces.map((p) => ({
        key: String(p.id),
        label: p.name,
        onPick: () => {
          setProvince(p);
          setDistrict(null);
          setSubDistrict(null);
          setPicker(null);
        },
      }));
    } else if (picker === 'district') {
      data = districts.map((d) => ({
        key: String(d.id),
        label: d.name,
        onPick: () => {
          setDistrict(d);
          setSubDistrict(null);
          setPicker(null);
        },
      }));
    } else if (picker === 'subdistrict') {
      data = subDistricts.map((s) => ({
        key: String(s.id),
        label: `${s.name} · ${s.zipCode}`,
        onPick: () => {
          setSubDistrict(s);
          setPicker(null);
        },
      }));
    }

    return (
      <Modal visible={picker !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPicker(null)}>
                <Text style={{ color: theme.primary, fontWeight: '800' }}>ปิด</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={data}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickRow} onPress={item.onPick}>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{item.label}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>
    );
  };

  if (cartPending) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? theme.background : PAGE_BG }}>
        <Stack.Screen
          options={{
            title: 'ทำการสั่งซื้อ',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.surface },
            headerShadowVisible: false,
          }}
        />
        <SkeletonCheckoutPage />
      </View>
    );
  }

  const pageBg = isDark ? theme.background : PAGE_BG;
  const cardBg = theme.surface;

  if (!cartItemsForOrder.length) {
    return (
      <View style={[styles.center, { backgroundColor: pageBg }]}>
        <Stack.Screen
          options={{
            title: 'ทำการสั่งซื้อ',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: cardBg },
            headerShadowVisible: false,
          }}
        />
        <Text style={{ color: theme.mutedForeground, fontWeight: '700' }}>ไม่มีสินค้าในคำสั่งซื้อนี้</Text>
        <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
          <Text style={{ color: SHOPEE_ORANGE, fontWeight: '800' }}>กลับไปตะกร้า</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[flexFill, { backgroundColor: pageBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'ทำการสั่งซื้อ',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: cardBg },
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={flexFill}
        contentContainerStyle={{
          paddingHorizontal: 10,
          paddingTop: 10,
          paddingBottom: 120 + insets.bottom,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={SHOPEE_ORANGE} />
        }
      >
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg }]}
          activeOpacity={0.9}
          onPress={() => setAddrExpanded((e) => !e)}
        >
          <View style={styles.addrRow}>
            <MapPin size={22} color={SHOPEE_ORANGE} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.addrName, { color: theme.text }]} numberOfLines={1}>
                {fullName.trim() || 'ชื่อผู้รับ'}
                {phone.trim() ? ` · ${phone.trim()}` : ''}
              </Text>
              <Text style={[styles.addrDetail, { color: theme.mutedForeground }]} numberOfLines={addrExpanded ? undefined : 2}>
                {addressSummaryLine}
              </Text>
            </View>
            <ChevronRight size={18} color={theme.mutedForeground} />
          </View>

          {addrExpanded ? (
            <View style={[styles.addrEditor, { borderTopColor: '#f0f0f0' }]}>
              <Text style={[styles.miniHead, { color: theme.text }]}>ที่อยู่ที่บันทึกไว้</Text>
              {addrLoading ? (
                <Text style={{ color: theme.mutedForeground }}>กำลังโหลด...</Text>
              ) : savedAddresses.length ? (
                savedAddresses.slice(0, 4).map((a) => {
                  const active = selectedAddressId === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => {
                        setSelectedAddressId(a.id);
                        applySavedAddress(a);
                      }}
                      style={[
                        styles.savedChip,
                        {
                          borderColor: active ? SHOPEE_ORANGE : theme.border,
                          backgroundColor: active ? `${SHOPEE_ORANGE}12` : 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ color: theme.text, fontWeight: '700' }} numberOfLines={1}>
                        {a.full_name} · {a.phone}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: theme.mutedForeground }}>ยังไม่มีที่อยู่ที่บันทึก</Text>
              )}
              <TouchableOpacity
                onPress={() => {
                  setSelectedAddressId(null);
                  setFullName('');
                  setPhone('');
                  setDetailLine('');
                  setProvince(null);
                  setDistrict(null);
                  setSubDistrict(null);
                }}
                style={{ marginTop: 8 }}
              >
                <Text style={{ color: SHOPEE_ORANGE, fontWeight: '800' }}>+ กรอกที่อยู่ใหม่</Text>
              </TouchableOpacity>

              <TextInput
                placeholder="ชื่อ-นามสกุล"
                placeholderTextColor={theme.muted}
                value={fullName}
                onChangeText={setFullName}
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: pageBg }]}
              />
              <TextInput
                placeholder="เบอร์โทร"
                placeholderTextColor={theme.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: pageBg }]}
              />
              <TextInput
                placeholder="บ้านเลขที่ / หมู่ / ซอย / ถนน"
                placeholderTextColor={theme.muted}
                value={detailLine}
                onChangeText={setDetailLine}
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: pageBg }]}
              />
              <TouchableOpacity
                style={[styles.select, { borderColor: theme.border, backgroundColor: pageBg }]}
                onPress={() => setPicker('province')}
              >
                <Text style={{ color: province ? theme.text : theme.muted, fontWeight: '600' }}>
                  {province ? `จังหวัด: ${province.name}` : 'เลือกจังหวัด'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.select, { borderColor: theme.border, backgroundColor: pageBg }]}
                onPress={() => (province ? setPicker('district') : Alert.alert('เลือกจังหวัดก่อน'))}
              >
                <Text style={{ color: district ? theme.text : theme.muted, fontWeight: '600' }}>
                  {district ? `อำเภอ: ${district.name}` : 'เลือกอำเภอ'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.select, { borderColor: theme.border, backgroundColor: pageBg }]}
                onPress={() => (district ? setPicker('subdistrict') : Alert.alert('เลือกอำเภอก่อน'))}
              >
                <Text style={{ color: subDistrict ? theme.text : theme.muted, fontWeight: '600' }}>
                  {subDistrict ? `ตำบล · รหัสไปรษณีย์: ${subDistrict.zipCode}` : 'เลือกตำบล / รหัสไปรษณีย์'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 10 }]}>
          <View style={styles.shopHead}>
            <View style={styles.recBadge}>
              <Text style={styles.recBadgeText}>ร้านแนะนำ</Text>
            </View>
            <Text style={[styles.shopTitle, { color: theme.text }]} numberOfLines={1}>
              PSU SCC Store
            </Text>
          </View>
          {cartItemsForOrder.map((c) => {
            const v = c.shop_product_variants;
            const p = v.shop_products;
            const img = p.image_urls?.[0];
            return (
              <View key={c.id} style={styles.prodRow}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.prodThumb} />
                ) : (
                  <View style={[styles.prodThumb, { backgroundColor: '#eee' }]} />
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={[styles.prodName, { color: theme.text }]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={{ color: theme.mutedForeground, fontWeight: '600' }}>x{c.quantity}</Text>
                  </View>
                  {v.size_label ? (
                    <Text style={[styles.prodVariant, { color: theme.mutedForeground }]}>#{v.size_label}</Text>
                  ) : null}
                  <View style={styles.prodPriceRow}>
                    <Text style={styles.prodPrice}>฿{(v.price * c.quantity).toFixed(0)}</Text>
                    <Truck size={14} color={SHOPEE_ORANGE} style={{ marginLeft: 6 }} />
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.inlineLinkRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert('โค้ดส่วนลด', 'ฟีเจอร์โค้ดจะเปิดให้ใช้งานภายหลัง')}
          >
            <Tag size={16} color={SHOPEE_ORANGE} />
            <Text style={[styles.inlineLinkText, { color: theme.text }]}>โค้ดส่วนลดร้านค้า</Text>
            <Text style={{ color: SHOPEE_ORANGE, fontWeight: '700' }}>กดใช้โค้ด</Text>
            <ChevronRight size={16} color={theme.mutedForeground} />
          </TouchableOpacity>

          <View style={{ marginTop: 12 }}>
            <Text style={[styles.miniHead, { color: theme.text }]}>หมายเหตุ</Text>
            <TextInput
              placeholder="ฝากข้อความถึงผู้ขาย..."
              placeholderTextColor={theme.muted}
              value={noteToSeller}
              onChangeText={setNoteToSeller}
              style={[
                styles.noteInput,
                { borderColor: theme.border, color: theme.text, backgroundColor: pageBg },
              ]}
              multiline
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 10 }]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.cardSectionTitle, { color: theme.text }]}>ตัวเลือกการจัดส่ง</Text>
            <TouchableOpacity onPress={() => Alert.alert('การจัดส่ง', 'เลือกวิธีด้านล่าง')}>
              <Text style={{ color: SHOPEE_ORANGE, fontWeight: '700' }}>ดูทั้งหมด</Text>
            </TouchableOpacity>
          </View>
          {shippingMethods.map((m) => {
            const active = shipping?.id === m.id;
            const feeLabel =
              m.base_fee === 0 ? 'ส่งฟรี' : subtotal >= (m.free_over_amount ?? Number.POSITIVE_INFINITY) ? 'ส่งฟรี' : `฿${m.base_fee}`;
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.shipBox,
                  active && { borderColor: GREEN_BORDER, backgroundColor: isDark ? theme.background : GREEN_SOFT },
                ]}
                onPress={() => setShipping(m)}
                activeOpacity={0.85}
              >
                {active ? (
                  <View style={styles.shipCheck}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={[styles.shipCheck, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ddd' }]} />
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>{m.name}</Text>
                  <Text style={{ color: theme.mutedForeground, marginTop: 4, fontSize: 13 }}>{m.code}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
                    <Truck size={16} color={active ? GREEN_BORDER : theme.mutedForeground} />
                    <Text style={{ color: SHOPEE_ORANGE, fontWeight: '900' }}>{feeLabel}</Text>
                    {m.base_fee > 0 &&
                    subtotal >= (m.free_over_amount ?? Number.POSITIVE_INFINITY) ? (
                      <Text style={{ color: theme.mutedForeground, textDecorationLine: 'line-through' }}>
                        ฿{m.base_fee}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 8 }}>
            ค่าจัดส่งคำนวณตามยอดสินค้าและเงื่อนไขส่งฟรีของแต่ละวิธี
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 10 }]}>
          <View style={styles.summaryLine}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>
              สินค้ารวม {itemPieces} ชิ้น
            </Text>
            <Text style={{ color: theme.text, fontWeight: '900' }}>฿{subtotal.toFixed(0)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, marginTop: 10, flexDirection: 'row', alignItems: 'center' }]}
          activeOpacity={0.75}
          onPress={() => Alert.alert('โค้ดส่วนลด', 'ฟีเจอร์โค้ดแพลตฟอร์มจะเปิดภายหลัง')}
        >
          <Ticket size={18} color={SHOPEE_ORANGE} />
          <Text style={{ flex: 1, marginLeft: 10, color: theme.text, fontWeight: '700' }}>โค้ดส่วนลด PSUSCC</Text>
          <ChevronRight size={18} color={theme.mutedForeground} />
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 10 }]}>
          <View style={styles.sectionRow}>
            <Text style={[styles.cardSectionTitle, { color: theme.text }]}>ช่องทางการชำระเงิน</Text>
            <Text style={{ color: SHOPEE_ORANGE, fontWeight: '700' }}>ดูทั้งหมด</Text>
          </View>
          <Text style={{ color: theme.mutedForeground, fontWeight: '700', marginBottom: 10 }}>{PAYMENT_BANK}</Text>

          <View style={[styles.paySelectedRow, { borderColor: SHOPEE_ORANGE, backgroundColor: `${SHOPEE_ORANGE}08` }]}>
            <View style={styles.radioOn}>
              <Check size={12} color="#fff" strokeWidth={3} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: theme.text, fontWeight: '900' }}>PromptPay / โอน</Text>
              {PAYMENT_ACCOUNT_NAME ? (
                <Text style={{ color: theme.mutedForeground, marginTop: 4 }}>{PAYMENT_ACCOUNT_NAME}</Text>
              ) : null}
              {PROMPTPAY_ID ? (
                <Text style={{ color: theme.text, fontWeight: '800', marginTop: 6 }}>{PROMPTPAY_ID}</Text>
              ) : null}
            </View>
            {PROMPTPAY_ID ? (
              <TouchableOpacity onPress={copyPromptPay} style={styles.copyMini}>
                <Text style={{ color: SHOPEE_ORANGE, fontWeight: '800' }}>คัดลอก</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={{ color: theme.mutedForeground, fontSize: 12, marginTop: 10 }}>
            หลังกดสั่งสินค้า ระบบจะพาไปแนบสลิปในหน้าคำสั่งซื้อ
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, marginTop: 10 }]}>
          <Text style={[styles.cardSectionTitle, { color: theme.text, marginBottom: 12 }]}>ข้อมูลการชำระเงิน</Text>
          <SummaryRow label="รวมการสั่งซื้อ" value={`฿${subtotal.toFixed(0)}`} theme={theme} />
          <SummaryRow label="การจัดส่ง" value={`฿${shipping ? shipping.base_fee : 0}`} theme={theme} />
          {shippingFee === 0 && shipping && shipping.base_fee > 0 ? (
            <SummaryRow label="ส่วนลดค่าจัดส่ง" value={`-฿${shipping.base_fee}`} theme={theme} accent />
          ) : null}
          <View style={[styles.divider, { backgroundColor: '#f0f0f0' }]} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>ยอดชำระเงินทั้งหมด</Text>
            <Text style={{ color: SHOPEE_ORANGE, fontWeight: '900', fontSize: 20 }}>฿{total.toFixed(0)}</Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.stickyBar,
          {
            backgroundColor: cardBg,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>รวมยอดสั่งซื้อ</Text>
          <Text style={styles.stickyTotal}>฿{total.toFixed(0)}</Text>
          {shippingSaved > 0 ? (
            <Text style={styles.stickySave}>ประหยัดค่าส่ง ฿{shippingSaved}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.placeOrderBtn, (saveAddress.isPending || placeOrder.isPending) && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={saveAddress.isPending || placeOrder.isPending}
        >
          {saveAddress.isPending || placeOrder.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderText}>สั่งสินค้า</Text>
          )}
        </TouchableOpacity>
      </View>

      {renderPicker()}
    </KeyboardAvoidingView>
  );
}

function SummaryRow({
  label,
  value,
  theme,
  accent,
}: {
  label: string;
  value: string;
  theme: AppTheme;
  accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ color: theme.mutedForeground, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: accent ? SHOPEE_ORANGE : theme.text, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center' },
  addrName: { fontWeight: '800', fontSize: 15 },
  addrDetail: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  addrEditor: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  miniHead: { fontWeight: '800', marginBottom: 8, fontSize: 14 },
  savedChip: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  select: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  shopHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  recBadge: {
    backgroundColor: `${SHOPEE_ORANGE}18`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: SHOPEE_ORANGE,
  },
  recBadgeText: { color: SHOPEE_ORANGE, fontWeight: '900', fontSize: 11 },
  shopTitle: { flex: 1, fontWeight: '900', fontSize: 15 },
  prodRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  prodThumb: { width: 72, height: 72, borderRadius: 6 },
  prodName: { fontSize: 14, fontWeight: '600', flex: 1 },
  prodVariant: { fontSize: 13, marginTop: 4 },
  prodPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  prodPrice: { fontSize: 16, fontWeight: '900', color: SHOPEE_ORANGE },
  inlineLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 12,
    gap: 8,
  },
  inlineLinkText: { flex: 1, fontWeight: '700' },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionTitle: { fontWeight: '900', fontSize: 16 },
  shipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  shipCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paySelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 12,
  },
  radioOn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SHOPEE_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyMini: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SHOPEE_ORANGE,
  },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 8 },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  stickyTotal: { fontSize: 18, fontWeight: '900', color: SHOPEE_ORANGE, marginTop: 2 },
  stickySave: { fontSize: 12, color: SHOPEE_ORANGE, marginTop: 2, fontWeight: '700' },
  placeOrderBtn: {
    backgroundColor: SHOPEE_ORANGE,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 4,
    minWidth: 140,
    alignItems: 'center',
  },
  placeOrderText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  pickRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
});

function getErrorMessage(err: unknown): string {
  if (!err) return 'เกิดข้อผิดพลาด';
  if (err instanceof Error && err.message) return mapKnownErrors(err.message);

  // Supabase/Fetch errors often look like plain objects
  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;

    const msg =
      (anyErr.message as string | undefined) ??
      (anyErr.error_description as string | undefined) ??
      (anyErr.error as string | undefined);
    if (msg) return mapKnownErrors(msg);

    const details =
      (anyErr.details as string | undefined) ??
      (anyErr.hint as string | undefined) ??
      (anyErr.code as string | undefined);
    if (details) return mapKnownErrors(details);

    // `supabase.functions.invoke` errors sometimes embed context
    const context = anyErr.context as Record<string, unknown> | undefined;
    const contextMsg = context?.message as string | undefined;
    if (contextMsg) return mapKnownErrors(contextMsg);

    try {
      return mapKnownErrors(JSON.stringify(anyErr));
    } catch {
      return 'เกิดข้อผิดพลาด (ไม่สามารถอ่านรายละเอียดได้)';
    }
  }

  return mapKnownErrors(String(err));
}

function mapKnownErrors(raw: string): string {
  const s = raw.trim();
  if (!s) return 'เกิดข้อผิดพลาด';

  // RPC errors from shop_place_order
  if (s.includes('insufficient_stock')) {
    return 'สต็อกสินค้าไม่พอสำหรับจำนวนที่เลือก กรุณาลดจำนวนหรือเลือกไซส์/สินค้าอื่น';
  }
  if (s.includes('product_not_available')) {
    return 'สินค้านี้ยังไม่เปิดขายหรือหมดช่วงเวลาขาย';
  }
  if (s.includes('invalid_shipping')) {
    return 'วิธีจัดส่งไม่ถูกต้องหรือถูกปิดใช้งาน';
  }
  if (s.includes('invalid_address')) {
    return 'ที่อยู่จัดส่งไม่ถูกต้อง';
  }
  if (s.includes('not_authenticated') || s.includes('login_required')) {
    return 'กรุณาเข้าสู่ระบบก่อนทำรายการ';
  }

  return s;
}
