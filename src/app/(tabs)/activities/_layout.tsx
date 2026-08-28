import { Stack } from 'expo-router';
import { stackScreenContentStyle } from '@/constants/layout';

export default function ActivitiesLayout() {
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
    />
  );
}
