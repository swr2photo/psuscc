import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle, type ScrollViewProps } from 'react-native';
import { flexFill } from '@/constants/layout';
import { stackMainScrollProps, withScrollRefresh } from '@/constants/scroll-insets';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra space above fixed footers / tab bar */
  bottomInset?: number;
  refreshControl?: ScrollViewProps['refreshControl'];
};

/** Main vertical scroll for stack screens — fixes zero-height content on web. */
export function ScreenScroll({
  children,
  style,
  contentContainerStyle,
  bottomInset = 120,
  refreshControl,
}: Props) {
  return (
    <ScrollView
      style={[flexFill, style]}
      showsVerticalScrollIndicator={false}
      {...stackMainScrollProps}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset },
        contentContainerStyle,
      ]}
      {...withScrollRefresh(refreshControl)}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {},
});
