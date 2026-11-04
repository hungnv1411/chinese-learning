import { AppShell } from '@/components/ui/AppShell';
import { getConfig } from '@/lib/config';
import { vi } from '@/lib/strings/vi';

const L = vi.word;

export default function WordNotFound() {
  return (
    <AppShell siteName={getConfig().SITE_NAME}>
      <div className="card soft center stack-3" style={{ maxWidth: 520 }}>
        <h1>{L.notFoundTitle}</h1>
        <p className="small muted">{L.notFoundBody}</p>
        <form action="/tra-tu" method="get" className="field">
          <label htmlFor="nf-q">{L.searchLabel}</label>
          <input id="nf-q" name="q" type="search" placeholder={L.searchPlaceholder} />
          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 'var(--space-3)' }}
          >
            {L.searchButton}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
