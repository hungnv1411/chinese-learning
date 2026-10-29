'use client';

import { useAudio } from '@/lib/audio/use-audio';
import { Icon } from './Icon';

/** Phát file MP3 TTS (không dùng Web Speech API). `slow` dùng nhãn “Chậm” của design. */
export function AudioButton({
  src,
  rate = 1,
  slow,
  large,
  label,
  slowLabel = 'Chậm',
}: {
  src: string;
  /** Tốc độ phát (xem audioUrl khi ở chế độ `rate`). */
  rate?: number;
  slow?: boolean;
  large?: boolean;
  /** aria-label, bắt buộc vì nút chỉ có biểu tượng. */
  label: string;
  slowLabel?: string;
}) {
  const audio = useAudio();
  return (
    <button
      type="button"
      className={['audio', large && 'lg', slow && 'slow'].filter(Boolean).join(' ')}
      aria-label={label}
      onClick={() => void audio.play(src, rate)}
    >
      {slow ? <span>{slowLabel}</span> : <Icon name="volume" />}
    </button>
  );
}
