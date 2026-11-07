// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { CharAnalysis } from './CharAnalysis';

afterEach(cleanup);

const base = {
  char: '你',
  pinyinNumbered: 'ni3',
  hanViet: ['nhĩ'],
  meaning: 'you',
  strokeCount: 7,
  radical: { radical: '亻', nameVi: 'nhân đứng', meaningVi: 'người' },
};

describe('CharAnalysis', () => {
  test('hiện pinyin có dấu, Hán Việt, nghĩa tiếng Anh, số nét', () => {
    render(<CharAnalysis {...base} />);
    expect(screen.getByText('nǐ')).toBeTruthy();
    expect(screen.getByText('nhĩ')).toBeTruthy();
    expect(screen.getByText('you')).toBeTruthy();
    expect(screen.getByText('7 nét')).toBeTruthy();
  });

  test('hiện bộ thủ với tên và nghĩa tiếng Việt', () => {
    render(<CharAnalysis {...base} />);
    expect(screen.getByText(/nhân đứng/)).toBeTruthy();
    expect(screen.getByText(/“người”/)).toBeTruthy();
  });

  test('thiếu bộ thủ, Hán Việt thì bỏ dòng đó, không lỗi', () => {
    render(<CharAnalysis {...base} radical={null} hanViet={[]} />);
    expect(screen.queryByText(/Bộ/)).toBeNull();
    expect(screen.queryByText('nhĩ')).toBeNull();
  });
});
