const state = {
  token: localStorage.getItem("amwToken") || "",
  bucket: localStorage.getItem("amwBucket") || "All",
  query: "",
  albums: [],
  selectedKey: "",
  coverUrl: "",
  candidateUrl: "",
  candidates: [],
  backups: [],
  backupsLoaded: false,
  candidateIndex: 0,
  scanActive: false,
  actionActive: false,
  settings: {},
  settingsLoaded: false,
  settingsDirty: false,
  settingsSaving: false,
  appInfo: {},
  queueSignature: "",
  tickTimer: 0,
  searchTimer: 0,
  detailOpen: false,
  preferredNextKey: "",
  viewerOpen: false,
  viewerKind: "",
  viewerFitMode: "fit",
  viewerTouchX: 0,
  viewerTouchY: 0,
  problemKey: "",
  settingsReturnFocus: null,
  viewerReturnFocus: null,
};

const el = {
  workerSummary: document.getElementById("workerSummary"),
  refreshBtn: document.getElementById("refreshBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  scanBtn: document.getElementById("scanBtn"),
  freshScanBtn: document.getElementById("freshScanBtn"),
  unlockPanel: document.getElementById("unlockPanel"),
  unlockSettingsBtn: document.getElementById("unlockSettingsBtn"),
  scanPanel: document.getElementById("scanPanel"),
  scanTitle: document.getElementById("scanTitle"),
  scanText: document.getElementById("scanText"),
  shownCount: document.getElementById("shownCount"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  queueTableWrap: document.getElementById("queueTableWrap"),
  albumRows: document.getElementById("albumRows"),
  detailPane: document.getElementById("detailPane"),
  backToQueueBtn: document.getElementById("backToQueueBtn"),
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
  problemFiles: document.getElementById("problemFiles"),
  problemCount: document.getElementById("problemCount"),
  problemFileList: document.getElementById("problemFileList"),
  actionsTitle: document.getElementById("actionsTitle"),
  actionMessage: document.getElementById("actionMessage"),
  primaryActionRow: document.getElementById("primaryActionRow"),
  candidateActionRow: document.getElementById("candidateActionRow"),
  quietActionRow: document.getElementById("quietActionRow"),
  importImageInput: document.getElementById("importImageInput"),
  findArtworkBtn: document.getElementById("findArtworkBtn"),
  approveEmbedBtn: document.getElementById("approveEmbedBtn"),
  convertCurrentBtn: document.getElementById("convertCurrentBtn"),
  prevCandidateBtn: document.getElementById("prevCandidateBtn"),
  nextCandidateBtn: document.getElementById("nextCandidateBtn"),
  rejectCandidateBtn: document.getElementById("rejectCandidateBtn"),
  rejectAllBtn: document.getElementById("rejectAllBtn"),
  importImageBtn: document.getElementById("importImageBtn"),
  recheckAlbumBtn: document.getElementById("recheckAlbumBtn"),
  openSourceBtn: document.getElementById("openSourceBtn"),
  googleImagesBtn: document.getElementById("googleImagesBtn"),
  markGoodBtn: document.getElementById("markGoodBtn"),
  skipAlbumBtn: document.getElementById("skipAlbumBtn"),
  settingsOverlay: document.getElementById("settingsOverlay"),
  settingsForm: document.getElementById("settingsForm"),
  settingsPanelTitle: document.getElementById("settingsPanelTitle"),
  settingsMessage: document.getElementById("settingsMessage"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
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
  settingMusicbrainzEnabled: document.getElementById("settingMusicbrainzEnabled"),
  settingMaxCandidates: document.getElementById("settingMaxCandidates"),
  settingProviderWorkers: document.getElementById("settingProviderWorkers"),
  settingToken: document.getElementById("settingToken"),
  settingTokenRequired: document.getElementById("settingTokenRequired"),
  downloadDiagnosticsBtn: document.getElementById("downloadDiagnosticsBtn"),
  repairQueueBtn: document.getElementById("repairQueueBtn"),
  cleanupStaleBtn: document.getElementById("cleanupStaleBtn"),
  maintenanceResult: document.getElementById("maintenanceResult"),
  loadBackupsBtn: document.getElementById("loadBackupsBtn"),
  backupList: document.getElementById("backupList"),
  artworkOverlay: document.getElementById("artworkOverlay"),
  artworkViewerTitle: document.getElementById("artworkViewerTitle"),
  artworkViewerMeta: document.getElementById("artworkViewerMeta"),
  artworkViewerImage: document.getElementById("artworkViewerImage"),
  artworkViewerNav: document.getElementById("artworkViewerNav"),
  artworkViewerFrame: document.querySelector(".artwork-viewer-frame"),
  toggleViewerFitBtn: document.getElementById("toggleViewerFitBtn"),
  closeArtworkViewerBtn: document.getElementById("closeArtworkViewerBtn"),
  viewerPrevBtn: document.getElementById("viewerPrevBtn"),
  viewerNextBtn: document.getElementById("viewerNextBtn"),
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
}

function fmt(value) {
  return Number(value || 0).toLocaleString();
}

function shortPath(path) {
  const bits = String(path || "").split("/").filter(Boolean);
  if (bits.length <= 3) return path || "";
  return ".../" + bits.slice(-3).join("/");
}

function shortProblemPath(path) {
  const bits = String(path || "").split("/").filter(Boolean);
  if (!bits.length) return "Unknown file";
  return bits.slice(-2).join("/");
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

function formatTime(value = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
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

function syncModalIsolation() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const modalOpen = state.viewerOpen || !el.settingsOverlay.classList.contains("hidden");
  if (modalOpen) {
    shell.setAttribute("aria-hidden", "true");
    shell.setAttribute("inert", "");
  } else {
    shell.removeAttribute("aria-hidden");
    shell.removeAttribute("inert");
  }
  if ("inert" in shell) shell.inert = modalOpen;
}

function updateSearchControls() {
  if (!el.clearSearchBtn) return;
  el.clearSearchBtn.classList.toggle("hidden", !state.query);
  el.searchInput.classList.toggle("has-query", Boolean(state.query));
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
  if (["incompatible_artwork", "not_square_artwork"].includes(album.status)) return "Convert or replace.";
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

function isPhoneLayout() {
  return window.matchMedia && window.matchMedia("(max-width: 740px)").matches;
}

function selectedIndex() {
  return state.albums.findIndex((item) => item.album_key === state.selectedKey);
}

function syncResponsiveState() {
  const detailVisible = isPhoneLayout() && state.detailOpen && Boolean(state.selectedKey);
  document.body.classList.toggle("detail-open", detailVisible);
}

function focusQueue() {
  if (el.queueTableWrap) {
    el.queueTableWrap.focus({ preventScroll: true });
  }
}

function selectedRow() {
  if (!state.selectedKey) return null;
  return Array.from(el.albumRows.querySelectorAll("tr[data-album-key]")).find((row) => row.dataset.albumKey === state.selectedKey) || null;
}

function scrollSelectedIntoView() {
  const row = selectedRow();
  if (row) row.scrollIntoView({ block: "nearest" });
}

function moveQueueSelection(delta) {
  if (!state.albums.length) return;
  const current = selectedIndex();
  const next = Math.max(0, Math.min(state.albums.length - 1, (current < 0 ? 0 : current) + delta));
  selectAlbum(state.albums[next].album_key, { openDetail: false, focusQueue: true });
  scrollSelectedIntoView();
}

function keyAfterSelected() {
  const index = selectedIndex();
  if (index < 0) return "";
  return state.albums[index + 1]?.album_key || state.albums[index - 1]?.album_key || "";
}

function rememberNextSelection() {
  state.preferredNextKey = keyAfterSelected();
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

function hasCover(kind) {
  if (kind === "current") return Boolean(state.coverUrl && selectedAlbum());
  if (kind === "candidate") return Boolean(state.candidateUrl && selectedCandidate());
  return false;
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

function candidateWarnings(candidate) {
  return Array.isArray(candidate?.warnings)
    ? candidate.warnings.map((warning) => String(warning || "").trim()).filter(Boolean)
    : [];
}

function candidateShortLabel(candidate) {
  if (!candidate) return "No candidate selected.";
  const parts = [];
  if (candidate.source) parts.push(candidate.source);
  if (candidate.size_label) parts.push(candidate.size_label);
  if (candidate.score || candidate.score === 0) parts.push(`${candidate.score}/100`);
  const warnings = candidateWarnings(candidate);
  if (warnings.length) parts.push(warnings[0]);
  return parts.join(" - ") || "Candidate cover";
}

function candidateApprovalWarning(candidate) {
  const warnings = candidateWarnings(candidate);
  const score = Number(candidate?.score || 0);
  const concerns = [];
  if (warnings.length) concerns.push(warnings.slice(0, 3).join(", "));
  if (score && score < 70) concerns.push(`score ${score}/100`);
  if (!concerns.length) return "";
  return `This cover has a warning (${concerns.join("; ")}). Approve and embed it anyway?`;
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
    maintenance: "Maintenance",
    safety: "Safety",
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
  if (tab === "safety") {
    loadBackupHistory();
  }
}

function settingsMessage(text, tone = "neutral") {
  if (!el.settingsMessage) return;
  el.settingsMessage.textContent = text;
  el.settingsMessage.classList.remove("ok", "warn", "error", "busy");
  if (tone && tone !== "neutral") el.settingsMessage.classList.add(tone);
}

function setSettingsDirty(dirty = true) {
  if (state.settingsSaving) return;
  state.settingsDirty = Boolean(dirty);
  if (state.settingsDirty) {
    settingsMessage("Unsaved changes.", "warn");
  }
}

function setSettingsSaving(saving) {
  state.settingsSaving = Boolean(saving);
  if (el.saveSettingsBtn) {
    el.saveSettingsBtn.disabled = state.settingsSaving;
    el.saveSettingsBtn.textContent = state.settingsSaving ? "Saving..." : "Save";
  }
}

function backupSubtitle(item) {
  const pieces = [];
  if (item.action_label) pieces.push(item.action_label);
  if (item.created_at) pieces.push(formatDateTime(item.created_at));
  if (item.backup_count) pieces.push(`${fmt(item.backup_count)} ${item.backup_count === 1 ? "file" : "files"}`);
  return pieces.join(" - ");
}

function renderBackupList() {
  if (!el.backupList) return;
  if (!state.backupsLoaded) {
    el.backupList.innerHTML = '<p class="backup-empty">Open this page to load recent backups.</p>';
    return;
  }
  if (!state.backups.length) {
    el.backupList.innerHTML = '<p class="backup-empty">No restorable backups found yet.</p>';
    return;
  }
  el.backupList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.backups.forEach((item) => {
    const row = document.createElement("article");
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("p");
    const button = document.createElement("button");
    row.className = "backup-row";
    copy.className = "backup-copy";
    title.textContent = item.album_label || "Unknown album";
    meta.textContent = item.missing_backup_count
      ? `${backupSubtitle(item)} - ${fmt(item.missing_backup_count)} backup file(s) missing`
      : backupSubtitle(item);
    button.className = "ghost";
    button.type = "button";
    button.textContent = "Restore";
    button.dataset.historyId = item.history_id;
    button.disabled = state.actionActive || !item.restorable;
    copy.append(title, meta);
    row.append(copy, button);
    fragment.appendChild(row);
  });
  el.backupList.appendChild(fragment);
}

async function loadBackupHistory() {
  if (!el.backupList) return;
  el.backupList.innerHTML = '<p class="backup-empty">Loading backups...</p>';
  try {
    const payload = await api("/api/backups?limit=100");
    state.backups = payload.backups || [];
    state.backupsLoaded = true;
    renderBackupList();
  } catch (error) {
    state.backups = [];
    state.backupsLoaded = true;
    el.backupList.innerHTML = `<p class="backup-empty">${error.message || "Backups could not be loaded."}</p>`;
  }
}

async function restoreBackup(historyId) {
  const item = state.backups.find((backup) => String(backup.history_id) === String(historyId));
  if (!item || state.actionActive || !item.restorable) return;
  const confirmed = window.confirm(`Restore the previous files for ${item.album_label}? The current files will be backed up first.`);
  if (!confirmed) return;
  state.actionActive = true;
  settingsMessage("Starting restore on the NAS...", "busy");
  renderBackupList();
  updateActionButtons();
  try {
    await api("/api/backup/restore", {
      method: "POST",
      body: JSON.stringify({ history_id: item.history_id }),
    });
    await refreshStatus();
    scheduleTick(500);
    settingsMessage("Restore started.", "ok");
  } catch (error) {
    state.actionActive = false;
    settingsMessage(error.message || "Restore could not start.", "error");
    renderBackupList();
    updateActionButtons();
  }
}

function maintenanceMessage(text) {
  if (el.maintenanceResult) el.maintenanceResult.textContent = text;
  settingsMessage(text);
}

function diagnosticsFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `artwork-manager-diagnostics-${stamp}.txt`;
}

async function downloadDiagnostics() {
  if (!state.token && state.appInfo.token_required) {
    setSettingsTab("security");
    maintenanceMessage("Enter the NAS token first.");
    return;
  }
  const selected = state.selectedKey ? `?album_key=${encodeURIComponent(state.selectedKey)}` : "";
  maintenanceMessage("Preparing diagnostics...");
  try {
    const response = await fetch(`/api/diagnostics${selected}`, { headers: headers() });
    if (response.status === 401) throw new Error("Token required");
    if (!response.ok) throw new Error("Diagnostics could not be created.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = diagnosticsFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    maintenanceMessage("Diagnostics downloaded.");
  } catch (error) {
    if (error.message === "Token required") {
      el.unlockPanel.classList.remove("hidden");
      setSettingsTab("security");
    }
    maintenanceMessage(error.message || "Diagnostics could not be created.");
  }
}

function maintenanceSummary(payload = {}) {
  if (payload.job_id) return "Queue repair started. This can take a little while on a large library.";
  const removed = Number(payload.removed || 0);
  const affected = Number(payload.affected_albums || 0);
  const reclassified = Number(payload.reclassified || 0);
  return `Cleaned ${fmt(removed)} stale option${removed === 1 ? "" : "s"} from ${fmt(affected)} album${affected === 1 ? "" : "s"}. ${fmt(reclassified)} album${reclassified === 1 ? "" : "s"} moved back to Needs Work.`;
}

function latestRecentJob(status, kind) {
  const jobs = Array.isArray(status?.recent_jobs) ? status.recent_jobs : [];
  return jobs.find((job) => job && job.kind === kind) || null;
}

function renderFinishedAction(status) {
  const repair = latestRecentJob(status, "repair-queue");
  if (!repair) return;
  const checked = Number(repair.checked || 0);
  const changed = Number(repair.changed || 0);
  const unavailable = Number(repair.unavailable || 0);
  const failed = Number(repair.failed_count || 0);
  const issues = unavailable || failed ? ` ${fmt(unavailable + failed)} could not be checked.` : "";
  maintenanceMessage(`Queue repair finished. Checked ${fmt(checked)} album${checked === 1 ? "" : "s"}; updated ${fmt(changed)}.${issues}`);
}

async function runMaintenance(path, options = {}) {
  if (state.scanActive || state.actionActive) {
    maintenanceMessage("Wait for the current job to finish first.");
    return;
  }
  if (options.confirm && !window.confirm(options.confirm)) return;
  state.actionActive = true;
  maintenanceMessage(options.start || "Starting maintenance...");
  updateActionButtons();
  if (el.repairQueueBtn) el.repairQueueBtn.disabled = true;
  if (el.cleanupStaleBtn) el.cleanupStaleBtn.disabled = true;
  try {
    const payload = await api(path, { method: "POST", body: JSON.stringify({}) });
    maintenanceMessage(maintenanceSummary(payload));
    await refreshStatus();
    await refreshQueue({ force: true });
    scheduleTick(payload.job_id ? 500 : 10000);
  } catch (error) {
    state.actionActive = false;
    maintenanceMessage(error.message || "Maintenance could not start.");
  } finally {
    if (!state.actionActive) {
      if (el.repairQueueBtn) el.repairQueueBtn.disabled = false;
      if (el.cleanupStaleBtn) el.cleanupStaleBtn.disabled = false;
      updateActionButtons();
    }
  }
}

function startRepairQueue() {
  runMaintenance("/api/maintenance/repair-queue", {
    start: "Starting queue repair...",
    confirm: "Recheck every album on the NAS using the current artwork rules? This may take a while.",
  });
}

function cleanStaleOptions() {
  runMaintenance("/api/maintenance/clean-stale-candidates", {
    start: "Cleaning stale artwork options...",
    confirm: "Remove saved artwork options whose image files are no longer present?",
  });
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
  el.settingMusicbrainzEnabled.checked = Boolean(settings.musicbrainz_enabled);
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
    musicbrainz_enabled: el.settingMusicbrainzEnabled.checked,
    max_candidates_per_album: Number(el.settingMaxCandidates.value || 5),
    parallel_provider_workers: Number(el.settingProviderWorkers.value || 2),
  };
}

async function loadSettings() {
  const payload = await api("/api/settings");
  state.settingsLoaded = true;
  populateSettings(payload);
  state.settingsDirty = false;
  settingsMessage("Ready.");
  return payload;
}

async function openSettings(tab = "general") {
  state.settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  el.settingsOverlay.classList.remove("hidden");
  syncModalIsolation();
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
    settingsMessage(error.message === "Token required" ? "Enter the token in Security, then save." : "Settings could not be loaded.", "error");
    setSettingsTab("security");
  }
  el.closeSettingsBtn.focus({ preventScroll: true });
}

function closeSettings() {
  el.settingsOverlay.classList.add("hidden");
  syncModalIsolation();
  if (state.settingsReturnFocus?.isConnected) {
    state.settingsReturnFocus.focus({ preventScroll: true });
  }
  state.settingsReturnFocus = null;
}

function syncTokenFromSettings() {
  state.token = el.settingToken.value.trim();
  applyTheme(el.settingThemeMode.value);
  if (state.token) {
    localStorage.setItem("amwToken", state.token);
  } else {
    localStorage.removeItem("amwToken");
  }
}

async function postSettingsFromForm() {
  const payload = await api("/api/settings", {
    method: "POST",
    body: JSON.stringify(readSettingsForm()),
  });
  populateSettings(payload);
  return payload;
}

async function saveSettings(event) {
  event.preventDefault();
  syncTokenFromSettings();
  setSettingsSaving(true);
  settingsMessage("Saving settings...", "busy");
  if (!state.settingsLoaded) {
    try {
      await loadSettings();
      await refreshStatus();
      await refreshQueue();
      state.settingsDirty = false;
      settingsMessage(`Connected and saved at ${formatTime()}.`, "ok");
    } catch (error) {
      settingsMessage("Token did not work.", "error");
    } finally {
      setSettingsSaving(false);
    }
    return;
  }
  try {
    await postSettingsFromForm();
    await refreshStatus();
    await refreshQueue();
    state.settingsDirty = false;
    settingsMessage(`Settings saved at ${formatTime()}.`, "ok");
  } catch (error) {
    settingsMessage(error.message || "Settings were not saved.", "error");
  } finally {
    setSettingsSaving(false);
  }
}

function activeScanJob(status) {
  const jobs = Array.isArray(status.active_jobs) ? status.active_jobs : [];
  return jobs.find((job) => job && job.kind === "scan-library");
}

function activeReviewJob(status) {
  const jobs = Array.isArray(status.active_jobs) ? status.active_jobs : [];
  return jobs.find((job) => job && ["artwork-search", "approve-embed", "convert-current", "restore-backup", "repair-queue"].includes(job.kind));
}

function renderScan(status) {
  const job = activeScanJob(status);
  state.scanActive = Boolean(job);
  el.scanBtn.disabled = state.scanActive;
  if (el.freshScanBtn) el.freshScanBtn.disabled = state.scanActive;
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
  const showCandidateActions = hasCandidate;
  const showAlbumTools = hasAlbum && (sourceUrl || mode !== "empty");
  const compactCandidate = (mode === "done" || mode === "empty") && !hasCandidate;
  const canConvertCurrent = hasAlbum && ["incompatible_artwork", "not_square_artwork"].includes(album.status);

  el.detailPane.classList.remove("mode-empty", "mode-work", "mode-review", "mode-done");
  el.detailPane.classList.add(`mode-${mode}`);
  el.candidatePanel.classList.toggle("compact", compactCandidate);
  el.candidateTitle.textContent = mode === "done" ? "Replacement Cover" : "Candidate";
  el.candidatePosition.classList.toggle("hidden", compactCandidate);
  el.actionsTitle.textContent = "Actions";
  el.findArtworkBtn.textContent = mode === "done" ? "Search Again" : "Find Artwork";
  el.findArtworkBtn.classList.toggle("primary", mode !== "done");
  el.findArtworkBtn.classList.toggle("ghost", mode === "done");

  setVisible(el.primaryActionRow, hasAlbum);
  setVisible(el.findArtworkBtn, hasAlbum);
  setVisible(el.approveEmbedBtn, hasCandidate);
  setVisible(el.convertCurrentBtn, canConvertCurrent);
  setVisible(el.candidateActionRow, showCandidateActions);
  setVisible(el.prevCandidateBtn, state.candidates.length > 1);
  setVisible(el.nextCandidateBtn, state.candidates.length > 1);
  setVisible(el.rejectCandidateBtn, hasCandidate);
  setVisible(el.rejectAllBtn, hasCandidate && state.candidates.length > 1);
  setVisible(el.quietActionRow, showAlbumTools);
  setVisible(el.importImageBtn, hasAlbum);
  setVisible(el.recheckAlbumBtn, hasAlbum);
  setVisible(el.openSourceBtn, Boolean(sourceUrl));
  setVisible(el.googleImagesBtn, hasAlbum);
  setVisible(el.markGoodBtn, hasAlbum && mode !== "done");
  setVisible(el.skipAlbumBtn, hasAlbum && mode !== "done");

  el.findArtworkBtn.disabled = !hasAlbum || busy;
  el.approveEmbedBtn.disabled = !album || !hasCandidate || busy;
  el.convertCurrentBtn.disabled = !canConvertCurrent || busy;
  el.prevCandidateBtn.disabled = !canNavigateCandidates;
  el.nextCandidateBtn.disabled = !canNavigateCandidates;
  el.rejectCandidateBtn.disabled = !album || !hasCandidate || busy;
  el.rejectAllBtn.disabled = !album || !hasCandidate || busy;
  el.importImageBtn.disabled = !album || busy;
  el.recheckAlbumBtn.disabled = !album || busy;
  el.openSourceBtn.disabled = !sourceUrl;
  el.googleImagesBtn.disabled = !album;
  el.markGoodBtn.disabled = !album || busy;
  el.skipAlbumBtn.disabled = !album || busy;
}

function renderReviewJob(status) {
  const job = activeReviewJob(status);
  state.actionActive = Boolean(job);
  const maintenanceBusy = state.scanActive || state.actionActive;
  if (el.repairQueueBtn) el.repairQueueBtn.disabled = maintenanceBusy;
  if (el.cleanupStaleBtn) el.cleanupStaleBtn.disabled = maintenanceBusy;
  if (job) {
    const count = job.candidate_count ? ` - ${fmt(job.candidate_count)} option(s)` : "";
    const label = job.kind === "approve-embed"
      ? "Embedding artwork"
      : (job.kind === "convert-current" ? "Converting current artwork" : (job.kind === "restore-backup" ? "Restoring backup" : (job.kind === "repair-queue" ? "Repairing queue" : "Searching artwork")));
    el.actionMessage.textContent = `${label}${count}...`;
    if (job.kind === "repair-queue") maintenanceMessage(job.label || "Repairing queue...");
  }
  updateActionButtons();
  if (!el.settingsOverlay.classList.contains("hidden")) renderBackupList();
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
      if (el.settingsOverlay.classList.contains("hidden")) {
        applyTheme(app.settings.theme_mode || localStorage.getItem("amwThemeMode") || "Auto");
      }
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
  updateSearchControls();
  el.shownCount.textContent = `${fmt(state.albums.length)} shown`;
  if (!state.albums.length) {
    const emptyText = state.query ? `No albums match "${state.query}".` : "No albums in this view.";
    el.albumRows.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty";
    cell.textContent = emptyText;
    row.appendChild(cell);
    el.albumRows.appendChild(row);
    return;
  }
  el.albumRows.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.albums.forEach((album) => {
    const row = document.createElement("tr");
    row.dataset.albumKey = album.album_key;
    row.classList.toggle("selected", album.album_key === state.selectedKey);
    row.setAttribute("aria-selected", album.album_key === state.selectedKey ? "true" : "false");
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
  const autoHandoff = Boolean(options.autoHandoff) && !state.query;
  const previousSelected = state.selectedKey;
  const params = new URLSearchParams({ bucket: state.bucket, q: state.query });
  try {
    const payload = await api(`/api/albums?${params}`);
    const counts = payload.counts || {};
    const albums = payload.albums || [];
    if (autoHandoff && !albums.length && state.bucket === "Review" && Number(counts["Needs Work"] || 0) > 0) {
      state.bucket = "Needs Work";
      localStorage.setItem("amwBucket", state.bucket);
      return refreshQueue({ force: true, autoHandoff: false });
    }
    if (autoHandoff && !albums.length && state.bucket === "Needs Work" && Number(counts["Review"] || 0) > 0) {
      state.bucket = "Review";
      localStorage.setItem("amwBucket", state.bucket);
      return refreshQueue({ force: true, autoHandoff: false });
    }
    const signature = queueSignature(albums);
    const queueChanged = force || signature !== state.queueSignature || albums.length !== state.albums.length;
    state.albums = albums;
    state.queueSignature = signature;
    setCounts(counts);
    if (!state.albums.find((album) => album.album_key === state.selectedKey)) {
      const preferred = state.preferredNextKey && state.albums.find((album) => album.album_key === state.preferredNextKey);
      const nextKey = preferred?.album_key || state.albums[0]?.album_key || "";
      state.selectedKey = nextKey;
      state.detailOpen = Boolean(nextKey) && isPhoneLayout() && state.detailOpen;
      state.preferredNextKey = "";
    } else if (!state.actionActive) {
      state.preferredNextKey = "";
    }
    if (queueChanged) renderRows();
    if (queueChanged || previousSelected !== state.selectedKey || force) {
      renderSelected();
    } else {
      updateActionButtons();
    }
  } catch (error) {
    state.albums = [];
    state.preferredNextKey = "";
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
  if (!album) {
    el.coverPlaceholder.textContent = "No artwork";
    el.coverMeta.textContent = "No cover selected.";
    updateArtworkViewer();
    return;
  }
  el.coverPlaceholder.textContent = "Loading cover...";
  el.coverMeta.textContent = album.size_label || "Checking current cover...";
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
    updateArtworkViewer();
  } catch (error) {
    el.coverPlaceholder.textContent = "No artwork";
    el.coverMeta.textContent = album.status_reason || "No readable embedded cover.";
    updateArtworkViewer();
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
  if (!candidate) {
    el.candidatePlaceholder.textContent = "No candidate";
    updateArtworkViewer();
    return;
  }
  el.candidatePlaceholder.textContent = "Loading cover...";
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
    updateArtworkViewer();
  } catch (error) {
    el.candidatePlaceholder.textContent = "Candidate unavailable";
    updateArtworkViewer();
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
    el.candidateMeta.removeAttribute("title");
    if (!state.actionActive) {
      el.actionMessage.textContent = idleActionMessage(album);
    }
    loadCandidateCover(null);
    updateActionButtons();
    return;
  }
  el.candidateMeta.textContent = candidateShortLabel(candidate);
  el.candidateMeta.title = candidateLabel(candidate);
  if (!state.actionActive) {
    el.actionMessage.textContent = idleActionMessage(album);
  }
  loadCandidateCover(candidate);
  updateActionButtons();
}

async function refreshCandidates(album, preferredCandidateId = null) {
  if (!album) {
    state.candidates = [];
    state.candidateIndex = 0;
    renderCandidate();
    return;
  }
  const previousId = preferredCandidateId || selectedCandidate()?.candidate_id;
  try {
    const payload = await api(`/api/candidates?album_key=${encodeURIComponent(album.album_key)}`);
    if (album.album_key !== state.selectedKey) return;
    state.candidates = payload.candidates || [];
    const previousIndex = state.candidates.findIndex((candidate) => String(candidate.candidate_id) === String(previousId));
    state.candidateIndex = previousIndex >= 0 ? previousIndex : 0;
    renderCandidate();
  } catch (error) {
    state.candidates = [];
    state.candidateIndex = 0;
    renderCandidate();
  }
}

function clearProblemFiles(message = "") {
  state.problemKey = "";
  el.problemFiles.classList.toggle("hidden", !message);
  el.problemCount.textContent = "";
  el.problemFileList.innerHTML = message ? `<li><div class="problem-file-name">${message}</div></li>` : "";
}

function renderProblemFiles(problemFiles, check) {
  const problems = Array.isArray(problemFiles) ? problemFiles : [];
  if (!problems.length) {
    clearProblemFiles();
    return;
  }
  const visible = problems.slice(0, 6);
  el.problemFiles.classList.remove("hidden");
  el.problemCount.textContent = problems.length > visible.length ? `${visible.length} of ${problems.length}` : `${problems.length}`;
  el.problemFileList.innerHTML = "";
  const fragment = document.createDocumentFragment();
  visible.forEach((problem) => {
    const issues = Array.isArray(problem.issues) ? problem.issues.join(", ") : String(problem.issue || problem.reason || "");
    const dims = problem.dimensions ? ` (${problem.dimensions})` : "";
    const item = document.createElement("li");
    const name = document.createElement("div");
    const issue = document.createElement("div");
    const issueText = `${issues || "Needs attention"}${dims}`;
    name.className = "problem-file-name";
    issue.className = "problem-file-issue";
    name.textContent = shortProblemPath(problem.file || problem.path || problem.name || "");
    name.title = problem.file || problem.path || problem.name || "";
    issue.textContent = issueText;
    item.setAttribute("aria-label", `${name.textContent}: ${issueText}`);
    item.append(name, document.createTextNode(" "), issue);
    fragment.appendChild(item);
  });
  el.problemFileList.appendChild(fragment);
}

async function loadProblemFiles(album) {
  if (!album || workflowMode(album) === "done") {
    clearProblemFiles();
    return;
  }
  const albumKey = album.album_key;
  state.problemKey = albumKey;
  clearProblemFiles();
  state.problemKey = albumKey;
  try {
    const payload = await api(`/api/album/problems?album_key=${encodeURIComponent(albumKey)}`);
    if (state.problemKey !== albumKey || state.selectedKey !== albumKey) return;
    renderProblemFiles(payload.problem_files || [], payload.deep_file_check || {});
  } catch (error) {
    if (state.problemKey !== albumKey || state.selectedKey !== albumKey) return;
    clearProblemFiles();
  }
}

function renderSelected() {
  const album = selectedAlbum();
  el.albumRows.querySelectorAll("tr").forEach((row) => {
    const selected = row.dataset.albumKey === state.selectedKey;
    row.classList.toggle("selected", selected);
    if (row.dataset.albumKey) row.setAttribute("aria-selected", selected ? "true" : "false");
  });
  syncResponsiveState();
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
    clearProblemFiles();
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
  loadProblemFiles(album);
  updateActionButtons();
}

function selectAlbum(albumKey, options = {}) {
  state.selectedKey = albumKey || "";
  if (!options.keepPreferred) state.preferredNextKey = "";
  state.detailOpen = options.openDetail === false ? state.detailOpen : Boolean(state.selectedKey);
  renderSelected();
  if (options.focusQueue) focusQueue();
}

async function startScan(options = {}) {
  const freshDatabase = Boolean(options.freshDatabase);
  el.scanBtn.disabled = true;
  try {
    if (freshDatabase) {
      state.albums = [];
      state.selectedKey = "";
      state.candidates = [];
      state.queueSignature = "";
      state.candidateIndex = 0;
      setCounts({});
      renderRows();
      renderSelected();
    }
    await api("/api/scan/start", {
      method: "POST",
      body: JSON.stringify(freshDatabase ? { fresh_database: true, resume: false } : {}),
    });
    await refreshStatus();
    await refreshQueue({ force: true });
    scheduleTick(500);
  } catch (error) {
    el.scanBtn.disabled = false;
    if (freshDatabase) await refreshQueue({ force: true });
    el.workerSummary.textContent = error.message || "Scan could not start";
  }
}

async function startFreshScanFromSettings() {
  if (state.scanActive || state.actionActive) {
    settingsMessage("Wait for the current job to finish first.", "warn");
    return;
  }
  const root = el.settingLibraryRoot.value.trim() || "/music";
  const confirmed = window.confirm(`Clear the current queue database and scan ${root} from scratch? Settings and backups will be kept.`);
  if (!confirmed) return;
  syncTokenFromSettings();
  el.freshScanBtn.disabled = true;
  el.scanBtn.disabled = true;
  setSettingsSaving(true);
  settingsMessage("Saving settings...", "busy");
  try {
    await postSettingsFromForm();
    state.settingsDirty = false;
    settingsMessage("Clearing queue and starting a fresh scan...", "busy");
    closeSettings();
    await startScan({ freshDatabase: true });
  } catch (error) {
    settingsMessage(error.message || "Fresh scan could not start.", "error");
    el.scanBtn.disabled = false;
  } finally {
    setSettingsSaving(false);
    if (!state.scanActive && el.freshScanBtn) el.freshScanBtn.disabled = false;
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
  const warning = candidateApprovalWarning(candidate);
  if (warning && !window.confirm(warning)) return;
  rememberNextSelection();
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

function openImportImagePicker() {
  if (!selectedAlbum()) return;
  el.importImageInput.click();
}

async function importSelectedImage(file) {
  const album = selectedAlbum();
  if (!album || !file) return;
  if (file.size > 25_000_000) {
    el.actionMessage.textContent = "That image is too large to import.";
    return;
  }
  state.actionActive = true;
  el.actionMessage.textContent = "Importing image...";
  updateActionButtons();
  try {
    const imageB64 = await fileToBase64(file);
    const payload = await api("/api/artwork/import", {
      method: "POST",
      body: JSON.stringify({
        album_key: album.album_key,
        filename: file.name || "Imported image",
        mime: file.type || "",
        image_b64: imageB64,
      }),
    });
    state.actionActive = false;
    await refreshStatus();
    await refreshQueue({ force: true });
    await refreshCandidates(selectedAlbum(), payload.candidate_id);
    el.actionMessage.textContent = "Imported image. Review it, then approve or reject it.";
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "Image could not be imported.";
    updateActionButtons();
  } finally {
    el.importImageInput.value = "";
  }
}

async function convertCurrentArtwork() {
  const album = selectedAlbum();
  if (!album) return;
  rememberNextSelection();
  state.actionActive = true;
  el.actionMessage.textContent = "Converting current artwork on the NAS...";
  updateActionButtons();
  try {
    await api("/api/artwork/convert-current", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key }),
    });
    await refreshStatus();
    scheduleTick(500);
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "Current artwork could not be converted.";
    updateActionButtons();
  }
}

async function rejectSelectedCandidate() {
  const album = selectedAlbum();
  const candidate = selectedCandidate();
  if (!album || !candidate) return;
  rememberNextSelection();
  state.actionActive = true;
  el.actionMessage.textContent = "Rejecting this cover option...";
  updateActionButtons();
  try {
    await api("/api/artwork/reject", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key, candidate_id: candidate.candidate_id }),
    });
    await refreshQueue({ autoHandoff: true });
    await refreshCandidates(selectedAlbum());
    el.actionMessage.textContent = "Rejected cover option.";
  } catch (error) {
    el.actionMessage.textContent = error.message || "Candidate could not be rejected.";
  } finally {
    state.actionActive = false;
    updateActionButtons();
  }
}

async function rejectAllCandidates() {
  const album = selectedAlbum();
  if (!album || !state.candidates.length) return;
  const count = state.candidates.length;
  const confirmed = window.confirm(`Reject all ${count} saved cover option${count === 1 ? "" : "s"} for ${album.artist} - ${album.album}?`);
  if (!confirmed) return;
  rememberNextSelection();
  state.actionActive = true;
  el.actionMessage.textContent = "Rejecting saved cover options...";
  updateActionButtons();
  try {
    await api("/api/artwork/reject-all", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key }),
    });
    state.candidates = [];
    state.candidateIndex = 0;
    renderCandidate();
    await refreshQueue({ force: true, autoHandoff: true });
    await refreshCandidates(selectedAlbum());
    el.actionMessage.textContent = "Rejected saved cover options.";
  } catch (error) {
    el.actionMessage.textContent = error.message || "Saved cover options could not be rejected.";
  } finally {
    state.actionActive = false;
    updateActionButtons();
  }
}

async function runAlbumAction(path, message, options = {}) {
  const album = selectedAlbum();
  if (!album) return;
  rememberNextSelection();
  state.actionActive = true;
  el.actionMessage.textContent = options.start || "Working on this album...";
  updateActionButtons();
  try {
    await api(path, {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key }),
    });
    el.actionMessage.textContent = message;
    await refreshQueue({ force: true, autoHandoff: true });
    await refreshCandidates(selectedAlbum());
  } catch (error) {
    el.actionMessage.textContent = error.message || "Action failed.";
  } finally {
    state.actionActive = false;
    updateActionButtons();
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

function artworkViewerPayload(kind = state.viewerKind) {
  const album = selectedAlbum();
  if (kind === "candidate") {
    const candidate = selectedCandidate();
    if (!candidate || !state.candidateUrl) return null;
    return {
      src: state.candidateUrl,
      title: "Replacement Cover",
      meta: candidateLabel(candidate),
      navigable: state.candidates.length > 1,
    };
  }
  if (!album || !state.coverUrl) return null;
  return {
    src: state.coverUrl,
    title: "Current Cover",
    meta: [album.artist, album.album, album.size_label].filter(Boolean).join(" - "),
    navigable: false,
  };
}

function setViewerFitMode(mode) {
  state.viewerFitMode = mode === "actual" ? "actual" : "fit";
  el.artworkOverlay.classList.toggle("viewer-actual", state.viewerFitMode === "actual");
  if (el.toggleViewerFitBtn) {
    el.toggleViewerFitBtn.textContent = state.viewerFitMode === "actual" ? "Fit" : "Actual Size";
    el.toggleViewerFitBtn.setAttribute(
      "aria-label",
      state.viewerFitMode === "actual" ? "Fit artwork to the window" : "Show artwork at actual size",
    );
  }
}

function toggleViewerFitMode() {
  setViewerFitMode(state.viewerFitMode === "actual" ? "fit" : "actual");
}

function updateArtworkViewer() {
  if (!state.viewerOpen) return;
  const payload = artworkViewerPayload();
  if (!payload) {
    closeArtworkViewer();
    return;
  }
  el.artworkViewerTitle.textContent = payload.title;
  el.artworkViewerMeta.textContent = payload.meta || "Artwork";
  el.artworkViewerImage.src = payload.src;
  el.artworkViewerNav.classList.toggle("hidden", !payload.navigable);
  el.viewerPrevBtn.disabled = !payload.navigable;
  el.viewerNextBtn.disabled = !payload.navigable;
  if (el.toggleViewerFitBtn) el.toggleViewerFitBtn.disabled = false;
}

function openArtworkViewer(kind) {
  if (!hasCover(kind)) return;
  state.viewerReturnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
    ? document.activeElement
    : document.querySelector(`.cover-box[data-artwork-kind="${kind}"]`);
  state.viewerOpen = true;
  state.viewerKind = kind;
  setViewerFitMode("fit");
  el.artworkOverlay.classList.remove("hidden");
  document.body.classList.add("viewer-open");
  syncModalIsolation();
  updateArtworkViewer();
  el.closeArtworkViewerBtn.focus({ preventScroll: true });
}

function closeArtworkViewer() {
  state.viewerOpen = false;
  state.viewerKind = "";
  setViewerFitMode("fit");
  el.artworkOverlay.classList.add("hidden");
  document.body.classList.remove("viewer-open");
  el.artworkViewerImage.removeAttribute("src");
  syncModalIsolation();
  if (state.viewerReturnFocus?.isConnected) {
    state.viewerReturnFocus.focus({ preventScroll: true });
  }
  state.viewerReturnFocus = null;
}

function bind() {
  el.refreshBtn.addEventListener("click", async () => {
    await refreshStatus();
    await refreshQueue({ force: true });
    scheduleTick(10000);
  });
  el.settingsBtn.addEventListener("click", () => openSettings("general"));
  el.unlockSettingsBtn.addEventListener("click", () => openSettings("security"));
  el.backToQueueBtn.addEventListener("click", () => {
    state.detailOpen = false;
    syncResponsiveState();
    focusQueue();
  });
  el.closeSettingsBtn.addEventListener("click", closeSettings);
  el.settingsForm.addEventListener("submit", saveSettings);
  el.settingsForm.addEventListener("input", () => setSettingsDirty(true));
  el.settingsForm.addEventListener("change", () => setSettingsDirty(true));
  el.settingsOverlay.addEventListener("click", (event) => {
    if (event.target === el.settingsOverlay) closeSettings();
  });
  document.querySelectorAll(".settings-tab").forEach((button) => {
    button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab || "general"));
  });
  if (el.loadBackupsBtn) el.loadBackupsBtn.addEventListener("click", loadBackupHistory);
  if (el.downloadDiagnosticsBtn) el.downloadDiagnosticsBtn.addEventListener("click", downloadDiagnostics);
  if (el.repairQueueBtn) el.repairQueueBtn.addEventListener("click", startRepairQueue);
  if (el.cleanupStaleBtn) el.cleanupStaleBtn.addEventListener("click", cleanStaleOptions);
  if (el.backupList) {
    el.backupList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-history-id]");
      if (button) restoreBackup(button.dataset.historyId);
    });
  }
  el.settingThemeMode.addEventListener("change", () => applyTheme(el.settingThemeMode.value));
  el.scanBtn.addEventListener("click", startScan);
  if (el.freshScanBtn) el.freshScanBtn.addEventListener("click", startFreshScanFromSettings);
  el.findArtworkBtn.addEventListener("click", startArtworkSearch);
  el.approveEmbedBtn.addEventListener("click", approveSelectedCandidate);
  el.convertCurrentBtn.addEventListener("click", convertCurrentArtwork);
  el.rejectCandidateBtn.addEventListener("click", rejectSelectedCandidate);
  el.rejectAllBtn.addEventListener("click", rejectAllCandidates);
  el.prevCandidateBtn.addEventListener("click", () => moveCandidate(-1));
  el.nextCandidateBtn.addEventListener("click", () => moveCandidate(1));
  el.importImageBtn.addEventListener("click", openImportImagePicker);
  el.importImageInput.addEventListener("change", () => importSelectedImage(el.importImageInput.files?.[0]));
  el.recheckAlbumBtn.addEventListener("click", () => runAlbumAction("/api/album/recheck", "Rechecked album.", { start: "Rechecking this album..." }));
  el.openSourceBtn.addEventListener("click", openSourcePage);
  el.googleImagesBtn.addEventListener("click", openGoogleImages);
  el.markGoodBtn.addEventListener("click", () => runAlbumAction("/api/album/mark-good", "Marked as good."));
  el.skipAlbumBtn.addEventListener("click", () => runAlbumAction("/api/album/skip", "Skipped for now."));
  el.albumRows.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-album-key]");
    if (row) selectAlbum(row.dataset.albumKey, { focusQueue: true });
  });
  el.queueTableWrap.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveQueueSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveQueueSelection(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (state.albums.length) selectAlbum(state.albums[0].album_key, { openDetail: false, focusQueue: true });
      scrollSelectedIntoView();
    } else if (event.key === "End") {
      event.preventDefault();
      if (state.albums.length) selectAlbum(state.albums[state.albums.length - 1].album_key, { openDetail: false, focusQueue: true });
      scrollSelectedIntoView();
    }
  });
  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value.trim();
    state.preferredNextKey = "";
    updateSearchControls();
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => refreshQueue({ force: true }), 180);
  });
  el.clearSearchBtn.addEventListener("click", () => {
    state.query = "";
    state.preferredNextKey = "";
    el.searchInput.value = "";
    updateSearchControls();
    window.clearTimeout(state.searchTimer);
    refreshQueue({ force: true });
    el.searchInput.focus({ preventScroll: true });
  });
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.bucket = chip.dataset.bucket || "All";
      state.preferredNextKey = "";
      localStorage.setItem("amwBucket", state.bucket);
      refreshQueue({ force: true });
    });
  });
  document.querySelectorAll(".cover-box.inspectable").forEach((box) => {
    const open = () => openArtworkViewer(box.dataset.artworkKind || "current");
    box.addEventListener("click", open);
    box.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  el.closeArtworkViewerBtn.addEventListener("click", closeArtworkViewer);
  if (el.toggleViewerFitBtn) el.toggleViewerFitBtn.addEventListener("click", toggleViewerFitMode);
  el.artworkOverlay.addEventListener("click", (event) => {
    if (event.target === el.artworkOverlay) closeArtworkViewer();
  });
  el.viewerPrevBtn.addEventListener("click", () => moveCandidate(-1));
  el.viewerNextBtn.addEventListener("click", () => moveCandidate(1));
  if (el.artworkViewerFrame) {
    el.artworkViewerFrame.addEventListener("dblclick", toggleViewerFitMode);
    el.artworkViewerFrame.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      state.viewerTouchX = touch.clientX;
      state.viewerTouchY = touch.clientY;
    }, { passive: true });
    el.artworkViewerFrame.addEventListener("touchend", (event) => {
      if (!state.viewerOpen || state.viewerKind !== "candidate" || state.viewerFitMode === "actual") return;
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - state.viewerTouchX;
      const dy = touch.clientY - state.viewerTouchY;
      if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        moveCandidate(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }
  document.addEventListener("keydown", (event) => {
    if (!state.viewerOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeArtworkViewer();
    } else if (event.key === "ArrowLeft" && state.viewerKind === "candidate") {
      event.preventDefault();
      moveCandidate(-1);
    } else if (event.key === "ArrowRight" && state.viewerKind === "candidate") {
      event.preventDefault();
      moveCandidate(1);
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleViewerFitMode();
    }
  });
  window.addEventListener("resize", syncResponsiveState);
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
      const actionFinished = hadAction && !state.actionActive;
      if (actionFinished) renderFinishedAction(status);
      await refreshQueue({ autoHandoff: actionFinished });
      if (state.selectedKey) {
        await refreshCandidates(selectedAlbum());
      }
    }
  } finally {
    scheduleTick();
  }
}

applyTheme(localStorage.getItem("amwThemeMode") || "Auto");
syncResponsiveState();
bind();
refreshStatus().then(() => refreshQueue({ force: true })).finally(() => scheduleTick());
