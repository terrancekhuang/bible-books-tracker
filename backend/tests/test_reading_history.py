"""Reading history, exercised through its own interface rather than through HTTP.

These call `reading_history.f(user_id, tz_offset)` directly — no Flask app, no test client,
no JWT. What's left is the part that was hard to reach before: the local-calendar rules that
decide a streak, a heatmap cell and a rhythm bucket.
"""

from datetime import datetime, timezone, timedelta

import reading_history


def _utc_at(days_ago: int, hour: int, minute: int = 0) -> datetime:
    """A UTC instant N days back at a fixed wall-clock time.

    Anchored to now rather than a literal date because activity only looks back 365 days
    and streaks are measured relative to today.
    """
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(
        hour=hour, minute=minute, second=0, microsecond=0)


# ── The UTC pin ───────────────────────────────────────────────────────────────
#
# One rule, four readers. Each of these fails if LOCAL_TS stops pinning to UTC first:
# Postgres would resolve logged_at in the session timezone and tz_offset would land on
# top of that shift, so the answer would depend on where the server thinks it is.

class TestLocalCalendarRules:
    def test_activity_date_follows_tz_offset(self, test_user, seed_chapter):
        user_id, _ = test_user
        # 23:30 UTC belongs to that date at UTC, and to the next date one hour east.
        when = _utc_at(days_ago=2, hour=23, minute=30)
        seed_chapter(when, chapter=1)

        def dates(tz_offset):
            return [r['logged_at'] for r in reading_history.activity(user_id, tz_offset)]

        assert dates(0) == [when.date().isoformat()]
        assert dates(60) == [(when.date() + timedelta(days=1)).isoformat()]

    def test_total_days_groups_by_local_day(self, test_user, seed_chapter):
        user_id, _ = test_user
        # 23:30 and 00:30 UTC are two days at UTC, one local day an hour east.
        base = _utc_at(days_ago=3, hour=23, minute=30)
        seed_chapter(base, chapter=1)
        seed_chapter(base + timedelta(hours=1), chapter=2)

        assert reading_history.stats(user_id, 0)['total_days'] == 2
        assert reading_history.stats(user_id, 60)['total_days'] == 1

    def test_best_streak_groups_by_local_day(self, test_user, seed_chapter):
        user_id, _ = test_user
        base = _utc_at(days_ago=3, hour=23, minute=30)
        seed_chapter(base, chapter=1)
        seed_chapter(base + timedelta(hours=1), chapter=2)

        assert reading_history.stats(user_id, 0)['best_streak'] == 2
        assert reading_history.stats(user_id, 60)['best_streak'] == 1

    def test_rhythm_weekday_follows_tz_offset(self, test_user, seed_chapter):
        user_id, _ = test_user
        when = _utc_at(days_ago=10, hour=23, minute=30)
        seed_chapter(when, chapter=1)

        at_utc = reading_history.rhythm(user_id, 0)['all_time']['by_weekday']
        east = reading_history.rhythm(user_id, 60)['all_time']['by_weekday']

        # Monday-first, ISODOW-1. An hour east pushes 23:30 into the next weekday.
        assert at_utc.index(1) == when.weekday()
        assert east.index(1) == (when.weekday() + 1) % 7

    def test_rhythm_part_of_day_follows_tz_offset(self, test_user, seed_chapter):
        user_id, _ = test_user
        # 16:30 UTC is the afternoon; two hours east it is 18:30, the evening.
        seed_chapter(_utc_at(days_ago=10, hour=16, minute=30), chapter=1)

        assert reading_history.rhythm(user_id, 0)['all_time']['by_part_of_day']['afternoon'] == 1
        assert reading_history.rhythm(user_id, 120)['all_time']['by_part_of_day']['evening'] == 1


# ── Streaks ───────────────────────────────────────────────────────────────────

class TestStreaks:
    def test_no_reading_is_no_streak(self, test_user):
        user_id, _ = test_user
        result = reading_history.stats(user_id, 0)
        assert result['current_streak'] == 0
        assert result['best_streak'] == 0

    def test_consecutive_days_form_one_streak(self, test_user, seed_chapter):
        user_id, _ = test_user
        for days_ago in (2, 1, 0):
            seed_chapter(_utc_at(days_ago=days_ago, hour=12), chapter=days_ago + 1)

        result = reading_history.stats(user_id, 0)
        assert result['best_streak'] == 3
        assert result['current_streak'] == 3

    def test_a_gap_breaks_the_streak(self, test_user, seed_chapter):
        user_id, _ = test_user
        for days_ago in (10, 9, 8, 0):
            seed_chapter(_utc_at(days_ago=days_ago, hour=12), chapter=days_ago + 1)

        result = reading_history.stats(user_id, 0)
        assert result['best_streak'] == 3
        assert result['current_streak'] == 1

    def test_yesterday_still_counts_as_current(self, test_user, seed_chapter):
        """A streak is only broken once a whole day has passed without reading."""
        user_id, _ = test_user
        seed_chapter(_utc_at(days_ago=2, hour=12), chapter=1)
        seed_chapter(_utc_at(days_ago=1, hour=12), chapter=2)

        assert reading_history.stats(user_id, 0)['current_streak'] == 2

    def test_two_days_ago_does_not(self, test_user, seed_chapter):
        user_id, _ = test_user
        seed_chapter(_utc_at(days_ago=3, hour=12), chapter=1)
        seed_chapter(_utc_at(days_ago=2, hour=12), chapter=2)

        result = reading_history.stats(user_id, 0)
        assert result['best_streak'] == 2
        assert result['current_streak'] == 0

    def test_many_chapters_in_a_day_is_still_one_day(self, test_user, seed_chapter):
        user_id, _ = test_user
        for chapter in range(1, 11):
            seed_chapter(_utc_at(days_ago=1, hour=12), chapter=chapter)

        result = reading_history.stats(user_id, 0)
        assert result['total_chapters'] == 10
        assert result['total_days'] == 1
        assert result['best_streak'] == 1


# ── Windows ───────────────────────────────────────────────────────────────────

class TestWindows:
    def test_activity_excludes_older_than_a_year(self, test_user, seed_chapter):
        user_id, _ = test_user
        seed_chapter(_utc_at(days_ago=400, hour=12), chapter=1)
        seed_chapter(_utc_at(days_ago=10, hour=12), chapter=2)

        assert len(reading_history.activity(user_id, 0)) == 1

    def test_rhythm_splits_all_time_from_last_90_days(self, test_user, seed_chapter):
        user_id, _ = test_user
        seed_chapter(_utc_at(days_ago=200, hour=12), chapter=1)
        seed_chapter(_utc_at(days_ago=10, hour=12), chapter=2)

        result = reading_history.rhythm(user_id, 0)
        assert result['all_time']['total_chapters'] == 2
        assert result['all_time']['distinct_days'] == 2
        assert result['last_90_days']['total_chapters'] == 1
        assert result['last_90_days']['distinct_days'] == 1

    def test_empty_rhythm_has_both_windows_zeroed(self, test_user):
        user_id, _ = test_user
        result = reading_history.rhythm(user_id, 0)
        for window in ('all_time', 'last_90_days'):
            assert result[window]['by_weekday'] == [0] * 7
            assert result[window]['total_chapters'] == 0
            assert result[window]['distinct_days'] == 0


# ── Bulk session exclusion (rhythm only) ────────────────────────────────────────
#
# A catch-up or import dump shouldn't be able to pass itself off as "when this reader
# reads." reading_history.BULK_SESSION_CHAPTERS / SESSION_GAP_SECONDS control that: chapters
# logged within SESSION_GAP_SECONDS of each other are one session, and any session totalling
# BULK_SESSION_CHAPTERS or more is excluded from rhythm — only that session, not its whole
# calendar day, and not activity/streaks/stats, which still see everything logged.

class TestBulkSessionExclusion:
    def test_single_bulk_event_excluded(self, test_user, seed_chapter):
        user_id, _ = test_user
        when = _utc_at(days_ago=10, hour=12)
        for chapter in range(1, reading_history.BULK_SESSION_CHAPTERS + 1):
            seed_chapter(when, chapter=chapter)

        result = reading_history.rhythm(user_id, 0)['all_time']
        assert result['total_chapters'] == 0
        assert result['distinct_days'] == 0

    def test_small_events_within_gap_merge_into_bulk(self, test_user, seed_chapter):
        user_id, _ = test_user
        first = reading_history.BULK_SESSION_CHAPTERS - 13  # under threshold alone
        second = 13                                         # combined, over threshold
        when = _utc_at(days_ago=10, hour=12)
        gap = timedelta(seconds=reading_history.SESSION_GAP_SECONDS - 5)

        for chapter in range(1, first + 1):
            seed_chapter(when, chapter=chapter, book_id=1)
        for chapter in range(1, second + 1):
            seed_chapter(when + gap, chapter=chapter, book_id=2)

        result = reading_history.rhythm(user_id, 0)['all_time']
        assert first + second >= reading_history.BULK_SESSION_CHAPTERS
        assert result['total_chapters'] == 0

    def test_events_past_the_gap_stay_separate_and_real(self, test_user, seed_chapter):
        user_id, _ = test_user
        each = reading_history.BULK_SESSION_CHAPTERS - 5  # under threshold alone or combined
        when = _utc_at(days_ago=10, hour=12)
        gap = timedelta(seconds=reading_history.SESSION_GAP_SECONDS + 5)

        for chapter in range(1, each + 1):
            seed_chapter(when, chapter=chapter, book_id=1)
        for chapter in range(1, each + 1):
            seed_chapter(when + gap, chapter=chapter, book_id=2)

        result = reading_history.rhythm(user_id, 0)['all_time']
        assert result['total_chapters'] == each * 2

    def test_real_session_survives_a_bulk_session_the_same_day(self, test_user, seed_chapter):
        user_id, _ = test_user
        bulk_at = _utc_at(days_ago=10, hour=9)
        real_at = _utc_at(days_ago=10, hour=20)  # same day, far outside the session gap

        for chapter in range(1, reading_history.BULK_SESSION_CHAPTERS + 1):
            seed_chapter(bulk_at, chapter=chapter, book_id=1)
        seed_chapter(real_at, chapter=1, book_id=2)

        result = reading_history.rhythm(user_id, 0)['all_time']
        assert result['total_chapters'] == 1
        assert result['distinct_days'] == 1


# ── Part of day ───────────────────────────────────────────────────────────────

class TestPartOfDay:
    def test_boundaries(self):
        assert reading_history.part_of_day(5) == 'morning'
        assert reading_history.part_of_day(11) == 'morning'
        assert reading_history.part_of_day(12) == 'afternoon'
        assert reading_history.part_of_day(16) == 'afternoon'
        assert reading_history.part_of_day(17) == 'evening'
        assert reading_history.part_of_day(21) == 'evening'

    def test_night_wraps_midnight(self):
        for hour in (22, 23, 0, 4):
            assert reading_history.part_of_day(hour) == 'night'


# ── Composite ─────────────────────────────────────────────────────────────────

class TestOverview:
    def test_matches_its_parts(self, test_user, seed_chapter):
        user_id, _ = test_user
        seed_chapter(_utc_at(days_ago=1, hour=12), chapter=1)

        result = reading_history.overview(user_id, 0)
        assert result['stats'] == reading_history.stats(user_id, 0)
        assert result['activity'] == reading_history.activity(user_id, 0)
