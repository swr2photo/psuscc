import { Tabs, useSegments, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Calendar, Home, Search, ShoppingBag, User } from 'lucide-react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/hooks/use-theme';
import { tabSceneContainerStyle } from '@/constants/layout';

/** Hide tab bar on full-screen stacks (profile share, store checkout flow, product detail). */
function hideTabsForSegments(segments: string[]): boolean {
  // If we're on a main tab index, always show tabs
  if (segments.length <= 2 || segments[segments.length - 1] === 'index') {
    return false;
  }

  const si = segments.indexOf('share');
  if (si > 0 && segments[si - 1] === 'profile') return true;

  const storeIdx = segments.indexOf('store');
  if (storeIdx >= 0) {
    const child = segments[storeIdx + 1];
    if (child === 'product' || child === 'category' || child === 'checkout' || child === 'cart') return true;
  }

  const homeIdx = segments.indexOf('home');
  if (homeIdx >= 0) {
    const child = segments[homeIdx + 1];
    if (child === 'create-post' || child === 'create-story' || child === 'story') return true;
  }

  return false;
}

export default function TabLayout() {
  const theme = useTheme().theme;
  const router = useRouter();
  const segments = useSegments();
  const hideTabBar = hideTabsForSegments(segments);
  const tabBarStyleShown = React.useMemo(
    () =>
      ({
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.surface,
        borderTopWidth: 0,
        height: 65,
        paddingBottom: 10,
        paddingTop: 10,
        elevation: 0,
      }) as const,
    [theme.surface],
  );

  if (Platform.OS === 'ios') {
    return (
      <NativeTabs minimizeBehavior="onScrollDown" hidden={hideTabBar}>
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Label>หน้าหลัก</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="activities">
          <NativeTabs.Trigger.Label>กิจกรรม</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="event" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="store">
          <NativeTabs.Trigger.Label>ร้านค้า</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} md="shopping_bag" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>โปรไฟล์</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="search" role="search">
          <NativeTabs.Trigger.Label>ค้นหา</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }}
            md="search"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      {...({ sceneContainerStyle: tabSceneContainerStyle } as any)}
      screenOptions={{
        ...(Platform.OS === 'web' ? { lazy: false } : {}),
        // Each tab has its own Stack (_layout.tsx) + Stack.Screen options — hide tab header to avoid double headers.
        headerShown: false,
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView intensity={80} tint={theme.statusBar === 'light' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null,
        tabBarStyle: hideTabBar
          ? { display: 'none', height: 0, paddingTop: 0, paddingBottom: 0 }
          : tabBarStyleShown,
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 10,
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'หน้าหลัก',
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: 'กิจกรรม',
          tabBarIcon: ({ color, focused }) => (
            <Calendar size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="store"
        options={{
          title: 'ร้านค้า',
          tabBarIcon: ({ color, focused }) => (
            <ShoppingBag size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'โปรไฟล์',
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'ค้นหา',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
