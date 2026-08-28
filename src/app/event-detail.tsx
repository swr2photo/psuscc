import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Linking,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack, Link } from 'expo-router';
import { CalendarDays, MapPin, MessageCircle, Clock, Award, X, Download, ExternalLink, Info, Tag, Users, Navigation, ChevronRight } from 'lucide-react-native';
import { useActivities, Event } from '@/features/activities/api/useActivities';
import { useMyRegistrations } from '@/features/activities/api/useMyRegistrations';
import {
  getPublicEventStatus,
  publicStatusToneColor,
  type EventPublicStatusTone,
} from '@/features/activities/event-status';
import { EventRegistrationSheet } from '@/features/activities/components/EventRegistrationSheet';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ensureAuthedOrGoAuth } from '@/lib/requireAuth';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/use-theme';
import { usePullToRefresh, PullToRefreshControl } from '@/hooks/use-pull-to-refresh';
import { ScreenScroll } from '@/components/ui/screen-scroll';
import { flexFill, screenRoot } from '@/constants/layout';
import { useContentWidth } from '@/hooks/use-content-width';
import {
  buildLayerText,
  formatCertDate,
  getCertDesign,
  getFontFamilyStyle,
} from '@/lib/cert-design';
import type { CertTextLayer } from '@/features/activities/api/useActivities';
import {
  getReadableStorageUrl,
  STORAGE_BUCKET_CERTIFICATES,
} from '@/lib/supabase-storage';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';


const eventDetailScreenOptions = (theme: { text: string; surface: string }) =>
  ({
    title: 'รายละเอียดค่าย',
    headerTintColor: theme.text,
    headerStyle: { backgroundColor: theme.surface },
    headerShadowVisible: false,
  }) as const;

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const contentWidth = useContentWidth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: activities, refetch: refetchActivities } = useActivities();
  const { data: myRegistrations, refetch: refetchMyRegistrations } = useMyRegistrations();

  const { refreshing, onRefresh } = usePullToRefresh(
    useCallback(async () => {
      await Promise.all([refetchActivities(), refetchMyRegistrations()]);
    }, [refetchActivities, refetchMyRegistrations]),
  );
  
  const [showCert, setShowCert] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [selectedPoster, setSelectedPoster] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [certTemplateDisplayUrl, setCertTemplateDisplayUrl] = useState<string | null>(null);
  const [isDownloadingCert, setIsDownloadingCert] = useState(false);
  const [showRegisterSheet, setShowRegisterSheet] = useState(false);
  const certCanvasRef = useRef<View | null>(null);
  
  const event: any = activities?.find(a => a.id === id);
  const registration = myRegistrations?.find(reg => reg.event_id === id);
  const isRegistered = registration?.status === 'registered';

  const formatDateThai = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateTimeThai = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
  };

  const status = useMemo(() => {
    if (!event) {
      return { label: '', active: false, tone: 'muted' as EventPublicStatusTone };
    }
    return getPublicEventStatus(currentTime, event);
  }, [event, currentTime]);
  const releaseDate = event?.cert_release_date ? new Date(event.cert_release_date) : null;
  const isReleased = releaseDate ? currentTime >= releaseDate : false;

  const certDesign = useMemo(
    () => getCertDesign(event?.cert_design, event?.title),
    [event?.cert_design, event?.title],
  );
  const certFontStyle = useMemo(
    () => getFontFamilyStyle(certDesign.fontFamily),
    [certDesign.fontFamily],
  );
  const certDateText = useMemo(() => {
    const base = releaseDate ?? new Date();
    return formatCertDate(base, certDesign.date.format);
  }, [releaseDate, certDesign.date.format]);

  useEffect(() => {
    let cancelled = false;
    const url = event?.cert_template_url;
    if (!url?.trim()) {
      setCertTemplateDisplayUrl(null);
      return;
    }
    void (async () => {
      try {
        const resolved = await getReadableStorageUrl(STORAGE_BUCKET_CERTIFICATES, url);
        if (!cancelled) setCertTemplateDisplayUrl(resolved);
      } catch {
        if (!cancelled) setCertTemplateDisplayUrl(url);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.cert_template_url]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserData({ name: data.user.user_metadata?.full_name || 'ผู้เข้าร่วมกิจกรรม', prefix: data.user.user_metadata?.prefix || 'นาย/นางสาว' });
    });
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, [id]);

  if (!event)
    return (
      <View style={[styles.center, screenRoot, { backgroundColor: theme.background }]}>
        <Stack.Screen options={eventDetailScreenOptions(theme)} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );

  const openMap = () => { if (event.map_url) Linking.openURL(event.map_url); else Alert.alert('ไม่มีข้อมูลแผนที่', 'ทีมงานยังไม่ได้ระบุพิกัด'); };

  const handleMainAction = async () => {
    if (!status.active) {
      Alert.alert('ไม่สามารถลงทะเบียน', status.label);
      return;
    }

    const ok = await ensureAuthedOrGoAuth(router, { message: 'กรุณาเข้าสู่ระบบก่อนสมัครกิจกรรม' });
    if (!ok) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isSetupComplete = user?.user_metadata?.is_setup_complete;

    if (!isSetupComplete) {
      Alert.alert(
        'ข้อมูลไม่ครบถ้วน',
        'กรุณากรอกข้อมูลส่วนตัวในหน้าโปรไฟล์ให้ครบถ้วนก่อนลงทะเบียนกิจกรรมครับ',
        [
          { text: 'ภายหลัง', style: 'cancel' },
          { text: 'ไปที่โปรไฟล์', onPress: () => router.push('/(tabs)/profile') }
        ]
      );
      return;
    }

    setShowRegisterSheet(true);
  };

  const handleDownloadCertificate = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('ดาวน์โหลด', 'โหมดเว็บยังไม่รองรับการบันทึกไฟล์จากหน้าดูเกียรติบัตร');
      return;
    }

    if (!certCanvasRef.current) {
      Alert.alert('ดาวน์โหลดไม่สำเร็จ', 'ยังไม่พร้อมสำหรับการดาวน์โหลด ลองเปิดหน้าดูเกียรติบัตรใหม่อีกครั้ง');
      return;
    }

    setIsDownloadingCert(true);
    try {
      Toast.show({ type: 'info', text1: 'กำลังเตรียมไฟล์เกียรติบัตร...' });
      const tmpUri = await captureRef(certCanvasRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const safeTitle = String(event?.title || 'certificate')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .slice(0, 60);
      const dest = `${FileSystem.cacheDirectory}${safeTitle}-${Date.now()}.png`;
      await FileSystem.copyAsync({ from: tmpUri, to: dest });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'image/png',
          dialogTitle: 'บันทึก/แชร์เกียรติบัตร',
        });
      } else {
        Alert.alert(
          'ดาวน์โหลดไม่ได้บนเครื่องนี้',
          'ไม่พบเมนูแชร์/บันทึกไฟล์ของระบบ (Sharing unavailable)',
        );
      }
    } catch (err: any) {
      console.error('[event-detail] download certificate failed', err);
      Alert.alert('ดาวน์โหลดไม่สำเร็จ', err?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsDownloadingCert(false);
    }
  };

  const infoCard = { backgroundColor: theme.secondary, borderColor: theme.border };
  const pendingCertBanner = {
    backgroundColor: isDark ? theme.secondary : '#F1F5F9',
    borderColor: isDark ? theme.border : '#E2E8F0',
  };

  return (
    <View style={[styles.root, screenRoot, styles.screenColumn, { backgroundColor: theme.background }]}>
      <Stack.Screen options={eventDetailScreenOptions(theme)} />

      <ScreenScroll
        style={flexFill}
        bottomInset={100 + insets.bottom}
        refreshControl={
          <PullToRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={styles.coverWrapper}>
          {Platform.OS === 'ios' ? (
            <Link.AppleZoomTarget>
              {event.cover_url ? (
                <Image source={{ uri: event.cover_url }} style={styles.coverImg} />
              ) : (
                <View style={[styles.coverImg, { backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 80, fontWeight: 'bold', color: 'rgba(255,255,255,0.2)' }}>{event.title[0]}</Text>
                </View>
              )}
            </Link.AppleZoomTarget>
          ) : event.cover_url ? (
            <Image source={{ uri: event.cover_url }} style={styles.coverImg} />
          ) : (
            <View style={[styles.coverImg, { backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 80, fontWeight: 'bold', color: 'rgba(255,255,255,0.2)' }}>{event.title[0]}</Text>
            </View>
          )}
          <View style={styles.badgeRow}>
             <View
               style={[
                 styles.statusBadge,
                 {
                   backgroundColor: isRegistered
                     ? theme.primary
                     : publicStatusToneColor(theme, status.tone),
                 },
               ]}
             >
               <Text style={styles.badgeText}>{isRegistered ? 'ลงทะเบียนแล้ว' : status.label}</Text>
             </View>
             {event.price > 0 && <View style={styles.priceBadge}><Text style={styles.priceBadgeText}>{event.price}฿</Text></View>}
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>
          <View style={styles.infoGrid}>
            <View style={[styles.infoItem, infoCard]}>
              <CalendarDays size={20} color={theme.primary} />
              <View>
                <Text style={[styles.infoLabel, { color: theme.mutedForeground }]}>วันที่จัดงาน</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {formatDateThai(event.start_date)} - {formatDateThai(event.end_date)}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.infoItem, infoCard]} onPress={openMap}>
              <MapPin size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: theme.mutedForeground }]}>สถานที่</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{event.location || 'ไม่ได้ระบุ'}</Text>
              </View>
              {event.map_url && <Navigation size={16} color={theme.primary} />}
            </TouchableOpacity>
            <View style={[styles.infoItem, infoCard]}>
              <Users size={20} color={theme.primary} />
              <View>
                <Text style={[styles.infoLabel, { color: theme.mutedForeground }]}>จำนวนที่รับ</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{event.capacity} คน</Text>
              </View>
            </View>
            <View style={[styles.infoItem, infoCard]}>
              <Clock size={20} color={theme.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: theme.mutedForeground }]}>ช่วงเวลารับสมัคร</Text>
                <View style={{ marginTop: 2 }}>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    เริ่ม: {formatDateTimeThai(event.reg_start_date)}
                  </Text>
                  <Text style={[styles.infoValue, { marginTop: 2, color: theme.error }]}>
                    สิ้นสุด: {formatDateTimeThai(event.reg_end_date)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>รายละเอียดกิจกรรม</Text>
          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            {event.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
          </Text>
          
          {event.detail_images && event.detail_images.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.subSectionTitle, { color: theme.mutedForeground }]}>รูปภาพรายละเอียด</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginTop: 12 }}>
                {event.detail_images.map((img: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.detailCard, { borderColor: theme.border }]}
                    onPress={() => {
                      setSelectedPoster(img);
                      setShowPoster(true);
                    }}
                  >
                    <Image source={{ uri: img }} style={styles.detailImg} /><View style={styles.zoomIcon}><ExternalLink size={16} color="#FFF" /></View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {event.schedule && event.schedule.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>กำหนดการรายวัน</Text>
              {event.schedule.map((day: any, dIdx: number) => (
                <View key={dIdx} style={[styles.dayBox, { backgroundColor: theme.secondary }]}>
                  <View style={[styles.dayLabel, { backgroundColor: theme.primary }]}>
                    <Text style={styles.dayLabelText}>วันที่ {day.day}</Text>
                  </View>
                  {day.items.map((item: any, iIdx: number) => (
                    <View key={iIdx} style={[styles.scheduleItem, { borderBottomColor: theme.border }]}>
                      <Text style={[styles.scheduleTime, { color: theme.primary }]}>{item.time}</Text>
                      <Text style={[styles.scheduleText, { color: theme.text }]}>{item.activity}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          )}

          {isRegistered && event.cert_template_url && (
            <View style={{ marginTop: 32 }}>
              {isReleased ? (
                <View style={styles.certBanner}><Award size={32} color="#F59E0B" /><View style={{ flex: 1 }}><Text style={styles.certTitle}>ยินดีด้วย! คุณได้รับเกียรติบัตร</Text><Text style={styles.certSub}>คุณสามารถดาวน์โหลดได้แล้ว</Text></View><TouchableOpacity style={styles.certViewBtn} onPress={() => setShowCert(true)}><Text style={styles.certViewText}>เปิดดู</Text></TouchableOpacity></View>
              ) : (
                <View style={[styles.certBanner, pendingCertBanner]}>
                  <Clock size={32} color={theme.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.certTitle, { color: theme.text }]}>รอรับเกียรติบัตร</Text>
                    <Text style={[styles.certSub, { color: theme.mutedForeground }]}>
                      ระบบจะเปิดวันที่ {formatDateTimeThai(event.cert_release_date)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScreenScroll>

      {/* Modern Image Gallery Modal */}
      <Modal visible={showPoster} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.galleryHeader}>
            <TouchableOpacity style={styles.closeBtnCircle} onPress={() => setShowPoster(false)}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
          
          {Platform.OS === 'web' ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{
                x: contentWidth * (event.detail_images?.indexOf(selectedPoster) || 0),
                y: 0,
              }}
            >
              {(event.detail_images || []).map((item: string, index: number) => (
                <View key={index} style={{ width: contentWidth, height: '100%', justifyContent: 'center' }}>
                  <Image source={{ uri: item }} style={styles.fullPosterGallery} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          ) : (
            <FlatList
              data={event.detail_images || []}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, index) => index.toString()}
              initialScrollIndex={event.detail_images?.indexOf(selectedPoster) || 0}
              getItemLayout={(_, index) => ({
                length: contentWidth,
                offset: contentWidth * index,
                index,
              })}
              renderItem={({ item }) => (
                <View style={{ width: contentWidth, height: '100%', justifyContent: 'center' }}>
                  <Image source={{ uri: item }} style={styles.fullPosterGallery} resizeMode="contain" />
                </View>
              )}
            />
          )}

          <View style={styles.indicatorRow}>
            {(event.detail_images || []).map((_: any, i: number) => (
              <View 
                key={i} 
                style={[
                  styles.indicatorDot, 
                  event.detail_images?.indexOf(selectedPoster) === i && styles.indicatorActive
                ]} 
              />
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCert}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCert(false)}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowCert(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.certModalSheet} onStartShouldSetResponder={() => true}>
                <View style={styles.modalHeaderClose}>
                  <Text style={styles.modalHeaderTitle}>เกียรติบัตรของคุณ</Text>
                  <TouchableOpacity
                    onPress={() => setShowCert(false)}
                    style={styles.modalCloseBtn}
                    accessibilityRole="button"
                    accessibilityLabel="ปิดหน้าดูเกียรติบัตร"
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  >
                    <X size={24} color="#FFF" />
                    <Text style={styles.modalCloseLabel}>ปิด</Text>
                  </TouchableOpacity>
                </View>
                <View ref={certCanvasRef} collapsable={false} style={styles.certCanvas}>
              {event.cert_template_url && (
                <>
                  <Image
                    source={{ uri: certTemplateDisplayUrl || event.cert_template_url }}
                    style={styles.certImageFull}
                    resizeMode="contain"
                  />

                  {(() => {
                    const subtitle = buildLayerText(certDesign.subtitle, '');
                    return subtitle ? (
                      <CertLayerView
                        layer={subtitle}
                        fontStyle={certFontStyle}
                        text={subtitle.text}
                      />
                    ) : null;
                  })()}

                  <View
                    style={[
                      styles.certNameOverlay,
                      {
                        left: `${event.cert_name_x ?? 50}%`,
                        top: `${event.cert_name_y ?? 50}%`,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Text
                      style={[
                        styles.certUserName,
                        certFontStyle,
                        {
                          fontSize: event.cert_font_size ?? 24,
                          color: event.cert_name_color ?? '#000',
                          fontWeight: event.cert_is_bold ? 'bold' : 'normal',
                          fontStyle: certDesign.nameItalic ? 'italic' : 'normal',
                        },
                      ]}
                    >
                      {event.cert_show_prefix ? `${userData?.prefix || ''} ` : ''}
                      {userData?.name}
                    </Text>
                  </View>

                  {(() => {
                    const eventTitleLayer = buildLayerText(
                      certDesign.eventTitle,
                      event.title || '',
                    );
                    return eventTitleLayer ? (
                      <CertLayerView
                        layer={eventTitleLayer}
                        fontStyle={certFontStyle}
                        text={eventTitleLayer.text}
                      />
                    ) : null;
                  })()}

                  {certDesign.date.show && (
                    <CertLayerView
                      layer={certDesign.date}
                      fontStyle={certFontStyle}
                      text={certDateText}
                    />
                  )}

                  {(() => {
                    const sig = buildLayerText(certDesign.signature, '');
                    return sig ? (
                      <CertLayerView layer={sig} fontStyle={certFontStyle} text={sig.text} />
                    ) : null;
                  })()}

                  {Array.isArray(certDesign.customLayers) &&
                    certDesign.customLayers.map((layer) => {
                      if (!layer.show || !(layer.text || '').trim()) return null;
                      return (
                        <CertLayerView
                          key={layer.id}
                          layer={layer}
                          fontStyle={certFontStyle}
                          text={layer.text || ''}
                        />
                      );
                    })}
                </>
              )}
            </View>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={handleDownloadCertificate}
              disabled={isDownloadingCert}
            >
              {isDownloadingCert ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Download size={20} color="#FFF" />
              )}
              <Text style={styles.downloadText}>
                {isDownloadingCert ? 'กำลังเตรียมไฟล์...' : 'ดาวน์โหลดไฟล์ภาพ (PNG)'}
              </Text>
            </TouchableOpacity>
              </View>
        </View>
      </Modal>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: 20 + insets.bottom,
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          },
          Platform.OS === 'web' && styles.footerWeb,
        ]}
      >
        {isRegistered ? (
          event.chat_type !== 'none' && (
            <TouchableOpacity style={styles.chatFab} onPress={() => { if (event.chat_type === 'internal') router.push({ pathname: '/chat-room', params: { id: event.id, title: event.title } }); else if (event.chat_link) Linking.openURL(event.chat_link); }}><MessageCircle size={24} color="#FFF" /><Text style={styles.chatFabText}>{event.chat_type === 'internal' ? 'แชทกลุ่มค่ายนี้' : 'เข้ากลุ่มแชทภายนอก'}</Text></TouchableOpacity>
          )
        ) : (
          <TouchableOpacity 
            style={[
              styles.mainBtn,
              { backgroundColor: theme.primary },
              !status.active && { backgroundColor: theme.mutedForeground, opacity: 0.5 },
            ]} 
            onPress={handleMainAction} 
            disabled={!status.active}
          >
            <Text style={styles.mainBtnText}>
              {status.active ? 'ลงทะเบียนเข้าร่วม' : status.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <EventRegistrationSheet
        visible={showRegisterSheet}
        event={event as Event}
        onClose={() => setShowRegisterSheet(false)}
      />
    </View>
  );
}

function CertLayerView({
  layer,
  fontStyle,
  text,
}: {
  layer: CertTextLayer;
  fontStyle: { fontFamily?: string };
  text: string;
}) {
  return (
    <View
      style={[styles.certLayerOverlay, { left: `${layer.x}%`, top: `${layer.y}%` }]}
      pointerEvents="none"
    >
      <Text
        style={[
          styles.certLayerText,
          fontStyle,
          {
            fontSize: layer.size,
            color: layer.color,
            fontWeight: layer.bold ? 'bold' : 'normal',
            fontStyle: layer.italic ? 'italic' : 'normal',
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...flexFill },
  screenColumn: { flexDirection: 'column' },
  center: { ...flexFill, justifyContent: 'center', alignItems: 'center' },
  coverWrapper: { width: '100%', height: 220 },
  coverImg: { width: '100%', height: '100%' },
  badgeRow: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  priceBadge: { backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  priceBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  infoGrid: { gap: 12 },
  infoItem: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1 },
  infoLabel: { fontSize: 11 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  subSectionTitle: { fontSize: 14, fontWeight: 'bold' },
  description: { fontSize: 15, lineHeight: 24 },
  detailCard: { width: 140, height: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  detailImg: { width: '100%', height: '100%' },
  zoomIcon: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayBox: { borderRadius: 20, padding: 16, marginBottom: 12 },
  dayLabel: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  dayLabelText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  scheduleItem: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1 },
  scheduleTime: { width: 60, fontWeight: 'bold' },
  scheduleText: { flex: 1 },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    borderTopWidth: 1,
    flexShrink: 0,
  },
  footerWeb: {
    position: 'relative',
  },
  mainBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  mainBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  chatFab: { backgroundColor: '#10B981', height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  chatFabText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingVertical: 24 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  galleryHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: 20 },
  closeBtnCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  fullPosterGallery: { width: '100%', height: '80%' },
  indicatorRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 40, position: 'absolute', bottom: 0, left: 0, right: 0 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  indicatorActive: { backgroundColor: '#FFF', width: 20 },
  certModalSheet: { marginHorizontal: 16, gap: 20 },
  modalHeaderClose: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  modalHeaderTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', flex: 1 },
  modalCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modalCloseLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  certCanvas: { width: '100%', aspectRatio: 1.414, backgroundColor: '#FFF', borderRadius: 8, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  certImageFull: { width: '100%', height: '100%' },
  certNameOverlay: { position: 'absolute', transform: [{ translateX: -120 }, { translateY: -15 }], width: 240, alignItems: 'center' },
  certUserName: { textAlign: 'center' },
  certLayerOverlay: { position: 'absolute', transform: [{ translateX: -120 }, { translateY: -12 }], width: 240, alignItems: 'center' },
  certLayerText: { textAlign: 'center' },
  downloadBtn: { backgroundColor: '#3B82F6', height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  downloadText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  certBanner: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FEF3C7', padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  certTitle: { fontSize: 16, fontWeight: 'bold', color: '#92400E' },
  certSub: { fontSize: 12, color: '#B45309', marginTop: 2 },
  certViewBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  certViewText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 }
});
