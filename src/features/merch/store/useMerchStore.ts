import { create } from 'zustand';

interface MerchState {
  selectedSize: string | null;
  setSize: (size: string) => void;
  reset: () => void;
}

export const useMerchStore = create<MerchState>((set) => ({
  selectedSize: null,
  setSize: (size) => set({ selectedSize: size }),
  reset: () => set({ selectedSize: null }),
}));
