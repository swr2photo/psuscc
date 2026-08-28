import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppleStoreLayout as L } from '@/constants/apple-store-ui';
import type { AppleStorePalette } from '@/constants/apple-store-ui';
import { displayShopPrice } from '@/components/shop/apple-store-product-card';
import type { ShopProduct } from '@/features/shop/types';

type Props = {
  product: ShopProduct;
  width: number;
  palette: AppleStorePalette;
  highlightLabel: string;
  onPress: () => void;
};

export function AppleStoreDiscoverCard({ product, width, palette, highlightLabel, onPress }: Props) {
  const img = product.image_urls?.[0];
  const height = Math.round(width * 0.92);
  const price = displayShopPrice(product);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.wrap, { width, height }]}
    >
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        {img ?
          <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.cardHover }]} />}
        <LinearGradient
          colors={[...palette.discoverGradient]}
          locations={[0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color: palette.link }]}>{highlightLabel}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.price}>จาก ฿{price.toFixed(0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: L.radiusLg,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
    borderRadius: L.radiusLg,
    overflow: 'hidden',
  },
  copy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  price: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 8,
  },
});
