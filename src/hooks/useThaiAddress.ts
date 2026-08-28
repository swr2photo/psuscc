import { useMemo, useCallback } from 'react';
import raw from '@/assets/addresses/thai-address-data.json';

interface CompactProvince {
  id: number;
  n: string;
}

interface CompactDistrict {
  id: number;
  n: string;
  p: number;
}

interface CompactSubDistrict {
  id: number;
  n: string;
  z: number;
  d: number;
}

interface ThaiAddressData {
  provinces: CompactProvince[];
  districts: CompactDistrict[];
  subDistricts: CompactSubDistrict[];
}

const data = raw as unknown as ThaiAddressData;

export interface ProvinceOpt {
  id: number;
  name: string;
}

export interface DistrictOpt {
  id: number;
  name: string;
  provinceId: number;
}

export interface SubDistrictOpt {
  id: number;
  name: string;
  zipCode: number;
  districtId: number;
}

export interface AddressSelection {
  province: string;
  district: string;
  subDistrict: string;
  zipCode: string;
  detail: string;
}

export function useThaiAddress() {
  const maps = useMemo(() => {
    const provinceMap = new Map<number, string>();
    const districtMap = new Map<number, CompactDistrict>();
    const districtsByProvince = new Map<number, CompactDistrict[]>();
    const subDistrictsByDistrict = new Map<number, CompactSubDistrict[]>();

    data.provinces.forEach((p) => provinceMap.set(p.id, p.n));

    data.districts.forEach((d) => {
      districtMap.set(d.id, d);
      const list = districtsByProvince.get(d.p) || [];
      list.push(d);
      districtsByProvince.set(d.p, list);
    });

    data.subDistricts.forEach((s) => {
      const distList = subDistrictsByDistrict.get(s.d) || [];
      distList.push(s);
      subDistrictsByDistrict.set(s.d, distList);
    });

    return { provinceMap, districtMap, districtsByProvince, subDistrictsByDistrict };
  }, []);

  const provinces = useMemo((): ProvinceOpt[] => {
    return data.provinces
      .map((p) => ({ id: p.id, name: p.n }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, []);

  const getDistricts = useCallback(
    (provinceId: number): DistrictOpt[] => {
      const list = maps.districtsByProvince.get(provinceId) || [];
      return list
        .map((d) => ({ id: d.id, name: d.n, provinceId: d.p }))
        .sort((a, b) => a.name.localeCompare(b.name, 'th'));
    },
    [maps.districtsByProvince],
  );

  const getSubDistricts = useCallback(
    (districtId: number): SubDistrictOpt[] => {
      const list = maps.subDistrictsByDistrict.get(districtId) || [];
      return list
        .map((s) => ({
          id: s.id,
          name: s.n,
          zipCode: s.z,
          districtId: s.d,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'th'));
    },
    [maps.subDistrictsByDistrict],
  );

  const composeAddress = useCallback((selection: AddressSelection): string => {
    const parts: string[] = [];
    if (selection.detail) parts.push(selection.detail.trim());
    if (selection.subDistrict) parts.push(`ต.${selection.subDistrict}`);
    if (selection.district) parts.push(`อ.${selection.district}`);
    if (selection.province) parts.push(`จ.${selection.province}`);
    if (selection.zipCode) parts.push(selection.zipCode);
    return parts.join(' ');
  }, []);

  return {
    provinces,
    getDistricts,
    getSubDistricts,
    composeAddress,
  };
}
