-- Chạy trước migration Drizzle, an toàn khi chạy lại.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- array_to_string chỉ STABLE nên không dùng được trong cột sinh; bọc lại thành IMMUTABLE.
CREATE OR REPLACE FUNCTION clp_array_to_text(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT array_to_string($1, ' ') $$;
