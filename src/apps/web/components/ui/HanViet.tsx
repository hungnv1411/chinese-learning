/** Âm Hán Việt. CSS thêm nhãn “Hán Việt · ” và ẩn khi tắt trong cài đặt (`body.no-hv`). */
export function HanViet({ values }: { values: string[] }) {
  if (values.length === 0) return null;
  return <span className="hv">{values.join(', ')}</span>;
}
