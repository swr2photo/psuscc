import { Redirect } from 'expo-router';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { isWebPlatform } from '@/lib/webGuest';
import AuthSwitchProfilesScreen from './(auth)';

/** Native: account switcher at `/`. Web: public browse — land on home tab. */
export default function RootLoginScreen() {
  const { theme } = useTheme();

  if (isWebPlatform()) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          <AuthSwitchProfilesScreen />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
});
