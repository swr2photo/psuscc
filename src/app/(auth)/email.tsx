import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/views/AuthShell';
import { supabase } from '@/lib/supabase';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, KeyRound, Mail, ChevronRight } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

export default function AuthEmailPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState(String(params.email ?? ''));
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => normalizeEmail(email).length > 4 && password.length >= 6, [email, password]);

  const onSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const e = normalizeEmail(email);
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
        router.replace('/(tabs)');
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email: e, password });
      if (error) throw error;

      // If email confirmation is enabled, session may be null until confirmed.
      if (!data.session) {
        Alert.alert('สมัครสำเร็จ', 'กรุณายืนยันอีเมลจากลิงก์ที่ส่งไป แล้วกลับมาเข้าสู่ระบบอีกครั้ง');
        setMode('login');
        return;
      }

      router.replace('/complete-profile');
    } catch (err: any) {
      Alert.alert('ไม่สำเร็จ', err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 px-8" style={{ paddingTop: 64, paddingBottom: 34 }}>
          <View className="mb-10">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.back()}
              className="w-12 h-12 items-center justify-center rounded-2xl bg-white/40 border border-white/40 shadow-sm"
            >
              <ArrowLeft size={22} color="#0f172a" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View className="items-center mb-10">
            <LinearGradient
               colors={['#4f46e5', '#7c3aed']}
               start={{ x: 0, y: 0 }}
               end={{ x: 1, y: 1 }}
               style={{ width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 15 }}
            >
               <Mail size={32} color="#FFF" strokeWidth={2.5} />
            </LinearGradient>
            <Text className="text-[34px] font-black text-slate-900 tracking-tighter text-center mt-8">
              {mode === 'login' ? 'Welcome back' : 'Join us'}
            </Text>
            <Text className="text-center text-slate-500 text-[16px] mt-2 leading-6 font-semibold">
              {mode === 'login' ? 'Glad to see you again!' : 'Create an account to continue.'}
            </Text>
          </View>

          <View className="gap-5">
            <View className="bg-white/90 border border-white/60 rounded-[28px] px-6 h-18 flex-row items-center shadow-sm">
              <View className="w-10 h-10 bg-slate-100 rounded-2xl items-center justify-center mr-4">
                 <Mail size={20} color="#64748b" strokeWidth={2.5} />
              </View>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor="rgba(100,116,139,0.4)"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                className="flex-1 text-slate-900 font-black text-lg"
              />
            </View>

            <View className="bg-white/90 border border-white/60 rounded-[28px] px-6 h-18 flex-row items-center shadow-sm">
              <View className="w-10 h-10 bg-slate-100 rounded-2xl items-center justify-center mr-4">
                 <KeyRound size={20} color="#64748b" strokeWidth={2.5} />
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="rgba(100,116,139,0.4)"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-slate-900 font-black text-lg"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onSubmit}
              disabled={!canSubmit || loading}
              className="mt-4 shadow-2xl"
            >
              <LinearGradient
                colors={canSubmit ? ['#0f172a', '#1e293b'] : ['#94a3b8', '#cbd5e1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 72, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 }}
              >
                {loading ? (
                   <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text className="text-white font-black text-xl">
                      {mode === 'login' ? 'Sign in' : 'Create account'}
                    </Text>
                    <ChevronRight size={20} color="#FFF" strokeWidth={3} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Pressable
              className="mt-4 py-2 items-center active:opacity-60"
              onPress={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
            >
              <Text className="text-slate-500 text-sm font-black">
                {mode === 'login' ? (
                  <>
                    NEW HERE? <Text className="text-indigo-600">SIGN UP</Text>
                  </>
                ) : (
                  <>
                    HAVE AN ACCOUNT? <Text className="text-indigo-600">SIGN IN</Text>
                  </>
                )}
              </Text>
            </Pressable>

            <Pressable className="mt-2 items-center py-2 active:opacity-60" onPress={() => router.replace('/(auth)')}>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[3px]">Switch Profiles</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AuthShell>
  );
}

