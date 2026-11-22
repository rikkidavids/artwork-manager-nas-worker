# Artwork Manager NAS

NAS-local Docker app for Artwork Manager. It now includes the worker API plus the first browser UI, so scans and queue storage can run directly on the NAS without the Mac desktop app crawling folders over SMB/VPN.

Current worker build: **5.47**
Worker API: **5**

## Why This Repo Exists

This repo publishes a ready-to-run Docker image:

```text
ghcr.io/rikkidavids/artwork-manager-nas-worker:latest
```

Synology Container Manager can then update the worker like a normal container image. GitHub builds the image; the NAS only pulls and restarts it.

Publishing is automatic: `.github/workflows/docker-image.yml` tests every change and publishes a new image whenever `main` changes. See [Updates](#updates) for how it reaches the NAS.

Build 5.47 refreshes album rows from fresh file checks, keeps mixed-track problems ahead of size-only labels, and fixes artwork inspector fit on small screens.

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

## Updates

Once set up, there is nothing to do on the NAS. Merge a change on GitHub and it is running a few minutes later:

1. **Merge to `main`** (or push to it).
2. **GitHub tests it.** If any test fails, nothing is published and the NAS keeps running the current version.
3. **GitHub builds and publishes** `ghcr.io/rikkidavids/artwork-manager-nas-worker:latest` (about 3-5 minutes).
4. **GitHub tells Watchtower on the NAS to update**, asking only for this image, so your other containers are never touched.
5. **Watchtower pulls the new image and recreates the container.** Your settings, queue and backups live in `./data` and `./backups`, so they carry over.

The build number in the app's header (for example "Build 5.55") shows which version is running.

If GitHub can't reach the NAS, the build still succeeds (with a warning) and Watchtower picks up the new image on its next regular check.

### One-time setup for instant updates

**1. Use the maintained Watchtower.** The original `containrrr/watchtower` was archived in December 2025 and no longer gets fixes. In your existing Watchtower project, change only the image line; everything else stays the same:

```yaml
image: ghcr.io/nicholas-fedor/watchtower:latest
```

**2. Turn on Watchtower's update API.** Add these to the Watchtower project's environment, using a long random token:

```yaml
- WATCHTOWER_HTTP_API_UPDATE=true
- WATCHTOWER_HTTP_API_TOKEN=use-a-long-random-token
- WATCHTOWER_HTTP_API_PERIODIC_POLLS=true
```

and publish its API port on the NAS:

```yaml
ports:
  - "8080:8080"
```

`WATCHTOWER_HTTP_API_PERIODIC_POLLS=true` keeps Watchtower's normal schedule for your other containers.

**3. Give GitHub an HTTPS address for it.** GitHub's servers can't reach a `192.168.x.x` address. In DSM, go to **Control Panel > Login Portal > Advanced > Reverse Proxy** and add a rule from an HTTPS hostname (for example a free `yourname.synology.me` DDNS name with its Let's Encrypt certificate) to `http://localhost:8080`. Forward only that HTTPS port on your router. Watchtower refuses any request without the token.

**4. Add two GitHub secrets.** In this repository, go to **Settings > Secrets and variables > Actions > New repository secret**:

```text
AMW_WATCHTOWER_UPDATE_URL=https://yourname.synology.me/v1/update
AMW_WATCHTOWER_UPDATE_TOKEN=the-same-long-random-token
```

The workflow adds `?image=ghcr.io/rikkidavids/artwork-manager-nas-worker` itself, so the call can only update Artwork Manager.

**5. Make sure Artwork Manager is labelled for Watchtower.** It is by default (`com.centurylinklabs.watchtower.enable: "true"` in `docker-compose.yml`). Recreate the Artwork Manager project once if you installed it before that label existed.

**Check it works:** on GitHub, open **Actions**, then **Run workflow** on `main`. The last step should say "NAS update requested", and the app's header should show the new build within a minute.

Without steps 2-4, updates still happen automatically, just on Watchtower's regular schedule instead of instantly.

### Going back to an earlier version

Every build is also published with a `sha-` tag matching its commit (shown in GitHub's commit list). To pin one, set it in `.env` and recreate the project:

```text
AMW_IMAGE_TAG=sha-2c06a3f
```

Set `AMW_IMAGE_TAG=latest` (or remove the line) to go back to automatic updates. To stop automatic updates for Artwork Manager only, set `AMW_AUTO_UPDATE=false`.

### Updating by hand

From the NAS project folder, `./update_worker.sh` pulls the latest image, recreates the container and prints the build that's now running. In Synology Container Manager you can do the same by stopping the project, updating the image and starting it again.

## Verify

Open this from your Mac:

```text
http://YOUR-NAS-IP:8765/app/
```

Open the plain worker status at `http://YOUR-NAS-IP:8765/` without a browser UI check. You should see:

```text
worker_build: "5.46"
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
