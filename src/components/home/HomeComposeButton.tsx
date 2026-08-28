import { Alert, Platform, TouchableOpacity, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/use-theme';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import { openHomeCreate } from '@/features/home/openHomeCreate';

export function HomeComposeButton() {
  const router = useRouter();
  const { theme } = useTheme();

  const openMenu = async () => {
    const ok = await ensureAuthedOrGoAuth(router, {
      message: 'เข้าสู่ระบบเพื่อโพสต์หรือสตอรี',
    });
    if (!ok) return;

    if (Platform.OS === 'ios') {
      const { ActionSheetIOS } = require('react-native');
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['ยกเลิก', 'สร้างโพสต์', 'เพิ่มสตอรี', 'เลือกจากคลังรูปภาพ'],
          cancelButtonIndex: 0,
        },
        (index: number) => {
          if (index === 1) openHomeCreate(router, 'post');
          if (index === 2) openHomeCreate(router, 'story');
          if (index === 3) openHomeCreate(router, 'post', true);
        },
      );
      return;
    }

    Alert.alert('สร้างเนื้อหา', undefined, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'สร้างโพสต์', onPress: () => openHomeCreate(router, 'post') },
      { text: 'เลือกจากคลังรูปภาพ', onPress: () => openHomeCreate(router, 'post', true) },
      { text: 'เพิ่มสตอรี', onPress: () => openHomeCreate(router, 'story') },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={() => void openMenu()}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        aspectRatio: 1,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
      }}
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name="plus"
          size={22}
          tintColor={theme.text}
          fallback={<Plus size={20} color={theme.text} strokeWidth={2.5} />}
        />
      ) : (
        <Plus size={20} color={theme.text} strokeWidth={2.5} />
      )}
    </TouchableOpacity>
  );
}
