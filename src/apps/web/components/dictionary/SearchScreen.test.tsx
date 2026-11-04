// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { RECENT_KEY } from '@/lib/dictionary/recent';
import { SearchScreen } from './SearchScreen';

const item = (id: number, simplified: string, numbered: string, marked: string, extra = {}) => ({
  id,
  simplified,
  traditional: simplified,
  pinyinNumbered: numbered,
  pinyinMarked: marked,
  definitions: ['good', 'well'],
  hanViet: 'hảo',
  hskLevel: 1,
  isVariantOrSurname: false,
  ...extra,
});
const reply = (groups: unknown[], nextCursor: string | null = null) =>
  Response.json({ groups, nextCursor });
const one = (items = [item(1, '好', 'hao3', 'hǎo')]) => reply([{ kind: 'pinyin', items }]);

let fetchMock: ReturnType<typeof vi.fn>;
const lastUrl = () => new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://x.test');
const type = (value: string) =>
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fetchMock = vi.fn(async () => one());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SearchScreen: tìm kiếm', () => {
  test('chỉ tìm sau 250 ms kể từ phím cuối, gộp các lần gõ liên tiếp', async () => {
    render(<SearchScreen />);
    type('h');
    await flush(100);
    type('ha');
    await flush(100);
    type('hao');
    await flush(249);
    expect(fetchMock).not.toHaveBeenCalled();
    await flush(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastUrl().pathname).toBe('/api/dictionary/search');
    expect(lastUrl().searchParams.get('q')).toBe('hao');
    expect(lastUrl().searchParams.get('chip')).toBe('all');
    await flush(0);
    expect(screen.getByRole('link', { name: /hǎo/ })).toBeTruthy();
  });

  test('gõ tiếp khi yêu cầu cũ chưa xong thì hủy yêu cầu cũ', async () => {
    let first: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_u: string, init: RequestInit) => {
      first = init.signal as AbortSignal;
      return new Promise(() => {});
    });
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    expect(first?.aborted).toBe(false);
    type('hao3');
    expect(first?.aborted).toBe(true);
  });

  test('kết quả là link tới /tu/…, có pinyin, Hán Việt, nghĩa và nhãn HSK', async () => {
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    const a = screen.getByRole('link', { name: /hǎo/ });
    expect(a.getAttribute('href')).toBe(`/tu/${encodeURIComponent('好')}`);
    expect(a.textContent).toContain('hảo');
    expect(a.textContent).toContain('good');
    expect(a.textContent).toContain('HSK 1');
  });

  test('hai nhóm thì có tiêu đề riêng; một nhóm thì không', async () => {
    fetchMock.mockImplementationOnce(async () =>
      reply([
        { kind: 'pinyin', items: [item(1, '和', 'he2', 'hé')] },
        { kind: 'english', items: [item(2, '喝', 'he1', 'hē')] },
      ]),
    );
    render(<SearchScreen />);
    type('he');
    await flush(250);
    expect(screen.getByRole('heading', { name: 'Pinyin' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'English' })).toBeTruthy();
    type('hao');
    await flush(250);
    expect(screen.queryByRole('heading', { name: 'Pinyin' })).toBeNull();
  });

  test('chip lọc đổi tham số chip và aria-pressed', async () => {
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    const chip = screen.getByRole('button', { name: 'Hán Việt' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Tất cả' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    await flush(250);
    expect(lastUrl().searchParams.get('chip')).toBe('hanviet');
  });

  test('còn trang sau: bấm Tải thêm gọi cursor và nối kết quả', async () => {
    fetchMock.mockImplementationOnce(async () =>
      reply([{ kind: 'pinyin', items: [item(1, '好', 'hao3', 'hǎo')] }], '30'),
    );
    fetchMock.mockImplementationOnce(async () =>
      reply([{ kind: 'pinyin', items: [item(2, '号', 'hao4', 'hào')] }]),
    );
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));
    await flush(0);
    expect(lastUrl().searchParams.get('cursor')).toBe('30');
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      `/tu/${encodeURIComponent('好')}`,
      `/tu/${encodeURIComponent('号')}`,
    ]);
    expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull();
  });
});

describe('SearchScreen: trạng thái', () => {
  test('rỗng: gợi ý cách tìm và không gọi API', async () => {
    render(<SearchScreen />);
    await flush(500);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Thử gõ/)).toBeTruthy();
  });

  test('không có kết quả', async () => {
    fetchMock.mockImplementationOnce(async () => reply([{ kind: 'english', items: [] }]));
    render(<SearchScreen />);
    type('zzzz');
    await flush(250);
    expect(screen.getByText('Không tìm thấy “zzzz”')).toBeTruthy();
  });

  test('đang tải có aria-busy; lỗi thì báo và cho thử lại', async () => {
    fetchMock.mockImplementationOnce(async () =>
      Response.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 }),
    );
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    expect(screen.getByRole('alert').textContent).toMatch(/Chưa tra được/);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await flush(0);
    expect(screen.getByRole('link', { name: /hǎo/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('429 báo gõ quá nhanh', async () => {
    fetchMock.mockImplementationOnce(async () =>
      Response.json({ error: { code: 'RATE_LIMITED', message: 'x' } }, { status: 429 }),
    );
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    expect(screen.getByRole('alert').textContent).toMatch(/quá nhanh/);
  });

  test('từ khóa ban đầu (từ /tra-tu?q=…) được tìm ngay', async () => {
    render(<SearchScreen initialQuery="好" />);
    await flush(250);
    expect(lastUrl().searchParams.get('q')).toBe('好');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('好');
  });

  test('xóa hết từ khóa thì quay về trạng thái rỗng và hủy tìm', async () => {
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    type('');
    await flush(250);
    expect(screen.queryByRole('link', { name: /hǎo/ })).toBeNull();
    expect(screen.getByText(/Thử gõ/)).toBeTruthy();
  });
});

describe('SearchScreen: tra gần đây', () => {
  test('hiện từ đã lưu khi chưa gõ gì, mỗi từ là link /tu/…', () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(['谢谢', '学习']));
    render(<SearchScreen />);
    const links = screen.getAllByRole('link', { name: '谢谢' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.getAttribute('href')).toBe(`/tu/${encodeURIComponent('谢谢')}`);
  });

  test('bấm một kết quả thì lưu vào Tra gần đây (tối đa 20, từ mới lên đầu)', async () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(['谢谢']));
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    fireEvent.click(screen.getByRole('link', { name: /hǎo/ }));
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) as string)).toEqual(['好', '谢谢']);
  });

  test('localStorage bị chặn thì tìm kiếm vẫn chạy', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<SearchScreen />);
    type('hao');
    await flush(250);
    fireEvent.click(screen.getByRole('link', { name: /hǎo/ }));
    expect(screen.getByRole('searchbox')).toBeTruthy();
    vi.restoreAllMocks();
  });
});
