import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { Source } from '@/lib/sources';
import { vi } from '@/lib/strings/vi';

const L = vi.sources;
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

function aiNote(count: number | null): string {
  if (count === null) return L.aiUnknown;
  return count > 0 ? L.aiSome(count) : L.aiNone;
}

export function SourcesView({
  sources,
  aiHanVietCount,
  repoUrl,
}: {
  sources: Source[];
  aiHanVietCount: number | null;
  repoUrl: string;
}) {
  const downloadUrl = repoUrl ? `${repoUrl.replace(/\/+$/, '')}/tree/HEAD/content` : '';
  return (
    <div style={{ maxWidth: 820 }}>
      <header className="topbar">
        <Link className="icon-btn" href="/toi" aria-label={L.backToProfile}>
          <Icon name="back" />
        </Link>
        <h1>{L.title}</h1>
      </header>

      <p className="lead" style={{ marginBottom: 'var(--space-6)' }}>
        {L.lead}
      </p>

      <ul className="stack-3">
        {sources.map((s) => (
          <li key={s.id} className="card src">
            <div className="row between">
              <b>{s.name}</b>
              <span className="badge">{s.licenseShort}</span>
            </div>
            <p className="small muted">{s.usedFor}</p>
            <p className="small">
              <a href={s.url} {...external}>
                {L.sourcePage}
              </a>
              {' · '}
              <a href={s.licenseUrl} {...external}>
                {L.licenseText}
              </a>
            </p>
            <p className="small muted">{s.attribution}</p>
          </li>
        ))}
      </ul>

      <section className="card soft stack-3" style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="h3">{L.ours}</h2>
        <p>{L.oursBody}</p>
        <p>{aiNote(aiHanVietCount)}</p>
        {downloadUrl ? (
          <div>
            <a className="btn btn-secondary btn-sm" href={downloadUrl} {...external}>
              {L.download}
            </a>
          </div>
        ) : (
          <p className="small muted">{L.downloadSoon}</p>
        )}
      </section>

      <p className="small muted" style={{ marginTop: 'var(--space-6)' }}>
        {L.codeLicenses}
      </p>
    </div>
  );
}
