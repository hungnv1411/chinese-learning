export const GUEST_STORAGE_KEY = 'guest_progress_v1';

/**
 * Lưu tiến độ khách ở localStorage (khóa `guest_progress_v1`). Mọi đọc/ghi bọc try/catch.
 * Không ghi được (Safari riêng tư, bị chặn, đầy) thì giữ trong bộ nhớ và `persistent = false`
 * để giao diện cảnh báo “Tiến độ sẽ mất khi đóng trang” (03-auth §4).
 */
export class GuestStore {
  persistent = true;
  private memory: string | null = null;

  constructor(private readonly storage: () => Storage | undefined = defaultStorage) {}

  /** Chuỗi JSON thô, hoặc null nếu chưa có. Ưu tiên bản trong bộ nhớ nếu đã từng ghi lỗi. */
  readRaw(): string | null {
    if (this.memory !== null) return this.memory;
    try {
      return this.storage()?.getItem(GUEST_STORAGE_KEY) ?? null;
    } catch {
      this.persistent = false;
      return null;
    }
  }

  read<T>(): T | null {
    const raw = this.readRaw();
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null; // dữ liệu hỏng: coi như chưa có (03-1 sẽ xác thực bằng zod)
    }
  }

  write(value: unknown): void {
    const raw = JSON.stringify(value);
    try {
      const s = this.storage();
      if (!s) throw new Error('no storage');
      s.setItem(GUEST_STORAGE_KEY, raw);
      this.memory = null;
    } catch {
      this.persistent = false;
      this.memory = raw;
    }
  }

  clear(): void {
    this.memory = null;
    try {
      this.storage()?.removeItem(GUEST_STORAGE_KEY);
    } catch {
      /* bỏ qua */
    }
  }
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined; // truy cập localStorage cũng có thể ném lỗi
  }
}
