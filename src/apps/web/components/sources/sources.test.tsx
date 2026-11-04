// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { loadSources } from '@/lib/sources';
import { PublicFooter } from './PublicFooter';
import { SourcesView } from './SourcesView';

afterEach(cleanup);

describe('SourcesView', () => {
  const sources = loadSources();

  test('mọi nguồn trong sources.yaml hiện trên trang với link nguồn và link giấy phép', () => {
    render(<SourcesView sources={sources} aiHanVietCount={0} repoUrl="" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(sources.length);
    for (const s of sources) {
      const item = items.find((el) => within(el).queryByText(s.name)) as HTMLElement;
      expect(item, s.name).toBeTruthy();
      const hrefs = within(item)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href'));
      expect(hrefs).toContain(s.url);
      expect(hrefs).toContain(s.licenseUrl);
      expect(within(item).getByText(s.licenseShort)).toBeTruthy();
    }
  });

  test('link ra ngoài mở an toàn', () => {
    render(<SourcesView sources={sources} aiHanVietCount={0} repoUrl="" />);
    for (const a of screen.getAllByRole('link', { name: /giấy phép|Trang nguồn/i })) {
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });

  test('có mục "Dữ liệu của chúng tôi" với CC BY-SA 4.0 và link GitHub từ REPO_URL', () => {
    render(<SourcesView sources={sources} aiHanVietCount={0} repoUrl="https://github.com/o/r" />);
    expect(screen.getByText('Dữ liệu của chúng tôi')).toBeTruthy();
    expect(screen.getAllByText(/CC BY-SA 4\.0/).length).toBeGreaterThan(0);
    const dl = screen.getByRole('link', { name: /Tải về/ });
    expect(dl.getAttribute('href')).toBe('https://github.com/o/r/tree/HEAD/content');
  });

  test('chưa có REPO_URL thì không có link tải, hiện ghi chú', () => {
    render(<SourcesView sources={sources} aiHanVietCount={0} repoUrl="" />);
    expect(screen.queryByRole('link', { name: /Tải về/ })).toBeNull();
    expect(screen.getByText(/chưa được công bố/)).toBeTruthy();
  });

  test('nói rõ số âm Hán Việt do AI bổ sung', () => {
    render(<SourcesView sources={sources} aiHanVietCount={37} repoUrl="" />);
    expect(screen.getByText(/37 chữ/)).toBeTruthy();
    cleanup();
    render(<SourcesView sources={sources} aiHanVietCount={0} repoUrl="" />);
    expect(screen.getByText(/Hiện chưa có âm Hán Việt nào do AI bổ sung/)).toBeTruthy();
  });

  test('không biết số (lỗi DB) thì vẫn nói có thể có âm do AI bổ sung, không in số', () => {
    render(<SourcesView sources={sources} aiHanVietCount={null} repoUrl="" />);
    expect(screen.getByText(/một số âm Hán Việt có thể do AI bổ sung/i)).toBeTruthy();
  });
});

describe('PublicFooter', () => {
  test('có link tới /nguon-du-lieu', () => {
    render(<PublicFooter />);
    const a = screen.getByRole('link', { name: /Nguồn dữ liệu và giấy phép/ });
    expect(a.getAttribute('href')).toBe('/nguon-du-lieu');
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  test('ghi nguồn ngắn khi truyền credits', () => {
    render(<PublicFooter credits={['CC-CEDICT', 'Tatoeba #12345', 'Unihan']} />);
    expect(screen.getByText(/Nguồn: CC-CEDICT · Tatoeba #12345 · Unihan/)).toBeTruthy();
  });
});
