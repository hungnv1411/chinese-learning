import { expect, test } from '@playwright/test';

const PAGE = '/dev/ui';

test.describe('bố cục theo viewport', () => {
  test('không cuộn ngang', async ({ page }) => {
    await page.goto(PAGE);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('thanh điều hướng đúng dạng theo ngưỡng 768 / 1200', async ({ page }) => {
    await page.goto(PAGE);
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    const box = await nav.boundingBox();
    const vw = page.viewportSize()!.width;
    const vh = page.viewportSize()!.height;
    expect(box).not.toBeNull();
    if (vw < 768) {
      // thanh tab dưới cùng
      expect(box!.width).toBeCloseTo(vw, 0);
      expect(box!.y + box!.height).toBeCloseTo(vh, 0);
    } else if (vw < 1200) {
      expect(box!.width).toBeCloseTo(88, 0);
      expect(box!.x).toBe(0);
    } else {
      expect(box!.width).toBeCloseTo(256, 0);
      expect(box!.x).toBe(0);
    }
  });

  test('phóng chữ 130% không có phần tử nào tràn ngang', async ({ page }) => {
    await page.goto(PAGE);
    await page.addStyleTag({ content: 'html { font-size: 130% !important; }' });
    const overflowing = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        })
        .map((el) => `${el.tagName}.${(el as HTMLElement).className}`);
    });
    expect(overflowing).toEqual([]);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('ảnh chụp /dev/ui để so sánh bằng mắt với design', async ({ page }, info) => {
    await page.goto(PAGE);
    await page.screenshot({
      path: `__screenshots__/dev-ui-${info.project.name}.png`,
      fullPage: true,
    });
  });
});
