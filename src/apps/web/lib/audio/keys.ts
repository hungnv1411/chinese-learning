import type { Voice } from './audio-url';

/**
 * Khóa file audio từ trên R2 và trong `audio_asset.key`, giống `clp/audio/keys.py`:
 * `word/{voice}/{simplified}_{pinyin_numbered bỏ khoảng trắng}.mp3`.
 */
export function wordAudioKey(simplified: string, pinyinNumbered: string, voice: Voice): string {
  return `word/${voice}/${simplified}_${pinyinNumbered.replace(/\s+/g, '')}.mp3`;
}

/** Phần `key` của `audioUrl('word', key, voice)` (không có thư mục loại, giọng và đuôi .mp3). */
export function wordAudioName(simplified: string, pinyinNumbered: string): string {
  return `${simplified}_${pinyinNumbered.replace(/\s+/g, '')}`;
}
