import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { F7 } from '@/constants/f7';
import type { AppTheme } from '@/hooks/use-theme';

type F7ButtonProps = {
  theme: AppTheme;
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'fill' | 'outline' | 'plain';
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function F7Button({
  theme,
  label,
  onPress,
  loading,
  disabled,
  variant = 'fill',
  destructive,
  style,
}: F7ButtonProps) {
  const isFill = variant === 'fill';
  const bg =
    variant === 'plain'
      ? 'transparent'
      : destructive
        ? theme.error
        : isFill
          ? theme.primary
          : 'transparent';
  const textColor =
    variant === 'plain'
      ? destructive
        ? theme.error
        : theme.primary
      : isFill
        ? '#FFFFFF'
        : destructive
          ? theme.error
          : theme.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'outline' && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.primary,
        },
        { backgroundColor: bg, opacity: pressed ? 0.72 : disabled ? 0.45 : 1 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontWeight: variant === 'plain' ? '400' : '600',
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: F7.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 17,
    letterSpacing: -0.41,
  },
});
