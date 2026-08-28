import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useShopCartQuery } from '@/features/shop/api/useShopCart';

import { SymbolView } from 'expo-symbols';

const ICON_STROKE = 2;

type Variant = 'default' | 'appleStore';

/** ปุ่มตะกร้าใน native header — แยกไฟล์เพื่อหลีกเลี่ยง circular import กับ header-right */
export function StoreHeaderCartButton({
  variant = 'default',
  transparent = false,
}: {
  variant?: Variant;
  transparent?: boolean;
}) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const apple = variant === 'appleStore';
  const { data: items = [] } = useShopCartQuery();
  const count = items.length;

  return (
    <View style={[styles.pillsRow, styles.pillsRowTrailing]}>
      <TouchableOpacity
        style={[
          styles.pillDetached,
          styles.cartPillTap,
          { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
        ]}
        onPress={() => router.push('/(tabs)/store/cart')}
        activeOpacity={0.82}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`ตะกร้า ${count > 0 ? `(${count})` : ''}`}
      >
        {Platform.OS === 'ios' ? (
          <SymbolView
            name="bag"
            size={22}
            tintColor={apple ? '#fff' : theme.text}
            fallback={<ShoppingBag size={21} color={apple ? '#fff' : theme.text} strokeWidth={ICON_STROKE} />}
          />
        ) : (
          <ShoppingBag size={21} color={apple ? '#fff' : theme.text} strokeWidth={ICON_STROKE} />
        )}
        {count > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.badgeChip,
              styles.cartBadge,
              {
                backgroundColor: apple ? '#0A84FF' : theme.primary,
                borderColor: apple ? '#000' : theme.surface,
              },
            ]}
          >
            <Text style={styles.badgeChipText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillsRowTrailing: {
    marginRight: Platform.OS === 'android' ? 6 : 2,
  },
  pillDetached: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    width: 44,
    height: 44,
    aspectRatio: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      default: {
        elevation: 1,
      },
    }),
  },
  cartPillTap: {
    position: 'relative',
  },
  badgeChip: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth + 1,
  },
  cartBadge: {
    top: -4,
    right: -4,
  },
  badgeChipText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
