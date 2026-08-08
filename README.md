# Artwork Manager NAS

NAS-local Docker app for Artwork Manager. It now includes the worker API plus the first browser UI, so scans and queue storage can run directly on the NAS without the Mac desktop app crawling folders over SMB/VPN.

Current worker build: **5.14**
Worker API: **5**

## Why This Repo Exists

This repo publishes a ready-to-run Docker image:

```text
ghcr.io/rikkidavids/artwork-manager-nas-worker:latest
```

Synology Container Manager can then update the worker like a normal container image. GitHub builds the image; the NAS only pulls and restarts it.

The publishing workflow template is included at `github-actions/docker-image.yml`. To activate image publishing, copy that file to `.github/workflows/docker-image.yml` in GitHub or push it from a Git token with `workflow` scope.

Build 5.14 keeps the simpler two-pane NAS web workbench and polishes the browser UI: queue counts now live only in the queue filters, rows are denser, dates are friendlier, and the layout has less visual clutter. Provider search and browser-based approve/embed are the next migration step.

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
```

Then start/update the worker:

```sh
chmod +x update_worker.sh
./update_worker.sh
```

## Future Updates

From the NAS project folder:

```sh
./update_worker.sh
```

That pulls the latest GitHub Container Registry image and recreates the container.

You can also update from Synology Container Manager by stopping the project, pulling/updating the image, and starting/rebuilding the project.

## Verify

Open this from your Mac:

```text
http://YOUR-NAS-IP:8765/app/
```

Open the plain worker status at `http://YOUR-NAS-IP:8765/` without a browser UI check. You should see:

```text
worker_build: "5.14"
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
