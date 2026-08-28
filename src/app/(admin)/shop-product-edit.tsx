import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useShopCategories, useShopProduct } from '@/features/shop/api/useShopCatalog';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

type VariantRow = {
  id?: string;
  size_label: string;
  price: string;
  stock: string;
};

export default function ShopProductEditScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id;
  const { data: loaded, isLoading } = useShopProduct(isNew ? null : id!);
  const { data: categories = [] } = useShopCategories();
  const [productId, setProductId] = useState<string | null>(id ?? null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState<'simple' | 'apparel'>('simple');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [saleStart, setSaleStart] = useState('');
  const [saleEnd, setSaleEnd] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [basePrice, setBasePrice] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([{ size_label: '', price: '', stock: '0' }]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setProductId(loaded.id);
    setName(loaded.name);
    setDescription(loaded.description ?? '');
    setProductType(loaded.product_type);
    setCategoryId(loaded.category_id);
    setPublished(loaded.is_published);
    setSaleStart(loaded.sale_starts_at?.slice(0, 16) ?? '');
    setSaleEnd(loaded.sale_ends_at?.slice(0, 16) ?? '');
    setImageUrls((loaded.image_urls ?? []) as string[]);
    setBasePrice(loaded.base_price != null ? String(loaded.base_price) : '');
    const vrows =
      loaded.shop_product_variants?.map((v) => ({
        id: v.id,
        size_label: v.size_label ?? '',
        price: String(v.price),
        stock: String(v.stock_quantity),
      })) ?? [];
    setVariants(vrows.length ? vrows : [{ size_label: '', price: '', stock: '0' }]);
  }, [loaded]);

  const ensureProductId = async (payloadForInsert: Record<string, unknown>): Promise<string> => {
    if (productId) return productId;
    const { data: ins, error } = await supabase.from('shop_products').insert(payloadForInsert).select('id').single();
    if (error) throw error;
    setProductId(ins.id);
    return ins.id as string;
  };

  const pickAndUploadImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องการสิทธิ์', 'อนุญาตเข้าถึงรูปเพื่ออัปโหลดรูปสินค้า');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const payloadDraft = {
      name: name.trim() || 'draft-product',
      description: description.trim() || null,
      product_type: productType,
      category_id: categoryId,
      base_price: productType === 'simple' && basePrice ? parseFloat(basePrice) : null,
      image_urls: imageUrls,
      is_published: published,
      sale_starts_at: saleStart ? new Date(saleStart).toISOString() : null,
      sale_ends_at: saleEnd ? new Date(saleEnd).toISOString() : null,
    };

    setIsUploadingImages(true);
    try {
      const pid = await ensureProductId(payloadDraft);

      const uploaded: string[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const a = result.assets[i];
        if (!a.base64) continue;
        const ext = 'jpg';
        const filePath = `products/${pid}/${Date.now()}-${i}.${ext}`;
        const contentType = a.mimeType || 'image/jpeg';

        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(filePath, decode(a.base64), { contentType });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from('product-images').getPublicUrl(filePath);
        uploaded.push(pub.publicUrl);
      }

      const next = [...imageUrls, ...uploaded];
      setImageUrls(next);
      await supabase.from('shop_products').update({ image_urls: next }).eq('id', pid);
      qc.invalidateQueries({ queryKey: ['admin', 'shop_products'] });
      qc.invalidateQueries({ queryKey: ['shop', 'products'] });
      qc.invalidateQueries({ queryKey: ['shop', 'product', pid] });
    } catch (e: unknown) {
      Alert.alert('อัปโหลดไม่สำเร็จ', e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploadingImages(false);
    }
  };

  const setCover = async (url: string) => {
    const pid = productId;
    const next = [url, ...imageUrls.filter((x) => x !== url)];
    setImageUrls(next);
    if (pid) {
      await supabase.from('shop_products').update({ image_urls: next }).eq('id', pid);
    }
  };

  const removeImage = async (url: string) => {
    const pid = productId;
    const next = imageUrls.filter((x) => x !== url);
    setImageUrls(next);
    if (pid) {
      await supabase.from('shop_products').update({ image_urls: next }).eq('id', pid);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('กรอกชื่อสินค้า');
      return;
    }
    const images = imageUrls.length ? imageUrls : ['https://images.unsplash.com/photo-1560393464-5c69a2c577f1?w=400'];

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      product_type: productType,
      category_id: categoryId,
      base_price: productType === 'simple' && basePrice ? parseFloat(basePrice) : null,
      image_urls: images,
      is_published: published,
      sale_starts_at: saleStart ? new Date(saleStart).toISOString() : null,
      sale_ends_at: saleEnd ? new Date(saleEnd).toISOString() : null,
    };

    try {
      let pid = productId;

      if (isNew) {
        const { data: ins, error } = await supabase.from('shop_products').insert(payload).select('id').single();
        if (error) throw error;
        pid = ins.id;
        setProductId(ins.id);
      } else {
        const { error } = await supabase.from('shop_products').update(payload).eq('id', id!);
        if (error) throw error;
      }

      const vParsed = variants
        .map((v) => ({
          id: v.id,
          size_label: v.size_label.trim() || null,
          price: parseFloat(v.price),
          stock: parseInt(v.stock, 10) || 0,
        }))
        .filter((v) => !Number.isNaN(v.price));

      if (vParsed.length === 0) {
        Alert.alert('ต้องมีอย่างน้อย 1 ราคา/ตัวเลือก');
        return;
      }

      for (const v of vParsed) {
        if (v.id) {
          const { error } = await supabase
            .from('shop_product_variants')
            .update({
              size_label: v.size_label,
              price: v.price,
              stock_quantity: v.stock,
            })
            .eq('id', v.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('shop_product_variants').insert({
            product_id: pid!,
            size_label: v.size_label,
            price: v.price,
            stock_quantity: v.stock,
          });
          if (error) throw error;
        }
      }

      qc.invalidateQueries({ queryKey: ['admin', 'shop_products'] });
      qc.invalidateQueries({ queryKey: ['shop', 'products'] });
      qc.invalidateQueries({ queryKey: ['shop', 'product', pid] });
      Alert.alert('บันทึกแล้ว', '', [{ text: 'ตกลง', onPress: () => router.back() }]);
    } catch (e: unknown) {
      Alert.alert('บันทึกไม่สำเร็จ', e instanceof Error ? e.message : String(e));
    }
  };

  if (!isNew && isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: 'แก้ไขสินค้า' }} />
        <ActivityIndicator color={theme.primary} />
        <Text className="mt-4 text-muted-foreground font-medium">กำลังโหลดสินค้า...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: isNew ? 'สินค้าใหม่' : 'แก้ไขสินค้า',
          headerShown: true,
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTintColor: theme.text,
          headerStyle: { backgroundColor: theme.background },
        }}
      />

      <AppStatusBar style="dark" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 }}>
        <Text className="text-xl font-black text-foreground mb-3">ข้อมูลสินค้า</Text>
        <Card className="p-5 bg-card border-border">
          <Field label="ชื่อ" theme={theme}>
            <TextInput value={name} onChangeText={setName} style={input(theme)} placeholderTextColor={theme.muted} />
          </Field>
          <Field label="รายละเอียด" theme={theme}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[input(theme), { minHeight: 88 }]}
              multiline
              placeholderTextColor={theme.muted}
            />
          </Field>

          <Text style={lbl(theme)}>ประเภท</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {(['simple', 'apparel'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setProductType(t)}
                style={[
                  chip(theme),
                  productType === t && { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
                ]}
                activeOpacity={0.85}
              >
                <Text style={{ fontWeight: '800', color: theme.text }}>{t === 'simple' ? 'ทั่วไป' : 'เสื้อผ้า'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={lbl(theme)}>หมวด</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setCategoryId(null)}
              style={[chip(theme), categoryId === null && { borderColor: theme.primary }]}
              activeOpacity={0.85}
            >
              <Text style={{ color: theme.text }}>ไม่ระบุ</Text>
            </TouchableOpacity>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={[chip(theme), categoryId === c.id && { borderColor: theme.primary }]}
                activeOpacity={0.85}
              >
                <Text style={{ color: theme.text }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: theme.text, fontWeight: '800', flex: 1 }}>เผยแพร่</Text>
            <Switch value={published} onValueChange={setPublished} />
          </View>

          <Text style={lbl(theme)}>รูปสินค้า</Text>
          <Text style={{ color: theme.mutedForeground, marginBottom: 10 }}>
            รูปแรกจะถูกใช้เป็น “รูปปก” ของสินค้า
          </Text>

          {!!imageUrls.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
              {imageUrls.map((u) => (
                <TouchableOpacity
                  key={u}
                  activeOpacity={0.9}
                  onPress={() =>
                    Alert.alert('จัดการรูป', '', [
                      { text: 'ยกเลิก', style: 'cancel' },
                      { text: 'ตั้งเป็นรูปปก', onPress: () => setCover(u) },
                      { text: 'ลบรูป', style: 'destructive', onPress: () => removeImage(u) },
                    ])
                  }
                >
                  <Image
                    source={{ uri: u }}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Button
            label={isUploadingImages ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปสินค้า'}
            loading={isUploadingImages}
            className="rounded-2xl"
            onPress={pickAndUploadImages}
          />

          {productType === 'simple' ? (
            <Field label="ราคาพื้นฐาน (ถ้าไม่ใช้ตารางด้านล่าง)" theme={theme}>
              <TextInput
                value={basePrice}
                onChangeText={setBasePrice}
                keyboardType="decimal-pad"
                style={input(theme)}
                placeholderTextColor={theme.muted}
              />
            </Field>
          ) : null}

          <Field label="เริ่มขาย (ตัวอย่าง 2026-05-01T08:00)" theme={theme}>
            <TextInput
              value={saleStart}
              onChangeText={setSaleStart}
              placeholder="เว้นว่าง = ไม่จำกัดเริ่ม"
              style={input(theme)}
              placeholderTextColor={theme.muted}
            />
          </Field>
          <Field label="สิ้นสุดขาย" theme={theme}>
            <TextInput
              value={saleEnd}
              onChangeText={setSaleEnd}
              placeholder="เว้นว่าง = ไม่กำหนด"
              style={input(theme)}
              placeholderTextColor={theme.muted}
            />
          </Field>
        </Card>

        <Text className="text-xl font-black text-foreground mt-6 mb-3">ตัวเลือก / ไซส์และราคา</Text>
        <Card className="p-5 bg-card border-border">
          {variants.map((v, idx) => (
            <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextInput
                placeholder="ไซส์"
                placeholderTextColor={theme.muted}
                value={v.size_label}
                onChangeText={(t) => {
                  const next = [...variants];
                  next[idx] = { ...v, size_label: t };
                  setVariants(next);
                }}
                style={[input(theme), { flex: 1, minWidth: 96 }]}
              />
              <TextInput
                placeholder="ราคา"
                placeholderTextColor={theme.muted}
                value={v.price}
                keyboardType="decimal-pad"
                onChangeText={(t) => {
                  const next = [...variants];
                  next[idx] = { ...v, price: t };
                  setVariants(next);
                }}
                style={[input(theme), { width: 96 }]}
              />
              <TextInput
                placeholder="สต็อก"
                placeholderTextColor={theme.muted}
                value={v.stock}
                keyboardType="number-pad"
                onChangeText={(t) => {
                  const next = [...variants];
                  next[idx] = { ...v, stock: t };
                  setVariants(next);
                }}
                style={[input(theme), { width: 84 }]}
              />
            </View>
          ))}
          <Button
            variant="secondary"
            label="+ เพิ่มแถว"
            className="rounded-2xl"
            onPress={() => setVariants([...variants, { size_label: '', price: '', stock: '0' }])}
          />
        </Card>

        <View className="mt-6">
          <Button label="บันทึก" className="rounded-2xl" onPress={save} />
        </View>
      </ScrollView>
    </View>
  );
}

type Theme = ReturnType<typeof useTheme>['theme'];

function lbl(theme: Theme) {
  return { color: theme.text, fontWeight: '800' as const, marginBottom: 8 };
}

function input(theme: Theme) {
  return {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    color: theme.text,
    backgroundColor: theme.surface,
    fontWeight: '600' as const,
  };
}

function chip(theme: Theme) {
  return {
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  };
}

function Field({ label: lb, children, theme }: { label: string; children: React.ReactNode; theme: Theme }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={lbl(theme)}>{lb}</Text>
      {children}
    </View>
  );
}
