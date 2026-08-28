import { BlurView, type BlurViewProps } from 'expo-blur';
import { PropsWithChildren } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

import { cn } from '@/lib/utils';

type WebSafeBlurViewProps = PropsWithChildren<BlurViewProps & {
  className?: string;
  style?: ViewStyle | ViewStyle[];
}>;

export function WebSafeBlurView({
  children,
  className,
  style,
  ...props
}: WebSafeBlurViewProps) {
  if (Platform.OS === 'web') {
    return (
      <View className={cn(className)} style={style}>
        {children}
      </View>
    );
  }

  return (
    <BlurView className={cn(className)} style={style} {...props}>
      {children}
    </BlurView>
  );
}
