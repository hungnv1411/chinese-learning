export type AudioKind = 'syl' | 'word' | 'sent';
export type Voice = 'xiaoxiao' | 'yunxi';
export type SlowMode = 'file' | 'rate';

/** Tốc độ phát khi đọc chậm ở chế độ `rate`. */
export const SLOW_RATE = 0.7;

/** Giọng theo cài đặt: nữ → xiaoxiao, nam → yunxi. */
export const voiceOf = (setting: 'female' | 'male'): Voice => (setting === 'male' ? 'yunxi' : 'xiaoxiao');

/**
 * Đường dẫn file MP3 TTS trên R2: `${base}/${kind}/${voice}/${key}.mp3`.
 * Đọc chậm: `AUDIO_SLOW_MODE = 'file'` dùng `${key}.slow.mp3`, `'rate'` dùng cùng file với `rate` thấp.
 * Không dùng Web Speech API.
 */
export function audioUrl(
  base: string,
  kind: AudioKind,
  key: string,
  voice: Voice,
  opts: { slow?: boolean; slowMode?: SlowMode } = {},
): { src: string; rate: number } {
  const root = base.replace(/\/+$/, '');
  const slow = opts.slow === true;
  const file = slow && opts.slowMode === 'file' ? `${key}.slow` : key;
  return {
    src: `${root}/${kind}/${voice}/${encodeURIComponent(file).replace(/%2F/g, '/')}.mp3`,
    rate: slow && opts.slowMode !== 'file' ? SLOW_RATE : 1,
  };
}
