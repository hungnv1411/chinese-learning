export const RECENT_KEY = 'recent_lookups_v1';
export const MAX_RECENT = 20;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Từ mới lên đầu, bỏ trùng, giữ tối đa 20. */
export function addRecent(list: string[], word: string): string[] {
  const w = word.trim();
  if (!w) return list;
  return [w, ...list.filter((x) => x !== w)].slice(0, MAX_RECENT);
}

/** Đọc "Tra gần đây" trên máy; mọi lỗi hoặc dữ liệu hỏng đều thành danh sách rỗng. */
export function readRecent(storage: StorageLike | null): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function writeRecent(storage: StorageLike | null, list: string[]): void {
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* chế độ riêng tư hoặc hết dung lượng: bỏ qua, tìm kiếm vẫn dùng được */
  }
}
