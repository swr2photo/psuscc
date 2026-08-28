import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';

import { Button } from '@/components/ui/button';
import { WebSafeBlurView } from '@/components/ui/web-safe-blur';
import { logout } from '@/lib/auth';

export default function LogoutScreen() {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);

  const runLogout = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      await logout();
      Toast.show({ type: 'success', text1: 'ออกจากระบบแล้ว' });
    } finally {
      router.replace('/');
      setIsWorking(false);
    }
  };

  return (
    <View className="flex-1 justify-end">
      {/* Backdrop */}
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={() => router.back()}
        disabled={isWorking}
      />

      {/* Sheet */}
      <View className="p-4">
        <WebSafeBlurView intensity={55} tint="light" className="rounded-[28px] overflow-hidden border border-white/60">
          <View className="p-6">
          <View className="items-center">
            <View className="w-16 h-16 rounded-[22px] bg-white/80 items-center justify-center border border-white/60">
              <LogOut size={28} color="#ef4444" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 mt-5">ออกจากระบบ</Text>
            <Text className="text-slate-500 text-center mt-2 leading-6">
              คุณต้องการออกจากระบบใช่หรือไม่?{"\n"}ระบบจะล้างข้อมูลการเข้าสู่ระบบบนอุปกรณ์นี้
            </Text>
          </View>

          <View className="mt-6 gap-3">
            <Button
              variant="destructive"
              size="lg"
              className="w-full h-14 rounded-2xl"
              onPress={runLogout}
              disabled={isWorking}
            >
              {isWorking ? (
                <View className="flex-row items-center gap-3">
                  <ActivityIndicator color="#fff" />
                  <Text className="text-white font-bold">กำลังออกจากระบบ...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold">ยืนยันออกจากระบบ</Text>
              )}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-14 rounded-2xl"
              onPress={() => router.back()}
              disabled={isWorking}
              label="ยกเลิก"
            />
          </View>
          </View>
        </WebSafeBlurView>
      </View>
    </View>
  );
}

