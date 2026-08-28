import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
  DynamicColorIOS,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

interface BackButtonProps extends TouchableOpacityProps {
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ onPress, color, size = 24, style, ...props }: BackButtonProps) {
  const router = useRouter();
  const { theme } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  };

  const systemBackTint = DynamicColorIOS({
    light: '#007AFF',
    dark: '#0A84FF',
  });
  const chevronTint = color ?? systemBackTint;

  if (Platform.OS === 'ios') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        style={[styles.iosButton, style]}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
        activeOpacity={0.35}
        accessibilityRole="button"
        accessibilityLabel="ย้อนกลับ"
        {...props}
      >
        <SymbolView
          name="chevron.backward"
          size={Math.min(size, 28)}
          tintColor={chevronTint}
          weight="medium"
          fallback={<ArrowLeft size={Math.min(size, 24)} color={color ?? '#007AFF'} />}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
      activeOpacity={0.7}
      {...props}
    >
      <ArrowLeft size={size} color={color ?? theme.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iosButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 44,
    minHeight: 44,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
});
