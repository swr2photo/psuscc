import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Activity as ActivityIcon, Camera, CheckCircle2, ChevronRight, Utensils } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { ActionSheet } from '@/components/ui/action-sheet';
import { useTheme } from '@/hooks/use-theme';
import type { AppTheme } from '@/hooks/use-theme';
import type { Event } from '@/features/activities/api/useActivities';
import { useRegisterActivity } from '@/features/activities/api/useRegisterActivity';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';

const PROMPTPAY_ID = process.env.EXPO_PUBLIC_PROMPTPAY_ID ?? '';
const PAYMENT_ACCOUNT_NAME = process.env.EXPO_PUBLIC_PAYMENT_ACCOUNT_NAME ?? '';

type Props = {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
};

export function EventRegistrationSheet({ visible, event, onClose }: Props) {
  const { theme } = useTheme();
  const { mutateAsync: registerActivity, isPending: isRegistering } = useRegisterActivity();
  const [step, setStep] = useState(1);
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [slip, setSlip] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setAllergies('');
      setMedicalNotes('');
      setSlip(null);
    }
  }, [visible]);

  const pickSlip = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled) setSlip(result.assets[0]);
  };

  const handleFinalSubmit = async () => {
    if (!event) return;
    if (event.price > 0 && !slip) {
      Toast.show({ type: 'error', text1: 'ข้อมูลไม่ครบ', text2: 'กรุณาแนบสลิปโอนเงิน' });
      return;
    }
    setIsUploading(true);
    try {
      let slipUrl = '';
      if (slip?.base64) {
        const filePath = `event-slips/${Date.now()}-${event.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(filePath, decode(slip.base64), { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('certificates').getPublicUrl(filePath);
        slipUrl = data.publicUrl;
      }
      await registerActivity({
        event_id: event.id,
        allergies,
        medical_notes: medicalNotes,
        slip_url: slipUrl,
      });
      setStep(1);
      setAllergies('');
      setMedicalNotes('');
      setSlip(null);
      onClose();
    } catch {
      /* useRegisterActivity onError shows toast */
    } finally {
      setIsUploading(false);
    }
  };

  if (!event) return null;

  const ppQrUri =
    event.price > 0 && PROMPTPAY_ID.trim()
      ? `https://promptpay.io/${PROMPTPAY_ID.trim()}/${event.price}.png`
      : null;

  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title={step === 1 ? 'ข้อมูลผู้สมัคร' : 'ชำระเงิน'}
    >
      <View style={[styles.modalContentWrapper, { backgroundColor: theme.surface }]}>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <StepHealthForm theme={theme} allergies={allergies} medicalNotes={medicalNotes} onAllergies={setAllergies} onMedical={setMedicalNotes} />
          ) : (
            <StepPayment
              theme={theme}
              event={event}
              slip={slip}
              ppQrUri={ppQrUri}
              onPickSlip={pickSlip}
            />
          )}
        </ScrollView>
        <View style={[styles.modalActionFooter, { borderTopColor: theme.border }]}>
          {step === 1 ? (
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}
              onPress={() => (event.price > 0 ? setStep(2) : handleFinalSubmit())}
            >
              <Text style={styles.modalBtnText}>
                {event.price > 0 ? 'ไปหน้าชำระเงิน' : 'ยืนยันการสมัคร'}
              </Text>
              <ChevronRight size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { backgroundColor: theme.secondary }]}
                onPress={() => setStep(1)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: theme.mutedForeground }]}>ย้อนกลับ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { flex: 2, backgroundColor: theme.primary }]}
                onPress={handleFinalSubmit}
                disabled={isUploading || isRegistering}
              >
                {isUploading || isRegistering ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalBtnText}>ยืนยันการสมัคร</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ActionSheet>
  );
}

function StepHealthForm({
  theme,
  allergies,
  medicalNotes,
  onAllergies,
  onMedical,
}: {
  theme: AppTheme;
  allergies: string;
  medicalNotes: string;
  onAllergies: (s: string) => void;
  onMedical: (s: string) => void;
}) {
  return (
    <View style={{ gap: 20 }}>
      <Text style={[styles.modalStepTitle, { color: theme.text }]}>ข้อมูลด้านสุขภาพและอาหาร</Text>
      <View>
        <Text style={[styles.modalInputLabel, { color: theme.mutedForeground }]}>อาหารที่แพ้ (ถ้ามี)</Text>
        <View style={[styles.modalInputBox, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Utensils size={18} color={theme.icon} />
          <TextInput
            style={[styles.modalTextInput, { color: theme.text }]}
            placeholder="เช่น กุ้ง, ไข่, ถั่ว..."
            placeholderTextColor={theme.mutedForeground}
            value={allergies}
            onChangeText={onAllergies}
          />
        </View>
      </View>
      <View>
        <Text style={[styles.modalInputLabel, { color: theme.mutedForeground }]}>โรคประจำตัว / ข้อมูลสุขภาพอื่นๆ</Text>
        <View
          style={[
            styles.modalInputBox,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
              height: 120,
              alignItems: 'flex-start',
              paddingTop: 16,
            },
          ]}
        >
          <ActivityIcon size={18} color={theme.icon} style={{ marginTop: 2 }} />
          <TextInput
            style={[styles.modalTextInput, { color: theme.text, textAlignVertical: 'top' }]}
            placeholder="ระบุข้อมูลที่ทีมงานควรทราบ..."
            placeholderTextColor={theme.mutedForeground}
            multiline
            value={medicalNotes}
            onChangeText={onMedical}
          />
        </View>
      </View>
    </View>
  );
}

function StepPayment({
  theme,
  event,
  slip,
  ppQrUri,
  onPickSlip,
}: {
  theme: AppTheme;
  event: Event;
  slip: ImagePicker.ImagePickerAsset | null;
  ppQrUri: string | null;
  onPickSlip: () => void;
}) {
  if (!(event.price > 0)) {
    return (
      <View style={styles.freeEventInfo}>
        <View style={[styles.successIconWrapper, { backgroundColor: theme.success + '20' }]}>
          <CheckCircle2 size={64} color={theme.success} />
        </View>
        <Text style={[styles.freeEventTitle, { color: theme.text }]}>ไม่มีค่าใช้จ่าย</Text>
        <Text style={[styles.freeEventSub, { color: theme.mutedForeground }]}>
          คุณสามารถสมัครเข้าร่วมกิจกรรมนี้ได้ทันทีโดยไม่ต้องชำระเงิน
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 24 }}>
      <Text style={[styles.modalStepTitle, { color: theme.text }]}>ชำระเงินผ่าน PromptPay</Text>
      <View style={[styles.paymentDisplayCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.promptPayLogoRow}>
          <Image
            source={{
              uri: 'https://upload.wikimedia.org/wikipedia/th/thumb/f/f3/PromptPay_logo.png/1200px-PromptPay_logo.png',
            }}
            style={styles.promptPayLogo}
            resizeMode="contain"
          />
        </View>
        {ppQrUri ? (
          <View style={[styles.qrCodeWrapper, { borderColor: theme.border }]}>
            <Image source={{ uri: ppQrUri }} style={styles.qrCodeImage} />
          </View>
        ) : (
          <Text style={[styles.noQrHint, { color: theme.mutedForeground }]}>
            ยังไม่ได้ตั้งค่ารหัส PromptPay (EXPO_PUBLIC_PROMPTPAY_ID) — โอนตามยอดแล้วแนบสลิป
          </Text>
        )}
        <View style={styles.paymentInfoBox}>
          {(PAYMENT_ACCOUNT_NAME.trim() ? (
            <Text style={[styles.paymentAccountName, { color: theme.mutedForeground }]}>{PAYMENT_ACCOUNT_NAME.trim()}</Text>
          ) : null)}
          {PROMPTPAY_ID.trim() ? (
            <Text style={[styles.promptPayIdText, { color: theme.text }]}>พร้อมเพย์: {PROMPTPAY_ID.trim()}</Text>
          ) : null}
          <View
            style={[
              styles.paymentAmountTag,
              {
                backgroundColor: theme.primary + '10',
                borderColor: theme.primary + '30',
              },
            ]}
          >
            <Text style={[styles.paymentAmountLabel, { color: theme.primary }]}>ยอดชำระ:</Text>
            <Text style={[styles.paymentAmountValue, { color: theme.primary }]}>{event.price}.00 บาท</Text>
          </View>
        </View>
      </View>
      <View>
        <Text style={[styles.modalInputLabel, { color: theme.mutedForeground }]}>แนบสลิปโอนเงิน</Text>
        <TouchableOpacity
          style={[styles.slipUploadBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          onPress={onPickSlip}
        >
          {slip ? (
            <View style={styles.slipPreviewContainer}>
              <Image source={{ uri: slip.uri }} style={styles.slipPreviewImg} />
              <View style={styles.slipOverlay}>
                <CheckCircle2 size={32} color="#FFF" />
                <Text style={styles.slipOverlayText}>แนบเรียบร้อย</Text>
              </View>
            </View>
          ) : (
            <View style={styles.slipPlaceholder}>
              <View style={[styles.cameraIconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Camera size={28} color={theme.primary} />
              </View>
              <Text style={[styles.slipPlaceholderText, { color: theme.mutedForeground }]}>แตะเพื่อแนบสลิป</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContentWrapper: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  modalBody: { padding: 24 },
  modalStepTitle: { fontSize: 24, fontWeight: '900', marginBottom: 24, letterSpacing: -0.5 },
  modalInputLabel: { fontSize: 14, fontWeight: '800', marginBottom: 10, marginLeft: 4 },
  modalInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    height: 60,
  },
  modalTextInput: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600' },
  modalActionFooter: { padding: 24, borderTopWidth: 1 },
  modalPrimaryBtn: {
    height: 64,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: { fontWeight: '800', fontSize: 16 },
  modalBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  modalButtonRow: { flexDirection: 'row', gap: 12 },
  paymentDisplayCard: {
    borderRadius: 36,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    marginBottom: 12,
  },
  promptPayLogoRow: { width: '100%', height: 40, marginBottom: 24, alignItems: 'center' },
  promptPayLogo: { width: 140, height: '100%' },
  qrCodeWrapper: {
    width: 220,
    height: 220,
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCodeImage: { width: '100%', height: '100%' },
  noQrHint: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 16 },
  paymentInfoBox: { marginTop: 24, alignItems: 'center', width: '100%' },
  paymentAccountName: { fontSize: 16, fontWeight: '800' },
  promptPayIdText: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  paymentAmountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 18,
    marginTop: 16,
    borderWidth: 1,
    gap: 8,
  },
  paymentAmountLabel: { fontSize: 14, fontWeight: '700' },
  paymentAmountValue: { fontSize: 22, fontWeight: '900' },
  slipUploadBtn: {
    width: '100%',
    height: 200,
    borderRadius: 32,
    borderStyle: 'dashed',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    overflow: 'hidden',
  },
  slipPreviewContainer: { width: '100%', height: '100%' },
  slipPreviewImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  slipOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 185, 129, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slipOverlayText: { color: '#FFF', fontWeight: '900', marginTop: 10, fontSize: 16 },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  slipPlaceholder: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  slipPlaceholderText: { fontSize: 15, fontWeight: '800' },
  freeEventInfo: { alignItems: 'center', gap: 16, paddingVertical: 32 },
  successIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeEventTitle: { fontSize: 24, fontWeight: '900' },
  freeEventSub: { textAlign: 'center', fontSize: 15, fontWeight: '600', lineHeight: 22 },
});
