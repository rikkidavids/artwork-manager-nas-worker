"""Fixes from the full end-to-end test pass."""
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


def _png(colour):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1200, 1200), colour).save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


def _setup(mod, make_album, music, name='A/One'):
    make_album(music, name, {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    _wait_idle(mod)
    return mod.web_query_albums({})['albums'][0]['album_key']


def test_working_album_stays_listed_after_changing_bucket(nas, make_album):
    mod, music = nas
    key = _setup(mod, make_album, music)
    assert mod.web_get_album(key)['bucket'] == 'Needs Work'
    mod.web_add_manual_candidate({'album_key': key, 'image_b64': _png((9, 9, 9)), 'filename': 'x.png'})
    assert mod.web_get_album(key)['bucket'] == 'Review'
    assert mod.web_query_albums({'bucket': ['Needs Work']})['albums'] == []
    kept = mod.web_query_albums({'bucket': ['Needs Work'], 'keep': [key]})['albums']
    assert [a['album_key'] for a in kept] == [key]


def test_picking_a_rejected_cover_again_brings_it_back(nas, make_album):
    mod, music = nas
    key = _setup(mod, make_album, music)
    cand = {'source': 'Deezer', 'source_url': 'https://cdn/x.jpg', 'width': 1200, 'height': 1200}
    path = mod.TEMP_CANDIDATE_DIR / key / 'a.jpg'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(jpeg((1200, 1200)))
    cid = mod.web_add_candidate(key, {**cand, 'image_path': str(path)})
    mod.web_reject_candidate({'album_key': key, 'candidate_id': cid})
    assert mod.web_active_candidate_count(key) == 0
    path2 = mod.TEMP_CANDIDATE_DIR / key / 'b.jpg'
    path2.write_bytes(jpeg((1200, 1200)))
    again = mod.web_add_candidate(key, {**cand, 'image_path': str(path2)})
    assert again == cid
    assert mod.web_active_candidate_count(key) == 1
    assert mod.web_get_candidate(cid)['image_path'].endswith('b.jpg')


def test_backup_list_marks_restored_embeds_and_undo_clears_last_approval(nas, make_album):
    mod, music = nas
    key = _setup(mod, make_album, music)
    cid = mod.web_add_manual_candidate({'album_key': key, 'image_b64': _png((1, 200, 3)), 'filename': 'x.png'})['candidate_id']
    mod.web_approve_candidate(key, cid)
    assert mod.web_get_album(key)['notes'].get('last_approval')
    item = mod.web_list_backup_history(key)['backups'][0]
    assert item['restored_at'] == ''
    mod.web_restore_backup_history(item['history_id'])
    item = mod.web_list_backup_history(key)['backups'][0]
    assert item['restored_at']
    assert 'last_approval' not in mod.web_get_album(key)['notes']
