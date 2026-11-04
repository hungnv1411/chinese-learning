import Link from 'next/link';
import { parseNumbered, type Tone } from '@clp/core';
import { PublicFooter } from '@/components/sources/PublicFooter';
import { ReportButton } from '@/components/report/ReportButton';
import { AudioButton } from '@/components/ui/AudioButton';
import { Hanzi } from '@/components/ui/Hanzi';
import { HanViet } from '@/components/ui/HanViet';
import { Pinyin } from '@/components/ui/Pinyin';
import { audioUrl } from '@/lib/audio/audio-url';
import { wordAudioName } from '@/lib/audio/keys';
import type { WordEntry, WordPage } from '@/lib/dictionary/word';
import { splitSyllables } from '@clp/core';
import { vi } from '@/lib/strings/vi';
import { ShareButton } from './ShareButton';

const L = vi.word;
const CREDITS = ['CC-CEDICT', 'Tatoeba', 'Unihan', 'Make Me a Hanzi'];
const href = (kind: 'tu' | 'chu', s: string) => `/${kind}/${encodeURIComponent(s)}`;

function tonesOf(numbered: string): Tone[] {
  return splitSyllables(numbered).map((s) => parseNumbered(s).tone);
}

function EntryBlock({ entry, audioBase }: { entry: WordEntry; audioBase: string }) {
  const audio =
    entry.hasAudio && audioBase
      ? audioUrl(
          audioBase,
          'word',
          wordAudioName(entry.simplified, entry.pinyinNumbered),
          'xiaoxiao',
        )
      : null;
  return (
    <article className="card stack-3">
      <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-5)' }}>
        <Hanzi
          text={entry.simplified}
          traditional={entry.traditional}
          tones={tonesOf(entry.pinyinNumbered)}
          size="lg"
        />
        <div className="grow stack-2">
          <div className="row">
            <span className="py" style={{ font: '800 var(--text-xl) var(--font-display)' }}>
              <Pinyin numbered={entry.pinyinNumbered} keep />
            </span>
            {audio && <AudioButton src={audio.src} rate={audio.rate} label={L.listen} />}
          </div>
          {entry.hanViet && <HanViet values={[entry.hanViet]} />}
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        {entry.hskLevel !== null && (
          <span className="badge badge-streak">{L.hsk(entry.hskLevel)}</span>
        )}
        {entry.pos && <span className="badge">{entry.pos}</span>}
        {entry.traditional !== entry.simplified && (
          <span className="badge">{L.traditional(entry.traditional)}</span>
        )}
      </div>

      <ol className="lead" style={{ paddingLeft: '1.4em' }}>
        {entry.definitions.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ol>

      {entry.chars.length > 0 && (
        <>
          <h3>{L.chars}</h3>
          <div className="choices keep2">
            {entry.chars.map((c, i) => (
              <Link
                key={`${c.char}${i}`}
                className="card"
                href={href('chu', c.char)}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="row">
                  <Hanzi text={c.char} size="md" />
                  <div className="small">
                    {c.pinyinNumbered && <Pinyin numbered={c.pinyinNumbered} keep />}
                    {c.hanViet.length > 0 && <HanViet values={c.hanViet} />}
                    {c.radical && (
                      <div className="muted">{L.radical(c.radical.radical, c.radical.nameVi)}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </article>
  );
}

/** Nội dung trang `/tu/{simplified}`; dữ liệu không phụ thuộc người dùng nên cache được. */
export function WordView({
  page,
  audioBase,
  url,
}: {
  page: WordPage;
  /** `R2_PUBLIC_URL`; rỗng thì không hiện nút nghe. */
  audioBase: string;
  url: string;
}) {
  const first = page.entries[0] as WordEntry;
  return (
    <div className="stack-4" style={{ maxWidth: 820 }}>
      <div className="row between">
        <h1 lang="zh">{first.simplified}</h1>
        <ShareButton url={url} title={first.simplified} />
      </div>

      {page.entries.map((e) => (
        <EntryBlock key={e.id} entry={e} audioBase={audioBase} />
      ))}

      {page.sentences.length > 0 && (
        <section>
          <h3>{L.sentences}</h3>
          <ul className="list">
            {page.sentences.map((s) => (
              <li key={s.id}>
                {s.audioUrl && <AudioButton src={s.audioUrl} label={L.listenSentence} />}
                <div className="grow">
                  <div className="hz hz-sm" lang="zh">
                    {s.zh}
                  </div>
                  <div className="small muted">{s.pinyin}</div>
                  <div className="small">{s.en}</div>
                  {s.source === 'tatoeba' && s.sourceRef && (
                    <a
                      className="small muted"
                      href={`https://tatoeba.org/sentences/show/${s.sourceRef}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {L.tatoeba(s.sourceRef)}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.related.length > 0 && (
        <section>
          <h3>{L.related}</h3>
          <div className="row wrap" style={{ gap: 8, marginTop: 'var(--space-3)' }}>
            {page.related.map((r) => (
              <Link
                key={r.simplified}
                className="badge"
                lang="zh"
                href={href('tu', r.simplified)}
                style={{ fontSize: 'var(--text-sm)' }}
              >
                {r.simplified}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div>
        <PublicFooter credits={CREDITS} />
        <ReportButton target={{ kind: 'word', id: first.simplified }} />
      </div>
    </div>
  );
}
