import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/views/AuthShell';
import { authenticateWithBiometrics, getBiometricStatus, getBiometricType } from '@/lib/biometrics';
import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { ArrowLeft, Fingerprint, LogIn, Mail, ScanFace, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

WebBrowser.maybeCompleteAuthSession();

export default function AuthAddAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);

  useEffect(() => {
    getBiometricStatus().then(setBiometricEnabled);
    getBiometricType().then(setBioType);
  }, []);

  const redirectTo = useMemo(() => {
    return Platform.OS === 'web'
      ? window.location.origin
      : makeRedirectUri({
          scheme: 'psuscc',
          path: 'auth',
        });
  }, []);

  const handleGoogle = async () => {
    setIsLoading(true);
    try {
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
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
      }
    } catch (e: any) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', e?.message ?? String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    const ok = await authenticateWithBiometrics();
    if (!ok) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) router.replace('/(tabs)');
    else
      Alert.alert(
        'ยังไม่มีบัญชีในเครื่อง',
        'กรุณาเข้าสู่ระบบด้วย Google หรือ Email อย่างน้อยหนึ่งครั้งก่อน จึงจะปลดล็อกด้วย Biometrics ได้',
      );
  };

  return (
    <AuthShell>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-8" style={{ paddingTop: 64, paddingBottom: 34 }}>
        <View className="mb-12">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
            className="w-12 h-12 items-center justify-center rounded-2xl bg-white/40 border border-white/40 shadow-sm"
          >
            <ArrowLeft size={22} color="#0f172a" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View className="items-center mb-12">
          <View className="w-24 h-24 rounded-[32px] bg-white/50 items-center justify-center border border-white/50 shadow-lg">
             <LinearGradient
               colors={['#4f46e5', '#7c3aed']}
               start={{ x: 0, y: 0 }}
               end={{ x: 1, y: 1 }}
               style={{ width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
             >
               <LogIn size={32} color="#FFF" strokeWidth={2.5} />
             </LinearGradient>
          </View>
          <Text className="text-[36px] font-black text-slate-900 tracking-tighter text-center mt-8">
            Add account
          </Text>
          <Text className="text-center text-slate-500 text-[16px] mt-3 leading-6 font-semibold px-4">
            Unlock the full experience with your preferred account.
          </Text>
        </View>

        <View className="gap-5">
          {/* Premium Google Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            className="w-full h-20 shadow-xl"
            onPress={handleGoogle}
            disabled={isLoading}
          >
            <View className="flex-1 bg-white rounded-[28px] border border-slate-100 overflow-hidden flex-row items-center px-6 gap-5">
               <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-50 shadow-sm overflow-hidden">
                 <Image 
                   source={{ uri: 'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png' }}
                   style={{ width: 28, height: 28 }}
                 />
              </View>
              <Text className="font-black text-slate-800 text-lg flex-1">Sign in with Google</Text>
              <ChevronRight size={20} color="#cbd5e1" strokeWidth={3} />
            </View>
          </TouchableOpacity>

          {/* Premium Email Button with Gradient */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              router.push({ pathname: '/(auth)/email', params: { email: params.email ?? '' } })
            }
            className="w-full h-20 shadow-2xl"
          >
            <LinearGradient
              colors={['#0f172a', '#1e293b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 20 }}
            >
               <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center border border-white/10">
                  <Mail size={22} color="#FFF" strokeWidth={2.5} />
               </View>
               <Text className="font-black text-white text-lg flex-1">Email & Password</Text>
               <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center">
                  <ChevronRight size={16} color="#FFF" strokeWidth={3} />
               </View>
            </LinearGradient>
          </TouchableOpacity>

          {biometricEnabled && Platform.OS !== 'web' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              className="w-full h-20 bg-white/50 border border-white/60 rounded-[28px] shadow-sm"
              onPress={handleBiometricUnlock}
            >
              <View className="flex-row items-center h-full px-6 gap-5">
                <View className="w-12 h-12 bg-indigo-500/10 rounded-2xl items-center justify-center border border-indigo-500/10">
                  {bioType === 'FACE_ID' ? (
                    <ScanFace size={24} color="#4f46e5" strokeWidth={2.5} />
                  ) : (
                    <Fingerprint size={24} color="#4f46e5" strokeWidth={2.5} />
                  )}
                </View>
                <Text className="font-black text-slate-800 text-lg flex-1">
                   {bioType === 'FACE_ID' ? 'Face ID' : 'Touch ID'}
                </Text>
                <ChevronRight size={20} color="#cbd5e1" strokeWidth={3} />
              </View>
            </TouchableOpacity>
          ) : null}

          <Pressable
            className="mt-6 py-2 items-center active:opacity-60"
            onPress={() => router.replace('/(auth)')}
          >
            <Text className="text-slate-500 text-sm font-black tracking-wide uppercase">
              Switch profiles
            </Text>
          </Pressable>
        </View>
      </View>
    </AuthShell>
  );
}

