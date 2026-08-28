import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';

interface AppSearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export const AppSearchField = ({
  value,
  onChangeText,
  placeholder = 'ค้นหา...',
  onCancel,
  autoFocus = false,
}: AppSearchFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const cancelBtnAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const { theme } = useTheme();

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(cancelBtnAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    if (value === '') {
      setIsFocused(false);
      Animated.timing(cancelBtnAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onChangeText('');
    setIsFocused(false);
    Animated.timing(cancelBtnAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    if (onCancel) onCancel();
  };

  const cancelBtnWidth = cancelBtnAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 70],
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.secondary },
            isFocused && { backgroundColor: theme.muted },
          ]}
        >
          <Search size={18} color={theme.mutedForeground} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.text }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.mutedForeground}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus={autoFocus}
            returnKeyType="search"
            clearButtonMode="never"
          />
          {value.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
              <View style={[styles.clearIconCircle, { backgroundColor: theme.mutedForeground }]}>
                <X size={12} color={theme.background} />
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Animated.View style={{ width: cancelBtnWidth, overflow: 'hidden' }}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: theme.text }]}>ยกเลิก</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 8,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 17,
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  clearIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingLeft: 12,
    justifyContent: 'center',
    height: 44,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '500',
  },
});
