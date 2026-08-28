import { AuthShell } from '@/components/views/AuthShell';
import { useTheme } from '@/hooks/use-theme';
import { listLocalAccounts, type LocalAuthAccount } from '@/lib/auth-accounts';
import { authenticateWithBiometrics, getBiometricStatus, getBiometricType } from '@/lib/biometrics';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Fingerprint, Plus, ScanFace, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, Text, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

function formatHandle(email: string | null | undefined) {
  if (!email) return '@profile';
  const local = email.split('@')[0]?.trim();
  return `@${local || 'profile'}`;
}

function titleFromAccount(a: LocalAuthAccount) {
  return a.displayName?.trim() || a.email?.trim() || a.phone?.trim() || 'บัญชีของคุณ';
}

export default function AuthSwitchProfilesScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [accounts, setAccounts] = useState<LocalAuthAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [bioType, setBioType] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const accent = isDark ? '#E5E7EB' : '#111827';
  const subtle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(17,24,39,0.72)';
  const card = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, bioOn, bioT, sessionRes] = await Promise.all([
        listLocalAccounts(),
        getBiometricStatus(),
        getBiometricType(),
        supabase.auth.getSession(),
      ]);
      setAccounts(list);
      setBiometricEnabled(bioOn);
      setBioType(bioT);
      setCurrentUserId(sessionRes.data.session?.user?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onAddAccount = () => {
    router.push('/(auth)/add');
  };

  const onMoreOptions = () => {
    router.push('/(auth)/add');
  };

  const onRemoveAccount = async (a: LocalAuthAccount) => {
    Alert.alert('ลบบัญชีออกจากเครื่อง?', titleFromAccount(a), [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          const { removeLocalAccount } = await import('@/lib/auth-accounts');
          await removeLocalAccount(a.userId);
          if (currentUserId && a.userId === currentUserId) {
            await supabase.auth.signOut({ scope: 'local' });
          }
          load();
        },
      },
    ]);
  };

  const onPickAccount = async (a: LocalAuthAccount) => {
    // If this account is already signed in, go straight in (optionally require biometrics)
    if (currentUserId && a.userId === currentUserId) {
      if (biometricEnabled && Platform.OS !== 'web') {
        const ok = await authenticateWithBiometrics();
        if (!ok) return;
      }
      router.replace('/(tabs)');
      return;
    }

    // Switch account: sign out local session first to avoid mixed state.
    try {
      if (biometricEnabled && Platform.OS !== 'web') {
        const ok = await authenticateWithBiometrics();
        if (!ok) return;
      }
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore
    }

    router.push({
      pathname: '/(auth)/add',
      params: {
        email: a.email ?? undefined,
      },
    });
  };

  const headerSubtitle = useMemo(() => {
    if (loading) return 'กำลังโหลดบัญชี...';
    if (!accounts.length) return 'เพิ่มบัญชีเพื่อเริ่มต้นใช้งาน';
    return 'เลือกบัญชีเพื่อเข้าสู่ระบบ';
  }, [accounts.length, loading]);

  return (
    <AuthShell>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-8" style={{ paddingTop: 64, paddingBottom: 34 }}>
        <View className="flex-row items-center justify-between mb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-12 h-12 rounded-2xl items-center justify-center bg-white/40 border border-white/40 shadow-sm"
          >
            <X size={20} color={accent} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '900', color: accent }}>Accounts</Text>
          <View style={{ width: 48 }} />
        </View>

        <View className="mb-10">
          <Text style={{ fontSize: 36, fontWeight: '900', color: accent, letterSpacing: -1 }}>
            Switch profiles
          </Text>
          <Text style={{ marginTop: 8, color: subtle, fontWeight: '600', fontSize: 16 }}>
            {headerSubtitle}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
            data={accounts}
            keyExtractor={(it) => it.userId}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View
                className="rounded-[32px] p-8 items-center"
                style={{ backgroundColor: card, borderWidth: 1, borderColor: border }}
              >
                <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4">
                   <Plus size={24} color="#64748b" />
                </View>
                <Text style={{ color: accent, fontWeight: '900', fontSize: 18, textAlign: 'center' }}>No accounts found</Text>
                <Text style={{ color: subtle, fontWeight: '600', marginTop: 8, lineHeight: 22, textAlign: 'center' }}>
                  Add your first account to start using the platform.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onPickAccount(item)}
                className="rounded-[28px] p-5 mb-4 shadow-sm"
                style={{ backgroundColor: card, borderWidth: 1, borderColor: border }}
              >
                <View className="flex-row items-center">
                  <LinearGradient
                    colors={['#4f46e5', '#818cf8']}
                    style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontWeight: '900', color: '#FFF', fontSize: 20 }}>
                      {(titleFromAccount(item)[0] || 'U').toUpperCase()}
                    </Text>
                  </LinearGradient>
                  
                  <View className="flex-1 ml-4">
                    <Text style={{ fontWeight: '900', fontSize: 18, color: accent }} numberOfLines={1}>
                      {titleFromAccount(item)}
                    </Text>
                    <Text style={{ marginTop: 2, color: subtle, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                      {formatHandle(item.email ?? item.displayName)}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={subtle} strokeWidth={2.5} />
                </View>
                
                <View className="flex-row items-center justify-between mt-5 pt-4 border-t border-slate-200/10">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-emerald-500" />
                    <Text style={{ color: subtle, fontWeight: '700', fontSize: 12 }}>
                      Last active: {new Date(item.lastUsedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => onRemoveAccount(item)}
                    hitSlop={10}
                    className="w-10 h-10 rounded-xl items-center justify-center bg-red-500/10"
                  >
                    <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View className="gap-4 pt-4">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddAccount}
            className="h-16 rounded-[22px] items-center justify-center flex-row gap-3 shadow-md"
            style={{ backgroundColor: theme.primary }}
          >
            <Plus size={20} color="#FFF" strokeWidth={3} />
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 18 }}>
              Add account
            </Text>
          </TouchableOpacity>

          {biometricEnabled && Platform.OS !== 'web' && (
            <View
              className="h-16 rounded-[22px] items-center justify-center flex-row gap-3"
              style={{ backgroundColor: card, borderWidth: 1, borderColor: border }}
            >
              {bioType === 'FACE_ID' ? (
                <ScanFace size={22} color={accent} strokeWidth={2.5} />
              ) : (
                <Fingerprint size={22} color={accent} strokeWidth={2.5} />
              )}
              <Text style={{ color: accent, fontWeight: '900', fontSize: 16 }}>
                Unlock with {bioType === 'FACE_ID' ? 'Face ID' : 'Touch ID'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </AuthShell>
  );
}

