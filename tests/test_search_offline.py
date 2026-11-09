"""A search with unreachable sources must say so, not look like 'no covers exist'."""
import requests

from conftest import jpeg


class _Resp:
    status_code = 200

    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


def _search(mod, monkeypatch, fake_get):
    monkeypatch.setattr(requests.Session, 'get', lambda self, url, **kw: fake_get(url))
    monkeypatch.setattr(mod.time, 'sleep', lambda *_: None)
    mod.web_save_settings({'deezer_enabled': True, 'itunes_enabled': True, 'musicbrainz_enabled': True})
    key = mod.web_query_albums({})['albums'][0]['album_key']
    mod.web_search_artwork_for_album(key)
    return mod.web_query_albums({})['albums'][0]


def _offline(url):
    raise requests.ConnectionError('Name or service not known')


def test_all_sources_offline_is_reported(nas, make_album, monkeypatch):
    mod, music = nas
    _seed(mod, music, make_album)
    album = _search(mod, monkeypatch, _offline)
    notes = album['notes']
    assert sorted(notes['last_search_unreachable']) == ['Apple/iTunes', 'Deezer', 'MusicBrainz']
    assert notes['last_search_all_failed'] is True
    assert 'could be reached' in notes['status_reason']


def test_one_source_offline_others_answer(nas, make_album, monkeypatch):
    mod, music = nas
    _seed(mod, music, make_album)

    def fake(url):
        if 'deezer' in url:
            raise requests.ConnectionError('timed out')
        return _Resp({'results': [], 'releases': [], 'data': []})
    album = _search(mod, monkeypatch, fake)
    assert album['notes']['last_search_unreachable'] == ['Deezer']
    assert album['notes']['last_search_all_failed'] is False


def test_successful_search_clears_old_warning(nas, make_album, monkeypatch):
    mod, music = nas
    _seed(mod, music, make_album)
    _search(mod, monkeypatch, _offline)
    album = _search(mod, monkeypatch, lambda url: _Resp({'results': [], 'releases': [], 'data': []}))
    assert album['notes']['last_search_unreachable'] == []


def _seed(mod, music, make_album):
    make_album(music, 'Some Artist/Some Album', {'': jpeg((300, 300))})
    job = mod.start_web_scan({'resume': False})
    _wait_for_jobs(mod)
    assert mod.web_query_albums({})['albums'], job


def _wait_for_jobs(mod, timeout=20):
    import time as _t
    end = _t.time() + timeout
    while _t.time() < end:
        with mod.JOB_LOCK:
            if not mod.ACTIVE_JOBS:
                return
        _t.sleep(0.05)
    raise AssertionError('scan job did not finish')
