import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { stackScreenContentStyle } from '@/constants/layout';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function StoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerBlurEffect: 'regular',
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
        contentStyle: stackScreenContentStyle,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerLeft: () => null,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="product/[id]"
        options={{
          headerShown: Platform.OS === 'web',
          title: 'รายละเอียดสินค้า',
        }}
      />
      <Stack.Screen name="orders" options={{ headerShown: false }} />
      <Stack.Screen
        name="category/[slug]"
        options={{
          title: 'หมวดสินค้า',
          headerLargeTitle: Platform.OS === 'ios',
        }}
      />
    </Stack>
  );
}
