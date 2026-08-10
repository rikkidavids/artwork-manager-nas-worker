#!/usr/bin/env python3
"""Artwork Manager NAS worker.

Runs inside Docker/Container Manager on a Synology/NAS.  The Mac app sends
artwork write and deep-check jobs here so files are modified locally on the NAS
instead of through SMB/VPN.
"""
from __future__ import annotations

import base64
import difflib
import hashlib
import json
import mimetypes
import os
import re
import shutil
import sqlite3
import threading
import time
import unicodedata
import uuid
from collections import Counter, deque
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import parse_qs, unquote, urlparse
from urllib.parse import quote_plus

import requests
from PIL import Image, ImageOps
from mutagen.id3 import ID3, APIC, ID3NoHeaderError
from mutagen.flac import FLAC, Picture
from mutagen.mp4 import MP4, MP4Cover

WORKER_BUILD = '5.29'
APP_BUILD = '5.29'
WORKER_API = 5
MINIMUM_MAC_APP_WORKER_API = 4
VERSION = f'Artwork Manager NAS Worker {WORKER_BUILD} / app build {APP_BUILD}'
MUSIC_EXTENSIONS = ('.mp3', '.flac', '.m4a', '.mp4')
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')
YEAR_RE = re.compile(r'(19|20)\d{2}')
UPDATE_HINT = (
    'If this is not the build you expected, Synology is probably still running '
    'an older cached Docker image/container. Pull the latest GHCR image and recreate the container. Build 5.29 polishes web UI testing edges.'
)


def env_roots() -> List[Path]:
    raw = os.environ.get('AMW_MUSIC_ROOTS') or os.environ.get('AMW_MUSIC_ROOT') or '/music'
    roots = []
    for part in raw.split(':'):
        part = part.strip()
        if part:
            roots.append(Path(part).resolve())
    return roots or [Path('/music').resolve()]


MUSIC_ROOTS = env_roots()
BACKUP_ROOT = Path(os.environ.get('AMW_BACKUP_DIR') or '/backups').resolve()
DATA_ROOT = Path(os.environ.get('AMW_DATA_DIR') or '/data').resolve()
DB_PATH = DATA_ROOT / 'artwork_manager.sqlite3'
WEB_ROOT = Path(__file__).resolve().parent / 'web'
TEMP_CANDIDATE_DIR = DATA_ROOT / 'temporary_candidates'
API_TOKEN = os.environ.get('AMW_TOKEN') or ''
HOST = os.environ.get('AMW_HOST') or '0.0.0.0'
PORT = int(os.environ.get('AMW_PORT') or '8765')
SERVER_STARTED_AT = time.monotonic()
RECENT_JOBS = deque(maxlen=int(os.environ.get('AMW_RECENT_JOBS') or '50'))
ACTIVE_JOBS = {}
ACTIVE_ALBUMS = set()
JOB_LOCK = threading.RLock()


class WorkerBusyError(RuntimeError):
    pass


def now() -> str:
    return datetime.now().isoformat(timespec='seconds')


def duration_seconds(started: float) -> float:
    try:
        return round(max(0.0, time.monotonic() - float(started)), 3)
    except Exception:
        return 0.0


def path_status(path: Path, check_write: bool = False) -> Dict[str, Any]:
    """Return cheap filesystem diagnostics for mounted NAS paths."""
    out = {
        'path': str(path),
        'exists': False,
        'is_dir': False,
        'readable': False,
        'writable': False,
    }
    try:
        out['exists'] = path.exists()
        out['is_dir'] = path.is_dir()
        out['readable'] = os.access(path, os.R_OK)
        out['writable'] = os.access(path, os.W_OK)
        if check_write and out['is_dir'] and out['writable']:
            probe = path / '.amw_write_test'
            try:
                probe.write_text(now(), encoding='utf-8')
                probe.unlink(missing_ok=True)
                out['write_test_ok'] = True
            except Exception as exc:
                out['write_test_ok'] = False
                out['write_test_error'] = str(exc)
    except Exception as exc:
        out['error'] = str(exc)
    return out


def job_album_label(payload: Dict[str, Any]) -> str:
    artist = str(payload.get('artist') or '').strip()
    album = str(payload.get('album') or '').strip()
    if artist and album:
        return f'{artist} — {album}'
    if album:
        return album
    path = str(payload.get('album_folder') or '').rstrip('/')
    return Path(path).name if path else 'album'


def begin_job(kind: str, payload: Dict[str, Any]) -> Tuple[str, float, str]:
    album_folder = str(safe_path(payload.get('album_folder') or ''))
    job_id = uuid.uuid4().hex[:12]
    started_mono = time.monotonic()
    record = {
        'job_id': job_id,
        'kind': kind,
        'album_folder': album_folder,
        'album_key': str(payload.get('album_key') or ''),
        'label': job_album_label(payload),
        'started_at': now(),
        '_started_mono': started_mono,
        'duration_seconds': 0.0,
        'ok': None,
    }
    with JOB_LOCK:
        if album_folder in ACTIVE_ALBUMS:
            raise WorkerBusyError(f'Album is already being processed by the NAS worker: {album_folder}')
        ACTIVE_ALBUMS.add(album_folder)
        ACTIVE_JOBS[job_id] = record
    return job_id, started_mono, album_folder


def update_job(job_id: str, **fields: Any) -> None:
    if not job_id:
        return
    with JOB_LOCK:
        record = ACTIVE_JOBS.get(job_id)
        if not record:
            return
        record.update(fields)
        started = record.get('_started_mono') or 0.0
        record['duration_seconds'] = duration_seconds(started)
        record['updated_at'] = now()


def finish_job(job_id: str, started_mono: float, ok: bool, result: Dict[str, Any] | None = None, error: str = '') -> Dict[str, Any]:
    result = result or {}
    summary = {
        'job_id': job_id,
        'worker_build': WORKER_BUILD,
        'worker_api': WORKER_API,
        'api': WORKER_API,
        'duration_seconds': duration_seconds(started_mono),
        'finished_at': now(),
    }
    with JOB_LOCK:
        record = ACTIVE_JOBS.pop(job_id, None) or {'job_id': job_id}
        album_folder = record.get('album_folder') or ''
        if album_folder:
            ACTIVE_ALBUMS.discard(album_folder)
        record.pop('_started_mono', None)
        record.update(summary)
        record['ok'] = bool(ok)
        if error:
            record['error'] = str(error)
        if isinstance(result, dict):
            if 'updated' in result:
                record['updated'] = result.get('updated')
            if 'total' in result:
                record['total'] = result.get('total')
            scan_keys = ('processed_albums', 'changed_albums', 'queued_albums', 'skipped_unchanged', 'fingerprints_backfilled')
            if any(key in result for key in scan_keys):
                for key in scan_keys:
                    if key in result:
                        record[key] = result.get(key)
                progress = dict(record.get('scan_progress') or {})
                progress.update({
                    'phase': 'complete' if ok else 'failed',
                    'processed_albums': result.get('processed_albums', progress.get('processed_albums', 0)),
                    'changed_albums': result.get('changed_albums', progress.get('changed_albums', 0)),
                    'queued_albums': result.get('queued_albums', progress.get('queued_albums', 0)),
                    'skipped_unchanged': result.get('skipped_unchanged', progress.get('skipped_unchanged', 0)),
                    'fingerprints_backfilled': result.get('fingerprints_backfilled', progress.get('fingerprints_backfilled', 0)),
                })
                record['scan_progress'] = progress
            if 'failed' in result:
                try:
                    record['failed_count'] = len(result.get('failed') or [])
                except Exception:
                    record['failed_count'] = 0
            for key in ('candidate_count', 'saved_candidate_ids', 'status', 'reason'):
                if key in result:
                    record[key] = result.get(key)
            deep = result.get('deep_file_check') if isinstance(result.get('deep_file_check'), dict) else None
            if deep:
                record['checked_files'] = deep.get('checked_files')
                record['requires_action'] = bool(deep.get('requires_action'))
        RECENT_JOBS.appendleft(record)
    return summary


def status_payload(public: bool = False) -> Dict[str, Any]:
    with JOB_LOCK:
        active = []
        for value in ACTIVE_JOBS.values():
            item = dict(value)
            item['duration_seconds'] = duration_seconds(item.get('_started_mono') or 0.0)
            item.pop('_started_mono', None)
            active.append(item)
        recent = [dict(v) for v in list(RECENT_JOBS)]
    payload = {
        'ok': True,
        'service': 'Artwork Manager NAS Worker',
        'version': VERSION,
        'worker_build': WORKER_BUILD,
        'app_build': APP_BUILD,
        'worker_api': WORKER_API,
        'api': WORKER_API,
        'minimum_mac_app_worker_api': MINIMUM_MAC_APP_WORKER_API,
        'token_required': bool(API_TOKEN),
        'music_roots': [str(x) for x in MUSIC_ROOTS],
        'backup_root': str(BACKUP_ROOT),
        'time': now(),
        'uptime_seconds': duration_seconds(SERVER_STARTED_AT),
        'busy': bool(active),
        'active_jobs': active,
        'recent_jobs': recent,
        'recent_job_count': len(recent),
        'endpoints': [
            'GET /app/', 'GET /', 'GET /version', 'GET /health', 'GET /status',
            'GET /api/app/status', 'GET /api/settings', 'GET /api/albums',
            'GET /api/candidates', 'GET /api/album/problems',
            'GET /api/artwork/current', 'GET /api/artwork/candidate',
            'POST /api/settings', 'POST /api/scan/start', 'POST /api/library/clear', 'POST /api/artwork/search',
            'POST /api/artwork/import', 'POST /api/artwork/approve', 'POST /api/artwork/convert-current',
            'POST /api/artwork/reject', 'POST /api/album/skip',
            'POST /api/album/mark-good', 'POST /scan-library', 'POST /embed', 'POST /deep-check',
            'POST /path-check',
        ],
        'update_hint': UPDATE_HINT,
        'build_marker': f'amw-worker-{WORKER_BUILD}-api-{WORKER_API}',
    }
    if not public:
        payload['filesystem'] = {
            'music_roots': [path_status(x) for x in MUSIC_ROOTS],
            'backup_root': path_status(BACKUP_ROOT),
        }
    return payload


def _unicode_forms(value: str) -> Tuple[str, str]:
    raw = str(value or '')
    try:
        return unicodedata.normalize('NFC', raw), unicodedata.normalize('NFD', raw)
    except Exception:
        return raw, raw


def _unicode_component_equal(left: str, right: str) -> bool:
    if left == right:
        return True
    left_nfc, left_nfd = _unicode_forms(left)
    right_nfc, right_nfd = _unicode_forms(right)
    return left_nfc == right_nfc or left_nfd == right_nfd


def _resolve_unicode_equivalent_path(path: Path, root: Path) -> Tuple[Path, bool]:
    """Resolve a path under root, matching components by Unicode equivalence.

    macOS/SMB may send decomposed Unicode names (for example Zoe + combining
    diaeresis) while Synology/Linux often stores the visually identical folder
    using composed Unicode (Zoë).  pathlib's exact lookup treats those as
    different names.  This walks each component and substitutes the actual
    on-disk name when NFC/NFD-normalized forms match.
    """
    try:
        rel = path.relative_to(root)
    except ValueError:
        return path, False
    candidate = root
    changed = False
    for part in rel.parts:
        exact = candidate / part
        if exact.exists():
            candidate = exact
            continue
        if not candidate.is_dir():
            candidate = exact
            continue
        try:
            children = list(candidate.iterdir())
        except Exception:
            candidate = exact
            continue
        matches = [child for child in children if _unicode_component_equal(child.name, part)]
        if not matches:
            candidate = exact
            continue
        # Prefer a directory match when walking album folders, then deterministic name order.
        matches.sort(key=lambda child: (not child.is_dir(), alpha_key(child.name)))
        candidate = matches[0]
        changed = True
    return candidate, changed


def safe_path(value: str) -> Path:
    if not value:
        raise ValueError('Missing path')
    try:
        p = Path(value).resolve(strict=False)
    except TypeError:
        p = Path(value).resolve()
    for root in MUSIC_ROOTS:
        root_resolved = root.resolve(strict=False)
        try:
            p.relative_to(root_resolved)
        except ValueError:
            continue
        resolved, _changed = _resolve_unicode_equivalent_path(p, root_resolved)
        try:
            final = resolved.resolve(strict=False)
        except TypeError:
            final = resolved.resolve()
        try:
            final.relative_to(root_resolved)
        except ValueError:
            raise ValueError(f'Path resolves outside allowed music roots: {final}')
        return final
    raise ValueError(f'Path is outside allowed music roots: {p}')


def fold_text(value: Any) -> str:
    text = unicodedata.normalize('NFKD', str(value or ''))
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    return text.casefold()


def alpha_key(name: Any):
    parts = re.split(r'(\d+)', fold_text(name))
    return [int(part) if part.isdigit() else part for part in parts]


def sort_names(names):
    try:
        return sorted(list(names), key=alpha_key)
    except Exception:
        return list(names)


def path_resume_key(path: Any) -> str:
    try:
        return os.path.normcase(os.path.abspath(os.path.normpath(str(path or ''))))
    except Exception:
        return str(path or '')


def clean_album_name(name: str) -> str:
    name = str(name or '')
    name = re.sub(r'^\(\d{4}\)\s*-\s*', '', name)
    name = re.sub(r'^\d{4}\s*-\s*', '', name)
    return name.strip()


def normalize_for_match(name: str) -> str:
    name = fold_text(clean_album_name(name))
    name = re.sub(r'[^a-z0-9]+', ' ', name)
    return ' '.join(name.split())


def as_text_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(x).strip() for x in value if str(x).strip()]
    return [str(value).strip()] if str(value).strip() else []


def tag_values(tags: Any, *keys: str) -> List[str]:
    vals = []
    for key in keys:
        try:
            value = tags.get(key)
        except Exception:
            value = None
        if value is None:
            continue
        vals.extend(as_text_list(value))
    return vals


def id3_text(audio: Any, *frame_ids: str) -> List[str]:
    out = []
    for frame_id in frame_ids:
        frame = audio.get(frame_id)
        if frame is None:
            continue
        text = getattr(frame, 'text', None)
        out.extend(as_text_list(text if text is not None else str(frame)))
    return out


def id3_txxx(audio: Any, *descriptions: str) -> List[str]:
    wanted = {d.lower() for d in descriptions}
    out = []
    for key, frame in audio.items():
        if not str(key).startswith('TXXX'):
            continue
        desc = str(getattr(frame, 'desc', '') or '').lower()
        if desc in wanted:
            out.extend(as_text_list(getattr(frame, 'text', None)))
    return out


def mp4_values(tags: Any, *keys: str) -> List[str]:
    out = []
    for key in keys:
        value = tags.get(key)
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            for item in value:
                if isinstance(item, bytes):
                    try:
                        item = item.decode('utf-8', errors='ignore')
                    except Exception:
                        item = ''
                out.extend(as_text_list(item))
        else:
            out.extend(as_text_list(value))
    return out


def read_track_metadata(path: Path) -> Dict[str, List[str]]:
    ext = path.suffix.lower()
    data = {
        'artist': [], 'albumartist': [], 'album': [], 'year': [],
        'mb_release_id': [], 'mb_releasegroup_id': [],
    }
    try:
        if ext == '.mp3':
            audio = ID3(str(path))
            data['artist'].extend(id3_text(audio, 'TPE1'))
            data['albumartist'].extend(id3_text(audio, 'TPE2'))
            data['album'].extend(id3_text(audio, 'TALB'))
            data['year'].extend(id3_text(audio, 'TDRC', 'TDOR', 'TYER', 'TDAT'))
            data['mb_release_id'].extend(id3_txxx(audio, 'MusicBrainz Album Id', 'MusicBrainz Release Id', 'MusicBrainz AlbumID'))
            data['mb_releasegroup_id'].extend(id3_txxx(audio, 'MusicBrainz Release Group Id', 'MusicBrainz Release GroupID'))
        elif ext == '.flac':
            audio = FLAC(str(path))
            tags = audio.tags or {}
            data['artist'].extend(tag_values(tags, 'artist'))
            data['albumartist'].extend(tag_values(tags, 'albumartist', 'album artist'))
            data['album'].extend(tag_values(tags, 'album'))
            data['year'].extend(tag_values(tags, 'date', 'year', 'originaldate', 'originalyear'))
            data['mb_release_id'].extend(tag_values(tags, 'musicbrainz_albumid', 'musicbrainz release id'))
            data['mb_releasegroup_id'].extend(tag_values(tags, 'musicbrainz_releasegroupid', 'musicbrainz release group id'))
        elif ext in ('.m4a', '.mp4'):
            audio = MP4(str(path))
            tags = audio.tags or {}
            data['artist'].extend(mp4_values(tags, '©ART'))
            data['albumartist'].extend(mp4_values(tags, 'aART'))
            data['album'].extend(mp4_values(tags, '©alb'))
            data['year'].extend(mp4_values(tags, '©day'))
            data['mb_release_id'].extend(mp4_values(tags, '----:com.apple.iTunes:MusicBrainz Album Id', '----:com.apple.iTunes:MusicBrainz Release Id'))
            data['mb_releasegroup_id'].extend(mp4_values(tags, '----:com.apple.iTunes:MusicBrainz Release Group Id'))
    except Exception:
        pass
    return data


def common_value(values: List[str]) -> str:
    values = [str(v).strip() for v in values if str(v).strip()]
    if not values:
        return ''
    return Counter(values).most_common(1)[0][0]


def parse_folder_identity(folder: Path, library_root: Path) -> Dict[str, str]:
    rel = os.path.relpath(str(folder), str(library_root))
    parts = rel.split(os.sep)
    artist = parts[0] if len(parts) >= 1 and parts[0] != '.' else ''
    album_part = parts[1] if len(parts) >= 2 else (parts[0] if parts and parts[0] != '.' else '')
    year = ''
    album = album_part
    match = re.match(r'^\((\d{4})\)\s*-\s*(.+)$', album_part)
    if match:
        year, album = match.group(1), match.group(2)
    else:
        match = re.match(r'^(\d{4})\s*-\s*(.+)$', album_part)
        if match:
            year, album = match.group(1), match.group(2)
        else:
            match = re.match(r'^(.+?)\s*\((\d{4})\)$', album_part)
            if match:
                album, year = match.group(1), match.group(2)
    return {
        'folder_artist': artist.strip(),
        'folder_album': clean_album_name(album).strip(),
        'folder_year': year,
    }


def inspect_album_identity(folder: Path, library_root: Path, music_names: List[str]) -> Dict[str, Any]:
    folder_meta = parse_folder_identity(folder, library_root)
    tag_artists: List[str] = []
    tag_albumartists: List[str] = []
    tag_albums: List[str] = []
    tag_years: List[str] = []
    mb_release_ids: List[str] = []
    mb_releasegroup_ids: List[str] = []
    for name in music_names[:10]:
        meta = read_track_metadata(folder / name)
        tag_artists.extend(meta.get('artist', []))
        tag_albumartists.extend(meta.get('albumartist', []))
        tag_albums.extend(meta.get('album', []))
        tag_years.extend(meta.get('year', []))
        mb_release_ids.extend(meta.get('mb_release_id', []))
        mb_releasegroup_ids.extend(meta.get('mb_releasegroup_id', []))

    artist_from_tags = common_value(tag_albumartists) or common_value(tag_artists)
    album_from_tags = common_value(tag_albums)
    year_from_tags = common_value([YEAR_RE.search(v).group(0) for v in tag_years if YEAR_RE.search(v)])
    search_artist = artist_from_tags or folder_meta['folder_artist']
    search_album = album_from_tags or folder_meta['folder_album']
    year = year_from_tags or folder_meta['folder_year'] or ''
    artist_agree = not (artist_from_tags and folder_meta['folder_artist']) or normalize_for_match(artist_from_tags) == normalize_for_match(folder_meta['folder_artist'])
    album_agree = not (album_from_tags and folder_meta['folder_album']) or normalize_for_match(album_from_tags) == normalize_for_match(folder_meta['folder_album'])
    if artist_from_tags and album_from_tags and artist_agree and album_agree:
        confidence = 'High'
        source_summary = 'tags + folder agreement'
    elif (artist_from_tags or album_from_tags) and (artist_agree or album_agree):
        confidence = 'Medium'
        source_summary = 'tags supported by folder structure'
    elif search_artist or search_album:
        confidence = 'Low'
        source_summary = 'folder structure and partial tags'
    else:
        confidence = 'Low'
        source_summary = 'weak metadata'
    if (artist_from_tags and folder_meta['folder_artist'] and not artist_agree) or (album_from_tags and folder_meta['folder_album'] and not album_agree):
        source_summary = 'tags/folder mismatch'
        confidence = 'Low'
    return {
        'artist': search_artist or folder_meta['folder_artist'],
        'album': search_album or folder_meta['folder_album'],
        'search_artist': search_artist or folder_meta['folder_artist'],
        'search_album': search_album or folder_meta['folder_album'],
        'year': year,
        'mb_release_id': common_value(mb_release_ids),
        'mb_releasegroup_id': common_value(mb_releasegroup_ids),
        'identity_confidence': confidence,
        'track_count': len(music_names),
        'notes': {
            'source_summary': source_summary,
            'folder_artist': folder_meta['folder_artist'],
            'folder_album': folder_meta['folder_album'],
            'folder_year': folder_meta['folder_year'],
            'tag_artist': artist_from_tags,
            'tag_album': album_from_tags,
            'tag_year': year_from_tags,
        },
    }


def get_album_path(folder: Path, library_root: Path) -> Path:
    rel = os.path.relpath(str(folder), str(library_root))
    parts = rel.split(os.sep)
    return library_root / parts[0] / parts[1] if len(parts) >= 2 else folder


def scan_rules_fingerprint(settings: Dict[str, Any]) -> Dict[str, Any]:
    scan_min = int(settings.get('scan_min_artwork_size') or 1000)
    rules = {
        'version': 1,
        'include_missing': bool(settings.get('include_missing', True)),
        'deep_scan_all_files': bool(settings.get('deep_scan_all_files')),
        'scan_min_artwork_size': scan_min,
        'preferred_artwork_size': int(settings.get('preferred_artwork_size') or scan_min),
        'target_size_match_mode': 'Strict' if str(settings.get('target_size_match_mode') or '').strip().lower() == 'strict' else 'Relaxed',
        'save_approved_artwork_to_album_folder': bool(settings.get('save_approved_artwork_to_album_folder')),
    }
    payload = json.dumps(rules, sort_keys=True, separators=(',', ':'))
    rules['digest'] = hashlib.sha1(payload.encode('utf-8')).hexdigest()
    return rules


def folder_music_fingerprint(folder: Path, music_names: List[str], scan_rules: Dict[str, Any] | None = None) -> Dict[str, Any]:
    parts = []
    total_size = 0
    max_mtime_ns = 0
    for name in sort_names(music_names or []):
        try:
            st = (folder / name).stat()
            size = int(getattr(st, 'st_size', 0) or 0)
            mtime_ns = int(getattr(st, 'st_mtime_ns', int(getattr(st, 'st_mtime', 0) * 1000000000)) or 0)
        except Exception:
            size = -1
            mtime_ns = -1
        total_size += max(0, size)
        max_mtime_ns = max(max_mtime_ns, mtime_ns)
        parts.append(f'{name}\0{size}\0{mtime_ns}')
    digest = hashlib.sha1('\0'.join(parts).encode('utf-8', errors='ignore')).hexdigest()
    return {
        'version': 2 if scan_rules else 1,
        'file_count': len(music_names or []),
        'total_size': total_size,
        'max_mtime_ns': max_mtime_ns,
        'digest': digest,
        'scan_rules': scan_rules or {},
    }


def fingerprint_matches(saved: Any, current: Any) -> bool:
    if not isinstance(saved, dict) or not isinstance(current, dict):
        return False
    return (
        int(saved.get('version') or 0) == int(current.get('version') or 0) and
        int(saved.get('file_count') or -1) == int(current.get('file_count') or -2) and
        int(saved.get('total_size') or -1) == int(current.get('total_size') or -2) and
        int(saved.get('max_mtime_ns') or -1) == int(current.get('max_mtime_ns') or -2) and
        str(saved.get('digest') or '') == str(current.get('digest') or '') and
        str((saved.get('scan_rules') or {}).get('digest') or '') == str((current.get('scan_rules') or {}).get('digest') or '')
    )


WEB_SCHEMA = '''
CREATE TABLE IF NOT EXISTS albums (
  album_key TEXT PRIMARY KEY,
  artist TEXT,
  album TEXT,
  album_path TEXT,
  status TEXT DEFAULT 'pending',
  width INTEGER,
  height INTEGER,
  example_file TEXT,
  search_artist TEXT,
  search_album TEXT,
  year TEXT,
  mb_release_id TEXT,
  mb_releasegroup_id TEXT,
  identity_confidence TEXT,
  track_count INTEGER,
  notes TEXT,
  last_scanned TEXT
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_key TEXT,
  action TEXT,
  payload TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_key TEXT,
  source TEXT,
  image_path TEXT,
  width INTEGER,
  height INTEGER,
  source_url TEXT,
  source_detail TEXT,
  release_title TEXT,
  release_mbid TEXT,
  source_meta TEXT,
  warnings TEXT,
  score INTEGER DEFAULT 0,
  score_summary TEXT,
  rejected INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  candidate_state TEXT DEFAULT 'available',
  state_reason TEXT,
  state_updated_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  payload TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_albums_status_artist_album ON albums(status, artist, album);
CREATE INDEX IF NOT EXISTS idx_albums_path ON albums(album_path);
CREATE INDEX IF NOT EXISTS idx_candidates_album_flags ON candidates(album_key, approved, rejected);
CREATE INDEX IF NOT EXISTS idx_candidates_source_url ON candidates(album_key, source, source_url);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(album_key, score);
'''

WEB_TABLE_ADDITIONS = {
    'candidates': [
        ('source_url', 'TEXT'),
        ('source_detail', 'TEXT'),
        ('release_title', 'TEXT'),
        ('release_mbid', 'TEXT'),
        ('source_meta', 'TEXT'),
        ('warnings', 'TEXT'),
        ('score', 'INTEGER DEFAULT 0'),
        ('score_summary', 'TEXT'),
        ('rejected', 'INTEGER DEFAULT 0'),
        ('approved', 'INTEGER DEFAULT 0'),
        ('candidate_state', "TEXT DEFAULT 'available'"),
        ('state_reason', 'TEXT'),
        ('state_updated_at', 'TEXT'),
        ('created_at', 'TEXT'),
    ],
}


def init_web_db() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    TEMP_CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        configure_db_connection(conn)
        try:
            conn.execute('PRAGMA journal_mode=WAL')
            conn.execute('PRAGMA synchronous=NORMAL')
        except Exception:
            pass
        conn.executescript(WEB_SCHEMA)
        for table, additions in WEB_TABLE_ADDITIONS.items():
            cols = {r['name'] for r in conn.execute(f'PRAGMA table_info({table})').fetchall()}
            for col, typ in additions:
                if col not in cols:
                    conn.execute(f'ALTER TABLE {table} ADD COLUMN {col} {typ}')


def configure_db_connection(conn: sqlite3.Connection) -> None:
    try:
        conn.create_function('amw_fold', 1, fold_text, deterministic=True)
    except TypeError:
        conn.create_function('amw_fold', 1, fold_text)
    except Exception:
        pass


def db_connect() -> sqlite3.Connection:
    init_web_db()
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    configure_db_connection(conn)
    try:
        conn.execute('PRAGMA busy_timeout=5000')
        conn.execute('PRAGMA synchronous=NORMAL')
    except Exception:
        pass
    return conn


def web_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {'1', 'true', 'yes', 'on'}:
        return True
    if text in {'0', 'false', 'no', 'off'}:
        return False
    return bool(default)


def web_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        out = int(value)
    except Exception:
        out = int(default)
    return max(int(minimum), min(int(maximum), out))


def web_default_settings() -> Dict[str, Any]:
    scan_min = web_int(os.environ.get('AMW_SCAN_MIN_ARTWORK_SIZE') or 1000, 1000, 200, 5000)
    preferred = web_int(os.environ.get('AMW_PREFERRED_ARTWORK_SIZE') or scan_min, scan_min, 200, 5000)
    root = str(MUSIC_ROOTS[0]) if MUSIC_ROOTS else '/music'
    return {
        'library_root': root,
        'resume_scans': True,
        'include_missing': True,
        'deep_scan_all_files': web_bool(os.environ.get('AMW_DEEP_SCAN_ALL_FILES'), False),
        'scan_worker_threads': web_int(os.environ.get('AMW_SCAN_WORKERS') or 8, 8, 1, 32),
        'scan_min_artwork_size': scan_min,
        'preferred_artwork_size': preferred,
        'target_size_match_mode': os.environ.get('AMW_TARGET_SIZE_MATCH_MODE') or 'Relaxed',
        'save_approved_artwork_to_album_folder': web_bool(os.environ.get('AMW_SAVE_FOLDER_COVER'), False),
        'max_embedded_artwork_size': web_int(os.environ.get('AMW_MAX_EMBEDDED_ARTWORK_SIZE') or 0, 0, 0, 5000),
        'backup_before_embed': True,
        'max_candidates_per_album': web_int(os.environ.get('AMW_MAX_CANDIDATES_PER_ALBUM') or 5, 5, 1, 25),
        'parallel_provider_workers': web_int(os.environ.get('AMW_PROVIDER_WORKERS') or 2, 2, 1, 4),
        'deezer_enabled': web_bool(os.environ.get('AMW_DEEZER_ENABLED'), True),
        'itunes_enabled': web_bool(os.environ.get('AMW_ITUNES_ENABLED'), True),
        'theme_mode': os.environ.get('AMW_THEME_MODE') or 'Auto',
    }


def web_get_settings() -> Dict[str, Any]:
    settings = web_default_settings()
    with db_connect() as conn:
        row = conn.execute('SELECT payload FROM app_settings WHERE id=1').fetchone()
    if row and row['payload']:
        try:
            stored = json.loads(row['payload'])
            if isinstance(stored, dict):
                settings.update(stored)
        except Exception:
            pass
    settings['library_root'] = str(settings.get('library_root') or (str(MUSIC_ROOTS[0]) if MUSIC_ROOTS else '/music'))
    settings['resume_scans'] = web_bool(settings.get('resume_scans'), True)
    settings['include_missing'] = web_bool(settings.get('include_missing'), True)
    settings['deep_scan_all_files'] = web_bool(settings.get('deep_scan_all_files'), False)
    settings['scan_worker_threads'] = web_int(settings.get('scan_worker_threads'), 8, 1, 32)
    settings['scan_min_artwork_size'] = web_int(settings.get('scan_min_artwork_size'), 1000, 200, 5000)
    settings['preferred_artwork_size'] = web_int(settings.get('preferred_artwork_size'), settings['scan_min_artwork_size'], 200, 5000)
    if str(settings.get('target_size_match_mode') or '').strip().lower() not in {'relaxed', 'strict'}:
        settings['target_size_match_mode'] = 'Relaxed'
    settings['target_size_match_mode'] = 'Strict' if str(settings.get('target_size_match_mode')).lower() == 'strict' else 'Relaxed'
    settings['save_approved_artwork_to_album_folder'] = web_bool(settings.get('save_approved_artwork_to_album_folder'), False)
    settings['max_embedded_artwork_size'] = web_int(settings.get('max_embedded_artwork_size'), 0, 0, 5000)
    settings['backup_before_embed'] = web_bool(settings.get('backup_before_embed'), True)
    settings['max_candidates_per_album'] = web_int(settings.get('max_candidates_per_album'), 5, 1, 25)
    settings['parallel_provider_workers'] = web_int(settings.get('parallel_provider_workers'), 2, 1, 4)
    settings['deezer_enabled'] = web_bool(settings.get('deezer_enabled'), True)
    settings['itunes_enabled'] = web_bool(settings.get('itunes_enabled'), True)
    theme = str(settings.get('theme_mode') or 'Auto').strip().lower()
    settings['theme_mode'] = {'light': 'Light', 'dark': 'Dark', 'auto': 'Auto'}.get(theme, 'Auto')
    return settings


def web_save_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    current = web_get_settings()
    allowed = {
        'library_root',
        'resume_scans',
        'include_missing',
        'deep_scan_all_files',
        'scan_worker_threads',
        'scan_min_artwork_size',
        'preferred_artwork_size',
        'target_size_match_mode',
        'save_approved_artwork_to_album_folder',
        'max_embedded_artwork_size',
        'backup_before_embed',
        'max_candidates_per_album',
        'parallel_provider_workers',
        'deezer_enabled',
        'itunes_enabled',
        'theme_mode',
    }
    for key in allowed:
        if key in payload:
            current[key] = payload.get(key)
    current = {**web_default_settings(), **current}
    # Validate through the normal getter path by temporarily applying coercions here.
    current['resume_scans'] = web_bool(current.get('resume_scans'), True)
    current['include_missing'] = web_bool(current.get('include_missing'), True)
    current['deep_scan_all_files'] = web_bool(current.get('deep_scan_all_files'), False)
    current['scan_worker_threads'] = web_int(current.get('scan_worker_threads'), 8, 1, 32)
    current['scan_min_artwork_size'] = web_int(current.get('scan_min_artwork_size'), 1000, 200, 5000)
    current['preferred_artwork_size'] = web_int(current.get('preferred_artwork_size'), current['scan_min_artwork_size'], 200, 5000)
    current['target_size_match_mode'] = 'Strict' if str(current.get('target_size_match_mode') or '').strip().lower() == 'strict' else 'Relaxed'
    current['save_approved_artwork_to_album_folder'] = web_bool(current.get('save_approved_artwork_to_album_folder'), False)
    current['max_embedded_artwork_size'] = web_int(current.get('max_embedded_artwork_size'), 0, 0, 5000)
    current['backup_before_embed'] = web_bool(current.get('backup_before_embed'), True)
    current['max_candidates_per_album'] = web_int(current.get('max_candidates_per_album'), 5, 1, 25)
    current['parallel_provider_workers'] = web_int(current.get('parallel_provider_workers'), 2, 1, 4)
    current['deezer_enabled'] = web_bool(current.get('deezer_enabled'), True)
    current['itunes_enabled'] = web_bool(current.get('itunes_enabled'), True)
    theme = str(current.get('theme_mode') or 'Auto').strip().lower()
    current['theme_mode'] = {'light': 'Light', 'dark': 'Dark', 'auto': 'Auto'}.get(theme, 'Auto')
    with db_connect() as conn:
        conn.execute(
            'INSERT INTO app_settings(id, payload, updated_at) VALUES(1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at',
            (json.dumps(current), now()),
        )
    return current


def web_album_key(album_path: Any) -> str:
    value = path_resume_key(album_path)
    digest = hashlib.sha1(value.encode('utf-8', errors='ignore')).hexdigest()
    return digest[:20]


REVIEW_STATUSES = ('candidate_found',)
DONE_STATUSES = ('already_good', 'approved', 'reviewed_skipped', 'ignored')
LIVE_SIZE_STATUSES = {'already_good', 'approved'}


def web_effective_artwork_target(settings: Dict[str, Any] | None = None) -> int:
    settings = settings or web_get_settings()
    scan_min = web_int(settings.get('scan_min_artwork_size'), 1000, 200, 5000)
    return web_int(settings.get('preferred_artwork_size') or scan_min, scan_min, 200, 5000)


def web_live_status(status: Any, width: Any, height: Any, settings: Dict[str, Any]) -> str:
    status = str(status or '').strip() or 'pending'
    if status not in LIVE_SIZE_STATUSES:
        return status
    if width in (None, '', 'Missing') or height in (None, '', 'Missing'):
        return 'missing_artwork'
    try:
        w = int(width or 0)
        h = int(height or 0)
    except Exception:
        return 'missing_artwork'
    if w <= 0 or h <= 0:
        return 'missing_artwork'
    if w != h:
        return 'not_square_artwork'
    target = web_effective_artwork_target(settings)
    tolerance = target_tolerance(settings.get('target_size_match_mode'))
    if not scan_artwork_meets_target_size(w, h, target, tolerance):
        return 'needs_review'
    return status


def web_live_status_reason(status: str, raw_status: str, width: Any, height: Any, settings: Dict[str, Any], notes: Dict[str, Any]) -> str:
    if status == raw_status:
        return notes.get('status_reason') or ''
    if status == 'missing_artwork':
        return 'Current cover is missing.'
    if status == 'not_square_artwork':
        return 'Current cover is not square.'
    if status == 'needs_review':
        target = web_effective_artwork_target(settings)
        size = f'{width} x {height}' if width and height else 'current cover'
        return f'{size} is below target {target}.'
    return notes.get('status_reason') or ''


def web_status_bucket(status: Any) -> str:
    status = str(status or '').strip()
    if status in REVIEW_STATUSES:
        return 'Review'
    if status in DONE_STATUSES:
        return 'Done'
    if status in {'needs_review', 'missing_artwork', 'not_square_artwork', 'incompatible_artwork', 'no_candidate', 'pending', 'searching'}:
        return 'Needs Work'
    return 'Needs Work' if status else 'Needs Work'


def web_status_label(status: Any) -> str:
    status = str(status or '').strip()
    return {
        'already_good': 'Good',
        'approved': 'Done',
        'candidate_found': 'Review',
        'ignored': 'Ignored',
        'incompatible_artwork': 'Convert',
        'missing_artwork': 'Missing',
        'needs_review': 'Low Res',
        'no_candidate': 'No Cover',
        'not_square_artwork': 'Shape',
        'pending': 'Pending',
        'reviewed_skipped': 'Skipped',
        'searching': 'Searching',
    }.get(status, status.replace('_', ' ').title() if status else 'Pending')


def web_status_for_scan_item(item: Dict[str, Any]) -> Tuple[str, str]:
    if not bool(item.get('requires_action')):
        return 'already_good', 'No action needed.'
    identity = item.get('identity') if isinstance(item.get('identity'), dict) else {}
    notes = identity.get('notes') if isinstance(identity.get('notes'), dict) else {}
    width = item.get('width')
    height = item.get('height')
    compat = notes.get('artwork_compatibility') if isinstance(notes.get('artwork_compatibility'), dict) else {}
    folder = notes.get('album_folder_cover') if isinstance(notes.get('album_folder_cover'), dict) else {}
    if width in (None, '', 'Missing') or height in (None, '', 'Missing'):
        return 'missing_artwork', 'Embedded artwork is missing from at least one track.'
    if compat.get('needs_conversion') or folder.get('needs_save'):
        issue = compat.get('issue') or compat.get('format') or folder.get('issue') or 'Artwork needs rewriting.'
        return 'incompatible_artwork', str(issue)
    try:
        if int(width or 0) != int(height or 0):
            return 'not_square_artwork', 'Current artwork is not square.'
    except Exception:
        pass
    return 'needs_review', 'Current artwork needs a better cover.'


def web_decode_notes(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


def web_existing_album_resume_info() -> List[Dict[str, Any]]:
    out = []
    with db_connect() as conn:
        rows = conn.execute('SELECT album_key, album_path, notes FROM albums WHERE album_path IS NOT NULL AND album_path<>""').fetchall()
    for row in rows:
        notes = web_decode_notes(row['notes'])
        out.append({
            'album_key': row['album_key'],
            'album_path': row['album_path'],
            'scan_fingerprint': notes.get('scan_fingerprint') if isinstance(notes.get('scan_fingerprint'), dict) else None,
        })
    return out


def web_existing_album_key_by_path(album_path: Any) -> str:
    path = str(album_path or '')
    if not path:
        return ''
    key = path_resume_key(path)
    with db_connect() as conn:
        rows = conn.execute('SELECT album_key, album_path FROM albums WHERE album_path IS NOT NULL AND album_path<>""').fetchall()
    for row in rows:
        if path_resume_key(row['album_path']) == key:
            return str(row['album_key'] or '')
    return ''


def web_upsert_album(item: Dict[str, Any]) -> str:
    album_path = str(item.get('album_path') or '')
    album_key = str(item.get('album_key') or '') or web_existing_album_key_by_path(album_path) or web_album_key(album_path)
    identity = item.get('identity') if isinstance(item.get('identity'), dict) else {}
    notes = dict(identity.get('notes') or {}) if isinstance(identity.get('notes'), dict) else {}
    fingerprint = item.get('scan_fingerprint')
    if fingerprint:
        notes['scan_fingerprint'] = fingerprint
    status, reason = web_status_for_scan_item(item)
    notes['status_reason'] = reason
    width = item.get('width')
    height = item.get('height')
    width = None if width in (None, '', 'Missing') else int(width)
    height = None if height in (None, '', 'Missing') else int(height)
    with db_connect() as conn:
        conn.execute(
            '''
            INSERT INTO albums(
              album_key, artist, album, album_path, status, width, height, example_file,
              search_artist, search_album, year, mb_release_id, mb_releasegroup_id,
              identity_confidence, track_count, notes, last_scanned
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(album_key) DO UPDATE SET
              artist=excluded.artist,
              album=excluded.album,
              album_path=excluded.album_path,
              status=excluded.status,
              width=excluded.width,
              height=excluded.height,
              example_file=excluded.example_file,
              search_artist=excluded.search_artist,
              search_album=excluded.search_album,
              year=excluded.year,
              mb_release_id=excluded.mb_release_id,
              mb_releasegroup_id=excluded.mb_releasegroup_id,
              identity_confidence=excluded.identity_confidence,
              track_count=excluded.track_count,
              notes=excluded.notes,
              last_scanned=excluded.last_scanned
            ''',
            (
                album_key,
                str(item.get('artist') or 'Unknown Artist'),
                str(item.get('album') or 'Unknown Album'),
                album_path,
                status,
                width,
                height,
                str(item.get('example_file') or ''),
                str(item.get('search_artist') or item.get('artist') or ''),
                str(item.get('search_album') or item.get('album') or ''),
                str(item.get('year') or ''),
                str(item.get('mb_release_id') or ''),
                str(item.get('mb_releasegroup_id') or ''),
                str(item.get('identity_confidence') or ''),
                item.get('track_count'),
                json.dumps(notes),
                now(),
            ),
        )
    return album_key


def web_apply_scan_result(result: Dict[str, Any]) -> Dict[str, Any]:
    updated = 0
    for update in result.get('fingerprint_updates') or []:
        if not isinstance(update, dict):
            continue
        album_key = str(update.get('album_key') or '')
        fingerprint = update.get('scan_fingerprint')
        if not album_key or not isinstance(fingerprint, dict):
            continue
        with db_connect() as conn:
            row = conn.execute('SELECT notes FROM albums WHERE album_key=?', (album_key,)).fetchone()
            if not row:
                continue
            notes = web_decode_notes(row['notes'])
            notes['scan_fingerprint'] = fingerprint
            conn.execute('UPDATE albums SET notes=?, last_scanned=? WHERE album_key=?', (json.dumps(notes), now(), album_key))
            updated += 1
    for item in result.get('albums') or []:
        if isinstance(item, dict):
            web_upsert_album(item)
            updated += 1
    return {'updated_rows': updated, 'counts': web_queue_counts()}


def web_clear_queue_database() -> Dict[str, Any]:
    with JOB_LOCK:
        if ACTIVE_JOBS:
            raise WorkerBusyError('Wait for the current job to finish before clearing the queue database.')
    init_web_db()
    with db_connect() as conn:
        album_count = int((conn.execute('SELECT COUNT(*) AS n FROM albums').fetchone() or {'n': 0})['n'])
        candidate_count = int((conn.execute('SELECT COUNT(*) AS n FROM candidates').fetchone() or {'n': 0})['n'])
        history_count = int((conn.execute('SELECT COUNT(*) AS n FROM history').fetchone() or {'n': 0})['n'])
        conn.execute('DELETE FROM candidates')
        conn.execute('DELETE FROM history')
        conn.execute('DELETE FROM albums')
        conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('candidates', 'history')")

    removed_candidate_files = 0
    if TEMP_CANDIDATE_DIR.exists():
        for child in list(TEMP_CANDIDATE_DIR.iterdir()):
            try:
                if child.is_dir():
                    removed_candidate_files += sum(1 for item in child.rglob('*') if item.is_file())
                    shutil.rmtree(child)
                elif child.is_file():
                    child.unlink()
                    removed_candidate_files += 1
            except Exception:
                pass
    TEMP_CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
    return {
        'cleared': True,
        'albums_removed': album_count,
        'candidates_removed': candidate_count,
        'history_removed': history_count,
        'candidate_files_removed': removed_candidate_files,
        'counts': web_queue_counts(),
    }


def web_queue_counts(settings: Dict[str, Any] | None = None) -> Dict[str, int]:
    counts = {'All': 0, 'Needs Work': 0, 'Review': 0, 'Done': 0}
    settings = settings or web_get_settings()
    with db_connect() as conn:
        rows = conn.execute('SELECT status, width, height FROM albums').fetchall()
    for row in rows:
        live_status = web_live_status(row['status'], row['width'], row['height'], settings)
        counts['All'] += 1
        bucket = web_status_bucket(live_status)
        counts[bucket] = counts.get(bucket, 0) + 1
    return counts


def web_album_from_row(row: sqlite3.Row, settings: Dict[str, Any] | None = None) -> Dict[str, Any]:
    settings = settings or web_get_settings()
    notes = web_decode_notes(row['notes'])
    width = row['width']
    height = row['height']
    if width and height:
        size = f'{width} x {height}'
    else:
        size = 'Missing'
    raw_status = row['status'] or 'pending'
    status = web_live_status(raw_status, width, height, settings)
    return {
        'album_key': row['album_key'],
        'artist': row['artist'] or 'Unknown Artist',
        'album': row['album'] or 'Unknown Album',
        'album_path': row['album_path'] or '',
        'stored_status': raw_status,
        'status': status,
        'status_label': web_status_label(status),
        'bucket': web_status_bucket(status),
        'status_reason': web_live_status_reason(status, raw_status, width, height, settings, notes),
        'width': width,
        'height': height,
        'size_label': size,
        'example_file': row['example_file'] or '',
        'search_artist': row['search_artist'] or row['artist'] or '',
        'search_album': row['search_album'] or row['album'] or '',
        'year': row['year'] or '',
        'track_count': row['track_count'] or 0,
        'last_scanned': row['last_scanned'] or '',
        'notes': notes,
        'candidate_count': int(web_row_get(row, 'candidate_count', 0) or 0),
    }


def web_query_albums(params: Dict[str, List[str]]) -> Dict[str, Any]:
    bucket = (params.get('bucket') or ['All'])[0]
    query = fold_text(((params.get('q') or [''])[0] or '').strip())
    raw_limit = ((params.get('limit') or ['0'])[0] or '0').strip()
    try:
        limit = max(0, min(int(raw_limit), 50000))
    except Exception:
        limit = 0
    settings = web_get_settings()
    where = []
    args: List[Any] = []
    if query:
        where.append(
            "amw_fold(COALESCE(a.artist,'') || ' ' || COALESCE(a.album,'') || ' ' || COALESCE(a.album_path,'')) LIKE ?"
        )
        args.append(f'%{query}%')
    where_sql = f"WHERE {' AND '.join(where)}" if where else ''
    with db_connect() as conn:
        rows = conn.execute(
            f'''
            SELECT a.*, COUNT(CASE WHEN c.approved=0 AND c.rejected=0 THEN 1 END) AS candidate_count
            FROM albums a LEFT JOIN candidates c ON c.album_key=a.album_key
            {where_sql}
            GROUP BY a.album_key
            ORDER BY amw_fold(a.artist), amw_fold(a.album), amw_fold(a.album_path)
            ''',
            args,
        ).fetchall()
    items = [web_album_from_row(row, settings) for row in rows]
    if bucket in {'Needs Work', 'Review', 'Done'}:
        items = [item for item in items if item.get('bucket') == bucket]
    if limit:
        items = items[:limit]
    return {'ok': True, 'albums': items, 'counts': web_queue_counts(settings), 'shown': len(items)}


def web_get_album(album_key: str) -> Dict[str, Any] | None:
    settings = web_get_settings()
    with db_connect() as conn:
        row = conn.execute(
            '''
            SELECT a.*, COUNT(CASE WHEN c.approved=0 AND c.rejected=0 THEN 1 END) AS candidate_count
            FROM albums a LEFT JOIN candidates c ON c.album_key=a.album_key
            WHERE a.album_key=?
            GROUP BY a.album_key
            ''',
            (album_key,),
        ).fetchone()
    return web_album_from_row(row, settings) if row else None


def web_album_problem_files(album_key: str) -> Dict[str, Any]:
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    album_path = safe_path(album.get('album_path') or '')
    settings = web_get_settings()
    target = web_effective_artwork_target(settings)
    result = deep_check(
        album_path,
        target,
        problem_files=True,
        tolerance=target_tolerance(settings.get('target_size_match_mode')),
    )
    return {
        'ok': True,
        'album_key': album_key,
        'target_size': target,
        **result,
        'worker_build': WORKER_BUILD,
        'api': WORKER_API,
        'worker_api': WORKER_API,
    }


def web_row_get(row: sqlite3.Row, key: str, default: Any = None) -> Any:
    try:
        if hasattr(row, 'keys') and key not in row.keys():
            return default
        return row[key]
    except Exception:
        return default


def web_add_history(album_key: str, action: str, payload: Dict[str, Any]) -> None:
    with db_connect() as conn:
        conn.execute(
            'INSERT INTO history(album_key, action, payload, created_at) VALUES(?,?,?,?)',
            (album_key, action, json.dumps(payload or {}), now()),
        )


def web_set_album_status(album_key: str, status: str, reason: str = '', updates: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if not album_key:
        raise ValueError('Missing album key')
    updates = dict(updates or {})
    with db_connect() as conn:
        row = conn.execute('SELECT notes FROM albums WHERE album_key=?', (album_key,)).fetchone()
        notes = web_decode_notes(row['notes']) if row else {}
        if reason:
            notes['status_reason'] = reason
        notes.update(updates)
        conn.execute(
            'UPDATE albums SET status=?, notes=?, last_scanned=? WHERE album_key=?',
            (status, json.dumps(notes), now(), album_key),
        )
    return {'status': status, 'reason': reason}


def web_active_candidate_count(album_key: str) -> int:
    if not album_key:
        return 0
    with db_connect() as conn:
        row = conn.execute(
            'SELECT COUNT(*) AS n FROM candidates WHERE album_key=? AND approved=0 AND rejected=0',
            (album_key,),
        ).fetchone()
    return int(row['n'] if row else 0)


def web_decode_candidate_row(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    d['candidate_id'] = d.get('id')
    try:
        d['warnings'] = json.loads(d.get('warnings') or '[]')
        if not isinstance(d['warnings'], list):
            d['warnings'] = []
    except Exception:
        d['warnings'] = []
    try:
        d['source_meta_json'] = json.loads(d.get('source_meta') or '{}')
        if not isinstance(d['source_meta_json'], dict):
            d['source_meta_json'] = {}
    except Exception:
        d['source_meta_json'] = {}
    d['score'] = int(d.get('score') or 0)
    d['source_detail'] = d.get('source_detail') or ''
    d['score_summary'] = d.get('score_summary') or ''
    d['release_title'] = d.get('release_title') or ''
    d['release_mbid'] = d.get('release_mbid') or ''
    d['candidate_state'] = d.get('candidate_state') or ('approved' if d.get('approved') else ('rejected' if d.get('rejected') else 'available'))
    d['state_reason'] = d.get('state_reason') or ''
    d['state_updated_at'] = d.get('state_updated_at') or ''
    d['album_folder'] = web_row_get(row, 'album_folder', d.get('album_path') or '')
    d['artist'] = web_row_get(row, 'artist', '')
    d['album'] = web_row_get(row, 'album', '')
    return d


def web_public_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    meta = candidate.get('source_meta_json') or {}
    source_page = meta.get('source_page') or meta.get('collectionViewUrl') or meta.get('link') or ''
    warnings = [str(w) for w in (candidate.get('warnings') or []) if str(w).strip()]
    return {
        'candidate_id': candidate.get('candidate_id') or candidate.get('id'),
        'album_key': candidate.get('album_key') or '',
        'source': candidate.get('source') or '',
        'source_detail': candidate.get('source_detail') or '',
        'width': candidate.get('width') or 0,
        'height': candidate.get('height') or 0,
        'size_label': f"{candidate.get('width') or '?'} x {candidate.get('height') or '?'}",
        'source_url': candidate.get('source_url') or '',
        'source_page': source_page,
        'release_title': candidate.get('release_title') or '',
        'release_mbid': candidate.get('release_mbid') or '',
        'source_meta': meta,
        'warnings': warnings,
        'score': int(candidate.get('score') or 0),
        'score_summary': candidate.get('score_summary') or '',
        'candidate_state': candidate.get('candidate_state') or 'available',
        'state_reason': candidate.get('state_reason') or '',
        'created_at': candidate.get('created_at') or '',
    }


def web_list_candidates(album_key: str, include_rejected: bool = False) -> List[Dict[str, Any]]:
    if not album_key:
        return []
    query = '''
        SELECT c.*, a.artist, a.album, a.album_path AS album_folder
        FROM candidates c LEFT JOIN albums a ON a.album_key=c.album_key
        WHERE c.album_key=? AND c.approved=0
    '''
    args: List[Any] = [album_key]
    if not include_rejected:
        query += ' AND c.rejected=0'
    query += ' ORDER BY COALESCE(c.score,0) DESC, c.id ASC'
    with db_connect() as conn:
        rows = conn.execute(query, args).fetchall()
    return [web_decode_candidate_row(row) for row in rows]


def web_get_candidate(candidate_id: Any) -> Dict[str, Any] | None:
    try:
        cid = int(candidate_id)
    except Exception:
        return None
    with db_connect() as conn:
        row = conn.execute(
            '''
            SELECT c.*, a.artist, a.album, a.album_path AS album_folder
            FROM candidates c LEFT JOIN albums a ON a.album_key=c.album_key
            WHERE c.id=?
            ''',
            (cid,),
        ).fetchone()
    return web_decode_candidate_row(row) if row else None


def web_data_path(value: Any) -> Path:
    path = Path(str(value or '')).resolve(strict=False)
    root = DATA_ROOT.resolve(strict=False)
    try:
        path.relative_to(root)
    except ValueError:
        raise ValueError('Candidate file is outside the app data folder')
    return path


def web_candidate_artwork(candidate_id: Any) -> Tuple[bytes, str]:
    candidate = web_get_candidate(candidate_id)
    if not candidate:
        raise FileNotFoundError('candidate not found')
    path = web_data_path(candidate.get('image_path'))
    if not path.is_file():
        raise FileNotFoundError('candidate artwork file is missing')
    mime = mimetypes.guess_type(str(path))[0] or 'image/jpeg'
    if mime not in {'image/jpeg', 'image/png', 'image/webp'}:
        mime = 'image/jpeg'
    return path.read_bytes(), mime


def web_mark_candidate(candidate_id: Any, approved: bool | None = None, rejected: bool | None = None, state_reason: str = '') -> None:
    sets = []
    vals: List[Any] = []
    if approved is not None:
        sets.append('approved=?')
        vals.append(1 if approved else 0)
    if rejected is not None:
        sets.append('rejected=?')
        vals.append(1 if rejected else 0)
    state = ''
    reason = state_reason or ''
    if approved is True:
        state = 'approved'
        reason = reason or 'Approved by user'
    elif rejected is True:
        state = 'superseded' if 'superseded' in reason.lower() else 'rejected'
        reason = reason or 'Rejected by user'
    elif approved is False and rejected is False:
        state = 'available'
        reason = reason or 'Available for review'
    if state:
        sets.extend(['candidate_state=?', 'state_reason=?', 'state_updated_at=?'])
        vals.extend([state, reason, now()])
    if not sets:
        return
    vals.append(int(candidate_id))
    with db_connect() as conn:
        conn.execute(f'UPDATE candidates SET {", ".join(sets)} WHERE id=?', vals)


def web_mark_album_candidates(album_key: str, approved: bool | None = None, rejected: bool | None = None, except_candidate_id: Any = None, state_reason: str = '') -> None:
    sets = []
    vals: List[Any] = []
    if approved is not None:
        sets.append('approved=?')
        vals.append(1 if approved else 0)
    if rejected is not None:
        sets.append('rejected=?')
        vals.append(1 if rejected else 0)
    state = ''
    reason = state_reason or ''
    if approved is True:
        state = 'approved'
        reason = reason or 'Approved by user'
    elif rejected is True:
        state = 'superseded' if 'superseded' in reason.lower() else 'rejected'
        reason = reason or 'Rejected by user'
    elif approved is False and rejected is False:
        state = 'available'
        reason = reason or 'Available for review'
    if state:
        sets.extend(['candidate_state=?', 'state_reason=?', 'state_updated_at=?'])
        vals.extend([state, reason, now()])
    if not sets:
        return
    query = f'UPDATE candidates SET {", ".join(sets)} WHERE album_key=?'
    vals.append(album_key)
    if except_candidate_id is not None:
        query += ' AND id<>?'
        vals.append(int(except_candidate_id))
    with db_connect() as conn:
        conn.execute(query, vals)


def web_add_candidate(album_key: str, candidate: Dict[str, Any]) -> int:
    candidate = dict(candidate or {})
    source = str(candidate.get('source') or '').strip()
    source_url = str(candidate.get('source_url') or '').strip()
    image_path = str(candidate.get('image_path') or '').strip()
    if not album_key or not source or not image_path:
        raise ValueError('Candidate is missing required fields')
    source_meta = candidate.get('source_meta') or {}
    if not isinstance(source_meta, str):
        source_meta = json.dumps(source_meta)
    with db_connect() as conn:
        if source_url:
            existing = conn.execute(
                'SELECT id FROM candidates WHERE album_key=? AND source=? AND source_url=?',
                (album_key, source, source_url),
            ).fetchone()
            if existing:
                return int(existing['id'])
        existing = conn.execute(
            'SELECT id FROM candidates WHERE album_key=? AND source=? AND image_path=?',
            (album_key, source, image_path),
        ).fetchone()
        if existing:
            return int(existing['id'])
        state_now = now()
        conn.execute(
            '''
            INSERT INTO candidates(
              album_key, source, image_path, width, height, source_url, source_detail,
              release_title, release_mbid, source_meta, warnings, score, score_summary,
              candidate_state, state_reason, state_updated_at, created_at
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ''',
            (
                album_key,
                source,
                image_path,
                candidate.get('width'),
                candidate.get('height'),
                source_url,
                candidate.get('source_detail') or '',
                candidate.get('release_title') or '',
                candidate.get('release_mbid') or '',
                source_meta,
                json.dumps(candidate.get('warnings') or []),
                int(candidate.get('score') or 0),
                candidate.get('score_summary') or '',
                candidate.get('candidate_state') or 'available',
                candidate.get('state_reason') or 'Downloaded and ready for review',
                state_now,
                state_now,
            ),
        )
        return int(conn.execute('SELECT last_insert_rowid()').fetchone()[0])


def web_safe_filename(value: Any) -> str:
    value = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^A-Za-z0-9._ -]+', '_', value).strip(' ._-')
    value = re.sub(r'\s+', ' ', value)
    return value[:140] or 'artwork'


def web_word_set(value: Any) -> set[str]:
    return {part for part in normalize_for_match(str(value or '')).split() if part}


def web_text_matches(found: Any, wanted: Any, *, loose: bool = False) -> bool:
    found_n = normalize_for_match(clean_album_name(str(found or '')))
    wanted_n = normalize_for_match(clean_album_name(str(wanted or '')))
    if not wanted_n:
        return True
    if not found_n:
        return False
    if found_n == wanted_n or wanted_n in found_n or found_n in wanted_n:
        return True
    found_words = web_word_set(found_n)
    wanted_words = web_word_set(wanted_n)
    if len(wanted_words) >= 2 and wanted_words.issubset(found_words):
        return True
    ratio = difflib.SequenceMatcher(None, found_n, wanted_n).ratio()
    return ratio >= (0.78 if loose else 0.84)


def web_artist_matches(found: Any, wanted: Any) -> bool:
    if web_text_matches(found, wanted, loose=True):
        return True
    found_words = web_word_set(found)
    wanted_words = web_word_set(wanted)
    return bool(wanted_words and wanted_words.issubset(found_words))


def web_year_matches(found_year: Any, wanted_year: Any) -> bool:
    if not wanted_year or not found_year:
        return True
    try:
        return abs(int(str(found_year)[:4]) - int(str(wanted_year)[:4])) <= 2
    except Exception:
        return True


def web_release_matches(found_artist: Any, found_album: Any, found_year: Any, album: Dict[str, Any]) -> bool:
    artist = album.get('search_artist') or album.get('artist') or ''
    title = album.get('search_album') or album.get('album') or ''
    wanted_year = album.get('year') or ''
    if not web_text_matches(found_album, title, loose=True):
        return False
    if not web_artist_matches(found_artist, artist):
        return False
    return web_year_matches(found_year, wanted_year)


def web_quality_for_image(path: Path, width: int, height: int, target_size: int) -> Dict[str, Any]:
    warnings = []
    score = 35
    min_side = min(int(width or 0), int(height or 0))
    max_side = max(int(width or 0), int(height or 0))
    if width and height:
        score += min(34, int((min_side / max(1, target_size)) * 34))
    if width == height and width:
        score += 18
    else:
        warnings.append('Not square')
        score -= 12
    if not scan_artwork_meets_target_size(width, height, target_size, target_tolerance('Relaxed')):
        warnings.append(f'Below target {target_size}px')
        score -= 18
    if min_side and max_side and min_side < max(1, int(max_side * 0.85)):
        warnings.append('Very rectangular')
        score -= 8
    try:
        if path.stat().st_size < 55_000:
            warnings.append('Small file')
            score -= 6
    except Exception:
        pass
    score = max(0, min(100, score))
    summary = f'{width} x {height} - {score}/100'
    return {'warnings': warnings, 'score': score, 'score_summary': summary}


def web_http_json(session: requests.Session, url: str, timeout: int = 12) -> Dict[str, Any] | None:
    for attempt in range(3):
        try:
            response = session.get(url, timeout=timeout)
            if response.status_code in (429, 503):
                time.sleep(1.2 * (attempt + 1))
                continue
            if response.status_code != 200:
                return None
            data = response.json()
            return data if isinstance(data, dict) else None
        except Exception:
            time.sleep(0.8 * (attempt + 1))
    return None


def web_candidate_extension(content_type: str, url: str) -> str:
    ctype = (content_type or '').lower()
    if 'png' in ctype:
        return '.png'
    if 'webp' in ctype:
        return '.webp'
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return suffix
    return '.jpg'


def web_download_candidate_image(
    session: requests.Session,
    album: Dict[str, Any],
    source: str,
    source_detail: str,
    image_url: str,
    release_title: str,
    release_mbid: str,
    source_meta: Dict[str, Any],
    settings: Dict[str, Any],
    option_index: int,
) -> Dict[str, Any] | None:
    if not image_url:
        return None
    try:
        response = session.get(image_url, timeout=20)
    except Exception:
        return None
    if response.status_code != 200 or not response.content:
        return None
    dims = image_dimensions_from_bytes(response.content)
    if not dims:
        return None
    width, height = int(dims[0] or 0), int(dims[1] or 0)
    target = int(settings.get('preferred_artwork_size') or settings.get('scan_min_artwork_size') or 1000)
    fetch_min = int(settings.get('scan_min_artwork_size') or target)
    if not scan_artwork_meets_target_size(width, height, fetch_min, target_tolerance(settings.get('target_size_match_mode'))):
        return None
    album_key = str(album.get('album_key') or '')
    dest_dir = TEMP_CANDIDATE_DIR / album_key
    dest_dir.mkdir(parents=True, exist_ok=True)
    ext = web_candidate_extension(response.headers.get('Content-Type') or '', image_url)
    base = web_safe_filename(f"{album.get('artist')} - {clean_album_name(album.get('album') or '')} - {source} - {option_index}")
    dest = dest_dir / f'{base}{ext}'
    counter = 1
    while dest.exists():
        dest = dest_dir / f'{base}_{counter}{ext}'
        counter += 1
    dest.write_bytes(response.content)
    quality = web_quality_for_image(dest, width, height, target)
    return {
        'source': source,
        'image_path': str(dest),
        'width': width,
        'height': height,
        'source_url': image_url,
        'source_detail': source_detail,
        'release_title': release_title,
        'release_mbid': release_mbid,
        'source_meta': source_meta,
        'warnings': quality['warnings'],
        'score': quality['score'],
        'score_summary': quality['score_summary'],
    }


def web_import_image_bytes(payload: Dict[str, Any]) -> Tuple[bytes, str, str, str]:
    filename = str(payload.get('filename') or '').strip()
    content_type = str(payload.get('mime') or '').strip()
    source_url = str(payload.get('source_url') or '').strip()
    image_b64 = str(payload.get('image_b64') or '').strip()
    if image_b64:
        if image_b64.startswith('data:') and ',' in image_b64:
            header, image_b64 = image_b64.split(',', 1)
            content_type = content_type or header[5:].split(';', 1)[0]
        try:
            data = base64.b64decode(image_b64, validate=True)
        except Exception as exc:
            raise ValueError(f'Image upload could not be read: {exc}') from exc
    elif source_url:
        session = requests.Session()
        session.headers.update({'User-Agent': f'ArtworkManagerNAS/{WORKER_BUILD}', 'Accept': 'image/*,*/*;q=0.8'})
        response = session.get(source_url, timeout=25)
        if response.status_code != 200 or not response.content:
            raise ValueError('Image URL could not be downloaded')
        data = response.content
        content_type = content_type or response.headers.get('Content-Type') or ''
        filename = filename or Path(urlparse(source_url).path).name
    else:
        raise ValueError('Choose an image to import')
    if len(data) > 25_000_000:
        raise ValueError('Image is too large for import')
    if not image_dimensions_from_bytes(data):
        raise ValueError('That file is not readable artwork')
    return data, filename, content_type, source_url


def web_image_extension(data: bytes, content_type: str, fallback_name: str) -> str:
    fmt = str((image_format_info(data) or {}).get('format') or '').upper()
    ext = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}.get(fmt)
    if ext:
        return ext
    return web_candidate_extension(content_type, fallback_name)


def web_add_manual_candidate(payload: Dict[str, Any]) -> Dict[str, Any]:
    album_key = str(payload.get('album_key') or '').strip()
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    data, filename, content_type, source_url = web_import_image_bytes(payload)
    dims = image_dimensions_from_bytes(data)
    if not dims:
        raise ValueError('That file is not readable artwork')
    width, height = int(dims[0] or 0), int(dims[1] or 0)
    settings = web_get_settings()
    target = web_effective_artwork_target(settings)
    dest_dir = TEMP_CANDIDATE_DIR / album_key
    dest_dir.mkdir(parents=True, exist_ok=True)
    ext = web_image_extension(data, content_type, filename or source_url)
    if ext not in IMAGE_EXTENSIONS:
        ext = '.jpg'
    label = filename or 'Imported image'
    base = web_safe_filename(f"{album.get('artist')} - {clean_album_name(album.get('album') or '')} - Import")
    dest = dest_dir / f'{base}{ext}'
    counter = 1
    while dest.exists():
        dest = dest_dir / f'{base}_{counter}{ext}'
        counter += 1
    dest.write_bytes(data)
    quality = web_quality_for_image(dest, width, height, target)
    candidate_id = web_add_candidate(album_key, {
        'source': 'Import',
        'image_path': str(dest),
        'width': width,
        'height': height,
        'source_url': source_url,
        'source_detail': 'Manual image',
        'release_title': label,
        'release_mbid': '',
        'source_meta': {
            'filename': filename,
            'source_page': source_url,
            'imported_at': now(),
        },
        'warnings': quality['warnings'],
        'score': quality['score'],
        'score_summary': quality['score_summary'],
        'state_reason': 'Imported and ready for review',
    })
    count = web_active_candidate_count(album_key)
    web_set_album_status(album_key, 'candidate_found', f'{count} artwork option(s) ready.', {'last_manual_import_at': now()})
    web_add_history(album_key, 'web_manual_import', {
        'candidate_id': candidate_id,
        'filename': filename,
        'source_url': source_url,
        'width': width,
        'height': height,
    })
    candidates = [web_public_candidate(c) for c in web_list_candidates(album_key)]
    return {
        'ok': True,
        'candidate_id': candidate_id,
        'candidate_count': count,
        'candidates': candidates,
        'album': web_get_album(album_key),
    }


def web_cleanup_candidate_file(candidate: Dict[str, Any]) -> None:
    try:
        path = web_data_path(candidate.get('image_path'))
        if path.is_file():
            path.unlink()
    except Exception:
        pass


def web_deezer_candidates(album: Dict[str, Any], max_candidates: int, settings: Dict[str, Any]) -> List[Dict[str, Any]]:
    session = requests.Session()
    session.headers.update({'User-Agent': f'ArtworkManagerNAS/{WORKER_BUILD}', 'Accept': 'application/json'})
    artist = album.get('search_artist') or album.get('artist') or ''
    title = album.get('search_album') or album.get('album') or ''
    term = quote_plus(' '.join(x for x in (artist, clean_album_name(title)) if x).strip())
    if not term:
        return []
    data = web_http_json(session, f'https://api.deezer.com/search/album?q={term}&limit=15')
    results = data.get('data') if isinstance(data, dict) else []
    out: List[Dict[str, Any]] = []
    seen_urls = set()
    for item in results or []:
        if len(out) >= max_candidates:
            break
        item_artist = ((item.get('artist') or {}) if isinstance(item.get('artist'), dict) else {}).get('name') or ''
        item_title = item.get('title') or ''
        item_year = str(item.get('release_date') or item.get('release_year') or '')[:4]
        if not web_release_matches(item_artist, item_title, item_year, album):
            continue
        for detail, image_url in (
            ('XL cover', item.get('cover_xl') or ''),
            ('Large cover', item.get('cover_big') or ''),
            ('Medium cover', item.get('cover_medium') or ''),
        ):
            if len(out) >= max_candidates:
                break
            if not image_url or image_url in seen_urls:
                continue
            seen_urls.add(image_url)
            cand = web_download_candidate_image(
                session,
                album,
                'Deezer',
                detail,
                image_url,
                item_title + (f' ({item_year})' if item_year else ''),
                f"deezer:{item.get('id')}" if item.get('id') else '',
                {
                    'source_artist': item_artist,
                    'source_title': item_title,
                    'source_year': item_year,
                    'source_page': item.get('link') or '',
                    'explicit': item.get('explicit_lyrics'),
                },
                settings,
                len(out) + 1,
            )
            if cand:
                out.append(cand)
    return out


def web_itunes_artwork_variants(url: str) -> List[Tuple[str, str]]:
    out = []
    if not url:
        return out
    for size in (1400, 1200, 1000, 600):
        variant = re.sub(r'\d+x\d+(bb|cc|bf|sr)?\.(jpg|jpeg|png|webp)$', f'{size}x{size}bb.\\2', url)
        if variant == url:
            variant = re.sub(r'\d+x\d+', f'{size}x{size}', url)
        if variant and variant not in [v for _label, v in out]:
            out.append((f'{size}px artwork', variant))
    if url not in [v for _label, v in out]:
        out.append(('API artwork', url))
    return out


def web_itunes_candidates(album: Dict[str, Any], max_candidates: int, settings: Dict[str, Any]) -> List[Dict[str, Any]]:
    session = requests.Session()
    session.headers.update({'User-Agent': f'ArtworkManagerNAS/{WORKER_BUILD}', 'Accept': 'application/json'})
    artist = album.get('search_artist') or album.get('artist') or ''
    title = album.get('search_album') or album.get('album') or ''
    term = quote_plus(' '.join(x for x in (artist, clean_album_name(title)) if x).strip())
    if not term:
        return []
    data = web_http_json(session, f'https://itunes.apple.com/search?term={term}&media=music&entity=album&limit=15')
    results = data.get('results') if isinstance(data, dict) else []
    out: List[Dict[str, Any]] = []
    seen_urls = set()
    for item in results or []:
        if len(out) >= max_candidates:
            break
        if item.get('wrapperType') not in ('collection', None):
            continue
        item_artist = item.get('artistName') or ''
        item_title = item.get('collectionName') or ''
        release_date = item.get('releaseDate') or ''
        item_year = str(release_date)[:4]
        if not web_release_matches(item_artist, item_title, item_year, album):
            continue
        for detail, image_url in web_itunes_artwork_variants(item.get('artworkUrl100') or ''):
            if len(out) >= max_candidates:
                break
            if not image_url or image_url in seen_urls:
                continue
            seen_urls.add(image_url)
            cand = web_download_candidate_image(
                session,
                album,
                'iTunes',
                detail,
                image_url,
                item_title + (f' ({item_year})' if item_year else ''),
                f"itunes:{item.get('collectionId')}" if item.get('collectionId') else '',
                {
                    'source_artist': item_artist,
                    'source_title': item_title,
                    'source_year': item_year,
                    'release_date': release_date,
                    'country': item.get('country') or '',
                    'genre': item.get('primaryGenreName') or '',
                    'track_count': item.get('trackCount') or '',
                    'source_page': item.get('collectionViewUrl') or '',
                },
                settings,
                len(out) + 1,
            )
            if cand:
                out.append(cand)
    return out


def web_search_artwork_for_album(album_key: str, max_candidates: Any = None, job_id: str = '') -> Dict[str, Any]:
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    settings = web_get_settings()
    target_total = web_int(max_candidates or settings.get('max_candidates_per_album'), 5, 1, 25)
    existing = web_list_candidates(album_key, include_rejected=False)
    if len(existing) >= target_total:
        web_set_album_status(album_key, 'candidate_found', f'{len(existing)} artwork option(s) ready.')
        return {'ok': True, 'candidate_count': len(existing), 'candidates': [web_public_candidate(c) for c in existing]}
    web_set_album_status(album_key, 'searching', 'Searching Deezer and Apple artwork.')
    update_job(job_id, label=f"Searching {album.get('artist')} — {album.get('album')}", candidate_count=len(existing))

    providers = []
    if web_bool(settings.get('deezer_enabled'), True):
        providers.append(('Deezer', web_deezer_candidates))
    if web_bool(settings.get('itunes_enabled'), True):
        providers.append(('iTunes', web_itunes_candidates))
    if not providers:
        web_set_album_status(album_key, 'no_candidate', 'No artwork providers are enabled.')
        return {'ok': True, 'candidate_count': len(existing), 'candidates': [web_public_candidate(c) for c in existing], 'message': 'No artwork providers are enabled.'}

    provider_limit = max(1, target_total - len(existing))
    fetched: List[Dict[str, Any]] = []
    max_workers = max(1, min(len(providers), int(settings.get('parallel_provider_workers') or 2)))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(provider, album, provider_limit, settings): name
            for name, provider in providers
        }
        for future, name in list(futures.items()):
            try:
                items = future.result()
            except Exception as exc:
                update_job(job_id, last_provider_error=f'{name}: {exc}')
                items = []
            fetched.extend(items or [])
            update_job(job_id, candidate_count=len(existing) + len(fetched), last_provider=name)

    known_urls = {str(c.get('source_url') or '') for c in web_list_candidates(album_key, include_rejected=True)}
    saved_ids = []
    for cand in sorted(fetched, key=lambda item: int(item.get('score') or 0), reverse=True):
        if web_active_candidate_count(album_key) >= target_total:
            web_cleanup_candidate_file(cand)
            continue
        source_url = str(cand.get('source_url') or '')
        if source_url and source_url in known_urls:
            web_cleanup_candidate_file(cand)
            continue
        try:
            cid = web_add_candidate(album_key, cand)
            saved_ids.append(cid)
            if source_url:
                known_urls.add(source_url)
        except Exception:
            web_cleanup_candidate_file(cand)

    candidates = web_list_candidates(album_key, include_rejected=False)
    if candidates:
        reason = f'{len(candidates)} artwork option(s) ready.'
        web_set_album_status(album_key, 'candidate_found', reason, {'last_search_at': now(), 'last_search_saved': len(saved_ids)})
    else:
        reason = 'No suitable artwork found. Try Google Images or lower the minimum artwork size.'
        web_set_album_status(album_key, 'no_candidate', reason, {'last_search_at': now(), 'last_search_saved': 0})
    web_add_history(album_key, 'web_artwork_search', {'saved_candidate_ids': saved_ids, 'candidate_count': len(candidates)})
    update_job(job_id, candidate_count=len(candidates), saved_candidate_ids=saved_ids)
    return {'ok': True, 'candidate_count': len(candidates), 'saved_candidate_ids': saved_ids, 'candidates': [web_public_candidate(c) for c in candidates]}


def start_web_artwork_search(payload: Dict[str, Any]) -> Dict[str, Any]:
    album_key = str(payload.get('album_key') or '').strip()
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    job_id, started_mono, _album_folder = begin_job('artwork-search', {
        'album_folder': album.get('album_path') or '',
        'album_key': album_key,
        'artist': album.get('artist') or '',
        'album': album.get('album') or '',
    })

    def worker() -> None:
        try:
            result = web_search_artwork_for_album(album_key, max_candidates=payload.get('max_candidates'), job_id=job_id)
            finish_job(job_id, started_mono, True, result=result)
        except Exception as exc:
            try:
                web_set_album_status(album_key, 'needs_review', f'Artwork search failed: {exc}')
            except Exception:
                pass
            finish_job(job_id, started_mono, False, error=str(exc))

    threading.Thread(target=worker, name=f'ArtworkManagerSearch-{job_id}', daemon=True).start()
    return {'ok': True, 'job_id': job_id, 'message': 'Artwork search started on the NAS.'}


def web_approve_candidate(album_key: str, candidate_id: Any, job_id: str = '') -> Dict[str, Any]:
    album = web_get_album(album_key)
    candidate = web_get_candidate(candidate_id)
    if not album:
        raise ValueError('Album not found')
    if not candidate or str(candidate.get('album_key') or '') != str(album_key):
        raise ValueError('Candidate not found for this album')
    if int(candidate.get('rejected') or 0):
        raise ValueError('Candidate has already been rejected')
    image_bytes, _mime = web_candidate_artwork(candidate_id)
    settings = web_get_settings()
    folder = safe_path(album.get('album_path') or '')
    target = int(settings.get('preferred_artwork_size') or settings.get('scan_min_artwork_size') or 1000)
    max_embed = int(settings.get('max_embedded_artwork_size') or target or 0)
    update_job(job_id, label=f"Embedding {album.get('artist')} — {album.get('album')}")
    result = embed_album_job({
        'album_folder': str(folder),
        'album_key': album_key,
        'image_b64': base64.b64encode(image_bytes).decode('ascii'),
        'backup': bool(settings.get('backup_before_embed')),
        'save_folder_cover': bool(settings.get('save_approved_artwork_to_album_folder')),
        'embed': True,
        'max_artwork_size': max_embed or None,
        'make_square': True,
    })
    failed = result.get('failed') or []
    total = int(result.get('total') or 0)
    updated = int(result.get('updated') or 0)
    if total <= 0:
        raise ValueError('No supported audio files found in this album folder')
    deep_result = deep_check(folder, target, problem_files=False, tolerance=target_tolerance(settings.get('target_size_match_mode')))
    deep = deep_result.get('deep_file_check') or {}
    ok = bool(updated and not failed and not deep.get('requires_action'))
    status = 'approved' if ok else 'incompatible_artwork'
    if ok:
        reason = f'Embedded {updated}/{total} tracks.'
    elif failed:
        reason = f'Updated {updated}/{total} tracks; {len(failed)} file(s) failed.'
    else:
        reason = deep_check_summary(deep) or 'Artwork embedded, but a follow-up check still found an issue.'
    notes_update = {
        'status_reason': reason,
        'deep_file_check': deep,
        'last_approval': {
            'candidate_id': int(candidate_id),
            'source': candidate.get('source') or '',
            'score': int(candidate.get('score') or 0),
            'width': candidate.get('width'),
            'height': candidate.get('height'),
            'updated': updated,
            'total': total,
            'approved_at': now(),
        },
    }
    with db_connect() as conn:
        row = conn.execute('SELECT notes FROM albums WHERE album_key=?', (album_key,)).fetchone()
        notes = web_decode_notes(row['notes']) if row else {}
        notes.update(notes_update)
        conn.execute(
            'UPDATE albums SET status=?, width=?, height=?, notes=?, last_scanned=? WHERE album_key=?',
            (
                status,
                result.get('image_width') or candidate.get('width'),
                result.get('image_height') or candidate.get('height'),
                json.dumps(notes),
                now(),
                album_key,
            ),
        )
    web_mark_candidate(candidate_id, approved=True, rejected=False, state_reason='Approved and embedded')
    web_mark_album_candidates(album_key, rejected=True, except_candidate_id=candidate_id, state_reason='Superseded by approved artwork')
    web_add_history(album_key, 'web_approve_embed', {'candidate_id': int(candidate_id), 'result': result, 'deep_file_check': deep})
    return {
        'ok': ok,
        'status': status,
        'reason': reason,
        'result': result,
        'deep_file_check': deep,
        'album': web_get_album(album_key),
    }


def web_convert_current_artwork(album_key: str, job_id: str = '') -> Dict[str, Any]:
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    image_bytes, _mime = web_current_artwork(album_key)
    settings = web_get_settings()
    folder = safe_path(album.get('album_path') or '')
    target = int(settings.get('preferred_artwork_size') or settings.get('scan_min_artwork_size') or 1000)
    max_embed = int(settings.get('max_embedded_artwork_size') or target or 0)
    update_job(job_id, label=f"Converting {album.get('artist')} — {album.get('album')}")
    result = embed_album_job({
        'album_folder': str(folder),
        'album_key': album_key,
        'image_b64': base64.b64encode(image_bytes).decode('ascii'),
        'backup': bool(settings.get('backup_before_embed')),
        'save_folder_cover': bool(settings.get('save_approved_artwork_to_album_folder')),
        'embed': True,
        'max_artwork_size': max_embed or None,
        'make_square': True,
    })
    failed = result.get('failed') or []
    total = int(result.get('total') or 0)
    updated = int(result.get('updated') or 0)
    if total <= 0:
        raise ValueError('No supported audio files found in this album folder')
    deep_result = deep_check(folder, target, problem_files=False, tolerance=target_tolerance(settings.get('target_size_match_mode')))
    deep = deep_result.get('deep_file_check') or {}
    ok = bool(updated and not failed and not deep.get('requires_action'))
    status = 'already_good' if ok else 'incompatible_artwork'
    if ok:
        reason = f'Converted current artwork for {updated}/{total} tracks.'
    elif failed:
        reason = f'Converted {updated}/{total} tracks; {len(failed)} file(s) failed.'
    else:
        reason = deep_check_summary(deep) or 'Current artwork was converted, but a follow-up check still found an issue.'
    notes_update = {
        'status_reason': reason,
        'deep_file_check': deep,
        'last_convert_current': {
            'updated': updated,
            'total': total,
            'converted_at': now(),
            'target': target,
            'image_width': result.get('image_width'),
            'image_height': result.get('image_height'),
        },
    }
    with db_connect() as conn:
        row = conn.execute('SELECT notes FROM albums WHERE album_key=?', (album_key,)).fetchone()
        notes = web_decode_notes(row['notes']) if row else {}
        notes.update(notes_update)
        conn.execute(
            'UPDATE albums SET status=?, width=?, height=?, notes=?, last_scanned=? WHERE album_key=?',
            (
                status,
                result.get('image_width') or album.get('width'),
                result.get('image_height') or album.get('height'),
                json.dumps(notes),
                now(),
                album_key,
            ),
        )
    web_add_history(album_key, 'web_convert_current', {'result': result, 'deep_file_check': deep})
    return {
        'ok': ok,
        'status': status,
        'reason': reason,
        'result': result,
        'deep_file_check': deep,
        'album': web_get_album(album_key),
    }


def start_web_convert_current(payload: Dict[str, Any]) -> Dict[str, Any]:
    album_key = str(payload.get('album_key') or '').strip()
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    job_id, started_mono, _album_folder = begin_job('convert-current', {
        'album_folder': album.get('album_path') or '',
        'album_key': album_key,
        'artist': album.get('artist') or '',
        'album': album.get('album') or '',
    })

    def worker() -> None:
        try:
            result = web_convert_current_artwork(album_key, job_id=job_id)
            finish_job(job_id, started_mono, True, result=result)
        except Exception as exc:
            finish_job(job_id, started_mono, False, error=str(exc))

    threading.Thread(target=worker, name=f'ArtworkManagerConvertCurrent-{job_id}', daemon=True).start()
    return {'ok': True, 'job_id': job_id, 'message': 'Convert current artwork started on the NAS.'}


def start_web_approve(payload: Dict[str, Any]) -> Dict[str, Any]:
    album_key = str(payload.get('album_key') or '').strip()
    candidate_id = payload.get('candidate_id')
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    job_id, started_mono, _album_folder = begin_job('approve-embed', {
        'album_folder': album.get('album_path') or '',
        'album_key': album_key,
        'artist': album.get('artist') or '',
        'album': album.get('album') or '',
    })

    def worker() -> None:
        try:
            result = web_approve_candidate(album_key, candidate_id, job_id=job_id)
            finish_job(job_id, started_mono, True, result=result)
        except Exception as exc:
            finish_job(job_id, started_mono, False, error=str(exc))

    threading.Thread(target=worker, name=f'ArtworkManagerApprove-{job_id}', daemon=True).start()
    return {'ok': True, 'job_id': job_id, 'message': 'Approve and embed started on the NAS.'}


def web_reject_candidate(payload: Dict[str, Any]) -> Dict[str, Any]:
    album_key = str(payload.get('album_key') or '').strip()
    candidate_id = payload.get('candidate_id')
    candidate = web_get_candidate(candidate_id)
    if not candidate or str(candidate.get('album_key') or '') != album_key:
        raise ValueError('Candidate not found for this album')
    web_mark_candidate(candidate_id, approved=False, rejected=True, state_reason='Rejected in web app')
    remaining = web_active_candidate_count(album_key)
    if remaining:
        web_set_album_status(album_key, 'candidate_found', f'{remaining} artwork option(s) ready.')
    else:
        web_set_album_status(album_key, 'no_candidate', 'No saved artwork options left.')
    web_add_history(album_key, 'web_reject_candidate', {'candidate_id': int(candidate_id), 'remaining_candidates': remaining})
    return {'ok': True, 'remaining_candidates': remaining, 'candidates': [web_public_candidate(c) for c in web_list_candidates(album_key)]}


def web_album_simple_action(album_key: str, status: str, reason: str, action: str) -> Dict[str, Any]:
    album = web_get_album(album_key)
    if not album:
        raise ValueError('Album not found')
    web_set_album_status(album_key, status, reason)
    web_add_history(album_key, action, {'status': status, 'reason': reason})
    return {'ok': True, 'album': web_get_album(album_key)}


def web_current_artwork(album_key: str) -> Tuple[bytes, str]:
    album = web_get_album(album_key)
    if not album:
        raise FileNotFoundError('album not found')
    folder = safe_path(album.get('album_path') or '')
    if not folder.is_dir():
        raise FileNotFoundError('album folder not found')
    candidates = []
    example = str(album.get('example_file') or '')
    if example:
        candidates.append(folder / example)
    candidates.extend(iter_music_files(folder))
    seen = set()
    for path in candidates:
        key = str(path)
        if key in seen or not path.is_file():
            continue
        seen.add(key)
        for art in embedded_artwork(path):
            data = art.get('bytes')
            if data:
                fmt = str(art.get('format') or '').upper()
                mime = 'image/png' if fmt == 'PNG' else 'image/jpeg'
                return data, mime
    raise FileNotFoundError('no embedded artwork')


def web_default_scan_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    settings = web_get_settings()
    scan_min = web_int(payload.get('scan_min_artwork_size') or settings.get('scan_min_artwork_size'), 1000, 200, 5000)
    preferred = web_int(payload.get('preferred_artwork_size') or settings.get('preferred_artwork_size') or scan_min, scan_min, 200, 5000)
    root = str(payload.get('library_root') or settings.get('library_root') or (str(MUSIC_ROOTS[0]) if MUSIC_ROOTS else '/music'))
    deep_scan = web_bool(payload.get('deep_scan_all_files'), web_bool(settings.get('deep_scan_all_files'), False))
    resume = web_bool(payload.get('resume'), web_bool(settings.get('resume_scans'), True))
    return {
        'library_root': root,
        'album_folder': root,
        'include_missing': web_bool(payload.get('include_missing'), web_bool(settings.get('include_missing'), True)),
        'resume': resume,
        'deep_scan_all_files': deep_scan,
        'scan_min_artwork_size': scan_min,
        'preferred_artwork_size': preferred,
        'target_size_match_mode': payload.get('target_size_match_mode') or settings.get('target_size_match_mode') or 'Relaxed',
        'save_approved_artwork_to_album_folder': web_bool(payload.get('save_approved_artwork_to_album_folder'), web_bool(settings.get('save_approved_artwork_to_album_folder'), False)),
        'max_workers': web_int(payload.get('max_workers') or settings.get('scan_worker_threads'), 8, 1, 32),
        'known_albums': [] if deep_scan or not resume else web_existing_album_resume_info(),
    }


def start_web_scan(payload: Dict[str, Any]) -> Dict[str, Any]:
    scan_payload = web_default_scan_payload(payload)
    root = safe_path(scan_payload.get('library_root') or '')
    scan_payload['library_root'] = str(root)
    scan_payload['album_folder'] = str(root)
    reset_result: Dict[str, Any] = {}
    if web_bool(payload.get('fresh_database'), False):
        reset_result = web_clear_queue_database()
        scan_payload['resume'] = False
        scan_payload['known_albums'] = []
        scan_payload['fresh_database'] = True
    job_id, started_mono, _album = begin_job('scan-library', scan_payload)

    def worker() -> None:
        try:
            result = scan_library_job(scan_payload, job_id=job_id)
            applied = web_apply_scan_result(result)
            result['web_queue'] = applied
            finish_job(job_id, started_mono, True, result=result)
        except Exception as exc:
            finish_job(job_id, started_mono, False, error=str(exc))

    threading.Thread(target=worker, name=f'ArtworkManagerWebScan-{job_id}', daemon=True).start()
    return {
        'ok': True,
        'job_id': job_id,
        'database_reset': reset_result,
        'message': 'Fresh scan started on the NAS worker.' if reset_result else 'Scan started on the NAS worker.',
    }


def web_status_payload() -> Dict[str, Any]:
    payload = status_payload(public=False)
    payload['web_app'] = {
        'enabled': True,
        'data_root': str(DATA_ROOT),
        'db_path': str(DB_PATH),
        'counts': web_queue_counts(),
        'music_roots': [str(path) for path in MUSIC_ROOTS],
        'backup_root': str(BACKUP_ROOT),
        'settings': web_get_settings(),
        'token_required': bool(API_TOKEN),
    }
    return payload


def target_tolerance(mode: Any) -> float:
    return 1.0 if str(mode or '').strip().lower() == 'strict' else 0.98


def scan_artwork_meets_target_size(width: Any, height: Any, target_size: Any, tolerance: float = 1.0) -> bool:
    try:
        w, h, target = int(width or 0), int(height or 0), int(target_size or 0)
    except Exception:
        return False
    if target <= 0:
        return True
    if w <= 0 or h <= 0:
        return False
    if w >= target and h >= target:
        return True
    if max(w, h) >= target and min(w, h) >= int(round(target * float(tolerance or 1.0))):
        return True
    return False


def image_dimensions_path(path: Path):
    try:
        with Image.open(path) as img:
            return img.size
    except Exception:
        return None


def album_folder_cover_status(album_path: Path, target_size: int, folder_files: List[str] | None, tolerance: float) -> Dict[str, Any]:
    candidate_names = ('cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp')
    if folder_files is not None:
        by_lower = {str(name).lower(): str(name) for name in folder_files}
        existing_name = next((by_lower.get(name) for name in candidate_names if by_lower.get(name)), '')
        existing = album_path / existing_name if existing_name else None
    else:
        if not album_path.is_dir():
            return {'ok': False, 'issue': 'album folder unavailable', 'path': ''}
        existing = next((album_path / name for name in candidate_names if (album_path / name).is_file()), None)
    if not existing:
        return {'ok': False, 'issue': 'folder cover missing', 'path': ''}
    dims = image_dimensions_path(existing)
    try:
        compat = image_format_info(existing.read_bytes())
    except Exception as exc:
        compat = {'compatible': False, 'issue': f'cannot read file: {exc}'}
    if existing.suffix.lower() != '.jpg':
        return {'ok': False, 'issue': f'folder cover is {existing.suffix.lstrip(".").upper() or "non-JPG"}', 'path': str(existing), 'dimensions': dims}
    if not compat.get('compatible'):
        return {'ok': False, 'issue': f'folder cover {compat.get("issue") or "not baseline JPEG"}', 'path': str(existing), 'dimensions': dims}
    if not dims:
        return {'ok': False, 'issue': 'folder cover unreadable', 'path': str(existing)}
    if not scan_artwork_meets_target_size(dims[0], dims[1], target_size, tolerance):
        return {'ok': False, 'issue': f'folder cover below target ({dims[0]}×{dims[1]})', 'path': str(existing), 'dimensions': dims}
    return {'ok': True, 'issue': '', 'path': str(existing), 'dimensions': dims}


def iter_music_files(album_folder: Path):
    for root, _, files in os.walk(album_folder):
        for fn in sorted(files):
            if fn.lower().endswith(MUSIC_EXTENSIONS):
                yield Path(root) / fn


def image_dimensions_from_bytes(data: bytes):
    try:
        with Image.open(BytesIO(data)) as img:
            return img.size
    except Exception:
        return None


def image_format_info(data: bytes) -> Dict[str, Any]:
    try:
        with Image.open(BytesIO(data)) as img:
            fmt = (img.format or '').upper()
            is_jpeg = fmt == 'JPEG'
            progressive = bool(img.info.get('progressive') or img.info.get('progression'))
            baseline = bool(is_jpeg and not progressive)
            return {
                'format': fmt,
                'is_baseline_jpeg': baseline,
                'is_progressive_jpeg': bool(is_jpeg and progressive),
                'compatible': baseline,
                'issue': '' if baseline else ('progressive JPEG' if is_jpeg and progressive else (fmt or 'not JPEG')),
            }
    except Exception:
        return {'format': '', 'is_baseline_jpeg': False, 'is_progressive_jpeg': False, 'compatible': False, 'issue': 'unreadable artwork'}


def fit_to_square_canvas(img: Image.Image, target: int) -> Image.Image:
    target = max(1, int(target or max(img.size)))
    work = ImageOps.exif_transpose(img).convert('RGB')
    w, h = work.size
    scale = min(target / max(1, w), target / max(1, h))
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    if (new_w, new_h) != (w, h):
        resample = getattr(Image.Resampling, 'LANCZOS', getattr(Image, 'LANCZOS', 3))
        work = work.resize((new_w, new_h), resample)
    canvas = Image.new('RGB', (target, target), (255, 255, 255))
    canvas.paste(work, ((target - new_w) // 2, (target - new_h) // 2))
    return canvas


def prepare_jpeg_bytes_from_bytes(source: bytes, max_size: int | None = None, make_square: bool = False) -> Tuple[bytes, str]:
    with Image.open(BytesIO(source)) as img:
        img = ImageOps.exif_transpose(img).convert('RGB')
        if make_square:
            target = int(max_size or max(img.size))
            img = fit_to_square_canvas(img, target)
        elif max_size:
            max_size = int(max_size)
            w, h = img.size
            if max(w, h) != max_size:
                scale = max_size / max(1, max(w, h))
                new = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
                resample = getattr(Image.Resampling, 'LANCZOS', getattr(Image, 'LANCZOS', 3))
                img = img.resize(new, resample)
        out = BytesIO()
        # optimize=False avoids Pillow writing progressive JPEGs unless asked.
        img.save(out, format='JPEG', quality=95, progressive=False, optimize=False)
        return out.getvalue(), 'image/jpeg'


def artwork_item(data: bytes):
    dims = image_dimensions_from_bytes(data)
    if not dims:
        return None
    compat = image_format_info(data)
    return {
        'width': dims[0],
        'height': dims[1],
        'bytes': data,
        'format': compat.get('format') or '',
        'is_baseline_jpeg': bool(compat.get('is_baseline_jpeg')),
        'is_progressive_jpeg': bool(compat.get('is_progressive_jpeg')),
        'compatible': bool(compat.get('compatible')),
        'compatibility_issue': compat.get('issue') or '',
    }


def embedded_artwork(path: Path):
    ext = path.suffix.lower()
    out = []
    try:
        if ext == '.mp3':
            audio = ID3(str(path))
            for tag in audio.values():
                if getattr(tag, 'FrameID', None) == 'APIC':
                    item = artwork_item(tag.data)
                    if item:
                        out.append(item)
        elif ext == '.flac':
            audio = FLAC(str(path))
            for pic in audio.pictures:
                item = artwork_item(pic.data)
                if item:
                    out.append(item)
        elif ext in ('.m4a', '.mp4'):
            audio = MP4(str(path))
            covr = audio.tags.get('covr', []) if audio.tags else []
            for cover in covr:
                item = artwork_item(bytes(cover))
                if item:
                    out.append(item)
    except Exception:
        pass
    return out


def embed_file(path: Path, image_bytes: bytes, mime='image/jpeg') -> bool:
    ext = path.suffix.lower()
    if ext == '.mp3':
        try:
            audio = ID3(str(path))
        except ID3NoHeaderError:
            audio = ID3()
        audio.delall('APIC')
        audio.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=image_bytes))
        audio.save(str(path), v2_version=3)
        return True
    if ext == '.flac':
        audio = FLAC(str(path))
        audio.clear_pictures()
        pic = Picture()
        pic.type = 3
        pic.mime = mime
        pic.desc = 'Cover'
        pic.data = image_bytes
        try:
            with Image.open(BytesIO(image_bytes)) as img:
                pic.width, pic.height = img.size
                pic.depth = len(img.getbands()) * 8
        except Exception:
            pass
        audio.add_picture(pic)
        audio.save()
        return True
    if ext in ('.m4a', '.mp4'):
        audio = MP4(str(path))
        if audio.tags is None:
            audio.add_tags()
        audio.tags['covr'] = [MP4Cover(image_bytes, imageformat=MP4Cover.FORMAT_JPEG)]
        audio.save()
        return True
    return False


def backup_file(path: Path, album_key: str) -> str:
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe = ''.join(ch if ch.isalnum() or ch in ' ._-' else '_' for ch in (album_key or 'album'))[:120]
    dest_dir = BACKUP_ROOT / safe / stamp
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / path.name
    shutil.copy2(path, dest)
    return str(dest)


def save_cover(album_folder: Path, image_bytes: bytes, max_size: int | None = None, make_square: bool = False) -> str:
    data, _ = prepare_jpeg_bytes_from_bytes(image_bytes, max_size=max_size, make_square=make_square)
    out = album_folder / 'cover.jpg'
    out.write_bytes(data)
    for stale_name in ('cover.jpeg', 'cover.png', 'cover.webp'):
        stale = album_folder / stale_name
        if stale.exists() and stale.is_file():
            try:
                stale.unlink()
            except Exception:
                pass
    return str(out)


def embed_album_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    album_folder = safe_path(payload.get('album_folder') or '')
    if not album_folder.is_dir():
        raise ValueError('Album folder does not exist inside the container')
    source = base64.b64decode(payload.get('image_b64') or '')
    max_size = payload.get('max_artwork_size') or None
    make_square = bool(payload.get('make_square'))
    embed = bool(payload.get('embed', True))
    backup = bool(payload.get('backup'))
    save_folder = bool(payload.get('save_folder_cover'))
    album_key = payload.get('album_key') or str(album_folder)
    prepared, mime = prepare_jpeg_bytes_from_bytes(source, max_size=max_size, make_square=make_square)
    dims = image_dimensions_from_bytes(prepared) or (None, None)
    files = list(iter_music_files(album_folder))
    backups = []
    failed = []
    updated = 0
    if embed:
        if not files:
            return {
                'album_folder': str(album_folder), 'updated': 0, 'total': 0, 'failed': [], 'backups': [],
                'image_width': dims[0], 'image_height': dims[1], 'no_audio_files': True,
                'message': 'No supported audio files found in album folder',
            }
        for fp in files:
            try:
                if backup:
                    backups.append({'file': str(fp), 'backup': backup_file(fp, album_key)})
                if embed_file(fp, prepared, mime):
                    updated += 1
            except Exception as exc:
                failed.append({'file': str(fp), 'error': str(exc)})
    album_artwork_copy = ''
    if save_folder:
        try:
            album_artwork_copy = save_cover(album_folder, source, max_size=max_size, make_square=make_square)
        except Exception as exc:
            failed.append({'file': str(album_folder), 'error': f'Folder cover copy failed: {exc}'})
    return {
        'album_folder': str(album_folder),
        'updated': updated,
        'total': len(files) if embed else 0,
        'failed': failed,
        'backups': backups,
        'image_width': dims[0],
        'image_height': dims[1],
        'album_artwork_copy': album_artwork_copy,
    }


def artwork_meets_target_size(w: int, h: int, target: int, tolerance: float = 1.0) -> bool:
    return scan_artwork_meets_target_size(w, h, target, tolerance)


def deep_check(album_folder: Path, target_size: int, problem_files: bool = False, tolerance: float = 1.0) -> Dict[str, Any]:
    files = list(iter_music_files(album_folder))
    result = {
        'enabled': True,
        'target_size': target_size,
        'checked_files': 0,
        'missing_count': 0,
        'below_target_count': 0,
        'incompatible_count': 0,
        'unreadable_count': 0,
        'non_square_count': 0,
        'ok_count': 0,
        'first_issue_file': '',
        'first_issue': '',
        'first_non_square_file': '',
        'first_non_square_dimensions': '',
        'min_width': None,
        'min_height': None,
        'example_file': '',
        'example_width': None,
        'example_height': None,
        'checked_at': now(),
        'source': 'nas-worker',
    }
    problems = []

    def note_issue(fn: str, issue: str):
        if not result['first_issue_file']:
            result['first_issue_file'] = fn
            result['first_issue'] = issue

    for fp in files:
        fn = fp.name
        issues = []
        result['checked_files'] += 1
        arts = embedded_artwork(fp)
        if not arts:
            result['missing_count'] += 1
            note_issue(fn, 'missing embedded artwork')
            issues.append('missing embedded artwork')
            if problem_files:
                problems.append({'file': fn, 'dimensions': '', 'issues': issues})
            continue
        best = None
        file_incompatible = False
        file_incompat_issue = ''
        for art in arts:
            try:
                area = int(art.get('width') or 0) * int(art.get('height') or 0)
            except Exception:
                area = 0
            if best is None or area > int(best.get('width') or 0) * int(best.get('height') or 0):
                best = art
            if not art.get('compatible'):
                file_incompatible = True
                file_incompat_issue = file_incompat_issue or art.get('compatibility_issue') or 'not baseline JPEG'
        if file_incompatible:
            result['incompatible_count'] += 1
            note_issue(fn, file_incompat_issue)
            issues.append(file_incompat_issue)
        if not best:
            result['unreadable_count'] += 1
            note_issue(fn, 'unreadable embedded artwork')
            issues.append('unreadable embedded artwork')
            if problem_files:
                problems.append({'file': fn, 'dimensions': '', 'issues': issues})
            continue
        w, h = int(best.get('width') or 0), int(best.get('height') or 0)
        dims = f'{w}×{h}' if w and h else ''
        if w <= 0 or h <= 0:
            result['unreadable_count'] += 1
            note_issue(fn, 'unreadable embedded artwork')
            issues.append('unreadable embedded artwork')
            if problem_files:
                problems.append({'file': fn, 'dimensions': dims, 'issues': issues})
            continue
        if result['example_width'] is None:
            result['example_file'] = fn
            result['example_width'] = w
            result['example_height'] = h
        if result['min_width'] is None or min(w, h) < min(int(result['min_width'] or 0), int(result['min_height'] or 0)):
            result['min_width'] = w
            result['min_height'] = h
            result['example_file'] = fn
            result['example_width'] = w
            result['example_height'] = h
        file_not_square = (w != h)
        file_below = not artwork_meets_target_size(w, h, target_size, tolerance)
        if file_not_square:
            result['non_square_count'] += 1
            if not result['first_non_square_file']:
                result['first_non_square_file'] = fn
                result['first_non_square_dimensions'] = dims
            issues.append('not square')
        if file_below:
            result['below_target_count'] += 1
            note_issue(fn, f'below target ({dims})')
            issues.append(f'below target {target_size}px')
        if not file_incompatible and not file_not_square and not file_below:
            result['ok_count'] += 1
        elif problem_files:
            problems.append({'file': fn, 'dimensions': dims, 'issues': issues})
    result['requires_action'] = bool(result['missing_count'] or result['below_target_count'] or result['non_square_count'] or result['incompatible_count'] or result['unreadable_count'])
    return {'deep_file_check': result, 'problem_files': problems}


def deep_check_summary(check: Dict[str, Any]) -> str:
    if not check:
        return ''
    bits = []
    checked = int(check.get('checked_files') or 0)
    if check.get('missing_count'):
        bits.append(f"{check.get('missing_count')}/{checked} missing")
    if check.get('below_target_count'):
        bits.append(f"{check.get('below_target_count')}/{checked} below target")
    if check.get('non_square_count'):
        bits.append(f"{check.get('non_square_count')}/{checked} not square")
    if check.get('incompatible_count'):
        bits.append(f"{check.get('incompatible_count')}/{checked} not baseline")
    if check.get('unreadable_count'):
        bits.append(f"{check.get('unreadable_count')}/{checked} unreadable")
    return '; '.join(bits) or f'{checked} file(s) OK'


def analyze_scan_album(
    folder: Path,
    library_root: Path,
    files: List[str],
    music: List[str],
    fingerprint: Dict[str, Any],
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    include_missing = bool(settings.get('include_missing', True))
    deep_scan_enabled = bool(settings.get('deep_scan_all_files'))
    scan_min = int(settings.get('scan_min_artwork_size') or 1000)
    preferred = int(settings.get('preferred_artwork_size') or scan_min or 1000)
    min_artwork_size = preferred if deep_scan_enabled else scan_min
    tolerance = target_tolerance(settings.get('target_size_match_mode'))
    identity = inspect_album_identity(folder, library_root, music)
    notes = dict(identity.get('notes') or {})
    notes['scan_fingerprint'] = fingerprint
    identity['notes'] = notes
    artist = str(identity.get('artist') or '')
    album = str(identity.get('album') or '')
    album_path = get_album_path(folder, library_root)

    album_low = False
    album_incompatible = False
    album_not_square = False
    folder_cover_issue = ''
    folder_cover_status: Dict[str, Any] | None = None
    compatibility_issue = ''
    example = ''
    dims: Tuple[Any, Any] = (None, None)

    if deep_scan_enabled:
        deep = deep_check(folder, preferred, problem_files=False, tolerance=tolerance).get('deep_file_check') or {}
        notes = dict(identity.get('notes') or {})
        notes['deep_file_check'] = deep
        identity['notes'] = notes
        example = deep.get('first_issue_file') or deep.get('example_file') or (music[0] if music else '')
        dims = (
            deep.get('example_width') or deep.get('min_width'),
            deep.get('example_height') or deep.get('min_height'),
        )
        if deep.get('missing_count') or deep.get('unreadable_count'):
            album_low = True
            if deep.get('missing_count') and not dims[0]:
                dims = (None, None)
        if deep.get('below_target_count'):
            album_low = True
        if deep.get('non_square_count'):
            album_not_square = True
        if deep.get('incompatible_count'):
            album_incompatible = True
            compatibility_issue = deep_check_summary(deep) or 'embedded artwork needs conversion'
    else:
        for name in music:
            arts = embedded_artwork(folder / name)
            if not arts:
                example = example or name
                if include_missing:
                    album_low = True
                    dims = (None, None)
                continue
            for art in arts:
                w, h = art['width'], art['height']
                if dims == (None, None):
                    dims = (w, h)
                    example = example or name
                if not scan_artwork_meets_target_size(w, h, min_artwork_size, tolerance):
                    album_low = True
                    example = name
                    dims = (w, h)
                    break
                if w != h:
                    album_not_square = True
                    example = name
                    dims = (w, h)
                    break
                if not art.get('compatible'):
                    album_incompatible = True
                    example = name
                    dims = (w, h)
                    compatibility_issue = art.get('compatibility_issue') or 'not baseline JPEG'
                    break
            if album_low or album_not_square or album_incompatible:
                break

    if settings.get('save_approved_artwork_to_album_folder'):
        cover_files = files if path_resume_key(folder) == path_resume_key(album_path) else None
        folder_cover_status = album_folder_cover_status(album_path, preferred, cover_files, tolerance)
        if not folder_cover_status.get('ok'):
            album_incompatible = True
            folder_cover_issue = folder_cover_status.get('issue') or 'folder cover missing'
            compatibility_issue = compatibility_issue or folder_cover_issue

    notes = dict(identity.get('notes') or {})
    if album_incompatible:
        notes['artwork_compatibility'] = {
            'issue': compatibility_issue or 'one or more files need baseline JPEG conversion',
            'needs_conversion': True,
            'format': compatibility_issue or 'scan check',
        }
    if folder_cover_issue:
        notes['album_folder_cover'] = {
            'needs_save': True,
            'issue': folder_cover_issue,
            'path': (folder_cover_status or {}).get('path') or '',
            'checked_at': now(),
        }
    identity['notes'] = notes
    requires_action = bool(album_low or album_not_square or album_incompatible)
    return {
        'artist': artist,
        'album': album,
        'album_path': str(album_path),
        'search_artist': identity.get('search_artist') or artist,
        'search_album': identity.get('search_album') or album,
        'year': identity.get('year') or '',
        'mb_release_id': identity.get('mb_release_id') or '',
        'mb_releasegroup_id': identity.get('mb_releasegroup_id') or '',
        'identity_confidence': identity.get('identity_confidence') or '',
        'track_count': identity.get('track_count') or len(music),
        'width': dims[0],
        'height': dims[1],
        'example_file': example or '',
        'requires_action': requires_action,
        'scan_fingerprint': fingerprint,
        'identity': identity,
    }


def scan_library_job(payload: Dict[str, Any], job_id: str = '') -> Dict[str, Any]:
    library_root = safe_path(payload.get('library_root') or '')
    if not library_root.is_dir():
        raise ValueError('Library root does not exist inside the container')
    resume = bool(payload.get('resume', True))
    deep_scan = bool(payload.get('deep_scan_all_files'))
    settings = {
        'include_missing': bool(payload.get('include_missing', True)),
        'deep_scan_all_files': deep_scan,
        'scan_min_artwork_size': int(payload.get('scan_min_artwork_size') or 1000),
        'preferred_artwork_size': int(payload.get('preferred_artwork_size') or payload.get('scan_min_artwork_size') or 1000),
        'target_size_match_mode': payload.get('target_size_match_mode') or 'Relaxed',
        'save_approved_artwork_to_album_folder': bool(payload.get('save_approved_artwork_to_album_folder')),
    }
    scan_rules = scan_rules_fingerprint(settings)
    known_by_path: Dict[str, Dict[str, Any]] = {}
    if resume and not deep_scan:
        for item in payload.get('known_albums') or []:
            if not isinstance(item, dict):
                continue
            album_path = str(item.get('album_path') or '')
            if not album_path:
                continue
            known_by_path[album_path] = item
            known_by_path[path_resume_key(album_path)] = item

    max_workers = max(1, min(int(payload.get('max_workers') or 4), 32))
    if deep_scan:
        max_workers = min(max_workers, 8)
    max_pending = max(1, max_workers * 3)
    max_albums = int(payload.get('max_albums') or 0)
    submitted_paths = set()
    albums: List[Dict[str, Any]] = []
    fingerprint_updates: List[Dict[str, Any]] = []
    processed = 0
    skipped = 0
    backfilled = 0
    queued = 0
    changed = 0
    last_action_label = ''
    current_album_path = ''
    progress_last = 0.0

    def publish_progress(phase: str = 'scanning', force: bool = False) -> None:
        nonlocal progress_last
        if not job_id:
            return
        now_mono = time.monotonic()
        if not force and now_mono - progress_last < 1.0:
            return
        progress_last = now_mono
        progress = {
            'phase': phase,
            'processed_albums': processed,
            'changed_albums': changed,
            'queued_albums': queued,
            'skipped_unchanged': skipped,
            'fingerprints_backfilled': backfilled,
            'pending_albums': len(pending),
            'current_album_path': current_album_path,
            'last_action_label': last_action_label,
            'deep_scan': deep_scan,
            'max_workers': max_workers,
        }
        update_job(
            job_id,
            scan_progress=progress,
            processed_albums=processed,
            changed_albums=changed,
            queued_albums=queued,
            skipped_unchanged=skipped,
            fingerprints_backfilled=backfilled,
            label=f'Scanning {library_root.name or library_root}',
        )

    def collect_done(done) -> None:
        nonlocal queued, changed, last_action_label
        for fut in done:
            item = fut.result()
            albums.append(item)
            changed += 1
            if item.get('requires_action'):
                queued += 1
                artist = str(item.get('artist') or '').strip()
                album = str(item.get('album') or '').strip()
                if artist and album:
                    last_action_label = f'{artist} - {album}'
                else:
                    last_action_label = str(item.get('album_path') or '')
            publish_progress('scanning', force=True)

    pending = set()
    publish_progress('starting', force=True)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for root_text, dirs, files in os.walk(library_root):
            dirs[:] = sort_names(dirs)
            files = sort_names(files)
            music = [name for name in files if str(name).lower().endswith(MUSIC_EXTENSIONS)]
            if not music:
                continue
            folder = Path(root_text)
            album_path = get_album_path(folder, library_root)
            album_path_key = path_resume_key(album_path)
            if album_path_key in submitted_paths:
                continue
            submitted_paths.add(album_path_key)
            if max_albums and processed >= max_albums:
                break
            processed += 1
            current_album_path = str(album_path)
            publish_progress('walking')

            existing = known_by_path.get(str(album_path)) or known_by_path.get(album_path_key)
            fingerprint = None
            if existing and resume and not deep_scan:
                saved_fingerprint = existing.get('scan_fingerprint')
                fingerprint = folder_music_fingerprint(folder, music, scan_rules)
                if saved_fingerprint:
                    if fingerprint_matches(saved_fingerprint, fingerprint):
                        skipped += 1
                        publish_progress('walking')
                        continue
                else:
                    album_key = str(existing.get('album_key') or '')
                    if album_key:
                        fingerprint_updates.append({
                            'fingerprint_update': True,
                            'album_key': album_key,
                            'album_path': str(album_path),
                            'scan_fingerprint': fingerprint,
                        })
                    backfilled += 1
                    publish_progress('walking')
                    continue
            if fingerprint is None:
                fingerprint = folder_music_fingerprint(folder, music, scan_rules)

            pending.add(executor.submit(analyze_scan_album, folder, library_root, files, music, fingerprint, settings))
            if len(pending) >= max_pending:
                done, pending = wait(pending, return_when=FIRST_COMPLETED)
                collect_done(done)

        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            collect_done(done)

    albums.sort(key=lambda item: (alpha_key(item.get('artist')), alpha_key(item.get('album')), alpha_key(item.get('album_path'))))
    publish_progress('finishing', force=True)
    return {
        'library_root': str(library_root),
        'processed_albums': processed,
        'changed_albums': len(albums),
        'queued_albums': queued,
        'skipped_unchanged': skipped,
        'fingerprints_backfilled': backfilled,
        'albums': albums,
        'fingerprint_updates': fingerprint_updates,
        'worker_build': WORKER_BUILD,
        'api': WORKER_API,
        'worker_api': WORKER_API,
        'source': 'nas-worker-scan',
    }


def path_check(album_folder: Path, requested_album_folder: str = '') -> Dict[str, Any]:
    """Cheap mapping/read/write self-test for one album folder."""
    result = {
        'requested_album_folder': str(requested_album_folder or ''),
        'album_folder': str(album_folder),
        'unicode_normalized_match': bool(requested_album_folder and str(requested_album_folder) != str(album_folder)),
        'exists': False,
        'is_dir': False,
        'readable': False,
        'writable': False,
        'write_test_ok': False,
        'file_count': 0,
        'supported_music_file_count': 0,
        'sample_files': [],
        'music_roots': [str(x) for x in MUSIC_ROOTS],
        'checked_at': now(),
    }
    try:
        result['exists'] = album_folder.exists()
        result['is_dir'] = album_folder.is_dir()
        result['readable'] = os.access(album_folder, os.R_OK)
        result['writable'] = os.access(album_folder, os.W_OK)
        names = []
        if result['is_dir'] and result['readable']:
            names = sorted(os.listdir(album_folder), key=lambda x: x.lower())
            result['file_count'] = len(names)
            samples = []
            music_count = 0
            for name in names:
                fp = album_folder / name
                if fp.is_file() and name.lower().endswith(MUSIC_EXTENSIONS):
                    music_count += 1
                    if len(samples) < 8:
                        samples.append(name)
            result['supported_music_file_count'] = music_count
            result['sample_files'] = samples
        if result['is_dir'] and result['writable']:
            probe = album_folder / '.amw_path_check_write_test'
            try:
                probe.write_text(now(), encoding='utf-8')
                probe.unlink(missing_ok=True)
                result['write_test_ok'] = True
            except Exception as exc:
                result['write_test_error'] = str(exc)
    except Exception as exc:
        result['error'] = str(exc)
    return result


class Handler(BaseHTTPRequestHandler):
    server_version = f'ArtworkManagerNASWorker/{WORKER_BUILD}'

    def _send(self, status: int, obj: Dict[str, Any]):
        data = json.dumps(obj, indent=2, sort_keys=True).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Artwork-Worker-Build', WORKER_BUILD)
        self.send_header('X-Artwork-Worker-API', str(WORKER_API))
        self.end_headers()
        self.wfile.write(data)

    def _send_bytes(self, status: int, data: bytes, content_type: str, cache: str = 'no-store') -> None:
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', cache)
        self.send_header('X-Artwork-Worker-Build', WORKER_BUILD)
        self.send_header('X-Artwork-Worker-API', str(WORKER_API))
        self.end_headers()
        self.wfile.write(data)

    def _redirect(self, location: str) -> None:
        self.send_response(302)
        self.send_header('Location', location)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    def _wants_html(self) -> bool:
        accept = self.headers.get('Accept') or ''
        return 'text/html' in accept or 'application/xhtml+xml' in accept

    def _send_web_asset(self, route: str) -> None:
        if route in ('/app', '/app/'):
            rel = 'index.html'
        else:
            rel = unquote(route[5:] if route.startswith('/app/') else route).strip('/')
        if not rel:
            rel = 'index.html'
        target = (WEB_ROOT / rel).resolve(strict=False)
        root = WEB_ROOT.resolve(strict=False)
        try:
            target.relative_to(root)
        except ValueError:
            self._send(404, {'ok': False, 'error': 'not found', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
            return
        if not target.is_file():
            self._send(404, {'ok': False, 'error': 'not found', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
            return
        content_type = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        if target.name == 'index.html':
            content_type = 'text/html; charset=utf-8'
        elif target.suffix == '.css':
            content_type = 'text/css; charset=utf-8'
        elif target.suffix == '.js':
            content_type = 'application/javascript; charset=utf-8'
        self._send_bytes(200, target.read_bytes(), content_type, cache='no-cache')

    def do_HEAD(self):
        parsed = urlparse(self.path)
        raw_route = parsed.path or '/'
        if raw_route == '/' and self._wants_html():
            self.send_response(302)
            self.send_header('Location', '/app/')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return
        self.send_response(200 if raw_route in ('/', '/version', '/app/') else 404)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    def _auth_ok(self):
        if not API_TOKEN:
            return True
        return self.headers.get('X-Artwork-Worker-Token') == API_TOKEN

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get('Content-Length') or 0)
        raw = self.rfile.read(length) if length else b'{}'
        return json.loads(raw.decode('utf-8') or '{}')

    def do_GET(self):
        parsed = urlparse(self.path)
        raw_route = parsed.path or '/'
        route = raw_route.rstrip('/') or '/'
        params = parse_qs(parsed.query)
        if route == '/favicon.ico':
            self.send_response(204)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return
        if raw_route == '/app':
            self._redirect('/app/')
            return
        if raw_route == '/' and self._wants_html():
            self._redirect('/app/')
            return
        if raw_route == '/app/' or raw_route.startswith('/app/'):
            self._send_web_asset(raw_route)
            return
        if route == '/api/app/status':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            self._send(200, web_status_payload())
            return
        if route == '/api/settings':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            self._send(200, {
                'ok': True,
                'settings': web_get_settings(),
                'music_roots': [str(path) for path in MUSIC_ROOTS],
                'backup_root': str(BACKUP_ROOT),
                'data_root': str(DATA_ROOT),
                'token_required': bool(API_TOKEN),
                'worker_build': WORKER_BUILD,
                'api': WORKER_API,
                'worker_api': WORKER_API,
            })
            return
        if route == '/api/albums':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            self._send(200, web_query_albums(params))
            return
        if route == '/api/candidates':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            album_key = (params.get('album_key') or [''])[0]
            include_rejected = web_bool((params.get('include_rejected') or ['false'])[0], False)
            candidates = [web_public_candidate(c) for c in web_list_candidates(album_key, include_rejected=include_rejected)]
            self._send(200, {'ok': True, 'album_key': album_key, 'candidates': candidates, 'candidate_count': len(candidates)})
            return
        if route == '/api/album/problems':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            album_key = (params.get('album_key') or [''])[0]
            try:
                self._send(200, web_album_problem_files(album_key))
            except Exception as exc:
                self._send(404, {'ok': False, 'error': str(exc), 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
            return
        if route == '/api/artwork/current':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            album_key = (params.get('album_key') or [''])[0]
            try:
                data, mime = web_current_artwork(album_key)
            except Exception as exc:
                self._send(404, {'ok': False, 'error': str(exc), 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            self._send_bytes(200, data, mime)
            return
        if route == '/api/artwork/candidate':
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            candidate_id = (params.get('candidate_id') or [''])[0]
            try:
                data, mime = web_candidate_artwork(candidate_id)
            except Exception as exc:
                self._send(404, {'ok': False, 'error': str(exc), 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            self._send_bytes(200, data, mime)
            return
        if route in ('/', '/version'):
            payload = status_payload(public=True)
            payload['message'] = 'Worker is running. Open /app/ in a browser for the NAS web UI, or use /status with the API token for authenticated checks.'
            self._send(200, payload)
            return
        if route in ('/health', '/status'):
            if not self._auth_ok():
                self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API, 'message': 'Worker is running, but this endpoint requires the API token. Use Test NAS Worker in the Mac app.'})
                return
            self._send(200, status_payload(public=False))
            return
        self._send(404, {'ok': False, 'error': 'not found', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API, 'message': 'Worker is running, but this endpoint does not exist.', 'endpoints': status_payload(public=True)['endpoints']})

    def do_POST(self):
        if not self._auth_ok():
            self._send(401, {'ok': False, 'error': 'unauthorized', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
            return
        job_id = ''
        started_mono = 0.0
        try:
            payload = self._read_json()
            route = self.path.rstrip('/')
            route = urlparse(route).path.rstrip('/')
            if route == '/api/settings':
                settings = web_save_settings(payload)
                self._send(200, {'ok': True, 'settings': settings, 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            if route == '/api/scan/start':
                result = start_web_scan(payload)
                self._send(200, result)
                return
            if route == '/api/library/clear':
                result = web_clear_queue_database()
                self._send(200, {'ok': True, **result, 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            if route == '/api/artwork/search':
                result = start_web_artwork_search(payload)
                self._send(200, result)
                return
            if route == '/api/artwork/import':
                result = web_add_manual_candidate(payload)
                self._send(200, result)
                return
            if route == '/api/artwork/approve':
                result = start_web_approve(payload)
                self._send(200, result)
                return
            if route == '/api/artwork/convert-current':
                result = start_web_convert_current(payload)
                self._send(200, result)
                return
            if route == '/api/artwork/reject':
                result = web_reject_candidate(payload)
                self._send(200, result)
                return
            if route == '/api/album/skip':
                album_key = str(payload.get('album_key') or '').strip()
                result = web_album_simple_action(album_key, 'reviewed_skipped', 'Skipped for now.', 'web_skip_album')
                self._send(200, result)
                return
            if route == '/api/album/mark-good':
                album_key = str(payload.get('album_key') or '').strip()
                result = web_album_simple_action(album_key, 'already_good', 'Marked good.', 'web_mark_good')
                self._send(200, result)
                return
            if route == '/path-check':
                album_folder = safe_path(payload.get('album_folder') or '')
                result = path_check(album_folder, requested_album_folder=str(payload.get('album_folder') or ''))
                self._send(200, {'ok': True, 'result': result, 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
                return
            if route == '/scan-library':
                scan_payload = dict(payload)
                scan_payload['album_folder'] = scan_payload.get('library_root') or ''
                job_id, started_mono, _album = begin_job('scan-library', scan_payload)
                result = scan_library_job(payload, job_id=job_id)
                worker = finish_job(job_id, started_mono, True, result=result)
                result['remote_worker'] = True
                result['remote_worker_job_id'] = job_id
                result['remote_worker_build'] = WORKER_BUILD
                result['remote_worker_api'] = WORKER_API
                result['remote_worker_duration_seconds'] = worker.get('duration_seconds')
                self._send(200, {'ok': True, 'result': result, 'worker': worker})
                return
            if route == '/embed':
                job_id, started_mono, _album = begin_job('embed', payload)
                result = embed_album_job(payload)
                worker = finish_job(job_id, started_mono, True, result=result)
                result['remote_worker'] = True
                result['remote_worker_job_id'] = job_id
                result['remote_worker_build'] = WORKER_BUILD
                result['remote_worker_api'] = WORKER_API
                result['remote_worker_duration_seconds'] = worker.get('duration_seconds')
                self._send(200, {'ok': True, 'result': result, 'worker': worker})
                return
            if route == '/deep-check':
                job_id, started_mono, album_folder = begin_job('deep-check', payload)
                target = int(payload.get('target_size') or 1000)
                result = deep_check(Path(album_folder), target, problem_files=bool(payload.get('problem_files')))
                worker = finish_job(job_id, started_mono, True, result=result)
                self._send(200, {'ok': True, **result, 'worker': worker})
                return
            self._send(404, {'ok': False, 'error': 'not found', 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})
        except WorkerBusyError as exc:
            self._send(409, {'ok': False, 'error': str(exc), 'busy': True, 'status': status_payload(public=False)})
        except Exception as exc:
            if job_id:
                finish_job(job_id, started_mono, False, error=str(exc))
            self._send(500, {'ok': False, 'error': str(exc), 'worker_build': WORKER_BUILD, 'api': WORKER_API, 'worker_api': WORKER_API})

    def log_message(self, fmt, *args):
        if os.environ.get('AMW_VERBOSE'):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    init_web_db()
    print(f'{VERSION} listening on {HOST}:{PORT}', flush=True)
    print('Music roots: ' + ', '.join(str(x) for x in MUSIC_ROOTS), flush=True)
    print(f'Web UI: http://{HOST}:{PORT}/app/  Data: {DATA_ROOT}', flush=True)
    print(UPDATE_HINT, flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
