import { WebSafeBlurView } from '@/components/ui/web-safe-blur';
import { AuthShell } from '@/components/views/AuthShell';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/use-theme';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { AtSign, Camera, CheckCircle2, ChevronDown, Circle, Eye, EyeOff, Lock, Save, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const PREFIX_OPTIONS = ['นาย', 'นาง', 'นางสาว', 'Mr.', 'Mrs.', 'Ms.'];

export default function CompleteProfileScreen() {
  const router = useRouter();
  
  // Profile States
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  
  // Auth States
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);

  // Fetch initial data from metadata (e.g. from Google)
  useEffect(() => {
    const loadInitialData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const metadata = user.user_metadata;
        
        // ดึงชื่อเต็มมาแยกเป็น ชื่อจริง-นามสกุล (ถ้ามี)
        if (metadata.full_name) {
          const nameParts = metadata.full_name.split(' ');
          if (nameParts.length >= 1) setFirstName(nameParts[0]);
          if (nameParts.length >= 2) setLastName(nameParts.slice(1).join(' '));
        }

        // ดึงรูปโปรไฟล์ (ถ้ามี)
        if (metadata.avatar_url) {
          // เราจะเก็บ URL ไว้โชว์ก่อน แต่ถ้าเขาเปลี่ยนรูปใหม่ avatar state จะถูกทับ
          // หมายเหตุ: ตรงนี้เราสร้าง mock asset เพื่อให้ Image โชว์ได้
          // @ts-ignore
          setAvatar({ uri: metadata.avatar_url });
        }
      }
    };
    loadInitialData();
  }, []);

  // Password criteria
  const criteria = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  const isSecure = Object.values(criteria).every(Boolean);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setAvatar(result.assets[0]);
    }
  };

  const handleComplete = async () => {
    if (!prefix || !firstName || !lastName || !username) {
      Toast.show({ type: 'error', text1: 'ข้อมูลไม่ครบ', text2: 'กรุณากรอกข้อมูลส่วนตัวให้ครบทุกช่อง' });
      return;
    }
    if (!isSecure) {
      Toast.show({ type: 'error', text1: 'รหัสผ่านไม่ปลอดภัย', text2: 'กรุณาตั้งรหัสผ่านตามเงื่อนไขที่กำหนด' });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'รหัสผ่านไม่ตรงกัน' });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้งาน');

      let avatarUrl = '';
      // 1. Upload Avatar if exists
      if (avatar?.base64) {
        const filePath = `avatars/${user.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, decode(avatar.base64), { contentType: 'image/jpeg' });
        
        if (uploadError) throw new Error('อัปโหลดรูปภาพไม่สำเร็จ');
        
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = data.publicUrl;
      }

      // 2. Update User Auth Data & Metadata
      const { error } = await supabase.auth.updateUser({
        password: password,
        data: { 
          prefix,
          first_name: firstName,
          last_name: lastName,
          full_name: `${prefix}${firstName} ${lastName}`,
          username,
          avatar_url: avatarUrl,
          is_setup_complete: true 
        }
      });

      if (error) throw error;

      // 3. Update Profiles table
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          prefix,
          first_name: firstName,
          last_name: lastName,
          full_name: `${prefix}${firstName} ${lastName}`,
          avatar_url: avatarUrl,
          email: user.email,
        });

      Toast.show({ type: 'success', text1: 'ตั้งค่าสำเร็จ 🎉', text2: 'ยินดีต้อนรับสู่ EventLogis' });
      router.replace('/(tabs)');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'บันทึกไม่สำเร็จ', text2: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ label, met }: { label: string, met: boolean }) => (
    <View className="flex-row items-center gap-2 mt-1">
      {met ? <CheckCircle2 size={12} color="#10b981" /> : <Circle size={12} color="#475569" />}
      <Text style={{ fontSize: 11, color: met ? '#34d399' : '#94a3b8' }}>{label}</Text>
    </View>
  );

  return (
    <AuthShell>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>ข้อมูลโปรไฟล์</Text>
            <Text style={styles.subtitle}>กรุณาให้ข้อมูลเพิ่มเติมเพื่อการจัดการโลจิสติกส์ที่แม่นยำ</Text>
          </View>

          <WebSafeBlurView intensity={55} tint="light" style={styles.card}>
            {/* Avatar Upload */}
            <View style={styles.avatarSection}>
              <TouchableOpacity style={styles.avatarButton} onPress={pickImage}>
                {avatar ? (
                  <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Camera size={28} color="#64748B" />
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <Camera size={12} color="#0F172A" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarLabel}>รูปโปรไฟล์</Text>
            </View>

            <View style={styles.form}>
            {/* Username */}
            <Text style={styles.label}>ชื่อผู้ใช้งาน (Username)</Text>
            <View style={styles.inputBox}>
              <AtSign size={20} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="username_example"
                placeholderTextColor="#64748B"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            {/* Prefix Selection */}
            <Text style={styles.label}>คำนำหน้าชื่อ</Text>
            <TouchableOpacity 
              style={styles.inputBox} 
              onPress={() => setShowPrefixPicker(!showPrefixPicker)}
            >
              <User size={20} color="#64748B" />
              <Text style={[styles.input, { color: prefix ? '#FFF' : '#64748B', paddingTop: 16 }]}>
                {prefix || 'เลือกคำนำหน้าชื่อ'}
              </Text>
              <ChevronDown size={20} color="#64748B" />
            </TouchableOpacity>

            {showPrefixPicker && (
              <View style={styles.prefixDropdown}>
                {PREFIX_OPTIONS.map((opt) => (
                  <TouchableOpacity 
                    key={opt} 
                    style={styles.prefixOption}
                    onPress={() => { setPrefix(opt); setShowPrefixPicker(false); }}
                  >
                    <Text style={styles.prefixOptionText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Name & Lastname */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>ชื่อจริง</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="ภาษาไทย/อังกฤษ"
                    placeholderTextColor="#64748B"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>นามสกุล</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="ภาษาไทย/อังกฤษ"
                    placeholderTextColor="#64748B"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Password Set */}
            <Text style={styles.label}>ตั้งรหัสผ่านสำหรับระบบ</Text>
            <View style={styles.inputBox}>
              <Lock size={20} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="รหัสผ่านของคุณ"
                placeholderTextColor="#64748B"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color="#64748B" /> : <Eye size={20} color="#64748B" />}
              </TouchableOpacity>
            </View>

            {password.length > 0 && (
              <View style={styles.criteriaGrid}>
                <ValidationItem label="8+ ตัวอักษร" met={criteria.length} />
                <ValidationItem label="พิมพ์ใหญ่" met={criteria.upper} />
                <ValidationItem label="พิมพ์เล็ก" met={criteria.lower} />
                <ValidationItem label="ตัวเลข" met={criteria.number} />
                <ValidationItem label="สัญลักษณ์" met={criteria.special} />
              </View>
            )}

            <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
            <View style={styles.inputBox}>
              <Lock size={20} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                placeholderTextColor="#64748B"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            <TouchableOpacity 
              style={[styles.button, (!isSecure || isLoading) && styles.buttonDisabled]} 
              onPress={handleComplete}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>ยืนยันและเข้าสู่ระบบ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          </WebSafeBlurView>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { padding: 20, paddingTop: 24, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20 },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    padding: 18,
  },
  avatarSection: { alignItems: 'center', marginBottom: 18 },
  avatarButton: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.9)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  avatarLabel: { color: '#64748B', fontSize: 12, marginTop: 10, fontWeight: '700' },
  form: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#0F172A', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 6, marginLeft: 4 },
  inputBox: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', 
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', 
    paddingHorizontal: 16, height: 56 
  },
  input: { flex: 1, color: '#0F172A', marginLeft: 12, fontSize: 15, fontWeight: '600' },
  prefixDropdown: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 18, marginTop: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  prefixOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  prefixOptionText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  criteriaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, marginTop: 8 },
  divider: { height: 1, backgroundColor: 'rgba(2,6,23,0.08)', marginVertical: 18 },
  button: { 
    backgroundColor: '#0F172A', height: 60, borderRadius: 18, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    marginTop: 22, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 
  },
  buttonDisabled: { backgroundColor: '#334155', opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});
