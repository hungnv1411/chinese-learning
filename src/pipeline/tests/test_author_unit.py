"""02-6: author_unit + review_unit (model giả, không gọi API)."""

import json
from types import SimpleNamespace

import pytest
import yaml

from clp.authoring.author_unit import (
    AuthoringError,
    author_unit_loop,
    build_author_prompt,
    load_unit_inputs,
    slugify,
    validate_author_output,
)
from clp.authoring.config import AuthoringConfig
from clp.authoring.review_unit import REVIEW_SCHEMA, build_review_prompt
from clp.content.check import load_content
from clp.content.loader import load_grammar, load_unit

STAGES = """\
- { id: pron, order: 1, title: Phát âm }
- { id: hsk1, order: 2, title: HSK 1, has_certificate: true, level: 1 }
"""
PLAN = """\
units:
  - id: hsk1-u01
    order: 1
    title: Chào hỏi
    description: Chào hỏi cơ bản.
    words: [你, 好, 老师, 吗]
    grammar: [hsk30-g001]
  - id: hsk1-u02
    order: 2
    title: Tạm biệt
    words: [再见]
    grammar: []
"""
CFG = AuthoringConfig()
NOW = "2026-11-05T12:00:00"


def seed(conn):
    entries = [
        (1, "你", "ni3", "nǐ", ["you"]),
        (2, "好", "hao3", "hǎo", ["good; well"]),
        (3, "老师", "lao3 shi1", "lǎoshī", ["teacher"]),
        (4, "吗", "ma5", "ma", ["question particle"]),
        (5, "再见", "zai4 jian4", "zàijiàn", ["goodbye"]),
    ]
    for i, s, num, marked, defs in entries:
        conn.execute(
            "INSERT INTO dict_entry (id, simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions, hsk_level)"
            " VALUES (%s,%s,%s,%s,%s,%s,%s,1)",
            (i, s, s, num, marked, marked, defs),
        )
        conn.execute(
            "INSERT INTO hsk_word (level, simplified, pinyin, dict_entry_id, pos) VALUES (1,%s,%s,%s,'x')",
            (s, marked, i),
        )
    conn.execute(
        "INSERT INTO radical_vi (radical, number, name_vi, meaning_vi) VALUES ('女', 38, 'nữ', 'phụ nữ')"
    )
    conn.execute(
        "INSERT INTO hanzi (char, han_viet, radical, decomposition, has_stroke_data) VALUES"
        " ('你', ARRAY['nễ'], NULL, '⿰亻尔', true), ('好', ARRAY['hảo'], '女', '⿰女子', true),"
        " ('老', ARRAY['lão'], NULL, NULL, true), ('师', ARRAY['sư'], NULL, NULL, true), ('吗', '{}', NULL, NULL, true)"
    )
    conn.execute(
        "INSERT INTO hsk_grammar (code, level, name_zh) VALUES ('hsk30-g001', 1, '助词·吗'), ('hsk30-g002', 1, '副词·很')"
    )
    # câu Tatoeba: 4321 dùng từ đã/đang học, 777 dùng từ ngoài (max_hsk_level 7)
    conn.execute(
        "INSERT INTO sentence (id, zh, pinyin, en, source, source_ref, max_hsk_level) VALUES"
        " (1,'老师好！','lǎo shī hǎo','Hello, teacher!','tatoeba','4321',1),"
        " (2,'再见老师。','zài jiàn lǎo shī','Bye, teacher.','tatoeba','555',1),"
        " (3,'你好西瓜。','nǐ hǎo xī guā','x','tatoeba','777',7)"
    )
    conn.execute(
        "INSERT INTO sentence_word (sentence_id, dict_entry_id) VALUES (1,3),(1,2),(2,5),(2,3),(3,1),(3,2)"
    )
    conn.commit()


def write_content(root, with_unit_file=False):
    (root / "hsk1").mkdir(parents=True, exist_ok=True)
    (root / "grammar").mkdir(exist_ok=True)
    (root / "overrides").mkdir(exist_ok=True)
    (root / "stages.yaml").write_text(STAGES, encoding="utf-8")
    (root / "hsk1" / "_plan.yaml").write_text(PLAN, encoding="utf-8")
    return root


def good_output():
    return {
        "lessons": [
            {
                "title": "Xin chào",
                "grammar": "",
                "words": ["你", "好", "老师"],
                "sentences": [
                    {"zh": "老师好！", "en": "ignored", "pinyin": "ignored", "tatoeba_id": 4321},
                ],
                "tips": [{"word": "好", "tip": "好 có âm Hán Việt là hảo."}],
            },
            {
                "title": "Câu hỏi với 吗",
                "grammar": "hsk30-g001",
                "words": ["吗"],
                "sentences": [
                    {
                        "zh": "你好吗？",
                        "en": "How are you?",
                        "pinyin": "nǐ hǎo ma?",
                        "tatoeba_id": 0,
                    }
                ],
                "tips": [],
            },
        ],
        "grammar_points": [
            {
                "code": "hsk30-g001",
                "title": "Câu hỏi với 吗",
                "explanation_vi": "Thêm 吗 vào cuối câu trần thuật để hỏi có/không.",
                "pattern": "Câu trần thuật + 吗？",
                "examples": [{"zh": "你是老师吗？", "en": "Are you a teacher?"}],
            }
        ],
        "han_viet_proposals": [{"char": "吗", "han_viet": ["ma"]}],
    }


class FakeLlm:
    def __init__(self, *replies):
        self.replies, self.calls = list(replies), []

    def generate(self, *, system, user, schema, model, effort, max_tokens):
        self.calls.append(
            SimpleNamespace(system=system, user=user, schema=schema, model=model, effort=effort)
        )
        r = self.replies.pop(0)
        return r(self) if callable(r) else r


PASS = {"verdict": "pass", "issues": []}


def fail(*problems):
    return {
        "verdict": "fail",
        "issues": [
            {
                "where": "hsk1-u01-l01",
                "category": "pinyin",
                "severity": "error",
                "problem": p,
                "suggestion": "sửa",
            }
            for p in problems
        ],
    }


@pytest.fixture
def env(db_conn, tmp_path):
    seed(db_conn)
    root = write_content(tmp_path / "content")
    loaded = load_content(root)
    entry = next(s for s in loaded.stages if s.id == "hsk1")
    plan_unit = next(p for _s, _f, p in loaded.plan_units if p.id == "hsk1-u01")
    return SimpleNamespace(conn=db_conn, root=root, loaded=loaded, stage=entry, unit=plan_unit)


def run(env, author, review, **kw):
    return author_unit_loop(
        env.conn, env.root, env.loaded, env.stage, env.unit,
        author_llm=author, review_llm=review, cfg=CFG, now=NOW, **kw,
    )  # fmt: skip


class TestInputs:
    def test_inputs_contain_word_data_learned_words_and_grammar(self, env):
        inputs = load_unit_inputs(env.conn, env.loaded, env.stage, env.unit)
        assert [w.word for w in inputs.words] == ["你", "好", "老师", "吗"]
        hao = inputs.words[1]
        assert hao.pinyin == "hǎo" and hao.definitions == ["good; well"]
        assert (
            hao.chars[0].han_viet == ["hảo"]
            and hao.chars[0].radical == "nữ"
            and hao.chars[0].decomposition == "⿰女子"
        )
        assert inputs.missing_han_viet == ["吗"]
        assert inputs.learned_words == []  # chủ đề đầu tiên
        (g,) = inputs.grammar
        assert (g.code, g.id, g.hsk_code, g.name) == (
            "hsk30-g001",
            "hsk1-g001",
            "一级-语法-001",
            "助词·吗",
        )

    def test_learned_words_come_from_earlier_units_only(self, env):
        later = next(p for _s, _f, p in env.loaded.plan_units if p.id == "hsk1-u02")
        inputs = load_unit_inputs(env.conn, env.loaded, env.stage, later)
        assert inputs.learned_words == ["你", "好", "老师", "吗"]

    def test_candidate_sentences_respect_level_and_known_words(self, env):
        inputs = load_unit_inputs(env.conn, env.loaded, env.stage, env.unit)
        assert [s.tatoeba_id for s in inputs.sentences] == [
            4321
        ]  # 555 dùng 再见 (chưa học), 777 ngoài cấp


class TestPrompts:
    def test_author_prompt_has_data_and_the_vietnamese_rules(self, env):
        inputs = load_unit_inputs(env.conn, env.loaded, env.stage, env.unit)
        system, user = build_author_prompt(inputs)
        for needle in (
            "lǎoshī",
            "good; well",
            "hảo",
            "nữ",
            "⿰女子",
            "Chào hỏi",
            "hsk30-g001",
            "助词·吗",
            "4321",
            "老师好！",
        ):
            assert needle in user, needle
        for needle in ("6 từ", "Hán Việt", "zh/ch/sh", "我很忙", "đúng một", "tatoeba_id"):
            assert needle in system, needle

    def test_revision_prompt_carries_previous_output_and_feedback(self, env):
        inputs = load_unit_inputs(env.conn, env.loaded, env.stage, env.unit)
        _, user = build_author_prompt(inputs, previous={"lessons": []}, feedback=["thiếu từ 吗"])
        assert "thiếu từ 吗" in user and '"lessons"' in user

    def test_review_prompt_differs_from_author_prompt(self, env):
        inputs = load_unit_inputs(env.conn, env.loaded, env.stage, env.unit)
        a_sys, _ = build_author_prompt(inputs)
        r_sys, r_user = build_review_prompt(inputs, "id: hsk1-u01\n")
        assert r_sys != a_sys and "rà soát" in r_sys and "id: hsk1-u01" in r_user
        for cat in ("pinyin", "biến điệu", "tự nhiên", "nhạy cảm"):
            assert cat in r_sys
        assert REVIEW_SCHEMA["properties"]["verdict"]["enum"] == ["pass", "fail"]


class TestValidateOutput:
    def inputs(self, env):
        return load_unit_inputs(env.conn, env.loaded, env.stage, env.unit)

    def test_good_output_passes(self, env):
        assert validate_author_output(good_output(), self.inputs(env)) == []

    def test_words_must_be_assigned_exactly_once(self, env):
        out = good_output()
        out["lessons"][0]["words"] = ["你", "你", "西瓜"]
        text = "\n".join(validate_author_output(out, self.inputs(env)))
        assert "好" in text and "老师" in text and "你" in text and "西瓜" in text

    def test_grammar_and_structure(self, env):
        out = good_output()
        out["lessons"][1]["grammar"] = "hsk30-g999"
        out["lessons"][0]["sentences"] = []
        out["lessons"][0]["tips"] = [{"word": "吗", "tip": "x"}]
        text = "\n".join(validate_author_output(out, self.inputs(env)))
        assert "hsk30-g999" in text and "hsk30-g001" in text  # sai mã, và mã thật chưa được dùng
        assert "không có câu" in text and "mẹo" in text

    def test_tatoeba_id_must_be_a_candidate(self, env):
        out = good_output()
        out["lessons"][0]["sentences"][0]["tatoeba_id"] = 555
        assert "555" in "\n".join(validate_author_output(out, self.inputs(env)))

    def test_malformed_output(self, env):
        assert validate_author_output({"lessons": "x"}, self.inputs(env))


class TestLoop:
    def test_happy_path_writes_unit_grammar_overrides_and_meta(self, env):
        author, review = FakeLlm(good_output()), FakeLlm(PASS)
        res = run(env, author, review)
        assert res.rounds == 1 and res.review_unresolved == []
        unit_path = env.root / "hsk1" / "u01-chao-hoi.yaml"
        unit = load_unit(unit_path).unit
        assert [l.id for l in unit.lessons] == ["hsk1-u01-l01", "hsk1-u01-l02", "hsk1-u01-cp"]
        assert unit.lessons[2].type == "checkpoint" and unit.lessons[0].steps is None
        l1 = unit.lessons[0]
        s = l1.sentences[0]
        assert (s.id, s.zh, s.en, s.tatoeba_id) == (
            "s-hsk1-u01-001",
            "老师好！",
            "Hello, teacher!",
            4321,
        )  # lấy nguyên văn từ DB
        assert (
            unit.lessons[1].sentences[0].id == "s-hsk1-u01-002"
            and unit.lessons[1].grammar == "hsk1-g001"
        )
        assert l1.tips == {"好": "好 có âm Hán Việt là hảo."}
        g = load_grammar(env.root / "grammar" / "hsk1.yaml").points
        assert (g[0].id, g[0].hsk_code) == ("hsk1-g001", "一级-语法-001")
        ov = yaml.safe_load((env.root / "overrides" / "han_viet.yaml").read_text(encoding="utf-8"))
        assert ov == {"吗": {"han_viet": ["ma"], "source": "ai"}}
        meta = json.loads(
            (env.root / "hsk1" / "_meta" / "hsk1-u01.json").read_text(encoding="utf-8")
        )
        assert (
            meta["author_model"] == "claude-opus-5-5"
            and meta["review_model"] == "claude-sonnet-5-5"
        )
        assert (
            meta["rounds"] == 1 and meta["generated_at"] == NOW and meta["review_unresolved"] == []
        )

    def test_models_and_effort_come_from_config(self, env):
        author, review = FakeLlm(good_output()), FakeLlm(PASS)
        run(env, author, review)
        assert (
            author.calls[0].model == "claude-opus-5-5"
            and review.calls[0].model == "claude-sonnet-5-5"
        )
        assert author.calls[0].system != review.calls[0].system

    def test_same_model_for_author_and_review_is_rejected(self, env):
        cfg = AuthoringConfig(author_model="claude-opus-5-5", review_model="claude-opus-5-5")
        with pytest.raises(AuthoringError, match="model khác"):
            author_unit_loop(
                env.conn, env.root, env.loaded, env.stage, env.unit,
                author_llm=FakeLlm(), review_llm=FakeLlm(), cfg=cfg, now=NOW,
            )  # fmt: skip

    def test_machine_error_is_fed_back_before_any_review(self, env):
        bad = good_output()
        bad["lessons"][1]["sentences"][0]["pinyin"] = "nǐ hǎo mǎ?"  # chỉ cảnh báo, không chặn
        bad["lessons"][0]["tips"] = [
            {"word": "好", "tip": "好 có âm Hán Việt là xyz."}
        ]  # chặn: sai Hán Việt
        author, review = FakeLlm(bad, good_output()), FakeLlm(PASS)
        res = run(env, author, review)
        assert res.rounds == 2 and len(review.calls) == 1  # chưa tốn lượt rà soát cho bản lỗi máy
        assert "han_viet_mismatch" in author.calls[1].user

    def test_review_errors_trigger_a_revision(self, env):
        author, review = (
            FakeLlm(good_output(), good_output()),
            FakeLlm(fail("pinyin 老师 sai"), PASS),
        )
        res = run(env, author, review)
        assert res.rounds == 2
        assert "pinyin 老师 sai" in author.calls[1].user

    def test_gives_up_revisions_after_two_and_records_unresolved_review_issues(self, env):
        author = FakeLlm(good_output(), good_output(), good_output())
        review = FakeLlm(fail("a"), fail("b"), fail("c"))
        res = run(env, author, review)
        assert res.rounds == 3 and len(author.calls) == 3
        assert [i.problem for i in res.review_unresolved] == ["c"]
        assert (env.root / "hsk1" / "u01-chao-hoi.yaml").exists()  # vẫn ghi, kèm cờ chưa giải quyết
        meta = json.loads(
            (env.root / "hsk1" / "_meta" / "hsk1-u01.json").read_text(encoding="utf-8")
        )
        assert meta["review_unresolved"][0]["problem"] == "c"

    def test_strict_mode_refuses_to_write_with_unresolved_review_issues(self, env):
        author = FakeLlm(good_output(), good_output(), good_output())
        with pytest.raises(AuthoringError, match="chưa giải quyết"):
            run(env, author, FakeLlm(fail("a"), fail("b"), fail("c")), strict=True)
        assert not (env.root / "hsk1" / "u01-chao-hoi.yaml").exists()

    def test_machine_errors_that_persist_write_nothing(self, env):
        bad = good_output()
        bad["lessons"][0]["tips"] = [{"word": "好", "tip": "好 có âm Hán Việt là xyz."}]
        author = FakeLlm(bad, bad, bad)
        with pytest.raises(AuthoringError) as e:
            run(env, author, FakeLlm())
        assert "han_viet_mismatch" in str(e.value) and len(author.calls) == 3
        assert not (env.root / "hsk1" / "u01-chao-hoi.yaml").exists()
        assert not (env.root / "overrides" / "han_viet.yaml").exists()

    def test_refuses_to_overwrite_an_existing_unit_file(self, env):
        (env.root / "hsk1" / "u01-chao-hoi.yaml").write_text("id: hsk1-u01\n", encoding="utf-8")
        with pytest.raises(AuthoringError, match="đã có"):
            run(env, FakeLlm(good_output()), FakeLlm(PASS))
        run(env, FakeLlm(good_output()), FakeLlm(PASS), force=True)

    def test_han_viet_proposals_never_overwrite_or_invent(self, env):
        (env.root / "overrides" / "han_viet.yaml").write_text(
            yaml.safe_dump({"吗": {"han_viet": ["ma"], "source": "manual"}}, allow_unicode=True),
            encoding="utf-8",
        )
        out = good_output()
        out["han_viet_proposals"] = [
            {"char": "吗", "han_viet": ["mạ"]},  # đã có (manual): giữ nguyên
            {"char": "好", "han_viet": ["hiếu"]},  # đã có trong Unihan: bỏ
            {"char": "西", "han_viet": ["tây"]},  # không thuộc từ của chủ đề: bỏ
        ]
        run(env, FakeLlm(out), FakeLlm(PASS))
        ov = yaml.safe_load((env.root / "overrides" / "han_viet.yaml").read_text(encoding="utf-8"))
        assert ov == {"吗": {"han_viet": ["ma"], "source": "manual"}}

    def test_existing_grammar_points_are_kept(self, env):
        (env.root / "grammar" / "hsk1.yaml").write_text(
            "- { id: hsk1-g002, hsk_code: 一级-语法-002, title: Cũ, explanation_vi: e, pattern: p, examples: [] }\n",
            encoding="utf-8",
        )
        run(env, FakeLlm(good_output()), FakeLlm(PASS))
        ids = [p.id for p in load_grammar(env.root / "grammar" / "hsk1.yaml").points]
        assert ids == ["hsk1-g002", "hsk1-g001"]


def test_slugify():
    assert slugify("Chào hỏi") == "chao-hoi"
    assert slugify("Số đếm & đồ ăn!") == "so-dem-do-an"
