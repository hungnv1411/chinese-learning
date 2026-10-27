'use client';

import type { Tone } from '@clp/core';
import { useDisplaySettings } from './settings';

const SIZE = { sm: 'hz-sm', md: 'hz-md', lg: 'hz-lg', xl: 'hz-xl' } as const;
const isHan = (ch: string) => /\p{Script=Han}/u.test(ch);

/**
 * Chữ Hán, tô màu từng chữ theo thanh (`tones[i]` ứng với chữ Hán thứ i). Dùng phông hệ thống.
 * Khi người dùng bật phồn thể và có `traditional` thì hiện bản phồn thể.
 */
export function Hanzi({
  text,
  traditional,
  tones,
  size = 'md',
}: {
  text: string;
  traditional?: string;
  tones?: Tone[];
  size?: keyof typeof SIZE;
}) {
  const { traditional: useTrad } = useDisplaySettings();
  const shown = useTrad && traditional ? traditional : text;
  let i = 0;
  return (
    <span className={`hz ${SIZE[size]}`} lang="zh">
      {[...shown].map((ch, k) => {
        const tone = isHan(ch) ? tones?.[i++] : undefined;
        return (
          <span key={k} className={tone ? `t${tone}` : undefined}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
