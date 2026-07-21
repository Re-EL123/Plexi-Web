// ============================================================
// PLEXI DIGITAL MALL — Sound Manager (Freesound API v2)
// Falls back to Web Audio API generated tones if no API key
// or if Freesound is unavailable.
// ============================================================

const SoundManager = (() => {
  let audioCtx = null;
  let cache = {};
  let initialized = false;
  let muted = false;

  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CONFIG.SOUNDS.cacheKey);
      cache = raw ? JSON.parse(raw) : {};
    } catch (_) { cache = {}; }
  }

  function saveCache() {
    try { localStorage.setItem(CONFIG.SOUNDS.cacheKey, JSON.stringify(cache)); } catch (_) {}
  }

  async function init() {
    if (initialized) return;
    loadCache();
    initialized = true;
    if (!CONFIG.SOUNDS.enabled) return;

    const apiKey = CONFIG.SOUNDS.freesoundApiKey;
    if (!apiKey) return;

    const queries = CONFIG.SOUNDS.queries;
    const types = Object.keys(queries);

    for (const type of types) {
      if (cache[type]) continue;
      try {
        const url = `https://freesound.org/apiv2/search/?query=${encodeURIComponent(queries[type])}&fields=id,previews&filter=duration:[0.1%20TO%202.0]&page_size=1&sort=rating_desc&token=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (data.results && data.results.length) {
          const preview = data.results[0].previews;
          const previewUrl = preview.preview_hq_ogg || preview.preview_hq_mp3 || preview.preview_lq_ogg || preview.preview_lq_mp3;
          if (previewUrl) {
            cache[type] = previewUrl;
            saveCache();
          }
        }
      } catch (_) {}
    }
  }

  function playTone(type) {
    const tones = CONFIG.SOUNDS.fallbackTones[type];
    if (!tones) return;
    const ctx = getCtx();
    const vol = CONFIG.SOUNDS.volume;
    let time = ctx.currentTime;

    for (let i = 0; i < tones.length; i += 2) {
      const freq = tones[i];
      const dur = tones[i + 1];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol * 0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + dur);
      time += dur;
    }
  }

  function playUrl(type) {
    const url = cache[type];
    if (!url) { playTone(type); return; }
    try {
      const audio = new Audio(url);
      audio.volume = CONFIG.SOUNDS.volume;
      audio.play().catch(() => playTone(type));
    } catch (_) { playTone(type); }
  }

  function play(type) {
    if (muted || !CONFIG.SOUNDS.enabled) return;
    if (!initialized) { init().then(() => play(type)); return; }
    if (cache[type]) { playUrl(type); }
    else { playTone(type); }
  }

  function toggle() {
    muted = !muted;
    return !muted;
  }

  function isMuted() { return muted; }

  function setVolume(v) { CONFIG.SOUNDS.volume = Math.max(0, Math.min(1, v)); }

  return { init, play, toggle, isMuted, setVolume };
})();

window.SoundManager = SoundManager;
