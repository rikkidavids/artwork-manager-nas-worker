"""Quick scans must look at every disc, not just the first disc folder."""
from conftest import jpeg


def _scan(mod, music):
    result = mod.scan_library_job({'library_root': str(music), 'resume': False})
    return {(a['artist'], a['album']): a for a in result['albums']}


def test_missing_art_on_second_disc_is_caught(nas, make_album):
    mod, music = nas
    good = jpeg((1400, 1400))
    make_album(music, 'Artist/Half Done', {'CD1': good, 'CD2': None})
    make_album(music, 'Artist/All Good', {'CD1': good, 'CD2': good})
    make_album(music, 'Artist/Single Folder', {'': good}, tracks=3)
    albums = _scan(mod, music)

    half = albums[('Artist', 'Half Done')]
    assert half['requires_action'], 'disc 2 has no artwork, so the album needs work'
    assert half['track_count'] == 4
    assert albums[('Artist', 'All Good')]['requires_action'] is False
    assert albums[('Artist', 'All Good')]['track_count'] == 4
    assert albums[('Artist', 'Single Folder')]['track_count'] == 3


def test_single_folder_fingerprint_is_unchanged(nas, make_album):
    """Existing single-folder albums must keep their saved fingerprint (no mass rescan)."""
    mod, music = nas
    album = make_album(music, 'Artist/Plain', {'': jpeg((1400, 1400))}, tracks=3)
    names = mod.sort_names([p.name for p in album.iterdir() if p.suffix == '.flac'])
    rules = mod.scan_rules_fingerprint({'scan_min_artwork_size': 1000})
    old_style = mod.folder_music_fingerprint(album, names, rules)
    new_style = mod.folder_music_fingerprint(album, mod.album_music_relpaths(album), rules)
    assert mod.fingerprint_matches(old_style, new_style)


def test_change_on_second_disc_is_detected(nas, make_album):
    mod, music = nas
    good = jpeg((1400, 1400))
    album = make_album(music, 'Artist/Two Disc', {'CD1': good, 'CD2': good})
    rules = mod.scan_rules_fingerprint({'scan_min_artwork_size': 1000})
    before = mod.folder_music_fingerprint(album, mod.album_music_relpaths(album), rules)
    (album / 'CD2' / '03 Track.flac').write_bytes((album / 'CD2' / '01 Track.flac').read_bytes())
    after = mod.folder_music_fingerprint(album, mod.album_music_relpaths(album), rules)
    assert not mod.fingerprint_matches(before, after)


def test_problem_files_name_the_disc(nas, make_album):
    mod, music = nas
    album = make_album(music, 'Artist/Low Res Double', {'CD1': jpeg((600, 600)), 'CD2': None})
    deep = mod.deep_check(album, 1000, problem_files=True)
    names = [row['file'] for row in deep['problem_files']]
    assert names == ['CD1/01 Track.flac', 'CD1/02 Track.flac', 'CD2/01 Track.flac', 'CD2/02 Track.flac']
    assert deep['deep_file_check']['first_issue_file'] == 'CD1/01 Track.flac'
