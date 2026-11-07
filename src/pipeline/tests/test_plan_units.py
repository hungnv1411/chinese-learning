"""02-5: plan_units chia từ và ngữ pháp HSK thành chủ đề (model giả, không gọi API)."""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

from clp.authoring.llm import ClaudeCliJson, LlmRefusal, LlmTruncated
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


class TestClaudeCliJson:
    """Gọi `claude -p` (Claude Code CLI) thay cho API: kiểm tra dòng lệnh, đầu vào và các lỗi."""

    def runner(self, payload=None, returncode=0, stderr=""):
        calls = []

        def run(cmd, **kw):
            calls.append((cmd, kw))
            body = json.dumps(payload if payload is not None else {"structured_output": {"units": [1]}})
            return SimpleNamespace(returncode=returncode, stdout=body, stderr=stderr)

        return run, calls

    def generate(self, run, **over):
        args = {
            "system": "S", "user": "U", "schema": {"type": "object"},
            "model": "claude-opus-5-5", "effort": "high", "max_tokens": 64000,
        }  # fmt: skip
        args.update(over)
        return ClaudeCliJson(runner=run).generate(**args)

    def test_command_shape_and_parsing(self):
        run, calls = self.runner()
        assert self.generate(run) == {"units": [1]}
        ((cmd, kw),) = calls
        assert cmd[:2] == ["claude", "-p"]
        flag = lambda name: cmd[cmd.index(name) + 1]
        assert flag("--model") == "claude-opus-5-5" and flag("--effort") == "high"
        assert flag("--output-format") == "json"
        assert json.loads(flag("--json-schema")) == {"type": "object"}
        assert flag("--tools") == ""  # không cho dùng công cụ nào
        assert flag("--setting-sources") == ""  # không nạp hook/CLAUDE.md của người dùng hay dự án
        for must in ("--no-session-persistence", "--disable-slash-commands", "--strict-mcp-config"):
            assert must in cmd
        # prompt dài đi qua stdin và file, không qua đối số dòng lệnh
        assert kw["input"] == "U" and "U" not in cmd and "S" not in cmd
        assert kw["env"]["CLAUDE_CODE_MAX_OUTPUT_TOKENS"] == "64000"
        assert kw["env"].get("ANTHROPIC_API_KEY") is None  # dùng đăng nhập của Claude Code

    def test_system_prompt_is_passed_by_file_with_the_text(self):
        seen = {}

        def run(cmd, **kw):
            path = cmd[cmd.index("--system-prompt-file") + 1]
            seen["text"] = Path(path).read_text(encoding="utf-8")
            seen["cwd"] = kw["cwd"]
            return SimpleNamespace(returncode=0, stdout='{"structured_output": {}}', stderr="")

        self.generate(run, system="Bạn là biên tập viên.")
        assert seen["text"] == "Bạn là biên tập viên."
        assert Path(seen["cwd"]).resolve() != Path.cwd().resolve()  # chạy ở thư mục trống

    def test_falls_back_to_result_text_when_no_structured_output(self):
        run, _ = self.runner({"result": '{"units": [2]}'})
        assert self.generate(run) == {"units": [2]}

    def test_custom_binary(self):
        run, calls = self.runner()
        ClaudeCliJson(claude_bin="/opt/claude", runner=run).generate(
            system="", user="", schema={}, model="m", effort="low", max_tokens=1
        )
        assert calls[0][0][0] == "/opt/claude"

    def test_refusal_and_truncation_are_explicit_errors(self):
        run, _ = self.runner({"stop_reason": "refusal", "result": "", "is_error": False})
        with pytest.raises(LlmRefusal):
            self.generate(run)
        run, _ = self.runner({"stop_reason": "max_tokens", "result": "{", "is_error": False})
        with pytest.raises(LlmTruncated):
            self.generate(run)

    def test_cli_failure_is_reported_with_its_message(self):
        run, _ = self.runner({"is_error": True, "result": "Not logged in"})
        with pytest.raises(RuntimeError, match="Not logged in"):
            self.generate(run)
        run, _ = self.runner(returncode=1, stderr="boom")
        with pytest.raises(RuntimeError, match="boom"):
            self.generate(run)

    def test_missing_binary_has_a_helpful_message(self):
        def run(cmd, **kw):
            raise FileNotFoundError(cmd[0])

        with pytest.raises(RuntimeError, match="CLP_CLAUDE_BIN"):
            self.generate(run)

    def test_invalid_json_text_is_reported(self):
        run, _ = self.runner({"result": "không phải json"})
        with pytest.raises(ValueError, match="JSON"):
            self.generate(run)


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
