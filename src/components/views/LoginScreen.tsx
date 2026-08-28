import { Button } from '@/components/ui/button';
import { WebSafeBlurView } from '@/components/ui/web-safe-blur';
import { AuthShell } from '@/components/views/AuthShell';
import { authenticateWithBiometrics, getBiometricStatus, getBiometricType } from '@/lib/biometrics';
import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Fingerprint, LogIn, ScanFace } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);

  useEffect(() => {
    getBiometricStatus().then(setBiometricEnabled);
    getBiometricType().then(setBioType);
  }, []);

  const handleBiometricLogin = async () => {
    const success = await authenticateWithBiometrics();
    if (success) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('กรุณาเข้าสู่ระบบปกติก่อน', 'ระบบ Biometric ต้องมีการเข้าสู่ระบบด้วย Google อย่างน้อยหนึ่งครั้งเพื่อจดจำบัญชีครับ');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const redirectTo = Platform.OS === 'web' 
        ? window.location.origin 
        : makeRedirectUri({
            scheme: 'psuscc',
            path: 'auth',
          });

      console.log('🔗 Redirect URI being sent to Supabase:', redirectTo);

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
          const { url } = res;
          const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
          }
        }
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockLogin = (role: 'customer' | 'admin') => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (role === 'customer') {
        router.push('/(customer)/merch-selection');
      } else {
        router.push('/(admin)/dashboard');
      }
    }, 800);
  };

  return (
    <AuthShell>
      <View className="flex-1 items-center justify-center px-6 py-10">
        <View className="w-full max-w-md">
          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-[28px] bg-white/70 items-center justify-center border border-white/60 shadow-sm">
              <LogIn size={34} color="#0f172a" />
            </View>
            <Text className="text-[40px] font-black text-slate-900 tracking-tight mt-6">EventLogis</Text>
            <Text className="text-center text-slate-600 text-[15px] mt-2 leading-6">
              ระบบจัดการสินค้าและโลจิสติกส์{"\n"}สำหรับงานอีเวนต์ครบวงจร
            </Text>
          </View>

          <WebSafeBlurView intensity={55} tint="light" className="rounded-[28px] overflow-hidden border border-white/60">
            <View className="p-5 gap-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full bg-white/80 h-16 border-white/60 rounded-2xl shadow-sm"
                onPress={handleGoogleLogin}
                loading={isLoading}
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-white/90 px-2.5 py-1 rounded-full border border-white/70">
                    <Text className="text-[#4285F4] font-black text-xl">G</Text>
                  </View>
                  <Text className="font-black text-slate-900 text-base">เข้าสู่ระบบด้วย Google</Text>
                </View>
              </Button>

              {biometricEnabled && Platform.OS !== 'web' && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-16 bg-white/70 border-white/60 rounded-2xl shadow-sm"
                  onPress={handleBiometricLogin}
                >
                  <View className="flex-row items-center gap-3">
                    {bioType === 'FACE_ID' ? (
                      <ScanFace size={22} color="#334155" />
                    ) : (
                      <Fingerprint size={22} color="#334155" />
                    )}
                    <Text className="font-extrabold text-slate-700 text-base">
                      เข้าใช้งานด้วย {bioType === 'FACE_ID' ? 'Face ID' : 'Biometrics'}
                    </Text>
                  </View>
                </Button>
              )}

              <Pressable className="pt-2 pb-1 items-center active:opacity-70" onPress={() => router.push('/signup')}>
                <Text className="text-slate-600 text-sm">
                  ยังไม่มีบัญชี? <Text className="text-slate-900 font-black">สมัครสมาชิก</Text>
                </Text>
              </Pressable>
            </View>
          </WebSafeBlurView>
        </View>
      </View>
    </AuthShell>
  );
}
