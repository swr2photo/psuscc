import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Alert, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useUploadSlip } from '@/features/payment/api/useUploadSlip';
import { useMerchStore } from '@/features/merch/store/useMerchStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UploadCloud, CheckCircle2, Image as ImageIcon, X } from 'lucide-react-native';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';

export default function UploadSlipScreen() {
  const router = useRouter();
  const { selectedSize, reset } = useMerchStore();
  const { mutateAsync: uploadSlip, isPending } = useUploadSlip();
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!image || !selectedSize) {
      Alert.alert('เกิดข้อผิดพลาด', 'กรุณาเลือกรูปสลิปและไซส์ให้ครบถ้วน');
      return;
    }

    try {
      await uploadSlip({
        uri: image.uri,
        name: image.fileName || 'slip.jpg',
        type: image.mimeType || 'image/jpeg',
        base64: image.base64 || '',
        size: selectedSize,
      });
      
      Alert.alert('สำเร็จ!', 'อัปโหลดสลิปและสั่งซื้อเรียบร้อยแล้ว', [
        { 
          text: 'ตกลง', 
          onPress: () => {
            reset();
            router.replace('/(tabs)');
          }
        }
      ]);
    } catch (error: any) {
      Alert.alert('เกิดข้อผิดพลาด', error.message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-6">
        <View className="flex-row items-center mb-8">
          <BackButton className="-ml-2" onPress={() => router.back()} />
          <Text className="text-2xl font-bold ml-2">ยืนยันการโอนเงิน</Text>
        </View>

        <Card className="mb-8 border-dashed border-2 bg-muted/30">
          <CardContent className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                <ImageIcon size={20} color="black" />
              </View>
              <View>
                <Text className="font-semibold">เสื้อกิจกรรม (Size {selectedSize})</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">กรุณาแนบหลักฐานการโอนเงิน</Text>
              </View>
            </View>
            <Badge variant="secondary" label="รอการชำระ" />
          </CardContent>
        </Card>

        <TouchableOpacity 
          onPress={pickImage}
          activeOpacity={0.8}
          className={cn(
            "flex-1 rounded-3xl border-2 border-dashed items-center justify-center overflow-hidden mb-8",
            image ? "border-primary bg-card" : "border-border bg-muted/20"
          )}
        >
          {image ? (
            <>
              <Image source={{ uri: image.uri }} className="w-full h-full" resizeMode="cover" />
              <View className="absolute top-4 right-4">
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="rounded-full w-8 h-8"
                  onPress={(e) => {
                    e.stopPropagation();
                    setImage(null);
                  }}
                >
                  <X size={16} color="white" />
                </Button>
              </View>
              <View className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl flex-row items-center justify-center gap-2">
                <CheckCircle2 size={16} color="white" />
                <Text className="text-white text-xs font-medium">เลือกรูปภาพแล้ว - แตะเพื่อเปลี่ยน</Text>
              </View>
            </>
          ) : (
            <View className="items-center px-12">
              <View className="w-20 h-20 rounded-full bg-primary/5 items-center justify-center mb-6">
                <UploadCloud size={40} color="#71717a" />
              </View>
              <Text className="text-lg font-bold text-center">อัปโหลดสลิป</Text>
              <Text className="text-muted-foreground text-center mt-2 leading-5">
                แตะที่นี่เพื่อเลือกรูปภาพจากคลังภาพของคุณ{"\n"}รองรับ JPG, PNG
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View className="pb-8">
          <Button 
            variant="default" 
            size="lg" 
            className="h-14 rounded-2xl"
            disabled={!image || isPending}
            onPress={handleUpload}
            loading={isPending}
            label="ยืนยันการชำระเงิน"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
