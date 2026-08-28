import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Bell, BellDot, ScanLine, Settings2, UserRound } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/features/notifications/api/useNotifications';
import { useAuthSession } from '@/hooks/use-auth-session';
import { getCachedAvatarUrl } from '@/lib/profile-cache';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

/** Visual line weight for lucide glyphs in chrome — reads sharp at small sizes */
const ICON_STROKE = 2;

type HeaderButtonVariant = 'default' | 'nav';

export const HeaderNotificationButton = ({
  chrome = false,
  variant = 'default',
  transparent = false,
}: {
  chrome?: boolean;
  variant?: HeaderButtonVariant;
  transparent?: boolean;
}) => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const { notifications } = useNotifications();
  const { isGuest } = useAuthSession();
  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;
  const BellIcon = unreadCount > 0 ? BellDot : Bell;

  return (
    <TouchableOpacity
      style={[
        styles.iconTap,
        variant === 'nav' && styles.iconTapNav,
        { backgroundColor: 'transparent' },
      ]}
      onPress={() => {
        if (isGuest) router.push('/(auth)/add');
        else router.push('/notifications');
      }}
      activeOpacity={0.82}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="การแจ้งเตือน"
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={unreadCount > 0 ? 'bell.badge' : 'bell'}
          size={22}
          tintColor={theme.text}
          fallback={<BellIcon size={chrome ? 20 : 21} color={theme.text} strokeWidth={ICON_STROKE} />}
        />
      ) : (
        <BellIcon size={chrome ? 20 : 21} color={theme.text} strokeWidth={ICON_STROKE} />
      )}
      {unreadCount > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.badgeChip,
            { backgroundColor: theme.notification, borderColor: theme.surface },
          ]}
        >
          <Text style={styles.badgeChipText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export const HeaderProfileButton = ({
  chrome = false,
  variant = 'default',
}: {
  chrome?: boolean;
  variant?: HeaderButtonVariant;
}) => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      const url = await getCachedAvatarUrl();
      setAvatarUrl(url);
    };
    fetchAvatar();
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.avatarOuter,
        variant === 'nav' && styles.avatarOuterNav,
        { backgroundColor: 'transparent' },
      ]}
      onPress={() => router.push('/(tabs)/profile')}
      activeOpacity={0.82}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="โปรไฟล์"
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <UserRound size={chrome ? 19 : 20} color={theme.mutedForeground} strokeWidth={ICON_STROKE} />
      )}
    </TouchableOpacity>
  );
};

/**
 * โปรไฟล์: ขวา — ตั้งค่า + สแกน (เม็ดยาแยก สไตล์ Safari)
 */
export function ProfileHeaderActions({ transparent = false }: { transparent?: boolean }) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={[styles.pillsRow, styles.pillsRowTrailing]}>
      <TouchableOpacity
        style={[
          styles.pillDetached,
          styles.pillDetachedFirst,
          { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
        ]}
        onPress={() => router.push('/(tabs)/profile/settings')}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="การตั้งค่า"
      >
        {Platform.OS === 'ios' ? (
          <SymbolView name="gearshape" size={22} tintColor={theme.text} fallback={<Settings2 size={20} color={theme.text} strokeWidth={ICON_STROKE} />} />
        ) : (
          <Settings2 size={20} color={theme.text} strokeWidth={ICON_STROKE} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.pillDetached,
          { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 },
        ]}
        onPress={() => router.push('/checkin-scanner')}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="สแกน QR เช็กอิน"
      >
        {Platform.OS === 'ios' ? (
          <SymbolView name="qrcode.viewfinder" size={22} tintColor={theme.text} fallback={<ScanLine size={20} color={theme.text} strokeWidth={ICON_STROKE} />} />
        ) : (
          <ScanLine size={20} color={theme.text} strokeWidth={ICON_STROKE} />
        )}
      </TouchableOpacity>
    </View>
  );
}

/**
 * iOS NavigationBar "pill group" (แบบรวมก้อน เดียว + เส้นแบ่งกลาง)
 */
export const HeaderRightPillGroup = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={[styles.pillGrouped, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <HeaderNotificationButton chrome variant="nav" />
      <View style={[styles.pillDivider, { backgroundColor: theme.border }]} />
      <HeaderProfileButton chrome variant="nav" />
    </View>
  );
};

/**
 * แยกเป็น 2 เม็ดยาเหมือน Safari (recommended สำหรับหน้าแท็บหลัก)
 */
export const HeaderRightPillsSeparated = () => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <View style={[styles.pillsRow, styles.pillsRowTrailing]}>
      <View
        style={[styles.pillDetached, styles.pillDetachedFirst, { backgroundColor: 'transparent', borderWidth: 0 }]}
      >
        <HeaderNotificationButton chrome variant="nav" />
      </View>
      <View style={[styles.pillDetached, { backgroundColor: 'transparent', borderWidth: 0 }]}>
        <HeaderProfileButton chrome variant="nav" />
      </View>
    </View>
  );
};

export const HeaderRight = () => (
  <View style={styles.container}>
    <HeaderNotificationButton />
    <HeaderProfileButton />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Platform.OS === 'ios' ? 10 : 8,
  },
  iconTap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconTapNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  badgeChipText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  avatarOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOuterNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** วางใน native headerRight — ชิดขอบขวาเหมาะสม */
  pillsRowTrailing: {
    marginRight: Platform.OS === 'android' ? 6 : 2,
  },
  pillGrouped: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 5 : 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      default: {
        elevation: 1,
      },
    }),
  },
  pillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    marginHorizontal: Platform.OS === 'ios' ? 6 : 5,
    opacity: 0.85,
  },
  pillDetached: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    width: 44,
    height: 44,
    aspectRatio: 1,
  },
  pillDetachedFirst: {
    marginRight: Platform.OS === 'ios' ? 8 : 6,
  },
});
