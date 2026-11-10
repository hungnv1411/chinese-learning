/** Kho file (Cloudflare R2). Client R2 thật làm cùng 12-10 (tạo PDF); đến lúc đó chưa có kho. */
export interface ObjectStore {
  deleteObjects(keys: string[]): Promise<void>;
}

let store: ObjectStore | null = null;

/** null khi chưa cấu hình R2 (dev) hoặc chưa có client. */
export function getObjectStore(): ObjectStore | null {
  return store;
}

export function setObjectStore(s: ObjectStore | null): void {
  store = s;
}
