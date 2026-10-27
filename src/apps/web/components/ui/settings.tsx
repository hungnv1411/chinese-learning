'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type DisplaySettings = {
  /** 'always' | 'new' | 'never' (data-model; design gọi `never` là `hide`). */
  showPinyin: 'always' | 'new' | 'never';
  showHanViet: boolean;
  toneColors: boolean;
  traditional: boolean;
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showPinyin: 'always',
  showHanViet: true,
  toneColors: true,
  traditional: false,
};

const Ctx = createContext<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

export function useDisplaySettings(): DisplaySettings {
  return useContext(Ctx);
}

/** Áp cài đặt hiển thị lên <body> bằng class `no-hv`, `no-tone`, `no-py` (giống applyPrefs của design). */
export function SettingsProvider({
  value,
  children,
}: {
  value: DisplaySettings;
  children: ReactNode;
}) {
  useEffect(() => {
    const b = document.body;
    b.classList.toggle('no-hv', !value.showHanViet);
    b.classList.toggle('no-tone', !value.toneColors);
    b.classList.toggle('no-py', value.showPinyin === 'never');
  }, [value]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
