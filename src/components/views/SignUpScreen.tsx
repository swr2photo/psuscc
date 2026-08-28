import { Button } from '@/components/ui/button';
import { WebSafeBlurView } from '@/components/ui/web-safe-blur';
import { AuthShell } from '@/components/views/AuthShell';
import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function SignUpScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setIsLoading(true);
    try {
      const redirectTo = Platform.OS === 'web' 
        ? window.location.origin 
        : makeRedirectUri({
            scheme: 'psuscc',
            path: 'auth',
          });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success') {
          // Auth logic is handled by onAuthStateChange in _layout.tsx
        }
      }
    } catch (error: any) {
      Alert.alert('ผิดพลาด', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-10">
          <View className="mb-8">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/70 border border-white/60 shadow-sm"
            >
              <ArrowLeft size={18} color="#0f172a" />
            </Pressable>
          </View>

          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-[28px] bg-white/70 items-center justify-center border border-white/60 shadow-sm">
              <LogIn size={34} color="#0f172a" />
            </View>
            <Text className="text-[34px] font-black text-slate-900 tracking-tight text-center mt-6">สร้างบัญชีใหม่</Text>
            <Text className="text-center text-slate-600 text-[15px] mt-2 leading-6">
              เริ่มต้นใช้งาน EventLogis{"\n"}เพื่อจัดการสินค้าและโลจิสติกส์ของคุณ
            </Text>
          </View>

          <WebSafeBlurView intensity={55} tint="light" className="rounded-[28px] overflow-hidden border border-white/60">
            <View className="p-5">
              <Text className="text-slate-900 font-black text-base mb-1">สมัครสมาชิกด้วย Google</Text>
              <Text className="text-slate-600 text-sm leading-5 mb-5">
                หลังจากสมัครสมาชิกแล้ว ระบบจะให้คุณกรอกข้อมูลส่วนตัวเพิ่มเติมเพื่อให้การจัดการเป็นไปอย่างแม่นยำ
              </Text>

              <Button
                variant="outline"
                size="lg"
                className="w-full bg-white/80 h-16 border-white/60 rounded-2xl shadow-sm"
                onPress={handleGoogleSignUp}
                loading={isLoading}
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-white/90 px-2.5 py-1 rounded-full border border-white/70">
                    <Text className="text-[#4285F4] font-black text-xl">G</Text>
                  </View>
                  <Text className="font-black text-slate-900 text-base">ดำเนินการต่อด้วย Google</Text>
                </View>
              </Button>
            </View>
          </WebSafeBlurView>

          <Pressable className="py-6 items-center active:opacity-70" onPress={() => router.back()}>
            <Text className="text-slate-600 text-sm">
              มีบัญชีอยู่แล้ว? <Text className="text-slate-900 font-black">เข้าสู่ระบบ</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthShell>
  );
}
