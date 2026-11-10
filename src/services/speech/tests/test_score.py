from app.score import SyllableResult, score_sentence, syllable_score


def syl(content=True, tone=True):
    return SyllableResult(content_ok=content, tone_ok=tone)


def test_all_correct_is_100():
    assert score_sentence([syl()] * 4, "sentence") == 100


def test_one_wrong_tone_of_four_is_88():
    assert score_sentence([syl(), syl(), syl(), syl(tone=False)], "sentence") == 88


def test_one_wrong_content_of_four_is_75():
    assert score_sentence([syl(), syl(), syl(), syl(content=False, tone=False)], "sentence") == 75


def test_wrong_content_forces_tone_zero_even_if_tone_ok():
    assert syllable_score(syl(content=False, tone=True)) == 0


def test_tone_none_scores_100_times_content():
    assert syllable_score(syl(tone=None)) == 100
    assert syllable_score(syl(content=False, tone=None)) == 0


def test_neutral_tone_not_graded_counts_as_none():
    assert score_sentence([syl(), syl(tone=None)], "word") == 100


def test_syllable_mode_is_100_times_tone():
    assert score_sentence([syl(tone=True)], "syllable") == 100
    assert score_sentence([syl(tone=False)], "syllable") == 0
    assert score_sentence([syl(tone=None)], "syllable") == 100  # không chắc → cho đúng


def test_empty_is_zero():
    assert score_sentence([], "sentence") == 0
