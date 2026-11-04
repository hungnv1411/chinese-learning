import { AppShell } from '@/components/ui/AppShell';
import { SourcesView } from '@/components/sources/SourcesView';
import { getConfig } from '@/lib/config';
import { getSql } from '@/lib/db';
import { countAiHanViet, loadSources } from '@/lib/sources';

export function generateMetadata() {
  return { title: `Nguồn dữ liệu và giấy phép | ${getConfig().SITE_NAME}` };
}

export default async function SourcesPage() {
  const { SITE_NAME, REPO_URL } = getConfig();
  return (
    <AppShell siteName={SITE_NAME}>
      <SourcesView
        sources={loadSources()}
        aiHanVietCount={await countAiHanViet(getSql())}
        repoUrl={REPO_URL}
      />
    </AppShell>
  );
}
