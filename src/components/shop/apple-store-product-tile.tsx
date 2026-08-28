import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PackageSearch } from 'lucide-react-native';
import { AppleStoreLayout as L } from '@/constants/apple-store-ui';
import type { AppleStorePalette } from '@/constants/apple-store-ui';
import { displayShopPrice } from '@/components/shop/apple-store-product-card';
import type { ShopProduct } from '@/features/shop/types';

type Props = {
  product: ShopProduct;
  width: number;
  palette: AppleStorePalette;
  onPress: () => void;
};

/** Compact product tile for horizontal rows (Apple Store product strips) */
export function AppleStoreProductTile({ product, width, palette, onPress }: Props) {
  const img = product.image_urls?.[0];
  const price = displayShopPrice(product);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.tile, { width, backgroundColor: palette.card }]}
    >
      <View style={[styles.imageBox, { backgroundColor: palette.cardHover }]}>
        {img ?
          <Image source={{ uri: img }} style={styles.image} resizeMode="contain" />
        : <PackageSearch size={28} color={palette.textSecondary} />}
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: palette.text }]} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={[styles.price, { color: palette.textSecondary }]}>฿{price.toFixed(0)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: L.radiusLg,
    overflow: 'hidden',
  },
  imageBox: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 18,
    minHeight: 36,
  },
  price: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
});
