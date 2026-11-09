"""Shared fixtures: a throwaway NAS layout and a fresh import of server.py."""
import importlib
import io
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]


@pytest.fixture
def nas(tmp_path, monkeypatch):
    for name in ('music', 'backups', 'data'):
        (tmp_path / name).mkdir()
    monkeypatch.setenv('AMW_MUSIC_ROOT', str(tmp_path / 'music'))
    monkeypatch.setenv('AMW_BACKUP_DIR', str(tmp_path / 'backups'))
    monkeypatch.setenv('AMW_DATA_DIR', str(tmp_path / 'data'))
    monkeypatch.delenv('AMW_DISCOGS_TOKEN', raising=False)
    monkeypatch.delenv('AMW_TOKEN', raising=False)
    sys.path.insert(0, str(REPO))
    sys.modules.pop('server', None)
    mod = importlib.import_module('server')
    yield mod, tmp_path / 'music'
    sys.modules.pop('server', None)


def jpeg(size, colour=(40, 40, 40)):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', size, colour).save(buf, 'JPEG')
    return buf.getvalue()


@pytest.fixture
def make_album():
    """make_album(root, 'Artist/Album', {'CD1': cover_bytes_or_None, ...}, tracks=2)"""
    if not shutil.which('ffmpeg'):
        pytest.skip('ffmpeg is needed to generate test audio files')
    template = {}

    def _make(root: Path, rel: str, discs: dict, tracks: int = 2):
        from mutagen.flac import FLAC, Picture
        if 'flac' not in template:
            src = root.parent / '_template.flac'
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=duration=1', str(src)], check=True)
            template['flac'] = src
        album = root / rel
        artist, title = rel.split('/')[:2]
        for disc, cover in discs.items():
            folder = album / disc if disc else album
            folder.mkdir(parents=True, exist_ok=True)
            for n in range(1, tracks + 1):
                path = folder / f'{n:02d} Track.flac'
                shutil.copy(template['flac'], path)
                audio = FLAC(path)
                audio['artist'] = artist
                audio['album'] = title
                if cover:
                    pic = Picture()
                    pic.type = 3
                    pic.mime = 'image/jpeg'
                    pic.data = cover
                    audio.add_picture(pic)
                audio.save()
        return album
    return _make
