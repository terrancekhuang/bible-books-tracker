"""What a reader's logged chapters add up to: activity, stats and rhythm.

Every function here takes `(user_id, tz_offset)` and returns plain data. Callers do not
hold a cursor, a connection or a transaction — this module opens and releases its own.

`tz_offset` is minutes east of UTC (`-getTimezoneOffset()` on the client).
"""

from datetime import datetime, timezone, timedelta
from db import db_cursor


# The one rule every query below depends on.
#
# `logged_at` is TIMESTAMPTZ. Casting one to ::date, or running EXTRACT on it, resolves it
# in the *session* timezone first — so `tz_offset` would land on top of wherever the server
# happens to think it is, silently reshaping the heatmap, streaks and rhythm for any session
# that isn't UTC. Pinning to UTC makes the offset the only shift that applies.
#
# Interpolated rather than retyped so the rule has exactly one definition. It consumes the
# named parameter `tz`, which is why every query in this module binds by name: the fragment
# can then appear as many times as a query needs it without any positional bookkeeping.
LOCAL_TS = "((logged_at AT TIME ZONE 'UTC') + INTERVAL '1 minute' * %(tz)s)"

ACTIVITY_WINDOW_DAYS = 365
RECENT_WINDOW_DAYS = 90


# ── Activity ──────────────────────────────────────────────────────────────────

def _activity(cur, user_id: int, tz_offset: int) -> list[dict]:
    cutoff_utc = datetime.now(timezone.utc) - timedelta(days=ACTIVITY_WINDOW_DAYS)
    cur.execute(f"""
        SELECT {LOCAL_TS}::date AS local_date, COUNT(*) AS chapters
        FROM chapter_progress
        WHERE user_id = %(user)s AND logged_at >= %(cutoff)s
        GROUP BY local_date
        ORDER BY local_date
    """, {'tz': tz_offset, 'user': user_id, 'cutoff': cutoff_utc})
    return [
        {'logged_at': r['local_date'].isoformat(), 'chapters': r['chapters']}
        for r in cur.fetchall()
    ]


def activity(user_id: int, tz_offset: int) -> list[dict]:
    """Chapters per local day over the last year — one entry per day that has any."""
    with db_cursor() as (_conn, cur):
        return _activity(cur, user_id, tz_offset)


# ── Stats ─────────────────────────────────────────────────────────────────────

def _stats(cur, user_id: int, tz_offset: int) -> dict:
    local_now = datetime.now(timezone.utc) + timedelta(minutes=tz_offset)
    local_today = local_now.date()
    today_start_utc = datetime(local_today.year, local_today.month, local_today.day,
                               tzinfo=timezone.utc) - timedelta(minutes=tz_offset)
    today_end_utc = today_start_utc + timedelta(days=1)
    week_start_date = local_today - timedelta(days=local_today.weekday())
    week_start_utc = datetime(week_start_date.year, week_start_date.month, week_start_date.day,
                              tzinfo=timezone.utc) - timedelta(minutes=tz_offset)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    cur.execute(f"""
        SELECT
            COUNT(*) AS total_chapters,
            COUNT(DISTINCT {LOCAL_TS}::date) AS total_days,
            COUNT(*) FILTER (
                WHERE logged_at >= %(today_start)s AND logged_at < %(today_end)s
            ) AS chapters_today,
            COUNT(*) FILTER (WHERE logged_at >= %(week_start)s) AS chapters_this_week,
            COUNT(*) FILTER (WHERE logged_at >= %(seven_days_ago)s) AS chapters_last_7_days
        FROM chapter_progress
        WHERE user_id = %(user)s
    """, {
        'tz': tz_offset, 'user': user_id,
        'today_start': today_start_utc, 'today_end': today_end_utc,
        'week_start': week_start_utc, 'seven_days_ago': seven_days_ago,
    })
    agg = cur.fetchone()

    # Consecutive local days collapse to a constant when you subtract the row number from
    # the date, so grouping by that constant gives one group per streak.
    cur.execute(f"""
        WITH local_dates AS (
            SELECT DISTINCT {LOCAL_TS}::date AS read_date
            FROM chapter_progress WHERE user_id = %(user)s
        ),
        dates AS (
            SELECT read_date,
                   (read_date - (ROW_NUMBER() OVER (ORDER BY read_date) || ' days')::interval)::date AS grp
            FROM local_dates
        ),
        streaks AS (
            SELECT COUNT(*) AS length, MAX(read_date) AS last_day
            FROM dates GROUP BY grp
        )
        SELECT
            MAX(length) AS best_streak,
            -- Yesterday still counts: a streak is only broken once a whole day passes.
            (SELECT length FROM streaks
             WHERE last_day >= %(today)s - INTERVAL '1 day'
             ORDER BY last_day DESC LIMIT 1) AS current_streak
        FROM streaks
    """, {'tz': tz_offset, 'user': user_id, 'today': local_today})
    streak_row = cur.fetchone()

    return {
        'total_chapters': int(agg['total_chapters']),
        'total_days': int(agg['total_days']),
        'best_streak': int(streak_row['best_streak'] or 0),
        'current_streak': int(streak_row['current_streak'] or 0),
        'chapters_today': int(agg['chapters_today']),
        'chapters_this_week': int(agg['chapters_this_week']),
        'chapters_last_7_days': int(agg['chapters_last_7_days']),
    }


def stats(user_id: int, tz_offset: int) -> dict:
    """Streaks and totals, all measured against the reader's local calendar."""
    with db_cursor() as (_conn, cur):
        return _stats(cur, user_id, tz_offset)


# ── Rhythm ────────────────────────────────────────────────────────────────────

# Which part of the day each local hour belongs to. Night wraps midnight, so it's the
# fallback rather than a range: hours 22-23 and 0-4 both land there.
_PARTS_OF_DAY = (
    ('morning', range(5, 12)),
    ('afternoon', range(12, 17)),
    ('evening', range(17, 22)),
)


def part_of_day(hour: int) -> str:
    for name, hours in _PARTS_OF_DAY:
        if hour in hours:
            return name
    return 'night'


def _empty_window() -> dict:
    return {
        'by_weekday': [0] * 7,
        'by_part_of_day': {'morning': 0, 'afternoon': 0, 'evening': 0, 'night': 0},
        'total_chapters': 0,
        'distinct_days': 0,
    }


def _rhythm(cur, user_id: int, tz_offset: int) -> dict:
    recent_cutoff_utc = datetime.now(timezone.utc) - timedelta(days=RECENT_WINDOW_DAYS)
    params = {'tz': tz_offset, 'user': user_id, 'cutoff': recent_cutoff_utc}
    windows = {'all_time': _empty_window(), 'last_90_days': _empty_window()}

    # Grouping by (weekday, hour, recent) caps this at 7 * 24 * 2 rows, so one scan
    # serves both windows and the bucketing happens over a handful of rows in Python.
    cur.execute(f"""
        SELECT EXTRACT(ISODOW FROM {LOCAL_TS})::int AS weekday,
               EXTRACT(HOUR  FROM {LOCAL_TS})::int  AS hour,
               (logged_at >= %(cutoff)s)            AS recent,
               COUNT(*)                             AS chapters
        FROM chapter_progress
        WHERE user_id = %(user)s
        GROUP BY weekday, hour, recent
    """, params)

    for row in cur.fetchall():
        chapters = int(row['chapters'])
        part = part_of_day(int(row['hour']))
        # ISODOW is Monday=1..Sunday=7, so weekday-1 indexes a Monday-first list directly.
        weekday_index = int(row['weekday']) - 1
        targets = [windows['all_time']] + ([windows['last_90_days']] if row['recent'] else [])
        for target in targets:
            target['by_weekday'][weekday_index] += chapters
            target['by_part_of_day'][part] += chapters
            target['total_chapters'] += chapters

    # Distinct local dates, not row counts — a 10-chapter day is one day. Kept separate
    # because it can't be summed out of the grouped counts above.
    cur.execute(f"""
        SELECT COUNT(DISTINCT {LOCAL_TS}::date) AS all_days,
               COUNT(DISTINCT {LOCAL_TS}::date)
                   FILTER (WHERE logged_at >= %(cutoff)s) AS recent_days
        FROM chapter_progress
        WHERE user_id = %(user)s
    """, params)
    days = cur.fetchone()
    windows['all_time']['distinct_days'] = int(days['all_days'] or 0)
    windows['last_90_days']['distinct_days'] = int(days['recent_days'] or 0)

    return windows


def rhythm(user_id: int, tz_offset: int) -> dict:
    """When the reader reads: chapters by local weekday and part of day, for two windows.

    Both windows come back in one payload so the Reading Rhythm toggle can switch between
    them without a refetch. `logged_at` records when a chapter was *logged*, not when it was
    read — the weekday signal survives batched logging, the part-of-day signal is softer.
    """
    with db_cursor() as (_conn, cur):
        return _rhythm(cur, user_id, tz_offset)


# ── Composite ─────────────────────────────────────────────────────────────────

def overview(user_id: int, tz_offset: int) -> dict:
    """Stats and activity together, over a single connection — what the Dashboard loads."""
    with db_cursor() as (_conn, cur):
        return {
            'stats': _stats(cur, user_id, tz_offset),
            'activity': _activity(cur, user_id, tz_offset),
        }
