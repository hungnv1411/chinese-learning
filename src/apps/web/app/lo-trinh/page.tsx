import { PathView } from '@/components/path/PathView';
import { AppShell } from '@/components/ui/AppShell';
import { getConfig } from '@/lib/config';
import { vi } from '@/lib/strings/vi';

export function generateMetadata() {
  return { title: `${vi.path.title} | ${getConfig().SITE_NAME}` };
}

export default function PathPage() {
  return (
    <AppShell siteName={getConfig().SITE_NAME} wide>
      <PathView />
    </AppShell>
  );
}
