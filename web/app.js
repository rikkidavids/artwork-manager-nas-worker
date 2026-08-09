const state = {
  token: localStorage.getItem("amwToken") || "",
  bucket: localStorage.getItem("amwBucket") || "All",
  query: "",
  albums: [],
  selectedKey: "",
  coverUrl: "",
  candidateUrl: "",
  candidates: [],
  candidateIndex: 0,
  scanActive: false,
  actionActive: false,
  settings: {},
  settingsLoaded: false,
  appInfo: {},
  queueSignature: "",
  tickTimer: 0,
  searchTimer: 0,
};

const el = {
  workerSummary: document.getElementById("workerSummary"),
  refreshBtn: document.getElementById("refreshBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  scanBtn: document.getElementById("scanBtn"),
  unlockPanel: document.getElementById("unlockPanel"),
  unlockSettingsBtn: document.getElementById("unlockSettingsBtn"),
  scanPanel: document.getElementById("scanPanel"),
  scanTitle: document.getElementById("scanTitle"),
  scanText: document.getElementById("scanText"),
  shownCount: document.getElementById("shownCount"),
  searchInput: document.getElementById("searchInput"),
  albumRows: document.getElementById("albumRows"),
  detailPane: document.getElementById("detailPane"),
  albumTitle: document.getElementById("albumTitle"),
  albumPath: document.getElementById("albumPath"),
  albumStatus: document.getElementById("albumStatus"),
  currentCover: document.getElementById("currentCover"),
  coverPlaceholder: document.getElementById("coverPlaceholder"),
  coverMeta: document.getElementById("coverMeta"),
  candidateCover: document.getElementById("candidateCover"),
  candidatePanel: document.getElementById("candidatePanel"),
  candidateTitle: document.getElementById("candidateTitle"),
  candidatePlaceholder: document.getElementById("candidatePlaceholder"),
  candidateMeta: document.getElementById("candidateMeta"),
  candidatePosition: document.getElementById("candidatePosition"),
  summaryLead: document.getElementById("summaryLead"),
  detailStatus: document.getElementById("detailStatus"),
  detailReason: document.getElementById("detailReason"),
  detailTracks: document.getElementById("detailTracks"),
  detailChecked: document.getElementById("detailChecked"),
  actionsTitle: document.getElementById("actionsTitle"),
  actionMessage: document.getElementById("actionMessage"),
  primaryActionRow: document.getElementById("primaryActionRow"),
  candidateActionRow: document.getElementById("candidateActionRow"),
  quietActionRow: document.getElementById("quietActionRow"),
  findArtworkBtn: document.getElementById("findArtworkBtn"),
  approveEmbedBtn: document.getElementById("approveEmbedBtn"),
  prevCandidateBtn: document.getElementById("prevCandidateBtn"),
  nextCandidateBtn: document.getElementById("nextCandidateBtn"),
  rejectCandidateBtn: document.getElementById("rejectCandidateBtn"),
  openSourceBtn: document.getElementById("openSourceBtn"),
  googleImagesBtn: document.getElementById("googleImagesBtn"),
  markGoodBtn: document.getElementById("markGoodBtn"),
  skipAlbumBtn: document.getElementById("skipAlbumBtn"),
  settingsOverlay: document.getElementById("settingsOverlay"),
  settingsForm: document.getElementById("settingsForm"),
  settingsPanelTitle: document.getElementById("settingsPanelTitle"),
  settingsMessage: document.getElementById("settingsMessage"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  settingLibraryRoot: document.getElementById("settingLibraryRoot"),
  settingThemeMode: document.getElementById("settingThemeMode"),
  settingBuild: document.getElementById("settingBuild"),
  settingApi: document.getElementById("settingApi"),
  settingDataRoot: document.getElementById("settingDataRoot"),
  settingBackupRoot: document.getElementById("settingBackupRoot"),
  settingResumeScans: document.getElementById("settingResumeScans"),
  settingIncludeMissing: document.getElementById("settingIncludeMissing"),
  settingDeepScan: document.getElementById("settingDeepScan"),
  settingScanWorkers: document.getElementById("settingScanWorkers"),
  settingMatchMode: document.getElementById("settingMatchMode"),
  settingScanMin: document.getElementById("settingScanMin"),
  settingPreferred: document.getElementById("settingPreferred"),
  settingMaxEmbed: document.getElementById("settingMaxEmbed"),
  settingSaveFolder: document.getElementById("settingSaveFolder"),
  settingBackupEmbed: document.getElementById("settingBackupEmbed"),
  settingDeezerEnabled: document.getElementById("settingDeezerEnabled"),
  settingItunesEnabled: document.getElementById("settingItunesEnabled"),
  settingMaxCandidates: document.getElementById("settingMaxCandidates"),
  settingProviderWorkers: document.getElementById("settingProviderWorkers"),
  settingToken: document.getElementById("settingToken"),
  settingTokenRequired: document.getElementById("settingTokenRequired"),
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
    el.unlockPanel.classList.remove("hidden");
    throw new Error("Token required");
  }
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Request failed");
  }
  el.unlockPanel.classList.add("hidden");
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

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function themeMode(value) {
  const text = String(value || "Auto").trim().toLowerCase();
  return { auto: "Auto", light: "Light", dark: "Dark" }[text] || "Auto";
}

function applyTheme(mode) {
  const normal = themeMode(mode);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = normal === "Dark" || (normal === "Auto" && prefersDark) ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem("amwThemeMode", normal);
  if (el.settingThemeMode) el.settingThemeMode.value = normal;
}

function isDoneAlbum(album) {
  return album && (album.bucket === "Done" || (album.status_label || "").toLowerCase() === "good");
}

function workflowMode(album) {
  if (!album) return "empty";
  if (album.bucket === "Review" || album.status === "candidate_found") return "review";
  if (isDoneAlbum(album)) return "done";
  return "work";
}

function trackLabel(album) {
  const count = Number(album?.track_count || 0);
  if (!count) return "tracks unchecked";
  return `${fmt(count)} ${count === 1 ? "track" : "tracks"}`;
}

function checkedLabel(album) {
  const checked = formatDateTime(album?.last_scanned);
  return checked === "-" ? "not checked yet" : `checked ${checked}`;
}

function targetSize() {
  return Number(state.settings.preferred_artwork_size || state.settings.scan_min_artwork_size || 1200);
}

function summaryLead(album) {
  if (!album) return "Select an album to review.";
  const target = targetSize();
  if (isDoneAlbum(album)) return `Good - target ${target}`;
  if (album.bucket === "Review") return `Review - target ${target}`;
  if (album.status === "missing_artwork") return `Missing - target ${target}`;
  if (album.status === "incompatible_artwork") return `Convert - target ${target}`;
  return `Needs work - target ${target}`;
}

function nextLabel(album) {
  if (!album) return "-";
  if (isDoneAlbum(album)) return "Nothing needed.";
  if (album.bucket === "Review") return "Approve or reject.";
  if (album.status === "missing_artwork") return "Find a cover.";
  if (album.status === "incompatible_artwork") return "Convert or replace.";
  if (album.status === "no_candidate") return "Try another search.";
  return "Find artwork.";
}

function compactChecked(album) {
  const checked = formatDateTime(album?.last_scanned);
  return checked === "-" ? "Not checked" : checked;
}

function queueSignature(albums) {
  return albums
    .map((album) => `${album.album_key}:${album.status}:${album.width || ""}x${album.height || ""}:${album.candidate_count || 0}`)
    .join("|");
}

function statusClass(album) {
  if (!album) return "";
  if (isDoneAlbum(album)) return "good";
  if (album.status === "missing_artwork" || album.status === "incompatible_artwork") return "issue";
  if (album.bucket === "Needs Work") return "work";
  return "";
}

function selectedAlbum() {
  return state.albums.find((item) => item.album_key === state.selectedKey) || null;
}

function selectedCandidate() {
  return state.candidates[state.candidateIndex] || null;
}

function idleActionMessage(album = selectedAlbum()) {
  if (!album) return "Select an album to begin.";
  const mode = workflowMode(album);
  if (mode === "done") return "Nothing needed. Search again only if you want a different cover.";
  if (mode === "review" && selectedCandidate()) return "Review this cover, then approve or reject it.";
  if (mode === "review") return "Search again to add cover options.";
  return "Find artwork, then approve the best cover.";
}

function setVisible(node, visible) {
  node.classList.toggle("hidden", !visible);
}

function candidateLabel(candidate) {
  if (!candidate) return "No candidate selected.";
  const parts = [];
  if (candidate.source) parts.push(candidate.source);
  if (candidate.size_label) parts.push(candidate.size_label);
  if (candidate.score || candidate.score === 0) parts.push(`${candidate.score}/100`);
  const title = candidate.release_title ? ` - ${candidate.release_title}` : "";
  return `${parts.join(" - ")}${title}`;
}

function googleImagesUrl(album) {
  if (!album) return "";
  const target = Number(state.settings.preferred_artwork_size || state.settings.scan_min_artwork_size || 1200);
  const terms = [album.search_artist || album.artist, album.search_album || album.album, `${target}x${target}`]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/search?udm=2&tbs=isz:l&q=${encodeURIComponent(terms)}`;
}

function setCounts(counts = {}) {
  document.querySelectorAll(".chip").forEach((chip) => {
    const bucket = chip.dataset.bucket;
    const count = counts[bucket] || 0;
    chip.textContent = `${bucket} ${fmt(count)}`;
    chip.classList.toggle("active", bucket === state.bucket);
    chip.classList.toggle("quiet", bucket === "Done" && bucket !== state.bucket);
  });
}

function settingsTitle(tab) {
  return {
    general: "General",
    scanning: "Scanning",
    artwork: "Artwork",
    security: "Security",
  }[tab] || "Settings";
}

function setSettingsTab(tab) {
  document.querySelectorAll(".settings-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === tab);
  });
  document.querySelectorAll(".settings-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.settingsPanel === tab);
  });
  el.settingsPanelTitle.textContent = settingsTitle(tab);
}

function populateSettings(payload = {}) {
  const settings = payload.settings || state.settings || {};
  const info = {
    worker_build: payload.worker_build || state.appInfo.worker_build || "",
    api: payload.api || state.appInfo.api || "",
    data_root: payload.data_root || state.appInfo.data_root || "",
    backup_root: payload.backup_root || state.appInfo.backup_root || "",
    token_required: payload.token_required ?? state.appInfo.token_required,
  };
  state.settings = settings;
  state.appInfo = { ...state.appInfo, ...info };
  applyTheme(settings.theme_mode || localStorage.getItem("amwThemeMode") || "Auto");
  el.settingLibraryRoot.value = settings.library_root || "/music";
  el.settingThemeMode.value = themeMode(settings.theme_mode || localStorage.getItem("amwThemeMode") || "Auto");
  el.settingBuild.value = info.worker_build || "-";
  el.settingApi.value = info.api || "-";
  el.settingDataRoot.value = info.data_root || "-";
  el.settingBackupRoot.value = info.backup_root || "-";
  el.settingResumeScans.checked = Boolean(settings.resume_scans);
  el.settingIncludeMissing.checked = Boolean(settings.include_missing);
  el.settingDeepScan.checked = Boolean(settings.deep_scan_all_files);
  el.settingScanWorkers.value = settings.scan_worker_threads || 8;
  el.settingMatchMode.value = settings.target_size_match_mode || "Relaxed";
  el.settingScanMin.value = settings.scan_min_artwork_size || 1000;
  el.settingPreferred.value = settings.preferred_artwork_size || 1000;
  el.settingMaxEmbed.value = settings.max_embedded_artwork_size || 0;
  el.settingSaveFolder.checked = Boolean(settings.save_approved_artwork_to_album_folder);
  el.settingBackupEmbed.checked = Boolean(settings.backup_before_embed);
  el.settingDeezerEnabled.checked = Boolean(settings.deezer_enabled);
  el.settingItunesEnabled.checked = Boolean(settings.itunes_enabled);
  el.settingMaxCandidates.value = settings.max_candidates_per_album || 5;
  el.settingProviderWorkers.value = settings.parallel_provider_workers || 2;
  el.settingToken.value = state.token;
  el.settingTokenRequired.value = info.token_required ? "Yes" : "No";
}

function readSettingsForm() {
  return {
    library_root: el.settingLibraryRoot.value.trim() || "/music",
    theme_mode: themeMode(el.settingThemeMode.value),
    resume_scans: el.settingResumeScans.checked,
    include_missing: el.settingIncludeMissing.checked,
    deep_scan_all_files: el.settingDeepScan.checked,
    scan_worker_threads: Number(el.settingScanWorkers.value || 8),
    target_size_match_mode: el.settingMatchMode.value || "Relaxed",
    scan_min_artwork_size: Number(el.settingScanMin.value || 1000),
    preferred_artwork_size: Number(el.settingPreferred.value || 1000),
    max_embedded_artwork_size: Number(el.settingMaxEmbed.value || 0),
    save_approved_artwork_to_album_folder: el.settingSaveFolder.checked,
    backup_before_embed: el.settingBackupEmbed.checked,
    deezer_enabled: el.settingDeezerEnabled.checked,
    itunes_enabled: el.settingItunesEnabled.checked,
    max_candidates_per_album: Number(el.settingMaxCandidates.value || 5),
    parallel_provider_workers: Number(el.settingProviderWorkers.value || 2),
  };
}

async function loadSettings() {
  const payload = await api("/api/settings");
  state.settingsLoaded = true;
  populateSettings(payload);
  el.settingsMessage.textContent = "Ready.";
  return payload;
}

async function openSettings(tab = "general") {
  el.settingsOverlay.classList.remove("hidden");
  populateSettings({
    settings: state.settings,
    worker_build: state.appInfo.worker_build,
    api: state.appInfo.api,
    data_root: state.appInfo.data_root,
    backup_root: state.appInfo.backup_root,
    token_required: state.appInfo.token_required,
  });
  setSettingsTab(tab);
  try {
    await loadSettings();
  } catch (error) {
    el.settingsMessage.textContent = error.message === "Token required" ? "Enter the token in Security, then save." : "Settings could not be loaded.";
    setSettingsTab("security");
  }
}

function closeSettings() {
  el.settingsOverlay.classList.add("hidden");
}

async function saveSettings(event) {
  event.preventDefault();
  state.token = el.settingToken.value.trim();
  applyTheme(el.settingThemeMode.value);
  if (state.token) {
    localStorage.setItem("amwToken", state.token);
  } else {
    localStorage.removeItem("amwToken");
  }
  if (!state.settingsLoaded) {
    try {
      await loadSettings();
      await refreshStatus();
      await refreshQueue();
      el.settingsMessage.textContent = "Connected.";
    } catch (error) {
      el.settingsMessage.textContent = "Token did not work.";
    }
    return;
  }
  try {
    const payload = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify(readSettingsForm()),
    });
    populateSettings(payload);
    await refreshStatus();
    await refreshQueue();
    el.settingsMessage.textContent = "Saved.";
  } catch (error) {
    el.settingsMessage.textContent = error.message || "Settings were not saved.";
  }
}

function activeScanJob(status) {
  const jobs = Array.isArray(status.active_jobs) ? status.active_jobs : [];
  return jobs.find((job) => job && job.kind === "scan-library");
}

function activeReviewJob(status) {
  const jobs = Array.isArray(status.active_jobs) ? status.active_jobs : [];
  return jobs.find((job) => job && ["artwork-search", "approve-embed"].includes(job.kind));
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

function updateActionButtons() {
  const album = selectedAlbum();
  const candidate = selectedCandidate();
  const mode = workflowMode(album);
  const busy = Boolean(state.actionActive);
  const hasCandidate = Boolean(candidate);
  const sourceUrl = candidate?.source_page || candidate?.source_url || "";
  const hasAlbum = Boolean(album);
  const canNavigateCandidates = hasAlbum && state.candidates.length > 1 && !busy;
  const showCandidateActions = hasCandidate || mode === "review";
  const showAlbumTools = hasAlbum && (sourceUrl || mode !== "empty");
  const compactCandidate = (mode === "done" || mode === "empty") && !hasCandidate;

  el.detailPane.classList.remove("mode-empty", "mode-work", "mode-review", "mode-done");
  el.detailPane.classList.add(`mode-${mode}`);
  el.candidatePanel.classList.toggle("compact", compactCandidate);
  el.candidateTitle.textContent = mode === "done" ? "Replacement Cover" : "Candidate";
  el.candidatePosition.classList.toggle("hidden", compactCandidate);
  el.actionsTitle.textContent = "Next Step";
  el.findArtworkBtn.textContent = mode === "done" ? "Search Again" : "Find Artwork";
  el.findArtworkBtn.classList.toggle("primary", mode !== "done");
  el.findArtworkBtn.classList.toggle("ghost", mode === "done");

  setVisible(el.primaryActionRow, hasAlbum);
  setVisible(el.findArtworkBtn, hasAlbum);
  setVisible(el.approveEmbedBtn, mode !== "done" || hasCandidate);
  setVisible(el.candidateActionRow, showCandidateActions);
  setVisible(el.prevCandidateBtn, state.candidates.length > 1);
  setVisible(el.nextCandidateBtn, state.candidates.length > 1);
  setVisible(el.rejectCandidateBtn, hasCandidate);
  setVisible(el.quietActionRow, showAlbumTools);
  setVisible(el.openSourceBtn, Boolean(sourceUrl));
  setVisible(el.googleImagesBtn, hasAlbum);
  setVisible(el.markGoodBtn, hasAlbum && mode !== "done");
  setVisible(el.skipAlbumBtn, hasAlbum && mode !== "done");

  el.findArtworkBtn.disabled = !hasAlbum || busy;
  el.approveEmbedBtn.disabled = !album || !hasCandidate || busy;
  el.prevCandidateBtn.disabled = !canNavigateCandidates;
  el.nextCandidateBtn.disabled = !canNavigateCandidates;
  el.rejectCandidateBtn.disabled = !album || !hasCandidate || busy;
  el.openSourceBtn.disabled = !sourceUrl;
  el.googleImagesBtn.disabled = !album;
  el.markGoodBtn.disabled = !album || busy;
  el.skipAlbumBtn.disabled = !album || busy;
}

function renderReviewJob(status) {
  const job = activeReviewJob(status);
  state.actionActive = Boolean(job);
  if (job) {
    const count = job.candidate_count ? ` - ${fmt(job.candidate_count)} option(s)` : "";
    const label = job.kind === "approve-embed" ? "Embedding artwork" : "Searching artwork";
    el.actionMessage.textContent = `${label}${count}...`;
  }
  updateActionButtons();
}

async function refreshStatus() {
  try {
    const status = await api("/api/app/status");
    const app = status.web_app || {};
    const counts = app.counts || {};
    state.appInfo = {
      worker_build: status.worker_build || "",
      api: status.api || "",
      data_root: app.data_root || "",
      backup_root: app.backup_root || "",
      token_required: app.token_required,
    };
    if (app.settings) {
      state.settings = app.settings;
      state.settingsLoaded = true;
    }
    setCounts(counts);
    renderScan(status);
    renderReviewJob(status);
    el.workerSummary.textContent = `Build ${status.worker_build || "-"} - ${shortPath((app.music_roots || [])[0] || "/music")}`;
    return status;
  } catch (error) {
    el.workerSummary.textContent = error.message === "Token required" ? "Token required" : "Could not reach NAS app";
    return null;
  }
}

function renderRows() {
  el.shownCount.textContent = `${fmt(state.albums.length)} shown`;
  if (!state.albums.length) {
    el.albumRows.innerHTML = '<tr><td colspan="5" class="empty">No albums in this view.</td></tr>';
    return;
  }
  el.albumRows.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.albums.forEach((album) => {
    const row = document.createElement("tr");
    row.dataset.albumKey = album.album_key;
    row.classList.toggle("selected", album.album_key === state.selectedKey);
    [album.status_label || "", album.artist || "", album.album || "", album.size_label || "", album.candidate_count || 0].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.title = value;
      cell.textContent = value;
      if (index === 0) cell.className = `status-cell ${statusClass(album)}`;
      row.appendChild(cell);
    });
    fragment.appendChild(row);
  });
  el.albumRows.appendChild(fragment);
}

async function refreshQueue(options = {}) {
  const force = Boolean(options.force);
  const previousSelected = state.selectedKey;
  const params = new URLSearchParams({ bucket: state.bucket, q: state.query });
  try {
    const payload = await api(`/api/albums?${params}`);
    const counts = payload.counts || {};
    const albums = payload.albums || [];
    if (!state.query && !albums.length && state.bucket === "Review" && Number(counts["Needs Work"] || 0) > 0) {
      state.bucket = "Needs Work";
      localStorage.setItem("amwBucket", state.bucket);
      return refreshQueue({ force: true });
    }
    if (!state.query && !albums.length && state.bucket === "Needs Work" && Number(counts["Review"] || 0) > 0) {
      state.bucket = "Review";
      localStorage.setItem("amwBucket", state.bucket);
      return refreshQueue({ force: true });
    }
    const signature = queueSignature(albums);
    const queueChanged = force || signature !== state.queueSignature || albums.length !== state.albums.length;
    state.albums = albums;
    state.queueSignature = signature;
    setCounts(counts);
    if (!state.albums.find((album) => album.album_key === state.selectedKey)) {
      state.selectedKey = state.albums[0]?.album_key || "";
    }
    if (queueChanged) renderRows();
    if (queueChanged || previousSelected !== state.selectedKey || force) {
      renderSelected();
    } else {
      updateActionButtons();
    }
  } catch (error) {
    state.albums = [];
    state.queueSignature = "";
    renderRows();
  }
}

async function loadCover(album) {
  const albumKey = album?.album_key || "";
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
    if (state.selectedKey !== albumKey) return;
    state.coverUrl = URL.createObjectURL(blob);
    el.currentCover.src = state.coverUrl;
    box.classList.add("has-cover");
    el.coverMeta.textContent = album.size_label || "Current artwork";
  } catch (error) {
    el.coverPlaceholder.textContent = "No artwork";
    el.coverMeta.textContent = album.status_reason || "No readable embedded cover.";
  }
}

async function loadCandidateCover(candidate) {
  const candidateId = candidate?.candidate_id || "";
  if (state.candidateUrl) {
    URL.revokeObjectURL(state.candidateUrl);
    state.candidateUrl = "";
  }
  const box = el.candidateCover.closest(".cover-box");
  box.classList.remove("has-cover");
  el.candidateCover.removeAttribute("src");
  el.candidatePlaceholder.textContent = "No candidate";
  if (!candidate) {
    return;
  }
  try {
    const response = await fetch(`/api/artwork/candidate?candidate_id=${encodeURIComponent(candidate.candidate_id)}`, {
      headers: headers(),
    });
    if (!response.ok) throw new Error("No candidate artwork");
    const blob = await response.blob();
    if ((selectedCandidate()?.candidate_id || "") !== candidateId) return;
    state.candidateUrl = URL.createObjectURL(blob);
    el.candidateCover.src = state.candidateUrl;
    box.classList.add("has-cover");
  } catch (error) {
    el.candidatePlaceholder.textContent = "Candidate unavailable";
  }
}

function renderCandidate() {
  const candidate = selectedCandidate();
  const album = selectedAlbum();
  const mode = workflowMode(album);
  el.candidatePosition.textContent = state.candidates.length ? `${state.candidateIndex + 1} of ${state.candidates.length}` : "0 of 0";
  if (!candidate) {
    if (mode === "done") {
      el.candidateMeta.textContent = "No replacement queued.";
    } else if (album) {
      el.candidateMeta.textContent = "No saved cover options. Find artwork to start.";
    } else {
      el.candidateMeta.textContent = "Find artwork to see options.";
    }
    if (!state.actionActive) {
      el.actionMessage.textContent = idleActionMessage(album);
    }
    loadCandidateCover(null);
    updateActionButtons();
    return;
  }
  const warnings = Array.isArray(candidate.warnings) && candidate.warnings.length ? ` - ${candidate.warnings.slice(0, 2).join(", ")}` : "";
  el.candidateMeta.textContent = `${candidateLabel(candidate)}${warnings}`;
  if (!state.actionActive) {
    el.actionMessage.textContent = idleActionMessage(album);
  }
  loadCandidateCover(candidate);
  updateActionButtons();
}

async function refreshCandidates(album) {
  if (!album) {
    state.candidates = [];
    state.candidateIndex = 0;
    renderCandidate();
    return;
  }
  const previousId = selectedCandidate()?.candidate_id;
  try {
    const payload = await api(`/api/candidates?album_key=${encodeURIComponent(album.album_key)}`);
    if (album.album_key !== state.selectedKey) return;
    state.candidates = payload.candidates || [];
    const previousIndex = state.candidates.findIndex((candidate) => candidate.candidate_id === previousId);
    state.candidateIndex = previousIndex >= 0 ? previousIndex : 0;
    renderCandidate();
  } catch (error) {
    state.candidates = [];
    state.candidateIndex = 0;
    renderCandidate();
  }
}

function renderSelected() {
  const album = selectedAlbum();
  document.querySelectorAll("tbody tr").forEach((row) => {
    row.classList.toggle("selected", row.dataset.albumKey === state.selectedKey);
  });
  if (!album) {
    el.albumTitle.textContent = "No album selected";
    el.albumPath.textContent = "Scan the library or choose an album.";
    el.albumStatus.textContent = "Idle";
    el.albumStatus.className = "status-pill";
    el.summaryLead.textContent = summaryLead(null);
    el.summaryLead.className = "summary-lead";
    el.detailStatus.textContent = "-";
    el.detailReason.textContent = "-";
    el.detailTracks.textContent = "-";
    el.detailChecked.textContent = "-";
    el.actionMessage.textContent = "Select an album to begin.";
    loadCover(null);
    refreshCandidates(null);
    updateActionButtons();
    return;
  }
  el.albumTitle.textContent = `${album.artist} - ${album.album}`;
  el.albumPath.textContent = shortPath(album.album_path);
  el.albumStatus.textContent = album.status_label || "";
  el.albumStatus.className = `status-pill ${statusClass(album)}`;
  el.summaryLead.textContent = summaryLead(album);
  el.summaryLead.className = `summary-lead ${statusClass(album)}`;
  el.detailStatus.textContent = album.size_label ? `Current ${album.size_label}` : "Current missing";
  el.detailReason.textContent = nextLabel(album);
  el.detailTracks.textContent = trackLabel(album);
  el.detailChecked.textContent = compactChecked(album);
  if (!state.actionActive) {
    el.actionMessage.textContent = idleActionMessage(album);
  }
  state.candidates = [];
  state.candidateIndex = 0;
  renderCandidate();
  loadCover(album);
  refreshCandidates(album);
  updateActionButtons();
}

function selectAlbum(albumKey) {
  state.selectedKey = albumKey || "";
  renderSelected();
}

async function startScan() {
  el.scanBtn.disabled = true;
  try {
    await api("/api/scan/start", {
      method: "POST",
      body: JSON.stringify({}),
    });
    await refreshStatus();
    scheduleTick(500);
  } catch (error) {
    el.scanBtn.disabled = false;
    el.workerSummary.textContent = error.message || "Scan could not start";
  }
}

async function startArtworkSearch() {
  const album = selectedAlbum();
  if (!album) return;
  state.actionActive = true;
  el.actionMessage.textContent = "Searching artwork...";
  updateActionButtons();
  try {
    await api("/api/artwork/search", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key }),
    });
    await refreshStatus();
    scheduleTick(500);
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "Artwork search could not start.";
    updateActionButtons();
  }
}

async function approveSelectedCandidate() {
  const album = selectedAlbum();
  const candidate = selectedCandidate();
  if (!album || !candidate) return;
  state.actionActive = true;
  el.actionMessage.textContent = "Embedding artwork on the NAS...";
  updateActionButtons();
  try {
    await api("/api/artwork/approve", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key, candidate_id: candidate.candidate_id }),
    });
    await refreshStatus();
    scheduleTick(500);
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "Approve and embed could not start.";
    updateActionButtons();
  }
}

async function rejectSelectedCandidate() {
  const album = selectedAlbum();
  const candidate = selectedCandidate();
  if (!album || !candidate) return;
  try {
    await api("/api/artwork/reject", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key, candidate_id: candidate.candidate_id }),
    });
    await refreshQueue();
    await refreshCandidates(selectedAlbum());
  } catch (error) {
    el.actionMessage.textContent = error.message || "Candidate could not be rejected.";
  }
}

async function runAlbumAction(path, message) {
  const album = selectedAlbum();
  if (!album) return;
  try {
    await api(path, {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key }),
    });
    el.actionMessage.textContent = message;
    await refreshQueue();
  } catch (error) {
    el.actionMessage.textContent = error.message || "Action failed.";
  }
}

function moveCandidate(delta) {
  if (!state.candidates.length) return;
  state.candidateIndex = (state.candidateIndex + delta + state.candidates.length) % state.candidates.length;
  renderCandidate();
}

function openSourcePage() {
  const candidate = selectedCandidate();
  const url = candidate?.source_page || candidate?.source_url || "";
  if (url) window.open(url, "_blank", "noopener");
}

function openGoogleImages() {
  const url = googleImagesUrl(selectedAlbum());
  if (url) window.open(url, "_blank", "noopener");
}

function bind() {
  el.refreshBtn.addEventListener("click", async () => {
    await refreshStatus();
    await refreshQueue({ force: true });
    scheduleTick(10000);
  });
  el.settingsBtn.addEventListener("click", () => openSettings("general"));
  el.unlockSettingsBtn.addEventListener("click", () => openSettings("security"));
  el.closeSettingsBtn.addEventListener("click", closeSettings);
  el.settingsForm.addEventListener("submit", saveSettings);
  el.settingsOverlay.addEventListener("click", (event) => {
    if (event.target === el.settingsOverlay) closeSettings();
  });
  document.querySelectorAll(".settings-tab").forEach((button) => {
    button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab || "general"));
  });
  el.settingThemeMode.addEventListener("change", () => applyTheme(el.settingThemeMode.value));
  el.scanBtn.addEventListener("click", startScan);
  el.findArtworkBtn.addEventListener("click", startArtworkSearch);
  el.approveEmbedBtn.addEventListener("click", approveSelectedCandidate);
  el.rejectCandidateBtn.addEventListener("click", rejectSelectedCandidate);
  el.prevCandidateBtn.addEventListener("click", () => moveCandidate(-1));
  el.nextCandidateBtn.addEventListener("click", () => moveCandidate(1));
  el.openSourceBtn.addEventListener("click", openSourcePage);
  el.googleImagesBtn.addEventListener("click", openGoogleImages);
  el.markGoodBtn.addEventListener("click", () => runAlbumAction("/api/album/mark-good", "Marked as good."));
  el.skipAlbumBtn.addEventListener("click", () => runAlbumAction("/api/album/skip", "Skipped for now."));
  el.albumRows.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-album-key]");
    if (row) selectAlbum(row.dataset.albumKey);
  });
  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value.trim();
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => refreshQueue({ force: true }), 180);
  });
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.bucket = chip.dataset.bucket || "All";
      localStorage.setItem("amwBucket", state.bucket);
      refreshQueue({ force: true });
    });
  });
  document.addEventListener("visibilitychange", () => scheduleTick(document.hidden ? 30000 : 500));
  if (window.matchMedia) {
    const schemeWatcher = window.matchMedia("(prefers-color-scheme: dark)");
    const syncAutoTheme = () => {
      if (themeMode(localStorage.getItem("amwThemeMode")) === "Auto") applyTheme("Auto");
    };
    if (schemeWatcher.addEventListener) {
      schemeWatcher.addEventListener("change", syncAutoTheme);
    } else if (schemeWatcher.addListener) {
      schemeWatcher.addListener(syncAutoTheme);
    }
  }
}

function nextPollDelay() {
  if (document.hidden) return 30000;
  if (state.scanActive || state.actionActive) return 1800;
  return 10000;
}

function scheduleTick(delay = nextPollDelay()) {
  window.clearTimeout(state.tickTimer);
  state.tickTimer = window.setTimeout(tick, delay);
}

async function tick() {
  const hadAction = state.actionActive;
  try {
    const status = await refreshStatus();
    if (status && (state.scanActive || state.actionActive || hadAction)) {
      await refreshQueue();
      if (state.selectedKey) {
        await refreshCandidates(selectedAlbum());
      }
    }
  } finally {
    scheduleTick();
  }
}

applyTheme(localStorage.getItem("amwThemeMode") || "Auto");
bind();
refreshStatus().then(() => refreshQueue({ force: true })).finally(() => scheduleTick());
