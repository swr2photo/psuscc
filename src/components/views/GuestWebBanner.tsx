import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

/** Compact sign-in prompt shown on web while browsing as a guest. */
export function GuestWebBanner() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <View
      className="rounded-2xl px-4 py-3.5 mb-4 flex-row items-center gap-3"
      style={{ backgroundColor: theme.secondary, borderWidth: 1, borderColor: theme.border }}
    >
      <View className="flex-1">
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>ดูได้โดยไม่ต้องเข้าสู่ระบบ</Text>
        <Text style={{ color: theme.mutedForeground, fontWeight: '600', fontSize: 13, marginTop: 4 }}>
          สมัครค่ายหรือสั่งซื้อสินค้าเมื่อพร้อม — เข้าสู่ระบบด้วย Google
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/(auth)/add')}
        className="flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-xl"
        style={{ backgroundColor: theme.primary }}
      >
        <LogIn size={16} color="#FFF" />
        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>เข้าสู่ระบบ</Text>
      </Pressable>
    </View>
  );
}
