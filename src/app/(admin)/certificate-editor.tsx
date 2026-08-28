import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  Save,
  Upload,
  Move,
  RefreshCw,
  Palette,
  Clock,
  Type,
  Layout as LayoutIcon,
  Calendar as CalendarIcon,
  PenTool,
  Sparkles,
  AlignCenter,
  Search,
  ChevronRight,
  Repeat,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  TextCursorInput,
} from 'lucide-react-native';
import { BackButton } from '@/components/ui/back-button';
import { useState, useEffect, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/use-theme';
import {
  CERT_COLOR_PALETTE,
  CERT_DATE_FORMAT_OPTIONS,
  CERT_FONT_OPTIONS,
  CERT_LAYOUT_OPTIONS,
  DEFAULT_CERT_DESIGN,
  LAYOUT_PRESETS,
  LAYOUT_PRESET_NAME_DEFAULTS,
  buildLayerText,
  createCustomLayer,
  formatCertDate,
  getCertDesign,
  getFontFamilyStyle,
} from '@/lib/cert-design';
import type {
  CertCustomLayer,
  CertDateFormat,
  CertDesign,
  CertFontFamily,
  CertLayoutStyle,
  CertTextLayer,
  Event,
} from '@/features/activities/api/useActivities';
import { useActivities } from '@/features/activities/api/useActivities';
import {
  getReadableStorageUrl,
  STORAGE_BUCKET_CERTIFICATES,
} from '@/lib/supabase-storage';

type LayerKey = 'subtitle' | 'eventTitle' | 'date' | 'signature';
type ActiveLayer = 'name' | LayerKey | { kind: 'custom'; id: string };

const isCustomActive = (
  v: ActiveLayer,
): v is { kind: 'custom'; id: string } => typeof v === 'object' && v !== null && (v as any).kind === 'custom';

const LAYER_META: { key: LayerKey; label: string; icon: any; placeholder?: string }[] = [
  { key: 'subtitle', label: 'ข้อความนำ', icon: AlignCenter, placeholder: 'ขอมอบเกียรติบัตรนี้ให้ไว้เพื่อแสดงว่า' },
  { key: 'eventTitle', label: 'ชื่อกิจกรรม / ค่าย', icon: Sparkles },
  { key: 'date', label: 'วันที่ออกเกียรติบัตร', icon: CalendarIcon },
  { key: 'signature', label: 'ลายเซ็น / ตำแหน่ง', icon: PenTool, placeholder: 'ประธานค่าย' },
];

export default function CertificateEditorScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ eventId?: string; eventTitle?: string }>();
  const {
    data: events,
    isLoading: isLoadingEvents,
    isError: eventsQueryError,
    error: activitiesError,
    refetch: refetchEvents,
  } = useActivities();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(params.eventId || null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string>(params.eventTitle || '');
  const [pickerSearch, setPickerSearch] = useState('');

  const [template, setTemplate] = useState<string | null>(null);
  /** URL จริงสำหรับ <Image> — อาจเป็น signed URL เมื่อ bucket ไม่ public */
  const [templateDisplayUrl, setTemplateDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [fontSize, setFontSize] = useState(28);
  const [color, setColor] = useState('#1F2937');
  const [showPrefix, setShowPrefix] = useState(true);
  const [isBold, setIsBold] = useState(true);
  const [moveStep, setMoveStep] = useState(2);
  const [releaseDate, setReleaseDate] = useState('');

  const [design, setDesign] = useState<CertDesign>(DEFAULT_CERT_DESIGN);

  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('name');

  useEffect(() => {
    if (selectedEventId) {
      fetchCertSettings();
    } else {
      resetEditorState();
    }
  }, [selectedEventId]);

  const resetEditorState = () => {
    setTemplate(null);
    setTemplateDisplayUrl(null);
    setPosX(50);
    setPosY(50);
    setFontSize(28);
    setColor('#1F2937');
    setShowPrefix(true);
    setIsBold(true);
    setReleaseDate('');
    setDesign(DEFAULT_CERT_DESIGN);
    setActiveLayer('name');
  };

  const handlePickEvent = (ev: Event) => {
    setSelectedEventId(ev.id);
    setSelectedEventTitle(ev.title);
  };

  const handleChangeEvent = () => {
    setSelectedEventId(null);
    setSelectedEventTitle('');
    setPickerSearch('');
  };

  const eventId = selectedEventId;
  const eventTitle = selectedEventTitle;

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q),
    );
  }, [events, pickerSearch]);

  useEffect(() => {
    if (eventsQueryError && activitiesError) {
      const msg =
        activitiesError instanceof Error ? activitiesError.message : String(activitiesError);
      Toast.show({
        type: 'error',
        text1: 'โหลดรายการค่ายไม่สำเร็จ',
        text2: msg || 'ตรวจสอบสิทธิ์แอดมินและการเชื่อมต่อ',
      });
    }
  }, [eventsQueryError, activitiesError]);

  const fetchCertSettings = async () => {
    setLoading(true);

    let { data, error } = await supabase
      .from('events')
      .select(
        'cert_template_url, cert_name_x, cert_name_y, cert_font_size, cert_name_color, cert_show_prefix, cert_is_bold, cert_release_date, cert_design, title',
      )
      .eq('id', eventId)
      .single();

    if (error) {
      const missingColumn =
        error.message?.toLowerCase().includes('cert_design') ||
        error.code === '42703' ||
        error.code === 'PGRST204';
      if (missingColumn) {
        const fallback = await supabase
          .from('events')
          .select(
            'cert_template_url, cert_name_x, cert_name_y, cert_font_size, cert_name_color, cert_show_prefix, cert_is_bold, cert_release_date, title',
          )
          .eq('id', eventId)
          .single();
        data = fallback.data as any;
        error = fallback.error;
      }
    }

    if (error) {
      console.error('[certificate-editor] fetchCertSettings', error);
      Toast.show({
        type: 'error',
        text1: 'โหลดข้อมูลเกียรติบัตรไม่สำเร็จ',
        text2: (error as { message?: string }).message || 'ตรวจสอบสิทธิ์แอดมินหรือการเชื่อมต่อ',
      });
      setLoading(false);
      return;
    }

    if (data) {
      setTemplate(data.cert_template_url);
      setPosX(data.cert_name_x ?? 50);
      setPosY(data.cert_name_y ?? 50);
      setFontSize(data.cert_font_size ?? 28);
      setColor(data.cert_name_color ?? '#1F2937');
      setShowPrefix(data.cert_show_prefix !== false);
      setIsBold(data.cert_is_bold !== false);
      setReleaseDate(
        data.cert_release_date
          ? new Date(data.cert_release_date).toISOString().slice(0, 16).replace('T', ' ')
          : '',
      );
      setDesign(getCertDesign((data as any).cert_design, data.title || (eventTitle as string)));
    }
    setLoading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setLoading(true);
      try {
        const filePath = `certs/${eventId}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(filePath, decode(result.assets[0].base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('certificates').getPublicUrl(filePath);
        setTemplate(data.publicUrl);
        Toast.show({ type: 'success', text1: 'อัปโหลดพื้นหลังสำเร็จ' });
      } catch (err: any) {
        Toast.show({ type: 'error', text1: 'อัปโหลดล้มเหลว', text2: err.message });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const basePayload: Record<string, any> = {
        cert_template_url: template,
        cert_name_x: posX,
        cert_name_y: posY,
        cert_font_size: fontSize,
        cert_name_color: color,
        cert_show_prefix: showPrefix,
        cert_is_bold: isBold,
        cert_release_date: releaseDate
          ? new Date(releaseDate.replace(' ', 'T')).toISOString()
          : null,
      };

      const { error: firstError } = await supabase
        .from('events')
        .update({ ...basePayload, cert_design: design })
        .eq('id', eventId);

      if (firstError) {
        const missingColumn =
          firstError.message?.toLowerCase().includes('cert_design') ||
          firstError.code === '42703' ||
          firstError.code === 'PGRST204';

        if (missingColumn) {
          const { error: secondError } = await supabase
            .from('events')
            .update(basePayload)
            .eq('id', eventId);

          if (secondError) throw secondError;

          Toast.show({
            type: 'info',
            text1: 'บันทึกแล้ว (เฉพาะค่าพื้นฐาน)',
            text2: 'กรุณาเพิ่มคอลัมน์ cert_design ใน DB เพื่อบันทึกสไตล์ขั้นสูง',
          });
          return;
        }

        throw firstError;
      }

      Toast.show({ type: 'success', text1: 'บันทึกรูปแบบสำเร็จ' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'บันทึกล้มเหลว', text2: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const updateNum = (prev: number, dir: 'inc' | 'dec') =>
    dir === 'inc' ? Math.min(100, prev + moveStep) : Math.max(0, prev - moveStep);

  const moveLabel = (direction: string) => {
    if (activeLayer === 'name') {
      if (direction === 'up') setPosY((p) => updateNum(p, 'dec'));
      if (direction === 'down') setPosY((p) => updateNum(p, 'inc'));
      if (direction === 'left') setPosX((p) => updateNum(p, 'dec'));
      if (direction === 'right') setPosX((p) => updateNum(p, 'inc'));
      return;
    }

    if (isCustomActive(activeLayer)) {
      const id = activeLayer.id;
      setDesign((d) => {
        const safe = d || DEFAULT_CERT_DESIGN;
        const list = Array.isArray(safe.customLayers) ? safe.customLayers : [];
        const updated = list.map((l) => {
          if (l.id !== id) return l;
          const next = Object.assign({}, l);
          if (direction === 'up') next.y = updateNum(l.y, 'dec');
          if (direction === 'down') next.y = updateNum(l.y, 'inc');
          if (direction === 'left') next.x = updateNum(l.x, 'dec');
          if (direction === 'right') next.x = updateNum(l.x, 'inc');
          return next;
        });
        return Object.assign({}, safe, { customLayers: updated });
      });
      return;
    }

    const fixedKey = activeLayer as LayerKey;
    setDesign((d) => {
      const safe = d || DEFAULT_CERT_DESIGN;
      const layer =
        (safe[fixedKey] as CertTextLayer | undefined) ||
        (DEFAULT_CERT_DESIGN[fixedKey] as CertTextLayer);
      const next: CertTextLayer = Object.assign({}, layer);
      if (direction === 'up') next.y = updateNum(layer.y, 'dec');
      if (direction === 'down') next.y = updateNum(layer.y, 'inc');
      if (direction === 'left') next.x = updateNum(layer.x, 'dec');
      if (direction === 'right') next.x = updateNum(layer.x, 'inc');
      return Object.assign({}, safe, { [fixedKey]: next }) as CertDesign;
    });
  };

  const setLayerPosition = (axis: 'x' | 'y', value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    if (activeLayer === 'name') {
      if (axis === 'x') setPosX(v);
      else setPosY(v);
      return;
    }
    if (isCustomActive(activeLayer)) {
      const id = activeLayer.id;
      setDesign((d) => {
        const safe = d || DEFAULT_CERT_DESIGN;
        const list = Array.isArray(safe.customLayers) ? safe.customLayers : [];
        const updated = list.map((l) =>
          l.id === id ? Object.assign({}, l, { [axis]: v }) : l,
        );
        return Object.assign({}, safe, { customLayers: updated });
      });
      return;
    }
    const fixedKey = activeLayer as LayerKey;
    setDesign((d) => {
      const safe = d || DEFAULT_CERT_DESIGN;
      const layer =
        (safe[fixedKey] as CertTextLayer | undefined) ||
        (DEFAULT_CERT_DESIGN[fixedKey] as CertTextLayer);
      const next = Object.assign({}, layer, { [axis]: v });
      return Object.assign({}, safe, { [fixedKey]: next }) as CertDesign;
    });
  };

  const resetCenter = () => {
    if (activeLayer === 'name') {
      setPosX(50);
      setPosY(50);
      return;
    }
    if (isCustomActive(activeLayer)) {
      const id = activeLayer.id;
      setDesign((d) => {
        const safe = d || DEFAULT_CERT_DESIGN;
        const list = Array.isArray(safe.customLayers) ? safe.customLayers : [];
        const updated = list.map((l) =>
          l.id === id ? Object.assign({}, l, { x: 50, y: 50 }) : l,
        );
        return Object.assign({}, safe, { customLayers: updated });
      });
      return;
    }
    const fixedKey = activeLayer as LayerKey;
    setDesign((d) => {
      const safe = d || DEFAULT_CERT_DESIGN;
      const layer =
        (safe[fixedKey] as CertTextLayer | undefined) ||
        (DEFAULT_CERT_DESIGN[fixedKey] as CertTextLayer);
      const centered = Object.assign({}, layer, { x: 50, y: 50 });
      return Object.assign({}, safe, { [fixedKey]: centered }) as CertDesign;
    });
  };

  const applyPreset = (presetId: CertLayoutStyle) => {
    try {
      const presets = LAYOUT_PRESETS || {};
      const preset = (presets[presetId] || presets.classic) as CertDesign | undefined;
      const nameMap = LAYOUT_PRESET_NAME_DEFAULTS || {};
      const nameDefaults = nameMap[presetId] || nameMap.classic;

      if (!preset || !nameDefaults) {
        Toast.show({ type: 'error', text1: 'ไม่พบสไตล์ที่เลือก' });
        return;
      }

      const fallback = DEFAULT_CERT_DESIGN;
      const presetSubtitle = preset.subtitle || fallback.subtitle;
      const presetEventTitle = preset.eventTitle || fallback.eventTitle;
      const presetDate = preset.date || fallback.date;
      const presetSignature = preset.signature || fallback.signature;

      setDesign((prev) => {
        const safe: CertDesign = prev || fallback;
        const prevEventTitleText =
          (safe.eventTitle && safe.eventTitle.text) || presetEventTitle.text || eventTitle || '';
        const prevSignatureText =
          (safe.signature && safe.signature.text) || presetSignature.text || '';

        const nextDesign: CertDesign = {
          layoutStyle: preset.layoutStyle,
          fontFamily: preset.fontFamily,
          nameItalic: !!preset.nameItalic,
          subtitle: Object.assign({}, presetSubtitle),
          date: Object.assign({}, presetDate),
          eventTitle: Object.assign({}, presetEventTitle, { text: prevEventTitleText }),
          signature: Object.assign({}, presetSignature, { text: prevSignatureText }),
        };
        return nextDesign;
      });

      setColor(nameDefaults.color);
      setFontSize(nameDefaults.size);
      setIsBold(nameDefaults.bold);

      Toast.show({ type: 'success', text1: `ใช้สไตล์ "${presetId}" แล้ว` });
    } catch (err: any) {
      console.error('applyPreset failed:', err);
      Toast.show({
        type: 'error',
        text1: 'ใช้สไตล์ไม่สำเร็จ',
        text2: err?.message || 'เกิดข้อผิดพลาด',
      });
    }
  };

  const updateLayer = (key: LayerKey, patch: Partial<CertTextLayer>) => {
    setDesign((prev) => {
      const safe = prev || DEFAULT_CERT_DESIGN;
      const baseLayer =
        (safe[key] as CertTextLayer | undefined) || (DEFAULT_CERT_DESIGN[key] as CertTextLayer);
      const nextLayer = Object.assign({}, baseLayer, patch);
      return Object.assign({}, safe, { [key]: nextLayer }) as CertDesign;
    });
  };

  const updateDateFormat = (format: CertDateFormat) => {
    setDesign((prev) => {
      const safe = prev || DEFAULT_CERT_DESIGN;
      const baseDate = safe.date || DEFAULT_CERT_DESIGN.date;
      return Object.assign({}, safe, { date: Object.assign({}, baseDate, { format }) });
    });
  };

  const updateCustomLayer = (id: string, patch: Partial<CertCustomLayer>) => {
    setDesign((prev) => {
      const safe = prev || DEFAULT_CERT_DESIGN;
      const list = Array.isArray(safe.customLayers) ? safe.customLayers : [];
      const updated = list.map((l) => (l.id === id ? Object.assign({}, l, patch) : l));
      return Object.assign({}, safe, { customLayers: updated });
    });
  };

  const addCustomLayer = () => {
    const newLayer = createCustomLayer('ข้อความใหม่', { y: 25, size: 14, color: '#1F2937' });
    setDesign((prev) => {
      const safe = prev || DEFAULT_CERT_DESIGN;
      const list = Array.isArray(safe.customLayers) ? safe.customLayers : [];
      return Object.assign({}, safe, { customLayers: list.concat(newLayer) });
    });
    setActiveLayer({ kind: 'custom', id: newLayer.id });
    Toast.show({ type: 'success', text1: 'เพิ่มเลเยอร์ข้อความแล้ว' });
  };

  const deleteCustomLayer = (id: string) => {
    setDesign((prev) => {
      const safe = prev || DEFAULT_CERT_DESIGN;
      const list = Array.isArray(safe.customLayers) ? safe.customLayers : [];
      return Object.assign({}, safe, { customLayers: list.filter((l) => l.id !== id) });
    });
    if (isCustomActive(activeLayer) && activeLayer.id === id) {
      setActiveLayer('name');
    }
    Toast.show({ type: 'info', text1: 'ลบเลเยอร์แล้ว' });
  };

  const fontStyle = useMemo(() => getFontFamilyStyle(design.fontFamily), [design.fontFamily]);

  const previewName = `${showPrefix ? 'นาย ' : ''}ชื่อ-นามสกุล ของผู้สมัคร`;

  const subtitle = buildLayerText(design.subtitle, '');
  const eventTitleLayer = buildLayerText(design.eventTitle, (eventTitle as string) || '');
  const signatureLayer = buildLayerText(design.signature, '');
  const safeDate = design.date ?? DEFAULT_CERT_DESIGN.date;
  const dateText = formatCertDate(new Date(), safeDate.format);
  const dateLayerVisible = safeDate.show ? safeDate : null;
  const customLayers = useMemo<CertCustomLayer[]>(
    () => (Array.isArray(design.customLayers) ? design.customLayers : []),
    [design.customLayers],
  );

  const activeCustomLayer = isCustomActive(activeLayer)
    ? customLayers.find((l) => l.id === activeLayer.id)
    : null;
  const currentLayer: CertTextLayer | null =
    activeLayer === 'name'
      ? null
      : isCustomActive(activeLayer)
        ? (activeCustomLayer as CertTextLayer | undefined) || null
        : (design[activeLayer as LayerKey] as CertTextLayer);

  const activeLayerLabel = useMemo(() => {
    if (activeLayer === 'name') return 'ชื่อผู้รับ';
    if (isCustomActive(activeLayer)) {
      const layer = customLayers.find((l) => l.id === activeLayer.id);
      return layer?.label || (layer?.text ? layer.text.slice(0, 14) : 'ข้อความเพิ่มเติม');
    }
    return LAYER_META.find((l) => l.key === activeLayer)?.label ?? '';
  }, [activeLayer, customLayers]);

  const activeLayerXY = useMemo(() => {
    if (activeLayer === 'name') return { x: posX, y: posY };
    if (currentLayer) return { x: currentLayer.x, y: currentLayer.y };
    return { x: 50, y: 50 };
  }, [activeLayer, currentLayer, posX, posY]);

  if (!selectedEventId) {
    return (
      <EventPicker
        events={filteredEvents}
        rawEvents={events ?? []}
        isLoading={isLoadingEvents}
        search={pickerSearch}
        setSearch={setPickerSearch}
        onPick={handlePickEvent}
        onBack={() => router.back()}
        onRefresh={refetchEvents}
        theme={theme}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
      >
        <BackButton style={styles.backBtn} onPress={() => router.back()} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>ตั้งค่าเกียรติบัตร</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving || !template}>
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Save size={22} color={theme.text} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
        <View style={styles.eventTitleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitleLabel, { color: theme.mutedForeground }]}>กำลังตั้งค่าให้</Text>
            <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
              {eventTitle || 'ค่าย'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.changeEventBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleChangeEvent}
          >
            <Repeat size={14} color={theme.text} />
            <Text style={[styles.changeEventText, { color: theme.text }]}>เปลี่ยนค่าย</Text>
          </TouchableOpacity>
        </View>

        {loading && !template ? (
          <View style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ActivityIndicator color={theme.text} />
            <Text style={[styles.uploadText, { color: theme.mutedForeground }]}>กำลังโหลด...</Text>
          </View>
        ) : !template ? (
          <TouchableOpacity
            style={[styles.uploadBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={pickImage}
          >
            <Upload size={40} color={theme.mutedForeground} />
            <Text style={[styles.uploadText, { color: theme.mutedForeground }]}>
              อัปโหลดรูปพื้นหลังเกียรติบัตร
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.editorContainer}>
            {/* Preview Canvas */}
            <View style={styles.canvasContainer}>
              <View style={styles.canvas}>
                <Image
                  source={{ uri: templateDisplayUrl || template }}
                  style={styles.certImage}
                  resizeMode="contain"
                />

                {/* Subtitle */}
                {subtitle && (
                  <CertOverlay layer={subtitle} fontStyle={fontStyle}>
                    {subtitle.text}
                  </CertOverlay>
                )}

                {/* Name */}
                <View style={[styles.overlay, { left: `${posX}%`, top: `${posY}%` }]}>
                  <Text
                    style={[
                      styles.overlayText,
                      fontStyle,
                      {
                        fontSize,
                        color,
                        fontWeight: isBold ? 'bold' : 'normal',
                        fontStyle: design.nameItalic ? 'italic' : 'normal',
                      },
                    ]}
                  >
                    {previewName}
                  </Text>
                </View>

                {/* Event Title */}
                {eventTitleLayer && (
                  <CertOverlay layer={eventTitleLayer} fontStyle={fontStyle}>
                    {eventTitleLayer.text}
                  </CertOverlay>
                )}

                {/* Date */}
                {dateLayerVisible && (
                  <CertOverlay layer={dateLayerVisible} fontStyle={fontStyle}>
                    {dateText}
                  </CertOverlay>
                )}

                {/* Signature */}
                {signatureLayer && (
                  <CertOverlay layer={signatureLayer} fontStyle={fontStyle}>
                    {signatureLayer.text}
                  </CertOverlay>
                )}

                {/* Custom Layers */}
                {customLayers.map((layer) => {
                  if (!layer.show || !(layer.text || '').trim()) return null;
                  return (
                    <CertOverlay key={layer.id} layer={layer} fontStyle={fontStyle}>
                      {layer.text}
                    </CertOverlay>
                  );
                })}
              </View>
              <View style={styles.canvasBadge}>
                <Text style={styles.canvasBadgeText}>PREVIEW</Text>
              </View>
            </View>

            {/* Layout Presets */}
            <View
              style={[
                styles.controlGroup,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <LayoutIcon size={18} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>เลือกสไตล์เกียรติบัตร</Text>
              </View>
              <Text style={styles.helperText}>แต่ละสไตล์จะปรับองค์ประกอบและสีให้ทันที</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: 4 }}
              >
                {CERT_LAYOUT_OPTIONS.map((p) => {
                  const active = design.layoutStyle === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.presetCard,
                        { backgroundColor: active ? '#8B5CF6' : theme.background, borderColor: active ? '#8B5CF6' : theme.border },
                      ]}
                      onPress={() => applyPreset(p.id)}
                    >
                      <Text
                        style={[
                          styles.presetTitle,
                          { color: active ? '#FFF' : theme.text },
                        ]}
                      >
                        {p.label}
                      </Text>
                      <Text
                        style={[
                          styles.presetDesc,
                          { color: active ? 'rgba(255,255,255,0.85)' : theme.mutedForeground },
                        ]}
                      >
                        {p.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Schedule Section */}
            <View
              style={[
                styles.controlGroup,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Clock size={18} color="#3B82F6" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>กำหนดการปล่อยเกียรติบัตร</Text>
              </View>
              <Text style={styles.label}>ระบุวันที่และเวลา (YYYY-MM-DD HH:mm)</Text>
              <View style={styles.dateInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={releaseDate}
                  onChangeText={setReleaseDate}
                  placeholder="2026-05-20 16:00"
                />
                <TouchableOpacity
                  style={styles.nowBtn}
                  onPress={() =>
                    setReleaseDate(new Date().toISOString().slice(0, 16).replace('T', ' '))
                  }
                >
                  <Text style={styles.nowBtnText}>ทันที</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.infoSmall}>* ผู้สมัครจะเห็นปุ่มโหลดเมื่อถึงเวลาที่กำหนดเท่านั้น</Text>
            </View>

            {/* Layer selector */}
            <View
              style={[
                styles.controlGroup,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Type size={18} color="#3B82F6" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>เลเยอร์ที่กำลังแก้ไข</Text>
              </View>
              <View style={styles.layerTabs}>
                <LayerTab
                  active={activeLayer === 'name'}
                  label="ชื่อผู้รับ"
                  onPress={() => setActiveLayer('name')}
                />
                {LAYER_META.map((m) => (
                  <LayerTab
                    key={m.key}
                    active={activeLayer === m.key}
                    label={m.label}
                    onPress={() => setActiveLayer(m.key)}
                  />
                ))}
                {customLayers.map((layer, idx) => {
                  const active = isCustomActive(activeLayer) && activeLayer.id === layer.id;
                  return (
                    <LayerTab
                      key={layer.id}
                      active={active}
                      label={layer.label || layer.text || `ข้อความ #${idx + 1}`}
                      onPress={() => setActiveLayer({ kind: 'custom', id: layer.id })}
                      onDelete={() => deleteCustomLayer(layer.id)}
                    />
                  );
                })}
                <TouchableOpacity style={styles.addLayerBtn} onPress={addCustomLayer}>
                  <Plus size={14} color="#3B82F6" />
                  <Text style={styles.addLayerText}>เพิ่มข้อความ</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.helperText, { marginTop: 10 }]}>
                แตะ "เพิ่มข้อความ" เพื่อเพิ่มเลเยอร์ข้อความเอง — ใส่อะไรก็ได้บนเกียรติบัตร
              </Text>
            </View>

            {/* Movement controls */}
            <View
              style={[
                styles.controlGroup,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Move size={18} color="#3B82F6" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>ตำแหน่งเลเยอร์</Text>
              </View>
              <View style={styles.stepRow}>
                <Text style={styles.label}>เลื่อนครั้งละ (%):</Text>
                <View style={styles.stepControls}>
                  {[1, 2, 5, 10].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stepBtn, moveStep === s && styles.stepBtnActive]}
                      onPress={() => setMoveStep(s)}
                    >
                      <Text style={[styles.stepBtnText, moveStep === s && styles.stepBtnTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.xyRow}>
                <XYNumberInput
                  label="X"
                  value={activeLayerXY.x}
                  onChange={(v) => setLayerPosition('x', v)}
                />
                <XYNumberInput
                  label="Y"
                  value={activeLayerXY.y}
                  onChange={(v) => setLayerPosition('y', v)}
                />
              </View>
              <View style={styles.moveGrid}>
                <View />
                <TouchableOpacity style={styles.moveBtn} onPress={() => moveLabel('up')}>
                  <Text>▲</Text>
                </TouchableOpacity>
                <View />
                <TouchableOpacity style={styles.moveBtn} onPress={() => moveLabel('left')}>
                  <Text>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moveBtn} onPress={resetCenter}>
                  <RefreshCw size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.moveBtn} onPress={() => moveLabel('right')}>
                  <Text>▶</Text>
                </TouchableOpacity>
                <View />
                <TouchableOpacity style={styles.moveBtn} onPress={() => moveLabel('down')}>
                  <Text>▼</Text>
                </TouchableOpacity>
                <View />
              </View>
              <Text style={styles.helperText}>
                กำลังแก้: {activeLayerLabel} · X {activeLayerXY.x}% / Y {activeLayerXY.y}%
              </Text>
            </View>

            {/* Name layer settings (legacy) */}
            {activeLayer === 'name' && (
              <View
                style={[
                  styles.controlGroup,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <Palette size={18} color="#3B82F6" />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>สไตล์ชื่อผู้รับ</Text>
                </View>
                <Text style={styles.label}>สีตัวอักษร</Text>
                <View style={styles.colorRow}>
                  {CERT_COLOR_PALETTE.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        color === c && styles.colorCircleActive,
                      ]}
                      onPress={() => setColor(c)}
                    />
                  ))}
                </View>
                <SettingRow
                  label="แสดงคำนำหน้าชื่อ"
                  sub="นาย/นางสาว"
                  value={showPrefix}
                  onChange={setShowPrefix}
                />
                <SettingRow label="ตัวหนา (Bold)" value={isBold} onChange={setIsBold} />
                <SettingRow
                  label="ตัวเอียง (Italic)"
                  value={!!design.nameItalic}
                  onChange={(v) =>
                    setDesign((d) => Object.assign({}, d || DEFAULT_CERT_DESIGN, { nameItalic: v }))
                  }
                />
                <View style={styles.fontControls}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ขนาด: {fontSize}px</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.fontBtn}
                    onPress={() => setFontSize((f) => Math.max(10, f - 2))}
                  >
                    <Text style={styles.fontBtnText}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.fontBtn}
                    onPress={() => setFontSize((f) => Math.min(100, f + 2))}
                  >
                    <Text style={styles.fontBtnText}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Fixed layer settings */}
            {activeLayer !== 'name' && !isCustomActive(activeLayer) && currentLayer && (
              <LayerEditor
                layerKey={activeLayer as LayerKey}
                meta={LAYER_META.find((l) => l.key === (activeLayer as LayerKey))!}
                layer={currentLayer}
                dateFormat={design.date?.format ?? DEFAULT_CERT_DESIGN.date.format}
                onUpdate={(patch) => updateLayer(activeLayer as LayerKey, patch)}
                onDateFormatChange={updateDateFormat}
              />
            )}

            {/* Custom layer settings */}
            {isCustomActive(activeLayer) && activeCustomLayer && (
              <CustomLayerEditor
                layer={activeCustomLayer}
                onUpdate={(patch) => updateCustomLayer(activeCustomLayer.id, patch)}
                onDelete={() => deleteCustomLayer(activeCustomLayer.id)}
              />
            )}

            {/* Font Family */}
            <View
              style={[
                styles.controlGroup,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Type size={18} color="#3B82F6" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Font ทั้งใบ</Text>
              </View>
              <View style={styles.fontFamilyRow}>
                {CERT_FONT_OPTIONS.map((opt) => {
                  const active = design.fontFamily === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.fontFamilyBtn,
                        { borderColor: active ? '#3B82F6' : theme.border, backgroundColor: active ? '#EFF6FF' : theme.background },
                      ]}
                      onPress={() =>
                        setDesign((d) =>
                          Object.assign({}, d || DEFAULT_CERT_DESIGN, {
                            fontFamily: opt.id as CertFontFamily,
                          }),
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.fontFamilySample,
                          getFontFamilyStyle(opt.id as CertFontFamily),
                          { color: active ? '#3B82F6' : theme.text },
                        ]}
                      >
                        Aa
                      </Text>
                      <Text
                        style={[
                          styles.fontFamilyLabel,
                          { color: active ? '#3B82F6' : theme.mutedForeground },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.reUploadBtn} onPress={pickImage}>
              <Text style={styles.reUploadText}>เปลี่ยนรูปพื้นหลัง</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PickerCoverThumb({
  coverUrl,
  title,
  theme,
}: {
  coverUrl?: string | null;
  title: string;
  theme: any;
}) {
  const [uri, setUri] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coverUrl?.trim()) {
        setUri(null);
        return;
      }
      try {
        const u = await getReadableStorageUrl(STORAGE_BUCKET_CERTIFICATES, coverUrl);
        if (!cancelled) setUri(u);
      } catch {
        if (!cancelled) setUri(coverUrl.trim());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  if (!coverUrl?.trim()) {
    return (
      <View style={[styles.pickerCardCoverFallback, { backgroundColor: '#3B82F6' }]}>
        <Text style={styles.pickerCardCoverFallbackText}>{title?.[0] || '?'}</Text>
      </View>
    );
  }
  if (uri === undefined) {
    return (
      <View style={[styles.pickerCardCover, { backgroundColor: theme.secondary }]}>
        <ActivityIndicator size="small" color={theme.mutedForeground} />
      </View>
    );
  }
  if (uri == null || uri === '') {
    return (
      <View style={[styles.pickerCardCoverFallback, { backgroundColor: '#3B82F6' }]}>
        <Text style={styles.pickerCardCoverFallbackText}>{title?.[0] || '?'}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />;
}

function EventPicker({
  events,
  rawEvents,
  isLoading,
  search,
  setSearch,
  onPick,
  onBack,
  onRefresh,
  theme,
}: {
  events: Event[];
  rawEvents: Event[];
  isLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onPick: (e: Event) => void;
  onBack: () => void;
  onRefresh: () => void;
  theme: any;
}) {
  const summary = useMemo(() => {
    const total = rawEvents.length;
    const configured = rawEvents.filter((e) => !!e.cert_template_url).length;
    return { total, configured, pending: total - configured };
  }, [rawEvents]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
      >
        <BackButton style={styles.backBtn} onPress={onBack} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>เลือกค่าย</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={onRefresh}>
          <RefreshCw size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 20, gap: 14 }}>
        <View>
          <Text style={[styles.pickerHeading, { color: theme.text }]}>
            ตั้งค่าเกียรติบัตรของค่ายไหน?
          </Text>
          <Text style={[styles.pickerSub, { color: theme.mutedForeground }]}>
            แต่ละค่ายตั้งค่าออกแบบแยกกันได้ — เลือกค่ายเพื่อเริ่ม
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.summaryValue, { color: theme.text }]}>{summary.total}</Text>
            <Text style={[styles.summaryLabel, { color: theme.mutedForeground }]}>ค่ายทั้งหมด</Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>{summary.configured}</Text>
            <Text style={[styles.summaryLabel, { color: theme.mutedForeground }]}>ตั้งค่าแล้ว</Text>
          </View>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>{summary.pending}</Text>
            <Text style={[styles.summaryLabel, { color: theme.mutedForeground }]}>ยังไม่ตั้ง</Text>
          </View>
        </View>

        <View
          style={[
            styles.searchWrap,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Search size={18} color={theme.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ค้นหาชื่อค่ายหรือสถานที่"
            placeholderTextColor={theme.mutedForeground}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={theme.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading && rawEvents.length === 0 ? (
        <View style={styles.pickerCenter}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.pickerEmpty}>
          <View
            style={[
              styles.pickerEmptyIcon,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Sparkles size={28} color={theme.mutedForeground} />
          </View>
          <Text style={[styles.pickerEmptyTitle, { color: theme.text }]}>
            {search ? 'ไม่พบค่ายที่ค้นหา' : 'ยังไม่มีค่าย'}
          </Text>
          <Text style={[styles.pickerEmptySub, { color: theme.mutedForeground }]}>
            {search ? 'ลองเปลี่ยนคำค้นหาดู' : 'สร้างค่ายในเมนู "จัดการอีเวนต์" ก่อน'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.pickerList}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <EventPickerCard event={item} onPress={() => onPick(item)} theme={theme} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

function EventPickerCard({
  event,
  onPress,
  theme,
}: {
  event: Event;
  onPress: () => void;
  theme: any;
}) {
  const configured = !!event.cert_template_url;
  const releaseDate = event.cert_release_date ? new Date(event.cert_release_date) : null;
  const released = releaseDate ? new Date() >= releaseDate : false;

  return (
    <TouchableOpacity
      style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.pickerCardCover}>
        <PickerCoverThumb coverUrl={event.cover_url} title={event.title} theme={theme} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.pickerCardTitle, { color: theme.text }]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text
          style={[styles.pickerCardSub, { color: theme.mutedForeground }]}
          numberOfLines={1}
        >
          {event.location || 'ไม่ระบุสถานที่'}
        </Text>
        <View style={styles.pickerCardBadges}>
          {configured ? (
            <View style={[styles.pickerBadge, { backgroundColor: '#ECFDF5' }]}>
              <CheckCircle2 size={11} color="#10B981" />
              <Text style={[styles.pickerBadgeText, { color: '#10B981' }]}>ตั้งค่าแล้ว</Text>
            </View>
          ) : (
            <View style={[styles.pickerBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.pickerBadgeText, { color: '#92400E' }]}>ยังไม่ตั้ง</Text>
            </View>
          )}
          {releaseDate && (
            <View
              style={[
                styles.pickerBadge,
                { backgroundColor: released ? '#DBEAFE' : '#F1F5F9' },
              ]}
            >
              <Clock size={10} color={released ? '#1D4ED8' : '#64748B'} />
              <Text
                style={[
                  styles.pickerBadgeText,
                  { color: released ? '#1D4ED8' : '#64748B' },
                ]}
              >
                {released ? 'ปล่อยแล้ว' : 'รอปล่อย'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <ChevronRight size={20} color={theme.mutedForeground} />
    </TouchableOpacity>
  );
}

function CertOverlay({
  layer,
  fontStyle,
  children,
}: {
  layer: CertTextLayer;
  fontStyle: { fontFamily?: string };
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.overlay, { left: `${layer.x}%`, top: `${layer.y}%` }]} pointerEvents="none">
      <Text
        style={[
          styles.overlayText,
          fontStyle,
          {
            fontSize: layer.size,
            color: layer.color,
            fontWeight: layer.bold ? 'bold' : 'normal',
            fontStyle: layer.italic ? 'italic' : 'normal',
          },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

function LayerTab({
  active,
  label,
  onPress,
  onDelete,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <View
      style={[
        styles.layerTab,
        active && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
      ]}
    >
      <TouchableOpacity onPress={onPress} style={{ flexShrink: 1 }}>
        <Text
          style={[styles.layerTabText, active && { color: '#FFF' }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.layerTabClose}>
          <X size={12} color={active ? '#FFF' : '#94A3B8'} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function XYNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value)));

  useEffect(() => {
    setText(String(Math.round(value)));
  }, [value]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setText(String(Math.round(value)));
      return;
    }
    const clamped = Math.max(0, Math.min(100, n));
    setText(String(clamped));
    onChange(clamped);
  };

  return (
    <View style={styles.xyBox}>
      <Text style={styles.xyLabel}>{label}</Text>
      <View style={styles.xyInputWrap}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={() => commit(text)}
          onSubmitEditing={() => commit(text)}
          keyboardType="number-pad"
          maxLength={3}
          style={styles.xyInput}
        />
        <Text style={styles.xyPercent}>%</Text>
      </View>
    </View>
  );
}

function SettingRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sub ? <Text style={styles.settingSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#3B82F6' } as any} />
    </View>
  );
}

function CustomLayerEditor({
  layer,
  onUpdate,
  onDelete,
}: {
  layer: CertCustomLayer;
  onUpdate: (patch: Partial<CertCustomLayer>) => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.controlGroup, { backgroundColor: '#FFF', borderColor: '#E2E8F0' }]}>
      <View style={styles.sectionHeader}>
        <TextCursorInput size={18} color="#3B82F6" />
        <Text style={[styles.sectionTitle, { flex: 1 }]}>เลเยอร์ข้อความเอง</Text>
        <TouchableOpacity onPress={onDelete} style={styles.deleteLayerBtn} hitSlop={8}>
          <Trash2 size={14} color="#EF4444" />
          <Text style={styles.deleteLayerText}>ลบ</Text>
        </TouchableOpacity>
      </View>

      <SettingRow
        label="แสดงเลเยอร์นี้"
        value={layer.show}
        onChange={(v) => onUpdate({ show: v })}
      />

      <Text style={[styles.label, { marginTop: 12 }]}>ชื่อเลเยอร์ (ไว้แยกแยะ)</Text>
      <TextInput
        style={styles.input}
        value={layer.label || ''}
        onChangeText={(t) => onUpdate({ label: t })}
        placeholder="เช่น ชื่อโรงเรียน, เลขที่"
      />

      <Text style={[styles.label, { marginTop: 12 }]}>ข้อความที่แสดง</Text>
      <TextInput
        style={[styles.input, { minHeight: 60 }]}
        value={layer.text || ''}
        onChangeText={(t) => onUpdate({ text: t })}
        placeholder="พิมพ์ข้อความ..."
        multiline
      />

      <Text style={[styles.label, { marginTop: 16 }]}>สีตัวอักษร</Text>
      <View style={styles.colorRow}>
        {CERT_COLOR_PALETTE.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorCircle,
              { backgroundColor: c },
              layer.color === c && styles.colorCircleActive,
            ]}
            onPress={() => onUpdate({ color: c })}
          />
        ))}
      </View>

      <View style={styles.fontControls}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>ขนาด: {layer.size}px</Text>
        </View>
        <TouchableOpacity
          style={styles.fontBtn}
          onPress={() => onUpdate({ size: Math.max(8, layer.size - 1) })}
        >
          <Text style={styles.fontBtnText}>A-</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fontBtn}
          onPress={() => onUpdate({ size: Math.min(80, layer.size + 1) })}
        >
          <Text style={styles.fontBtnText}>A+</Text>
        </TouchableOpacity>
      </View>

      <SettingRow label="ตัวหนา" value={!!layer.bold} onChange={(v) => onUpdate({ bold: v })} />
      <SettingRow
        label="ตัวเอียง"
        value={!!layer.italic}
        onChange={(v) => onUpdate({ italic: v })}
      />
    </View>
  );
}

function LayerEditor({
  layerKey,
  meta,
  layer,
  dateFormat,
  onUpdate,
  onDateFormatChange,
}: {
  layerKey: LayerKey;
  meta: { key: LayerKey; label: string; icon: any; placeholder?: string };
  layer: CertTextLayer;
  dateFormat: CertDateFormat;
  onUpdate: (patch: Partial<CertTextLayer>) => void;
  onDateFormatChange: (f: CertDateFormat) => void;
}) {
  const Icon = meta.icon;
  const isDate = layerKey === 'date';
  return (
    <View style={[styles.controlGroup, { backgroundColor: '#FFF', borderColor: '#E2E8F0' }]}>
      <View style={styles.sectionHeader}>
        <Icon size={18} color="#3B82F6" />
        <Text style={styles.sectionTitle}>สไตล์ {meta.label}</Text>
      </View>

      <SettingRow
        label="แสดงเลเยอร์นี้"
        value={layer.show}
        onChange={(v) => onUpdate({ show: v })}
      />

      {!isDate && (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>ข้อความ</Text>
          <TextInput
            style={styles.input}
            value={layer.text || ''}
            onChangeText={(t) => onUpdate({ text: t })}
            placeholder={meta.placeholder || 'พิมพ์ข้อความ...'}
            multiline={layerKey === 'subtitle'}
          />
        </>
      )}

      {isDate && (
        <>
          <Text style={[styles.label, { marginTop: 12 }]}>รูปแบบวันที่</Text>
          <View style={styles.dateFormatRow}>
            {CERT_DATE_FORMAT_OPTIONS.map((opt) => {
              const active = dateFormat === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.dateFormatBtn,
                    active && { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
                  ]}
                  onPress={() => onDateFormatChange(opt.id)}
                >
                  <Text style={[styles.dateFormatLabel, active && { color: '#3B82F6' }]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.dateFormatSample}>{opt.sample}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={[styles.label, { marginTop: 16 }]}>สีตัวอักษร</Text>
      <View style={styles.colorRow}>
        {CERT_COLOR_PALETTE.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorCircle,
              { backgroundColor: c },
              layer.color === c && styles.colorCircleActive,
            ]}
            onPress={() => onUpdate({ color: c })}
          />
        ))}
      </View>

      <View style={styles.fontControls}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>ขนาด: {layer.size}px</Text>
        </View>
        <TouchableOpacity
          style={styles.fontBtn}
          onPress={() => onUpdate({ size: Math.max(8, layer.size - 1) })}
        >
          <Text style={styles.fontBtnText}>A-</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fontBtn}
          onPress={() => onUpdate({ size: Math.min(80, layer.size + 1) })}
        >
          <Text style={styles.fontBtnText}>A+</Text>
        </TouchableOpacity>
      </View>

      <SettingRow label="ตัวหนา" value={!!layer.bold} onChange={(v) => onUpdate({ bold: v })} />
      <SettingRow
        label="ตัวเอียง"
        value={!!layer.italic}
        onChange={(v) => onUpdate({ italic: v })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  saveBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  eventTitleLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  eventTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  changeEventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  changeEventText: { fontSize: 12, fontWeight: '700' },

  pickerHeading: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  pickerSub: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  pickerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerEmpty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 8 },
  pickerEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  pickerEmptyTitle: { fontSize: 16, fontWeight: '900' },
  pickerEmptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  pickerList: { paddingHorizontal: 20, paddingBottom: 80 },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  pickerCardCover: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  pickerCardCoverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pickerCardCoverFallbackText: { color: 'rgba(255,255,255,0.4)', fontSize: 28, fontWeight: '900' },
  pickerCardTitle: { fontSize: 15, fontWeight: '800' },
  pickerCardSub: { fontSize: 12, fontWeight: '600' },
  pickerCardBadges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  pickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pickerBadgeText: { fontSize: 10, fontWeight: '800' },

  uploadBox: {
    width: '100%',
    height: 300,
    backgroundColor: '#FFF',
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: { color: '#94A3B8', fontWeight: '500' },
  editorContainer: { gap: 16 },
  canvasContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    elevation: 4,
  },
  canvas: { width: '100%', aspectRatio: 1.414, justifyContent: 'center' },
  certImage: { width: '100%', height: '100%' },
  canvasBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  canvasBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  overlay: {
    position: 'absolute',
    transform: [{ translateX: -120 }, { translateY: -15 }],
    width: 240,
    alignItems: 'center',
  },
  overlayText: { textAlign: 'center' },
  controlGroup: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },
  helperText: { fontSize: 12, color: '#94A3B8' },
  label: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  dateInputRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  nowBtn: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  nowBtnText: { color: '#10B981', fontWeight: 'bold', fontSize: 13 },
  infoSmall: { fontSize: 11, color: '#94A3B8', marginTop: 8, fontStyle: 'italic' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepControls: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    width: 36,
    height: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnActive: { backgroundColor: '#3B82F6' },
  stepBtnText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
  stepBtnTextActive: { color: '#FFF' },
  moveGrid: {
    alignSelf: 'center',
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 160,
    marginBottom: 6,
  },
  moveBtn: {
    width: 48,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 12 },
  colorCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  colorCircleActive: { borderColor: '#3B82F6' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  settingLabel: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  settingSub: { fontSize: 11, color: '#94A3B8' },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fontBtn: {
    width: 50,
    height: 40,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  fontBtnText: { color: '#3B82F6', fontWeight: 'bold' },
  reUploadBtn: { marginTop: 8, alignItems: 'center', padding: 16 },
  reUploadText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  presetCard: {
    width: 180,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 4,
  },
  presetTitle: { fontSize: 14, fontWeight: '900' },
  presetDesc: { fontSize: 11, fontWeight: '500' },
  layerTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  layerTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
  },
  layerTabText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  layerTabClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  addLayerText: { fontSize: 12, fontWeight: '800', color: '#3B82F6' },
  deleteLayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  deleteLayerText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  xyRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  xyBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  xyLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#3B82F6',
    width: 16,
  },
  xyInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  xyInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },
  xyPercent: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    marginTop: 8,
  },
  dateFormatRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  dateFormatBtn: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  dateFormatLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  dateFormatSample: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  fontFamilyRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  fontFamilyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  fontFamilySample: { fontSize: 22, fontWeight: '900' },
  fontFamilyLabel: { fontSize: 11, fontWeight: '700' },
});
