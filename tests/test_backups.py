"""Backups must keep same-named tracks on different discs apart, and restore exactly."""
import base64
import hashlib
import importlib
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.fixture
def server(tmp_path, monkeypatch):
    if not shutil.which('ffmpeg'):
        pytest.skip('ffmpeg is needed to generate test audio files')
    music = tmp_path / 'music'
    album = music / 'Test Artist' / 'Test Album'
    for disc, freq in (('CD1', 220), ('CD2', 880)):
        for track in ('01.flac', '02.flac'):
            (album / disc).mkdir(parents=True, exist_ok=True)
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', f'sine=frequency={freq}:duration=1',
                            str(album / disc / track)], check=True)
    (album / 'CD1' / '._01.flac').write_bytes(b'AppleDouble junk')
    monkeypatch.setenv('AMW_MUSIC_ROOT', str(music))
    monkeypatch.setenv('AMW_BACKUP_DIR', str(tmp_path / 'backups'))
    monkeypatch.setenv('AMW_DATA_DIR', str(tmp_path / 'data'))
    (tmp_path / 'data').mkdir()
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    sys.modules.pop('server', None)
    mod = importlib.import_module('server')
    yield mod, album
    sys.modules.pop('server', None)


def _md5(path):
    return hashlib.md5(Path(path).read_bytes()).hexdigest()


def _cover_b64():
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1200, 1200), (30, 90, 160)).save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


def test_appledouble_sidecars_are_not_treated_as_tracks(server):
    mod, album = server
    names = [str(p.relative_to(album)) for p in mod.iter_music_files(album)]
    assert names == [os.path.join('CD1', '01.flac'), os.path.join('CD1', '02.flac'),
                     os.path.join('CD2', '01.flac'), os.path.join('CD2', '02.flac')]


def test_multidisc_backup_and_restore_round_trip(server):
    mod, album = server
    before = {str(p): _md5(p) for p in mod.iter_music_files(album)}
    result = mod.embed_album_job({'album_folder': str(album), 'image_b64': _cover_b64(), 'backup': True,
                                  'album_key': 'k', 'max_artwork_size': 1000, 'make_square': True})
    assert result['updated'] == result['total'] == 4 and not result['failed']
    assert len({b['backup'] for b in result['backups']}) == 4
    assert all(_md5(f) != h for f, h in before.items()), 'embed should have changed every track'

    mod.web_add_history('k', 'embed', result)
    history_id = mod.web_list_backup_history('k')['backups'][0]['history_id']
    restored = mod.web_restore_backup_history(history_id)
    assert restored['restored'] == 4 and not restored['failed']
    for f, h in before.items():
        assert _md5(f) == h, f'{f} restored with the wrong content'
