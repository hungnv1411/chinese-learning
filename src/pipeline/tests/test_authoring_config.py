from clp.authoring.config import AuthoringConfig, load_config


def test_defaults_match_the_plan():
    cfg = load_config({})
    assert cfg == AuthoringConfig(
        author_model="claude-opus-5-5",
        review_model="claude-sonnet-5-5",
        effort="high",
        fallbacks=True,
    )
    assert cfg.author_model != cfg.review_model  # spec: lượt rà soát dùng model khác lượt soạn


def test_environment_overrides():
    cfg = load_config(
        {
            "CLP_AUTHOR_MODEL": "claude-fable-5-1",
            "CLP_REVIEW_MODEL": "claude-opus-5-5",
            "CLP_AUTHOR_EFFORT": "xhigh",
            "CLP_FALLBACKS": "0",
        }
    )
    assert (cfg.author_model, cfg.review_model, cfg.effort, cfg.fallbacks) == (
        "claude-fable-5-1",
        "claude-opus-5-5",
        "xhigh",
        False,
    )


def test_invalid_effort_is_rejected():
    import pytest

    with pytest.raises(ValueError, match="effort"):
        load_config({"CLP_AUTHOR_EFFORT": "ultra"})
