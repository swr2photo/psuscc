import React from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

type Props<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  numColumns: number;
  columnWrapperStyle?: ViewStyle;
  emptyComponent?: React.ReactNode;
};

/** FlatList with scrollEnabled={false} often has zero height on web — use a simple grid instead. */
export function WebStaticGrid<T>({
  data,
  keyExtractor,
  renderItem,
  numColumns,
  columnWrapperStyle,
  emptyComponent,
}: Props<T>) {
  if (Platform.OS !== 'web') return null;

  if (!data.length) {
    return <>{emptyComponent ?? null}</>;
  }

  const cols = Math.max(1, numColumns);
  const rows: T[][] = [];
  for (let i = 0; i < data.length; i += cols) {
    rows.push(data.slice(i, i + cols));
  }

  return (
    <View>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={columnWrapperStyle}>
          {row.map((item) => (
            <View key={keyExtractor(item)}>{renderItem(item)}</View>
          ))}
        </View>
      ))}
    </View>
  );
}
