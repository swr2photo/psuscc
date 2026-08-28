import { Stack } from 'expo-router';
import { stackScreenContentStyle } from '@/constants/layout';

/** ต้องชี้ index เป็นหน้าเริ่มต้น — อย่าใส่ create-post เป็น Screen แรกใน Stack */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerBlurEffect: 'regular',
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
        contentStyle: stackScreenContentStyle,
      }}
    >
      <Stack.Screen
        name="create-post"
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="create-story"
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="story/[userId]"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack>
  );
}
