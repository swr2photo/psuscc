import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import 'react-native-reanimated';
import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '@/lib/queryClient';
import { flexFill } from '@/constants/layout';
import NetInfo from '@react-native-community/netinfo';
import * as SplashScreen from 'expo-splash-screen';
import { mmkvStorage } from '@/lib/mmkv';

import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Platform, View, StyleSheet, LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { setupNotificationHandler, registerForPushNotificationsAsync } from '@/lib/notifications';
import { initI18n } from '@/lib/i18n';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { upsertLocalAccountFromSession } from '@/lib/auth-accounts';
import { isWebPlatform } from '@/lib/webGuest';
import { fetchIsAppAdmin } from '@/lib/isAdmin';

import './global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { Colors } from '@/constants/theme';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

// LogBox configuration to suppress noise during development
LogBox.ignoreLogs([
  '[Reanimated] Reading from `value` during component render',
  'props.pointerEvents is deprecated',
  'shadow* style props are deprecated',
]);

// ตั้งค่าให้ React Query รู้สถานะเน็ตอัตโนมัติ
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

setupNotificationHandler();

// Admin role is managed in database (public.profiles.role)
const LAST_PUSH_TOKEN_KEY = 'last_saved_push_token';

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const insets = (() => {
    try {
      return useSafeAreaInsets();
    } catch {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }
  })();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [splashComplete, setSplashComplete] = useState(Platform.OS === 'web');
  const navigationTheme =
    colorScheme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: Colors.dark.background,
            card: Colors.dark.card,
            text: Colors.dark.text,
            border: Colors.dark.border,
            primary: Colors.dark.primary,
            notification: Colors.dark.notification,
          },
        }
      : DefaultTheme;

  // NativeWind / react-native-css-interop on web uses class-based dark mode; keep <html> in sync
  // with the active color scheme so `dark:` utilities and CSS variables match the app theme.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.documentElement;
    if (colorScheme === 'dark') {
      el.classList.add('dark');
      el.setAttribute('data-color-scheme', 'dark');
    } else {
      el.classList.remove('dark');
      el.setAttribute('data-color-scheme', 'light');
    }
  }, [colorScheme]);

  // Ref to prevent duplicate background syncs per session
  const lastProcessedUserId = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Safety timeout: force isReady after 5 seconds even if init hangs
      const timeoutId = setTimeout(() => {
        if (!isReady) {
          console.warn('Initialization timed out, forcing isReady');
          setIsReady(true);
        }
      }, 5000);

      try {
        const [
          _,
          {
            data: { session: currentSession },
          },
        ] = await Promise.all([initI18n(), supabase.auth.getSession()]);

        clearTimeout(timeoutId);
        setSession(currentSession);
        setIsReady(true);
        if (Platform.OS === 'web') {
          SplashScreen.hideAsync().catch(() => {});
        }
        
        if (currentSession?.user) {
          handleAuthAndSync(currentSession);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('Init error:', err);
        setIsReady(true);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {

      setSession(newSession);
      if (newSession?.user) {
        upsertLocalAccountFromSession(newSession).catch(() => {});
        handleAuthAndSync(newSession);
        void fetchIsAppAdmin().then(setIsAdmin);
      } else {
        lastProcessedUserId.current = null;
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthAndSync = async (currentSession: Session) => {
    const userId = currentSession.user.id;


    // Only run if user ID changed or hasn't run yet
    if (lastProcessedUserId.current === userId) return;
    lastProcessedUserId.current = userId;

    const metadata = currentSession.user.user_metadata;

    // 🔄 Background Sync Profile
    supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: metadata?.full_name || metadata?.name || '',
        avatar_url: metadata?.avatar_url || metadata?.picture || '',
        email: currentSession.user.email,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.log('Sync profile error:', error);
      });

    // 🔔 Background Push Token
    if (Platform.OS !== 'web') {
      try {
        const lastToken = await mmkvStorage.getItem(LAST_PUSH_TOKEN_KEY);
        const token = await registerForPushNotificationsAsync();

        if (token && token !== lastToken) {
          const { error } = await supabase
            .from('profiles')
            .update({ expo_push_token: token })
            .eq('id', userId);

          if (!error) {
            console.log('Push token updated successfully');
            await mmkvStorage.setItem(LAST_PUSH_TOKEN_KEY, token);
          }
        }
      } catch (e) {
        console.log('Push token process error:', e);
      }
    }
  };

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup =
      segments[0] === '(tabs)' || segments[0] === '(admin)' || segments[0] === '(customer)';
    // ห้ามใช้ segments.length===0 เป็นเงื่อนไข "หน้า login" — ระหว่าง navigation segments ว่างได้
    // ทำให้ผู้ใช้ที่ล็อกอินแล้วถูก replace ไป (tabs) ขณะอยู่ checkin-scanner / event-detail ฯลฯ (เข้าใจว่าโดนเตะไปล็อกอิน)
    const atRootLoginScreen = pathname === '/' || pathname === '/index' || segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';
    const atCompleteProfile = pathname === '/complete-profile';

    if (!session) {
      // Guest (view-only): allow browsing tabs without session.
      if (inAdminGroup || atCompleteProfile) {
        router.replace(isWebPlatform() ? '/(auth)/add' : '/(auth)');
        return;
      }
      // Web: `/` is a login wall on native — send guests to public home.
      if (isWebPlatform() && (pathname === '/' || pathname === '/index')) {
        router.replace('/(tabs)/home');
      }
      return;
    }

    const isSetupComplete = session.user.user_metadata?.is_setup_complete;

    if (inAdminGroup && !isAdmin) {
      Toast.show({
        type: 'error',
        text1: 'เข้าถึงไม่ได้',
        text2: 'คุณไม่มีสิทธิ์เข้าถึงระบบแอดมิน',
      });
      router.replace('/(tabs)');
      return;
    }

    const inTabsGroup = segments[0] === '(tabs)';
    const inAuthGroupCheck = segments[0] === '(auth)';

    if (session && isReady) {
      if (!isSetupComplete && !atCompleteProfile) {
        if (!atCompleteProfile) {
          router.replace('/complete-profile');
        }
      } else if (isSetupComplete && (atRootLoginScreen || inAuthGroupCheck || atCompleteProfile)) {
        if (!inTabsGroup) {
          router.replace('/(tabs)/home');
        }
      }
    }
  }, [session, pathname, segments, isReady]);

  const appShell = (
    <ThemeProvider value={navigationTheme}>
      <View
        style={[
          styles.webContainer,
          { backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background },
        ]}
      >
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerBlurEffect: 'regular',
            headerShadowVisible: false,
            headerTitleAlign: 'left',
            headerBackButtonDisplayMode: 'minimal',
            headerBackTitle: '',
            contentStyle: flexFill,
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: true }} />
          <Stack.Screen name="index" options={{ headerShown: true }} />
          <Stack.Screen name="signup" options={{ headerShown: true }} />
          <Stack.Screen name="complete-profile" options={{ headerShown: true }} />
          <Stack.Screen name="event-detail" options={{ headerShown: true }} />
          <Stack.Screen name="my-activities" options={{ headerShown: true }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="chat-room" options={{ headerShown: false }} />
          <Stack.Screen name="chat-room-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen
            name="checkin-scanner"
            options={{ headerShown: false, animation: 'fade' }}
          />
          <Stack.Screen
            name="logout"
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(customer)" options={{ headerShown: true }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <Toast position="top" topOffset={Math.max(12, insets.top + 8)} />
      </View>
      <AppStatusBar />
      {Platform.OS !== 'web' && !splashComplete ? (
        <AnimatedSplashScreen
          isReady={isReady}
          onAnimationComplete={() => setSplashComplete(true)}
        />
      ) : null}
    </ThemeProvider>
  );

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={flexFill}>
        {Platform.OS === 'web' ? (
          <QueryClientProvider client={queryClient}>{appShell}</QueryClientProvider>
        ) : (
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister }}
          >
            <QueryClientProvider client={queryClient}>
              {appShell}
            </QueryClientProvider>
          </PersistQueryClientProvider>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && ({
      maxWidth: 480,
      width: '100%',
      height: '100vh',
      minHeight: '100vh',
      marginHorizontal: 'auto',
      boxShadow: '0px 0px 20px rgba(0,0,0,0.5)',
    } as any)),
  },
});
