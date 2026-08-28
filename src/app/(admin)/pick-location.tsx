import { BackButton } from '@/components/ui/back-button';
import { AppStatusBar } from '@/components/ui/app-status-bar';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MapPin, Search } from 'lucide-react-native';

// IMPORTANT: `react-native-maps` cannot be imported on web (it uses native codegen).
// Use a runtime require on native only to prevent Expo Router from crashing while building web routes.
type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapPressEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };

type NativeMaps = {
  MapView: React.ComponentType<{
    style?: any;
    provider?: any;
    region?: Region;
    onRegionChangeComplete?: (r: Region) => void;
    onPress?: (e: MapPressEvent) => void;
    children?: React.ReactNode;
  }>;
  Marker: React.ComponentType<{ coordinate: { latitude: number; longitude: number } }>;
  PROVIDER_GOOGLE?: any;
};

const NativeMaps: NativeMaps | null = Platform.OS === 'web' ? null : (require('react-native-maps') as any);
const MapView = NativeMaps?.MapView;
const Marker = NativeMaps?.Marker;
const PROVIDER_GOOGLE = NativeMaps?.PROVIDER_GOOGLE;

type Prediction = {
  description: string;
  place_id: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

type PlaceDetails = {
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  url?: string;
};

function getGoogleKey(): string | null {
  const k = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

async function googlePlacesAutocomplete(query: string, signal?: AbortSignal): Promise<Prediction[]> {
  // Prefer server-side proxy (keeps Google key out of client).
  console.time('⏱️ googlePlacesAutocomplete');
  try {
    const { data, error } = await supabase.functions.invoke('google-places', {
      body: { action: 'autocomplete', query },
    });
    if (error) throw error;
    return ((data as any)?.predictions || []) as Prediction[];
  } catch {
    // Fallback to direct Google call if key is present (dev only).
    const key = getGoogleKey();
    if (!key) throw new Error('missing_google_key');
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
      new URLSearchParams({
        key,
        input: query,
        language: 'th',
        components: 'country:th',
      }).toString();

    const res = await fetch(url, { signal });
    const json = await res.json();
    if (json?.status !== 'OK' && json?.status !== 'ZERO_RESULTS') {
      throw new Error(json?.error_message || json?.status || 'places_autocomplete_failed');
    }
    return (json?.predictions || []) as Prediction[];
  } finally {
    console.timeEnd('⏱️ googlePlacesAutocomplete');
  }
}

async function googlePlaceDetails(placeId: string, signal?: AbortSignal): Promise<PlaceDetails> {
  console.time('⏱️ googlePlaceDetails');
  try {
    const { data, error } = await supabase.functions.invoke('google-places', {
      body: { action: 'details', place_id: placeId },
    });
    if (error) throw error;
    return ((data as any)?.result || {}) as PlaceDetails;
  } catch {
    const key = getGoogleKey();
    if (!key) throw new Error('missing_google_key');
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json?` +
      new URLSearchParams({
        key,
        place_id: placeId,
        language: 'th',
        fields: 'name,formatted_address,geometry,url',
      }).toString();

    const res = await fetch(url, { signal });
    const json = await res.json();
    if (json?.status !== 'OK') {
      throw new Error(json?.error_message || json?.status || 'places_details_failed');
    }
    return (json?.result || {}) as PlaceDetails;
  } finally {
    console.timeEnd('⏱️ googlePlaceDetails');
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  console.time('⏱️ reverseGeocode');
  try {
    const { data, error } = await supabase.functions.invoke('google-places', {
      body: { action: 'reverse_geocode', lat, lng },
    });
    if (error) throw error;
    const formatted = (data as any)?.result?.formatted_address as string | undefined;
    return formatted?.trim() ? formatted.trim() : null;
  } catch {
    return null;
  } finally {
    console.timeEnd('⏱️ reverseGeocode');
  }
}

export default function PickLocationScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ initial?: string; returnTo?: string }>();

  const [q, setQ] = useState(params.initial || '');
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    location: string;
    lat: number;
    lng: number;
    placeId?: string;
  } | null>(null);

  const [region, setRegion] = useState<Region>({
    latitude: 13.7563,
    longitude: 100.5018,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const abortRef = useRef<AbortController | null>(null);

  const keyMissing = useMemo(() => !getGoogleKey(), []);

  useEffect(() => {
    if (keyMissing) return;
    const query = q.trim();
    if (query.length < 2) {
      setPredictions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const t = setTimeout(() => {
      googlePlacesAutocomplete(query, ac.signal)
        .then((p) => setPredictions(p))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q, keyMissing]);

  const selectPlace = async (p: Prediction) => {
    try {
      setLoading(true);
      setError(null);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const details = await googlePlaceDetails(p.place_id, ac.signal);
      const locationName = details.name || p.structured_formatting?.main_text || p.description;
      const lat = details.geometry?.location?.lat;
      const lng = details.geometry?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new Error('missing_geometry');
      }

      setSelected({ location: locationName, lat, lng, placeId: p.place_id });
      setRegion((r) => ({
        ...r,
        latitude: lat,
        longitude: lng,
      }));
      setPredictions([]);
      setQ(locationName);
      return;

    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const confirm = () => {
    if (!selected) return;
    const returnTo = params.returnTo;
    if (returnTo) {
      router.replace({
        pathname: returnTo as any,
        params: {
          location: selected.location,
          locationLat: String(selected.lat),
          locationLng: String(selected.lng),
          placeId: selected.placeId || '',
        },
      });
      return;
    }
    router.back();
  };

  const onMapPress = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      const label = addr || 'ตำแหน่งที่เลือก';
      setSelected({ location: label, lat, lng });
      setQ(label);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppStatusBar />

      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <BackButton />
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          เลือกสถานที่
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {keyMissing ? (
        <View style={styles.center}>
          <Text style={[styles.warnTitle, { color: theme.text }]}>ยังไม่ได้ตั้งค่า Google Maps API key</Text>
          <Text style={[styles.warnBody, { color: theme.mutedForeground }]}>
            ใส่ค่าใน `.env` ที่ `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` แล้วรีสตาร์ท `expo start`
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Search size={18} color={theme.mutedForeground} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="ค้นหาสถานที่..."
              placeholderTextColor={theme.mutedForeground}
              style={[styles.searchInput, { color: theme.text }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {loading ? <ActivityIndicator size="small" color={theme.text} /> : null}
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: '#EF4444' }]}>
              {error}
            </Text>
          ) : null}

          <View style={[styles.mapWrap, { borderColor: theme.border }]}>
            {Platform.OS === 'web' || !MapView ? (
              <View style={styles.mapFallbackCenter}>
                <Text style={[styles.mapFallbackTitle, { color: theme.text }]}>แผนที่ยังไม่รองรับบนเว็บ</Text>
                <Text style={[styles.mapFallbackBody, { color: theme.mutedForeground }]}>
                  กรุณาใช้ iOS/Android (development build) เพื่อเลือกตำแหน่งบนแผนที่จริง
                </Text>
              </View>
            ) : (
              <MapView
                style={StyleSheet.absoluteFill}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  onMapPress(latitude, longitude);
                }}
              >
                {selected && Marker ? (
                  <Marker coordinate={{ latitude: selected.lat, longitude: selected.lng }} />
                ) : null}
              </MapView>
            )}
          </View>

          <TouchableOpacity
            disabled={!selected}
            onPress={confirm}
            activeOpacity={0.85}
            style={[
              styles.confirmBtn,
              { backgroundColor: selected ? theme.text : theme.secondary, borderColor: theme.border },
            ]}
          >
            <Text style={{ color: selected ? theme.background : theme.mutedForeground, fontWeight: '900' }}>
              ยืนยันตำแหน่ง
            </Text>
          </TouchableOpacity>

          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: theme.border }]}
                activeOpacity={0.75}
                onPress={() => selectPlace(item)}
              >
                <MapPin size={18} color={theme.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowMain, { color: theme.text }]} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  <Text style={[styles.rowSub, { color: theme.mutedForeground }]} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              q.trim().length >= 2 && !loading ? (
                <View style={styles.center}>
                  <Text style={[styles.empty, { color: theme.mutedForeground }]}>ไม่พบผลลัพธ์</Text>
                </View>
              ) : (
                <View style={styles.center}>
                  <Text style={[styles.empty, { color: theme.mutedForeground }]}>
                    พิมพ์อย่างน้อย 2 ตัวอักษร
                  </Text>
                </View>
              )
            }
          />

          {Platform.OS === 'web' ? (
            <Text style={[styles.note, { color: theme.mutedForeground }]}>
              หมายเหตุ: Google Places API ต้องเปิด billing ในโปรเจกต์ Google Cloud
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '900' },
  body: { flex: 1, padding: 16 },
  searchWrap: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { fontSize: 14, fontWeight: '800' },
  rowSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  mapWrap: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  mapFallbackCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  mapFallbackTitle: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  mapFallbackBody: { marginTop: 6, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  confirmBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  errorText: { marginTop: 10, fontWeight: '700' },
  center: { paddingVertical: 28, alignItems: 'center' },
  empty: { fontWeight: '700' },
  warnTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center' },
  warnBody: { marginTop: 8, fontSize: 13, fontWeight: '600', textAlign: 'center', maxWidth: 320 },
  note: { marginTop: 8, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

