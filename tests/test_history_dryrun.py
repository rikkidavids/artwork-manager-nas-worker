"""Dry run embeds change nothing; History lists actions in plain words; folder cover status is reported."""
import base64
import io
import time

from conftest import jpeg


def _wait_idle(mod):
    end = time.time() + 20
    while time.time() < end:
        with mod.JOB_LOCK:
            if not mod.ACTIVE_JOBS:
                return
        time.sleep(0.05)


def _upload(mod, key):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1400, 1400), (40, 90, 160)).save(buf, 'PNG')
    return mod.web_add_manual_candidate({'album_key': key, 'image_b64': base64.b64encode(buf.getvalue()).decode(), 'filename': 'x.png'})['candidate_id']


def _album(mod, make_album, music, name):
    folder = make_album(music, name, {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    _wait_idle(mod)
    return folder, mod.web_query_albums({})['albums'][0]['album_key']


def test_dry_run_changes_nothing_and_is_logged(nas, make_album):
    mod, music = nas
    folder, key = _album(mod, make_album, music, 'A/Dry')
    tracks = sorted(p for p in folder.rglob('*') if p.suffix.lower() in ('.mp3', '.flac', '.m4a'))
    before = {p: p.read_bytes() for p in tracks}
    cid = _upload(mod, key)
    status_before = mod.web_get_album(key)['status']
    mod.web_save_settings({'dry_run_embeds': True})
    result = mod.web_approve_candidate(key, cid)
    assert result['dry_run'] and result['ok']
    assert 'nothing changed' in result['reason'].lower()
    assert {p: p.read_bytes() for p in tracks} == before
    assert mod.web_get_album(key)['status'] == status_before
    assert not mod.web_get_candidate(cid)['approved']
    page = mod.web_history_page({'kind': 'embeds'})
    assert page['total'] == 1
    assert page['entries'][0]['label'].startswith('Dry run')
    assert page['entries'][0]['can_restore'] is False


def test_history_filters_and_search(nas, make_album):
    mod, music = nas
    _folder, key = _album(mod, make_album, music, 'Zed/Quiet Songs')
    cid = _upload(mod, key)
    mod.web_reject_candidate({'album_key': key, 'candidate_id': cid})
    everything = mod.web_history_page({})
    labels = [e['label'] for e in everything['entries']]
    assert 'Rejected an option' in labels and 'Added artwork' in labels
    assert mod.web_history_page({'kind': 'reviews'})['total'] == 1
    assert mod.web_history_page({'q': 'quiet'})['total'] >= 2
    assert mod.web_history_page({'q': 'nothing like this'})['total'] == 0
    paged = mod.web_history_page({'limit': 1, 'offset': 1})
    assert len(paged['entries']) == 1 and paged['entries'][0]['id'] == everything['entries'][1]['id']


def test_problem_payload_reports_folder_cover(nas, make_album):
    mod, music = nas
    folder, key = _album(mod, make_album, music, 'A/Folder')
    payload = mod.web_album_problem_files(key)
    assert payload['folder_cover']['ok'] is False
    assert payload['folder_cover']['issue'] == 'folder cover missing'
    from PIL import Image
    Image.new('RGB', (1200, 1200), (1, 2, 3)).save(folder / 'cover.jpg', 'JPEG')
    payload = mod.web_album_problem_files(key)
    assert payload['folder_cover']['ok'] is True and payload['folder_cover']['name'] == 'cover.jpg'
    assert 'path' not in payload['folder_cover']
