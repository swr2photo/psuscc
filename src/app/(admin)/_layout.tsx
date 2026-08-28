import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="admin-menu" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="manage-events" />
      <Stack.Screen name="pick-location" />
      <Stack.Screen name="verify-registrations" />
      <Stack.Screen name="event-participants" />
      <Stack.Screen name="certificate-editor" />
      <Stack.Screen name="checkin-sessions" />
      <Stack.Screen name="checkin-summary" />
      <Stack.Screen name="checkin-attendees" />
      <Stack.Screen name="manage-shop" />
      <Stack.Screen name="shop-product-edit" />
      <Stack.Screen name="shop-admin-orders" />
      <Stack.Screen name="shop-settings" />
    </Stack>
  );
}
