"""Discogs artwork source: matching, size filtering, token errors and token privacy."""
import importlib
import io
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
import requests


@pytest.fixture
def server(tmp_path, monkeypatch):
    for name in ('music', 'backups', 'data'):
        (tmp_path / name).mkdir()
    monkeypatch.setenv('AMW_MUSIC_ROOT', str(tmp_path / 'music'))
    monkeypatch.setenv('AMW_BACKUP_DIR', str(tmp_path / 'backups'))
    monkeypatch.setenv('AMW_DATA_DIR', str(tmp_path / 'data'))
    monkeypatch.delenv('AMW_DISCOGS_TOKEN', raising=False)
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    sys.modules.pop('server', None)
    mod = importlib.import_module('server')
    yield mod
    sys.modules.pop('server', None)


def _png(size):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', size, (120, 60, 20)).save(buf, 'PNG')
    return buf.getvalue()


class FakeResponse:
    def __init__(self, status=200, json_data=None, content=b'', ctype='application/json'):
        self.status_code = status
        self._json = json_data
        self.content = content
        self.headers = {'Content-Type': ctype}

    def json(self):
        return self._json


class FakeDiscogs:
    """Stands in for api.discogs.com and its image CDN."""

    def __init__(self, token='good-token'):
        self.token = token
        self.calls = []

    def get(self, session, url, timeout=None, **kwargs):
        self.calls.append(url)
        auth = session.headers.get('Authorization', '')
        if 'api.discogs.com' in url and auth != f'Discogs token={self.token}':
            return FakeResponse(401, {'message': 'You must authenticate to access this resource.'})
        parsed = urlparse(url)
        if parsed.path == '/database/search':
            q = parse_qs(parsed.query)
            assert q['type'] == ['release'] and q['artist'] == ['Radiohead']
            return FakeResponse(json_data={'results': [
                {'id': 111, 'title': 'Someone Else - OK Computer', 'year': '1997', 'cover_image': 'https://img.test/wrong.png'},
                {'id': 222, 'title': 'Radiohead - OK Computer', 'year': '1997', 'country': 'UK',
                 'format': ['CD', 'Album'], 'label': ['Parlophone'], 'cover_image': 'https://img.test/search-cover.png'},
            ]})
        if parsed.path == '/releases/222':
            return FakeResponse(json_data={'images': [
                {'type': 'secondary', 'uri': 'https://img.test/back.png', 'width': 1400, 'height': 1400},
                {'type': 'primary', 'uri': 'https://img.test/front.png', 'width': 1400, 'height': 1400},
                {'type': 'secondary', 'uri': 'https://img.test/tiny.png', 'width': 500, 'height': 500},
            ]})
        if url.startswith('https://img.test/'):
            return FakeResponse(content=_png((1400, 1400)), ctype='image/png')
        return FakeResponse(404, {})


@pytest.fixture
def discogs(monkeypatch):
    fake = FakeDiscogs()
    monkeypatch.setattr(requests.Session, 'get', lambda self, url, **kw: fake.get(self, url, **kw))
    return fake


ALBUM = {'album_key': 'abc123', 'artist': 'Radiohead', 'album': 'OK Computer', 'year': '1997'}


def _settings(mod, **extra):
    settings = mod.web_get_settings()
    settings.update({'discogs_token': 'good-token', 'scan_min_artwork_size': 1000, 'preferred_artwork_size': 1000})
    settings.update(extra)
    return settings


def test_finds_front_cover_first_and_skips_wrong_and_small_images(server, discogs):
    cands = server.web_discogs_candidates(ALBUM, 5, _settings(server))
    urls = [c['source_url'] for c in cands]
    assert urls == ['https://img.test/front.png', 'https://img.test/back.png']
    assert 'https://img.test/tiny.png' not in discogs.calls, 'too-small image should not be downloaded'
    assert not any('/releases/111' in u for u in discogs.calls), 'wrong-artist release should be ignored'
    front = cands[0]
    assert front['source'] == 'Discogs'
    assert front['source_detail'].startswith('Front cover')
    assert front['release_mbid'] == 'discogs:222'
    assert front['source_meta']['source_page'] == 'https://www.discogs.com/release/222'
    assert Path(front['image_path']).is_file()


def test_respects_max_candidates(server, discogs):
    assert len(server.web_discogs_candidates(ALBUM, 1, _settings(server))) == 1


def test_rejected_token_gives_clear_error(server, discogs):
    with pytest.raises(ValueError, match='rejected the saved token'):
        server.web_discogs_candidates(ALBUM, 5, _settings(server, discogs_token='typo'))


def test_skipped_without_token(server, discogs):
    assert server.web_discogs_candidates(ALBUM, 5, _settings(server, discogs_token='')) == []
    assert discogs.calls == []


def test_token_is_saved_but_never_returned(server):
    saved = server.web_save_settings({'discogs_token': '  secret-123  '})
    assert saved['discogs_token'] == 'secret-123'
    public = server.web_public_settings(saved)
    assert public['discogs_token'] == '' and public['discogs_token_set'] is True
    assert 'secret-123' not in str(server.web_status_payload())
    assert 'secret-123' not in str(server.web_setting_snapshot())

    # Saving other settings with a blank token field keeps the saved token.
    server.web_save_settings({'discogs_token': '', 'deezer_enabled': False})
    assert server.web_get_settings()['discogs_token'] == 'secret-123'

    server.web_save_settings({'discogs_token_clear': True})
    assert server.web_get_settings()['discogs_token'] == ''


def test_search_includes_discogs_only_with_token(server, discogs, monkeypatch):
    server.web_save_settings({'discogs_token': 'good-token', 'deezer_enabled': False,
                              'itunes_enabled': False, 'musicbrainz_enabled': False})
    monkeypatch.setattr(server, 'web_get_album', lambda key: dict(ALBUM, album_path='/music/x'))
    added = []
    monkeypatch.setattr(server, 'web_add_candidate', lambda key, cand: added.append(cand) or len(added))
    monkeypatch.setattr(server, 'web_list_candidates', lambda key, include_rejected=False: [])
    monkeypatch.setattr(server, 'web_active_candidate_count', lambda key: len(added))
    monkeypatch.setattr(server, 'web_set_album_status', lambda *a, **k: None)
    monkeypatch.setattr(server, 'web_add_history', lambda *a, **k: None)
    server.web_search_artwork_for_album('abc123')
    assert {c['source'] for c in added} == {'Discogs'}


def test_offline_discogs_counts_as_unreachable(server, monkeypatch):
    def offline(self, url, **kw):
        raise requests.ConnectionError('no route to host')
    monkeypatch.setattr(requests.Session, 'get', offline)
    with pytest.raises(server.SourceUnreachable):
        server.web_discogs_candidates(ALBUM, 5, _settings(server))
