"""Find More adds new covers on top of saved ones, skipping covers already seen or rejected."""
import io
import time
from urllib.parse import urlparse

import requests

from conftest import jpeg


def _png():
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1400, 1400), (10, 120, 90)).save(buf, 'PNG')
    return buf.getvalue()


class R:
    def __init__(self, data=None, content=b'', ctype='application/json'):
        self.status_code, self._data, self.content, self.headers = 200, data, content, {'Content-Type': ctype}

    def json(self):
        return self._data


def fake(url, **kw):
    p = urlparse(url)
    if p.netloc == 'img.test':
        return R(content=_png(), ctype='image/png')
    if p.netloc == 'api.deezer.com':
        # Four matching editions, each with one cover size, so each search can only find new ones by going deeper.
        return R(data={'data': [{'id': n, 'title': 'Homogenic', 'artist': {'name': 'Bjork'}, 'release_date': '1997',
                                 'cover_xl': f'https://img.test/{n}.png'} for n in range(1, 5)]})
    return R(data={})


def _search(mod, key, more):
    mod.web_search_artwork_for_album(key, more=more)
    return mod.web_query_albums({})['albums'][0]


def test_find_more_adds_new_covers_then_reports_none(nas, make_album, monkeypatch):
    mod, music = nas
    make_album(music, 'Bjork/Homogenic', {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    end = time.time() + 20
    while time.time() < end:
        with mod.JOB_LOCK:
            if not mod.ACTIVE_JOBS:
                break
        time.sleep(0.05)
    monkeypatch.setattr(requests.Session, 'get', lambda self, url, **kw: fake(url, **kw))
    mod.web_save_settings({'max_candidates_per_album': 2, 'itunes_enabled': False, 'musicbrainz_enabled': False})
    key = mod.web_query_albums({})['albums'][0]['album_key']

    assert _search(mod, key, more=False)['candidate_count'] == 2
    # A normal search again doesn't add anything: the album already has its 2.
    assert _search(mod, key, more=False)['candidate_count'] == 2

    album = _search(mod, key, more=True)
    assert album['candidate_count'] == 4
    urls = {c['source_url'] for c in mod.web_list_candidates(key)}
    assert urls == {f'https://img.test/{n}.png' for n in range(1, 5)}

    album = _search(mod, key, more=True)
    assert album['candidate_count'] == 4
    assert album['notes']['last_search_more'] is True and album['notes']['last_search_saved'] == 0


def test_rejected_covers_are_not_offered_again(nas, make_album, monkeypatch):
    mod, music = nas
    make_album(music, 'Bjork/Homogenic', {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    end = time.time() + 20
    while time.time() < end:
        with mod.JOB_LOCK:
            if not mod.ACTIVE_JOBS:
                break
        time.sleep(0.05)
    monkeypatch.setattr(requests.Session, 'get', lambda self, url, **kw: fake(url, **kw))
    mod.web_save_settings({'max_candidates_per_album': 2, 'itunes_enabled': False, 'musicbrainz_enabled': False})
    key = mod.web_query_albums({})['albums'][0]['album_key']
    _search(mod, key, more=False)
    first = {c['source_url'] for c in mod.web_list_candidates(key)}
    mod.web_reject_all_candidates({'album_key': key})
    _search(mod, key, more=False)
    second = {c['source_url'] for c in mod.web_list_candidates(key)}
    assert second and not (first & second), 'rejected covers must not come back'
