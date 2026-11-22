"""Album job locks: approve may overlap that album's search, nothing else may."""
import pytest


def test_approve_can_run_during_same_album_search(nas):
    mod, music = nas
    folder = music / 'A' / 'B'
    folder.mkdir(parents=True)
    payload = {'album_folder': str(folder), 'album_key': 'k'}

    search_id, t0, _ = mod.begin_job('artwork-search', payload)
    approve_id, t1, _ = mod.begin_job('approve-embed', payload)

    with pytest.raises(mod.WorkerBusyError):
        mod.begin_job('artwork-search', payload)      # no second search
    with pytest.raises(mod.WorkerBusyError):
        mod.begin_job('approve-embed', payload)       # no second approve
    with pytest.raises(mod.WorkerBusyError):
        mod.begin_job('convert-current', payload)     # no file rewrites

    mod.finish_job(approve_id, t1, True)
    with pytest.raises(mod.WorkerBusyError):
        mod.begin_job('convert-current', payload)     # search still holds the album
    mod.finish_job(search_id, t0, True)
    other_id, t2, _ = mod.begin_job('convert-current', payload)
    mod.finish_job(other_id, t2, True)
    assert str(folder) not in mod.ACTIVE_ALBUMS


def test_search_cannot_start_while_approving(nas):
    mod, music = nas
    folder = music / 'A' / 'C'
    folder.mkdir(parents=True)
    payload = {'album_folder': str(folder), 'album_key': 'k2'}
    approve_id, t0, _ = mod.begin_job('approve-embed', payload)
    with pytest.raises(mod.WorkerBusyError):
        mod.begin_job('artwork-search', payload)
    mod.finish_job(approve_id, t0, True)
