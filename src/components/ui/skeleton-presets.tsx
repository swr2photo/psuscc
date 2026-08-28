import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Skeleton, SkeletonCircle, SkeletonLine } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/use-theme';
import { isTablet } from '@/lib/utils';

const STORE_GRID_PAD = 48;
const STORE_GRID_GAP = 16;

function skeletonCard(theme: { border: string; surface: string }) {
  return {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 14,
  };
}

/** Home — featured camp hero */
export function SkeletonHomeFeatured() {
  const { theme } = useTheme();
  const h = isTablet ? 400 : 280;
  return (
    <View style={{ paddingHorizontal: 24 }}>
      <View
        style={{
          height: h,
          borderRadius: 36,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <Skeleton height={h * 0.55} borderRadius={0} width="100%" />
        <View style={{ padding: 18, gap: 10 }}>
          <Skeleton width={72} height={22} borderRadius={8} tone="muted" />
          <Skeleton width="85%" height={28} borderRadius={10} />
          <Skeleton width="50%" height={16} borderRadius={8} tone="muted" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Skeleton width={120} height={14} borderRadius={7} tone="muted" />
            <Skeleton width={88} height={32} borderRadius={99} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Activities — one card */
export function SkeletonActivityCard() {
  const { theme } = useTheme();
  return (
    <View
      style={{
        borderRadius: 36,
        marginBottom: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <Skeleton height={190} borderRadius={0} width="100%" />
      <View style={{ padding: 24, gap: 14 }}>
        <Skeleton width="92%" height={22} borderRadius={10} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Skeleton width="44%" height={36} borderRadius={14} tone="muted" />
          <Skeleton width="44%" height={36} borderRadius={14} tone="muted" />
        </View>
      </View>
    </View>
  );
}

export function SkeletonActivityList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ width: '100%', paddingHorizontal: isTablet ? 32 : 24, paddingTop: 8, gap: 0 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonActivityCard key={i} />
      ))}
    </View>
  );
}

/** Store — banner + categories + product grid */
export function SkeletonStoreBrowse() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const cols = isTablet ? 3 : 2;
  const col = (width - STORE_GRID_PAD - STORE_GRID_GAP * (cols - 1)) / cols;
  const rows = 4;

  return (
    <View style={{ flex: 1 }}>
      {/* Carousel hero + CTA block (approx.) */}
      <View style={{ paddingHorizontal: 24, marginBottom: 8, gap: 10 }}>
        <Skeleton height={210} borderRadius={28} width="100%" />
        <Skeleton height={120} borderRadius={22} width="100%" tone="muted" />
      </View>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={88} height={36} borderRadius={16} tone="muted" />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Skeleton width={140} height={22} borderRadius={10} />
          <Skeleton width={56} height={18} borderRadius={8} tone="muted" />
        </View>
        {Array.from({ length: rows }).map((_, r) => (
          <View
            key={r}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 16,
              gap: STORE_GRID_GAP,
            }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <View
                key={c}
                style={{
                  width: col,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: theme.border,
                  overflow: 'hidden',
                  backgroundColor: theme.surface,
                }}
              >
                <Skeleton width="100%" height={col} borderRadius={0} />
                <View style={{ padding: 12, gap: 8 }}>
                  <SkeletonLine width="100%" />
                  <SkeletonLine width="70%" />
                  <Skeleton width={72} height={18} borderRadius={8} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Cart — stacked product rows */
export function SkeletonCartPage() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 12, gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            gap: 12,
            alignItems: 'center',
          }}
        >
          <Skeleton width={88} height={88} borderRadius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonLine width="90%" />
            <SkeletonLine width="60%" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={56} height={22} borderRadius={8} />
              <Skeleton width={72} height={28} borderRadius={8} tone="muted" />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Orders list — Shopee-style rows */
export function SkeletonOrdersList() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12, gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            padding: 12,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={160} height={16} borderRadius={8} />
            <Skeleton width={72} height={16} borderRadius={8} tone="muted" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Skeleton width={56} height={56} borderRadius={8} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonLine width="85%" />
              <SkeletonLine width="50%" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Skeleton width={96} height={36} borderRadius={8} tone="muted" />
            <Skeleton width={96} height={36} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Order detail — body blocks only (stack header stays real; no fake top bar strip) */
export function SkeletonOrderDetail() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingTop: 12, gap: 16 }}>
        <View style={[skeletonCard(theme), { gap: 12 }]}>
          <Skeleton width={140} height={18} borderRadius={8} />
          <SkeletonLine width="100%" />
          <SkeletonLine width="80%" />
        </View>
        <View style={[skeletonCard(theme), { gap: 12 }]}>
          <Skeleton width={120} height={18} borderRadius={8} />
          {[0, 1].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton width={64} height={64} borderRadius={10} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonLine width="90%" />
                <Skeleton width={80} height={18} borderRadius={8} tone="muted" />
              </View>
            </View>
          ))}
        </View>
        <View style={[skeletonCard(theme), { gap: 10 }]}>
          <Skeleton width={100} height={16} borderRadius={8} />
          <SkeletonLine width="100%" />
          <SkeletonLine width="70%" />
        </View>
      </View>
    </View>
  );
}

/** Checkout — address + summary blocks */
export function SkeletonCheckoutPage() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      <View style={[skeletonCard(theme), { gap: 12 }]}>
        <Skeleton width={100} height={16} borderRadius={8} />
        <SkeletonLine width="100%" />
        <SkeletonLine width="85%" />
        <Skeleton height={44} borderRadius={10} width="100%" tone="muted" />
      </View>
      <View style={[skeletonCard(theme), { gap: 12 }]}>
        <Skeleton width={120} height={16} borderRadius={8} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={100} height={14} borderRadius={7} tone="muted" />
            <Skeleton width={56} height={14} borderRadius={7} />
          </View>
        ))}
        <Skeleton height={48} borderRadius={12} width="100%" />
      </View>
    </View>
  );
}

/** Profile — avatar row + 3-column post grid (matches profile screen layout) */
export function SkeletonProfilePage() {
  const { width } = useWindowDimensions();
  const gap = 2;
  const contentW = Math.min(width, 800);
  const cell = (contentW - gap * 2) / 3;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 20, paddingBottom: 24 }}>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <SkeletonCircle size={86} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                <Skeleton width={32} height={18} borderRadius={8} />
                <Skeleton width={48} height={12} borderRadius={6} tone="muted" style={{ marginTop: 6 }} />
              </View>
            ))}
          </View>
        </View>
      </View>
      <Skeleton width="70%" height={20} borderRadius={8} />
      <Skeleton width="40%" height={14} borderRadius={7} tone="muted" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Skeleton height={36} borderRadius={10} style={{ flex: 1 }} />
        <Skeleton height={36} borderRadius={10} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} width={cell} height={cell} borderRadius={0} />
        ))}
      </View>
    </View>
  );
}
