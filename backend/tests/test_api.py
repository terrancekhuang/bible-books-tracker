from unittest.mock import patch
from datetime import datetime, timezone, timedelta
import psycopg2
import os


def _utc_at(days_ago: int, hour: int, minute: int = 0) -> datetime:
    """A UTC instant N days back at a fixed wall-clock time.

    Anchored to now rather than a literal date because /api/activity only looks back
    365 days and /api/stats' streaks are measured relative to today.
    """
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(
        hour=hour, minute=minute, second=0, microsecond=0)


# ── Auth ──────────────────────────────────────────────────────────────────────

class TestGoogleAuth:
    def test_missing_credential_returns_400(self, client):
        resp = client.post('/auth/google', json={})
        assert resp.status_code == 400

    def test_invalid_token_returns_401(self, client):
        with patch('routes.id_token.verify_oauth2_token', side_effect=ValueError('bad')):
            resp = client.post('/auth/google', json={'credential': 'fake'})
        assert resp.status_code == 401

    def test_valid_token_creates_user_and_returns_jwt(self, client, flask_app):
        unique_google_id = 'auth_test_temp_google_id_42'
        with patch('routes.id_token.verify_oauth2_token', return_value={
            'sub': unique_google_id,
            'email': 'auth_temp@example.com',
            'name': 'Auth Temp',
            'picture': '',
        }):
            resp = client.post('/auth/google', json={'credential': 'valid'})

        assert resp.status_code == 200
        data = resp.get_json()
        assert 'access_token' in data
        assert 'user_id' in data

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE google_id = %s", (unique_google_id,))
        conn.commit()
        cur.close()
        conn.close()


class TestAuthMe:
    def test_returns_user_profile(self, client, auth_headers, test_user):
        user_id, _ = test_user
        resp = client.get('/auth/me', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['user_id'] == user_id
        assert data['email'] == 'pytest_fixture_user@example.com'

    def test_requires_auth(self, client):
        resp = client.get('/auth/me')
        assert resp.status_code == 401


# ── Books ─────────────────────────────────────────────────────────────────────

class TestGetBooks:
    def test_returns_66_books(self, client, auth_headers):
        resp = client.get('/api/books', headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) == 66

    def test_book_has_required_fields(self, client, auth_headers):
        book = client.get('/api/books', headers=auth_headers).get_json()[0]
        for field in ('book_id', 'name', 'testament', 'category', 'num_chapters',
                      'chapters_read', 'chapters_read_list', 'last_read_at'):
            assert field in book

    def test_new_user_has_zero_chapters_read_for_all_books(self, client, auth_headers):
        books = client.get('/api/books', headers=auth_headers).get_json()
        assert all(b['chapters_read'] == 0 for b in books)

    def test_requires_auth(self, client):
        assert client.get('/api/books').status_code == 401


# ── Progress ──────────────────────────────────────────────────────────────────

class TestUpdateProgress:
    def test_logs_chapters_and_returns_correct_counts(self, client, auth_headers):
        resp = client.post('/api/progress', headers=auth_headers,
                           json={'book_name': 'Genesis', 'chapters': [1, 2, 3]})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['chapters_read'] == 3
        assert data['newly_logged'] == 3
        assert data['chapters_read_list'] == [1, 2, 3]

    def test_deduplicates_chapters_on_resubmit(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1, 2]})
        resp = client.post('/api/progress', headers=auth_headers,
                           json={'book_name': 'Genesis', 'chapters': [2, 3]})
        data = resp.get_json()
        assert data['chapters_read'] == 3
        assert data['newly_logged'] == 1

    def test_unknown_book_returns_404(self, client, auth_headers):
        resp = client.post('/api/progress', headers=auth_headers,
                           json={'book_name': 'NotABook', 'chapters': [1]})
        assert resp.status_code == 404

    def test_out_of_range_chapters_are_filtered(self, client, auth_headers):
        # Genesis has 50 chapters; 0 and 51 should be silently dropped
        resp = client.post('/api/progress', headers=auth_headers,
                           json={'book_name': 'Genesis', 'chapters': [0, 1, 51]})
        data = resp.get_json()
        assert data['chapters_read'] == 1
        assert data['chapters_read_list'] == [1]

    def test_all_invalid_chapters_returns_400(self, client, auth_headers):
        resp = client.post('/api/progress', headers=auth_headers,
                           json={'book_name': 'Genesis', 'chapters': [0, 51]})
        assert resp.status_code == 400

    def test_progress_reflected_in_books_list(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1, 2]})
        books = client.get('/api/books', headers=auth_headers).get_json()
        genesis = next(b for b in books if b['name'] == 'Genesis')
        assert genesis['chapters_read'] == 2
        assert genesis['chapters_read_list'] == [1, 2]

    def test_requires_auth(self, client):
        resp = client.post('/api/progress', json={'book_name': 'Genesis', 'chapters': [1]})
        assert resp.status_code == 401


class TestUndoProgress:
    def test_removes_the_latest_logged_batch(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1, 2, 3]})
        resp = client.post('/api/progress/undo', headers=auth_headers,
                           json={'book_name': 'Genesis'})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['success'] is True
        assert data['chapters_read'] == 0

    def test_nothing_to_undo_returns_400(self, client, auth_headers):
        resp = client.post('/api/progress/undo', headers=auth_headers,
                           json={'book_name': 'Genesis'})
        assert resp.status_code == 400

    def test_unknown_book_returns_404(self, client, auth_headers):
        resp = client.post('/api/progress/undo', headers=auth_headers,
                           json={'book_name': 'NotABook'})
        assert resp.status_code == 404

    def test_requires_auth(self, client):
        assert client.post('/api/progress/undo', json={'book_name': 'Genesis'}).status_code == 401


# ── Cycles ────────────────────────────────────────────────────────────────────

class TestCycles:
    def test_get_cycles_returns_initial_cycle(self, client, auth_headers):
        resp = client.get('/api/cycles', headers=auth_headers)
        assert resp.status_code == 200
        cycles = resp.get_json()
        assert any(c['cycle_number'] == 1 for c in cycles)

    def test_create_cycle_increments_cycle_number(self, client, auth_headers):
        resp = client.post('/api/cycles', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['cycle_number'] == 2

    def test_cycle_chapters_read_reflects_progress(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1]})
        cycles = client.get('/api/cycles', headers=auth_headers).get_json()
        cycle1 = next(c for c in cycles if c['cycle_number'] == 1)
        assert cycle1['chapters_read'] == 1

    def test_requires_auth(self, client):
        assert client.get('/api/cycles').status_code == 401


# ── Stats ─────────────────────────────────────────────────────────────────────

class TestStats:
    def test_returns_all_expected_fields(self, client, auth_headers):
        resp = client.get('/api/stats', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        for key in ('total_chapters', 'total_days', 'current_streak', 'best_streak',
                    'chapters_today', 'chapters_this_week'):
            assert key in data

    def test_new_user_has_all_zero_stats(self, client, auth_headers):
        data = client.get('/api/stats', headers=auth_headers).get_json()
        assert data['total_chapters'] == 0
        assert data['current_streak'] == 0
        assert data['chapters_today'] == 0

    def test_stats_update_after_progress(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1, 2]})
        data = client.get('/api/stats', headers=auth_headers).get_json()
        assert data['total_chapters'] == 2
        assert data['chapters_today'] == 2
        assert data['current_streak'] == 1

    # logged_at is TIMESTAMPTZ, so grouping it by local day must pin the base to UTC first.
    # Without that, Postgres resolves the timestamp in the *session* timezone and tz_offset
    # lands on top of that shift — making the answer depend on where the server happens to be.
    def test_total_days_groups_by_local_day_not_session_timezone(self, client, auth_headers, seed_chapter):
        # 23:30 and 00:30 UTC are two days at UTC, but a single local day one hour east.
        base = _utc_at(days_ago=3, hour=23, minute=30)
        seed_chapter(base, chapter=1)
        seed_chapter(base + timedelta(hours=1), chapter=2)

        def total_days(tz_offset):
            data = client.get(f'/api/stats?tz_offset={tz_offset}', headers=auth_headers).get_json()
            return data['total_days']

        assert total_days(0) == 2
        assert total_days(60) == 1

    def test_best_streak_groups_by_local_day_not_session_timezone(self, client, auth_headers, seed_chapter):
        # Same two rows: consecutive local days at UTC (a 2-day streak), one day an hour east.
        base = _utc_at(days_ago=3, hour=23, minute=30)
        seed_chapter(base, chapter=1)
        seed_chapter(base + timedelta(hours=1), chapter=2)

        def best_streak(tz_offset):
            data = client.get(f'/api/stats?tz_offset={tz_offset}', headers=auth_headers).get_json()
            return data['best_streak']

        assert best_streak(0) == 2
        assert best_streak(60) == 1

    def test_requires_auth(self, client):
        assert client.get('/api/stats').status_code == 401


# ── Activity ──────────────────────────────────────────────────────────────────

class TestActivity:
    def test_returns_empty_list_for_new_user(self, client, auth_headers):
        resp = client.get('/api/activity', headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_returns_one_entry_after_progress(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1]})
        data = client.get('/api/activity', headers=auth_headers).get_json()
        assert len(data) == 1
        assert data[0]['chapters'] == 1
        assert 'logged_at' in data[0]

    # See the note on TestStats: the local-day grouping must not depend on the session
    # timezone. The heatmap is the most visible casualty when it does.
    def test_local_date_follows_tz_offset_not_session_timezone(self, client, auth_headers, seed_chapter):
        # 23:30 UTC belongs to that date at UTC, and to the next date one hour east.
        when = _utc_at(days_ago=2, hour=23, minute=30)
        seed_chapter(when, chapter=1)

        def dates(tz_offset):
            data = client.get(f'/api/activity?tz_offset={tz_offset}', headers=auth_headers).get_json()
            return [row['logged_at'] for row in data]

        assert dates(0) == [when.date().isoformat()]
        assert dates(60) == [(when.date() + timedelta(days=1)).isoformat()]

    def test_requires_auth(self, client):
        assert client.get('/api/activity').status_code == 401


# ── Settings ──────────────────────────────────────────────────────────────────

class TestSettings:
    def test_get_returns_default_weekly_goal(self, client, auth_headers):
        resp = client.get('/api/settings', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'weekly_goal' in data
        assert isinstance(data['weekly_goal'], int)

    def test_update_weekly_goal(self, client, auth_headers):
        resp = client.put('/api/settings', headers=auth_headers,
                          json={'weekly_goal': 5})
        assert resp.status_code == 200
        assert resp.get_json()['weekly_goal'] == 5

    def test_get_reflects_updated_goal(self, client, auth_headers):
        client.put('/api/settings', headers=auth_headers, json={'weekly_goal': 3})
        data = client.get('/api/settings', headers=auth_headers).get_json()
        assert data['weekly_goal'] == 3

    def test_update_rejects_zero(self, client, auth_headers):
        assert client.put('/api/settings', headers=auth_headers,
                          json={'weekly_goal': 0}).status_code == 400

    def test_update_rejects_non_integer(self, client, auth_headers):
        assert client.put('/api/settings', headers=auth_headers,
                          json={'weekly_goal': 'five'}).status_code == 400

    def test_update_rejects_boolean(self, client, auth_headers):
        # True is an int subclass in Python; the route guards against this
        assert client.put('/api/settings', headers=auth_headers,
                          json={'weekly_goal': True}).status_code == 400

    def test_requires_auth(self, client):
        assert client.get('/api/settings').status_code == 401


# ── Rhythm ────────────────────────────────────────────────────────────────────

# 2024-01-01 was a Monday, so index 0 of by_weekday. Anchoring on a known weekday keeps
# the expected index in these tests obvious rather than computed.
MONDAY = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)


def _rhythm(client, auth_headers, tz_offset=0):
    resp = client.get(f'/api/rhythm?tz_offset={tz_offset}', headers=auth_headers)
    assert resp.status_code == 200
    return resp.get_json()


class TestRhythm:
    def test_returns_both_windows_with_expected_shape(self, client, auth_headers):
        data = _rhythm(client, auth_headers)
        assert set(data) == {'all_time', 'last_90_days'}
        for window in data.values():
            assert len(window['by_weekday']) == 7
            assert set(window['by_part_of_day']) == {'morning', 'afternoon', 'evening', 'night'}
            assert 'total_chapters' in window and 'distinct_days' in window

    def test_new_user_is_all_zeros(self, client, auth_headers):
        for window in _rhythm(client, auth_headers).values():
            assert window['by_weekday'] == [0] * 7
            assert sum(window['by_part_of_day'].values()) == 0
            assert window['total_chapters'] == 0
            assert window['distinct_days'] == 0

    def test_counts_land_on_the_local_weekday(self, client, auth_headers, seed_chapter):
        seed_chapter(MONDAY, chapter=1)
        seed_chapter(MONDAY + timedelta(days=2), chapter=2)  # Wednesday

        window = _rhythm(client, auth_headers)['all_time']
        assert window['by_weekday'] == [1, 0, 1, 0, 0, 0, 0]
        assert window['total_chapters'] == 2

    def test_tz_offset_shifts_a_late_entry_into_the_next_day(self, client, auth_headers, seed_chapter):
        # 23:30 UTC Monday is still Monday at UTC, but 00:30 Tuesday an hour east.
        seed_chapter(MONDAY.replace(hour=23, minute=30), chapter=1)

        assert _rhythm(client, auth_headers, tz_offset=0)['all_time']['by_weekday'] == [1, 0, 0, 0, 0, 0, 0]
        assert _rhythm(client, auth_headers, tz_offset=60)['all_time']['by_weekday'] == [0, 1, 0, 0, 0, 0, 0]

    def test_buckets_hours_into_parts_of_day(self, client, auth_headers, seed_chapter):
        for chapter, hour in enumerate([8, 14, 19, 23, 2], start=1):
            seed_chapter(MONDAY.replace(hour=hour), chapter=chapter)

        parts = _rhythm(client, auth_headers)['all_time']['by_part_of_day']
        # 23:00 and 02:00 both belong to night, which wraps midnight.
        assert parts == {'morning': 1, 'afternoon': 1, 'evening': 1, 'night': 2}

    def test_recent_window_excludes_older_entries(self, client, auth_headers, seed_chapter):
        now = datetime.now(timezone.utc)
        seed_chapter(now - timedelta(days=200), chapter=1)
        seed_chapter(now - timedelta(days=1), chapter=2)

        data = _rhythm(client, auth_headers)
        assert data['all_time']['total_chapters'] == 2
        assert data['last_90_days']['total_chapters'] == 1

    def test_distinct_days_counts_dates_not_rows(self, client, auth_headers, seed_chapter):
        seed_chapter(MONDAY.replace(hour=9), chapter=1)
        seed_chapter(MONDAY.replace(hour=21), chapter=2)  # same local day
        seed_chapter(MONDAY + timedelta(days=1), chapter=3)

        window = _rhythm(client, auth_headers)['all_time']
        assert window['total_chapters'] == 3
        assert window['distinct_days'] == 2

    def test_weekday_counts_sum_to_total_chapters(self, client, auth_headers, seed_chapter):
        for chapter in range(1, 6):
            seed_chapter(MONDAY + timedelta(days=chapter), chapter=chapter)

        window = _rhythm(client, auth_headers)['all_time']
        assert sum(window['by_weekday']) == window['total_chapters']
        assert sum(window['by_part_of_day'].values()) == window['total_chapters']

    def test_requires_auth(self, client):
        assert client.get('/api/rhythm').status_code == 401
