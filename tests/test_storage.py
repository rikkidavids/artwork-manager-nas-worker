"""Storage cleanup removes handled and leftover downloads only, and keeps rejection memory."""
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


def _upload(mod, key, colour):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (1200, 1200), colour).save(buf, 'PNG')
    return mod.web_add_manual_candidate({'album_key': key, 'image_b64': base64.b64encode(buf.getvalue()).decode(), 'filename': 'x.png'})['candidate_id']


def test_cleanup_keeps_waiting_covers_and_rejection_memory(nas, make_album):
    mod, music = nas
    make_album(music, 'A/One', {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    _wait_idle(mod)
    key = mod.web_query_albums({})['albums'][0]['album_key']
    keep_id = _upload(mod, key, (10, 20, 30))
    reject_id = _upload(mod, key, (200, 20, 30))
    mod.web_reject_candidate({'album_key': key, 'candidate_id': reject_id})
    leftover = mod.TEMP_CANDIDATE_DIR / key / 'stray.jpg'
    leftover.write_bytes(b'not referenced by anything')

    report = mod.web_storage_report()
    assert report['waiting']['files'] == 1
    assert report['handled']['files'] == 1
    assert report['leftover']['files'] == 1

    result = mod.web_storage_cleanup({'kinds': ['handled', 'leftover']})
    assert result['removed_files'] == 2 and result['freed_bytes'] > 0
    assert result['storage']['waiting']['files'] == 1
    assert result['storage']['handled']['files'] == 0 and result['storage']['leftover']['files'] == 0
    assert not leftover.exists()

    kept = mod.web_get_candidate(keep_id)
    assert mod.web_data_path(kept['image_path']).is_file(), 'cover waiting for review is untouched'

    # Clean Stale Options must not forget the rejection now its image is gone.
    mod.web_cleanup_stale_candidates()
    assert mod.web_get_candidate(reject_id) is not None


def test_finished_album_options_count_as_handled(nas, make_album):
    mod, music = nas
    make_album(music, 'A/Two', {'': jpeg((300, 300))})
    mod.start_web_scan({'resume': False})
    _wait_idle(mod)
    key = mod.web_query_albums({})['albums'][0]['album_key']
    _upload(mod, key, (1, 2, 3))
    mod.web_album_simple_action(key, 'reviewed_skipped', 'Skipped for now.', 'web_skip_album')
    report = mod.web_storage_report()
    assert report['handled']['files'] == 1 and report['waiting']['files'] == 0
