"""Ignore, Rework, Undo Last Embed and Stop."""
import base64
import io
import time

import pytest

from conftest import jpeg


def _wait_idle(mod, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        with mod.JOB_LOCK:
            if not mod.ACTIVE_JOBS:
                return
        time.sleep(0.05)
    raise AssertionError('jobs did not finish')


def _scan(mod, resume=False):
    mod.start_web_scan({'resume': resume})
    _wait_idle(mod)


def _album(mod, name):
    return next(a for a in mod.web_query_albums({})['albums'] if a['album'] == name)


@pytest.fixture
def library(nas, make_album):
    mod, music = nas
    make_album(music, 'Artist/Good One', {'': jpeg((1400, 1400))})
    make_album(music, 'Artist/Needs Cover', {'': None})
    _scan(mod)
    return mod, music


def _add_option(mod, key):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1400, 1400), (90, 30, 160)).save(buf, 'PNG')
    return mod.web_add_manual_candidate({'album_key': key, 'image_b64': base64.b64encode(buf.getvalue()).decode(), 'filename': 'x.png'})


def test_ignore_removes_options_and_survives_a_fresh_rescan(library):
    mod, music = library
    key = _album(mod, 'Needs Cover')['album_key']
    image_path = mod.web_list_candidates(key)[0]['image_path'] if _add_option(mod, key) else None
    result = mod.web_ignore_album(key)
    assert result['album']['status'] == 'ignored' and result['album']['bucket'] == 'Done'
    assert result['removed_options'] == 1 and not mod.web_list_candidates(key)
    assert not mod.web_data_path(image_path).exists(), 'downloaded option file is cleaned up'

    _scan(mod, resume=False)  # a fresh full scan re-reads every folder
    assert _album(mod, 'Needs Cover')['status'] == 'ignored'
    mod.web_recheck_album(key)
    assert _album(mod, 'Needs Cover')['status'] == 'ignored'


def test_rework_brings_a_good_album_back_and_holds_it(library):
    mod, music = library
    key = _album(mod, 'Good One')['album_key']
    assert _album(mod, 'Good One')['bucket'] == 'Done'
    _add_option(mod, key)
    mod.web_reject_all_candidates({'album_key': key})
    result = mod.web_rework_album(key)
    album = result['album']
    assert album['status'] == 'rework' and album['bucket'] == 'Needs Work' and album['status_label'] == 'Rework'
    with mod.db_connect() as conn:
        assert conn.execute('SELECT COUNT(*) FROM candidates WHERE album_key=?', (key,)).fetchone()[0] == 0, \
            'rejected options are cleared too, so a fresh search can offer them again'
    # The cover is perfectly fine, but the album stays in Needs Work until you pick a new one.
    _scan(mod, resume=False)
    mod.web_recheck_album(key)
    assert _album(mod, 'Good One')['status'] == 'rework'


def test_rework_an_ignored_album(library):
    mod, _ = library
    key = _album(mod, 'Needs Cover')['album_key']
    mod.web_ignore_album(key)
    assert mod.web_rework_album(key)['album']['bucket'] == 'Needs Work'


def test_batch_ignore_and_rework(library):
    mod, _ = library
    keys = [a['album_key'] for a in mod.web_query_albums({})['albums']]
    assert mod.web_batch_album_action({'album_keys': keys}, mod.web_ignore_album)['updated'] == 2
    assert all(a['status'] == 'ignored' for a in mod.web_query_albums({})['albums'])
    assert mod.web_batch_album_action({'album_keys': keys}, mod.web_rework_album)['updated'] == 2
    assert all(a['status'] == 'rework' for a in mod.web_query_albums({})['albums'])


def test_stop_only_targets_stoppable_jobs(nas):
    mod, music = nas
    folder = music / 'A' / 'B'
    folder.mkdir(parents=True)
    search_id, t0, _ = mod.begin_job('artwork-search', {'album_folder': str(folder), 'album_key': 'k'})
    batch_id, t1, _ = mod.begin_job('batch-artwork-search', {'album_folder': str(music / 'A' / 'C'), 'album_key': 'k2'})
    result = mod.request_job_stop()
    assert result['stopping'] == [batch_id]
    assert mod.job_stop_requested(batch_id) and not mod.job_stop_requested(search_id)
    mod.finish_job(search_id, t0, True)
    mod.finish_job(batch_id, t1, True)
    with pytest.raises(ValueError, match='already finished'):
        mod.request_job_stop(batch_id)


def test_stopped_scan_saves_finished_albums_and_resumes(nas, make_album, monkeypatch):
    mod, music = nas
    for n in range(6):
        make_album(music, f'Artist/Album {n}', {'': None}, tracks=1)
    real = mod.analyze_scan_album
    seen = []

    def slow(*args, **kwargs):
        seen.append(1)
        if len(seen) == 2:
            mod.request_job_stop()  # stop while the scan is part-way through
        return real(*args, **kwargs)
    monkeypatch.setattr(mod, 'analyze_scan_album', slow)
    mod.web_save_settings({'scan_worker_threads': 1})
    mod.start_web_scan({'resume': False})
    _wait_idle(mod)
    first = len(mod.web_query_albums({})['albums'])
    assert 0 < first < 6, f'stopped part-way: {first} saved'
    _scan(mod, resume=True)
    assert len(mod.web_query_albums({})['albums']) == 6
