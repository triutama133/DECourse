/**
 * Small self-hosted animation helper, written for DataForge. It is NOT the Motion or anime.js library:
 * it copies the shape of their APIs (Motion's animate/stagger/spring/inView from https://motion.dev/,
 * anime.js's anime()/timeline/stagger/setDashoffset from https://animejs.com/) on top of the browser's
 * Web Animations API, so the app needs no CDN and works offline.
 *
 * Animations use fill "backwards": the first keyframe holds during the delay, and when an animation ends
 * it lets go, so CSS (hover transforms, the pulse glow, theme changes) applies again. With fill "both" a
 * finished translateY(0) would override every CSS transform on that element for as long as it exists.
 * Respects prefers-reduced-motion: reduce.
 */
(function (root) {
  "use strict";

  function prefersReducedMotion() {
    try {
      return Boolean(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function resolveTargets(target, scope) {
    if (!target) return [];
    if (typeof target === "string") {
      try {
        const ctx = scope && scope.querySelectorAll ? scope : (root.document && root.document.querySelectorAll ? root.document : null);
        return ctx ? Array.from(ctx.querySelectorAll(target)) : [];
      } catch (e) {
        return [];
      }
    }
    if (Array.isArray(target)) return target.flatMap((t) => resolveTargets(t, scope));
    if (typeof NodeList !== "undefined" && target instanceof NodeList) return Array.from(target);
    if (typeof target === "object") return [target];
    return [];
  }

  // ============================================================================
  // 1. MOTION (https://motion.dev/) — Web Animations API + Spring Physics Engine
  // ============================================================================
  function spring(opts = {}) {
    const stiffness = opts.stiffness || 260;
    const damping = opts.damping || 24;
    const mass = opts.mass || 1;
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const duration = Math.min(0.85, Math.max(0.18, (4.2 / (zeta * Math.sqrt(stiffness / mass))) || 0.35));
    const easing = zeta < 0.85
      ? "cubic-bezier(0.22, 1.28, 0.36, 1)"
      : "cubic-bezier(0.16, 1, 0.3, 1)";
    return { type: "spring", duration, easing };
  }

  function stagger(stepSec = 0.05, opts = {}) {
    const start = opts.start || 0;
    return function (index, total) {
      const idx = opts.from === "last" ? Math.max(0, (total || 1) - 1 - index) : index;
      return start + idx * stepSec;
    };
  }

  function motionAnimate(target, keyframes, options = {}) {
    const els = resolveTargets(target, options.scope);
    if (!els.length || prefersReducedMotion()) {
      return { finished: Promise.resolve(), cancel: () => {}, stop: () => {} };
    }
    const sp = options.type === "spring" ? spring(options) : null;
    const durMs = ((sp ? sp.duration : (options.duration ?? 0.32)) * 1000);
    const ease = sp ? sp.easing : (options.easing || "cubic-bezier(0.16, 1, 0.3, 1)");
    const anims = [];

    els.forEach((el, i) => {
      if (!el || typeof el.animate !== "function") return;
      const delaySec = typeof options.delay === "function"
        ? options.delay(i, els.length)
        : (options.delay || 0);
      const kf = {};
      for (const k of Object.keys(keyframes || {})) {
        const val = keyframes[k];
        if (k === "y" || k === "translateY") {
          const arr = Array.isArray(val) ? val : [0, val];
          kf.transform = arr.map((v) => `translateY(${typeof v === "number" ? v + "px" : v})`);
        } else if (k === "x" || k === "translateX") {
          const arr = Array.isArray(val) ? val : [0, val];
          kf.transform = arr.map((v) => `translateX(${typeof v === "number" ? v + "px" : v})`);
        } else if (k === "scale") {
          const arr = Array.isArray(val) ? val : [1, val];
          kf.transform = arr.map((v) => `scale(${v})`);
        } else {
          kf[k] = val;
        }
      }
      try {
        const a = el.animate(kf, {
          duration: durMs,
          delay: delaySec * 1000,
          easing: ease,
          fill: options.fill || "backwards"
        });
        anims.push(a);
      } catch (e) { /* ignore in restricted/headless environments */ }
    });

    return {
      finished: Promise.all(anims.map((a) => a.finished ? a.finished.catch(() => {}) : Promise.resolve())),
      cancel: () => anims.forEach((a) => { try { a.cancel(); } catch (e) {} }),
      stop: () => anims.forEach((a) => { try { a.cancel(); } catch (e) {} })
    };
  }

  function inView(target, callback, options = {}) {
    const els = resolveTargets(target);
    if (!els.length || typeof IntersectionObserver === "undefined") return () => {};
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) callback(entry);
      });
    }, { threshold: options.amount || 0.15, rootMargin: options.margin || "0px" });
    els.forEach((el) => { try { io.observe(el); } catch (e) {} });
    return () => { try { io.disconnect(); } catch (e) {} };
  }

  const Motion = {
    animate: motionAnimate,
    stagger,
    spring,
    inView
  };

  // ============================================================================
  // 2. ANIME.JS (https://animejs.com/) — SVG Path, Dashoffset & Timeline Engine
  // ============================================================================
  const EASING_MAP = {
    linear: "linear",
    easeOutExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
    easeInOutQuad: "cubic-bezier(0.45, 0, 0.55, 1)",
    easeInOutCubic: "cubic-bezier(0.65, 0, 0.35, 1)",
    easeOutBack: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    easeOutElastic: "cubic-bezier(0.22, 1.35, 0.36, 1)",
    spring: "cubic-bezier(0.22, 1.28, 0.36, 1)"
  };

  function setDashoffset(el) {
    if (!el) return 0;
    try {
      if (typeof el.getTotalLength === "function") {
        const len = el.getTotalLength();
        if (el.setAttribute) el.setAttribute("stroke-dasharray", String(len));
        return len;
      }
      if (el.tagName && el.tagName.toLowerCase() === "line") {
        const x1 = parseFloat(el.getAttribute("x1") || 0);
        const y1 = parseFloat(el.getAttribute("y1") || 0);
        const x2 = parseFloat(el.getAttribute("x2") || 0);
        const y2 = parseFloat(el.getAttribute("y2") || 0);
        const len = Math.hypot(x2 - x1, y2 - y1) || 120;
        if (el.setAttribute) el.setAttribute("stroke-dasharray", String(len));
        return len;
      }
    } catch (e) {}
    return 120;
  }

  function animeStagger(val, opts = {}) {
    const start = opts.start || 0;
    return function (el, i, total) {
      if (Array.isArray(val)) {
        const [from, to] = val;
        const step = total > 1 ? (to - from) / (total - 1) : 0;
        return start + from + step * i;
      }
      return start + (Number(val) || 0) * i;
    };
  }

  function runAnimeStep(params = {}, baseOffsetMs = 0) {
    const els = resolveTargets(params.targets, params.scope);
    if (!els.length || prefersReducedMotion()) return { duration: 0, finished: Promise.resolve() };
    const dur = params.duration ?? 520;
    const easeName = typeof params.easing === "string" && params.easing.startsWith("spring") ? "spring" : (params.easing || "easeOutExpo");
    const easing = EASING_MAP[easeName] || EASING_MAP.easeOutExpo;
    const anims = [];
    let maxEnd = 0;

    els.forEach((el, i) => {
      if (!el || typeof el.animate !== "function") return;
      const d = typeof params.delay === "function" ? params.delay(el, i, els.length) : (params.delay || 0);
      const totalDelay = baseOffsetMs + d;
      maxEnd = Math.max(maxEnd, totalDelay + dur);

      const kf = {};
      if (params.opacity !== undefined) {
        kf.opacity = Array.isArray(params.opacity) ? params.opacity : [0, params.opacity];
      }
      if (params.strokeDashoffset !== undefined) {
        const raw = params.strokeDashoffset;
        if (Array.isArray(raw)) {
          const fromVal = typeof raw[0] === "function" ? raw[0](el, i) : raw[0];
          const toVal = typeof raw[1] === "function" ? raw[1](el, i) : raw[1];
          kf.strokeDashoffset = [String(fromVal), String(toVal)];
        }
      }
      const transforms = [];
      if (params.translateY !== undefined) {
        const arr = Array.isArray(params.translateY) ? params.translateY : [0, params.translateY];
        transforms.push(arr.map((v) => `translateY(${typeof v === "number" ? v + "px" : v})`));
      }
      if (params.translateX !== undefined) {
        const arr = Array.isArray(params.translateX) ? params.translateX : [0, params.translateX];
        transforms.push(arr.map((v) => `translateX(${typeof v === "number" ? v + "px" : v})`));
      }
      if (params.scale !== undefined) {
        const arr = Array.isArray(params.scale) ? params.scale : [1, params.scale];
        transforms.push(arr.map((v) => `scale(${v})`));
      }
      if (transforms.length === 1) {
        kf.transform = transforms[0];
      } else if (transforms.length > 1) {
        kf.transform = [
          transforms.map((t) => t[0]).join(" "),
          transforms.map((t) => t[t.length - 1]).join(" ")
        ];
      }

      if (Object.keys(kf).length) {
        try {
          const a = el.animate(kf, {
            duration: dur,
            delay: totalDelay,
            easing,
            fill: params.fill || "backwards"
          });
          anims.push(a);
        } catch (e) {}
      }
    });

    return {
      duration: maxEnd,
      finished: Promise.all(anims.map((a) => a.finished ? a.finished.catch(() => {}) : Promise.resolve()))
    };
  }

  function anime(params = {}) {
    return runAnimeStep(params, 0);
  }

  anime.stagger = animeStagger;
  anime.setDashoffset = setDashoffset;
  anime.timeline = function (defaults = {}) {
    let cursorMs = 0;
    const steps = [];
    const tl = {
      add(stepParams, offset) {
        const merged = Object.assign({}, defaults, stepParams);
        let startMs = cursorMs;
        if (typeof offset === "number") startMs = offset;
        else if (typeof offset === "string" && offset.startsWith("-=")) {
          startMs = Math.max(0, cursorMs - (parseFloat(offset.slice(2)) || 0));
        } else if (typeof offset === "string" && offset.startsWith("+=")) {
          startMs = cursorMs + (parseFloat(offset.slice(2)) || 0);
        }
        const res = runAnimeStep(merged, startMs);
        cursorMs = Math.max(cursorMs, res.duration || startMs);
        steps.push(res);
        return tl;
      },
      finished: Promise.resolve()
    };
    return tl;
  };

  root.Motion = Motion;
  root.anime = anime;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { Motion, anime };
  }
})(typeof window !== "undefined" ? window : globalThis);
