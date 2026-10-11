/* Velvet Collar Profiles — front end (plain JS, no build step). */
(() => {
  "use strict";

  const CFG = window.VC_CONFIG || {};
  const pb = new PocketBase(CFG.API_URL);
  pb.autoCancellation(false);

  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const RESERVED = ["edit", "api", "admin", "login", "logout", "join", "signup", "settings", "playroom", "games", "index", "directory", "members", "assets", "vendor", "_"];
  // "Looking for" choices: [value, emoji, label]. "open" and "nothing" each stand on their own.
  const LOOKING = [["friends", "🤝", "Friends"], ["partners", "💞", "Partners"], ["play", "🔥", "Play"], ["open", "✨", "Open to anything"], ["nothing", "🌙", "Not looking right now"]];
  const SOLO = ["open", "nothing"];
  function lookingBadges(values, compact) {
    const picked = LOOKING.filter(([v]) => (values || []).includes(v));
    if (!picked.length) return null;
    if (picked[0][0] === "nothing") return h("div", { class: "looking" + (compact ? " compact" : "") }, h("span", { class: "lk nothing" }, h("span", { "aria-hidden": "true" }, "🌙"), " Not looking right now"));
    return h("div", { class: "looking" + (compact ? " compact" : ""), "aria-label": "Looking for " + picked.map((x) => x[2].toLowerCase()).join(", ") },
      compact ? null : h("span", { class: "lk-label" }, "Looking for"),
      picked.map(([v, e, label]) => h("span", { class: "lk lk-" + v }, h("span", { "aria-hidden": "true" }, e), " " + label)));
  }

  const LINK_PRESETS = [
    ["FetLife", "https://fetlife.com/users/"],
    ["Instagram", "https://instagram.com/"],
    ["Bluesky", "https://bsky.app/profile/"],
    ["X", "https://x.com/"],
    ["Wishlist", "https://"],
    ["Photos", "https://"],
  ];

  // ---------- tiny DOM helper (always uses textContent, never innerHTML for user data) ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "href" || k === "src") el.setAttribute(k, v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : null);
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const me = () => (pb.authStore.isValid ? pb.authStore.record : null);
  const profileUrl = (slug) => `${location.origin}/${slug}`;
  const fileUrl = (rec, name, thumb) => (name ? pb.files.getURL(rec, name, thumb ? { thumb } : undefined) : "");

  function toast(msg, isErr) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.toggle("err", !!isErr);
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Link copied"); }
    catch { prompt("Copy your link:", text); }
  }

  function errMsg(err) {
    const d = err && err.response;
    if (d && d.data && Object.keys(d.data).length) {
      const [field, info] = Object.entries(d.data)[0];
      return `${field}: ${info.message || "invalid"}`;
    }
    return (d && d.message) || err.message || "Something went wrong";
  }

  const L = window.VCLook;
  // Apply a member's look to the whole page (and floating particles if they picked some).
  function setLook(style, legacyTheme, withParticles) {
    const look = L.resolve(style, legacyTheme);
    L.apply(look, document.documentElement);
    L.particles(document.body, withParticles ? look.particles : "none", true);
    return look;
  }

  function avatarEl(rec, cls) {
    const url = rec.avatar ? fileUrl(rec, rec.avatar, cls === "sm" ? "200x200" : "600x600") : "";
    if (url) return h("img", { class: "avatar " + (cls || ""), src: url, alt: "" });
    const initial = (rec.display_name || "?").trim().charAt(0).toUpperCase();
    return h("div", { class: "avatar " + (cls || ""), "aria-hidden": "true" }, initial);
  }

  // Avatar with an optional charm hanging off the ring.
  function avatarWithCharm(rec, charmId, cls) {
    const charm = (L.CHARMS.find((c) => c.id === charmId) || {}).e;
    const av = avatarEl(rec, cls);
    if (!charm) return av;
    return h("div", { class: "avatar-wrap" }, av, h("span", { class: "charm", "aria-hidden": "true" }, h("span", { class: "charm-loop" }), h("span", { class: "charm-tag" }, charm)));
  }

  // ---------- accounts: log in / make a profile ----------
  function afterAuth(record, isNew) {
    toast((isNew ? "Welcome, " : "Welcome back, ") + record.display_name);
    let back = "";
    try { back = sessionStorage.getItem("vc_after_login") || ""; sessionStorage.removeItem("vc_after_login"); } catch {}
    go(isNew ? "/edit" : back || "/");
  }

  function renderAuth(mode) {
    document.title = (mode === "join" ? "Make a profile" : "Log in") + " · Velvet Collar";
    const msg = h("p", { class: "status bad", role: "alert" });
    const field = (label, input, hint) => h("div", { class: "field" }, h("label", { for: input.id }, label), input, hint ? h("span", { class: "hint" }, hint) : null);
    const slugIn = h("input", { type: "text", id: "a_slug", autocomplete: "username", autocapitalize: "off", spellcheck: "false", maxlength: 32, required: true });
    slugIn.addEventListener("input", () => { slugIn.value = slugIn.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""); });
    const pwIn = h("input", { type: "password", id: "a_pw", autocomplete: mode === "join" ? "new-password" : "current-password", minlength: 8, maxlength: 72, required: true });
    const btn = h("button", { class: "btn gold", type: "submit" }, mode === "join" ? "Make my profile" : "Log in");
    let form;

    if (mode === "join") {
      const codeIn = h("input", { type: "text", id: "a_code", autocomplete: "off", autocapitalize: "off", spellcheck: "false", required: true });
      const nameIn = h("input", { type: "text", id: "a_name", maxlength: 60, required: true, autocomplete: "nickname" });
      const pw2In = h("input", { type: "password", id: "a_pw2", autocomplete: "new-password", minlength: 8, maxlength: 72, required: true });
      const slugStatus = h("span", { class: "status" });
      let t;
      slugIn.addEventListener("input", () => {
        clearTimeout(t); slugStatus.className = "status"; slugStatus.textContent = "";
        if (slugIn.value.length < 3) return;
        t = setTimeout(async () => {
          try {
            const r = await pb.send("/api/vc/slug-available?slug=" + encodeURIComponent(slugIn.value), {});
            slugStatus.className = "status " + (r.available ? "ok" : "bad");
            slugStatus.textContent = !r.valid ? "Letters, numbers, - or _ (3–32)" : r.available ? "Available" : "Taken";
          } catch {}
        }, 300);
      });
      form = h("form", { class: "auth-form panel" },
        field("Join code", codeIn, "Shared in the group chat."),
        field("Display name", nameIn),
        h("div", { class: "field" }, h("label", { for: "a_slug" }, "Link name"),
          h("div", { class: "slug-row" }, h("span", {}, location.host + "/"), slugIn),
          slugStatus, h("span", { class: "hint" }, "Your page's address. It's also what you log in with.")),
        field("Password", pwIn, "At least 8 characters."),
        field("Password again", pw2In),
        msg, btn,
        h("p", { class: "faint" }, "Already have one? ", h("a", { href: "/login", "data-nav": "" }, "Log in")));
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); msg.textContent = "";
        if (pwIn.value !== pw2In.value) { msg.textContent = "The passwords don't match."; return pw2In.focus(); }
        btn.disabled = true; btn.textContent = "Making it…";
        try {
          const res = await pb.send("/api/vc/signup", { method: "POST", body: { join_code: codeIn.value, display_name: nameIn.value, slug: slugIn.value, password: pwIn.value } });
          pb.authStore.save(res.token, res.record);
          afterAuth(res.record, true);
        } catch (err) {
          const d = err.response || {};
          msg.textContent = d.message || errMsg(err);
          const focus = { join_code: codeIn, display_name: nameIn, slug: slugIn, password: pwIn }[d.field];
          if (focus) focus.focus();
          btn.disabled = false; btn.textContent = "Make my profile";
        }
      });
    } else {
      form = h("form", { class: "auth-form panel" },
        h("div", { class: "field" }, h("label", { for: "a_slug" }, "Link name"),
          h("div", { class: "slug-row" }, h("span", {}, location.host + "/"), slugIn)),
        field("Password", pwIn),
        msg, btn,
        h("p", { class: "faint" }, "New here? ", h("a", { href: "/join", "data-nav": "" }, "Make a profile"), " · Forgot your password? Ask a mod to reset it."));
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); msg.textContent = "";
        btn.disabled = true; btn.textContent = "Logging in…";
        try {
          const res = await pb.collection("members").authWithPassword(slugIn.value.trim(), pwIn.value);
          afterAuth(res.record, false);
        } catch (err) {
          msg.textContent = err.status === 429 ? "Too many tries. Wait a minute and try again." : "That link name and password don't match.";
          btn.disabled = false; btn.textContent = "Log in";
        }
      });
    }
    app.replaceChildren(h("div", { class: "auth-wrap" },
      h("h1", { class: "auth-title" }, mode === "join" ? "Make your profile" : "Welcome back"),
      form));
    (mode === "join" ? form.querySelector("#a_code") : slugIn).focus();
  }

  // ---------- routing ----------
  function route() {
    const q = new URLSearchParams(location.search);
    if (q.has("u")) return { name: "profile", slug: q.get("u").toLowerCase() };
    if (q.has("edit")) return { name: "edit" };
    const path = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, "")).toLowerCase();
    if (!path || path === "index.html" || path === "404.html") return { name: "home" };
    if (path === "edit") return { name: "edit" };
    if (path === "login" || path === "join") return { name: path };
    if (path === "playroom") return { name: "playroom" };
    return { name: "profile", slug: path.split("/")[0] };
  }
  function go(path) { history.pushState(null, "", path); render(); window.scrollTo(0, 0); }
  window.addEventListener("popstate", render);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); go(a.getAttribute("href")); }
  });

  function renderNav() {
    nav.replaceChildren();
    const user = me();
    const here = route().name;
    const playroom = h("a", { class: "btn small ghost" + (here === "playroom" ? " current" : ""), href: "/playroom", "data-nav": "" }, "Playroom");
    if (!user) {
      nav.append(playroom, h("a", { class: "btn small ghost", href: "/login", "data-nav": "" }, "Log in"));
    } else {
      nav.append(
        playroom,
        h("a", { class: "btn small ghost", href: "/", "data-nav": "" }, "Member list"),
        h("a", { class: "btn small ghost", href: "/" + user.slug, "data-nav": "" }, "My profile"),
        h("a", { class: "btn small gold", href: "/edit", "data-nav": "" }, "Edit"),
      );
    }
  }

  async function render() {
    renderNav();
    const r = route();
    setLook({}, null, false);
    app.replaceChildren(h("p", { class: "center-msg muted" }, "Loading…"));
    try {
      if (me()) { try { await pb.collection("members").authRefresh(); } catch (e) { if (e.status === 401 || e.status === 404) pb.authStore.clear(); } renderNav(); }
      if (r.name === "home") return me() ? await renderDirectory() : renderLanding();
      if (r.name === "edit") return me() ? await renderEditor() : renderLogin("/edit");
      if (r.name === "login" || r.name === "join") return me() ? go("/") : renderAuth(r.name);
      if (r.name === "playroom") return await renderPlayroom();
      return await renderProfile(r.slug);
    } catch (err) {
      app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "Hmm."), h("p", { class: "muted" }, errMsg(err))));
    }
  }

  // ---------- landing ----------
  function renderLanding() {
    document.title = "Velvet Collar Profiles";
    app.replaceChildren(
      h("section", { class: "hero" },
        h("div", { class: "logo", role: "img", "aria-label": "Velvet Collar: curious minds, boundless bodies" },
          h("span", { class: "mark", "aria-hidden": "true" }),
          h("span", { class: "name", "aria-hidden": "true" }, "Velvet Collar"),
          h("span", { class: "tagline", "aria-hidden": "true" }, "Curious minds, boundless bodies")),
        h("h1", {}, "One link for everything about you"),
        h("p", {}, `Make a profile page for ${CFG.GROUP_NAME || "the group"}, put the link in your Telegram bio, and people can find everything about you in one tap.`),
        h("div", { class: "actions", style: "justify-content:center" },
          h("a", { class: "btn gold", href: "/join", "data-nav": "" }, "Make my profile"),
          h("a", { class: "btn", href: "/login", "data-nav": "" }, "Log in")),
        h("p", { class: "faint", style: "margin-top:14px" }, "You'll need the join code from the group chat."),
      ),
      h("section", { class: "showcase" },
        sampleTag(),
        h("ul", { class: "points" },
          h("li", {}, h("b", {}, "All your links in one place. "), "FetLife, wishlists, socials, albums and anything else you want people to find, one tap away."),
          h("li", {}, h("b", {}, "Photos with a blur switch. "), "Mark a photo NSFW and it stays blurred until someone taps it."),
          h("li", {}, h("b", {}, "Yours to dress up. "), "Pick colours, patterns and a mood sticker, and say what you're into and where your limits are."),
          h("li", {}, h("b", {}, "Only shown to who you choose. "), "People see your page through your link. Joining the member list is up to you."))),
    );
  }

  // A static example of a profile, shown on the landing page.
  function sampleTag() {
    const card = h("div", { class: "sample", "aria-label": "Example profile", role: "img" },
      h("div", { class: "banner" }),
      h("div", { class: "profile-head" },
        h("div", { class: "avatar", "aria-hidden": "true" }, "R"),
        h("div", { class: "profile-name" }, "Rowan"),
        lookingBadges(["friends", "play"]),
        h("div", { class: "mood" }, h("span", { class: "em" }, "🎀"), "feeling bratty, bring snacks"),
        h("div", { class: "chips" }, h("span", { class: "chip gold" }, "Brat"), h("span", { class: "chip" }, "she/they")),
        h("div", { class: "key-list" },
          [["FetLife", "fetlife.com"], ["Wishlist", "throne.com"], ["Photo album", "flickr.com"]].map(([t, host]) => h("div", { class: "key" },
            h("span", { class: "mono" }, t.slice(0, 2).toUpperCase()),
            h("span", { class: "txt" }, h("b", {}, t), h("small", {}, host)))))));
    L.apply(Object.assign(L.resolve({ palette: "bubblegum-brat", pattern: "hearts", ring: "rainbow" }), { font: "slab" }), card);
    return card;
  }

  function renderLogin(after) {
    try { sessionStorage.setItem("vc_after_login", after); } catch {}
    renderAuth("login");
  }

  // ---------- playroom: the group's games (managed in the dashboard) ----------
  async function renderPlayroom() {
    document.title = "Playroom · Velvet Collar";
    const games = await pb.collection("games").getFullList({ sort: "sort,title" });
    const grid = h("div", { class: "games" });
    if (!games.length) grid.append(h("p", { class: "muted" }, "No games here yet. Check back soon."));
    for (const g of games) {
      const url = safeUrl(g.url);
      if (!url) continue;
      grid.append(h("a", { class: "game", href: url, target: "_blank", rel: "noopener" },
        h("span", { class: "game-emoji", "aria-hidden": "true" }, g.emoji || "🎲"),
        h("span", { class: "game-txt" },
          h("b", {}, g.title),
          g.description ? h("span", {}, g.description) : null),
        h("span", { class: "game-go" }, "Play")));
    }
    app.replaceChildren(
      h("section", { class: "playroom-head" },
        h("h1", {}, "Playroom"),
        h("p", { class: "muted" }, `Games made for ${CFG.GROUP_NAME || "the group"}. Each one opens in a new tab.`)),
      grid);
  }

  // ---------- member list (logged-in only, opt-in) ----------
  async function renderDirectory() {
    document.title = "Member list · Velvet Collar";
    const user = me();
    const list = await pb.collection("members").getFullList({ filter: "listed = true", sort: "display_name", fields: "id,collectionId,collectionName,slug,display_name,avatar,style,theme,looking_for,created" });
    const rows = h("div", { class: "link-list" });
    let term = "", filter = "all";
    const FILTERS = [["all", "Everyone"], ["new", "🌱 New this week"], ...LOOKING.filter(([v]) => v !== "nothing").map(([v, e, l]) => [v, `${e} ${l}`])];
    const filterBar = h("div", { class: "pills dir-filters", role: "group", "aria-label": "Filter members" });
    const drawFilters = () => filterBar.replaceChildren(...FILTERS.map(([v, label]) =>
      h("button", { type: "button", class: "pill", "aria-pressed": String(filter === v), onclick: () => { filter = v; drawFilters(); draw(); } }, label)));
    const matchesFilter = (m) => filter === "all" ? true : filter === "new" ? isNew(m) : (m.looking_for || []).includes(filter) || (filter !== "open" && (m.looking_for || []).includes("open"));
    const draw = () => {
      rows.replaceChildren();
      const t = term.trim().toLowerCase();
      const items = list.filter((m) => (!t || (m.display_name + " " + m.slug).toLowerCase().includes(t)) && matchesFilter(m));
      if (!items.length) rows.append(h("p", { class: "muted" }, list.length ? "No one matches that." : "No one has joined the list yet."));
      for (const m of items) {
        const row = h("a", { class: "link", href: "/" + m.slug, "data-nav": "" },
          m.avatar
            ? h("img", { class: "mono photo", src: fileUrl(m, m.avatar, "200x200"), alt: "", loading: "lazy" })
            : h("span", { class: "mono", "aria-hidden": "true" }, (m.display_name || "?").slice(0, 2).toUpperCase()),
          h("span", { class: "txt" }, h("b", {}, m.display_name, isNew(m) ? h("span", { class: "new-pill" }, "New") : null), h("small", {}, profileUrl(m.slug).replace(/^https?:\/\//, "")), lookingBadges(m.looking_for, true)),
          h("span", { class: "arrow", "aria-hidden": "true" }, "→"));
        L.apply(L.resolve(m.style, m.theme), row);
        rows.append(row);
      }
    };
    const search = h("input", { class: "search", type: "search", placeholder: `Search ${list.length} ${list.length === 1 ? "member" : "members"}`, "aria-label": "Search members", oninput: (e) => { term = e.target.value; draw(); } });
    const others = list.filter((m) => m.id !== user.id);
    const surprise = others.length ? h("button", { type: "button", class: "btn small gold", onclick: () => go("/" + others[Math.floor(Math.random() * others.length)].slug) }, "🎲 Surprise me") : null;
    drawFilters(); draw();
    app.replaceChildren(
      user.listed ? "" : h("p", { class: "faint", style: "margin:0 0 12px" },
        "You're not on the list, so people only find you through your link. ",
        h("a", { href: "/edit#settings", "data-nav": "" }, "Join it in Settings.")),
      h("section", { class: "panel" },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "Member list"), surprise),
        h("p", { class: "faint", style: "margin-top:4px" }, "Only logged-in members can see this list, and only people who opted in are on it. Open-to-anything members show up under every filter."),
        search, filterBar, rows),
    );
  }

  // ---------- interests & limits: long lists become tags ----------
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Split on commas that aren't inside brackets, so "Rigger (rope top)" stays whole.
  function splitItems(str) {
    const out = []; let cur = "", depth = 0;
    for (const ch of String(str)) {
      if (ch === "(") depth++; else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && !depth) { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim()).filter((x) => x && !/^and \d+ more$/i.test(x));
  }
  // Returns { groups: [{label, items}] } for list-like text, or { prose } for sentences.
  function parseTags(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const lines = t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const LABEL = /^(love|enjoy|curious about|into|like|maybe|hard limits?|soft limits?|limits?)\s*:\s*(.*)$/i;
    if (lines.some((l) => LABEL.test(l))) {
      const groups = [];
      for (const l of lines) {
        const m = l.match(LABEL);
        if (m) groups.push({ label: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), items: splitItems(m[2]) });
        else if (groups.length) groups[groups.length - 1].items.push(...splitItems(l));
        else groups.push({ label: null, items: splitItems(l) });
      }
      return { groups: groups.filter((g) => g.items.length) };
    }
    const items = lines.length > 1 ? lines.flatMap((l) => (l.length > 60 ? [l] : splitItems(l))) : splitItems(lines[0]);
    const listy = items.length >= 3 && items.every((x) => x.length <= 60 && !/[.!?]$/.test(x));
    return listy ? { groups: [{ label: null, items }] } : { prose: t };
  }
  // A row of tags showing `max` at a time. With rotate, it cycles through the rest every few seconds.
  function tagRow(items, { max, rotate, cls }) {
    const tags = h("div", { class: "tags" });
    let start = 0, expanded = false, paused = false, timer = null;
    const visible = () => {
      if (expanded || items.length <= max) return items;
      const out = []; for (let i = 0; i < max; i++) out.push(items[(start + i) % items.length]); return out;
    };
    const draw = () => tags.replaceChildren(...visible().map((t) => h("span", { class: "tag " + (cls || "") }, t)));
    draw();
    const row = h("div", { class: "tag-row" }, tags);
    if (items.length > max) {
      const btn = h("button", { type: "button", class: "see-all" }, `See all ${items.length}`);
      btn.addEventListener("click", () => {
        expanded = !expanded; btn.textContent = expanded ? "Show fewer" : `See all ${items.length}`;
        draw();
      });
      row.append(btn);
      if (rotate && !reduceMotion()) {
        row.addEventListener("mouseenter", () => (paused = true));
        row.addEventListener("mouseleave", () => (paused = false));
        row.addEventListener("focusin", () => (paused = true));
        row.addEventListener("focusout", () => (paused = false));
        timer = setInterval(() => {
          if (!document.body.contains(tags)) return clearInterval(timer);
          if (paused || expanded || document.hidden) return;
          tags.classList.add("fading");
          setTimeout(() => { start = (start + max) % items.length; draw(); tags.classList.remove("fading"); }, 260);
        }, 4500);
      }
    }
    return row;
  }
  function proseBlock(text, cls) {
    const p = h("p", { class: "bio clamp " + (cls || "") }, text);
    if (text.length < 400) { p.classList.remove("clamp"); return p; }
    const btn = h("button", { type: "button", class: "see-all" }, "Read more");
    btn.addEventListener("click", () => { const open = p.classList.toggle("clamp"); btn.textContent = open ? "Read more" : "Show less"; });
    return h("div", {}, p, btn);
  }
  function intoSection(text) {
    const parsed = parseTags(text);
    if (!parsed) return null;
    const body = parsed.prose ? [proseBlock(parsed.prose)] : parsed.groups.map((g) => {
      const key = (g.label || "").toLowerCase();
      const cls = key === "love" ? "tag-love" : key === "enjoy" ? "tag-enjoy" : key.startsWith("curious") || key === "maybe" ? "tag-curious" : "";
      return h("div", { class: "tag-group" },
        g.label ? h("h3", { class: "tag-label" }, g.label) : null,
        tagRow(g.items, { max: key === "love" ? 8 : 6, rotate: true, cls }));
    });
    return h("section", { class: "prose" }, h("h2", {}, "Into & curious about"), ...body);
  }
  function limitsSection(text) {
    const parsed = parseTags(text);
    if (!parsed) return null;
    // Limits don't rotate: none of them should drop out of view while someone is reading.
    const body = parsed.prose ? [proseBlock(parsed.prose)] : parsed.groups.map((g) => h("div", { class: "tag-group" },
      g.label && !/^limits?$/i.test(g.label) ? h("h3", { class: "tag-label" }, g.label) : null,
      tagRow(g.items, { max: 8, rotate: false, cls: "tag-limit" })));
    return h("section", { class: "limits-box" }, h("h2", {}, "Limits"), ...body);
  }

  // ---------- a fun, ready-to-paste Telegram post ----------
  function telegramPost(p, isOwner) {
    const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const url = profileUrl(p.slug);
    const look = L.resolve(p.style, p.theme);
    const lines = [];
    if (isOwner) {
      lines.push(pickOne([
        "🐾 Come sniff around my Velvet Collar page!",
        "💜 New collar, who dis? My profile's up:",
        "✨ Curious about me? It's all on my tag:",
        "🔔 *jingle jingle* That's me. Come say hi:",
        "🎀 Fresh off the shelf: my Velvet Collar profile",
      ]));
    } else {
      lines.push(pickOne([
        `👀 Psst, go say hi to ${p.display_name}:`,
        `💜 Spotted on the Velvet Collar shelf: ${p.display_name}`,
        `🐾 ${p.display_name} has a cute collar tag, take a look:`,
      ]));
    }
    lines.push("");
    if (look.mood_emoji || look.mood_text) lines.push(`${look.mood_emoji || "💬"} ${look.mood_text || ""}`.trim());
    const lf = LOOKING.filter(([v]) => (p.looking_for || []).includes(v));
    if (lf.length) lines.push((lf[0][0] === "nothing" ? "" : "Looking for: ") + lf.map(([, e, l]) => `${e} ${l}`).join(" · "));
    const into = parseTags(p.into);
    const love = into && into.groups ? (into.groups.find((g) => /love/i.test(g.label || "")) || into.groups[0]) : null;
    if (love && love.items.length) lines.push("Into: " + love.items.slice(0, 3).join(", ") + (love.items.length > 3 ? " & more" : ""));
    const ask = (p.prompts || []).find((x) => x && x.a);
    if (ask) lines.push(`${ask.q.replace(/…$/, "")}: ${ask.a}`);
    lines.push("");
    lines.push(`👉 ${url}`);
    return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  }
  async function copyPost(p, isOwner) {
    const text = telegramPost(p, isOwner);
    try { await navigator.clipboard.writeText(text); toast("📣 Post copied! Paste it in Telegram."); }
    catch { prompt("Copy this post:", text); }
  }

  // ---------- badges ----------
  // Admin-given badges come from the dashboard; the rest are worked out from the profile.
  const ADMIN_BADGES = { mod: ["🛡️", "Mod", "Keeps the group running"], host: ["🎪", "Event host", "Hosts group events"], welcomer: ["🤗", "Welcomer", "Says hi to new members"], helper: ["🛠️", "Helper", "Helps behind the scenes"], vip: ["👑", "VIP", "Someone special to the group"] };
  const parseDate = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? null : t; };
  const isNew = (m) => { const t = parseDate(m.created); return t && Date.now() - t < 7 * 864e5; };
  function badgesFor(p, photoCount) {
    const out = [];
    for (const b of p.badges || []) if (ADMIN_BADGES[b]) out.push(ADMIN_BADGES[b]);
    if (isNew(p)) out.push(["🌱", "New here", "Joined this week, say hi!"]);
    const plays = (p.play_links || []).map((l) => l.url || "");
    if (plays.some((u) => /kink-jars/i.test(u))) out.push(["🫙", "Jar collector", "Has a Kink Jars shelf"]);
    if (plays.some((u) => /romance\.jay-hosting/i.test(u))) out.push(["💞", "Sweetheart", "Has a Romantic Jars shelf"]);
    if (plays.length >= 2) out.push(["🎲", "Playroom regular", "Plays more than one game"]);
    if (photoCount >= 5) out.push(["📸", "Shutterbug", "Shares lots of photos"]);
    if ((p.prompts || []).length >= 3) out.push(["💬", "Open book", "Answered 3+ Ask me about cards"]);
    return out;
  }
  const badgeRow = (list) => list.length ? h("div", { class: "badges", "aria-label": "Badges" },
    list.map(([e, label, why]) => h("span", { class: "badge", title: why }, h("span", { "aria-hidden": "true" }, e), " " + label))) : null;

  // ---------- reactions, kind notes and the compatibility peek ----------
  const REACT = [["fire", "🔥", "Hot"], ["heart", "💜", "Love this"], ["paw", "🐾", "Cute"], ["sparkle", "✨", "Fun"]];
  function reactionBar(p, social, onChange) {
    if (social.reactions_off) return null;
    const user = me();
    const isOwner = social.isOwner;
    return h("div", { class: "reactions", role: "group", "aria-label": "Reactions" },
      REACT.map(([k, e, label]) => {
        const n = social.reactions[k] || 0;
        const pressed = social.mine.includes(k);
        const b = h("button", { type: "button", class: "react", "aria-pressed": String(pressed), title: label, disabled: isOwner },
          h("span", { "aria-hidden": "true" }, e), h("span", { class: "n" }, String(n)), h("span", { class: "sr" }, label));
        if (!isOwner) b.addEventListener("click", async () => {
          if (!user) return toast("Log in to react", true);
          b.disabled = true;
          try { onChange(await pb.send("/api/vc/react", { method: "POST", body: { slug: p.slug, emoji: k } })); }
          catch (err) { toast(errMsg(err), true); b.disabled = false; }
        });
        return b;
      }),
      h("span", { class: "react-hint" }, isOwner ? "Reactions from members" : user ? "Anonymous" : "Log in to react"));
  }
  function notesSection(p, social, refresh) {
    const user = me();
    if (social.notes_off && !social.isOwner) return null;
    const when = (d) => { try { return new Date(d.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return ""; } };
    const noteCard = (n, actions) => h("div", { class: "note" },
      h("p", {}, n.text),
      h("div", { class: "note-foot" },
        h("span", {}, n.author ? h("a", { href: "/" + n.author.slug, "data-nav": "" }, "— " + n.author.name) : "— Anonymous", " · " + when(n.created)),
        actions));
    const del = (n, label) => h("button", { type: "button", class: "see-all", onclick: async () => {
      try { await pb.send("/api/vc/notes/" + n.id, { method: "DELETE" }); toast("Removed"); refresh(); } catch (err) { toast(errMsg(err), true); }
    } }, label || "Remove");
    const parts = [];
    if (social.isOwner && social.pending.length) {
      parts.push(h("div", { class: "pending" },
        h("h3", { class: "tag-label" }, `Waiting for your OK (${social.pending.length})`),
        social.pending.map((n) => noteCard(n, h("span", { class: "note-actions" },
          h("button", { type: "button", class: "btn small gold", onclick: async () => {
            try { await pb.send("/api/vc/notes/" + n.id + "/approve", { method: "POST" }); toast("Added to your page"); refresh(); } catch (err) { toast(errMsg(err), true); }
          } }, "Show it"), del(n, "Delete"))))));
    }
    if (social.notes.length) parts.push(h("div", { class: "notes" }, social.notes.map((n) => noteCard(n, social.isOwner ? del(n) : null))));
    if (!social.isOwner && !social.notes_off) {
      if (!user) parts.push(h("p", { class: "faint" }, h("a", { href: "/login", "data-nav": "" }, "Log in"), " to leave a kind note."));
      else {
        const ta = h("textarea", { maxlength: 280, rows: 2, placeholder: `Say something nice to ${p.display_name}…`, "aria-label": "Your note" });
        const signed = h("input", { type: "checkbox", checked: true });
        const send = h("button", { type: "button", class: "btn small gold" }, "Send");
        send.addEventListener("click", async () => {
          if (ta.value.trim().length < 2) return ta.focus();
          send.disabled = true;
          try { await pb.send("/api/vc/notes", { method: "POST", body: { slug: p.slug, text: ta.value.trim(), signed: signed.checked } }); toast(`Sent! It shows up once ${p.display_name} OKs it.`); refresh(); }
          catch (err) { toast(errMsg(err), true); send.disabled = false; }
        });
        parts.push(h("div", { class: "note-form" }, ta, h("div", { class: "note-foot" }, h("label", { class: "check" }, signed, "Sign with my name"), send)));
        if (social.minePending.length) parts.push(h("p", { class: "faint" }, `You have ${social.minePending.length} note${social.minePending.length > 1 ? "s" : ""} waiting for ${p.display_name}'s OK.`));
      }
    }
    if (!parts.length) return null;
    return h("section", { class: "prose kind-words" }, h("h2", {}, "Kind words"), ...parts);
  }
  const isKJ = (u) => /jay-hosting\.github\.io\/kink-jars/i.test(u || "");
  async function compatSection(p, holder) {
    const K = window.KinkJarsImport, user = me();
    if (!K || !user || user.id === p.id || p.matches_off) return;
    const theirs = (p.play_links || []).find((l) => isKJ(l.url));
    if (!theirs) return;
    const mine = (user.play_links || []).find((l) => isKJ(l.url));
    if (!mine) {
      holder.replaceChildren(h("section", { class: "compat nudge" }, h("p", {}, "💞 Add your Kink Jars shelf in your ", h("a", { href: "/edit#playroom", "data-nav": "" }, "Playroom tab"), ` to see what you and ${p.display_name} have in common.`)));
      return;
    }
    holder.replaceChildren(h("section", { class: "compat" }, h("p", { class: "faint" }, "Comparing shelves…")));
    try {
      const [a, b] = await Promise.all([K.resolve(mine.url), K.resolve(theirs.url)]);
      const c = K.compare(a, b);
      const total = c.love.length + c.enjoy.length + c.curious.length;
      const rows = [];
      if (c.love.length) rows.push(h("div", { class: "tag-group" }, h("h3", { class: "tag-label" }, "💞 You both love"), tagRow(c.love, { max: 8, rotate: true, cls: "tag-love" })));
      if (c.enjoy.length) rows.push(h("div", { class: "tag-group" }, h("h3", { class: "tag-label" }, "😊 You both enjoy"), tagRow(c.enjoy, { max: 6, rotate: true, cls: "tag-enjoy" })));
      if (c.curious.length) rows.push(h("div", { class: "tag-group" }, h("h3", { class: "tag-label" }, "🤔 Curious together"), tagRow(c.curious, { max: 6, rotate: true, cls: "tag-curious" })));
      if (c.heads.length) rows.push(h("div", { class: "tag-group" }, h("h3", { class: "tag-label" }, "⚠️ You're into it, it's on their limits"), tagRow(c.heads, { max: 6, rotate: false, cls: "tag-limit" })));
      holder.replaceChildren(h("section", { class: "compat" },
        h("h2", {}, `You & ${p.display_name}`),
        h("p", { class: "faint" }, total ? `${total} things in common on your Kink Jars shelves. A conversation starter, not a promise: always ask first.` : "No overlaps on your shelves yet. Plenty to talk about anyway!"),
        ...rows));
    } catch (err) {
      holder.replaceChildren(h("section", { class: "compat" }, h("p", { class: "faint" }, "Couldn't compare shelves right now: " + (err.message || "try again later"))));
    }
  }

  // ---------- shareable profile card (image) ----------
  async function openCard(p) {
    if (!window.VCCard) return;
    const look = L.resolve(p.style, p.theme);
    const into = parseTags(p.into);
    const loveGroup = into && into.groups ? (into.groups.find((g) => /love/i.test(g.label || "")) || into.groups[0]) : null;
    const ask = (p.prompts || []).find((x) => x && x.a);
    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Profile card" });
    const close = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const box = h("div", { class: "modal-box" }, h("p", { class: "faint" }, "Drawing your card…"));
    modal.append(box); document.body.append(modal);
    const cv = await window.VCCard.draw({
      name: p.display_name,
      mood: [look.mood_emoji, look.mood_text].filter(Boolean).join(" "),
      looking: LOOKING.filter(([v]) => (p.looking_for || []).includes(v)).map(([, e, l]) => [e, l]),
      loves: loveGroup ? loveGroup.items : [],
      ask: ask ? { q: ask.q, a: ask.a } : null,
      url: profileUrl(p.slug),
      avatarUrl: p.avatar ? fileUrl(p, p.avatar, "600x600") : "",
      charm: (L.CHARMS.find((c) => c.id === look.charm) || {}).e || "",
      look,
    });
    let dataUrl = "";
    try { dataUrl = cv.toDataURL("image/png"); } catch { box.replaceChildren(h("p", {}, "Couldn't draw the card. Try again in a moment."), h("button", { class: "btn", onclick: close }, "Close")); return; }
    const copyImg = h("button", { type: "button", class: "btn gold" }, "Copy image");
    copyImg.addEventListener("click", async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": new Promise((res) => cv.toBlob(res, "image/png")) })]);
        toast("🖼️ Card copied! Paste it in Telegram.");
      } catch { toast("Your browser can't copy images. Use Download instead.", true); }
    });
    box.replaceChildren(
      h("img", { class: "card-preview", src: dataUrl, alt: "Your profile card" }),
      h("div", { class: "actions", style: "justify-content:center" },
        copyImg,
        h("a", { class: "btn", href: dataUrl, download: `velvet-collar-${p.slug}.png` }, "Download"),
        h("button", { type: "button", class: "btn", onclick: () => copyPost(p, !!me() && me().id === p.id) }, "📣 Copy post text"),
        h("button", { type: "button", class: "btn ghost", onclick: close }, "Close")),
      h("p", { class: "faint", style: "text-align:center;margin:0" }, "Tip: paste the image in Telegram, then paste the post text as its caption."));
  }

  // ---------- profile view ----------
  async function renderProfile(slug) {
    if (!slug || RESERVED.includes(slug)) return notFound();
    let data;
    try {
      data = await pb.send("/api/vc/profile/" + encodeURIComponent(slug), { method: "GET" });
    } catch (err) {
      if (err.status === 404) return notFound();
      throw err;
    }
    const p = data.profile;
    const photos = data.photos || [];
    const look = setLook(p.style, p.theme, true);
    document.title = `${p.display_name} · Velvet Collar`;
    // Older profiles kept jars separately; show them as ordinary links.
    const links = [...(p.jars || []), ...(p.links || [])].filter((l) => safeUrl(l.url));
    const plays = (p.play_links || []).filter((l) => safeUrl(l.url));
    // Match each game link to a hosted game so it gets that game's emoji.
    let games = [];
    if (plays.length) { try { games = await pb.collection("games").getFullList({ fields: "url,emoji,title" }); } catch {} }
    const gameFor = (u) => games.find((g) => { try { const a = new URL(g.url), b = new URL(u); return a.host === b.host && b.pathname.startsWith(a.pathname.replace(/\/$/, "")); } catch { return false; } });
    const tgUser = p.tg_username ? p.tg_username.replace(/^@/, "") : "";

    const reactHolder = h("div", { class: "react-holder" });
    const head = h("div", { class: "profile-card" },
      h("div", { class: "banner" }),
      h("div", { class: "profile-head" },
        avatarWithCharm(p, look.charm),
        h("h1", { class: "profile-name" }, p.display_name),
        tgUser ? h("div", { class: "handle" }, "@" + tgUser) : null,
        lookingBadges(p.looking_for),
        look.mood_emoji || look.mood_text ? h("div", { class: "mood" }, look.mood_emoji ? h("span", { class: "em" }, look.mood_emoji) : null, look.mood_text) : null,
        h("div", { class: "chips" },
          p.pronouns ? h("span", { class: "chip" }, p.pronouns) : null,
          p.dynamic ? h("span", { class: "chip gold" }, p.dynamic) : null,
          p.location ? h("span", { class: "chip" }, p.location) : null,
          null),
        badgeRow(badgesFor(p, photos.length)),
        h("div", { class: "actions" },
          data.isOwner ? [h("a", { class: "btn gold", href: "/edit", "data-nav": "" }, "Edit my page"), h("button", { class: "btn", onclick: () => openCard(p) }, "🖼️ Profile card")]
            : tgUser ? h("a", { class: "btn gold", href: "https://t.me/" + encodeURIComponent(tgUser), target: "_blank", rel: "noopener" }, "Message on Telegram") : null,
          h("button", { class: "btn", onclick: () => copyPost(p, data.isOwner), title: "Copies a fun post with your link, ready to paste in Telegram" }, "📣 Share in Telegram"),
          h("button", { class: "btn ghost", onclick: () => copy(profileUrl(p.slug)) }, "Copy link")),
        reactHolder));

    const blocks = [];
    blocks.push(head);

    // Side column: the things people open a profile for. First on phones, beside the text on desktop.
    const side = [];
    if (plays.length) {
      side.push(h("section", { class: "keyring playroom" },
        h("h2", {}, "Playroom"),
        h("div", { class: "key-list" }, plays.map((l) => {
          const g = gameFor(l.url);
          return h("a", { class: "key", href: safeUrl(l.url), target: "_blank", rel: "noopener nofollow" },
            h("span", { class: "mono emoji", "aria-hidden": "true" }, (g && g.emoji) || "🎲"),
            h("span", { class: "txt" }, h("b", {}, l.title || (g && g.title) || hostOf(l.url)), h("small", {}, g ? g.title : hostOf(l.url))),
            h("span", { class: "ext", "aria-hidden": "true" }, "↗"));
        }))));
    }
    if (links.length) {
      side.push(h("section", { class: "keyring" },
        h("h2", {}, "Links"),
        h("div", { class: "key-list" }, links.map((l) => {
          const label = l.title || hostOf(l.url);
          return h("a", { class: "key", href: safeUrl(l.url), target: "_blank", rel: "noopener nofollow" },
            h("span", { class: "mono", "aria-hidden": "true" }, label.slice(0, 2).toUpperCase()),
            h("span", { class: "txt" }, h("b", {}, label), h("small", {}, hostOf(l.url))),
            h("span", { class: "ext", "aria-hidden": "true" }, "↗"));
        }))));
    }

    const main = [];
    const compatHolder = h("div", {});
    main.push(compatHolder);
    if (p.bio) main.push(h("section", { class: "prose" }, h("h2", {}, "About"), h("p", { class: "bio" }, p.bio)));
    const prompts = (p.prompts || []).filter((x) => x && x.q && x.a);
    if (prompts.length) {
      main.push(h("section", { class: "prose" }, h("h2", {}, "Ask me about"),
        h("div", { class: "prompt-cards" }, prompts.map((x, i) =>
          h("div", { class: "prompt-card", style: `--tilt:${[-1.2, 0.9, -0.6, 1.1][i % 4]}deg` }, h("span", { class: "pq" }, x.q), h("p", { class: "pa" }, x.a))))));
    }
    if (p.into || p.limits) {
      main.push(h("div", { class: "into-limits" },
        intoSection(p.into),
        limitsSection(p.limits)));
    }
    const care = p.care || {};
    const REPLY = { minutes: "within minutes", hours: "within a few hours", day: "within a day", days: "in a few days" };
    if (care.approach || care.checkins || care.aftercare || care.reply) {
      main.push(h("section", { class: "care-card" },
        h("h2", {}, "Care & communication"),
        h("dl", {},
          care.approach ? [h("dt", {}, "How to approach me"), h("dd", {}, care.approach)] : null,
          care.checkins ? [h("dt", {}, "How I like to check in"), h("dd", {}, care.checkins)] : null,
          care.aftercare ? [h("dt", {}, "Aftercare I need"), h("dd", {}, care.aftercare)] : null,
          care.reply ? [h("dt", {}, "I usually reply"), h("dd", {}, REPLY[care.reply])] : null)));
    }
    if (photos.length) main.push(gallerySection(photos));
    const notesHolder = h("div", {});
    main.push(notesHolder);

    if (!side.length && main.length === 2) {
      main.splice(1, 0, h("p", { class: "center-msg muted" }, data.isOwner ? "Your page is empty so far. Add your links and photos from Edit." : "Nothing here yet."));
    }
    blocks.push(h("div", { class: "profile-body" + (side.length ? "" : " no-side") },
      side.length ? h("aside", { class: "side" }, side) : null,
      h("div", { class: "main" }, main)));
    app.replaceChildren(...blocks);

    // re-render reactions with fresh counts after each tap
    const drawReactions = (social) => reactHolder.replaceChildren(reactionBar(p, social, drawReactions) || "");
    (async () => {
      try {
        const social = await pb.send("/api/vc/social/" + encodeURIComponent(p.slug), {});
        drawReactions(social);
        notesHolder.replaceChildren(notesSection(p, social, refreshNotes) || "");
      } catch {}
    })();
    async function refreshNotes() {
      try { const social = await pb.send("/api/vc/social/" + encodeURIComponent(p.slug), {}); drawReactions(social); notesHolder.replaceChildren(notesSection(p, social, refreshNotes) || ""); } catch {}
    }
    compatSection(p, compatHolder);
  }

  function gallerySection(photos) {
    const anyNsfw = photos.some((x) => x.nsfw);
    const grid = h("div", { class: "gallery" });
    const tiles = photos.map((ph, i) => {
      const tile = h("button", { class: "ph" + (ph.nsfw ? " nsfw" : ""), type: "button", "aria-label": ph.nsfw ? "NSFW photo, tap to reveal" : (ph.caption || "Photo " + (i + 1)) },
        h("img", { src: fileUrl(ph, ph.image, "400x400"), alt: ph.caption || "", loading: "lazy" }),
        ph.nsfw ? h("div", { class: "veil" }, h("span", {}, "NSFW · TAP TO SHOW")) : null);
      tile.addEventListener("click", () => {
        if (ph.nsfw && !tile.classList.contains("revealed")) { tile.classList.add("revealed"); return; }
        openLightbox(fileUrl(ph, ph.image, "1200x0"), ph.caption);
      });
      grid.append(tile);
      return tile;
    });
    let shown = false;
    const toggle = anyNsfw ? h("button", { class: "btn small", type: "button", onclick: (e) => {
      shown = !shown;
      tiles.forEach((t) => t.classList.contains("nsfw") && t.classList.toggle("revealed", shown));
      e.currentTarget.textContent = shown ? "Blur NSFW" : "Show all NSFW";
    } }, "Show all NSFW") : null;
    return h("section", { class: "prose photos" },
      h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "Photos"), toggle),
      grid);
  }

  function openLightbox(src, cap) {
    const lb = document.getElementById("lightbox");
    document.getElementById("lbImg").src = src;
    document.getElementById("lbCap").textContent = cap || "";
    lb.classList.add("open");
  }
  document.getElementById("lbClose").addEventListener("click", () => document.getElementById("lightbox").classList.remove("open"));
  document.getElementById("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") e.currentTarget.classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("lightbox").classList.remove("open"); });

  function notFound() {
    document.title = "Not found · Velvet Collar";
    app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "No profile here"), h("p", { class: "muted" }, "That link doesn't match anyone's page."), h("a", { class: "btn", href: "/", "data-nav": "" }, "Go home")));
  }

  // ---------- editor ----------
  async function renderEditor() {
    document.title = "Edit profile · Velvet Collar";
    const rec = await pb.collection("members").getOne(me().id);
    setLook(rec.style, rec.theme, false);
    let photos = await pb.collection("photos").getFullList({ filter: pb.filter("owner = {:id}", { id: rec.id }), sort: "sort,created" });
    let avatarFile = null, removeAvatar = false;

    const input = (name, attrs = {}) => h("input", Object.assign({ type: "text", id: "f_" + name, name, value: rec[name] || "" }, attrs));
    const area = (name, attrs = {}) => { const t = h("textarea", Object.assign({ id: "f_" + name, name }, attrs)); t.value = rec[name] || ""; return t; };
    const field = (label, control, hint, full) => h("div", { class: "field" + (full ? " full" : "") }, h("label", { for: control.id }, label), control, hint ? h("span", { class: "hint" }, hint) : null);

    // avatar
    const avWrap = h("div", {}, avatarEl(rec));
    const avInput = h("input", { type: "file", accept: "image/*", class: "sr", id: "avatarInput" });
    avInput.addEventListener("change", () => {
      const f = avInput.files[0]; if (!f) return;
      avatarFile = f; removeAvatar = false;
      avWrap.replaceChildren(h("img", { class: "avatar", src: URL.createObjectURL(f), alt: "" }));
      refreshLook();
    });
    const avatarBox = h("div", { class: "avatar-edit" }, avWrap,
      h("div", { class: "actions", style: "margin:0" },
        h("label", { class: "btn small", for: "avatarInput" }, "Upload photo"), avInput,
        h("button", { class: "btn small ghost", type: "button", onclick: () => { avatarFile = null; removeAvatar = true; avWrap.replaceChildren(avatarEl({ display_name: nameI.value })); refreshLook(); } }, "Remove")));

    // basics
    const nameI = input("display_name", { maxlength: 60, required: true });
    const slugI = input("slug", { maxlength: 32, autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const slugStatus = h("span", { class: "status" });
    let slugOk = true, slugTimer;
    slugI.addEventListener("input", () => {
      slugI.value = slugI.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      clearTimeout(slugTimer);
      slugStatus.className = "status"; slugStatus.textContent = "Checking…";
      slugTimer = setTimeout(async () => {
        const v = slugI.value;
        if (v === rec.slug) { slugOk = true; slugStatus.textContent = ""; return; }
        const res = await pb.send("/api/vc/slug-available?slug=" + encodeURIComponent(v), {});
        slugOk = res.available;
        slugStatus.className = "status " + (slugOk ? "ok" : "bad");
        slugStatus.textContent = !res.valid ? "3–32 letters, numbers, - or _" : slugOk ? "Available" : "Already taken";
      }, 350);
    });
    const slugField = h("div", { class: "field full" },
      h("label", { for: "f_slug" }, "Your link"),
      h("div", { class: "slug-row" }, h("span", {}, location.host + "/"), slugI),
      slugStatus,
      h("span", { class: "hint" }, "This is also your login name. If you change it, log in with the new one."),
      h("div", { class: "actions", style: "margin-top:6px" },
        h("button", { class: "btn small", type: "button", onclick: () => copy(profileUrl(rec.slug)) }, "Copy my link"),
        h("button", { class: "btn small", type: "button", onclick: () => copyPost(rec, true) }, "📣 Copy a Telegram post"),
        h("button", { class: "btn small", type: "button", onclick: () => openCard(rec) }, "🖼️ Profile card"),
        h("a", { class: "btn small ghost", href: "/" + rec.slug, "data-nav": "" }, "View my page")),
      h("span", { class: "hint" }, "Paste your link into your Telegram bio so people can find your page."));

    // "Looking for" picker
    let lookingSel = (rec.looking_for || []).slice();
    const lookingPills = h("div", { class: "pills", role: "group", "aria-label": "Looking for" });
    function drawLooking() {
      lookingPills.replaceChildren(...LOOKING.map(([v, e, label]) =>
        h("button", { type: "button", class: "pill lk-pill", "aria-pressed": String(lookingSel.includes(v)), onclick: () => {
          if (SOLO.includes(v)) lookingSel = lookingSel.includes(v) ? [] : [v];
          else { lookingSel = lookingSel.filter((x) => !SOLO.includes(x)); lookingSel = lookingSel.includes(v) ? lookingSel.filter((x) => x !== v) : lookingSel.concat(v); }
          drawLooking();
        } }, h("span", { "aria-hidden": "true" }, e), label)));
    }
    drawLooking();
    const lookingField = h("div", { class: "field full" },
      h("span", { class: "label" }, "What you're looking for right now"),
      lookingPills,
      h("span", { class: "hint" }, "Shown right under your name. Pick any that fit, or Open to anything, and change it whenever things change."));

    // member list opt-in
    const listedBox = h("input", { type: "checkbox", checked: !!rec.listed });
    const reactBox = h("input", { type: "checkbox", checked: !rec.reactions_off });
    const notesBox = h("input", { type: "checkbox", checked: !rec.notes_off });
    const matchBox = h("input", { type: "checkbox", checked: !rec.matches_off });

    // ---------- look settings (Settings tab) ----------
    let look = L.resolve(rec.style, rec.theme);
    const valOf = (id, fallback) => { const el = document.getElementById(id); return (el && el.value.trim()) || fallback; };
    const pvAvatar = h("div", {});
    const pvName = h("div", { class: "profile-name" });
    const pvMood = h("div", { class: "mood" });
    const pvChips = h("div", { class: "chips" });
    const preview = h("div", { class: "preview" },
      h("div", { class: "banner" }),
      h("div", { class: "profile-head" }, pvAvatar, pvName, pvMood, pvChips,
        h("div", { class: "key-list", style: "margin-top:12px" },
          h("div", { class: "key" }, h("span", { class: "mono", "aria-hidden": "true" }, "FE"),
            h("span", { class: "txt" }, h("b", {}, "One of your links"), h("small", {}, "fetlife.com")))),
        h("div", { class: "actions" }, h("span", { class: "btn gold small" }, "Message on Telegram"))));

    const colorInputs = {};
    function refreshLook() {
      L.apply(look, document.documentElement);
      L.apply(look, preview);
      L.particles(preview, look.particles, false);
      pvName.textContent = (nameI.value || "").trim() || "Your name";
      const av = avatarFile ? h("img", { class: "avatar", src: URL.createObjectURL(avatarFile), alt: "" })
        : avatarEl(removeAvatar ? { display_name: nameI.value } : Object.assign({}, rec, { display_name: nameI.value }));
      const charmE = (L.CHARMS.find((c) => c.id === look.charm) || {}).e;
      pvAvatar.replaceChildren(charmE ? h("div", { class: "avatar-wrap" }, av, h("span", { class: "charm", "aria-hidden": "true" }, h("span", { class: "charm-loop" }), h("span", { class: "charm-tag" }, charmE))) : av);
      pvMood.hidden = !(look.mood_emoji || look.mood_text);
      pvMood.replaceChildren(look.mood_emoji ? h("span", { class: "em" }, look.mood_emoji) : "", look.mood_text || "");
      pvChips.replaceChildren(
        h("span", { class: "chip gold" }, valOf("f_dynamic", "Your dynamic")),
        h("span", { class: "chip" }, valOf("f_pronouns", "pronouns")));
      document.querySelectorAll("[data-look]").forEach((b) => b.setAttribute("aria-pressed", String(look[b.dataset.look] === b.dataset.val)));
      document.querySelectorAll(".pv[data-pat]").forEach((sw) => {
        const pat = L.patternCss(sw.dataset.pat, look.accent);
        sw.style.backgroundImage = pat.img;
        sw.style.backgroundSize = pat.size === "auto" ? "auto" : pat.size.split(" ").map((v) => parseInt(v, 10) / 2.5 + "px").join(" ");
      });
      for (const k in colorInputs) colorInputs[k].value = look[k];
    }

    const pills = (key, list, decorate) => h("div", { class: "pills", role: "group" }, list.map((o) =>
      h("button", { type: "button", class: "pill", "data-look": key, "data-val": o.id, "aria-pressed": "false",
        onclick: () => { look[key] = o.id; refreshLook(); } }, decorate ? decorate(o) : null, o.name)));

    const paletteGrid = h("div", { class: "pal-grid" }, L.PALETTES.map((pal) =>
      h("button", { type: "button", class: "pal", "data-look": "palette", "data-val": pal.id, "aria-pressed": "false",
        onclick: () => { Object.assign(look, { palette: pal.id, deep: pal.deep, mid: pal.mid, glow: pal.glow, accent: pal.accent }); refreshLook(); } },
        h("span", { class: "sw", style: `background:linear-gradient(120deg, ${pal.deep}, ${pal.mid} 45%, ${pal.glow})` }, h("i", { style: `background:${pal.accent}` })),
        h("b", {}, pal.name))));

    const COLOR_FIELDS = [
      ["deep", "Deep velvet", "the background"], ["mid", "Plush middle", "the banner"],
      ["glow", "Glow", "banner shine"], ["accent", "Shiny bits", "buttons, ring, sparkles"],
    ];
    const colorGrid = h("div", { class: "colors" }, COLOR_FIELDS.map(([k, label, hint]) => {
      const inp = h("input", { type: "color", value: look[k], "aria-label": label });
      inp.addEventListener("input", () => { look[k] = inp.value; look.palette = "custom"; refreshLook(); });
      colorInputs[k] = inp;
      return h("label", { class: "color-field" }, inp, h("span", {}, h("b", {}, label), h("small", {}, hint)));
    }));

    const QUIPS = ["Ooh, fancy.", "Very you.", "Chaos, but make it cute.", "The velvet has spoken.", "Bold choice. Love it.", "Someone's feeling frisky.", "Serving looks."];
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const surprise = () => {
      const pal = rand(L.PALETTES);
      Object.assign(look, { palette: pal.id, deep: pal.deep, mid: pal.mid, glow: pal.glow, accent: pal.accent,
        pattern: rand(L.PATTERNS.slice(1)).id, ring: rand(L.RINGS).id, font: rand(L.FONTS).id,
        particles: rand(L.PARTICLES).id, corners: rand(L.CORNERS).id });
      refreshLook();
      toast("🎲 " + rand(QUIPS));
    };
    const resetLook = () => {
      look = Object.assign(L.resolve({}), { mood_emoji: look.mood_emoji, mood_text: look.mood_text });
      refreshLook();
      toast("Back to the original velvet");
    };

    const moodText = h("input", { type: "text", maxlength: 40, value: look.mood_text, placeholder: "feeling bratty, approach with snacks", "aria-label": "Mood text" });
    moodText.addEventListener("input", () => { look.mood_text = moodText.value; refreshLook(); });
    const moodRow = h("div", { class: "emoji-row", role: "group", "aria-label": "Mood emoji" },
      h("button", { type: "button", class: "emoji", "data-look": "mood_emoji", "data-val": "", "aria-label": "No emoji", onclick: () => { look.mood_emoji = ""; refreshLook(); } }, "∅"),
      L.MOODS.map((em) => h("button", { type: "button", class: "emoji", "data-look": "mood_emoji", "data-val": em, onclick: () => { look.mood_emoji = em; refreshLook(); } }, em)));

    const fontPreview = (f) => h("span", { style: `font-family:${f.family};font-size:1.05rem` }, "Aa");
    const patternPreview = (pt) => h("span", { class: "pv", "data-pat": pt.id });

    function passwordForm() {
      const oldIn = h("input", { type: "password", autocomplete: "current-password", "aria-label": "Current password", placeholder: "Current password" });
      const newIn = h("input", { type: "password", autocomplete: "new-password", minlength: 8, "aria-label": "New password", placeholder: "New password (8+ characters)" });
      const btn = h("button", { class: "btn small", type: "submit" }, "Change password");
      const f = h("form", { class: "pw-form" }, h("span", { class: "label" }, "Password"), oldIn, newIn, btn);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (newIn.value.length < 8) return toast("New password needs 8+ characters", true);
        btn.disabled = true;
        try {
          await pb.collection("members").update(rec.id, { oldPassword: oldIn.value, password: newIn.value, passwordConfirm: newIn.value });
          await pb.collection("members").authWithPassword(rec.slug, newIn.value); // changing it signs out old sessions
          oldIn.value = newIn.value = "";
          toast("Password changed");
        } catch (err) {
          const d = err.response && err.response.data;
          toast(d && d.oldPassword ? "Current password isn't right" : errMsg(err), true);
        } finally { btn.disabled = false; }
      });
      return f;
    }

    const settingsTab = h("div", { class: "settings-layout" },
      h("div", {},
        h("section", { class: "panel" },
          h("h2", {}, "Colours"),
          h("div", { class: "subhead" }, "Pick a palette", h("small", {}, "or let fate decide")),
          h("div", { class: "actions", style: "margin:0 0 12px" },
            h("button", { type: "button", class: "btn small gold surprise", onclick: surprise }, "🎲 Surprise me"),
            h("button", { type: "button", class: "btn small ghost", onclick: resetLook }, "Reset")),
          paletteGrid,
          h("div", { class: "subhead" }, "Mix your own", h("small", {}, "tap a circle")),
          colorGrid),
        h("section", { class: "panel" },
          h("h2", {}, "Little touches"),
          h("div", { class: "subhead" }, "Banner pattern"), pills("pattern", L.PATTERNS, patternPreview),
          h("div", { class: "subhead" }, "Avatar ring"), pills("ring", L.RINGS),
          h("div", { class: "subhead" }, "Name font"), pills("font", L.FONTS, fontPreview),
          h("div", { class: "subhead" }, "Floaty things", h("small", {}, "drift across your page")), pills("particles", L.PARTICLES),
          h("div", { class: "subhead" }, "Collar charm", h("small", {}, "hangs off your photo")), pills("charm", L.CHARMS, (c) => c.e ? h("span", { "aria-hidden": "true" }, c.e) : null),
          h("div", { class: "subhead" }, "Corners"), pills("corners", L.CORNERS)),
        h("section", { class: "panel" },
          h("h2", {}, "Mood sticker"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "A little note under your name. Change it whenever the mood strikes."),
          moodRow, moodText),
        h("section", { class: "panel" }, h("h2", {}, "Privacy"),
          h("div", { class: "form-grid" },
            h("div", { class: "field full" },
              h("p", { class: "muted", style: "margin:0" }, "Anyone you share your link with can see your page. It isn't searchable on the web."),
              h("label", { class: "check", style: "margin-top:8px" }, listedBox, "Put me on the member list"),
              h("span", { class: "hint" }, "Logged-in members can browse the list. Leave it off and people only find you through your link.")),
            h("div", { class: "field full" },
              h("span", { class: "label" }, "On my page"),
              h("label", { class: "check" }, reactBox, "Let members leave reactions (🔥 💜 🐾 ✨, always anonymous)"),
              h("label", { class: "check" }, notesBox, "Let members leave kind notes (you OK each one first)"),
              h("label", { class: "check" }, matchBox, "Show logged-in members what we have in common on Kink Jars")))),
        h("section", { class: "panel" }, h("h2", {}, "Account"),
          passwordForm(),
          h("div", { class: "actions", style: "margin:16px 0 0" },
            h("button", { class: "btn", type: "button", onclick: () => { pb.authStore.clear(); go("/"); } }, "Log out"),
            h("button", { class: "btn danger", type: "button", onclick: async () => {
              const typed = prompt("This deletes your profile and all your photos. Type DELETE to confirm.");
              if (typed !== "DELETE") return;
              try { await pb.collection("members").delete(rec.id); pb.authStore.clear(); toast("Profile deleted"); go("/"); }
              catch (err) { toast(errMsg(err), true); }
            } }, "Delete my profile")))),
      h("aside", { class: "preview-col" }, h("p", { class: "preview-label" }, "Live preview"), preview));

    // repeatable lists
    function listEditor(items, titlePh, urlPh, max, presets) {
      const rows = h("div", { class: "rows" });
      const add = (it = {}) => {
        if (rows.children.length >= max) return toast(`Up to ${max} items`, true);
        const t = h("input", { type: "text", placeholder: titlePh, value: it.title || "", maxlength: 80, "aria-label": "Name" });
        const u = h("input", { type: "url", placeholder: urlPh, value: it.url || "", inputmode: "url", "aria-label": "Link" });
        const row = h("div", { class: "row" }, t, u, h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Remove", onclick: () => row.remove() }, "✕"));
        rows.append(row);
        return { t, u };
      };
      (items || []).forEach(add);
      const wrap = h("div", {}, rows,
        h("button", { type: "button", class: "btn small", onclick: () => { const r = add(); r && r.t.focus(); } }, "+ Add"),
        presets ? h("div", { class: "presets" }, presets.map(([label, url]) =>
          h("button", { type: "button", class: "btn small ghost", onclick: () => { const r = add({ title: label, url }); if (r) { r.u.focus(); r.u.setSelectionRange(url.length, url.length); } } }, "+ " + label))) : null);
      wrap.add = add;
      wrap.read = () => [...rows.children].map((r) => {
        const [t, u] = r.querySelectorAll("input");
        return { title: t.value.trim(), url: u.value.trim() };
      }).filter((x) => x.url);
      return wrap;
    }
    const linksEd = listEditor([...(rec.jars || []), ...(rec.links || [])], "Name (FetLife, wishlist…)", "https://…", 40, LINK_PRESETS);
    // ---------- Playroom: each hosted game gets a box for the member's own share link ----------
    const playOriginal = (rec.play_links || []).filter((l) => l && l.url);
    let gameRows = null;     // [{ title, input }] once the games have loaded
    let otherEd = null;      // links for games we don't host
    const otherHolder = h("div", {});
    const matchesGame = (gameUrl, u) => {
      try { const a = new URL(gameUrl), b = new URL(u); return a.host === b.host && b.pathname.toLowerCase().startsWith(a.pathname.replace(/\/$/, "").toLowerCase()); }
      catch { return false; }
    };
    function readPlayLinks() {
      if (!gameRows) return playOriginal;
      const out = [];
      for (const r of gameRows) { const v = r.input.value.trim(); if (v) out.push({ title: r.title, url: v }); }
      return out.concat(otherEd ? otherEd.read() : []);
    }

    // photos
    const photoGrid = h("div", { class: "ph-edit" });
    const newNsfw = h("input", { type: "checkbox", checked: true });
    const phInput = h("input", { type: "file", accept: "image/*", multiple: true, class: "sr", id: "photoInput" });
    phInput.addEventListener("change", async () => {
      const files = [...phInput.files]; phInput.value = "";
      for (const f of files) {
        if (photos.length >= 30) { toast("Galleries are limited to 30 photos", true); break; }
        try {
          toast("Uploading " + f.name + "…");
          const fd = new FormData();
          fd.append("owner", rec.id); fd.append("image", f); fd.append("nsfw", newNsfw.checked ? "true" : "false");
          fd.append("sort", String(photos.length));
          photos.push(await pb.collection("photos").create(fd));
          drawPhotos();
        } catch (err) { toast(errMsg(err), true); }
      }
      toast("Photos saved");
    });
    function drawPhotos() {
      photoGrid.replaceChildren(
        ...photos.map((ph, i) => {
          const cap = h("input", { type: "text", placeholder: "Caption (optional)", value: ph.caption || "", maxlength: 200, "aria-label": "Caption" });
          cap.addEventListener("change", async () => { try { photos[i] = await pb.collection("photos").update(ph.id, { caption: cap.value }); toast("Caption saved"); } catch (err) { toast(errMsg(err), true); } });
          const nsfw = h("input", { type: "checkbox", checked: !!ph.nsfw });
          nsfw.addEventListener("change", async () => { try { photos[i] = await pb.collection("photos").update(ph.id, { nsfw: nsfw.checked }); toast(nsfw.checked ? "Marked NSFW" : "Marked SFW"); } catch (err) { toast(errMsg(err), true); } });
          const move = async (dir) => {
            const j = i + dir; if (j < 0 || j >= photos.length) return;
            [photos[i], photos[j]] = [photos[j], photos[i]];
            drawPhotos();
            try { await Promise.all(photos.map((p, k) => p.sort === k ? null : pb.collection("photos").update(p.id, { sort: k }).then((r) => (photos[k] = r)))); }
            catch (err) { toast(errMsg(err), true); }
          };
          return h("div", { class: "ph-card" },
            h("img", { src: fileUrl(ph, ph.image, "400x400"), alt: ph.caption || "" }),
            h("div", { class: "ctl" }, cap,
              h("div", { class: "line" },
                h("label", { class: "check" }, nsfw, "NSFW"),
                h("span", {},
                  h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Move earlier", onclick: () => move(-1) }, "←"),
                  h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Move later", onclick: () => move(1) }, "→"),
                  h("button", { type: "button", class: "btn iconbtn danger", "aria-label": "Delete photo", onclick: async () => {
                    if (!confirm("Delete this photo?")) return;
                    try { await pb.collection("photos").delete(ph.id); photos = photos.filter((x) => x.id !== ph.id); drawPhotos(); toast("Photo deleted"); }
                    catch (err) { toast(errMsg(err), true); }
                  } }, "🗑")))));
        }),
        h("label", { class: "upload", for: "photoInput" }, h("span", {}, h("b", {}, "+ Add photos"), h("br"), h("small", {}, "JPG, PNG, WebP or GIF, up to 12 MB"))),
      );
    }
    drawPhotos();

    // save
    const saveBtn = h("button", { class: "btn gold", type: "button" }, "Save profile");
    saveBtn.addEventListener("click", async () => {
      if (!nameI.value.trim()) return toast("Add a display name", true);
      if (!slugOk) return toast("Pick a different link name", true);
      const bad = [...linksEd.read(), ...readPlayLinks()].find((x) => !safeUrl(x.url));
      if (bad) return toast(`"${bad.url}" needs to start with https://`, true);
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      try {
        const fd = new FormData();
        fd.append("display_name", nameI.value.trim());
        fd.append("slug", slugI.value.trim());
        for (const k of ["pronouns", "dynamic", "location", "bio", "into", "limits"]) fd.append(k, document.getElementById("f_" + k).value.trim());
        fd.append("tg_username", document.getElementById("f_tg_username").value.trim().replace(/^@/, ""));
        fd.append("style", JSON.stringify(look));
        fd.append("listed", listedBox.checked ? "true" : "false");
        fd.append("reactions_off", reactBox.checked ? "false" : "true");
        fd.append("notes_off", notesBox.checked ? "false" : "true");
        fd.append("matches_off", matchBox.checked ? "false" : "true");
        if (lookingSel.length) lookingSel.forEach((v) => fd.append("looking_for", v)); else fd.append("looking_for", "");
        fd.append("jars", "[]"); // jars now live in links
        fd.append("links", JSON.stringify(linksEd.read()));
        fd.append("play_links", JSON.stringify(readPlayLinks()));
        fd.append("prompts", JSON.stringify(readPrompts()));
        fd.append("care", JSON.stringify(readCare()));
        if (avatarFile) fd.append("avatar", avatarFile);
        else if (removeAvatar) fd.append("avatar", "");
        const updated = await pb.collection("members").update(rec.id, fd);
        pb.authStore.save(pb.authStore.token, updated);
        Object.assign(rec, updated);
        avatarFile = null; removeAvatar = false;
        toast("Saved");
        renderNav();
      } catch (err) {
        toast(errMsg(err), true);
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = "Save profile";
      }
    });

    // ---------- ask-me-about cards ----------
    const PROMPTS = ["Ask me about…", "My green flags", "My ideal aftercare", "A perfect first meet", "Currently obsessed with",
      "You'll win me over with", "My love language", "Don't be surprised if I…", "Favourite toy or tool", "A scene I'd love to try",
      "Best way to start a chat with me", "My hot take"];
    const promptRows = h("div", { class: "prompt-rows" });
    function addPrompt(q, a) {
      if (promptRows.children.length >= 4) return toast("Up to 4 cards", true);
      const sel = h("select", { "aria-label": "Question" }, PROMPTS.map((x) => h("option", { value: x, selected: x === q }, x)));
      const ans = h("textarea", { maxlength: 220, rows: 2, placeholder: "Your answer (a sentence or two)", "aria-label": "Answer" }); ans.value = a || "";
      const row = h("div", { class: "prompt-row" }, h("div", { class: "prompt-top" }, sel,
        h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Remove card", onclick: () => { row.remove(); addPromptBtn.hidden = false; } }, "✕")), ans);
      promptRows.append(row);
      addPromptBtn.hidden = promptRows.children.length >= 4;
      return { sel, ans };
    }
    const addPromptBtn = h("button", { type: "button", class: "btn small" }, "+ Add a card");
    addPromptBtn.addEventListener("click", () => {
      const used = [...promptRows.querySelectorAll("select")].map((x) => x.value);
      const r = addPrompt(PROMPTS.find((x) => !used.includes(x)) || PROMPTS[0], ""); if (r) r.ans.focus();
    });
    (rec.prompts || []).forEach((x) => addPrompt(x.q, x.a));
    const readPrompts = () => [...promptRows.children].map((r) => ({ q: r.querySelector("select").value, a: r.querySelector("textarea").value.trim() })).filter((x) => x.a);

    // ---------- care & communication ----------
    const care = rec.care || {};
    const careArea = (k, label, ph) => { const t = h("textarea", { id: "care_" + k, maxlength: 220, rows: 2, placeholder: ph }); t.value = care[k] || ""; return field(label, t); };
    const replySel = h("select", { id: "care_reply" },
      [["", "Rather not say"], ["minutes", "Within minutes"], ["hours", "Within a few hours"], ["day", "Within a day"], ["days", "In a few days"]]
        .map(([v, l]) => h("option", { value: v, selected: (care.reply || "") === v }, l)));
    const readCare = () => ({
      approach: document.getElementById("care_approach").value.trim(),
      checkins: document.getElementById("care_checkins").value.trim(),
      aftercare: document.getElementById("care_aftercare").value.trim(),
      reply: replySel.value,
    });

    // Reads the Kink Jars link in `inp` and offers to fill in interests, limits and dynamic.
    async function kinkJarsFill(inp, btn, out) {
      const K = window.KinkJarsImport;
      const url = inp.value.trim();
      out.replaceChildren();
      if (!url) { inp.focus(); out.append(h("p", { class: "status bad" }, "Paste your Kink Jars share link first. On Kink Jars: Share & compare, then Get my share link.")); return; }
      const box = (label, on) => { const c = h("input", { type: "checkbox", checked: on }); return [c, h("label", { class: "check" }, c, label)]; };
      btn.disabled = true; const label = btn.textContent; btn.textContent = "Reading your shelf…";
      try {
        const sum = K.summarize(await K.resolve(url));
        const intoT = K.intoText(sum), limitsT = K.limitsText(sum);
        const total = sum.love.length + sum.enjoy.length + sum.curious.length + sum.limits.length + sum.roles.length;
        if (!total) { out.append(h("p", { class: "status bad" }, "That shelf doesn't have any filled jars yet.")); return; }
        const [cInto, lInto] = box("Interests (" + (sum.love.length + sum.enjoy.length + sum.curious.length) + ")", !!intoT);
        const [cLim, lLim] = box("Limits (" + sum.limits.length + ")", !!limitsT);
        const [cDyn, lDyn] = box("Dynamic / role: " + (sum.roles.slice(0, 3).join(", ") || "none rated"), sum.roles.length > 0);
        const willReplace = document.getElementById("f_into").value.trim() || document.getElementById("f_limits").value.trim();
        const apply = h("button", { class: "btn small gold", type: "button" }, "Fill in my profile");
        apply.addEventListener("click", () => {
          if (cInto.checked && intoT) document.getElementById("f_into").value = intoT;
          if (cLim.checked && limitsT) document.getElementById("f_limits").value = limitsT;
          if (cDyn.checked && sum.roles.length) document.getElementById("f_dynamic").value = sum.roles.slice(0, 3).join(", ").slice(0, 80);
          if (!nameI.value.trim() && sum.name) nameI.value = sum.name;
          refreshLook();
          out.replaceChildren(h("p", { class: "status ok" }, "Filled in. Your interests and limits are on the Profile tab. Press Save profile when you're happy."));
        });
        out.append(
          h("p", { class: "status ok" }, `Found ${total} filled jars${sum.name ? " on " + sum.name + "'s shelf" : ""}.`),
          intoT ? h("details", { class: "kj-preview" }, h("summary", {}, "Preview interests"), h("p", { class: "bio" }, intoT)) : "",
          limitsT ? h("details", { class: "kj-preview" }, h("summary", {}, "Preview limits"), h("p", { class: "bio" }, limitsT)) : "",
          h("div", { class: "kj-boxes" }, lInto, lLim, lDyn),
          willReplace ? h("p", { class: "hint" }, "This replaces what's in Into & curious about and Limits right now.") : "",
          apply);
      } catch (err) {
        out.append(h("p", { class: "status bad" }, err.message || "Couldn't read that link."));
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    }

    function playroomPanel() {
      const grid = h("div", { class: "play-games" }, h("p", { class: "faint" }, "Loading games…"));
      pb.collection("games").getFullList({ sort: "sort,title" }).then((games) => {
        const used = new Set();
        const rows = [];
        grid.replaceChildren();
        if (!games.length) grid.append(h("p", { class: "faint" }, "No games yet."));
        for (const g of games) {
          const url = safeUrl(g.url); if (!url) continue;
          const idx = playOriginal.findIndex((l, i) => !used.has(i) && matchesGame(url, l.url));
          if (!g.has_link && idx < 0) {
            // Games without personal links (like the Confession Box) just get a Play button.
            grid.append(h("div", { class: "play-game" },
              h("div", { class: "pg-head" },
                h("span", { class: "game-emoji", "aria-hidden": "true" }, g.emoji || "🎲"),
                h("span", { class: "game-txt" }, h("b", {}, g.title), g.description ? h("span", {}, g.description) : null),
                h("a", { class: "game-go", href: url, target: "_blank", rel: "noopener" }, "Play"))));
            continue;
          }
          if (idx >= 0) used.add(idx);
          const existing = idx >= 0 ? playOriginal[idx] : null;
          const inp = h("input", { type: "url", inputmode: "url", value: existing ? existing.url : "", placeholder: "Paste your " + g.title + " share link", "aria-label": "Your " + g.title + " share link" });
          rows.push({ title: (existing && existing.title) || "My " + g.title, input: inp });
          const out = h("div", { class: "kj-out" });
          let fill = null;
          if (/kink-jars/i.test(url) && window.KinkJarsImport) {
            fill = h("button", { type: "button", class: "btn small" }, "Fill in my profile from it");
            fill.addEventListener("click", () => kinkJarsFill(inp, fill, out));
          }
          grid.append(h("div", { class: "play-game" },
            h("div", { class: "pg-head" },
              h("span", { class: "game-emoji", "aria-hidden": "true" }, g.emoji || "🎲"),
              h("span", { class: "game-txt" }, h("b", {}, g.title), g.description ? h("span", {}, g.description) : null),
              h("a", { class: "game-go", href: url, target: "_blank", rel: "noopener" }, "Play")),
            h("div", { class: "pg-link" }, inp, fill),
            out));
        }
        gameRows = rows;
        const others = playOriginal.filter((_, i) => !used.has(i));
        otherEd = listEditor(others, "Game name", "https://…", 10);
        otherHolder.replaceChildren(h("details", { class: "pg-other", open: others.length > 0 },
          h("summary", {}, "Links for other games"), otherEd));
      }).catch(() => grid.replaceChildren(h("p", { class: "faint" }, "Couldn't load the games right now. Your saved game links are kept.")));
      return h("section", { class: "panel" },
        h("h2", {}, "Your games"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Play a game, then paste your share link under it. Your links show in the Playroom box on your page."),
        grid, otherHolder);
    }

    const TABS = [
      { id: "profile", label: "✎ Profile", body: [
        h("section", { class: "panel" }, h("h2", {}, "Who you are"),
          h("div", { class: "form-grid" },
            h("div", { class: "field full" }, h("span", { class: "label" }, "Profile photo"), avatarBox),
            lookingField,
            field("Display name", nameI),
            field("Pronouns", input("pronouns", { maxlength: 40, placeholder: "she/her, he/him, they/them…" })),
            field("Dynamic / role", input("dynamic", { maxlength: 80, placeholder: "Switch, Dom, sub, pet, brat…" })),
            field("General area", input("location", { maxlength: 80, placeholder: "Optional. Keep it general." }), "Never put your exact address here."),
            field("About you", area("bio", { maxlength: 3000, placeholder: "Who you are, what you're looking for, how to approach you…" }), null, true))),
        h("section", { class: "panel" }, h("h2", {}, "Interests & limits"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "Filled your Kink Jars shelf? Paste its link in the Playroom tab and it can fill these in for you."),
          h("div", { class: "form-grid" },
            field("Into & curious about", area("into", { maxlength: 6000, placeholder: "One per line, or comma-separated. Lines starting Love:, Enjoy: or Curious about: become their own rows." })),
            field("Limits", area("limits", { maxlength: 6000, placeholder: "One per line, or comma-separated. Shown in their own box." })))),
        h("section", { class: "panel" }, h("h2", {}, "Ask me about"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "Pick up to 4 questions and answer them. They show as little cards on your page and make great conversation starters."),
          promptRows, addPromptBtn),
        h("section", { class: "panel" }, h("h2", {}, "Care & communication"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "Optional. Help people approach you the way you like. Anything left blank stays off your page."),
          h("div", { class: "form-grid" },
            careArea("approach", "How to approach me", "e.g. Say hi in the group first, then DM me"),
            careArea("checkins", "How I like to check in", "e.g. Traffic lights, and a check-in every so often"),
            careArea("aftercare", "Aftercare I need", "e.g. Blankets, water, and a text the next day"),
            field("I usually reply", replySel))),
        h("section", { class: "panel" }, h("h2", {}, "Your page"),
          h("div", { class: "form-grid" },
            slugField,
            field("Telegram username", input("tg_username", { maxlength: 33, placeholder: "@yourname", autocapitalize: "off", spellcheck: "false" }), "Optional. Adds a \"Message on Telegram\" button to your page."))),
      ] },
      { id: "photos", label: "📸 Photos", body: [
        h("section", { class: "panel" }, h("h2", {}, "Photos"),
          h("div", { class: "toggle-row" },
            h("p", { class: "faint", style: "margin:0" }, "Photos save as soon as you add them. NSFW ones stay blurred until a viewer taps."),
            h("label", { class: "check" }, newNsfw, "Mark new uploads NSFW")),
          phInput, photoGrid),
      ] },
      { id: "playroom", label: "🎲 Playroom", body: [
        playroomPanel(),
      ] },
      { id: "links", label: "🔗 Links", body: [
        h("section", { class: "panel" }, h("h2", {}, "Links"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "Anything else you want people to find: FetLife, socials, wishlists, photo albums. Give each one a name and paste its address."),
          linksEd),
      ] },
      { id: "settings", label: "🎨 Settings", body: [settingsTab] },
    ];
    const panes = {};
    const tabBar = h("div", { class: "tabs", role: "tablist", "aria-label": "Edit sections" });
    for (const t of TABS) {
      panes[t.id] = h("div", { role: "tabpanel", id: "pane-" + t.id, "aria-labelledby": "tab-" + t.id }, t.body);
      tabBar.append(h("button", { type: "button", class: "tab", role: "tab", id: "tab-" + t.id, "aria-controls": "pane-" + t.id, onclick: () => showTab(t.id) }, t.label));
    }
    function showTab(id) {
      if (!panes[id]) id = "profile";
      for (const t of TABS) {
        panes[t.id].hidden = t.id !== id;
        document.getElementById("tab-" + t.id).setAttribute("aria-selected", String(t.id === id));
      }
      history.replaceState(null, "", "/edit" + (id === "profile" ? "" : "#" + id));
      if (id === "settings") refreshLook();
    }

    app.replaceChildren(
      tabBar,
      ...TABS.map((t) => panes[t.id]),
      h("div", { class: "savebar" }, h("a", { class: "btn ghost", href: "/" + rec.slug, "data-nav": "" }, "Cancel"), saveBtn),
    );
    nameI.addEventListener("input", refreshLook);
    showTab(location.hash.slice(1));
    refreshLook();
  }

  render();
})();
