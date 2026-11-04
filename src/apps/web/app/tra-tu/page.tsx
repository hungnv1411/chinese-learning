import { SearchScreen } from '@/components/dictionary/SearchScreen';
import { AppShell } from '@/components/ui/AppShell';
import { getConfig } from '@/lib/config';
import { vi } from '@/lib/strings/vi';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export function generateMetadata() {
  return { title: `${vi.dict.title} | ${getConfig().SITE_NAME}` };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.slice(0, 100) ?? '';
  return (
    <AppShell siteName={getConfig().SITE_NAME} wide>
      <header className="topbar">
        <h1>{vi.dict.title}</h1>
      </header>
      <SearchScreen initialQuery={initialQuery} />
    </AppShell>
  );
}
