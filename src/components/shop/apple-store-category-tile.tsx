import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppleStoreLayout as L } from '@/constants/apple-store-ui';
import type { AppleStorePalette } from '@/constants/apple-store-ui';
import { getShopCategoryIconColor } from '@/constants/shop-category-icons';
import { ShopCategoryIcon } from '@/components/shop/shop-category-icon';

type Props = {
  slug: string;
  label: string;
  width?: number;
  palette: AppleStorePalette;
  onPress: () => void;
};

export function AppleStoreCategoryTile({ slug, label, width = 148, palette, onPress }: Props) {
  const accent = getShopCategoryIconColor(slug);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.tile, { width, backgroundColor: palette.card }]}
    >
      <View style={[styles.imageBox, { backgroundColor: palette.cardHover }]}>
        <View style={[styles.iconCircle, { backgroundColor: `${accent}22` }]}>
          <ShopCategoryIcon slug={slug} size={40} color={accent} strokeWidth={1.75} />
        </View>
      </View>
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: L.radiusLg,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  imageBox: {
    width: '100%',
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 10,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
});
