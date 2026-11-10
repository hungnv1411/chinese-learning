import type postgres from 'postgres';

type Sql = postgres.Sql;

/** Chuỗi người dùng phải gõ để xác nhận xóa tài khoản (design `profile.html#delete`). */
export const DELETE_CONFIRM_TEXT = 'XÓA TÀI KHOẢN';

/** Khóa file PDF chứng nhận trên R2 (spec 12: `certificates/{code}.pdf`). */
export const certificatePdfKey = (code: string) => `certificates/${code}.pdf`;

/**
 * Xóa tài khoản và mọi dữ liệu người dùng trong một transaction (spec 03 §6).
 * Chứng nhận được giữ lại nhưng thu hồi: chỉ còn `code`, `stage_id`, `issued_at`, `revoked = true`;
 * tên, điểm, `user_id`, `pdf_url` bị xóa. Trả mã các chứng nhận để xóa file PDF sau commit.
 */
export async function deleteAccount(
  sql: Sql,
  userId: string,
): Promise<{ certificateCodes: string[] }> {
  return sql.begin(async (tx) => {
    const [u] = await tx<{ email: string }[]>`SELECT email FROM "user" WHERE id = ${userId}`;
    if (!u) throw new Error('user not found');

    const certs = await tx<{ id: string; code: string }[]>`
      UPDATE certificate
      SET revoked = true, name_on_certificate = NULL, score = NULL, user_id = NULL,
          pdf_url = NULL, exam_attempt_id = NULL
      WHERE user_id = ${userId}
      RETURNING id, code`;
    if (certs.length > 0) {
      await tx`DELETE FROM certificate_name_change WHERE certificate_id = ANY(${certs.map((c) => c.id)})`;
    }
    // Better Auth lưu email trong verification.identifier.
    await tx`DELETE FROM verification WHERE identifier = ${u.email}`;
    // Xóa user kéo theo session, account, tiến độ, thẻ, bài làm… (ON DELETE CASCADE).
    await tx`DELETE FROM "user" WHERE id = ${userId}`;
    return { certificateCodes: certs.map((c) => c.code) };
  });
}
