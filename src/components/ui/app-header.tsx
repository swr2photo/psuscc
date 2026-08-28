import { useRouter } from 'expo-router';
import { Bell, ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Typography } from '@/constants/theme';
import { Layout } from '@/constants/layout';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showNotification?: boolean;
  unreadCount?: number;
  onNotificationPress?: () => void;
  avatarUrl?: string | null;
  userName?: string;
  onBack?: () => void;
  showBack?: boolean;
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  rightElement?: React.ReactNode;
  /**
   * When true, render as an overlay (absolute) and transparent by default.
   * Screens should add top padding: insets.top + Layout.topBarHeight.
   */
  overlay?: boolean;
}

export const AppHeader = ({
  title,
  subtitle,
  showNotification = false,
  unreadCount = 0,
  onNotificationPress,
  avatarUrl,
  userName,
  onBack,
  showBack = false,
  backgroundColor: customBgColor,
  titleColor: customTitleColor,
  subtitleColor: customSubtitleColor,
  rightElement,
  overlay = false,
}: AppHeaderProps) => {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const bgColor = customBgColor || (overlay ? 'transparent' : theme.background);
  // For overlay headers we want a bright "glass" surface so black text stays legible.
  const defaultOverlayTitle = '#0F172A';
  const defaultOverlaySub = '#334155';
  const titleColor = customTitleColor || (overlay ? defaultOverlayTitle : theme.text);
  const subtitleColor = customSubtitleColor || (overlay ? defaultOverlaySub : theme.mutedForeground);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/home');
      }
    }
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      router.push('/notifications');
    }
  };

  const initial = userName?.trim()?.[0]?.toUpperCase() || 'U';

  return (
    <View style={[styles.container, overlay && styles.overlay, { backgroundColor: bgColor }]}>
      {overlay ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[
              'rgba(255,255,255,0.96)',
              'rgba(255,255,255,0.84)',
              'rgba(255,255,255,0.62)',
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.5, 0.82, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
      <SafeAreaView edges={['top']}>
        <View style={styles.headerContentWrapper}>
          <View style={styles.headerRow}>
            <View style={styles.leftSection}>
              {showBack && (
                <TouchableOpacity
                  style={[
                    styles.backButton,
                    overlay ? styles.backButtonNav : styles.backButtonDefault,
                    {
                      backgroundColor: overlay ? 'rgba(255,255,255,0.92)' : theme.secondary,
                      borderColor: overlay ? 'rgba(15,23,42,0.10)' : 'transparent',
                    },
                  ]}
                  onPress={handleBack}
                  activeOpacity={0.75}
                  hitSlop={10}
                >
                  <ChevronLeft size={25} color={titleColor} strokeWidth={2.8} />
                </TouchableOpacity>
              )}

              <View style={styles.titleStack}>
                <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle && (
                  <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.rightSection}>
              {rightElement ? (
                <View style={styles.rightElementWrap}>{rightElement}</View>
              ) : (
                <>
                  {showNotification && (
                    <TouchableOpacity
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: overlay ? 'rgba(255,255,255,0.75)' : theme.secondary,
                          borderColor: overlay ? 'rgba(15,23,42,0.08)' : 'transparent',
                        },
                      ]}
                      onPress={handleNotificationPress}
                      activeOpacity={0.75}
                    >
                      <Bell size={20} color={titleColor} strokeWidth={2.3} />
                      {unreadCount > 0 && (
                        <View style={[styles.badgeContainer, { borderColor: bgColor }]}>
                          <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.profileCircle,
                      {
                        backgroundColor: overlay ? 'rgba(255,255,255,0.75)' : theme.secondary,
                        borderColor: overlay ? 'rgba(15,23,42,0.08)' : 'transparent',
                      },
                    ]}
                    onPress={() => router.push('/(tabs)/profile')}
                    activeOpacity={0.75}
                  >
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
                    ) : (
                      <Text style={[styles.profileInitial, { color: titleColor }]}>{initial}</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0,
    ...Platform.select({
      android: {
        elevation: 0,
      },
    }),
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 50,
  },
  headerContentWrapper: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: Layout.topBarHorizontalPadding,
    height: Layout.topBarHeight,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleStack: {
    flex: 1,
    minWidth: 0,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginLeft: 14,
    zIndex: 10,
  },
  rightElementWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backButtonDefault: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonNav: {
    width: 44,
    height: 36,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    ...Typography.pageTitle,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff2d55',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  profileCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  profileInitial: {
    fontSize: 14,
    fontWeight: '900',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
});
