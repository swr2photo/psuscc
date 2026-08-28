import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/use-theme';
import type { AppTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ShopSettingsScreen() {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const router = useRouter();

  const { data: methods = [], isLoading: mLoad } = useQuery({
    queryKey: ['admin', 'shop_shipping'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_shipping_methods').select('*').order('sort_order');
      if (error) throw error;
      return data as ShippingRow[];
    },
  });

  const { data: carrier, isLoading: cLoad } = useQuery({
    queryKey: ['admin', 'shop_carrier_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_carrier_settings').select('*').eq('carrier', 'thai_post').single();
      if (error) throw error;
      return data;
    },
  });

  const [tokenInput, setTokenInput] = useState('');
  const [markup, setMarkup] = useState('');

  useEffect(() => {
    if (carrier) setMarkup(String(carrier.shipping_markup_baht ?? 0));
  }, [carrier]);

  const saveToken = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase.rpc('shop_admin_set_carrier_token', { p_token: token });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'shop_carrier_settings'] });
      Alert.alert('บันทึก token แล้ว');
      setTokenInput('');
    },
    onError: (e: Error) => Alert.alert('ผิดพลาด', e.message),
  });

  const saveMarkup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shop_carrier_settings')
        .update({ shipping_markup_baht: parseFloat(markup) || 0, updated_at: new Date().toISOString() })
        .eq('carrier', 'thai_post');
      if (error) throw error;
    },
    onSuccess: () => Alert.alert('บันทึกค่าธรรมเนียมเพิ่มแล้ว'),
    onError: (e: Error) => Alert.alert('ผิดพลาด', e.message),
  });

  const saveMethod = async (
    id: string,
    row: { base_fee?: string; free_over_amount?: string; name?: string },
  ) => {
    const { error } = await supabase
      .from('shop_shipping_methods')
      .update({
        name: row.name,
        base_fee: row.base_fee != null ? parseFloat(row.base_fee) : undefined,
        free_over_amount:
          row.free_over_amount === '' || row.free_over_amount == null
            ? null
            : parseFloat(row.free_over_amount),
      })
      .eq('id', id);
    if (error) Alert.alert('ผิดพลาด', error.message);
    else {
      qc.invalidateQueries({ queryKey: ['admin', 'shop_shipping'] });
      qc.invalidateQueries({ queryKey: ['shop', 'shipping'] });
      Alert.alert('บันทึกค่าจัดส่งแล้ว');
    }
  };

  if (mLoad || cLoad) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: 'ตั้งค่าร้านค้า' }} />
        <ActivityIndicator color={theme.primary} />
        <Text className="mt-4 text-muted-foreground font-medium">กำลังโหลดการตั้งค่า...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'ตั้งค่าร้านค้า',
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
        <Text className="text-xl font-black text-foreground mb-3">ไปรษณีย์ไทย (Tracking API)</Text>
        <Card className="p-5 bg-card border-border">
          <Text className="text-muted-foreground font-medium">
            Token เก็บในตารางลับ — Edge Function `track-parcel` อ่านด้วย service role
          </Text>
          <Text className="text-muted-foreground font-medium mt-2">
            สถานะ token: {carrier?.token_is_set ? 'ตั้งแล้ว' : 'ยังไม่ได้ตั้ง'}
          </Text>
          <TextInput
            placeholder="Thailand Post API token"
            placeholderTextColor={theme.muted}
            value={tokenInput}
            onChangeText={setTokenInput}
            secureTextEntry
            style={inp(theme)}
          />
          <Button
            label="บันทึก token"
            loading={saveToken.isPending}
            className="rounded-2xl"
            onPress={() => saveToken.mutate(tokenInput)}
          />
        </Card>

        <Text className="text-xl font-black text-foreground mt-6 mb-3">ค่าธรรมเนียมเพิ่ม (บาท)</Text>
        <Card className="p-5 bg-card border-border">
          <TextInput value={markup} onChangeText={setMarkup} keyboardType="decimal-pad" style={inp(theme)} />
          <Button
            variant="secondary"
            label="บันทึก markup"
            loading={saveMarkup.isPending}
            className="rounded-2xl"
            onPress={() => saveMarkup.mutate()}
          />
        </Card>

        <Text className="text-xl font-black text-foreground mt-6 mb-3">ค่าขนส่ง</Text>
        <View className="gap-3">
          {methods.map((m) => (
            <MethodEditor key={m.id} m={m} theme={theme} onSave={saveMethod} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type ShippingRow = {
  id: string;
  code: string;
  name: string;
  base_fee: number;
  free_over_amount: number | null;
};

function MethodEditor({
  m,
  theme,
  onSave,
}: {
  m: ShippingRow;
  theme: AppTheme;
  onSave: (id: string, row: { base_fee?: string; free_over_amount?: string; name?: string }) => void;
}) {
  const [name, setName] = useState(m.name);
  const [fee, setFee] = useState(String(m.base_fee));
  const [free, setFree] = useState(m.free_over_amount != null ? String(m.free_over_amount) : '');
  return (
    <Card className="p-5 bg-card border-border">
      <Text className="text-muted-foreground font-semibold">{m.code}</Text>
      <TextInput value={name} onChangeText={setName} style={in2(theme)} placeholderTextColor={theme.muted} />
      <TextInput
        placeholder="ค่าจัดส่ง"
        value={fee}
        onChangeText={setFee}
        keyboardType="decimal-pad"
        style={in2(theme)}
        placeholderTextColor={theme.muted}
      />
      <TextInput
        placeholder="ส่งฟรีเมื่อยอดถึง (เว้นว่างได้)"
        value={free}
        onChangeText={setFree}
        keyboardType="decimal-pad"
        style={in2(theme)}
        placeholderTextColor={theme.muted}
      />
      <View style={{ marginTop: 10 }}>
        <Button
          label="บันทึกชุดนี้"
          className="rounded-2xl"
          onPress={() => onSave(m.id, { name, base_fee: fee, free_over_amount: free })}
        />
      </View>
    </Card>
  );
}

function inp(theme: AppTheme) {
  return {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontWeight: '600' as const,
    color: theme.text,
    backgroundColor: theme.surface,
  };
}

function in2(theme: AppTheme) {
  return {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    color: theme.text,
    fontWeight: '600' as const,
    backgroundColor: theme.background,
  };
}
