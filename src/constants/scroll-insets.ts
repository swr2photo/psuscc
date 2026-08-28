import { Platform, type ScrollViewProps } from 'react-native';

/**
 * ScrollView / FlatList หลักใต้ native stack header แบบโปร่ง (iOS)
 * ให้เนื้อหาเริ่มถัดจากแถบหัว ไม่เลื่อนไปทับใต้ blur
 */
export const stackMainScrollProps =
  Platform.OS === 'ios' ? ({ contentInsetAdjustmentBehavior: 'automatic' as const } as const) : ({} as const);

/** ScrollView แนวนอนซ้อน — ไม่ดึง inset ซ้ำกับ scroll หลัก */
export const nestedHorizontalScrollProps =
  Platform.OS === 'ios' ? ({ contentInsetAdjustmentBehavior: 'never' as const } as const) : ({} as const);

/** RefreshControl breaks layout on some react-native-web builds — skip on web. */
export function withScrollRefresh(
  refreshControl: ScrollViewProps['refreshControl'] | undefined,
): { refreshControl?: ScrollViewProps['refreshControl'] } {
  if (Platform.OS === 'web' || !refreshControl) return {};
  return { refreshControl };
}

