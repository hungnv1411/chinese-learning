#!/usr/bin/env bash
# Sao lưu PostgreSQL lên Cloudflare R2, giữ KEEP bản gần nhất (mặc định 14).
#
#   backup.sh                     pg_dump | gzip -> R2 backups/YYYY-MM-DD.sql.gz, rồi xóa bản cũ
#   backup.sh --dry-run           chỉ liệt kê bản sẽ xóa
#   backup.sh --dry-run --list-file F   dùng danh sách tên trong file F thay vì hỏi R2 (để test)
#
# Biến môi trường: DATABASE_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, KEEP.
set -euo pipefail

KEEP="${KEEP:-14}"
PREFIX="backups/"
DRY_RUN=0
LIST_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --list-file) LIST_FILE="$2"; shift ;;
    *) echo "Tham số lạ: $1" >&2; exit 2 ;;
  esac
  shift
done

# Đọc tên file (YYYY-MM-DD.sql.gz) từ stdin, in ra những bản cần xóa: mọi bản trừ KEEP bản mới nhất.
select_old() {
  grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.sql\.gz$' | sort | awk -v keep="$KEEP" '{a[NR]=$0} END {for (i=1;i<=NR-keep;i++) print a[i]}'
}

s3() {
  aws s3 --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" "$@"
}

list_remote() {
  s3 ls "s3://${R2_BUCKET}/${PREFIX}" | awk '{print $4}'
}

if [ "$DRY_RUN" -eq 1 ]; then
  if [ -n "$LIST_FILE" ]; then names="$(cat "$LIST_FILE")"; else names="$(list_remote)"; fi
  printf '%s\n' "$names" | select_old | while read -r f; do echo "DELETE ${PREFIX}${f}"; done
  exit 0
fi

name="$(date -u +%Y-%m-%d).sql.gz"
echo "Sao lưu -> ${PREFIX}${name}"
pg_dump --no-owner "$DATABASE_URL" | gzip | s3 cp - "s3://${R2_BUCKET}/${PREFIX}${name}"

list_remote | select_old | while read -r f; do
  echo "Xóa bản cũ ${PREFIX}${f}"
  s3 rm "s3://${R2_BUCKET}/${PREFIX}${f}"
done
