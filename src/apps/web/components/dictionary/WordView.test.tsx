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

import type { WordPage } from '@/lib/dictionary/word';
import { WordView } from './WordView';

afterEach(cleanup);

const char = (c: string, py: string, hv: string[], rad: [string, string] | null) => ({
  char: c,
  pinyinNumbered: py,
  hanViet: hv,
  radical: rad ? { radical: rad[0], nameVi: rad[1], meaningVi: 'x' } : null,
});

const page: WordPage = {
  entries: [
    {
      id: 1,
      simplified: '好吃',
      traditional: '好喫',
      pinyinNumbered: 'hao3 chi1',
      pinyinMarked: 'hǎochī',
      definitions: ['tasty', 'delicious'],
      hskLevel: 1,
      pos: 'Adj',
      hanViet: 'hảo khật',
      hasAudio: true,
      chars: [char('好', 'hao3', ['hảo'], ['女', 'nữ']), char('吃', 'chi1', ['khật'], null)],
    },
    {
      id: 2,
      simplified: '好吃',
      traditional: '好吃',
      pinyinNumbered: 'hao4 chi1',
      pinyinMarked: 'hàochī',
      definitions: ['gluttonous'],
      hskLevel: null,
      pos: null,
      hanViet: null,
      hasAudio: false,
      chars: [],
    },
  ],
  sentences: [
    {
      id: 7,
      zh: '这个很好吃。',
      pinyin: 'zhè ge hěn hǎochī',
      en: 'This is tasty.',
      source: 'tatoeba',
      sourceRef: '123',
      maxHskLevel: 1,
      audioUrl: 'https://r2.test/s.mp3',
    },
    {
      id: 8,
      zh: '自编句。',
      pinyin: 'zì biān jù',
      en: 'Authored.',
      source: 'authored',
      sourceRef: null,
      maxHskLevel: 1,
      audioUrl: null,
    },
  ],
  related: [
    { simplified: '好看', hskLevel: 1 },
    { simplified: '吃饭', hskLevel: null },
  ],
};

const view = (over: Partial<Parameters<typeof WordView>[0]> = {}) =>
  render(
    <WordView page={page} audioBase="https://r2.test" url="https://site.test/tu/好吃" {...over} />,
  );

describe('WordView', () => {
  test('mỗi mục một khối: đa âm hiện cả hai cách đọc', () => {
    view();
    const blocks = screen.getAllByRole('article');
    expect(blocks).toHaveLength(2);
    expect(within(blocks[0] as HTMLElement).getByText('hảo khật')).toBeTruthy();
    expect(within(blocks[1] as HTMLElement).getByText('gluttonous')).toBeTruthy();
  });

  test('nghĩa đánh số; nhãn HSK, từ loại, phồn thể (chỉ khi khác)', () => {
    view();
    const [b1, b2] = screen.getAllByRole('article') as HTMLElement[];
    const items = within(b1 as HTMLElement)
      .getAllByRole('listitem')
      .slice(0, 2);
    expect(items.map((li) => li.textContent)).toEqual(['tasty', 'delicious']);
    expect(within(b1 as HTMLElement).getByText('HSK 1')).toBeTruthy();
    expect(within(b1 as HTMLElement).getByText('Adj')).toBeTruthy();
    expect(within(b1 as HTMLElement).getByText(/phồn thể: 好喫/)).toBeTruthy();
    expect(within(b2 as HTMLElement).queryByText(/phồn thể/)).toBeNull();
    expect(within(b2 as HTMLElement).queryByText(/^HSK/)).toBeNull();
  });

  test('từng chữ: link sang /chu/{char}, có bộ thủ tiếng Việt khi có', () => {
    view();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toContain(`/chu/${encodeURIComponent('好')}`);
    expect(hrefs).toContain(`/chu/${encodeURIComponent('吃')}`);
    expect(screen.getByText(/nữ/)).toBeTruthy();
  });

  test('audio chỉ hiện khi mục đã có file; dùng URL R2', () => {
    view();
    expect(screen.getAllByRole('button', { name: 'Nghe' })).toHaveLength(1);
    cleanup();
    view({ audioBase: '' });
    expect(screen.queryByRole('button', { name: 'Nghe' })).toBeNull();
  });

  test('câu ví dụ: Tatoeba có link #id, câu tự soạn không; audio câu khi có', () => {
    view();
    const t = screen.getByRole('link', { name: 'Tatoeba #123' });
    expect(t.getAttribute('href')).toBe('https://tatoeba.org/sentences/show/123');
    expect(screen.getByText('This is tasty.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nghe câu' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Tatoeba #null/ })).toBeNull();
  });

  test('từ cùng chữ là link /tu/…', () => {
    view();
    const a = screen.getByRole('link', { name: '好看' });
    expect(a.getAttribute('href')).toBe(`/tu/${encodeURIComponent('好看')}`);
  });

  test('cuối trang: ghi nguồn + link nguồn dữ liệu, nút Báo lỗi và Chia sẻ', () => {
    view();
    expect(screen.getByText(/Nguồn: CC-CEDICT · Tatoeba · Unihan · Make Me a Hanzi/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Nguồn dữ liệu và giấy phép' }).getAttribute('href'),
    ).toBe('/nguon-du-lieu');
    expect(screen.getByRole('button', { name: /Báo lỗi/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chia sẻ' })).toBeTruthy();
  });

  test('không có câu/từ liên quan thì không in tiêu đề mục đó', () => {
    view({ page: { ...page, sentences: [], related: [] } });
    expect(screen.queryByText('Câu ví dụ')).toBeNull();
    expect(screen.queryByText('Từ cùng chữ')).toBeNull();
  });
});
