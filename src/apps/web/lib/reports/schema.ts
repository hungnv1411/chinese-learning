import { z } from 'zod';

export const MAX_DESCRIPTION = 500;
export const REPORT_KINDS = [
  'pinyin',
  'meaning',
  'hanviet',
  'audio',
  'sentence',
  'grading',
  'other',
] as const;
export const TARGET_KINDS = ['lesson', 'word', 'sentence', 'general'] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];
export type ReportTarget = { kind: (typeof TARGET_KINDS)[number]; id?: string };

const segmenter = new Intl.Segmenter();

/** Số ký tự hiển thị (grapheme): `ê` + dấu rời hay emoji ghép đều tính là 1. */
export function displayLength(s: string): number {
  return [...segmenter.segment(s)].length;
}

export const reportBody = z.object({
  target: z
    .object({
      kind: z.enum(TARGET_KINDS),
      id: z.string().trim().min(1).max(200).optional(),
    })
    .refine((t) => t.kind === 'general' || t.id !== undefined, {
      message: 'Thiếu id của đối tượng báo lỗi.',
    }),
  kind: z.enum(REPORT_KINDS),
  description: z
    .string()
    .trim()
    .default('')
    .refine((s) => displayLength(s) <= MAX_DESCRIPTION, {
      message: `Mô tả tối đa ${MAX_DESCRIPTION} ký tự.`,
    }),
});

export type ReportBody = z.infer<typeof reportBody>;
