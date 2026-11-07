import { Hanzi } from '@/components/ui/Hanzi';
import { HanViet } from '@/components/ui/HanViet';
import { Pinyin } from '@/components/ui/Pinyin';
import { vi } from '@/lib/strings/vi';

type Props = {
  char: string;
  pinyinNumbered: string;
  hanViet: string[];
  /** Nghĩa tiếng Anh (CC-CEDICT). */
  meaning: string;
  strokeCount: number;
  radical: { radical: string; nameVi: string; meaningVi: string } | null;
};

/** Phân tích chữ dưới ô tập viết: số nét, bộ thủ, Hán Việt, nghĩa. */
export function CharAnalysis({ char, pinyinNumbered, hanViet, meaning, strokeCount, radical }: Props) {
  return (
    <div className="card soft">
      <div className="row" style={{ gap: 'var(--space-4)' }}>
        <Hanzi text={char} size="md" />
        <div className="grow">
          <b>
            <Pinyin numbered={pinyinNumbered} keep />
          </b>
          {hanViet.length > 0 && (
            <>
              {' · '}
              <HanViet values={hanViet} />
            </>
          )}
          <div>{meaning}</div>
        </div>
      </div>
      <p className="small" style={{ marginTop: 'var(--space-3)' }}>
        <span>{vi.writing.strokeCount(strokeCount)}</span>
        {radical && (
          <>
            {' · '}
            {vi.writing.radical}{' '}
            <b lang="zh">{radical.radical}</b> ({radical.nameVi}, “{radical.meaningVi}”)
          </>
        )}
      </p>
    </div>
  );
}
