const state = {
  token: localStorage.getItem("amwToken") || "",
  bucket: localStorage.getItem("amwBucket") || "All",
  query: "",
  albums: [],
  selectedKey: "",
  coverUrl: "",
  scanActive: false,
};

const el = {
  workerSummary: document.getElementById("workerSummary"),
  refreshBtn: document.getElementById("refreshBtn"),
  scanBtn: document.getElementById("scanBtn"),
  tokenPanel: document.getElementById("tokenPanel"),
  tokenInput: document.getElementById("tokenInput"),
  saveTokenBtn: document.getElementById("saveTokenBtn"),
  countAll: document.getElementById("countAll"),
  countNeeds: document.getElementById("countNeeds"),
  countReview: document.getElementById("countReview"),
  countDone: document.getElementById("countDone"),
  scanPanel: document.getElementById("scanPanel"),
  scanTitle: document.getElementById("scanTitle"),
  scanText: document.getElementById("scanText"),
  shownCount: document.getElementById("shownCount"),
  searchInput: document.getElementById("searchInput"),
  albumRows: document.getElementById("albumRows"),
  albumTitle: document.getElementById("albumTitle"),
  albumPath: document.getElementById("albumPath"),
  albumStatus: document.getElementById("albumStatus"),
  currentCover: document.getElementById("currentCover"),
  coverPlaceholder: document.getElementById("coverPlaceholder"),
  coverMeta: document.getElementById("coverMeta"),
  detailStatus: document.getElementById("detailStatus"),
  detailReason: document.getElementById("detailReason"),
  detailTracks: document.getElementById("detailTracks"),
  detailChecked: document.getElementById("detailChecked"),
};

function headers() {
  const out = { "Content-Type": "application/json" };
  if (state.token) out["X-Artwork-Worker-Token"] = state.token;
  return out;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  if (response.status === 401) {
    el.tokenPanel.classList.remove("hidden");
    throw new Error("Token required");
  }
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Request failed");
  }
  el.tokenPanel.classList.add("hidden");
  return payload;
}

function fmt(value) {
  return Number(value || 0).toLocaleString();
}

function shortPath(path) {
  const bits = String(path || "").split("/").filter(Boolean);
  if (bits.length <= 3) return path || "";
  return ".../" + bits.slice(-3).join("/");
}

function statusClass(album) {
  if (!album) return "";
  if (album.bucket === "Done") return "good";
  if (album.status === "missing_artwork" || album.status === "incompatible_artwork") return "issue";
  if (album.bucket === "Needs Work") return "work";
  return "";
}

function setCounts(counts = {}) {
  el.countAll.textContent = fmt(counts.All);
  el.countNeeds.textContent = fmt(counts["Needs Work"]);
  el.countReview.textContent = fmt(counts.Review);
  el.countDone.textContent = fmt(counts.Done);
  document.querySelectorAll(".chip").forEach((chip) => {
    const bucket = chip.dataset.bucket;
    const count = counts[bucket] || 0;
    chip.textContent = `${bucket} ${fmt(count)}`;
    chip.classList.toggle("active", bucket === state.bucket);
  });
}

function activeScanJob(status) {
  const jobs = Array.isArray(status.active_jobs) ? status.active_jobs : [];
  return jobs.find((job) => job && job.kind === "scan-library");
}

function renderScan(status) {
  const job = activeScanJob(status);
  state.scanActive = Boolean(job);
  el.scanBtn.disabled = state.scanActive;
  if (!job) {
    el.scanPanel.classList.add("hidden");
    return;
  }
  const progress = job.scan_progress || {};
  const checked = progress.processed_albums || job.processed_albums || 0;
  const queued = progress.queued_albums || job.queued_albums || 0;
  const skipped = progress.skipped_unchanged || job.skipped_unchanged || 0;
  const pending = progress.pending_albums || 0;
  const latest = progress.last_action_label || progress.current_album_path || "";
  const bits = [`${fmt(checked)} checked`];
  if (queued) bits.push(`${fmt(queued)} need work`);
  if (skipped) bits.push(`${fmt(skipped)} unchanged skipped`);
  if (pending) bits.push(`${fmt(pending)} checking now`);
  el.scanPanel.classList.remove("hidden");
  el.scanTitle.textContent = "Scan running";
  el.scanText.textContent = bits.join(" - ") + (latest ? ` - Latest: ${shortPath(latest)}` : "");
}

async function refreshStatus() {
  try {
    const status = await api("/api/app/status");
    const app = status.web_app || {};
    const counts = app.counts || {};
    setCounts(counts);
    renderScan(status);
    el.workerSummary.textContent = `NAS build ${status.worker_build || "-"} - API ${status.api || "-"} - ${shortPath((app.music_roots || [])[0] || "/music")}`;
    return status;
  } catch (error) {
    el.workerSummary.textContent = error.message === "Token required" ? "Token required" : "Could not reach NAS app";
    return null;
  }
}

function renderRows() {
  el.shownCount.textContent = `${fmt(state.albums.length)} shown`;
  if (!state.albums.length) {
    el.albumRows.innerHTML = '<tr><td colspan="4" class="empty">No albums in this view.</td></tr>';
    return;
  }
  el.albumRows.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.albums.forEach((album) => {
    const row = document.createElement("tr");
    row.dataset.albumKey = album.album_key;
    row.classList.toggle("selected", album.album_key === state.selectedKey);
    [album.status_label || "", album.artist || "", album.album || "", album.size_label || ""].forEach((value) => {
      const cell = document.createElement("td");
      cell.title = value;
      cell.textContent = value;
      row.appendChild(cell);
    });
    row.addEventListener("click", () => selectAlbum(album.album_key));
    fragment.appendChild(row);
  });
  el.albumRows.appendChild(fragment);
}

async function refreshQueue() {
  const params = new URLSearchParams({ bucket: state.bucket, q: state.query, limit: "500" });
  try {
    const payload = await api(`/api/albums?${params}`);
    state.albums = payload.albums || [];
    setCounts(payload.counts || {});
    if (!state.albums.find((album) => album.album_key === state.selectedKey)) {
      state.selectedKey = state.albums[0]?.album_key || "";
    }
    renderRows();
    renderSelected();
  } catch (error) {
    state.albums = [];
    renderRows();
  }
}

async function loadCover(album) {
  if (state.coverUrl) {
    URL.revokeObjectURL(state.coverUrl);
    state.coverUrl = "";
  }
  const box = el.currentCover.closest(".cover-box");
  box.classList.remove("has-cover");
  el.currentCover.removeAttribute("src");
  el.coverPlaceholder.textContent = "No artwork";
  if (!album) {
    el.coverMeta.textContent = "No cover selected.";
    return;
  }
  try {
    const response = await fetch(`/api/artwork/current?album_key=${encodeURIComponent(album.album_key)}`, {
      headers: headers(),
    });
    if (!response.ok) throw new Error("No artwork");
    const blob = await response.blob();
    state.coverUrl = URL.createObjectURL(blob);
    el.currentCover.src = state.coverUrl;
    box.classList.add("has-cover");
    el.coverMeta.textContent = album.size_label || "Current artwork";
  } catch (error) {
    el.coverPlaceholder.textContent = "No artwork";
    el.coverMeta.textContent = album.status_reason || "No readable embedded cover.";
  }
}

function renderSelected() {
  const album = state.albums.find((item) => item.album_key === state.selectedKey);
  document.querySelectorAll("tbody tr").forEach((row) => {
    row.classList.toggle("selected", row.dataset.albumKey === state.selectedKey);
  });
  if (!album) {
    el.albumTitle.textContent = "No album selected";
    el.albumPath.textContent = "Scan the library or choose an album.";
    el.albumStatus.textContent = "Idle";
    el.albumStatus.className = "status-pill";
    el.detailStatus.textContent = "-";
    el.detailReason.textContent = "-";
    el.detailTracks.textContent = "-";
    el.detailChecked.textContent = "-";
    loadCover(null);
    return;
  }
  el.albumTitle.textContent = `${album.artist} - ${album.album}`;
  el.albumPath.textContent = shortPath(album.album_path);
  el.albumStatus.textContent = album.status_label || "";
  el.albumStatus.className = `status-pill ${statusClass(album)}`;
  el.detailStatus.textContent = album.status_label || "-";
  el.detailReason.textContent = album.status_reason || "Nothing needed.";
  el.detailTracks.textContent = album.track_count ? fmt(album.track_count) : "-";
  el.detailChecked.textContent = album.last_scanned || "-";
  loadCover(album);
}

function selectAlbum(albumKey) {
  state.selectedKey = albumKey || "";
  renderRows();
  renderSelected();
}

async function startScan() {
  el.scanBtn.disabled = true;
  try {
    await api("/api/scan/start", {
      method: "POST",
      body: JSON.stringify({ library_root: "/music", resume: true, include_missing: true }),
    });
    await refreshStatus();
  } catch (error) {
    el.scanBtn.disabled = false;
    el.workerSummary.textContent = error.message || "Scan could not start";
  }
}

function bind() {
  el.tokenInput.value = state.token;
  el.saveTokenBtn.addEventListener("click", async () => {
    state.token = el.tokenInput.value.trim();
    localStorage.setItem("amwToken", state.token);
    await refreshStatus();
    await refreshQueue();
  });
  el.refreshBtn.addEventListener("click", async () => {
    await refreshStatus();
    await refreshQueue();
  });
  el.scanBtn.addEventListener("click", startScan);
  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value.trim();
    refreshQueue();
  });
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.bucket = chip.dataset.bucket || "All";
      localStorage.setItem("amwBucket", state.bucket);
      refreshQueue();
    });
  });
}

async function tick() {
  const status = await refreshStatus();
  if (status && state.scanActive) {
    await refreshQueue();
  }
}

bind();
refreshStatus().then(refreshQueue);
setInterval(tick, 1800);
