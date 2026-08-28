import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

/**
 * Pull-to-refresh แบบเดียวกับหน้าโปรไฟล์: แสดงตัวหมุนเฉพาะเมื่อผู้ใช้ดึงลงเอง
 * (ไม่ผูกกับ `isRefetching` ของ React Query — refetch พื้นหลังจะไม่ทำให้เกิดอาการรีเฟรชค้าง)
 */
export function usePullToRefresh(onRefresh: () => void | Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, onRefresh: handleRefresh };
}

export type PullToRefreshControlProps = {
  refreshing: boolean;
  onRefresh: () => void | Promise<unknown>;
  tintColor: string;
};

/** ใช้คู่กับ {@link usePullToRefresh} — `tintColor` (iOS) + `colors` (Android) */
export function PullToRefreshControl({ refreshing, onRefresh, tintColor }: PullToRefreshControlProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={tintColor}
      colors={[tintColor]}
    />
  );
}
