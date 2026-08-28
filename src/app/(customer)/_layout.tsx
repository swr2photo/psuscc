import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="merch-selection" options={{ headerShown: false }} />
      <Stack.Screen name="upload-slip" options={{ headerShown: false }} />
    </Stack>
  );
}
