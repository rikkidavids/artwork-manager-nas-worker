# Artwork Manager NAS

NAS-local Docker app for Artwork Manager. It now includes the worker API plus the first browser UI, so scans and queue storage can run directly on the NAS without the Mac desktop app crawling folders over SMB/VPN.

Current worker build: **5.44**
Worker API: **5**

## Why This Repo Exists

This repo publishes a ready-to-run Docker image:

```text
ghcr.io/rikkidavids/artwork-manager-nas-worker:latest
```

Synology Container Manager can then update the worker like a normal container image. GitHub builds the image; the NAS only pulls and restarts it.

The publishing workflow template is included at `github-actions/docker-image.yml`. To activate image publishing, copy that file to `.github/workflows/docker-image.yml` in GitHub or push it from a Git token with `workflow` scope.

Build 5.44 tightens the responsive review layout: Summary/Actions get cleaner spacing, short labels no longer read like sentences, iPad tab-bar height gets more breathing room, and artwork inspection always fits the whole image unless Actual Size is selected.

## Web App Function Plan

- **Queue:** scan the library, skip unchanged folders, filter by All / Needs Work / Review / Done, search the queue, show saved candidate counts, and keep the selected album stable while scans run.
- **Review:** compare current artwork with a candidate, search providers, cycle candidates, approve/embed, reject poor options, skip albums, mark existing artwork good, and open Google Images or the source page when manual checking is needed.
- **Artwork Sources:** Deezer, Apple/iTunes, and MusicBrainz/Cover Art Archive are built in because they are fast/free and need no user account. Browser image upload is included, with Discogs, fanart.tv, and manual URL import still good candidates for later.
- **Library Maintenance:** repair queue states against current artwork rules, clean stale saved artwork options, run deep checks, convert/save current embedded artwork, show problem files, clear and rebuild the local database, and export diagnostics from the web UI.
- **Safety:** keep token access, optional backups before embed, folder-cover saving, clear history, and eventually one-click restore.
- **Clean UI Direction:** keep the queue-left/review-right workbench, avoid dashboard clutter, put counts only where they help decisions, and keep advanced tools behind settings or a simple album tools menu.

## Synology Setup

Create a project folder on the NAS:

```sh
mkdir -p /volume1/docker/artwork-manager-nas-worker
cd /volume1/docker/artwork-manager-nas-worker
```

Download or copy these three files into that folder:

- `docker-compose.yml`
- `.env.example`
- `update_worker.sh`

Create your private settings file:

```sh
cp .env.example .env
vi .env
```

Set:

```text
AMW_TOKEN=use-a-private-token-here
AMW_MUSIC_PATH=/volume2/data/media/music
AMW_BACKUP_PATH=./backups
AMW_DATA_PATH=./data
AMW_HOST_PORT=8765
AMW_AUTO_UPDATE=true
```

Then start/update the worker:

```sh
chmod +x update_worker.sh
./update_worker.sh
```

## Future Updates

If your NAS already runs Watchtower, Artwork Manager is labelled for auto-updates by default:

```yaml
com.centurylinklabs.watchtower.enable: "true"
```

After installing this build once, recreate the Artwork Manager project so the label is applied. If your Watchtower uses label filtering, it will then pick up future `ghcr.io/rikkidavids/artwork-manager-nas-worker:latest` images and recreate this container automatically. If your Watchtower already watches every container, the label is harmless.

To turn this off for Artwork Manager only, set this in `.env`:

```text
AMW_AUTO_UPDATE=false
```

From the NAS project folder:

```sh
./update_worker.sh
```

That manual command remains as a fallback. It pulls the latest GitHub Container Registry image and recreates the container.

You can also update from Synology Container Manager by stopping the project, pulling/updating the image, and starting/rebuilding the project.

## Immediate Updates From GitHub

For immediate updates after a push, enable Watchtower's HTTP API and let GitHub call it once the new image has been published.

Add these environment lines to your existing Watchtower project:

```yaml
- WATCHTOWER_HTTP_API_UPDATE=true
- WATCHTOWER_HTTP_API_TOKEN=use-a-long-private-token
- WATCHTOWER_HTTP_API_PERIODIC_POLLS=true
```

Expose Watchtower's API port only through a private or protected route:

```yaml
ports:
  - "8080:8080"
```

Then add these GitHub repository secrets in `artwork-manager-nas-worker`:

```text
AMW_WATCHTOWER_UPDATE_URL=https://YOUR-PROTECTED-WATCHTOWER-URL/v1/update
AMW_WATCHTOWER_UPDATE_TOKEN=the-same-long-private-token
```

After those secrets exist and the active GitHub workflow contains the trigger step from `github-actions/docker-image.yml`, each push to `main` builds the GHCR image and calls Watchtower immediately. If the secrets are missing, the workflow skips the trigger and still publishes the image normally.

Important: GitHub cannot call a private `192.168.x.x` address. Use a protected HTTPS route, a tunnel, or a self-hosted GitHub runner on the NAS/LAN.

## Verify

Open this from your Mac:

```text
http://YOUR-NAS-IP:8765/app/
```

Open the plain worker status at `http://YOUR-NAS-IP:8765/` without a browser UI check. You should see:

```text
worker_build: "5.44"
api: 5
```

Optional token-protected check:

```sh
python verify_worker.py http://YOUR-NAS-IP:8765 YOUR_TOKEN
```

## Mac App Settings

In Artwork Manager:

```text
Enable NAS worker: on
Worker URL: http://YOUR-NAS-IP:8765
API token: same as AMW_TOKEN
Mac path prefix: /Volumes/data/media/music
Worker path prefix: /music
```

## Security

Keep this worker on your LAN/VPN only. Do not expose port `8765` to the public internet.

If Synology cannot pull the image, check the GitHub package visibility for this repo and make sure the package is public.
