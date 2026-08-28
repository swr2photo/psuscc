import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { useSubmitShopReview } from '@/features/shop/api/useShopReviews';
import { useTheme } from '@/hooks/use-theme';

const STAR = '#FBBF24';

type Props = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  productId: string;
  productName: string;
};

export function ShopReviewForm({ visible, onClose, orderId, productId, productName }: Props) {
  const { theme } = useTheme();
  const submit = useSubmitShopReview();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');

  const handleSubmit = async () => {
    if (rating < 1) {
      Alert.alert('ให้คะแนน', 'เลือกคะแนน 1–5 ดาว');
      return;
    }
    try {
      await submit.mutateAsync({
        order_id: orderId,
        product_id: productId,
        rating,
        body: body.trim() || undefined,
      });
      Alert.alert('ขอบคุณ', 'บันทึกรีวิวแล้ว');
      setBody('');
      setRating(5);
      onClose();
    } catch (e) {
      Alert.alert('ไม่สำเร็จ', e instanceof Error ? e.message : 'ส่งรีวิวไม่ได้');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={2}>
              รีวิว: {productName}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: theme.mutedForeground }]}>คะแนน</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={8}>
                <Star size={36} color={STAR} fill={n <= rating ? STAR : 'transparent'} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.mutedForeground }]}>ความคิดเห็น (ไม่บังคับ)</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.secondary,
              },
            ]}
            placeholder="เล่าประสบการณ์การใช้สินค้า…"
            placeholderTextColor={theme.mutedForeground}
            multiline
            maxLength={500}
            value={body}
            onChangeText={setBody}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submit.isPending && { opacity: 0.7 }]}
            onPress={() => void handleSubmit()}
            disabled={submit.isPending}
          >
            {submit.isPending ?
              <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>ส่งรีวิว</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  sheetTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#EE4D2D',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
