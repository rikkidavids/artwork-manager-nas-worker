"""Choose Release and import-from-link: link parsing, per-source imports, release search."""
import io
import time
from urllib.parse import urlparse

import pytest
import requests

from conftest import jpeg


def _png(size):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', size, (200, 100, 30)).save(buf, 'PNG')
    return buf.getvalue()


class R:
    def __init__(self, status=200, data=None, content=b'', ctype='application/json', url=''):
        self.status_code, self._data, self.content, self.url = status, data, content, url
        self.headers = {'Content-Type': ctype}

    def json(self):
        return self._data


def fake_web(url, **kw):
    p = urlparse(url)
    host, path = p.netloc, p.path
    if host == 'img.test':
        size = (500, 500) if 'small' in path else (1400, 1400)
        return R(content=_png(size), ctype='image/png')
    if host == 'api.deezer.com' and path == '/album/302127':
        return R(data={'id': 302127, 'title': 'Discovery', 'artist': {'name': 'Daft Punk'}, 'release_date': '2001-03-12',
                       'link': 'https://www.deezer.com/album/302127', 'cover_xl': 'https://img.test/dz-xl.png',
                       'cover_big': 'https://img.test/dz-big.png'})
    if host == 'api.deezer.com' and path == '/album/404':
        return R(data={'error': {'type': 'DataException', 'message': 'no data'}})
    if host == 'api.deezer.com' and path == '/search/album':
        return R(data={'data': [
            {'id': 1, 'title': 'Something Else', 'artist': {'name': 'Other'}, 'cover_medium': 'https://img.test/a.png'},
            {'id': 302127, 'title': 'Discovery', 'artist': {'name': 'Daft Punk'}, 'release_date': '2001', 'cover_medium': 'https://img.test/b.png'},
        ]})
    if host == 'itunes.apple.com' and path == '/lookup':
        return R(data={'results': [{'wrapperType': 'collection', 'collectionId': 697194953, 'collectionName': 'Discovery',
                                    'artistName': 'Daft Punk', 'releaseDate': '2001-03-07T08:00:00Z',
                                    'artworkUrl100': 'https://img.test/small/100x100bb.png'}]})
    if host == 'itunes.apple.com' and path == '/search':
        raise requests.ConnectionError('offline')
    if host == 'musicbrainz.org' and path.startswith('/ws/2/release/'):
        return R(data={'id': path.rsplit('/', 1)[-1], 'title': 'Discovery', 'date': '2001-03-12',
                       'artist-credit': [{'name': 'Daft Punk'}]})
    if host == 'musicbrainz.org' and path == '/ws/2/release':
        return R(data={'releases': []})
    if host == 'coverartarchive.org':
        return R(data={'images': [{'front': True, 'image': 'https://img.test/caa.png', 'thumbnails': {}}]})
    return R(404, {})


@pytest.fixture
def album(nas, make_album, monkeypatch):
    mod, music = nas
    make_album(music, 'Daft Punk/Discovery', {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    end = time.time() + 20
    while time.time() < end:
        with mod.JOB_LOCK:
            if not mod.ACTIVE_JOBS:
                break
        time.sleep(0.05)
    monkeypatch.setattr(requests.Session, 'get', lambda self, url, **kw: fake_web(url, **kw))
    monkeypatch.setattr(mod.time, 'sleep', lambda *_: None)
    key = mod.web_query_albums({})['albums'][0]['album_key']
    return mod, key


@pytest.mark.parametrize('link,expected', [
    ('https://www.deezer.com/en/album/302127', {'kind': 'release', 'source': 'deezer', 'id': '302127'}),
    ('https://www.deezer.com/album/302127?utm_source=x', {'kind': 'release', 'source': 'deezer', 'id': '302127'}),
    ('https://music.apple.com/gb/album/discovery/697194953', {'kind': 'release', 'source': 'itunes', 'id': '697194953'}),
    ('https://music.apple.com/gb/album/discovery/697194953?i=697195787', {'kind': 'release', 'source': 'itunes', 'id': '697194953'}),
    ('https://itunes.apple.com/us/album/id697194953', {'kind': 'release', 'source': 'itunes', 'id': '697194953'}),
    ('https://musicbrainz.org/release/48140466-cff6-3222-bd55-63c27e43190d', {'kind': 'release', 'source': 'musicbrainz', 'id': '48140466-cff6-3222-bd55-63c27e43190d'}),
    ('https://musicbrainz.org/release-group/48117b82-8b8a-3b5c-9b1f-5e7ab3c5f0d1', {'kind': 'release', 'source': 'musicbrainz-group', 'id': '48117b82-8b8a-3b5c-9b1f-5e7ab3c5f0d1'}),
    ('https://www.discogs.com/release/1234567-Daft-Punk-Discovery', {'kind': 'release', 'source': 'discogs', 'id': '1234567'}),
    ('https://www.discogs.com/master/6111-Daft-Punk-Discovery', {'kind': 'release', 'source': 'discogs-master', 'id': '6111'}),
    ('https://www.discogs.com/Daft-Punk-Discovery/release/1234567', {'kind': 'release', 'source': 'discogs', 'id': '1234567'}),
    ('https://example.com/covers/discovery.jpg', {'kind': 'image', 'url': 'https://example.com/covers/discovery.jpg'}),
    ('https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Fa.png&imgrefurl=x', {'kind': 'image', 'url': 'https://example.com/a.png'}),
])
def test_parse_links(nas, link, expected):
    mod, _ = nas
    assert mod.web_parse_release_link(link) == expected


def test_parse_rejects_non_links(nas):
    mod, _ = nas
    with pytest.raises(ValueError, match="doesn't look like a link"):
        mod.web_parse_release_link('daft punk discovery')
    with pytest.raises(ValueError, match='no album ID'):
        mod.web_parse_release_link('https://music.apple.com/gb/artist/daft-punk/5468295')


def test_import_deezer_page(album):
    mod, key = album
    result = mod.web_import_from_link({'album_key': key, 'url': 'https://www.deezer.com/en/album/302127'})
    assert result['added'] == 1 and result['source'] == 'Deezer'
    cand = result['candidates'][0]
    assert cand['source'] == 'Deezer' and cand['width'] == 1400
    assert mod.web_get_album(key)['status'] == 'candidate_found'


def test_small_cover_from_chosen_release_is_kept_with_warning(album):
    mod, key = album
    result = mod.web_import_from_link({'album_key': key, 'url': 'https://music.apple.com/gb/album/discovery/697194953'})
    cand = result['candidates'][0]
    assert cand['width'] == 500, 'explicitly chosen release keeps a small cover'
    assert cand['warnings'], 'but it is flagged'


def test_import_musicbrainz_release(album):
    mod, key = album
    result = mod.web_import_release({'album_key': key, 'source': 'musicbrainz', 'id': '48140466-cff6-3222-bd55-63c27e43190d'})
    assert result['source'] == 'MusicBrainz' and result['added'] >= 1


def test_duplicate_import_is_explained(album):
    mod, key = album
    link = 'https://www.deezer.com/album/302127'
    mod.web_import_from_link({'album_key': key, 'url': link})
    with pytest.raises(ValueError, match='already one of this album'):
        mod.web_import_from_link({'album_key': key, 'url': link})


def test_unknown_deezer_album(album):
    mod, key = album
    with pytest.raises(ValueError, match='Deezer has no album'):
        mod.web_import_from_link({'album_key': key, 'url': 'https://www.deezer.com/album/404'})


def test_discogs_link_needs_token(album):
    mod, key = album
    with pytest.raises(ValueError, match='need a Discogs token'):
        mod.web_import_from_link({'album_key': key, 'url': 'https://www.discogs.com/release/1234567'})


def test_release_search_lists_matches_first_and_reports_offline_sources(album):
    mod, key = album
    result = mod.web_search_releases({'album_key': key})
    releases = result['releases']
    assert releases[0]['title'] == 'Discovery' and releases[0]['match'] is True
    assert any(r['title'] == 'Something Else' and r['match'] is False for r in releases)
    assert result['unreachable_sources'] == ['Apple/iTunes']
    assert all(r['source'] in ('deezer', 'musicbrainz') for r in releases)


def test_source_order_is_cleaned_and_saved(nas):
    mod, _ = nas
    assert mod.web_get_settings()['provider_order'] == ['deezer', 'itunes', 'musicbrainz', 'discogs']
    saved = mod.web_save_settings({'provider_order': ['musicbrainz', 'bogus', 'deezer', 'musicbrainz']})
    assert saved['provider_order'] == ['musicbrainz', 'deezer', 'itunes', 'discogs']
    assert mod.web_get_settings()['provider_order'] == ['musicbrainz', 'deezer', 'itunes', 'discogs']


def test_release_search_follows_source_order(album):
    mod, key = album
    mod.web_save_settings({'provider_order': ['musicbrainz', 'itunes', 'deezer', 'discogs']})
    real = mod.web_search_releases_from

    def fake_rows(source, artist, title, album, settings):
        return [mod.web_release_row(source, f'{source}-1', 'Unrelated', 'Nobody', '', album)]
    mod.web_search_releases_from = fake_rows
    try:
        result = mod.web_search_releases({'album_key': key})
    finally:
        mod.web_search_releases_from = real
    assert [r['source'] for r in result['releases']] == ['musicbrainz', 'itunes', 'deezer']
