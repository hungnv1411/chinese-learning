import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/** Mục từ điển (CC-CEDICT). */
export const dictEntry = pgTable(
  'dict_entry',
  {
    id: serial('id').primaryKey(),
    simplified: text('simplified').notNull(),
    traditional: text('traditional').notNull(),
    pinyinNumbered: text('pinyin_numbered').notNull(),
    pinyinMarked: text('pinyin_marked').notNull(),
    pinyinPlain: text('pinyin_plain').notNull(),
    definitions: text('definitions').array().notNull(),
    hskLevel: smallint('hsk_level'),
    isVariantOrSurname: boolean('is_variant_or_surname').notNull().default(false),
    /** Thứ tự dòng gốc trong CC-CEDICT, để xếp hạng tìm kiếm. */
    cedictOrder: integer('cedict_order'),
    /** `clp_array_to_text` là hàm IMMUTABLE tạo ở db/pre-migrate.sql (array_to_string chỉ STABLE). */
    definitionsTsv: tsvector('definitions_tsv').generatedAlwaysAs(
      sql`to_tsvector('english', clp_array_to_text(definitions))`,
    ),
  },
  (t) => [
    index('dict_entry_simplified_idx').on(t.simplified),
    index('dict_entry_pinyin_plain_idx').using('btree', t.pinyinPlain.op('text_pattern_ops')),
    index('dict_entry_simplified_trgm_idx').using('gin', t.simplified.op('gin_trgm_ops')),
    index('dict_entry_definitions_tsv_idx').using('gin', t.definitionsTsv),
  ],
);

/** Danh sách từ HSK 2021. Không xóa khi đã có tiến độ: đặt `deprecated`. */
export const hskWord = pgTable(
  'hsk_word',
  {
    id: serial('id').primaryKey(),
    level: smallint('level').notNull(),
    simplified: text('simplified').notNull(),
    pinyin: text('pinyin').notNull(),
    pos: text('pos'),
    dictEntryId: integer('dict_entry_id').references(() => dictEntry.id),
    deprecated: boolean('deprecated').notNull().default(false),
  },
  (t) => [
    index('hsk_word_level_idx').on(t.level),
    index('hsk_word_simplified_idx').on(t.simplified),
  ],
);

export const hskChar = pgTable('hsk_char', {
  id: serial('id').primaryKey(),
  level: smallint('level').notNull(),
  char: text('char').notNull().unique(),
});

export const hskGrammar = pgTable('hsk_grammar', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  level: smallint('level').notNull(),
  nameZh: text('name_zh').notNull(),
});

/** Thông tin từng chữ. */
export const hanzi = pgTable('hanzi', {
  char: text('char').primaryKey(),
  hanViet: text('han_viet')
    .array()
    .notNull()
    .default(sql`'{}'`),
  /** `unihan` | `manual` | `ai` — để trang Nguồn dữ liệu ghi rõ âm do AI bổ sung. */
  hanVietSource: text('han_viet_source'),
  decomposition: text('decomposition'),
  radical: text('radical'),
  etymologyHint: text('etymology_hint'),
  strokeCount: smallint('stroke_count'),
  hasStrokeData: boolean('has_stroke_data').notNull().default(false),
});

/** Tên và nghĩa tiếng Việt của 214 bộ thủ (content/radicals_vi.yaml). */
export const radicalVi = pgTable('radical_vi', {
  radical: text('radical').primaryKey(),
  number: smallint('number').notNull().unique(),
  nameVi: text('name_vi').notNull(),
  meaningVi: text('meaning_vi').notNull(),
});

export const sentence = pgTable(
  'sentence',
  {
    id: serial('id').primaryKey(),
    zh: text('zh').notNull(),
    pinyin: text('pinyin').notNull(),
    en: text('en').notNull(),
    /** `tatoeba` | `authored` */
    source: text('source').notNull(),
    sourceRef: text('source_ref'),
    maxHskLevel: smallint('max_hsk_level'),
    audioUrl: text('audio_url'),
  },
  (t) => [unique('sentence_source_ref_uq').on(t.source, t.sourceRef)],
);

export const sentenceWord = pgTable(
  'sentence_word',
  {
    sentenceId: integer('sentence_id')
      .notNull()
      .references(() => sentence.id, { onDelete: 'cascade' }),
    dictEntryId: integer('dict_entry_id')
      .notNull()
      .references(() => dictEntry.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.sentenceId, t.dictEntryId] }),
    index('sentence_word_entry_idx').on(t.dictEntryId),
  ],
);

export const audioAsset = pgTable('audio_asset', {
  key: text('key').primaryKey(),
  url: text('url').notNull(),
  text: text('text').notNull(),
  voice: text('voice').notNull(),
  /** sha256 của text + voice + rate + phoneme: generate_audio bỏ qua file đã có. */
  hash: text('hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
