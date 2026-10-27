import { describe, expect, test } from 'vitest';
import { ConfigError, parseConfig } from './config';

const base = {
  SITE_NAME: 'Test Site',
  SITE_URL: 'https://example.test',
  DATABASE_URL: 'postgres://u:p@db:5432/x',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};

describe('parseConfig', () => {
  test('đủ biến bắt buộc thì parse được và có giá trị mặc định', () => {
    const c = parseConfig(base);
    expect(c.SITE_NAME).toBe('Test Site');
    expect(c.SPEECH_URL).toBe('http://speech:8000');
    expect(c.TTS_DAILY_LIMIT).toBe(500);
    expect(c.AUDIO_SLOW_MODE).toBe('rate');
    expect(c.ADMIN_EMAILS).toEqual([]);
  });

  test('thiếu SITE_NAME thì báo lỗi rõ tên biến', () => {
    const { SITE_NAME: _omit, ...env } = base;
    void _omit;
    expect(() => parseConfig(env)).toThrow(ConfigError);
    expect(() => parseConfig(env)).toThrow(/SITE_NAME/);
  });

  test('SITE_URL không phải URL thì lỗi', () => {
    expect(() => parseConfig({ ...base, SITE_URL: 'khong-phai-url' })).toThrow(/SITE_URL/);
  });

  test('ADMIN_EMAILS tách theo dấu phẩy, chuẩn hóa chữ thường', () => {
    const c = parseConfig({ ...base, ADMIN_EMAILS: 'A@x.com, b@y.com ,' });
    expect(c.ADMIN_EMAILS).toEqual(['a@x.com', 'b@y.com']);
  });

  test('TTS_DAILY_LIMIT đọc từ chuỗi, AUDIO_SLOW_MODE chỉ nhận file|rate', () => {
    expect(parseConfig({ ...base, TTS_DAILY_LIMIT: '100' }).TTS_DAILY_LIMIT).toBe(100);
    expect(() => parseConfig({ ...base, AUDIO_SLOW_MODE: 'x' })).toThrow(/AUDIO_SLOW_MODE/);
  });
});
