const state = {
  token: localStorage.getItem("amwToken") || "",
  bucket: localStorage.getItem("amwBucket") || "All",
  query: "",
  albums: [],
  selectedKey: "",
  selectedKeys: new Set(),
  selectionMode: false,
  batchMenuOpen: false,
  coverUrl: "",
  candidateUrl: "",
  candidates: [],
  backups: [],
  backupsLoaded: false,
  candidateIndex: 0,
  scanActive: false,
  actionActive: false,
  activeJobs: [],
  advanceAfterKey: "",
  settingsTab: "general",
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
  queuePane: document.getElementById("queuePane"),
  shownCount: document.getElementById("shownCount"),
  selectModeBtn: document.getElementById("selectModeBtn"),
  batchMenu: document.getElementById("batchMenu"),
  batchMenuBtn: document.getElementById("batchMenuBtn"),
  batchMenuPanel: document.getElementById("batchMenuPanel"),
  selectedCount: document.getElementById("selectedCount"),
  batchSelectAllBtn: document.getElementById("batchSelectAllBtn"),
  batchFindBtn: document.getElementById("batchFindBtn"),
  batchConvertBtn: document.getElementById("batchConvertBtn"),
  batchMarkGoodBtn: document.getElementById("batchMarkGoodBtn"),
  batchSkipBtn: document.getElementById("batchSkipBtn"),
  batchIgnoreBtn: document.getElementById("batchIgnoreBtn"),
  batchReworkBtn: document.getElementById("batchReworkBtn"),
  stopJobBtn: document.getElementById("stopJobBtn"),
  refreshStorageBtn: document.getElementById("refreshStorageBtn"),
  cleanStorageBtn: document.getElementById("cleanStorageBtn"),
  storageWaiting: document.getElementById("storageWaiting"),
  storageHandled: document.getElementById("storageHandled"),
  storageLeftover: document.getElementById("storageLeftover"),
  storageBackups: document.getElementById("storageBackups"),
  storageResult: document.getElementById("storageResult"),
  historyKind: document.getElementById("historyKind"),
  historySearch: document.getElementById("historySearch"),
  historyList: document.getElementById("historyList"),
  historyCount: document.getElementById("historyCount"),
  historyMoreBtn: document.getElementById("historyMoreBtn"),
  undoEmbedBtn: document.getElementById("undoEmbedBtn"),
  reworkAlbumBtn: document.getElementById("reworkAlbumBtn"),
  ignoreAlbumBtn: document.getElementById("ignoreAlbumBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
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
  candidateOptions: document.getElementById("candidateOptions"),
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
  chooseReleaseBtn: document.getElementById("chooseReleaseBtn"),
  releaseOverlay: document.getElementById("releaseOverlay"),
  releaseSubtitle: document.getElementById("releaseSubtitle"),
  closeReleaseBtn: document.getElementById("closeReleaseBtn"),
  releaseLinkForm: document.getElementById("releaseLinkForm"),
  releaseLinkInput: document.getElementById("releaseLinkInput"),
  releaseLinkBtn: document.getElementById("releaseLinkBtn"),
  releaseSearchForm: document.getElementById("releaseSearchForm"),
  releaseArtistInput: document.getElementById("releaseArtistInput"),
  releaseAlbumInput: document.getElementById("releaseAlbumInput"),
  releaseSearchBtn: document.getElementById("releaseSearchBtn"),
  releaseMessage: document.getElementById("releaseMessage"),
  releaseList: document.getElementById("releaseList"),
  findArtworkBtn: document.getElementById("findArtworkBtn"),
  approveEmbedBtn: document.getElementById("approveEmbedBtn"),
  convertCurrentBtn: document.getElementById("convertCurrentBtn"),
  prevCandidateBtn: document.getElementById("prevCandidateBtn"),
  nextCandidateBtn: document.getElementById("nextCandidateBtn"),
  rejectCandidateBtn: document.getElementById("rejectCandidateBtn"),
  rejectAllBtn: document.getElementById("rejectAllBtn"),
  importImageBtn: document.getElementById("importImageBtn"),
  recheckAlbumBtn: document.getElementById("recheckAlbumBtn"),
  copyFolderBtn: document.getElementById("copyFolderBtn"),
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
  settingDensity: document.getElementById("settingDensity"),
  shortcutsOverlay: document.getElementById("shortcutsOverlay"),
  closeShortcutsBtn: document.getElementById("closeShortcutsBtn"),
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
  settingWarnLowConfidence: document.getElementById("settingWarnLowConfidence"),
  settingDryRun: document.getElementById("settingDryRun"),
  detailFolderCover: document.getElementById("detailFolderCover"),
  settingDeezerEnabled: document.getElementById("settingDeezerEnabled"),
  sourceOrderList: document.getElementById("sourceOrderList"),
  settingItunesEnabled: document.getElementById("settingItunesEnabled"),
  settingMusicbrainzEnabled: document.getElementById("settingMusicbrainzEnabled"),
  settingDiscogsEnabled: document.getElementById("settingDiscogsEnabled"),
  settingDiscogsToken: document.getElementById("settingDiscogsToken"),
  settingDiscogsTokenStatus: document.getElementById("settingDiscogsTokenStatus"),
  settingDiscogsTokenClear: document.getElementById("settingDiscogsTokenClear"),
  actionsPanel: document.getElementById("actionsPanel"),
  tokenWarning: document.getElementById("tokenWarning"),
  tokenWarningText: document.getElementById("tokenWarningText"),
  hideTokenWarningBtn: document.getElementById("hideTokenWarningBtn"),
  moreActionsBtn: document.getElementById("moreActionsBtn"),
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

function formatShortDate(value) {
  const date = new Date(value || "");
  if (!value || Number.isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
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

function applyDensity(value) {
  const density = value === "comfortable" ? "comfortable" : "standard";
  document.documentElement.dataset.density = density;
  try { localStorage.setItem("amwDensity", density); } catch (_) { /* private mode */ }
  if (el.settingDensity) el.settingDensity.value = density;
}

function openShortcuts() {
  state.shortcutsReturnFocus = document.activeElement;
  el.shortcutsOverlay.classList.remove("hidden");
  syncModalIsolation();
  el.closeShortcutsBtn.focus();
}

function closeShortcuts() {
  el.shortcutsOverlay.classList.add("hidden");
  syncModalIsolation();
  state.shortcutsReturnFocus?.focus?.({ preventScroll: true });
}

function syncModalIsolation() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  const modalOpen = state.viewerOpen || anyDialogOpen();
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

function currentCoverLabel(album, hasReadableCover = false) {
  if (!album) return "No cover selected";
  if (hasReadableCover) {
    const size = album.size_label || "Current cover";
    const approval = album.notes?.last_approval;
    // On finished albums, say where the cover came from and when.
    if (isDoneAlbum(album) && approval?.source) {
      const when = formatShortDate(approval.approved_at);
      return `${size} - from ${approval.source}${when ? `, ${when}` : ""}`;
    }
    return size;
  }
  if (album.status === "missing_artwork") return "Missing embedded artwork";
  if (album.status === "incompatible_artwork") return "Needs conversion";
  if (album.status === "not_square_artwork") return "Not square";
  if (album.status === "needs_review") return album.size_label ? `${album.size_label} below target` : "Below target";
  if (album.status === "no_candidate") return album.size_label || "No matching replacement";
  return "No readable embedded cover";
}

function targetSize() {
  return Number(state.settings.preferred_artwork_size || state.settings.scan_min_artwork_size || 1200);
}

function summaryLead(album) {
  if (!album) return "Select an album to review";
  const target = targetSize();
  if (isDoneAlbum(album)) return `Good - target ${target}`;
  if (album.bucket === "Review") return `Review - target ${target}`;
  if (album.status === "missing_artwork") return `Missing - target ${target}`;
  if (album.status === "incompatible_artwork") return `Convert - target ${target}`;
  return `Needs work - target ${target}`;
}

function nextLabel(album) {
  if (!album) return "-";
  if (isDoneAlbum(album)) return "No action needed";
  if (album.bucket === "Review") return "Approve or reject";
  if (album.status === "missing_artwork") return "Find a cover";
  if (["incompatible_artwork", "not_square_artwork"].includes(album.status)) return "Convert or replace";
  if (album.status === "no_candidate") return "Try another search";
  return "Find artwork";
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
  // Missing art is the real problem; a cover that only needs converting is a
  // one-click fix, so it shares the amber 'needs work' colour.
  if (album.status === "missing_artwork") return "issue";
  if (album.bucket === "Needs Work") return "work";
  return "";
}

function selectedAlbum() {
  return state.albums.find((item) => item.album_key === state.selectedKey) || null;
}

function visibleAlbumKeys() {
  return state.albums.map((album) => album.album_key).filter(Boolean);
}

function batchSelectedKeys() {
  const visible = new Set(visibleAlbumKeys());
  return Array.from(state.selectedKeys).filter((key) => visible.has(key));
}

function pruneBatchSelection() {
  const visible = new Set(visibleAlbumKeys());
  state.selectedKeys = new Set(Array.from(state.selectedKeys).filter((key) => visible.has(key)));
}

function updateBatchControls() {
  const selected = batchSelectedKeys();
  const selectedCount = selected.length;
  const busy = Boolean(state.actionActive || state.scanActive);
  const allVisible = visibleAlbumKeys();
  const allSelected = allVisible.length > 0 && selectedCount === allVisible.length;

  el.queuePane.classList.toggle("selecting", state.selectionMode);
  el.shownCount.classList.toggle("hidden", state.selectionMode);
  el.selectedCount.classList.toggle("hidden", !state.selectionMode);
  el.batchMenu.classList.toggle("hidden", !state.selectionMode);
  el.selectModeBtn.textContent = state.selectionMode ? "Done" : "Select";
  el.selectModeBtn.classList.toggle("active", state.selectionMode);
  el.selectedCount.textContent = `${fmt(selectedCount)} selected`;
  el.batchSelectAllBtn.textContent = allSelected ? "Clear Shown" : "All Shown";
  el.batchMenuBtn.disabled = busy || allVisible.length === 0;

  [el.batchFindBtn, el.batchConvertBtn, el.batchMarkGoodBtn, el.batchSkipBtn, el.batchIgnoreBtn, el.batchReworkBtn, el.clearSelectionBtn].forEach((button) => {
    button.disabled = busy || selectedCount === 0;
  });
  el.batchSelectAllBtn.disabled = busy || allVisible.length === 0;
  if (!state.selectionMode || busy || !allVisible.length) {
    setBatchMenuOpen(false);
  }
}

function setBatchMenuOpen(open) {
  state.batchMenuOpen = Boolean(open && state.selectionMode);
  el.batchMenuPanel.classList.toggle("hidden", !state.batchMenuOpen);
  el.batchMenuBtn.setAttribute("aria-expanded", state.batchMenuOpen ? "true" : "false");
}

function setSelectionMode(enabled) {
  state.selectionMode = Boolean(enabled);
  if (!state.selectionMode) {
    state.selectedKeys.clear();
    setBatchMenuOpen(false);
  }
  renderRows();
}

function toggleAlbumSelection(albumKey, checked) {
  if (!albumKey) return;
  if (checked) {
    state.selectedKeys.add(albumKey);
  } else {
    state.selectedKeys.delete(albumKey);
  }
  renderRows();
}

function toggleAllShownSelection() {
  const keys = visibleAlbumKeys();
  if (!keys.length) return;
  const selected = new Set(batchSelectedKeys());
  const allSelected = keys.every((key) => selected.has(key));
  if (allSelected) {
    keys.forEach((key) => state.selectedKeys.delete(key));
  } else {
    keys.forEach((key) => state.selectedKeys.add(key));
  }
  setBatchMenuOpen(false);
  renderRows();
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

function mergeAlbumUpdate(album) {
  if (!album?.album_key) return null;
  const index = state.albums.findIndex((item) => item.album_key === album.album_key);
  if (index < 0) return null;
  state.albums[index] = { ...state.albums[index], ...album };
  state.queueSignature = queueSignature(state.albums);
  return state.albums[index];
}

function syncResponsiveState() {
  const detailVisible = isPhoneLayout() && state.detailOpen && Boolean(state.selectedKey);
  document.body.classList.toggle("detail-open", detailVisible);
}

function resetDetailScroll() {
  if (!el.detailPane || !isPhoneLayout()) return;
  window.requestAnimationFrame(() => {
    el.detailPane.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
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
  // If this action finishes the album, move on to the next one that still
  // needs work, even in views (like All) where finished albums stay listed.
  state.advanceAfterKey = state.selectedKey || "";
}

const SHORTCUT_BUTTONS = {
  f: "findArtworkBtn",
  a: "approveEmbedBtn",
  r: "rejectCandidateBtn",
  s: "skipAlbumBtn",
  c: "convertCurrentBtn",
};

function nextActionableKey(fromKey) {
  const list = state.albums || [];
  const start = list.findIndex((album) => album.album_key === fromKey);
  const ordered = start < 0 ? list : [...list.slice(start + 1), ...list.slice(0, start)];
  return ordered.find((album) => album.bucket !== "Done" && album.album_key !== fromKey)?.album_key || "";
}

function albumHasJob(key) {
  const jobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  return jobs.some((job) => job && job.album_key === key);
}

// Called after each queue refresh. Returns true if the selection moved.
function advanceAfterFinishedAlbum() {
  const key = state.advanceAfterKey;
  if (!key) return false;
  if (state.selectedKey !== key) {
    state.advanceAfterKey = ""; // the user picked another album themselves
    return false;
  }
  const album = state.albums.find((item) => item.album_key === key);
  if (album && album.bucket === "Done") {
    state.advanceAfterKey = "";
    const next = nextActionableKey(key);
    if (next) {
      state.selectedKey = next;
      return true;
    }
    return false;
  }
  // Still working, or the action left it unfinished (for example a failed embed).
  if (!albumHasJob(key) && !state.actionActive) state.advanceAfterKey = "";
  return false;
}

function unreachableSourceText(album) {
  const notes = album?.notes || {};
  const names = Array.isArray(notes.last_search_unreachable) ? notes.last_search_unreachable.filter(Boolean) : [];
  if (!names.length) return "";
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  if (notes.last_search_all_failed) {
    return `Last search couldn't reach ${list}. Check the NAS internet connection, then search again.`;
  }
  return `Last search couldn't reach ${list}, so there may be more covers to find.`;
}

function idleActionMessage(album = selectedAlbum()) {
  if (!album) return "Select an album to begin";
  // Keep a dry run's result on screen until the user moves on.
  if (state.dryRunNote && state.dryRunNote.key === album.album_key) return state.dryRunNote.text;
  const mode = workflowMode(album);
  if (mode === "done") return "Current cover is good";
  const unreachable = unreachableSourceText(album);
  if (unreachable) return unreachable;
  if (mode === "review" && selectedCandidate()) return "Review this cover, then approve or reject it.";
  if (mode === "review" && album.notes?.last_search_more && Number(album.notes?.last_search_saved) === 0) {
    return "No more covers found. Try Choose Release, or Google Images.";
  }
  if (mode === "review") return "Search again to add cover options.";
  if (album.status === "incompatible_artwork") return "This cover only needs converting. Convert Current fixes it in one step.";
  if (album.status === "not_square_artwork") return "Convert Current pads this cover to a square, or find a better one.";
  return "Find artwork, then approve the best cover.";
}

function setVisible(node, visible) {
  node.classList.toggle("hidden", !visible);
}

function albumFolderPath(album = selectedAlbum()) {
  return String(album?.album_path || album?.folder_path || "").trim();
}

function hasCover(kind) {
  if (kind === "current") return Boolean(state.coverUrl && selectedAlbum());
  if (kind === "candidate") return Boolean(state.candidateUrl && selectedCandidate());
  return false;
}

function candidateLabel(candidate) {
  if (!candidate) return "No candidate selected";
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
  if (!candidate) return "No candidate selected";
  const parts = [];
  if (candidate.source) parts.push(candidate.source);
  if (candidate.size_label) parts.push(candidate.size_label);
  if (candidate.score || candidate.score === 0) parts.push(`${candidate.score}/100`);
  const warnings = candidateWarnings(candidate);
  if (warnings.length) parts.push(warnings[0]);
  return parts.join(" - ") || "Candidate cover";
}

function candidateOptionMain(candidate, index) {
  if (!candidate) return `Option ${index + 1}`;
  const parts = [];
  if (candidate.source) parts.push(candidate.source);
  if (candidate.size_label) parts.push(candidate.size_label);
  if (candidate.score || candidate.score === 0) parts.push(`${candidate.score}/100`);
  return parts.join(" - ") || `Option ${index + 1}`;
}

function candidateOptionSub(candidate) {
  if (!candidate) return "";
  const warnings = candidateWarnings(candidate);
  const pieces = [
    candidate.release_title,
    candidate.source_detail,
    warnings[0],
  ].map((piece) => String(piece || "").trim()).filter(Boolean);
  return pieces[0] || "Saved cover option";
}

function candidateApprovalWarning(candidate) {
  if (state.settings.warn_low_confidence === false) return "";
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
    history: "History",
    safety: "Safety",
    security: "Security",
  }[tab] || "Settings";
}

function syncSaveButtonVisibility() {
  const toolsOnly = ["safety", "maintenance", "history"].includes(state.settingsTab);
  el.saveSettingsBtn.classList.toggle("hidden", toolsOnly && !state.settingsDirty);
}

function setSettingsTab(tab) {
  document.querySelectorAll(".settings-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === tab);
  });
  document.querySelectorAll(".settings-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.settingsPanel === tab);
  });
  el.settingsPanelTitle.textContent = settingsTitle(tab);
  // These tabs only hold one-off tools, so Save has nothing to do there
  // (unless changes from another tab are still waiting to be saved).
  state.settingsTab = tab;
  syncSaveButtonVisibility();
  if (tab === "maintenance") loadStorage();
  if (tab === "history") loadHistory();
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
    settingsMessage("Unsaved changes", "warn");
  }
  syncSaveButtonVisibility();
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

// ---- History (Settings > History) ----

const historyState = { entries: [], total: 0, timer: 0, seq: 0 };

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today ${time}` : `${date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" })} ${time}`;
}

function renderHistory() {
  el.historyList.replaceChildren();
  if (!historyState.entries.length) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Nothing recorded yet.";
    el.historyList.append(empty);
  }
  for (const entry of historyState.entries) {
    const li = document.createElement("li");
    li.className = "history-row";
    const when = document.createElement("time");
    when.textContent = formatWhen(entry.created_at);
    when.dateTime = entry.created_at || "";
    const body = document.createElement("div");
    const head = document.createElement("strong");
    head.textContent = entry.label;
    body.append(head);
    if (entry.album_key) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "link-button";
      link.dataset.albumKey = entry.album_key;
      link.dataset.albumQuery = entry.album || entry.artist || "";
      link.textContent = [entry.artist, entry.album].filter(Boolean).join(" \u2013 ") || "Album no longer in library";
      link.disabled = !(entry.artist || entry.album);
      body.append(" ", link);
    }
    if (entry.detail) {
      const detail = document.createElement("span");
      detail.className = "history-detail";
      detail.textContent = entry.detail;
      body.append(detail);
    }
    li.append(when, body);
    el.historyList.append(li);
  }
  const shown = historyState.entries.length;
  el.historyCount.textContent = historyState.total ? `Showing ${fmt(shown)} of ${fmt(historyState.total)}` : "";
  el.historyMoreBtn.classList.toggle("hidden", shown >= historyState.total);
}

async function loadHistory({ append = false } = {}) {
  const seq = ++historyState.seq;
  const params = new URLSearchParams({ limit: "50", offset: String(append ? historyState.entries.length : 0) });
  if (el.historyKind.value) params.set("kind", el.historyKind.value);
  if (el.historySearch.value.trim()) params.set("q", el.historySearch.value.trim());
  try {
    const page = await api(`/api/history?${params}`);
    if (seq !== historyState.seq) return;
    historyState.entries = append ? historyState.entries.concat(page.entries) : page.entries;
    historyState.total = page.total;
    renderHistory();
  } catch (error) {
    el.historyCount.textContent = error.message || "History could not be loaded.";
  }
}

async function openAlbumFromHistory(button) {
  closeSettings();
  state.bucket = "All";
  localStorage.setItem("amwBucket", state.bucket);
  state.query = button.dataset.albumQuery || "";
  el.searchInput.value = state.query;
  updateSearchControls();
  state.preferredNextKey = "";
  state.selectedKey = button.dataset.albumKey;
  await refreshQueue({ force: true });
  if (selectedAlbum()) await refreshCandidates(selectedAlbum());
}

// ---- Storage (Settings > Maintenance) ----

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function storageLine(part) {
  const files = Number(part?.files || 0);
  return `${formatBytes(part?.bytes)} \u00b7 ${fmt(files)} file${files === 1 ? "" : "s"}`;
}

function renderStorage(report) {
  el.storageWaiting.textContent = storageLine(report.waiting);
  el.storageHandled.textContent = storageLine(report.handled);
  el.storageLeftover.textContent = storageLine(report.leftover);
  el.storageBackups.textContent = storageLine(report.backups);
  const freeable = Number(report.handled?.bytes || 0) + Number(report.leftover?.bytes || 0);
  const freeableFiles = Number(report.handled?.files || 0) + Number(report.leftover?.files || 0);
  el.cleanStorageBtn.disabled = freeableFiles === 0;
  el.cleanStorageBtn.textContent = freeableFiles ? `Clear Handled Artwork (${formatBytes(freeable)})` : "Nothing to Clear";
}

async function loadStorage() {
  el.storageResult.textContent = "Checking storage...";
  try {
    renderStorage(await api("/api/storage"));
    el.storageResult.textContent = "";
  } catch (error) {
    el.storageResult.textContent = error.message || "Storage could not be checked.";
  }
}

async function cleanStorage() {
  if (!window.confirm("Delete downloaded covers you've already dealt with, plus leftover files?\n\nCovers waiting for your review, your music files and backups aren't touched.")) return;
  el.cleanStorageBtn.disabled = true;
  el.storageResult.textContent = "Clearing...";
  try {
    const result = await api("/api/storage/cleanup", { method: "POST", body: JSON.stringify({ kinds: ["handled", "leftover"] }) });
    renderStorage(result.storage);
    el.storageResult.textContent = `Freed ${formatBytes(result.freed_bytes)} (${fmt(result.removed_files)} file${result.removed_files === 1 ? "" : "s"}).`;
  } catch (error) {
    el.storageResult.textContent = error.message || "Storage could not be cleared.";
    el.cleanStorageBtn.disabled = false;
  }
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
  el.settingWarnLowConfidence.checked = settings.warn_low_confidence !== false;
  el.settingDryRun.checked = Boolean(settings.dry_run_embeds);
  applySourceOrder(settings.provider_order);
  el.settingDeezerEnabled.checked = Boolean(settings.deezer_enabled);
  el.settingItunesEnabled.checked = Boolean(settings.itunes_enabled);
  el.settingMusicbrainzEnabled.checked = Boolean(settings.musicbrainz_enabled);
  el.settingDiscogsEnabled.checked = Boolean(settings.discogs_enabled);
  // The server never sends the token back; only whether one is saved.
  el.settingDiscogsToken.value = "";
  el.settingDiscogsToken.placeholder = settings.discogs_token_set
    ? "Saved - paste a new token to replace it"
    : "Paste a Discogs personal access token";
  el.settingDiscogsTokenStatus.value = settings.discogs_token_set ? "Saved" : "Not set - Discogs is skipped";
  el.settingDiscogsTokenClear.checked = false;
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
    warn_low_confidence: el.settingWarnLowConfidence.checked,
    dry_run_embeds: el.settingDryRun.checked,
    provider_order: currentSourceOrder(),
    deezer_enabled: el.settingDeezerEnabled.checked,
    itunes_enabled: el.settingItunesEnabled.checked,
    musicbrainz_enabled: el.settingMusicbrainzEnabled.checked,
    discogs_enabled: el.settingDiscogsEnabled.checked,
    discogs_token: el.settingDiscogsToken.value.trim(),
    discogs_token_clear: el.settingDiscogsTokenClear.checked,
    max_candidates_per_album: Number(el.settingMaxCandidates.value || 5),
    parallel_provider_workers: Number(el.settingProviderWorkers.value || 2),
  };
}

async function loadSettings() {
  const payload = await api("/api/settings");
  state.settingsLoaded = true;
  populateSettings(payload);
  state.settingsDirty = false;
  settingsMessage("Ready");
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
      settingsMessage(`Connected and saved at ${formatTime()}`, "ok");
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
    settingsMessage(`Settings saved at ${formatTime()}`, "ok");
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
  const kinds = new Set([
    "artwork-search",
    "approve-embed",
    "convert-current",
    "restore-backup",
    "repair-queue",
    "embed",
    "deep-check",
    "batch-artwork-search",
    "batch-convert-current",
  ]);
  return jobs.find((job) => job && kinds.has(job.kind));
}

function showActivityPanel(title, text) {
  el.scanPanel.classList.remove("hidden");
  el.scanTitle.textContent = title;
  el.scanText.textContent = text || "Working on the NAS";
}

function jobTitle(job) {
  return {
    "artwork-search": "Searching artwork",
    "batch-artwork-search": "Searching selected albums",
    "approve-embed": "Embedding artwork",
    "convert-current": "Converting current cover",
    "batch-convert-current": "Converting selected albums",
    "restore-backup": "Restoring backup",
    "repair-queue": "Repairing queue",
    embed: "Embedding artwork",
    "deep-check": "Checking album",
  }[job?.kind] || "Working on the NAS";
}

function optionLabel(count) {
  return `${fmt(count)} option${Number(count) === 1 ? "" : "s"}`;
}

function jobDetailText(job = {}) {
  const pieces = [];
  const label = String(job.label || "").trim();
  if (label && label.toLowerCase() !== "album") pieces.push(label);
  if (job.candidate_count || job.candidate_count === 0) pieces.push(optionLabel(job.candidate_count));
  if (job.total || job.processed_albums) {
    const checked = Number(job.processed_albums || job.checked || 0);
    const total = Number(job.total || 0);
    pieces.push(total ? `${fmt(checked)} of ${fmt(total)} checked` : `${fmt(checked)} checked`);
  }
  if (job.updated || job.changed) pieces.push(`${fmt(job.updated || job.changed)} updated`);
  if (job.last_provider) pieces.push(`Last source ${job.last_provider}`);
  return pieces.join(" - ") || "Working on the NAS";
}

function renderScan(status) {
  const job = activeScanJob(status);
  state.scanActive = Boolean(job);
  el.scanBtn.disabled = state.scanActive || state.actionActive;
  if (el.freshScanBtn) el.freshScanBtn.disabled = state.scanActive || state.actionActive;
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
  showActivityPanel("Scan running", bits.join(" - ") + (latest ? ` - Now ${shortPath(latest)}` : ""));
}

// Which running jobs affect this album? The NAS locks albums one at a time, so
// work on one album should not grey out every other album's buttons.
function albumJobState(album = selectedAlbum()) {
  const jobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  const key = album?.album_key || "";
  let busy = Boolean(state.scanActive);
  let searching = false;
  // A click is on its way to the NAS but no job is reported yet.
  if (state.actionActive && !jobs.length) busy = true;
  for (const job of jobs) {
    if (!job) continue;
    if (!job.album_key || String(job.kind || "").startsWith("batch-")) {
      busy = true; // queue-wide work such as batch actions or repairs
    } else if (job.album_key === key) {
      if (job.kind === "artwork-search") searching = true;
      else busy = true;
    }
  }
  return { busy, searching };
}

function jobForSelectedAlbum() {
  const jobs = Array.isArray(state.activeJobs) ? state.activeJobs : [];
  const key = state.selectedKey || "";
  return jobs.find((job) => job && (!job.album_key || job.album_key === key)) || null;
}

function updateActionButtons() {
  const album = selectedAlbum();
  const candidate = selectedCandidate();
  const mode = workflowMode(album);
  const jobState = albumJobState(album);
  // Saved covers can be approved or rejected while this album searches for more.
  const busy = jobState.busy;
  const busyOrSearching = jobState.busy || jobState.searching;
  const hasCandidate = Boolean(candidate);
  const sourceUrl = candidate?.source_page || candidate?.source_url || "";
  const hasAlbum = Boolean(album);
  const canNavigateCandidates = hasAlbum && state.candidates.length > 1 && !busy;
  const showCandidateActions = hasCandidate;
  const showAlbumTools = hasAlbum && (sourceUrl || mode !== "empty");
  const compactCandidate = !hasCandidate && (mode === "empty" || mode === "done");
  const canConvertCurrent = hasAlbum && ["incompatible_artwork", "not_square_artwork"].includes(album.status);

  el.detailPane.classList.remove("mode-empty", "mode-work", "mode-review", "mode-done");
  el.detailPane.classList.add(`mode-${mode}`);
  el.candidatePanel.classList.toggle("compact", compactCandidate);
  // Phones hide the empty candidate box so the actions are closer to the top.
  el.candidatePanel.classList.toggle("no-candidate", !hasCandidate);
  el.candidateTitle.textContent = mode === "done" ? "Replacement Cover" : "Candidate";
  el.candidatePosition.classList.toggle("hidden", compactCandidate);
  el.actionsTitle.textContent = "Actions";
  el.findArtworkBtn.textContent = mode === "done" ? "Search Again" : Number(album?.candidate_count || 0) > 0 ? "Find More" : "Find Artwork";
  // For a cover that just needs converting, that's the main action.
  const convertFirst = canConvertCurrent && mode === "work";
  el.findArtworkBtn.classList.toggle("primary", mode !== "done" && !convertFirst);
  el.findArtworkBtn.classList.toggle("ghost", mode === "done" || convertFirst);
  el.convertCurrentBtn.classList.toggle("primary", convertFirst);
  el.convertCurrentBtn.classList.toggle("ghost", !convertFirst);
  el.convertCurrentBtn.style.order = convertFirst ? "-1" : "";

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
  setVisible(el.copyFolderBtn, Boolean(albumFolderPath(album)));
  setVisible(el.openSourceBtn, Boolean(sourceUrl));
  setVisible(el.googleImagesBtn, hasAlbum);
  setVisible(el.markGoodBtn, hasAlbum && mode !== "done");
  setVisible(el.skipAlbumBtn, hasAlbum && mode !== "done");

  el.findArtworkBtn.disabled = !hasAlbum || busyOrSearching;
  el.approveEmbedBtn.disabled = !album || !hasCandidate || busy;
  el.convertCurrentBtn.disabled = !canConvertCurrent || busyOrSearching;
  el.prevCandidateBtn.disabled = !canNavigateCandidates;
  el.nextCandidateBtn.disabled = !canNavigateCandidates;
  el.rejectCandidateBtn.disabled = !album || !hasCandidate || busy;
  el.rejectAllBtn.disabled = !album || !hasCandidate || busy;
  el.importImageBtn.disabled = !album || busy;
  el.chooseReleaseBtn.disabled = !album || busy;
  el.recheckAlbumBtn.disabled = !album || busyOrSearching;
  el.copyFolderBtn.disabled = !albumFolderPath(album);
  el.openSourceBtn.disabled = !sourceUrl;
  el.googleImagesBtn.disabled = !album;
  el.markGoodBtn.disabled = !album || busyOrSearching;
  el.skipAlbumBtn.disabled = !album || busyOrSearching;
  // Ignore for anything still in play; Rework brings finished or ignored albums back;
  // Undo for albums whose files were changed by an embed or conversion.
  setVisible(el.ignoreAlbumBtn, Boolean(album) && album.status !== "ignored");
  el.ignoreAlbumBtn.disabled = !album || busyOrSearching;
  setVisible(el.reworkAlbumBtn, Boolean(album) && mode === "done");
  el.reworkAlbumBtn.disabled = !album || busyOrSearching;
  setVisible(el.undoEmbedBtn, Boolean(album && (album.status === "approved" || album.notes?.last_approval)));
  el.undoEmbedBtn.disabled = !album || busyOrSearching;
  updateBatchControls();
}

function renderReviewJob(status) {
  const job = activeReviewJob(status);
  const wasActive = state.actionActive;
  state.activeJobs = Array.isArray(status.active_jobs) ? status.active_jobs : [];
  state.actionActive = Boolean(job);
  el.scanBtn.disabled = state.scanActive || state.actionActive;
  if (el.freshScanBtn) el.freshScanBtn.disabled = state.scanActive || state.actionActive;
  const maintenanceBusy = state.scanActive || state.actionActive;
  if (el.repairQueueBtn) el.repairQueueBtn.disabled = maintenanceBusy;
  if (el.cleanupStaleBtn) el.cleanupStaleBtn.disabled = maintenanceBusy;
  if (job) {
    const title = jobTitle(job);
    const detail = jobDetailText(job);
    const ownJob = jobForSelectedAlbum();
    if (ownJob) {
      const ownTitle = jobTitle(ownJob);
      el.actionMessage.textContent = ownJob.candidate_count || ownJob.candidate_count === 0
        ? `${ownTitle} - ${optionLabel(ownJob.candidate_count)}`
        : ownTitle;
    } else if (selectedAlbum()) {
      el.actionMessage.textContent = idleActionMessage();
    }
    if (!state.scanActive) showActivityPanel(title, detail);
    if (job.kind === "repair-queue") maintenanceMessage(job.label || "Repairing queue");
  } else if (wasActive && !state.scanActive) {
    el.scanPanel.classList.add("hidden");
    if (selectedAlbum()) el.actionMessage.textContent = idleActionMessage();
    const embed = latestRecentJob(status, "approve-embed");
    if (embed && embed.dry_run && embed.job_id !== state.shownDryRunJob && embed.album_key === state.selectedKey) {
      state.shownDryRunJob = embed.job_id;
      state.dryRunNote = { key: embed.album_key, text: embed.reason || "Dry run finished. Nothing was changed." };
      el.actionMessage.textContent = state.dryRunNote.text;
    }
  }
  updateActionButtons();
  if (!el.settingsOverlay.classList.contains("hidden")) renderBackupList();
}

function renderTokenWarning(text) {
  let hidden = false;
  try {
    hidden = sessionStorage.getItem("amwHideTokenWarning") === text;
  } catch (_error) {
    hidden = false;
  }
  el.tokenWarningText.textContent = text;
  el.tokenWarning.classList.toggle("hidden", !text || hidden);
}

function countsKey(counts) {
  return ["All", "Needs Work", "Review", "Done"].map((key) => Number((counts || {})[key] || 0)).join("/");
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
    state.statusCountsKey = countsKey(counts);
    renderTokenWarning(app.token_warning || "");
    renderScan(status);
    renderReviewJob(status);
    renderStopButton();
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
  pruneBatchSelection();
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
    updateBatchControls();
    return;
  }
  el.albumRows.innerHTML = "";
  const fragment = document.createDocumentFragment();
  state.albums.forEach((album) => {
    const row = document.createElement("tr");
    row.dataset.albumKey = album.album_key;
    row.classList.toggle("selected", album.album_key === state.selectedKey);
    row.classList.toggle("batch-selected", state.selectedKeys.has(album.album_key));
    row.setAttribute("aria-selected", album.album_key === state.selectedKey ? "true" : "false");

    [
      { value: album.status_label || "", className: `status-col status-cell ${statusClass(album)}` },
      { value: album.artist || "", className: "artist-col" },
      { value: album.album || "", className: "album-col" },
      { value: album.size_label || "", className: "size-col" },
      { value: album.candidate_count || 0, className: "opts-col" },
    ].forEach(({ value, className }) => {
      const cell = document.createElement("td");
      cell.title = value;
      cell.className = className;
      if (className.includes("status-cell")) {
        const wrap = document.createElement("span");
        const label = document.createElement("span");
        wrap.className = "status-content";
        label.className = "status-label";
        label.textContent = value;
        if (state.selectionMode) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = state.selectedKeys.has(album.album_key);
          checkbox.setAttribute("aria-label", `Select ${album.artist || "album"} - ${album.album || ""}`);
          wrap.appendChild(checkbox);
        }
        wrap.appendChild(label);
        cell.appendChild(wrap);
      } else {
        cell.textContent = value;
      }
      row.appendChild(cell);
    });
    fragment.appendChild(row);
  });
  el.albumRows.appendChild(fragment);
  updateBatchControls();
}

async function refreshQueue(options = {}) {
  const force = Boolean(options.force);
  const autoHandoff = Boolean(options.autoHandoff) && !state.query;
  const previousSelected = state.selectedKey;
  const params = new URLSearchParams({ bucket: state.bucket, q: state.query });
  try {
    const payload = await api(`/api/albums?${params}`);
    const counts = payload.counts || {};
    state.queueCountsKey = countsKey(counts);
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
    pruneBatchSelection();
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
    advanceAfterFinishedAlbum();
    if (queueChanged) renderRows();
    if (queueChanged || previousSelected !== state.selectedKey || force) {
      renderSelected();
      if (state.detailOpen && previousSelected !== state.selectedKey) resetDetailScroll();
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
    el.coverMeta.textContent = "No cover selected";
    updateArtworkViewer();
    return;
  }
  if (!album.width || !album.height) {
    // The scan found no embedded cover; don't ask the NAS for one (avoids a 404).
    el.coverPlaceholder.textContent = "No artwork";
    el.coverMeta.textContent = currentCoverLabel(album, false);
    updateArtworkViewer();
    return;
  }
  el.coverPlaceholder.textContent = "Loading cover";
  el.coverMeta.textContent = album.size_label || "Checking current cover";
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
    el.coverMeta.textContent = currentCoverLabel(album, true);
    updateArtworkViewer();
  } catch (error) {
    el.coverPlaceholder.textContent = "No artwork";
    el.coverMeta.textContent = currentCoverLabel(album, false);
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
  el.candidatePlaceholder.textContent = "Loading cover";
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
  renderCandidateOptions();
  if (!candidate) {
    if (mode === "done") {
      el.candidateMeta.textContent = "No replacement queued";
    } else if (album) {
      el.candidateMeta.textContent = "No saved covers yet";
    } else {
      el.candidateMeta.textContent = "Find artwork to see options";
    }
    el.candidateMeta.removeAttribute("title");
    if (!jobForSelectedAlbum()) {
      el.actionMessage.textContent = idleActionMessage(album);
    }
    loadCandidateCover(null);
    updateActionButtons();
    return;
  }
  el.candidateMeta.textContent = candidateShortLabel(candidate);
  el.candidateMeta.title = candidateLabel(candidate);
  if (!jobForSelectedAlbum()) {
    el.actionMessage.textContent = idleActionMessage(album);
  }
  loadCandidateCover(candidate);
  updateActionButtons();
}

function renderCandidateOptions() {
  if (!el.candidateOptions) return;
  el.candidateOptions.innerHTML = "";
  el.candidatePanel.classList.toggle("has-options", Boolean(state.candidates.length));
  if (!state.candidates.length) {
    el.candidateOptions.classList.add("hidden");
    return;
  }
  el.candidateOptions.classList.remove("hidden");
  state.candidates.forEach((candidate, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "candidate-option";
    option.dataset.candidateIndex = String(index);
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", index === state.candidateIndex ? "true" : "false");
    option.title = candidateLabel(candidate);
    option.classList.toggle("active", index === state.candidateIndex);

    option.setAttribute("aria-label", `Option ${index + 1}: ${candidateLabel(candidate)}`);

    // A thumbnail, so options can be compared at a glance, with size and score under it.
    const thumb = document.createElement("span");
    thumb.className = "candidate-option-thumb";
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    thumb.append(img);
    loadCandidateThumb(candidate, img);

    const main = document.createElement("span");
    main.className = "candidate-option-main";
    const width = Number(candidate.width || 0);
    main.textContent = width ? `${width}px` : `Option ${index + 1}`;

    const sub = document.createElement("span");
    sub.className = "candidate-option-sub";
    const warnings = candidateWarnings(candidate);
    sub.textContent = [candidate.source, (candidate.score || candidate.score === 0) ? `${candidate.score}` : ""].filter(Boolean).join(" \u00b7 ");
    if (warnings.length) option.classList.add("has-warning");

    option.append(thumb, main, sub);
    el.candidateOptions.appendChild(option);
  });
  scrollActiveCandidateOptionIntoView();
}

// Thumbnails are fetched with the access token, then kept for the session.
const candidateThumbUrls = new Map();

async function loadCandidateThumb(candidate, img) {
  const id = String(candidate?.candidate_id || "");
  if (!id) return;
  const cached = candidateThumbUrls.get(id);
  if (cached) {
    img.src = await cached;
    return;
  }
  const pending = fetch(`/api/artwork/candidate?candidate_id=${encodeURIComponent(id)}&thumb=192`, { headers: headers() })
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("thumb"))))
    .then((blob) => URL.createObjectURL(blob));
  candidateThumbUrls.set(id, pending);
  try {
    img.src = await pending;
  } catch (_error) {
    candidateThumbUrls.delete(id);
    img.closest(".candidate-option-thumb")?.classList.add("missing");
  }
}

function scrollActiveCandidateOptionIntoView() {
  const active = el.candidateOptions?.querySelector(".candidate-option.active");
  if (!active || !el.candidateOptions) return;
  const listRect = el.candidateOptions.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  if (activeRect.top < listRect.top) {
    el.candidateOptions.scrollTop -= listRect.top - activeRect.top;
  } else if (activeRect.bottom > listRect.bottom) {
    el.candidateOptions.scrollTop += activeRect.bottom - listRect.bottom;
  }
}

function focusActiveCandidateOption() {
  const active = el.candidateOptions?.querySelector(".candidate-option.active");
  if (active instanceof HTMLElement) active.focus({ preventScroll: true });
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

function renderFolderCover(cover) {
  const node = el.detailFolderCover;
  if (!cover) {
    node.classList.add("hidden");
    return;
  }
  let text;
  if (cover.ok) {
    const dims = Array.isArray(cover.dimensions) ? ` ${cover.dimensions[0]}\u00d7${cover.dimensions[1]}` : "";
    text = `Folder cover: ${cover.name || "cover.jpg"}${dims}`;
  } else if (cover.issue === "folder cover missing") {
    text = cover.expected ? "Folder cover: no cover.jpg yet" : "No cover.jpg in folder";
  } else {
    text = `Folder cover: ${String(cover.issue || "needs attention").replace(/^folder cover /, "")}`;
  }
  node.textContent = text;
  node.classList.toggle("warn", Boolean(cover.expected && !cover.ok));
  node.classList.remove("hidden");
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
    el.detailFolderCover.classList.add("hidden");
    return;
  }
  const albumKey = album.album_key;
  state.problemKey = albumKey;
  clearProblemFiles();
  el.detailFolderCover.classList.add("hidden");
  state.problemKey = albumKey;
  try {
    const payload = await api(`/api/album/problems?album_key=${encodeURIComponent(albumKey)}`);
    if (state.problemKey !== albumKey || state.selectedKey !== albumKey) return;
    renderProblemFiles(payload.problem_files || [], payload.deep_file_check || {});
    renderFolderCover(payload.folder_cover);
    if (payload.counts) setCounts(payload.counts);
    const updatedAlbum = mergeAlbumUpdate(payload.album);
    if (updatedAlbum) {
      if (state.bucket !== "All" && updatedAlbum.bucket !== state.bucket) {
        await refreshQueue({ force: true, autoHandoff: true });
        return;
      }
      renderRows();
      renderSelected({ skipProblemFiles: true });
    }
  } catch (error) {
    if (state.problemKey !== albumKey || state.selectedKey !== albumKey) return;
    clearProblemFiles();
  }
}

function renderSelected(options = {}) {
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
    el.actionMessage.textContent = "Select an album to begin";
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
  if (!jobForSelectedAlbum()) {
    el.actionMessage.textContent = idleActionMessage(album);
  }
  state.candidates = [];
  state.candidateIndex = 0;
  renderCandidate();
  loadCover(album);
  refreshCandidates(album);
  if (!options.skipProblemFiles) loadProblemFiles(album);
  updateActionButtons();
}

function setMoreActionsOpen(open) {
  el.actionsPanel.classList.toggle("show-more", Boolean(open));
  el.moreActionsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  el.moreActionsBtn.textContent = open ? "Fewer actions" : "More actions";
}

function selectAlbum(albumKey, options = {}) {
  const previousKey = state.selectedKey;
  if (previousKey !== albumKey) {
    setMoreActionsOpen(false);
    state.dryRunNote = null;
  }
  state.selectedKey = albumKey || "";
  if (!options.keepPreferred) state.preferredNextKey = "";
  state.detailOpen = options.openDetail === false ? state.detailOpen : Boolean(state.selectedKey);
  renderSelected();
  if (state.detailOpen && previousKey !== state.selectedKey) resetDetailScroll();
  if (options.focusQueue && !(isPhoneLayout() && state.detailOpen)) focusQueue();
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
  // With options already saved, look for more on top of them.
  const more = Number(album.candidate_count || 0) > 0;
  state.actionActive = true;
  el.actionMessage.textContent = more ? "Looking for more covers" : "Searching artwork";
  updateActionButtons();
  try {
    await api("/api/artwork/search", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key, more }),
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
  el.actionMessage.textContent = state.settings.dry_run_embeds ? "Dry run: checking what would change" : "Embedding artwork on the NAS";
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

// ---- Artwork source order (Settings > Artwork) ----

function currentSourceOrder() {
  return [...el.sourceOrderList.children].map((row) => row.dataset.source);
}

function syncSourceOrderButtons() {
  const rows = [...el.sourceOrderList.children];
  rows.forEach((row, index) => {
    const name = row.querySelector("label")?.textContent.trim().replace(/^Search /, "") || row.dataset.source;
    row.querySelector(".move-up").disabled = index === 0;
    row.querySelector(".move-down").disabled = index === rows.length - 1;
    row.querySelector(".move-up").setAttribute("aria-label", `Move ${name} up`);
    row.querySelector(".move-down").setAttribute("aria-label", `Move ${name} down`);
    row.querySelector(".source-rank").textContent = String(index + 1);
  });
}

function applySourceOrder(order) {
  const rows = new Map([...el.sourceOrderList.children].map((row) => [row.dataset.source, row]));
  for (const key of order || []) {
    const row = rows.get(key);
    if (row) el.sourceOrderList.append(row);
  }
  syncSourceOrderButtons();
}

function setupSourceOrder() {
  for (const row of el.sourceOrderList.children) {
    const rank = document.createElement("span");
    rank.className = "source-rank";
    const controls = document.createElement("span");
    controls.className = "source-move";
    for (const [cls, label, step] of [["move-up", "\u2191", -1], ["move-down", "\u2193", 1]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ghost ${cls}`;
      button.textContent = label;
      button.addEventListener("click", () => {
        const sibling = step < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!sibling) return;
        if (step < 0) el.sourceOrderList.insertBefore(row, sibling);
        else el.sourceOrderList.insertBefore(sibling, row);
        syncSourceOrderButtons();
        setSettingsDirty(true);
        button.disabled ? row.querySelector(step < 0 ? ".move-down" : ".move-up").focus() : button.focus();
      });
      controls.append(button);
    }
    row.prepend(rank);
    row.append(controls);
  }
  syncSourceOrderButtons();
}

function anyDialogOpen() {
  return !el.settingsOverlay.classList.contains("hidden")
    || !el.releaseOverlay.classList.contains("hidden")
    || !el.shortcutsOverlay.classList.contains("hidden");
}

// ---- Choose Release / import from a link ----

function openReleaseDialog() {
  const album = selectedAlbum();
  if (!album) return;
  state.releaseAlbumKey = album.album_key;
  el.releaseSubtitle.textContent = `${album.artist || "Unknown artist"} - ${album.album || "Unknown album"}`;
  el.releaseArtistInput.value = album.search_artist || album.artist || "";
  el.releaseAlbumInput.value = album.search_album || album.album || "";
  el.releaseLinkInput.value = "";
  el.releaseList.replaceChildren();
  el.releaseOverlay.classList.remove("hidden");
  syncModalIsolation();
  el.releaseLinkInput.focus();
  searchReleases();
}

function closeReleaseDialog() {
  el.releaseOverlay.classList.add("hidden");
  state.releaseSearchToken = (state.releaseSearchToken || 0) + 1; // ignore late search results
  syncModalIsolation();
  el.chooseReleaseBtn.focus();
}

function setReleaseBusy(busy) {
  for (const node of [el.releaseLinkBtn, el.releaseSearchBtn, ...el.releaseList.querySelectorAll("button")]) {
    node.disabled = busy;
  }
}

async function searchReleases() {
  const token = (state.releaseSearchToken || 0) + 1;
  state.releaseSearchToken = token;
  el.releaseMessage.textContent = "Searching releases...";
  el.releaseList.replaceChildren();
  el.releaseSearchBtn.disabled = true;
  try {
    const payload = await api("/api/releases/search", {
      method: "POST",
      body: JSON.stringify({
        album_key: state.releaseAlbumKey,
        artist: el.releaseArtistInput.value.trim(),
        album: el.releaseAlbumInput.value.trim(),
      }),
    });
    if (token !== state.releaseSearchToken) return;
    renderReleases(payload.releases || [], payload.unreachable_sources || []);
  } catch (error) {
    if (token !== state.releaseSearchToken) return;
    el.releaseMessage.textContent = error.message || "Release search failed.";
  } finally {
    if (token === state.releaseSearchToken) el.releaseSearchBtn.disabled = false;
  }
}

function releaseDetails(row) {
  const parts = [row.year, row.country, row.format, row.label];
  if (row.tracks) parts.push(`${row.tracks} track${Number(row.tracks) === 1 ? "" : "s"}`);
  return parts.filter(Boolean).join(" \u00b7 ");
}

function renderReleases(rows, unreachable) {
  const offline = unreachable.length ? ` Couldn't reach ${unreachable.join(" and ")}.` : "";
  if (!rows.length) {
    el.releaseMessage.textContent = `No releases found. Try different words, or paste a link above.${offline}`;
    return;
  }
  const matches = rows.filter((row) => row.match).length;
  el.releaseMessage.textContent = `${rows.length} release${rows.length === 1 ? "" : "s"} found${matches ? `, ${matches} likely match${matches === 1 ? "" : "es"} first` : ""}.${offline}`;
  const items = rows.map((row) => {
    const li = document.createElement("li");
    li.className = `release-item${row.match ? " is-match" : ""}`;
    const thumb = document.createElement("div");
    thumb.className = "release-thumb";
    if (row.thumb) {
      const img = document.createElement("img");
      img.src = row.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => img.remove());
      thumb.append(img);
    }
    const text = document.createElement("div");
    text.className = "release-text";
    const title = document.createElement("strong");
    title.textContent = row.title || "Untitled";
    const artist = document.createElement("span");
    artist.textContent = row.artist || "";
    const meta = document.createElement("small");
    meta.textContent = releaseDetails(row);
    const badges = document.createElement("span");
    badges.className = "release-badges";
    const source = document.createElement("span");
    source.className = "release-badge";
    source.textContent = row.source_label;
    badges.append(source);
    if (row.match) {
      const match = document.createElement("span");
      match.className = "release-badge match";
      match.textContent = "Likely match";
      badges.append(match);
    }
    text.append(title, artist, meta, badges);
    const actions = document.createElement("div");
    actions.className = "release-actions";
    const use = document.createElement("button");
    use.type = "button";
    use.className = row.match ? "primary" : "ghost";
    use.textContent = "Use This";
    use.addEventListener("click", () => importRelease(row, use));
    actions.append(use);
    if (row.page) {
      const open = document.createElement("a");
      open.href = row.page;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "View";
      actions.append(open);
    }
    li.append(thumb, text, actions);
    return li;
  });
  el.releaseList.replaceChildren(...items);
}

async function finishReleaseImport(payload) {
  closeReleaseDialog();
  await refreshStatus();
  await refreshQueue({ force: true });
  await refreshCandidates(selectedAlbum(), payload.candidate_id);
  const what = payload.added > 1 ? `${payload.added} covers` : "a cover";
  el.actionMessage.textContent = `Added ${what} from ${payload.source || "the link"}. Review it, then approve or reject it.`;
}

async function importRelease(row, button) {
  setReleaseBusy(true);
  button.textContent = "Getting cover...";
  el.releaseMessage.textContent = `Getting the cover from ${row.source_label}...`;
  try {
    const payload = await api("/api/releases/import", {
      method: "POST",
      body: JSON.stringify({ album_key: state.releaseAlbumKey, source: row.source, id: row.id }),
    });
    await finishReleaseImport(payload);
  } catch (error) {
    el.releaseMessage.textContent = error.message || "That cover could not be imported.";
    button.textContent = "Use This";
    setReleaseBusy(false);
  }
}

async function importFromLink() {
  const url = el.releaseLinkInput.value.trim();
  if (!url) {
    el.releaseMessage.textContent = "Paste a link first.";
    el.releaseLinkInput.focus();
    return;
  }
  setReleaseBusy(true);
  el.releaseMessage.textContent = "Getting the cover from that link...";
  try {
    const payload = await api("/api/artwork/import-link", {
      method: "POST",
      body: JSON.stringify({ album_key: state.releaseAlbumKey, url }),
    });
    await finishReleaseImport({ ...payload, source: payload.source || "the link", added: payload.added || 1 });
  } catch (error) {
    el.releaseMessage.textContent = error.message || "That link could not be imported.";
    setReleaseBusy(false);
    el.releaseLinkInput.focus();
  }
}

async function importSelectedImage(file) {
  const album = selectedAlbum();
  if (!album || !file) return;
  if (file.size > 25_000_000) {
    el.actionMessage.textContent = "That image is too large to import.";
    return;
  }
  state.actionActive = true;
  el.actionMessage.textContent = "Importing image";
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
  el.actionMessage.textContent = "Converting current artwork on the NAS";
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
  el.actionMessage.textContent = "Rejecting this cover option";
  updateActionButtons();
  try {
    await api("/api/artwork/reject", {
      method: "POST",
      body: JSON.stringify({ album_key: album.album_key, candidate_id: candidate.candidate_id }),
    });
    await refreshQueue({ autoHandoff: true });
    await refreshCandidates(selectedAlbum());
    el.actionMessage.textContent = "Rejected cover option";
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
  el.actionMessage.textContent = "Rejecting saved cover options";
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
    el.actionMessage.textContent = "Rejected saved cover options";
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
  el.actionMessage.textContent = options.start || "Working on this album";
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

function albumName(album) {
  return `${album.artist || "Unknown artist"} - ${album.album || "Unknown album"}`;
}

async function ignoreAlbum() {
  const album = selectedAlbum();
  if (!album) return;
  if (!window.confirm(`Ignore ${albumName(album)}?\n\nIt leaves the queue for good, and rescans won't bring it back. You can find it under Done and use Rework to bring it back.`)) return;
  await runAlbumAction("/api/album/ignore", "Ignored. It's under Done if you change your mind.", { start: "Ignoring album" });
}

async function reworkAlbum() {
  const album = selectedAlbum();
  if (!album) return;
  if (!window.confirm(`Send ${albumName(album)} back to Needs Work for a new cover?\n\nIts saved cover options are cleared. Your music files aren't changed.`)) return;
  state.actionActive = true;
  el.actionMessage.textContent = "Sending the album back to Needs Work";
  updateActionButtons();
  try {
    await api("/api/album/rework", { method: "POST", body: JSON.stringify({ album_key: album.album_key }) });
    // Follow the album to Needs Work and keep it selected, ready for a new cover.
    state.bucket = "Needs Work";
    state.preferredNextKey = "";
    state.advanceAfterKey = "";
    localStorage.setItem("amwBucket", state.bucket);
    state.selectedKey = album.album_key;
    state.actionActive = false;
    await refreshQueue({ force: true });
    await refreshCandidates(selectedAlbum());
    el.actionMessage.textContent = "Back in Needs Work. Use Find Artwork or Choose Release to pick a new cover.";
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "The album could not be reworked.";
  } finally {
    updateActionButtons();
  }
}

async function undoLastEmbed() {
  const album = selectedAlbum();
  if (!album) return;
  state.actionActive = true;
  el.actionMessage.textContent = "Looking for this album's last backup";
  updateActionButtons();
  try {
    const payload = await api(`/api/backups?album_key=${encodeURIComponent(album.album_key)}&limit=10`);
    const latest = (payload.backups || [])[0];
    if (!latest) {
      throw new Error("There's no backup of this album's files to go back to. Turn on 'Backup files before embed' in Settings > Artwork to make future embeds undoable.");
    }
    if (!latest.restorable) {
      throw new Error("The latest backup of this album is incomplete (some backup files are missing), so it can't be undone here. See Settings > Safety.");
    }
    const when = formatDateTime(latest.created_at);
    state.actionActive = false;
    if (!window.confirm(`Undo the last change to ${albumName(album)}?\n\n${latest.action_label} on ${when}. The music files go back to how they were before it. The current files are backed up first, so this can be undone too.`)) {
      el.actionMessage.textContent = idleActionMessage(album);
      updateActionButtons();
      return;
    }
    state.actionActive = true;
    el.actionMessage.textContent = "Putting the previous files back";
    await api("/api/backup/restore", { method: "POST", body: JSON.stringify({ history_id: latest.history_id }) });
    await refreshStatus();
    scheduleTick(500);
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "The last embed could not be undone.";
    updateActionButtons();
  }
}

function stoppableJobs() {
  const kinds = new Set(["scan-library", "batch-artwork-search", "batch-convert-current"]);
  return (state.activeJobs || []).filter((job) => job && kinds.has(job.kind));
}

function renderStopButton() {
  const jobs = stoppableJobs();
  setVisible(el.stopJobBtn, jobs.length > 0);
  const stopping = jobs.length > 0 && jobs.every((job) => job.stop_requested);
  el.stopJobBtn.disabled = stopping;
  el.stopJobBtn.textContent = stopping ? "Stopping..." : "Stop";
  el.stopJobBtn.title = stopping ? "Finishing the current album, then stopping" : "Stop after the current album";
}

async function stopRunningJob() {
  el.stopJobBtn.disabled = true;
  el.stopJobBtn.textContent = "Stopping...";
  try {
    await api("/api/jobs/stop", { method: "POST", body: JSON.stringify({}) });
    await refreshStatus();
  } catch (error) {
    el.actionMessage.textContent = error.message || "Could not stop.";
    renderStopButton();
  }
}

async function runBatchAction(path, message, options = {}) {
  const albumKeys = batchSelectedKeys();
  const count = albumKeys.length;
  if (!count) return;
  const confirmText = typeof options.confirmText === "function" ? options.confirmText(count) : options.confirmText;
  if (confirmText && !window.confirm(confirmText)) return;

  state.actionActive = true;
  el.actionMessage.textContent = options.start || message;
  updateActionButtons();
  try {
    const payload = await api(path, {
      method: "POST",
      body: JSON.stringify({ album_keys: albumKeys }),
    });
    if (payload.job_id) {
      setSelectionMode(false);
      await refreshStatus();
      scheduleTick(500);
      return;
    }
    state.actionActive = false;
    state.selectedKeys.clear();
    state.selectionMode = false;
    el.actionMessage.textContent = options.done || message;
    await refreshQueue({ force: true, autoHandoff: true });
    await refreshCandidates(selectedAlbum());
  } catch (error) {
    state.actionActive = false;
    el.actionMessage.textContent = error.message || "Batch action failed.";
    updateActionButtons();
  }
}

function selectCandidateIndex(index, options = {}) {
  if (!state.candidates.length) return;
  const count = state.candidates.length;
  state.candidateIndex = ((index % count) + count) % count;
  renderCandidate();
  if (options.focusOption) window.requestAnimationFrame(focusActiveCandidateOption);
}

function moveCandidate(delta, options = {}) {
  if (!state.candidates.length) return;
  selectCandidateIndex(state.candidateIndex + delta, options);
}

function openSourcePage() {
  const candidate = selectedCandidate();
  const url = candidate?.source_page || candidate?.source_url || "";
  if (url) window.open(url, "_blank", "noopener");
}

async function copyFolderPath() {
  const path = albumFolderPath();
  if (!path) return;
  try {
    await navigator.clipboard.writeText(path);
    el.actionMessage.textContent = "Folder path copied";
  } catch (error) {
    el.actionMessage.textContent = path;
  }
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
  el.settingDensity.addEventListener("change", () => applyDensity(el.settingDensity.value));
  el.closeShortcutsBtn.addEventListener("click", closeShortcuts);
  el.shortcutsOverlay.addEventListener("click", (event) => {
    if (event.target === el.shortcutsOverlay) closeShortcuts();
  });
  el.shortcutsOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeShortcuts();
    }
  });
  el.scanBtn.addEventListener("click", startScan);
  if (el.freshScanBtn) el.freshScanBtn.addEventListener("click", startFreshScanFromSettings);
  el.findArtworkBtn.addEventListener("click", startArtworkSearch);
  el.approveEmbedBtn.addEventListener("click", approveSelectedCandidate);
  el.convertCurrentBtn.addEventListener("click", convertCurrentArtwork);
  el.rejectCandidateBtn.addEventListener("click", rejectSelectedCandidate);
  el.rejectAllBtn.addEventListener("click", rejectAllCandidates);
  el.prevCandidateBtn.addEventListener("click", () => moveCandidate(-1));
  el.nextCandidateBtn.addEventListener("click", () => moveCandidate(1));
  el.candidateOptions.addEventListener("click", (event) => {
    const option = event.target.closest("button[data-candidate-index]");
    if (!option) return;
    selectCandidateIndex(Number(option.dataset.candidateIndex), { focusOption: true });
  });
  el.candidateOptions.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      moveCandidate(1, { focusOption: true });
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      moveCandidate(-1, { focusOption: true });
    }
  });
  el.importImageBtn.addEventListener("click", openImportImagePicker);
  el.importImageInput.addEventListener("change", () => importSelectedImage(el.importImageInput.files?.[0]));
  el.recheckAlbumBtn.addEventListener("click", () => runAlbumAction("/api/album/recheck", "Rechecked album", { start: "Rechecking this album" }));
  el.copyFolderBtn.addEventListener("click", copyFolderPath);
  el.openSourceBtn.addEventListener("click", openSourcePage);
  el.googleImagesBtn.addEventListener("click", openGoogleImages);
  el.hideTokenWarningBtn.addEventListener("click", () => {
    try {
      sessionStorage.setItem("amwHideTokenWarning", el.tokenWarningText.textContent);
    } catch (_error) {
      // Private browsing: just hide it until the next refresh.
    }
    el.tokenWarning.classList.add("hidden");
  });
  setupSourceOrder();
  el.chooseReleaseBtn.addEventListener("click", openReleaseDialog);
  el.closeReleaseBtn.addEventListener("click", closeReleaseDialog);
  el.releaseOverlay.addEventListener("click", (event) => {
    if (event.target === el.releaseOverlay) closeReleaseDialog();
  });
  el.releaseOverlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeReleaseDialog();
    }
  });
  el.releaseLinkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    importFromLink();
  });
  el.releaseSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchReleases();
  });
  el.moreActionsBtn.addEventListener("click", () => setMoreActionsOpen(!el.actionsPanel.classList.contains("show-more")));
  el.markGoodBtn.addEventListener("click", () => runAlbumAction("/api/album/mark-good", "Marked as good"));
  el.ignoreAlbumBtn.addEventListener("click", ignoreAlbum);
  el.reworkAlbumBtn.addEventListener("click", reworkAlbum);
  el.undoEmbedBtn.addEventListener("click", undoLastEmbed);
  el.stopJobBtn.addEventListener("click", stopRunningJob);
  el.refreshStorageBtn.addEventListener("click", loadStorage);
  el.historyKind.addEventListener("change", () => loadHistory());
  el.historySearch.addEventListener("input", () => {
    window.clearTimeout(historyState.timer);
    historyState.timer = window.setTimeout(() => loadHistory(), 250);
  });
  el.historyMoreBtn.addEventListener("click", () => loadHistory({ append: true }));
  el.historyList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-album-key]");
    if (button) openAlbumFromHistory(button);
  });
  el.cleanStorageBtn.addEventListener("click", cleanStorage);
  el.batchIgnoreBtn.addEventListener("click", () => runBatchAction("/api/batch/ignore", "Ignored selected albums", {
    confirmText: (count) => `Ignore ${fmt(count)} selected album${count === 1 ? "" : "s"}? They leave the queue for good; use Rework to bring any back.`,
    done: "Ignored selected albums. They're under Done.",
  }));
  el.batchReworkBtn.addEventListener("click", () => runBatchAction("/api/batch/rework", "Sent selected albums back to Needs Work", {
    confirmText: (count) => `Send ${fmt(count)} selected album${count === 1 ? "" : "s"} back to Needs Work for new covers? Their saved options are cleared; music files aren't changed.`,
    done: "Sent selected albums back to Needs Work.",
  }));
  el.skipAlbumBtn.addEventListener("click", () => runAlbumAction("/api/album/skip", "Skipped for now"));
  el.selectModeBtn.addEventListener("click", () => setSelectionMode(!state.selectionMode));
  el.batchMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setBatchMenuOpen(!state.batchMenuOpen);
  });
  el.batchSelectAllBtn.addEventListener("click", toggleAllShownSelection);
  el.clearSelectionBtn.addEventListener("click", () => {
    state.selectedKeys.clear();
    setBatchMenuOpen(false);
    renderRows();
  });
  el.batchFindBtn.addEventListener("click", () => runBatchAction("/api/batch/artwork/search", "Searching selected albums", {
    start: "Searching selected albums",
  }));
  el.batchConvertBtn.addEventListener("click", () => runBatchAction("/api/batch/convert-current", "Converting selected albums", {
    start: "Converting selected albums",
    confirmText: (count) => `Convert current artwork for ${fmt(count)} selected album${count === 1 ? "" : "s"}?`,
  }));
  el.batchMarkGoodBtn.addEventListener("click", () => runBatchAction("/api/batch/mark-good", "Marked selected albums as good", {
    confirmText: (count) => `Mark ${fmt(count)} selected album${count === 1 ? "" : "s"} as good?`,
    done: "Marked selected albums as good",
  }));
  el.batchSkipBtn.addEventListener("click", () => runBatchAction("/api/batch/skip", "Skipped selected albums", {
    confirmText: (count) => `Skip ${fmt(count)} selected album${count === 1 ? "" : "s"} for now?`,
    done: "Skipped selected albums",
  }));
  el.batchMenuPanel.addEventListener("click", (event) => {
    if (event.target.closest("button")) {
      setBatchMenuOpen(false);
    }
  });
  document.addEventListener("click", (event) => {
    if (!state.batchMenuOpen || event.target.closest("#batchMenu")) return;
    setBatchMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.batchMenuOpen) return;
    event.preventDefault();
    setBatchMenuOpen(false);
    el.batchMenuBtn.focus({ preventScroll: true });
  });
  el.albumRows.addEventListener("click", (event) => {
    const checkbox = event.target.closest("input[type='checkbox']");
    if (checkbox) {
      const row = checkbox.closest("tr[data-album-key]");
      if (row) toggleAlbumSelection(row.dataset.albumKey, checkbox.checked);
      event.stopPropagation();
      return;
    }
    const row = event.target.closest("tr[data-album-key]");
    if (row) selectAlbum(row.dataset.albumKey, { focusQueue: true, openDetail: isPhoneLayout() });
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
  // Review shortcuts, matching the Mac app: F find, A approve, R reject,
  // S skip, C convert, N next album needing work, / search the queue.
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (state.viewerOpen || state.batchMenuOpen || anyDialogOpen()) return;
    const target = event.target;
    const tag = String(target?.tagName || "").toLowerCase();
    if (target?.isContentEditable || ["input", "textarea", "select"].includes(tag)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "?") {
      event.preventDefault();
      openShortcuts();
      return;
    }
    if (key === "/") {
      event.preventDefault();
      el.searchInput.focus();
      el.searchInput.select();
      return;
    }
    if (key === "n") {
      const next = nextActionableKey(state.selectedKey);
      if (next) {
        event.preventDefault();
        selectAlbum(next, { openDetail: false });
        el.albumRows.querySelector(`tr[data-album-key="${CSS.escape(next)}"]`)?.scrollIntoView({ block: "nearest" });
      }
      return;
    }
    const button = SHORTCUT_BUTTONS[key] && el[SHORTCUT_BUTTONS[key]];
    // Only press buttons the user could click right now.
    if (!button || button.disabled || button.offsetParent === null) return;
    event.preventDefault();
    button.click();
  });
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
    // Reload the list when the server's album counts no longer match it: a quick
    // scan can start and finish between two polls, and changes made from another
    // browser show up too.
    const countsChanged = Boolean(status) && state.statusCountsKey !== state.queueCountsKey;
    if (status && (state.scanActive || state.actionActive || hadAction || countsChanged)) {
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
try { applyDensity(localStorage.getItem("amwDensity")); } catch (_) { applyDensity("standard"); }
syncResponsiveState();
bind();
refreshStatus().then(() => refreshQueue({ force: true })).finally(() => scheduleTick());
