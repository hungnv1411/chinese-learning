import { z } from 'zod';

const optional = z.string().trim().optional();

export const ConfigSchema = z.object({
  SITE_NAME: z.string().trim().min(1, 'SITE_NAME là bắt buộc (tên website, D16)'),
  SITE_URL: z.string().trim().url('SITE_URL phải là URL đầy đủ (D16)'),
  DATABASE_URL: z.string().trim().min(1),
  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET tối thiểu 16 ký tự'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  R2_PUBLIC_URL: z.string().trim().default(''),
  SPEECH_URL: z.string().trim().url().default('http://speech:8000'),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  AZURE_TTS_KEY: optional,
  AZURE_TTS_REGION: optional,
  TTS_DAILY_LIMIT: z.coerce.number().int().positive().default(500),
  AUDIO_SLOW_MODE: z.enum(['file', 'rate']).default('rate'),
  REPO_URL: z.string().trim().default(''),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Cấu hình môi trường không hợp lệ:\n- ${issues.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

/** Đọc cấu hình từ một object env (truyền vào để test được). Thiếu/sai biến thì ném ConfigError nêu rõ tên biến. */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return result.data;
}

let cached: Config | undefined;

/** Cấu hình của tiến trình hiện tại (đọc `process.env` một lần). */
export function getConfig(): Config {
  cached ??= parseConfig(process.env);
  return cached;
}
