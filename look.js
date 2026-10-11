/* Velvet Collar Profiles — the "look" system: palettes, patterns, rings, fonts, particles. */
(() => {
  "use strict";

  const PALETTES = [
    { id: "velvet-collar",     name: "Velvet Collar",      deep: "#1f1f22", mid: "#4a4272", glow: "#988ae3", accent: "#988ae3", name_color: "#ecc5ed" },
    { id: "velvet-original",   name: "Plum & Gold",        deep: "#2a0b2c", mid: "#6e1b55", glow: "#b0407e", accent: "#d9b56f" },
    { id: "strawberry-leash",  name: "Strawberry Leash",   deep: "#3a0714", mid: "#a3123a", glow: "#ff5c8a", accent: "#ffd1dc" },
    { id: "bubblegum-brat",    name: "Bubblegum Brat",     deep: "#3b0a33", mid: "#c2338f", glow: "#ff8fd0", accent: "#9ff3ff" },
    { id: "midnight-mischief", name: "Midnight Mischief",  deep: "#0a0c24", mid: "#262a6b", glow: "#5d63c4", accent: "#c9b6ff" },
    { id: "emerald-envy",      name: "Emerald Envy",       deep: "#04201a", mid: "#0f5a48", glow: "#3aa184", accent: "#e8d38a" },
    { id: "lavender-daydream", name: "Lavender Daydream",  deep: "#1d1233", mid: "#5b3f9e", glow: "#b39cf0", accent: "#ffe3a3" },
    { id: "peachy-keen",       name: "Peachy Keen",        deep: "#2e1210", mid: "#a24a3a", glow: "#ff9e7a", accent: "#ffe1c2" },
    { id: "ocean-tease",       name: "Ocean Tease",        deep: "#04182a", mid: "#0d4f73", glow: "#2bb3c9", accent: "#ffd27f" },
    { id: "cherry-cola",       name: "Cherry Cola",        deep: "#1a0606", mid: "#5c0f12", glow: "#b3242c", accent: "#f2c14e" },
    { id: "golden-hour",       name: "Golden Hour",        deep: "#2a1406", mid: "#8a4a12", glow: "#e39b3b", accent: "#fff0b8" },
    { id: "cotton-candy",      name: "Cotton Candy Cloud", deep: "#251636", mid: "#7a5bb0", glow: "#ff9fd6", accent: "#a8f0ff" },
    { id: "leather-lace",      name: "Leather & Lace",     deep: "#0e0c0c", mid: "#3a3030", glow: "#8c7a74", accent: "#f4e6e1" },
  ];
  // Old single-choice themes from the first version map onto palettes.
  const LEGACY = { velvet: "velvet-collar", wine: "cherry-cola", midnight: "midnight-mischief", emerald: "emerald-envy", rose: "strawberry-leash" };

  const PATTERNS = [
    { id: "none", name: "Plain velvet" }, { id: "sparkles", name: "Sparkles" }, { id: "hearts", name: "Hearts" },
    { id: "stars", name: "Stars" }, { id: "paws", name: "Paw prints" }, { id: "dots", name: "Polka dots" },
    { id: "moons", name: "Moons" }, { id: "stripes", name: "Candy stripes" }, { id: "waves", name: "Waves" },
  ];
  const RINGS = [
    { id: "classic", name: "Classic O-ring" }, { id: "double", name: "Double ring" }, { id: "stitched", name: "Stitched" },
    { id: "glow", name: "Glow-up" }, { id: "rainbow", name: "Rainbow" },
  ];
  const FONTS = [
    { id: "slab", name: "Collar slab", family: '"Roboto Slab", Rockwell, serif', g: null },
    { id: "elegant", name: "Elegant", family: '"Cormorant Garamond", Georgia, serif', g: null },
    { id: "playful", name: "Playful", family: '"Fredoka", system-ui, sans-serif', g: "Fredoka:wght@600" },
    { id: "handwritten", name: "Handwritten", family: '"Caveat", cursive', g: "Caveat:wght@700" },
    { id: "bold", name: "Dramatic", family: '"Abril Fatface", Georgia, serif', g: "Abril+Fatface" },
    { id: "typewriter", name: "Typewriter", family: '"Special Elite", "Courier New", monospace', g: "Special+Elite" },
  ];
  const PARTICLES = [
    { id: "none", name: "Nothing floaty" }, { id: "sparkles", name: "Sparkles" }, { id: "hearts", name: "Hearts" },
    { id: "bubbles", name: "Bubbles" }, { id: "stars", name: "Stars" },
  ];
  // Little charms that hang off the avatar ring, like a tag on a collar.
  const CHARMS = [
    { id: "none", name: "No charm", e: "" }, { id: "bell", name: "Bell", e: "🔔" }, { id: "bow", name: "Bow", e: "🎀" },
    { id: "heart", name: "Heart tag", e: "💜" }, { id: "paw", name: "Paw", e: "🐾" }, { id: "lock", name: "Lock", e: "🔒" },
    { id: "star", name: "Star", e: "⭐" }, { id: "cherry", name: "Cherry", e: "🍒" }, { id: "bone", name: "Bone", e: "🦴" },
  ];
  const CORNERS = [{ id: "soft", name: "Soft" }, { id: "round", name: "Extra round" }, { id: "sharp", name: "Crisp" }];
  const MOODS = ["😈", "🥺", "✨", "🎀", "🔥", "🫠", "🐾", "💋", "🌙", "🍓", "⛓️", "🧸"];

  // ---------- colour maths ----------
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v * t + B[i] * (1 - t))); };
  function lum(hex) {
    const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // Mix `hex` into a near-black until it's dark enough for light text on top.
  function darkTint(hex, base, maxLum) {
    for (let t = 0.5; t >= 0; t -= 0.05) { const c = mix(hex, base, t); if (lum(c) <= maxLum) return c; }
    return base;
  }
  const textOn = (hex) => (lum(hex) > 0.35 ? "#22110a" : "#ffffff");
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

  // ---------- resolve a member's saved style into concrete values ----------
  function resolve(style, legacyTheme) {
    style = style || {};
    const pal = PALETTES.find((p) => p.id === style.palette) ||
      PALETTES.find((p) => p.id === LEGACY[legacyTheme]) || PALETTES[0];
    return {
      palette: style.palette || pal.id,
      deep: isHex(style.deep) ? style.deep : pal.deep,
      mid: isHex(style.mid) ? style.mid : pal.mid,
      glow: isHex(style.glow) ? style.glow : pal.glow,
      accent: isHex(style.accent) ? style.accent : pal.accent,
      // Name colour: the palette's own (pink for Velvet Collar) unless colours were mixed by hand.
      name_color: style.palette === "custom" || !pal.name_color ? null : pal.name_color,
      pattern: style.pattern || "none",
      ring: style.ring || "classic",
      font: style.font || "slab",
      particles: style.particles || "none",
      corners: style.corners || "soft",
      charm: style.charm || "none",
      mood_emoji: style.mood_emoji || "",
      mood_text: style.mood_text || "",
    };
  }

  // ---------- banner patterns (SVG tiles coloured with the accent) ----------
  function svgTile(w, hgt, body) {
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${hgt}'>${body}</svg>`)}")`;
  }
  function patternCss(id, c) {
    const heart = (x, y, s, o) => `<path transform='translate(${x} ${y}) scale(${s})' d='M10 18s-6.5-4.1-8.6-8C-.2 7 1.4 3 5 3c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.2 4 3.6 7-2.1 3.9-8.6 8-8.6 8z' fill='${c}' opacity='${o}'/>`;
    const star = (x, y, s, o) => `<polygon transform='translate(${x} ${y}) scale(${s})' points='10,1 12.6,7 19,7.6 14,11.8 15.6,18.4 10,15 4.4,18.4 6,11.8 1,7.6 7.4,7' fill='${c}' opacity='${o}'/>`;
    const sparkle = (x, y, s, o) => `<path transform='translate(${x} ${y}) scale(${s})' d='M10 0Q11 9 20 10Q11 11 10 20Q9 11 0 10Q9 9 10 0Z' fill='${c}' opacity='${o}'/>`;
    switch (id) {
      case "sparkles": return { img: svgTile(70, 70, sparkle(6, 6, 1, .6) + sparkle(42, 38, .65, .45) + `<circle cx='55' cy='14' r='1.8' fill='${c}' opacity='.6'/><circle cx='16' cy='54' r='1.3' fill='${c}' opacity='.5'/>`), size: "70px 70px" };
      case "hearts": return { img: svgTile(64, 64, heart(6, 6, 1, .5) + heart(38, 36, .8, .35)), size: "64px 64px" };
      case "stars": return { img: svgTile(66, 66, star(6, 8, 1, .5) + star(40, 38, .7, .38) + `<circle cx='50' cy='14' r='1.4' fill='${c}' opacity='.6'/>`), size: "66px 66px" };
      case "paws": return { img: svgTile(72, 72, `<g fill='${c}' opacity='.42'><ellipse cx='18' cy='24' rx='7' ry='6'/><circle cx='9' cy='14' r='3'/><circle cx='15' cy='9' r='3'/><circle cx='22' cy='9' r='3'/><circle cx='28' cy='14' r='3'/></g><g fill='${c}' opacity='.28' transform='translate(36 36) rotate(20 14 14)'><ellipse cx='14' cy='20' rx='6' ry='5'/><circle cx='6' cy='11' r='2.6'/><circle cx='11.5' cy='6.5' r='2.6'/><circle cx='17.5' cy='6.5' r='2.6'/><circle cx='23' cy='11' r='2.6'/></g>`), size: "72px 72px" };
      case "dots": return { img: svgTile(36, 36, `<circle cx='9' cy='9' r='5' fill='${c}' opacity='.4'/><circle cx='27' cy='27' r='5' fill='${c}' opacity='.4'/>`), size: "36px 36px" };
      case "moons": return { img: svgTile(70, 70, `<path d='M22 8a12 12 0 1 0 12 16 9.5 9.5 0 1 1 -12 -16z' fill='${c}' opacity='.5'/>` + sparkle(46, 42, .55, .45)), size: "70px 70px" };
      case "stripes": return { img: `repeating-linear-gradient(135deg, ${rgba(c, .28)} 0 10px, transparent 10px 24px)`, size: "auto" };
      case "waves": return { img: svgTile(60, 24, `<path d='M0 12 Q15 2 30 12 T60 12' fill='none' stroke='${c}' stroke-width='2.2' opacity='.45'/>`), size: "60px 24px" };
      default: return { img: "none", size: "auto" };
    }
  }

  function loadFont(fontId) {
    const f = FONTS.find((x) => x.id === fontId);
    if (!f || !f.g || document.getElementById("font-" + f.id)) return;
    const l = document.createElement("link");
    l.id = "font-" + f.id; l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`;
    document.head.append(l);
  }

  // Apply a resolved look to an element (documentElement for the whole page, or a preview box).
  function apply(look, el) {
    el = el || document.documentElement;
    const s = el.style;
    s.setProperty("--v1", look.deep);
    s.setProperty("--v2", look.mid);
    s.setProperty("--v3", look.glow);
    s.setProperty("--gold", look.accent);
    s.setProperty("--gold-2", mix(look.accent, "#000000", 0.78));
    s.setProperty("--on-gold", textOn(look.accent));
    s.setProperty("--on-glow", textOn(mix(look.mid, look.glow, 0.5)));
    s.setProperty("--gold-soft", rgba(look.accent, 0.16));
    s.setProperty("--name-color", look.name_color || mix(look.accent, "#ffffff", 0.45));
    s.setProperty("--bg", darkTint(look.deep, "#141415", 0.012));
    s.setProperty("--bg-2", darkTint(look.deep, "#1d1d1f", 0.02));
    s.setProperty("--panel-solid", darkTint(look.mid, "#232226", 0.03));
    const p = patternCss(look.pattern, look.accent);
    s.setProperty("--pattern", p.img);
    s.setProperty("--pattern-size", p.size);
    const font = FONTS.find((f) => f.id === look.font) || FONTS[0];
    s.setProperty("--name-font", font.family);
    loadFont(look.font);
    el.dataset.ring = look.ring;
    el.dataset.corners = look.corners;
  }

  // Floating particles. `host` is the element to fill; fixed=true covers the viewport.
  function particles(host, kind, fixed) {
    const old = host.querySelector(":scope > .particles");
    if (old) old.remove();
    if (!kind || kind === "none") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layer = document.createElement("div");
    layer.className = "particles" + (fixed ? " fixed" : "");
    layer.setAttribute("aria-hidden", "true");
    const glyph = { sparkles: "✦", hearts: "♥", stars: "★", bubbles: "" }[kind];
    const n = fixed ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const sp = document.createElement("span");
      sp.className = "pt" + (kind === "bubbles" ? " bubble" : "");
      sp.textContent = glyph;
      const size = 8 + Math.random() * 14;
      sp.style.left = Math.random() * 100 + "%";
      sp.style.fontSize = size + "px";
      if (kind === "bubbles") { sp.style.width = sp.style.height = size + 4 + "px"; }
      sp.style.animationDuration = 9 + Math.random() * 10 + "s";
      sp.style.animationDelay = -Math.random() * 18 + "s";
      sp.style.setProperty("--drift", (Math.random() * 60 - 30).toFixed(0) + "px");
      sp.style.opacity = (0.35 + Math.random() * 0.5).toFixed(2);
      layer.append(sp);
    }
    host.prepend(layer);
  }

  window.VCLook = { CHARMS, PALETTES, PATTERNS, RINGS, FONTS, PARTICLES, CORNERS, MOODS, resolve, apply, particles, patternCss, isHex };
})();
