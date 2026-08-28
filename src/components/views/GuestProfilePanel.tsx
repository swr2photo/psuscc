import { useRouter } from 'expo-router';
import { Calendar, LogIn, ShoppingBag, Sparkles } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

/** Profile tab content for signed-out web visitors. */
export function GuestProfilePanel() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48 }}>
      <View className="items-center mb-8">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: theme.secondary, borderWidth: 1, borderColor: theme.border }}
        >
          <Sparkles size={36} color={theme.primary} />
        </View>
        <Text style={{ color: theme.text, fontWeight: '900', fontSize: 22, textAlign: 'center' }}>
          ยังไม่ได้เข้าสู่ระบบ
        </Text>
        <Text
          style={{
            color: theme.mutedForeground,
            fontWeight: '600',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 10,
            lineHeight: 22,
            maxWidth: 320,
          }}
        >
          ดูกิจกรรมและสินค้าในร้านได้เลย — เข้าสู่ระบบเมื่อต้องการสมัครค่าย สั่งซื้อ หรือจัดการโปรไฟล์
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/(auth)/add')}
        className="h-14 rounded-2xl items-center justify-center flex-row gap-2 mb-3"
        style={{ backgroundColor: theme.primary }}
      >
        <LogIn size={20} color="#FFF" />
        <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>เข้าสู่ระบบด้วย Google</Text>
      </Pressable>

      <View className="gap-3 mt-2">
        <GuestLinkRow
          icon={<Calendar size={20} color={theme.primary} />}
          label="ดูกิจกรรมทั้งหมด"
          onPress={() => router.push('/(tabs)/activities')}
          theme={theme}
        />
        <GuestLinkRow
          icon={<ShoppingBag size={20} color={theme.primary} />}
          label="ไปที่ร้านค้า"
          onPress={() => router.push('/(tabs)/store')}
          theme={theme}
        />
      </View>
    </View>
  );
}

function GuestLinkRow({
  icon,
  label,
  onPress,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  theme: { text: string; secondary: string; border: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{ backgroundColor: theme.secondary, borderWidth: 1, borderColor: theme.border }}
    >
      {icon}
      <Text style={{ flex: 1, color: theme.text, fontWeight: '800', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}
