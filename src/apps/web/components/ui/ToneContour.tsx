import type { Tone } from '@clp/core';

/** Đường thanh chuẩn trong viewBox 60×40 (CONTOUR của design/app.js). */
export const CONTOUR: Record<Tone, string> = {
  1: 'M6 10H54',
  2: 'M6 32 54 8',
  3: 'M6 14Q22 42 54 8',
  4: 'M6 6 54 34',
  5: 'M24 22h12',
};

const TONE_COLOR: Record<Tone, string> = {
  1: 'var(--tone-1)',
  2: 'var(--tone-2)',
  3: 'var(--tone-3)',
  4: 'var(--tone-4)',
  5: 'var(--meta)',
};

/** `userContour`: độ cao tương đối 0..1 (1 = cao nhất) lấy đều theo thời gian, vẽ nét đứt. */
export function ToneContour({
  tone,
  userContour,
  label,
}: {
  tone: Tone;
  userContour?: number[];
  label: string;
}) {
  const user =
    userContour && userContour.length > 1
      ? userContour
          .map((v, i) => {
            const x = 6 + (48 * i) / (userContour.length - 1);
            const y = 36 - Math.max(0, Math.min(1, v)) * 30;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(' ')
      : null;
  return (
    <svg className="contour" viewBox="0 0 60 40" role="img" aria-label={label}>
      <path d={CONTOUR[tone]} stroke={TONE_COLOR[tone]} />
      {user && <path d={user} stroke="var(--blue-deep)" strokeDasharray="3 5" />}
    </svg>
  );
}
