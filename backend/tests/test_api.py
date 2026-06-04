from unittest.mock import patch
import psycopg2
import os


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
