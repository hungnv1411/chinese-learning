export type StrokeData = { strokes: string[]; medians: number[][][]; radStrokes?: number[] };

const cache = new Map<string, Promise<StrokeData>>();

/** Dữ liệu nét của một chữ trên R2 (`strokes/{char}.json`), cache theo chữ và URL gốc. */
export function loadStrokeData(base: string, char: string): Promise<StrokeData> {
  const root = base.replace(/\/+$/, '');
  const key = `${root}|${char}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`${root}/strokes/${encodeURIComponent(char)}.json`).then((res) => {
      if (!res.ok) throw new Error(`strokes ${char}: ${res.status}`);
      return res.json() as Promise<StrokeData>;
    });
    // Lỗi thì không giữ trong cache để lần sau thử lại được.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export const clearStrokeCache = (): void => cache.clear();
