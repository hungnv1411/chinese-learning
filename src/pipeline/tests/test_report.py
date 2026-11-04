from clp.report import collect_stats, render, write_report


def seed(conn):
    conn.execute(
        "INSERT INTO dict_entry (id, simplified, traditional, pinyin_numbered, pinyin_marked,"
        " pinyin_plain, definitions) VALUES (1,'好','好','hao3','hǎo','hao',ARRAY['good']),"
        " (2,'你','你','ni3','nǐ','ni',ARRAY['you'])"
    )
    conn.execute(
        "INSERT INTO hsk_word (level, simplified, pinyin, dict_entry_id) VALUES"
        " (1,'好','hǎo',1),(1,'你','nǐ',2),(2,'谦虚','qiānxū',NULL),(3,'好','hǎo',1),(7,'龘','tà',NULL)"
    )
    conn.execute("INSERT INTO hsk_char (level, char) VALUES (1,'好'),(1,'你'),(2,'谦'),(7,'龘')")
    conn.execute(
        "INSERT INTO hanzi (char, han_viet, has_stroke_data) VALUES"
        " ('好', ARRAY['hảo'], true), ('你', '{}', true), ('谦', ARRAY['khiêm'], false), ('龘', '{}', false)"
    )
    conn.execute(
        "INSERT INTO sentence (id, zh, pinyin, en, source, source_ref, max_hsk_level) VALUES"
        " (1,'好。','hǎo','good','tatoeba','1',1), (2,'你好吗。','nǐ','you','tatoeba','2',2)"
    )
    conn.execute("INSERT INTO sentence_word (sentence_id, dict_entry_id) VALUES (1,1),(2,2)")
    conn.commit()


def test_collect_stats(db_conn):
    seed(db_conn)
    s = collect_stats(db_conn)
    assert s["tables"]["dict_entry"] == 2
    assert s["tables"]["hsk_word"] == 5
    assert s["tables"]["sentence"] == 2
    assert s["hsk_unmatched"] == 2  # 谦虚, 龘
    assert s["hanviet_missing"] == 1  # 你 (HSK 1); 龘 là cấp 7 nên không tính
    assert s["strokes_missing"] == 1  # 谦 (HSK 2)
    # 好 (cấp 1): câu 1 (cấp 1) đủ; 你 (cấp 1): chỉ có câu cấp 2 -> thiếu;
    # 谦虚 (cấp 2): chưa ghép -> thiếu; 好 (cấp 3): đủ
    assert s["words_without_sentence"] == {1: 1, 2: 1, 3: 0}
    assert any("cấp 1" in w and "từ" in w for w in s["warnings"])


def test_render_has_all_sections(db_conn):
    seed(db_conn)
    text = render(collect_stats(db_conn), now="2026-11-04T10:00:00")
    for heading in (
        "# Báo cáo pipeline",
        "2026-11-04T10:00:00",
        "## Số dòng mỗi bảng",
        "## Dữ liệu thiếu",
        "## Cảnh báo lệch chuẩn",
    ):
        assert heading in text
    assert "| dict_entry | 2 |" in text
    assert "Từ HSK chưa ghép được với từ điển: **2**" in text
    assert "Chữ HSK 1–3 thiếu Hán Việt: **1**" in text
    assert "Chữ HSK 1–3 thiếu dữ liệu nét: **1**" in text
    assert "| 1 | 1 |" in text  # từ cấp 1 thiếu câu: 1


def test_write_report(db_conn, tmp_path):
    seed(db_conn)
    path = write_report(db_conn, tmp_path, now="2026-11-04T10:00:00")
    assert path == tmp_path / "report.md"
    assert path.read_text(encoding="utf-8").startswith("# Báo cáo pipeline")
