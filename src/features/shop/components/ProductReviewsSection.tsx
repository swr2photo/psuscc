import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Star } from 'lucide-react-native';
import { useShopProductReviews } from '@/features/shop/api/useShopReviews';
import { formatRatingAvg } from '@/features/shop/productDisplay';
import type { AppTheme } from '@/hooks/use-theme';

const STAR = '#FBBF24';

type Props = {
  productId: string;
  ratingAvg: number | null | undefined;
  reviewCount: number | undefined;
  theme: AppTheme;
  isDark: boolean;
};

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={STAR}
          fill={i <= Math.round(rating) ? STAR : 'transparent'}
        />
      ))}
    </View>
  );
}

export function ProductReviewsSection({ productId, ratingAvg, reviewCount, theme, isDark }: Props) {
  const count = reviewCount ?? 0;
  const { data: reviews = [], isPending } = useShopProductReviews(productId, 15);

  if (count === 0 && !isPending && reviews.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 8 }]}>
        <Text style={[styles.title, { color: theme.text }]}>รีวิวจากผู้ซื้อ</Text>
        <Text style={[styles.empty, { color: theme.mutedForeground }]}>
          ยังไม่มีรีวิว — รีวิวได้หลังชำระเงินและรับสินค้าจากคำสั่งซื้อของคุณ
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 8 }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.score, { color: theme.text }]}>{formatRatingAvg(ratingAvg)}</Text>
          <StarRow rating={ratingAvg ?? 0} size={20} />
        </View>
        <Text style={[styles.meta, { color: theme.mutedForeground }]}>
          {count > 0 ? `${count} รีวิว` : 'กำลังโหลด…'}
        </Text>
      </View>

      {isPending ?
        <ActivityIndicator style={{ marginVertical: 16 }} color={STAR} />
      : reviews.length === 0 ?
        <Text style={[styles.empty, { color: theme.mutedForeground }]}>ไม่พบรีวิวที่แสดงได้</Text>
      : (
        reviews.map((r, idx) => (
          <View
            key={r.id}
            style={[
              styles.reviewItem,
              idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            ]}
          >
            <View style={styles.reviewTop}>
              <Text style={[styles.reviewer, { color: theme.mutedForeground }]}>
                {r.reviewer_display_name}
              </Text>
              <Text style={[styles.reviewDate, { color: theme.mutedForeground }]}>
                {formatReviewDate(r.created_at)}
              </Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <StarRow rating={r.rating} />
            </View>
            {r.variant_label ?
              <Text style={[styles.variant, { color: theme.mutedForeground }]}>
                ตัวเลือก: {r.variant_label}
              </Text>
            : null}
            {r.body?.trim() ?
              <Text style={[styles.body, { color: theme.text }]}>{r.body.trim()}</Text>
            : (
              <Text style={[styles.bodyMuted, { color: theme.mutedForeground }]}>
                ไม่ได้เขียนความคิดเห็น
              </Text>
            )}
          </View>
        ))
      )}
    </View>
  );
}

function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 4 },
  header: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800' },
  score: { fontSize: 22, fontWeight: '900' },
  meta: { fontSize: 13, marginTop: 4 },
  empty: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  reviewItem: { paddingVertical: 12 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { fontSize: 13, fontWeight: '600' },
  reviewDate: { fontSize: 12 },
  variant: { fontSize: 12, marginTop: 6 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  bodyMuted: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
});
