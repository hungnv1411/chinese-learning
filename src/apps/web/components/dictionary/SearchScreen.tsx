'use client';

import Link from 'next/link';
import { parseNumbered, splitSyllables, type Tone } from '@clp/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Hanzi } from '@/components/ui/Hanzi';
import { HanViet } from '@/components/ui/HanViet';
import { Icon } from '@/components/ui/Icon';
import { Pinyin } from '@/components/ui/Pinyin';
import { ApiClientError, apiFetch } from '@/lib/gateway/api-client';
import type { DictItem, SearchGroup } from '@/lib/dictionary/search';
import { addRecent, readRecent, writeRecent } from '@/lib/dictionary/recent';
import { vi } from '@/lib/strings/vi';

const L = vi.dict;
const DEBOUNCE_MS = 250;
const CHIPS = ['all', 'hanzi', 'pinyin', 'english', 'hanviet'] as const;
type Chip = (typeof CHIPS)[number];

type ApiGroup = Pick<SearchGroup, 'kind' | 'items'>;
type ApiResult = { groups: ApiGroup[]; nextCursor: string | null };
type Status = 'idle' | 'loading' | 'more' | 'done' | 'error';

const href = (word: string) => `/tu/${encodeURIComponent(word)}`;
const tonesOf = (numbered: string): Tone[] =>
  splitSyllables(numbered).map((s) => parseNumbered(s).tone);

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function mergeGroups(prev: ApiGroup[], next: ApiGroup[]): ApiGroup[] {
  const out = prev.map((g) => ({ ...g }));
  for (const g of next) {
    const existing = out.find((o) => o.kind === g.kind);
    if (existing) existing.items = [...existing.items, ...g.items];
    else out.push({ ...g });
  }
  return out;
}

function ResultRow({ item, onOpen }: { item: DictItem; onOpen: (word: string) => void }) {
  return (
    <li>
      <Link className="result" href={href(item.simplified)} onClick={() => onOpen(item.simplified)}>
        <Hanzi
          text={item.simplified}
          traditional={item.traditional}
          tones={tonesOf(item.pinyinNumbered)}
          size="md"
        />
        <span className="grow">
          <b className="py">
            <Pinyin numbered={item.pinyinNumbered} keep />
          </b>
          {item.hanViet && (
            <>
              {' · '}
              <HanViet values={[item.hanViet]} />
            </>
          )}
          <br />
          <span className="small">{item.definitions.join('; ')}</span>
        </span>
        {item.hskLevel !== null && (
          <span className="badge badge-streak">{vi.word.hsk(item.hskLevel)}</span>
        )}
      </Link>
    </li>
  );
}

function RecentChips({ words }: { words: string[] }) {
  if (words.length === 0) return null;
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {words.map((w) => (
        <Link
          key={w}
          className="badge"
          lang="zh"
          href={href(w)}
          style={{ fontSize: 'var(--text-sm)' }}
        >
          {w}
        </Link>
      ))}
    </div>
  );
}

/** Màn hình `/tra-tu`: một ô tìm tự nhận biết loại từ khóa, chip lọc, kết quả theo nhóm. */
export function SearchScreen({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [chip, setChip] = useState<Chip>('all');
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [rateLimited, setRateLimited] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  useEffect(() => setRecent(readRecent(storage())), []);

  const run = useCallback(async (q: string, c: Chip, cursor: string | null) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStatus(cursor ? 'more' : 'loading');
    const params = new URLSearchParams({ q, chip: c });
    if (cursor) params.set('cursor', cursor);
    try {
      const res = await apiFetch<ApiResult>(`/api/dictionary/search?${params}`, {
        signal: ac.signal,
      });
      setGroups((prev) => (cursor ? mergeGroups(prev, res.groups) : res.groups));
      setNext(res.nextCursor);
      setStatus('done');
    } catch (e) {
      if (ac.signal.aborted) return;
      setRateLimited(e instanceof ApiClientError && e.status === 429);
      setStatus('error');
    }
  }, []);

  // Tìm sau 250 ms kể từ phím cuối; đổi từ khóa hoặc chip thì hủy yêu cầu cũ ngay.
  useEffect(() => {
    abortRef.current?.abort();
    if (!trimmed) {
      setGroups([]);
      setNext(null);
      setStatus('idle');
      return;
    }
    const timer = setTimeout(() => void run(trimmed, chip, null), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, chip, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (next && status === 'done') void run(trimmed, chip, next);
  }, [next, status, run, trimmed, chip]);

  // Cuộn tới cuối thì tải thêm (nút "Tải thêm" luôn có làm phương án dự phòng).
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [next, loadMore]);

  const remember = (word: string) => {
    setRecent((prev) => {
      const list = addRecent(prev, word);
      writeRecent(storage(), list);
      return list;
    });
  };

  const empty = groups.every((g) => g.items.length === 0);
  const showTitles = groups.filter((g) => g.items.length > 0).length > 1;

  return (
    <div className="split">
      <section className="results stack-4" aria-label={L.results}>
        <div className="searchbox field">
          <label className="sr-only" htmlFor="dict-q">
            {L.search}
          </label>
          <Icon name="search" />
          <input
            id="dict-q"
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={L.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="seg" role="group" aria-label={L.chips} style={{ overflowX: 'auto' }}>
          {CHIPS.map((c) => (
            <button key={c} type="button" aria-pressed={chip === c} onClick={() => setChip(c)}>
              {L.chip[c]}
            </button>
          ))}
        </div>

        {status === 'error' && (
          <div className="stack-2">
            <p role="alert" className="small">
              ✗ {rateLimited ? L.rateLimited : L.error}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void run(trimmed, chip, null)}>
              {L.retry}
            </Button>
          </div>
        )}

        {status === 'idle' && (
          <div className="card soft center small muted" style={{ padding: 'var(--space-6)' }}>
            {L.hint}
          </div>
        )}

        {status === 'loading' && groups.length === 0 && (
          <p className="small muted" role="status">
            {L.loading}
          </p>
        )}

        {status === 'done' && empty && (
          <div className="card soft center" style={{ padding: 'var(--space-8) var(--space-4)' }}>
            <b>{L.notFound(trimmed)}</b>
            <p className="small muted" style={{ marginTop: 4 }}>
              {L.hint}
            </p>
          </div>
        )}

        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.kind} aria-busy={status === 'loading' || undefined}>
              {showTitles && <h2 className="eyebrow">{L.groups[g.kind]}</h2>}
              <ul className="stack-2">
                {g.items.map((it) => (
                  <ResultRow key={it.id} item={it} onOpen={remember} />
                ))}
              </ul>
            </section>
          ))}

        {next && (
          <div ref={sentinel} className="center">
            <Button
              variant="secondary"
              size="sm"
              loading={status === 'more'}
              onClick={loadMore}
              disabled={status !== 'done' && status !== 'more'}
            >
              {L.more}
            </Button>
          </div>
        )}

        {recent.length > 0 && (
          <section className="only-mobile" aria-label={L.recent}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              {L.recent}
            </p>
            <RecentChips words={recent} />
          </section>
        )}

        <div className="card soft row">
          <span className="tile blue" style={{ width: 44, height: 44 }}>
            <Icon name="pencil" />
          </span>
          <div className="grow small">
            <b>{L.drawTitle}</b>
            <div className="muted">{L.drawBody}</div>
          </div>
        </div>
      </section>

      <article className="detail card stack-3" aria-label={L.recent}>
        <p className="eyebrow">{L.recent}</p>
        {recent.length > 0 ? (
          <RecentChips words={recent} />
        ) : (
          <p className="small muted">{L.recentEmpty}</p>
        )}
      </article>
    </div>
  );
}
