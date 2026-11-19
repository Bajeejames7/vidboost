// Main world: tunes whatever video player the page / embed iframe uses.
(() => {
  if (window.__vidboost) return;
  window.__vidboost = true;
  const DEF = { enabled: true, buffer: 180, cap: 0, hud: true, startLow: false };
  const cfg = () => {
    try { return Object.assign({}, DEF, JSON.parse(document.documentElement.getAttribute('data-vidboost') || '{}')); }
    catch { return DEF; }
  };
  const players = new Set();
  let stalls = 0;

  // ---------- hls.js (what most free-stream embeds use) ----------
  function tuneHlsConfig(c) {
    c = c || {};
    const s = cfg();
    if (!s.enabled) return c;
    return Object.assign({}, c, {
      maxBufferLength: 30,                          // short at first so quality can settle, raised to s.buffer later
      maxMaxBufferLength: Math.max(600, s.buffer),
      maxBufferSize: 300 * 1000 * 1000,             // allow ~300 MB of buffered video
      backBufferLength: 120,                        // keep 2 min behind the playhead so small rewinds are instant
      startLevel: s.startLow ? 0 : -1,              // start lowest = instant start, ABR climbs up
      abrEwmaDefaultEstimate: 3000000,
      abrBandWidthFactor: 0.8,                      // drop quality early before a stall
      abrBandWidthUpFactor: 0.55,                   // only go up when clearly sustainable
      abrEwmaSlowVoD: 12,
      abrEwmaFastVoD: 4,
      startFragPrefetch: true,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 500,
      fragLoadingMaxRetryTimeout: 8000,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      nudgeMaxRetry: 10,
      maxBufferHole: 0.5,
      highBufferWatchdogPeriod: 2,
      lowLatencyMode: false
    });
  }
  function applyCap(h) {
    const s = cfg();
    if (!h.levels || !h.levels.length) return;
    if (!s.enabled || !s.cap) { if (h.autoLevelCapping !== -1) h.autoLevelCapping = -1; return; }
    let idx = 0;
    h.levels.forEach((l, i) => { if ((l.height || 0) <= s.cap) idx = i; });
    if (h.autoLevelCapping !== idx) h.autoLevelCapping = idx;
    if (h.currentLevel > idx) h.nextLevel = idx;
  }
  function wrapHls(H) {
    if (!H || H.__vb || typeof H !== 'function') return H;
    class VBHls extends H {
      constructor(c) {
        super(tuneHlsConfig(c));
        players.add({ type: 'hls', p: this });
        const E = H.Events || {};
        this.on(E.MANIFEST_PARSED || 'hlsManifestParsed', () => applyCap(this));
        // Big buffer only once ABR has found the right quality; otherwise minutes of
        // low-quality video get buffered and you're stuck watching 266p.
        let frags = 0, grown = false;
        this.on(E.FRAG_LOADED || 'hlsFragLoaded', () => {
          if (grown || ++frags < 6) return;
          const top = this.autoLevelCapping >= 0 ? this.autoLevelCapping : this.levels.length - 1;
          if (this.loadLevel >= top || frags >= 20) {
            grown = true;
            this.config.maxBufferLength = cfg().buffer;
          }
        });
        this.on(E.ERROR || 'hlsError', (_, d) => {   // self-heal instead of freezing
          if (!d || !d.fatal) return;
          if (d.type === 'networkError') setTimeout(() => { try { this.startLoad(); } catch {} }, 1000);
          else if (d.type === 'mediaError') { try { this.recoverMediaError(); } catch {} }
        });
      }
    }
    try {
      Object.getOwnPropertyNames(H).forEach(k => {
        if (!['prototype', 'length', 'name'].includes(k)) { try { VBHls[k] = H[k]; } catch {} }
      });
    } catch {}
    VBHls.__vb = true;
    return VBHls;
  }
  let _Hls;
  try {
    Object.defineProperty(window, 'Hls', { configurable: true, get: () => _Hls, set: v => { _Hls = wrapHls(v); } });
  } catch {}

  // ---------- Video.js (VHS) ----------
  let _vjs;
  function tuneVjs(v) {
    try {
      const V = v && (v.Vhs || v.VhsHandler);
      if (V && cfg().enabled) { V.GOAL_BUFFER_LENGTH = 60; V.MAX_GOAL_BUFFER_LENGTH = cfg().buffer; V.BANDWIDTH_VARIANCE = 1.4; }
    } catch {}
    return v;
  }
  try { Object.defineProperty(window, 'videojs', { configurable: true, get: () => _vjs, set: v => { _vjs = tuneVjs(v); } }); } catch {}

  // ---------- Shaka ----------
  let _shaka;
  function tuneShaka(sh) {
    try {
      const P = sh && sh.Player;
      if (!P || P.prototype.__vb) return sh;
      const load = P.prototype.load;
      P.prototype.load = function (...a) {
        if (cfg().enabled) {
          this.configure({ streaming: { bufferingGoal: cfg().buffer, rebufferingGoal: 4, bufferBehind: 120,
            retryParameters: { maxAttempts: 8, baseDelay: 500 } } });
        }
        return load.apply(this, a);
      };
      P.prototype.__vb = true;
    } catch {}
    return sh;
  }
  try { Object.defineProperty(window, 'shaka', { configurable: true, get: () => _shaka, set: v => { _shaka = tuneShaka(v); } }); } catch {}

  // ---------- plain <video> elements ----------
  const seen = new WeakSet();
  function tuneVideo(v) {
    if (seen.has(v)) return;
    seen.add(v);
    if (cfg().enabled && !(v.currentSrc || v.src || '').startsWith('blob:')) v.preload = 'auto';
    v.addEventListener('waiting', () => { if (v.currentTime > 1) stalls++; updateHud(); });
    ensureHud();
  }
  new MutationObserver(() => document.querySelectorAll('video').forEach(tuneVideo))
    .observe(document, { childList: true, subtree: true });

  // ---------- popunder guard: ad scripts opening tabs without a real click ----------
  const _open = window.open;
  window.open = function (...a) {
    if (cfg().enabled && navigator.userActivation && !navigator.userActivation.isActive) return null;
    return _open.apply(this, a);
  };

  // ---------- HUD (Alt+B toggles) ----------
  let hud;
  const mainVideo = () => [...document.querySelectorAll('video')].sort((a, b) => b.clientWidth - a.clientWidth)[0];
  function ensureHud() {
    if (hud || !document.documentElement) return;
    hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;font:12px/1.5 Consolas,ui-monospace,monospace;' +
      'background:rgba(17,17,27,.82);color:#cdd6f4;padding:6px 9px;border-radius:8px;user-select:none;pointer-events:auto';
    hud.addEventListener('click', e => {
      const c = e.target.dataset && e.target.dataset.cap;
      if (c == null) return;
      e.stopPropagation(); e.preventDefault();
      window.postMessage({ __vb: 'set', patch: { cap: +c } }, '*');
    }, true);
    document.documentElement.appendChild(hud);
    setInterval(updateHud, 1000);
  }
  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function updateHud() {
    if (!hud) return;
    const s = cfg();
    const v = mainVideo();
    if (!v || !s.hud || !s.enabled || v.clientWidth < 200) { hud.style.display = 'none'; return; }
    hud.style.display = '';
    if (document.fullscreenElement && hud.parentNode !== document.fullscreenElement) document.fullscreenElement.appendChild(hud);
    if (!document.fullscreenElement && hud.parentNode !== document.documentElement) document.documentElement.appendChild(hud);
    let ahead = 0;
    for (let i = 0; i < v.buffered.length; i++) {
      if (v.buffered.start(i) <= v.currentTime + 0.5 && v.buffered.end(i) > v.currentTime) ahead = v.buffered.end(i) - v.currentTime;
    }
    let bw = '', loading = '';
    players.forEach(({ type, p }) => {
      if (type !== 'hls') return;
      applyCap(p);
      if (p.bandwidthEstimate) bw = (p.bandwidthEstimate / 1e6).toFixed(1) + ' Mbps';
      const l = p.levels && p.levels[p.loadLevel];
      if (l && l.height && l.height !== v.videoHeight) loading = ' → ' + l.height + 'p';
    });
    const col = ahead > 30 ? '#a6e3a1' : ahead > 8 ? '#f9e2af' : '#f38ba8';
    const caps = [0, 1080, 720, 480, 360].map(c =>
      `<span data-cap="${c}" style="cursor:pointer;padding:0 5px;border-radius:4px;${s.cap === c ? 'background:#89b4fa;color:#11111b' : ''}">${c ? c + 'p' : 'auto'}</span>`).join('');
    hud.innerHTML = `<b style="color:#89b4fa">VidBoost</b> buffer <b style="color:${col}">${fmt(ahead)}</b> · ` +
      `${v.videoHeight ? v.videoHeight + 'p' : '-'}${loading}${bw ? ' · ' + bw : ''} · stalls ${stalls}<br>${caps}`;
  }
  window.addEventListener('message', e => { if (e.source === window && e.data && e.data.__vb === 'cfg') updateHud(); });
  window.addEventListener('keydown', e => {
    if (e.altKey && e.code === 'KeyB') window.postMessage({ __vb: 'set', patch: { hud: !cfg().hud } }, '*');
  }, true);
})();
