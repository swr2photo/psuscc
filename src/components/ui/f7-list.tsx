import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { F7 } from '@/constants/f7';
import type { AppTheme } from '@/hooks/use-theme';

function hairline(theme: AppTheme, isDark: boolean) {
  return isDark ? F7.colors.separatorDark : F7.colors.separatorLight;
}

export function F7BlockTitle({
  theme,
  title,
  right,
  style,
}: {
  theme: AppTheme;
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.blockTitleRow, style]}>
      <Text style={[styles.blockTitle, { color: theme.mutedForeground }]}>{title}</Text>
      {right}
    </View>
  );
}

export function F7List({
  theme,
  isDark,
  children,
  style,
}: {
  theme: AppTheme;
  isDark: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.list,
        {
          backgroundColor: theme.surface,
          borderColor: isDark ? theme.border : 'transparent',
        },
        isDark && styles.listDarkBorder,
        style,
      ]}
    >
      {children}
    </View>
  );
}

type F7ListItemBase = {
  theme: AppTheme;
  isDark: boolean;
  title: string;
  subtitle?: string;
  isLast?: boolean;
  media?: React.ReactNode;
  right?: React.ReactNode;
  insetSeparator?: boolean;
};

export function F7ListLink({
  theme,
  isDark,
  title,
  subtitle,
  onPress,
  isLast,
  media,
  rightHint,
  badge,
  activeOpacity = 0.55,
}: F7ListItemBase & {
  onPress: () => void;
  rightHint?: string;
  badge?: boolean;
  activeOpacity?: number;
}) {
  const sep = hairline(theme, isDark);
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && { borderBottomColor: sep, borderBottomWidth: StyleSheet.hairlineWidth }]}
      onPress={onPress}
      activeOpacity={activeOpacity}
    >
      {media ? <View style={styles.media}>{media}</View> : null}
      <View style={styles.rowBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {title}
          </Text>
          {badge ? <View style={[styles.badge, { backgroundColor: theme.primary }]} /> : null}
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightHint ? (
        <Text style={[styles.hint, { color: theme.mutedForeground }]} numberOfLines={1}>
          {rightHint}
        </Text>
      ) : null}
      <ChevronRight size={F7.list.chevronSize} color={theme.muted} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

export function F7ListSwitch({
  theme,
  isDark,
  title,
  subtitle,
  value,
  onValueChange,
  isLast,
  media,
}: F7ListItemBase & {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const sep = hairline(theme, isDark);
  return (
    <View
      style={[styles.row, !isLast && { borderBottomColor: sep, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      {media ? <View style={styles.media}>{media}</View> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? '#39393D' : '#E9E9EA', true: theme.primary }}
        ios_backgroundColor={isDark ? '#39393D' : '#E9E9EA'}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/** Colored square icon tile (F7 list media). */
export function F7MediaIcon({
  children,
  color,
  bgColor,
}: {
  children: React.ReactNode;
  color: string;
  bgColor?: string;
}) {
  return (
    <View
      style={[
        styles.mediaIcon,
        { backgroundColor: bgColor ?? color + '22' },
      ]}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ color?: string; size?: number }>, {
            color,
            size: 20,
          })
        : children}
    </View>
  );
}

export function F7Block({
  theme,
  isDark,
  title,
  titleRight,
  sectionGap,
  children,
}: {
  theme: AppTheme;
  isDark: boolean;
  title: string;
  titleRight?: React.ReactNode;
  sectionGap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={sectionGap ? styles.blockGap : undefined}>
      <F7BlockTitle theme={theme} title={title} right={titleRight} />
      <F7List theme={theme} isDark={isDark}>
        {children}
      </F7List>
    </View>
  );
}

const styles = StyleSheet.create({
  blockGap: { marginTop: 24 },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: F7.list.insetMarginH,
    paddingTop: 8,
    paddingBottom: 6,
  },
  blockTitle: {
    fontSize: F7.list.blockTitleSize,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: -0.08,
  },
  list: {
    marginHorizontal: F7.list.insetMarginH,
    borderRadius: F7.radius.list,
    overflow: 'hidden',
  },
  listDarkBorder: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: F7.list.rowMinHeight,
    paddingVertical: 11,
    paddingHorizontal: F7.list.rowPaddingH,
    gap: 12,
  },
  media: {
    width: F7.list.mediaSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaIcon: {
    width: F7.list.mediaSize,
    height: F7.list.mediaSize,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: F7.list.titleSize,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  subtitle: {
    fontSize: F7.list.subtitleSize,
    marginTop: 2,
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  hint: {
    fontSize: F7.list.subtitleSize,
    marginRight: 2,
    maxWidth: 120,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
