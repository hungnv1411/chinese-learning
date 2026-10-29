/** 30 ngày, tự gia hạn mỗi ngày dùng (plan 00 bước 5). */
export const SESSION_EXPIRES_IN_SEC = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE_SEC = 60 * 60 * 24;

/** Khi tạo user: tên hiển thị và tên in trên chứng nhận mặc định là tên Google. */
export function userCreateDefaults(user: { name: string }) {
  return { displayName: user.name, certificateName: user.name };
}
