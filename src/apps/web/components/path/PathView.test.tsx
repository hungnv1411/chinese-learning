// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import type { PathData } from '@/lib/path/path';
import { PathView } from './PathView';

type Lesson = PathData['stages'][number]['units'][number]['lessons'][number];
const lesson = (over: Partial<Lesson> & { id: string; order: number; title: string }): Lesson => ({
  type: 'normal', estimatedMinutes: 7, newWordCount: 6, skills: ['listen', 'read'], keyChar: null,
  status: 'locked', lockReason: null, ...over,
});

const data = (over: Partial<PathData> = {}, stage1: Partial<PathData['stages'][number]> = {}): PathData => ({
  contentVersion: 'v1',
  skipExam: 'hsk1',
  stages: [
    {
      id: 'pron', title: '0 · Phát âm', description: 'Nền tảng', status: 'completed', finalExam: 'none',
      progress: { words: null, chars: null, units: { done: 1, total: 1 }, completedVia: 'lessons', requires: null },
      units: [{
        id: 'pron-u1', order: 1, title: 'Thanh điệu', description: '', image: null, sampleWords: [],
        status: 'available', doneCount: 1, total: 1,
        lessons: [lesson({ id: 'pron-u1-l1', order: 1, title: 'Bốn thanh', status: 'completed', keyChar: '妈' })],
      }],
    },
    {
      id: 'hsk1', title: 'HSK 1 · Sinh tồn', description: '', status: 'available', finalExam: 'locked',
      progress: {
        words: { mastered: 87, total: 500 }, chars: { mastered: 54, total: 300 },
        units: { done: 1, total: 3 }, completedVia: null, requires: null,
      },
      units: [
        {
          id: 'u1', order: 1, title: 'Đại từ', description: '', image: null, sampleWords: ['我'],
          status: 'available', doneCount: 1, total: 1,
          lessons: [lesson({ id: 'l1', order: 1, title: 'Tôi', status: 'completed', keyChar: '我' })],
        },
        {
          id: 'u2', order: 2, title: 'Chào hỏi', description: '', image: null, sampleWords: ['你好', '谢谢'],
          status: 'available', doneCount: 1, total: 3,
          lessons: [
            lesson({ id: 'l2', order: 1, title: 'Xin chào', status: 'completed', keyChar: '你' }),
            lesson({ id: 'l3', order: 2, title: 'Bạn tên gì?', status: 'available' }),
            lesson({
              id: 'l4', order: 3, title: 'Tạm biệt', type: 'checkpoint', status: 'locked',
              lockReason: { kind: 'prev_lesson', lessonId: 'l3' },
            }),
          ],
        },
        {
          id: 'u3', order: 3, title: 'Gia đình', description: '', image: null, sampleWords: [],
          status: 'locked', doneCount: 0, total: 1,
          lessons: [lesson({
            id: 'l5', order: 1, title: 'Bố mẹ', status: 'locked',
            lockReason: { kind: 'checkpoint', unitId: 'u2' },
          })],
        },
      ],
      ...stage1,
    },
    {
      id: 'hsk2', title: 'HSK 2 · Giao tiếp', description: '', status: 'locked', finalExam: 'locked',
      progress: {
        words: { mastered: 0, total: 750 }, chars: { mastered: 0, total: 400 },
        units: { done: 0, total: 0 }, completedVia: null, requires: 'hsk1',
      },
      units: [],
    },
  ],
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  fetchMock = vi.fn(async () => Response.json(data()));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ready = () => screen.findByRole('button', { name: /Bạn tên gì/ });

describe('PathView', () => {
  test('hiện lộ trình đang học, % và bài hiện tại có cờ BẮT ĐẦU', async () => {
    render(<PathView />);
    const cur = await ready();
    expect(cur.getAttribute('data-flag')).toBe('BẮT ĐẦU');
    expect(cur.getAttribute('aria-label')).toBe('Bài 2: Bạn tên gì?, sẵn sàng học');
    expect(screen.getByRole('button', { name: 'Chọn lộ trình: HSK 1 · Sinh tồn' })).toBeTruthy();
    expect(screen.getByText('17%')).toBeTruthy(); // 87/500 từ
  });

  test('nút bài đã xong hiện chữ Hán tiêu biểu, aria-label có trạng thái chữ', async () => {
    render(<PathView />);
    await ready();
    const done = screen.getByRole('button', { name: 'Bài 1: Xin chào, đã xong' });
    expect(done.textContent).toBe('你');
  });

  test('tự cuộn tới bài hiện tại khi mở màn hình', async () => {
    render(<PathView />);
    const cur = await ready();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' }));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(cur);
  });

  test('bấm bài khóa → toast theo lý do, không mở bài', async () => {
    render(<PathView />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Bài 3: Tạm biệt, bị khóa' }));
    expect(screen.getByRole('status').textContent).toBe('Hoàn thành «Bạn tên gì?» để mở bài này.');
    expect(screen.queryByRole('link', { name: 'Bắt đầu' })).toBeNull();
  });

  test('bài ở chủ đề khóa: toast nói bài ôn của chủ đề trước', async () => {
    render(<PathView />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Bài 1: Bố mẹ, bị khóa' }));
    expect(screen.getByRole('status').textContent).toContain('«Chào hỏi»');
  });

  test('bấm bài mở → thẻ mô tả với nút Bắt đầu tới /bai/{id}; bấm lại thì đóng', async () => {
    render(<PathView />);
    const cur = await ready();
    fireEvent.click(cur);
    expect(screen.getByText('Bài 2 / 3 · khoảng 7 phút')).toBeTruthy();
    expect(screen.getByText('6 từ mới · nghe · đọc')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Bắt đầu' }).getAttribute('href')).toBe('/bai/l3');
    fireEvent.click(cur);
    expect(screen.queryByRole('link', { name: 'Bắt đầu' })).toBeNull();
  });

  test('bấm bài đã xong → nút Học lại', async () => {
    render(<PathView />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Bài 1: Xin chào, đã xong' }));
    expect(screen.getByRole('link', { name: 'Học lại' }).getAttribute('href')).toBe('/bai/l2');
  });

  test('chủ đề khóa có banner xám và nhắc điều kiện; chủ đề có từ tiêu biểu và x/y bài', async () => {
    const { container } = render(<PathView />);
    await ready();
    expect(container.querySelectorAll('.unit.locked')).toHaveLength(1);
    expect(screen.getByText('1/3 bài')).toBeTruthy();
    expect(screen.getByText('你好 · 谢谢')).toBeTruthy();
    expect(screen.getByText('Hoàn thành chủ đề trước để mở khóa tiếp.')).toBeTruthy();
  });

  test('chủ đề chưa phát hành hiện “Sắp ra mắt”', async () => {
    const d = data();
    d.stages[1]!.units[2]!.status = 'coming_soon';
    fetchMock.mockResolvedValue(Response.json(d));
    render(<PathView />);
    await ready();
    expect(screen.getByText('Sắp ra mắt')).toBeTruthy();
  });

  test('chọn lộ trình: hộp thoại liệt kê tiến độ, thi vượt, điều kiện mở', async () => {
    const d = data();
    d.stages[0]!.progress.completedVia = 'exam_skip';
    fetchMock.mockResolvedValue(Response.json(d));
    render(<PathView />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lộ trình: HSK 1 · Sinh tồn' }));
    const dlg = await screen.findByRole('dialog', { name: 'Chọn lộ trình' });
    expect(within(dlg).getByText('Hoàn thành (thi vượt)')).toBeTruthy();
    expect(within(dlg).getByText('Chủ đề 1/3 · 87/500 từ · 54/300 chữ')).toBeTruthy();
    expect(within(dlg).getByText('Hoàn thành HSK 1 · Sinh tồn để mở.')).toBeTruthy();
  });

  test('chọn lộ trình khác đổi con đường đang xem', async () => {
    render(<PathView />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Chọn lộ trình: HSK 1 · Sinh tồn' }));
    const dlg = await screen.findByRole('dialog', { name: 'Chọn lộ trình' });
    fireEvent.click(within(dlg).getByRole('button', { name: /0 · Phát âm/ }));
    expect(await screen.findByRole('button', { name: 'Bài 1: Bốn thanh, đã xong' })).toBeTruthy();
  });

  test('“Đã học ở nơi khác?” trỏ tới /kiem-tra/{skipExam}?skip=1 khi skipExam khác null', async () => {
    render(<PathView />);
    await ready();
    const links = screen.getAllByRole('link', { name: /bài xếp lớp/ });
    expect(links[0]!.getAttribute('href')).toBe('/kiem-tra/hsk1?skip=1');
  });

  test('skipExam = null → không có ô “Đã học ở nơi khác?”', async () => {
    fetchMock.mockResolvedValue(Response.json(data({ skipExam: null })));
    render(<PathView />);
    await ready();
    expect(screen.queryByRole('link', { name: /bài xếp lớp/ })).toBeNull();
  });

  test('cuối lộ trình có nút Bài kiểm tra cuối (khóa → giải thích, không điều hướng)', async () => {
    render(<PathView />);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Bài kiểm tra cuối, bị khóa' }));
    expect(screen.getByRole('status').textContent).toBe('Hoàn thành mọi chủ đề để mở bài kiểm tra cuối.');
  });

  test('bài kiểm tra cuối mở → liên kết tới /kiem-tra/{stage}', async () => {
    const d = data();
    d.stages[1]!.finalExam = 'available';
    fetchMock.mockResolvedValue(Response.json(d));
    render(<PathView />);
    await ready();
    expect(screen.getByRole('link', { name: 'Bài kiểm tra cuối' }).getAttribute('href')).toBe('/kiem-tra/hsk1');
  });

  test('khách (401) → mời đăng nhập, không lỗi', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 }),
    );
    render(<PathView />);
    expect(await screen.findByText('Đăng nhập để xem lộ trình của bạn')).toBeTruthy();
  });

  test('lỗi mạng → thông báo và nút Thử lại tải lại', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('net'));
    render(<PathView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    expect(await ready()).toBeTruthy();
  });
});
