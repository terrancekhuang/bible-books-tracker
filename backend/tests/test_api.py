from unittest.mock import patch
from datetime import datetime, timezone, timedelta
import psycopg2
import os


def _utc_at(days_ago: int, hour: int, minute: int = 0) -> datetime:
    """A UTC instant N days back at a fixed wall-clock time.

    Anchored to now rather than a literal date because the heatmap's activity only looks back
    365 days and the streaks are measured relative to today.
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


class TestGuestAuth:
    def test_creates_a_guest_who_can_log_and_read_progress(self, client):
        resp = client.post('/auth/guest')
        assert resp.status_code == 200
        data = resp.get_json()
        headers = {'Authorization': f"Bearer {data['access_token']}"}
        try:
            logged = client.post('/api/progress', json={'book_name': 'Ruth', 'chapters': [1, 2]}, headers=headers)
            assert logged.get_json()['chapters_read'] == 2
            ruth = next(b for b in client.get('/api/books', headers=headers).get_json() if b['name'] == 'Ruth')
            assert ruth['chapters_read'] == 2
            assert client.get('/api/dashboard', headers=headers).get_json()['weekly_goal'] == 7
        finally:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute("DELETE FROM users WHERE user_id = %s", (data['user_id'],))
            conn.commit()
            cur.close()
            conn.close()

    def test_guest_token_never_expires_and_is_marked_guest(self, client, flask_app):
        from flask_jwt_extended import decode_token
        data = client.post('/auth/guest').get_json()
        try:
            with flask_app.app_context():
                claims = decode_token(data['access_token'])
            assert 'exp' not in claims
            assert claims['guest'] is True
        finally:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute("DELETE FROM users WHERE user_id = %s", (data['user_id'],))
            conn.commit()
            cur.close()
            conn.close()


class TestGuestSignIn:
    """Signing in with a guest's token keeps the guest's progress."""

    def _sign_in(self, client, google_id, headers=None):
        with patch('routes.id_token.verify_oauth2_token', return_value={
            'sub': google_id, 'email': f'{google_id}@example.com', 'name': 'Signed In', 'picture': '',
        }):
            return client.post('/auth/google', json={'credential': 'valid'}, headers=headers)

    def _guest_with(self, client, book, chapters):
        data = client.post('/auth/guest').get_json()
        headers = {'Authorization': f"Bearer {data['access_token']}"}
        client.post('/api/progress', json={'book_name': book, 'chapters': chapters}, headers=headers)
        return data['user_id'], headers

    def _chapters(self, client, token, book):
        books = client.get('/api/books', headers={'Authorization': f'Bearer {token}'}).get_json()
        return next(b for b in books if b['name'] == book)['chapters_read_list']

    def _delete(self, *google_ids_or_user_ids):
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        for x in google_ids_or_user_ids:
            col = 'user_id' if isinstance(x, int) else 'google_id'
            cur.execute(f"DELETE FROM users WHERE {col} = %s", (x,))
        conn.commit()
        cur.close()
        conn.close()

    def test_new_google_account_takes_over_the_guest(self, client):
        guest_id, headers = self._guest_with(client, 'Ruth', [1, 2])
        try:
            data = self._sign_in(client, 'guest_upgrade_gid', headers).get_json()
            assert data['user_id'] == guest_id
            assert data['from_guest'] == 'upgraded'
            assert self._chapters(client, data['access_token'], 'Ruth') == [1, 2]
            me = client.get('/auth/me', headers={'Authorization': f"Bearer {data['access_token']}"}).get_json()
            assert me['name'] == 'Signed In'
        finally:
            self._delete(guest_id)

    def test_existing_account_gets_the_guests_chapters_merged_in(self, client):
        account = self._sign_in(client, 'guest_merge_gid').get_json()
        guest_id, headers = self._guest_with(client, 'Ruth', [2, 3])
        try:
            client.post('/api/progress', json={'book_name': 'Ruth', 'chapters': [1, 2]},
                        headers={'Authorization': f"Bearer {account['access_token']}"})
            data = self._sign_in(client, 'guest_merge_gid', headers).get_json()
            assert data['user_id'] == account['user_id']
            assert data['from_guest'] == 'merged'
            assert data['chapters_added'] == 1  # chapter 2 was already read on the account
            assert self._chapters(client, data['access_token'], 'Ruth') == [1, 2, 3]

            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM users WHERE user_id = %s", (guest_id,))
            assert cur.fetchone() is None
            cur.close()
            conn.close()
        finally:
            self._delete('guest_merge_gid', guest_id)

    def test_signed_in_token_is_not_treated_as_a_guest(self, client, auth_headers, test_user):
        data = self._sign_in(client, 'not_a_guest_gid', auth_headers).get_json()
        try:
            assert data['from_guest'] is None
            assert data['user_id'] != test_user[0]
        finally:
            self._delete('not_a_guest_gid')


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


class TestSessionRefresh:
    """A signed-in token over a day old comes back renewed in X-Access-Token."""

    def test_fresh_token_is_not_renewed(self, client, flask_app, test_user):
        from flask_jwt_extended import create_access_token
        with flask_app.app_context():
            token = create_access_token(identity=str(test_user[0]))
        resp = client.get('/api/books', headers={'Authorization': f'Bearer {token}'})
        assert 'X-Access-Token' not in resp.headers

    def test_day_old_token_is_renewed_for_30_days(self, client, flask_app, test_user):
        from flask_jwt_extended import create_access_token, decode_token
        with flask_app.app_context():
            token = create_access_token(identity=str(test_user[0]), expires_delta=timedelta(days=28))
        resp = client.get('/api/books', headers={'Authorization': f'Bearer {token}'})
        with flask_app.app_context():
            claims = decode_token(resp.headers['X-Access-Token'])
        assert claims['sub'] == str(test_user[0])
        assert claims['exp'] - datetime.now(timezone.utc).timestamp() > timedelta(days=29).total_seconds()

    def test_guest_and_visitor_get_no_token(self, client):
        assert 'X-Access-Token' not in client.get('/api/books').headers
        data = client.post('/auth/guest').get_json()
        try:
            resp = client.get('/api/books', headers={'Authorization': f"Bearer {data['access_token']}"})
            assert 'X-Access-Token' not in resp.headers
        finally:
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            cur.execute("DELETE FROM users WHERE user_id = %s", (data['user_id'],))
            conn.commit()
            cur.close()
            conn.close()


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

    def test_visitor_sees_every_book_at_zero(self, client):
        resp = client.get('/api/books')
        assert resp.status_code == 200
        books = resp.get_json()
        assert len(books) == 66
        assert all(b['chapters_read'] == 0 for b in books)


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

    def test_last_entry_names_what_undo_would_remove(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1, 2]})
        second = client.post('/api/progress', headers=auth_headers,
                             json={'book_name': 'Genesis', 'chapters': [2, 3, 4]}).get_json()
        # Chapter 2 was already logged, so only 3 and 4 belong to the second entry.
        assert second['last_entry'] == [3, 4]
        books = client.get('/api/books', headers=auth_headers).get_json()
        assert next(b for b in books if b['name'] == 'Genesis')['last_entry'] == [3, 4]

        undone = client.post('/api/progress/undo', headers=auth_headers,
                             json={'book_name': 'Genesis'}).get_json()
        assert undone['chapters_read_list'] == [1, 2]
        assert undone['last_entry'] == [1, 2]

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

    def test_visitor_has_no_cycles(self, client):
        resp = client.get('/api/cycles')
        assert resp.status_code == 200
        assert resp.get_json() == []


# ── Stats ─────────────────────────────────────────────────────────────────────
#
# Stats only reach the client inside /api/dashboard.

def _stats(client, headers, tz_offset=0):
    return client.get(f'/api/dashboard?tz_offset={tz_offset}', headers=headers).get_json()['stats']


class TestStats:
    def test_returns_all_expected_fields(self, client, auth_headers):
        data = _stats(client, auth_headers)
        for key in ('total_chapters', 'total_days', 'current_streak', 'best_streak',
                    'chapters_today', 'chapters_this_week'):
            assert key in data

    def test_new_user_has_all_zero_stats(self, client, auth_headers):
        data = _stats(client, auth_headers)
        assert data['total_chapters'] == 0
        assert data['current_streak'] == 0
        assert data['chapters_today'] == 0

    def test_stats_update_after_progress(self, client, auth_headers):
        client.post('/api/progress', headers=auth_headers,
                    json={'book_name': 'Genesis', 'chapters': [1, 2]})
        data = _stats(client, auth_headers)
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
            return _stats(client, auth_headers, tz_offset)['total_days']

        assert total_days(0) == 2
        assert total_days(60) == 1

    def test_best_streak_groups_by_local_day_not_session_timezone(self, client, auth_headers, seed_chapter):
        # Same two rows: consecutive local days at UTC (a 2-day streak), one day an hour east.
        base = _utc_at(days_ago=3, hour=23, minute=30)
        seed_chapter(base, chapter=1)
        seed_chapter(base + timedelta(hours=1), chapter=2)

        def best_streak(tz_offset):
            return _stats(client, auth_headers, tz_offset)['best_streak']

        assert best_streak(0) == 2
        assert best_streak(60) == 1


# ── Settings ──────────────────────────────────────────────────────────────────

class TestSettings:
    def test_update_weekly_goal(self, client, auth_headers):
        resp = client.put('/api/settings', headers=auth_headers,
                          json={'weekly_goal': 5})
        assert resp.status_code == 200
        assert resp.get_json()['weekly_goal'] == 5

    def test_get_reflects_updated_goal(self, client, auth_headers):
        client.put('/api/settings', headers=auth_headers, json={'weekly_goal': 3})
        data = client.get('/api/dashboard', headers=auth_headers).get_json()
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
        assert client.put('/api/settings', json={'weekly_goal': 5}).status_code == 401


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
        assert set(data) == {'all_time', 'last_90_days', 'this_month'}
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

    def test_this_month_window_excludes_entries_from_before_the_local_month(self, client, auth_headers, seed_chapter):
        now = datetime.now(timezone.utc)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        seed_chapter(first_of_month - timedelta(days=1), chapter=1)
        seed_chapter(now, chapter=2)

        data = _rhythm(client, auth_headers)
        assert data['this_month']['total_chapters'] == 1
        assert data['this_month']['total_chapters'] <= data['last_90_days']['total_chapters']

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

    def test_visitor_is_all_zeros(self, client):
        resp = client.get('/api/rhythm')
        assert resp.status_code == 200
        assert resp.get_json()['all_time']['total_chapters'] == 0


# ── Dashboard ─────────────────────────────────────────────────────────────────
#
# The one endpoint that composes rather than delegating: reading history plus the two
# user fields the nav bar needs, in a single request.

class TestDashboard:
    def test_returns_stats_activity_goal_and_user(self, client, auth_headers):
        resp = client.get('/api/dashboard', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert set(data) == {'stats', 'activity', 'weekly_goal', 'user'}
        assert set(data['user']) == {'name', 'picture_url'}
        assert isinstance(data['weekly_goal'], int)
        assert isinstance(data['activity'], list)

    def test_tz_offset_reaches_the_embedded_activity(self, client, auth_headers, seed_chapter):
        when = datetime.now(timezone.utc).replace(hour=23, minute=30) - timedelta(days=2)
        seed_chapter(when, chapter=1)

        def dates(tz_offset):
            data = client.get(f'/api/dashboard?tz_offset={tz_offset}', headers=auth_headers).get_json()
            return [row['logged_at'] for row in data['activity']]

        assert dates(0) == [when.date().isoformat()]
        assert dates(60) == [(when.date() + timedelta(days=1)).isoformat()]

    def test_visitor_gets_the_empty_dashboard(self, client):
        resp = client.get('/api/dashboard')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['stats']['total_chapters'] == 0
        assert data['activity'] == []
        assert data['weekly_goal'] == 7
        assert data['user'] == {'name': None, 'picture_url': None}

    def test_an_invalid_token_is_still_rejected(self, client):
        # Optional auth only lets a *missing* token through; a bad one still ends the session.
        resp = client.get('/api/dashboard', headers={'Authorization': 'Bearer not-a-jwt'})
        assert resp.status_code in (401, 422)


# ── Your data ─────────────────────────────────────────────────────────────────

def _sql(query, params=()):
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall() if cur.description else None
    conn.commit()
    cur.close()
    conn.close()
    return rows


class TestExport:
    def test_every_logged_chapter_as_csv(self, client, auth_headers, seed_chapter):
        seed_chapter(_utc_at(2, 9), chapter=3)
        seed_chapter(_utc_at(1, 9), chapter=1, book_id=2)
        resp = client.get('/api/export', headers=auth_headers)
        assert resp.status_code == 200
        assert resp.mimetype == 'text/csv'
        assert 'attachment' in resp.headers['Content-Disposition']
        lines = resp.get_data(as_text=True).strip().splitlines()
        assert lines[0] == 'cycle,book,chapter,logged_at'
        assert [line.split(',')[:3] for line in lines[1:]] == [['1', 'Genesis', '3'], ['1', 'Exodus', '1']]

    def test_requires_auth(self, client):
        assert client.get('/api/export').status_code == 401


class TestDeleteAccount:
    def test_deletes_the_user_and_their_progress_and_retires_the_token(self, client, flask_app):
        from flask_jwt_extended import create_access_token
        user_id = _sql("INSERT INTO users (google_id, email) VALUES ('delete_me_gid', 'delete_me@example.com') RETURNING user_id")[0][0]
        try:
            _sql("INSERT INTO reading_cycles (user_id, cycle_number) VALUES (%s, 1)", (user_id,))
            with flask_app.app_context():
                headers = {'Authorization': f'Bearer {create_access_token(identity=str(user_id))}'}
            client.post('/api/progress', json={'book_name': 'Ruth', 'chapters': [1]}, headers=headers)

            assert client.delete('/api/account', headers=headers).status_code == 200
            assert _sql("SELECT 1 FROM users WHERE user_id = %s", (user_id,)) == []
            assert _sql("SELECT 1 FROM chapter_progress WHERE user_id = %s", (user_id,)) == []
            # The token outlives the account; it must be refused, not 500 on a missing user.
            assert client.get('/api/books', headers=headers).status_code == 401
        finally:
            _sql("DELETE FROM users WHERE user_id = %s", (user_id,))


class TestGuestSweep:
    def test_new_guest_sweeps_week_old_guests_that_never_logged_anything(self, client):
        old_empty, old_reader, new_empty = (
            _sql("INSERT INTO users (created_at) VALUES (NOW() - INTERVAL %s) RETURNING user_id", (age,))[0][0]
            for age in ('8 days', '8 days', '1 day'))
        cycle = _sql("INSERT INTO reading_cycles (user_id, cycle_number) VALUES (%s, 1) RETURNING cycle_id", (old_reader,))[0][0]
        _sql("INSERT INTO chapter_progress (user_id, cycle_id, book_id, chapter_number) VALUES (%s, %s, 1, 1)", (old_reader, cycle))
        created = None
        try:
            created = client.post('/auth/guest').get_json()['user_id']
            remaining = {r[0] for r in _sql("SELECT user_id FROM users WHERE user_id IN %s", ((old_empty, old_reader, new_empty),))}
            assert remaining == {old_reader, new_empty}
        finally:
            _sql("DELETE FROM users WHERE user_id IN %s", ((old_empty, old_reader, new_empty, created or 0),))
