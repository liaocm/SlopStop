/*
 * SlopStopper content script.
 *
 * YouTube only shows its "AI" label (a badge under the title, plus a
 * "How this was made: Made with AI" section in the description) on the watch
 * page. This script finds every video thumbnail on the current page, asks
 * YouTube's own watch-page API (/youtubei/v1/next) for just those two fields,
 * and covers the thumbnails of labeled videos with an "AI slop" overlay.
 */
(() => {
  'use strict';

  if (window.__slopStopperLoaded) return;
  window.__slopStopperLoaded = true;

  const DEBUG = false;
  const log = (...args) => DEBUG && console.debug('[SlopStopper]', ...args);

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const MAX_CONCURRENT_REQUESTS = 4;
  const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // labels rarely get removed
  const NEGATIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // labels are sometimes added late
  const RETRY_AFTER_ERROR_MS = 60 * 1000;
  const RATE_LIMIT_PAUSE_MS = 30 * 1000;
  const SCAN_THROTTLE_MS = 250;
  const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'v:';
  const FALLBACK_CLIENT_VERSION = '2.20261029.01.00';

  // Thumbnail hosts across YouTube's current (view-model) and legacy layouts,
  // plus the player's own suggestions: the end-of-video grid (two variants),
  // the autoplay "Up next" card, and creators' end cards.
  const THUMBNAIL_SELECTOR = [
    'yt-thumbnail-view-model',
    'ytd-thumbnail',
    '.ytp-modern-videowall-still-image',
    '.ytp-videowall-still-image',
    '.ytp-autonav-endscreen-upnext-thumbnail',
    '.ytp-ce-video .ytp-ce-covering-overlay',
  ].join(', ');
  // Playlists and mixes link to their first video; don't judge them by it.
  const COLLECTION_SELECTOR = [
    'yt-collection-thumbnail-view-model',
    'ytd-playlist-thumbnail',
    '[data-is-list="true"]',
    '[data-is-mix="true"]',
  ].join(', ');

  const OVERLAY_CLASS = 'slopstopper-overlay';
  const HOST_CLASS = 'slopstopper-host';
  const ID_ATTR = 'data-slopstopper-id';

  // Only fetch the fields we need. Without this mask the response is ~400 KB
  // per video; with it, well under 1 KB.
  const FIELD_MASK = [
    'contents.twoColumnWatchNextResults.results.results.contents' +
      '.videoPrimaryInfoRenderer.badges.metadataBadgeRenderer(label,accessibilityData)',
    'engagementPanels.engagementPanelSectionListRenderer.content' +
      '.structuredDescriptionContentRenderer.items' +
      '.howThisWasMadeSectionViewModel(bodyHeader,bodyText.content)',
  ].join(',');

  // ---------------------------------------------------------------------------
  // Verdict cache: in-memory, backed by extension storage when available.
  // ---------------------------------------------------------------------------

  const storage =
    typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
      ? chrome.storage.local
      : null;

  /** videoId -> boolean (true = labeled as AI) */
  const verdicts = new Map();
  /** videoId -> timestamp of last failed lookup */
  const failures = new Map();
  /** ids currently being looked up (storage or network) */
  const pending = new Set();

  async function storageGet(keys) {
    if (!storage || !keys.length) return {};
    try {
      return await storage.get(keys);
    } catch (e) {
      log('storage.get failed', e);
      return {};
    }
  }

  function storageSet(items) {
    if (!storage) return;
    storage.set(items).catch((e) => log('storage.set failed', e));
  }

  function isFresh(entry) {
    if (!entry || typeof entry.t !== 'number') return false;
    const ttl = entry.ai ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    return Date.now() - entry.t < ttl;
  }

  async function pruneStorage() {
    if (!storage) return;
    try {
      const { lastPrune = 0 } = await storage.get('lastPrune');
      if (Date.now() - lastPrune < PRUNE_INTERVAL_MS) return;
      const all = await storage.get(null);
      const stale = Object.keys(all).filter(
        (k) => k.startsWith(CACHE_PREFIX) && !isFresh(all[k]),
      );
      if (stale.length) await storage.remove(stale);
      await storage.set({ lastPrune: Date.now() });
      log(`pruned ${stale.length} stale cache entries`);
    } catch (e) {
      log('prune failed', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Talking to YouTube
  // ---------------------------------------------------------------------------

  let clientVersion = null;

  function getClientVersion() {
    if (clientVersion) return clientVersion;
    // Content scripts can't read the page's `ytcfg`, but its inline config
    // script is in the DOM.
    for (const s of document.scripts) {
      const text = s.textContent;
      if (!text || !text.includes('INNERTUBE_CLIENT_VERSION')) continue;
      const m = text.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/);
      if (m) {
        clientVersion = m[1];
        return clientVersion;
      }
    }
    return FALLBACK_CLIENT_VERSION;
  }

  class RateLimitedError extends Error {}

  async function fetchIsAi(videoId) {
    const res = await fetch(`${location.origin}/youtubei/v1/next?prettyPrint=false`, {
      method: 'POST',
      // Anonymous on purpose: the label is public, and this keeps lookups out
      // of the user's account and watch history.
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: getClientVersion(),
            // Force English so the label text below is predictable.
            hl: 'en',
            gl: 'US',
          },
        },
        videoId,
      }),
    });
    if (res.status === 429) throw new RateLimitedError('rate limited');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return isLabeledAi(await res.json());
  }

  /** Reads YouTube's AI disclosure out of a (field-masked) /next response. */
  function isLabeledAi(data) {
    const primary = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    for (const section of primary || []) {
      for (const badge of section?.videoPrimaryInfoRenderer?.badges || []) {
        const b = badge?.metadataBadgeRenderer;
        if (!b) continue;
        if (b.label === 'AI') return true;
        if (/made with ai/i.test(b.accessibilityData?.label || '')) return true;
      }
    }

    for (const panel of data?.engagementPanels || []) {
      const items =
        panel?.engagementPanelSectionListRenderer?.content
          ?.structuredDescriptionContentRenderer?.items;
      for (const item of items || []) {
        const how = item?.howThisWasMadeSectionViewModel;
        if (!how) continue;
        // The same section is also used for e.g. "Auto-dubbed", so match the
        // AI wording specifically.
        const header = how.bodyHeader?.content || '';
        const body = how.bodyText?.content || '';
        if (/made with ai|altered or synthetic/i.test(header)) return true;
        if (/altered or (fully )?generated|digitally generated|synthetic/i.test(body)) {
          return true;
        }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Request queue
  // ---------------------------------------------------------------------------

  const queue = [];
  let activeRequests = 0;
  let pausedUntil = 0;
  let pumpTimer = null;

  function enqueueNetwork(videoId) {
    queue.push(videoId);
    pump();
  }

  function pump() {
    const wait = pausedUntil - Date.now();
    if (wait > 0) {
      if (!pumpTimer) {
        pumpTimer = setTimeout(() => {
          pumpTimer = null;
          pump();
        }, wait);
      }
      return;
    }
    while (activeRequests < MAX_CONCURRENT_REQUESTS && queue.length) {
      const videoId = queue.shift();
      activeRequests++;
      fetchIsAi(videoId)
        .then((ai) => {
          setVerdict(videoId, ai);
          storageSet({ [CACHE_PREFIX + videoId]: { ai, t: Date.now() } });
        })
        .catch((e) => {
          log('lookup failed', videoId, e);
          if (e instanceof RateLimitedError) pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
          failures.set(videoId, Date.now());
          pending.delete(videoId);
        })
        .finally(() => {
          activeRequests--;
          pump();
        });
    }
  }

  async function resolve(videoIds) {
    const now = Date.now();
    const ids = videoIds.filter(
      (id) =>
        !verdicts.has(id) &&
        !pending.has(id) &&
        !(now - (failures.get(id) || 0) < RETRY_AFTER_ERROR_MS),
    );
    if (!ids.length) return;
    ids.forEach((id) => pending.add(id));

    const stored = await storageGet(ids.map((id) => CACHE_PREFIX + id));
    for (const id of ids) {
      const entry = stored[CACHE_PREFIX + id];
      if (isFresh(entry)) setVerdict(id, entry.ai);
      else enqueueNetwork(id);
    }
  }

  function setVerdict(videoId, ai) {
    verdicts.set(videoId, ai);
    pending.delete(videoId);
    failures.delete(videoId);
    if (ai) log('AI-labeled:', videoId);
    for (const host of document.querySelectorAll(`[${ID_ATTR}="${videoId}"]`)) {
      render(host);
    }
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  function videoIdFromHref(href) {
    if (!href) return null;
    let url;
    try {
      url = new URL(href, location.origin);
    } catch {
      return null;
    }
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
    let id = null;
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/shorts\/([\w-]{11})/);
      if (m) id = m[1];
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  function videoIdForThumbnail(thumb) {
    if (thumb.closest(COLLECTION_SELECTOR)) return null;
    const link = thumb.closest('a[href]') || thumb.querySelector('a[href]');
    return link ? videoIdFromHref(link.getAttribute('href')) : null;
  }

  function render(host) {
    const id = host.getAttribute(ID_ATTR);
    const isAi = id && verdicts.get(id) === true;
    let overlay = host.querySelector(`:scope > .${OVERLAY_CLASS}`);
    if (!isAi) {
      overlay?.remove();
      return;
    }
    if (!overlay) {
      if (getComputedStyle(host).position === 'static') host.classList.add(HOST_CLASS);
      overlay = document.createElement('div');
      overlay.className = OVERLAY_CLASS;
      overlay.setAttribute('role', 'img');
      overlay.setAttribute('aria-label', 'AI slop: YouTube labels this video as made with AI');
      overlay.title = 'YouTube labels this video as made with AI';
      const text = document.createElement('span');
      text.textContent = 'AI slop';
      overlay.append(text);
    }
    // Keep it last so it paints above YouTube's own thumbnail overlays.
    if (overlay !== host.lastElementChild) host.append(overlay);
  }

  // Only spend network requests on thumbnails the user is about to see.
  const observed = new Set();
  const visibility = new IntersectionObserver(
    (entries) => {
      const ids = [];
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const host = entry.target;
        visibility.unobserve(host);
        observed.delete(host);
        const id = host.getAttribute(ID_ATTR);
        if (id && !verdicts.has(id)) ids.push(id);
      }
      if (ids.length) resolve([...new Set(ids)]);
    },
    { rootMargin: '800px 0px' },
  );

  function scan() {
    for (const host of observed) {
      if (!host.isConnected) {
        visibility.unobserve(host);
        observed.delete(host);
      }
    }

    for (const host of document.querySelectorAll(THUMBNAIL_SELECTOR)) {
      // A ytd-thumbnail can wrap a yt-thumbnail-view-model; handle the outer one.
      if (host.parentElement?.closest(THUMBNAIL_SELECTOR)) continue;

      const id = videoIdForThumbnail(host);
      const previous = host.getAttribute(ID_ATTR);
      if (id !== previous) {
        // New card, or YouTube recycled this element for another video.
        if (id) host.setAttribute(ID_ATTR, id);
        else host.removeAttribute(ID_ATTR);
      }
      render(host);

      if (id && !verdicts.has(id) && !observed.has(host)) {
        observed.add(host);
        visibility.observe(host);
      }
    }
  }

  let scanTimer = null;
  let lastScan = 0;

  function scheduleScan() {
    if (scanTimer) return;
    const delay = Math.max(0, SCAN_THROTTLE_MS - (Date.now() - lastScan));
    scanTimer = setTimeout(() => {
      scanTimer = null;
      lastScan = Date.now();
      scan();
    }, delay);
  }

  function isOwnMutation(m) {
    if (m.type !== 'childList') return false;
    const nodes = [...m.addedNodes, ...m.removedNodes];
    return (
      nodes.length > 0 &&
      nodes.every((n) => n.nodeType === 1 && n.classList.contains(OVERLAY_CLASS))
    );
  }

  new MutationObserver((mutations) => {
    if (mutations.every(isOwnMutation)) return;
    scheduleScan();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  // YouTube is a single-page app; this fires after each in-app navigation.
  window.addEventListener('yt-navigate-finish', scheduleScan);

  scan();
  pruneStorage();

  // Handy when debugging from the console.
  window.__slopStopper = { verdicts, queue, scan, isLabeledAi };
})();
