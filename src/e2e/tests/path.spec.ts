import { expect, test, type Page } from '@playwright/test';

// /api/path được giả lập: kiểm tra bố cục và hành vi cuộn, toast, không phụ thuộc DB.
const lesson = (id: string, order: number, title: string, status: string, extra = {}) => ({
  id, order, title, type: 'normal', estimatedMinutes: 7, newWordCount: 6, skills: ['listen', 'read'],
  keyChar: status === 'completed' ? '你' : null, status, lockReason: null, ...extra,
});
const unit = (n: number, status: string, lessons: unknown[], doneCount = 0) => ({
  id: `u${n}`, order: n, title: `Chủ đề số ${n}`, description: '', image: null,
  sampleWords: ['你好', '谢谢'], status, doneCount, total: lessons.length, lessons,
});
const manyDone = Array.from({ length: 8 }, (_, i) => lesson(`a${i}`, i + 1, `Bài đã xong ${i + 1}`, 'completed'));
const body = {
  contentVersion: 'v1',
  skipExam: 'hsk1',
  stages: [
    {
      id: 'hsk1', title: 'HSK 1 · Sinh tồn', description: '', status: 'available', finalExam: 'locked',
      progress: { words: { mastered: 87, total: 500 }, chars: { mastered: 54, total: 300 }, units: { done: 1, total: 3 }, completedVia: null, requires: null },
      units: [
        unit(1, 'available', manyDone, 8),
        unit(2, 'available', [
          lesson('b1', 1, 'Bạn tên gì?', 'available'),
          lesson('b2', 2, 'Tạm biệt', 'locked', { lockReason: { kind: 'prev_lesson', lessonId: 'b1' } }),
        ]),
        unit(3, 'locked', [lesson('c1', 1, 'Bố mẹ', 'locked', { lockReason: { kind: 'checkpoint', unitId: 'u2' } })]),
      ],
    },
  ],
};

async function open(page: Page) {
  await page.route('**/api/path', (r) => r.fulfill({ json: body }));
  await page.goto('/lo-trinh');
  await page.getByRole('button', { name: /Bạn tên gì/ }).waitFor();
}

test.describe('màn hình con đường', () => {
  test('tự cuộn tới bài hiện tại', async ({ page }) => {
    await open(page);
    const box = await page.getByRole('button', { name: /Bạn tên gì/ }).boundingBox();
    const vh = page.viewportSize()!.height;
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh);
  });

  test('bấm bài khóa ra toast', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Tạm biệt, bị khóa/ }).click();
    await expect(page.getByRole('status')).toContainText('Hoàn thành «Bạn tên gì?» để mở bài này.');
  });

  test('bấm bài mở ra thẻ mô tả có nút Bắt đầu', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Bạn tên gì/ }).click();
    await expect(page.getByRole('link', { name: 'Bắt đầu' })).toHaveAttribute('href', '/bai/b1');
  });

  test('không cuộn ngang; nút bài ≥ 44px', async ({ page }) => {
    await open(page);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    const box = await page.getByRole('button', { name: /Bạn tên gì/ }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
