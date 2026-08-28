import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, AccessibilityRole } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { FixedSpace } from './fixed-space';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ToolbarAction {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  color?: string;
  isActive?: boolean;
}

export type ToolbarItem =
  | ({ type: 'action' } & ToolbarAction)
  | {
      type: 'spacer';
      /** Optional stable key for lists */
      key?: string;
    };

interface AppToolbarProps {
  /**
   * Backwards compatible prop (no spacers). Prefer `items` for iOS-style layouts.
   */
  actions?: ToolbarAction[];
  /**
   * Toolbar items. Use `{ type: 'spacer' }` to separate groups like iOS `ToolbarSpacer`.
   */
  items?: ToolbarItem[];
}

/**
 * Bottom screen toolbar — visually separate from the navigation bar (title / back),
 * aligned with Apple HIG “Toolbars” (edge-to-edge strip above tab bar, not a floating nav pill).
 */
export const AppToolbar = ({ actions, items }: AppToolbarProps) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const barBg = isDark ? theme.surface : 'rgba(249, 250, 251, 0.98)';
  const border = theme.border;

  const resolvedItems: ToolbarItem[] =
    items && items.length ? items : actions && actions.length ? actions.map((a) => ({ type: 'action', ...a })) : [];

  const hasSpacer = useMemo(() => resolvedItems.some((x) => x.type === 'spacer'), [resolvedItems]);

  return (
    <View
      accessibilityRole={Platform.select({ ios: 'toolbar', android: 'toolbar', default: undefined }) as AccessibilityRole | undefined}
      style={[
        styles.bar,
        {
          backgroundColor: barBg,
          borderTopColor: border,
          paddingBottom: Math.max(10, insets.bottom),
        },
      ]}
    >
      <View style={[styles.row, hasSpacer ? styles.rowSpaced : styles.rowCentered]}>
        {resolvedItems.map((item, index) => {
          if (item.type === 'spacer') {
            return <View key={item.key || `spacer-${index}`} style={styles.spacer} />;
          }

          const action = item;
          const showFixedGap =
            // Keep old behavior for action-only lists: fixed gap between items
            resolvedItems.every((x) => x.type === 'action') && index < resolvedItems.length - 1;

          return (
            <React.Fragment key={`${action.label}-${index}`}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={action.onPress}
                activeOpacity={0.6}
                accessibilityLabel={action.label}
                accessibilityRole="button"
              >
                <action.icon
                  size={20}
                  color={action.isActive ? action.color || theme.primary : theme.mutedForeground}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    {
                      color: action.isActive ? action.color || theme.primary : theme.mutedForeground,
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
              {showFixedGap && <FixedSpace width={12} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  rowCentered: {
    justifyContent: 'center',
  },
  rowSpaced: {
    justifyContent: 'space-between',
  },
  spacer: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
