import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PackageSearch, Star } from 'lucide-react-native';
import type { ShopProduct } from '@/features/shop/types';
import { formatUnitsSoldLabel, formatRatingAvg } from '@/features/shop/productDisplay';
import type { AppTheme } from '@/hooks/use-theme';

export function displayShopPrice(p: ShopProduct): number {
  const v = p.shop_product_variants ?? [];
  if (v.length === 0) return p.base_price ?? 0;
  return Math.min(...v.map((x) => x.price));
}

type Props = {
  product: ShopProduct;
  width: number;
  theme: AppTheme;
  variant?: 'grid' | 'featured';
  onPress: () => void;
};

export function AppleStoreProductCard({ product, width, theme, variant = 'grid', onPress }: Props) {
  const img = product.image_urls?.[0];
  const price = displayShopPrice(product);
  const soldLabel = formatUnitsSoldLabel(product.units_sold ?? 0);
  const hasRating = (product.review_count ?? 0) > 0 && product.rating_avg != null;
  const featured = variant === 'featured';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.card,
        { width },
        featured && styles.cardFeatured,
        Platform.OS === 'ios' ? styles.shadowIos : styles.shadowAndroid,
        { backgroundColor: theme.surface },
      ]}
    >
      <View style={[styles.imageWrap, { backgroundColor: theme.secondary }]}>
        {img ?
          <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
        : <PackageSearch size={featured ? 32 : 24} color={theme.mutedForeground} />}
        {product.sale_starts_at || product.sale_ends_at ?
          <View style={styles.salePill}>
            <Text style={styles.salePillText}>ลดราคา</Text>
          </View>
        : null}
      </View>
      <View style={[styles.body, featured && styles.bodyFeatured]}>
        <Text
          style={[styles.name, { color: theme.text }, featured && styles.nameFeatured]}
          numberOfLines={featured ? 2 : 2}
        >
          {product.name}
        </Text>
        <Text style={[styles.price, { color: theme.text }]}>฿{price.toFixed(0)}</Text>
        {hasRating ?
          <View style={styles.ratingRow}>
            <Star size={12} color="#FF9500" fill="#FF9500" />
            <Text style={[styles.meta, { color: theme.mutedForeground }]}>
              {formatRatingAvg(product.rating_avg)} · {product.review_count} รีวิว
            </Text>
          </View>
        : soldLabel ?
          <Text style={[styles.meta, { color: theme.mutedForeground }]}>{soldLabel}</Text>
        : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardFeatured: {
    borderRadius: 18,
  },
  shadowIos: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  shadowAndroid: {
    elevation: 2,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  salePill: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  salePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  bodyFeatured: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 19,
    minHeight: 38,
  },
  nameFeatured: {
    fontSize: 16,
    lineHeight: 21,
    minHeight: 42,
  },
  price: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});
