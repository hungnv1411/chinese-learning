"""02-5: plan_units chia từ và ngữ pháp HSK thành chủ đề (model giả, không gọi API)."""

import json
from types import SimpleNamespace

import pytest
import yaml

from clp.authoring.llm import AnthropicJson, LlmRefusal, LlmTruncated
from clp.authoring.plan_units import (
    GrammarItem,
    PlanError,
    StageInputs,
    WordItem,
    build_prompt,
    load_stage_inputs,
    plan_stage,
    validate_plan,
    write_plan,
)
from clp.content.loader import load_plan

WORDS = [
    WordItem(w, p, g)
    for w, p, g in [
        ("你", "nǐ", "you"),
        ("好", "hǎo/hào", "good"),
        ("吗", "ma", "particle"),
        ("老师", "lǎoshī", "teacher"),
        ("谢谢", "xièxie", "thanks"),
    ]
]
GRAMMAR = [GrammarItem("hsk30-g001", "助词·吗"), GrammarItem("hsk30-g002", "副词·很")]
INPUTS = StageInputs(stage="hsk1", level=1, words=WORDS, grammar=GRAMMAR)


def plan(*units):
    return {
        "units": [
            {"title": t, "description": "Mô tả", "words": w, "grammar": g} for t, w, g in units
        ]
    }


GOOD = plan(
    ("Chào hỏi", ["你", "好", "老师"], ["hsk30-g001"]), ("Cảm ơn", ["吗", "谢谢"], ["hsk30-g002"])
)


class Fake:
    """Model giả: trả lần lượt các kế hoạch; ghi lại mọi lời gọi."""

    def __init__(self, *replies):
        self.replies, self.calls = list(replies), []

    def generate(self, *, system, user, schema, model, effort, max_tokens):
        self.calls.append(
            SimpleNamespace(system=system, user=user, schema=schema, model=model, effort=effort)
        )
        return self.replies.pop(0)


class TestValidate:
    def test_valid_plan_has_no_errors(self):
        errors, _ = validate_plan(GOOD, INPUTS)
        assert errors == []

    def test_missing_duplicate_and_unknown_words(self):
        bad = plan(
            ("A", ["你", "你", "西瓜"], ["hsk30-g001"]), ("B", ["吗", "谢谢"], ["hsk30-g002"])
        )
        errors, _ = validate_plan(bad, INPUTS)
        text = "\n".join(errors)
        assert "好" in text and "老师" in text  # thiếu
        assert "你" in text and "gán nhiều lần" in text
        assert "西瓜" in text and "không có trong danh sách" in text

    def test_grammar_must_be_covered_exactly_once(self):
        bad = plan(
            ("A", ["你", "好", "老师"], ["hsk30-g001", "hsk30-g001", "hsk30-g999"]),
            ("B", ["吗", "谢谢"], []),
        )
        errors, _ = validate_plan(bad, INPUTS)
        text = "\n".join(errors)
        assert "hsk30-g002" in text  # thiếu
        assert "hsk30-g001" in text and "nhiều lần" in text
        assert "hsk30-g999" in text

    def test_empty_plan_empty_units_and_duplicate_titles(self):
        assert validate_plan({"units": []}, INPUTS)[0]
        e, _ = validate_plan(
            plan(
                ("A", [], []),
                ("A", ["你", "好", "老师", "吗", "谢谢"], ["hsk30-g001", "hsk30-g002"]),
            ),
            INPUTS,
        )
        text = "\n".join(e)
        assert "không có từ nào" in text and "trùng tên" in text

    def test_unit_size_is_only_a_warning(self):
        errors, warnings = validate_plan(GOOD, INPUTS)
        assert errors == [] and warnings  # 2-3 từ mỗi chủ đề: ngoài khoảng gợi ý 8-60


class TestPrompt:
    def test_prompt_lists_everything_and_the_rules(self):
        system, user = build_prompt(INPUTS)
        for needle in ("你", "hǎo/hào", "老师", "hsk30-g001", "助词·吗", "HSK 1"):
            assert needle in user
        assert "đúng một" in system and "6 từ" in system
        assert "số đếm" in system  # gợi ý chủ đề HSK 1

    def test_no_topic_hints_for_other_levels(self):
        system, _ = build_prompt(StageInputs(stage="hsk2", level=2, words=WORDS, grammar=GRAMMAR))
        assert "số đếm" not in system


class TestPlanStage:
    def test_valid_first_try(self):
        llm = Fake(GOOD)
        res = plan_stage(llm, INPUTS, author_model="claude-opus-5-5")
        assert [u.id for u in res.units] == ["hsk1-u01", "hsk1-u02"]
        assert [u.order for u in res.units] == [1, 2]
        assert res.attempts == 1 and len(llm.calls) == 1
        assert llm.calls[0].model == "claude-opus-5-5"

    def test_invalid_plan_is_sent_back_with_the_errors(self):
        bad = plan(
            ("Chào hỏi", ["你", "好"], ["hsk30-g001"]), ("Cảm ơn", ["吗", "谢谢"], ["hsk30-g002"])
        )
        llm = Fake(bad, GOOD)
        res = plan_stage(llm, INPUTS, author_model="m")
        assert res.attempts == 2 and len(llm.calls) == 2
        repair = llm.calls[1].user
        assert "老师" in repair  # nêu từ còn thiếu
        assert (
            json.dumps(bad["units"][0]["title"], ensure_ascii=False) in repair
        )  # kèm kế hoạch trước

    def test_gives_up_after_two_repairs(self):
        bad = plan(("A", ["你"], []))
        llm = Fake(bad, bad, bad)
        with pytest.raises(PlanError) as e:
            plan_stage(llm, INPUTS, author_model="m")
        assert len(llm.calls) == 3  # 1 lần soạn + 2 lần sửa
        assert e.value.errors

    def test_max_repairs_is_configurable(self):
        bad = plan(("A", ["你"], []))
        llm = Fake(bad)
        with pytest.raises(PlanError):
            plan_stage(llm, INPUTS, author_model="m", max_repairs=0)
        assert len(llm.calls) == 1

    def test_malformed_output_counts_as_an_error_to_repair(self):
        llm = Fake({"units": "oops"}, GOOD)
        assert plan_stage(llm, INPUTS, author_model="m").attempts == 2


class TestWritePlan:
    def result(self):
        return plan_stage(Fake(GOOD), INPUTS, author_model="claude-opus-5-5")

    def test_writes_loadable_plan_and_meta(self, tmp_path):
        paths = write_plan(
            tmp_path, self.result(), INPUTS, model="claude-opus-5-5", now="2026-11-05T10:00:00"
        )
        loaded = load_plan(paths[0]).units
        assert [(u.id, u.title) for u in loaded] == [
            ("hsk1-u01", "Chào hỏi"),
            ("hsk1-u02", "Cảm ơn"),
        ]
        assert loaded[0].words == ["你", "好", "老师"] and loaded[1].grammar == ["hsk30-g002"]
        meta = json.loads(paths[1].read_text(encoding="utf-8"))
        assert meta["model"] == "claude-opus-5-5" and meta["attempts"] == 1
        assert meta["generated_at"] == "2026-11-05T10:00:00" and len(meta["prompt_sha256"]) == 64
        assert paths[1].parent.name == "_meta" and paths[0].parent.name == "hsk1"
        assert paths[0].read_text(encoding="utf-8").startswith("# Sinh bằng `clp plan-units`")

    def test_refuses_to_replace_a_plan_that_has_unit_files(self, tmp_path):
        stage = tmp_path / "hsk1"
        stage.mkdir()
        (stage / "u01-greetings.yaml").write_text("id: hsk1-u01\n", encoding="utf-8")
        with pytest.raises(PlanError, match="đã có file chủ đề"):
            write_plan(tmp_path, self.result(), INPUTS, model="m", now="t")
        write_plan(tmp_path, self.result(), INPUTS, model="m", now="t", force=True)
        assert (stage / "_plan.yaml").exists()

    def test_replanning_without_unit_files_overwrites(self, tmp_path):
        write_plan(tmp_path, self.result(), INPUTS, model="m", now="t1")
        write_plan(tmp_path, self.result(), INPUTS, model="m", now="t2")
        meta = json.loads((tmp_path / "hsk1" / "_meta" / "_plan.json").read_text(encoding="utf-8"))
        assert meta["generated_at"] == "t2"
        assert yaml.safe_load((tmp_path / "hsk1" / "_plan.yaml").read_text(encoding="utf-8"))[
            "units"
        ]


class TestAnthropicJson:
    class FakeStream:
        def __init__(self, message):
            self.message = message

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get_final_message(self):
            return self.message

    def client(self, message):
        calls = []

        def stream(**kw):
            calls.append(kw)
            return self.FakeStream(message)

        return SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(stream=stream))), calls

    def message(self, text='{"units": []}', stop="end_turn", details=None):
        return SimpleNamespace(
            stop_reason=stop,
            stop_details=details,
            content=[
                SimpleNamespace(type="thinking", thinking=""),
                SimpleNamespace(type="text", text=text),
            ],
        )

    def test_request_shape_and_parsing(self):
        client, calls = self.client(self.message('{"units": [1]}'))
        out = AnthropicJson(client).generate(
            system="S",
            user="U",
            schema={"type": "object"},
            model="claude-opus-5-5",
            effort="high",
            max_tokens=64000,
        )
        assert out == {"units": [1]}
        (kw,) = calls
        assert kw["model"] == "claude-opus-5-5" and kw["max_tokens"] == 64000
        assert kw["system"] == "S" and kw["messages"] == [{"role": "user", "content": "U"}]
        assert kw["output_config"] == {
            "effort": "high",
            "format": {"type": "json_schema", "schema": {"type": "object"}},
        }
        assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
        # các tham số bị Claude Opus 5.5 từ chối thì không được gửi
        for banned in ("temperature", "top_p", "top_k", "tool_choice", "thinking"):
            assert banned not in kw

    def test_fallbacks_can_be_turned_off(self):
        client, calls = self.client(self.message())
        AnthropicJson(client, fallbacks=False).generate(
            system="S", user="U", schema={}, model="m", effort="low", max_tokens=10
        )
        assert "fallbacks" not in calls[0] and "betas" not in calls[0]

    def test_refusal_and_truncation_are_explicit_errors(self):
        client, _ = self.client(
            self.message(stop="refusal", details=SimpleNamespace(category="cyber", explanation="x"))
        )
        with pytest.raises(LlmRefusal, match="cyber"):
            AnthropicJson(client).generate(
                system="", user="", schema={}, model="m", effort="low", max_tokens=1
            )
        client, _ = self.client(self.message(stop="max_tokens"))
        with pytest.raises(LlmTruncated):
            AnthropicJson(client).generate(
                system="", user="", schema={}, model="m", effort="low", max_tokens=1
            )

    def test_invalid_json_text_is_reported(self):
        client, _ = self.client(self.message("không phải json"))
        with pytest.raises(ValueError, match="JSON"):
            AnthropicJson(client).generate(
                system="", user="", schema={}, model="m", effort="low", max_tokens=1
            )


def test_load_stage_inputs_groups_readings_and_adds_gloss(db_conn):
    db_conn.execute(
        "INSERT INTO dict_entry (id, simplified, traditional, pinyin_numbered, pinyin_marked, pinyin_plain, definitions)"
        " VALUES (1,'好','好','hao3','hǎo','hao',ARRAY['good; well']), (2,'好','好','hao4','hào','hao',ARRAY['to like'])"
    )
    db_conn.execute(
        "INSERT INTO hsk_word (level, simplified, pinyin, dict_entry_id) VALUES (1,'好','hǎo',1),(1,'好','hào',2),(1,'谢谢','xièxie',NULL),(2,'学习','xuéxí',NULL)"
    )
    db_conn.execute(
        "INSERT INTO hsk_grammar (code, level, name_zh) VALUES ('hsk30-g002',1,'副词·很'),('hsk30-g001',1,'助词·吗'),('hsk30-g090',2,'x')"
    )
    db_conn.commit()
    inputs = load_stage_inputs(db_conn, "hsk1", 1)
    assert [(w.word, w.pinyin) for w in inputs.words] == [("好", "hǎo/hào"), ("谢谢", "xièxie")]
    assert inputs.words[0].gloss == "good"
    assert [g.code for g in inputs.grammar] == ["hsk30-g001", "hsk30-g002"]
