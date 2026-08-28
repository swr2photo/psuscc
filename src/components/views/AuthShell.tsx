import { WebSafeBlurView } from '@/components/ui/web-safe-blur';
import { PropsWithChildren } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';

type Props = PropsWithChildren<{
  className?: string;
}>;

export function AuthShell({ children, className }: Props) {
  const { theme, isDark } = useTheme();

  return (
    <View className={cn('flex-1', className)} style={{ backgroundColor: theme.background }}>
      {/* Background blobs for premium glassmorphism effect */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={isDark ? ['#1e1b4b', '#0f172a'] : ['#eef2ff', '#ffffff']}
          style={StyleSheet.absoluteFill}
        />
        
        <LinearGradient
          colors={isDark ? ['#4338ca', 'transparent'] : ['#c7d2fe', 'transparent']}
          style={[styles.blob, { top: -100, left: -100, width: 300, height: 300, opacity: isDark ? 0.4 : 0.6 }]}
        />
        <LinearGradient
          colors={isDark ? ['#7c3aed', 'transparent'] : ['#ddd6fe', 'transparent']}
          style={[styles.blob, { bottom: -150, right: -100, width: 400, height: 400, opacity: isDark ? 0.3 : 0.5 }]}
        />
        <LinearGradient
          colors={isDark ? ['#0ea5e9', 'transparent'] : ['#bae6fd', 'transparent']}
          style={[styles.blob, { top: '30%', right: -150, width: 350, height: 350, opacity: isDark ? 0.2 : 0.4 }]}
        />
      </View>

      {Platform.OS !== 'web' ? (
        <WebSafeBlurView
          intensity={isDark ? 50 : 40}
          tint={isDark ? 'dark' : 'light'}
          style={{ flex: 1 }}
        >
          {children}
        </WebSafeBlurView>
      ) : (
        <View className="flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 1000,
  }
});
