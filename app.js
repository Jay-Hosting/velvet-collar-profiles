/* Velvet Collar Profiles — front end (plain JS, no build step). */
(() => {
  "use strict";

  const CFG = window.VC_CONFIG || {};
  const pb = new PocketBase(CFG.API_URL);
  pb.autoCancellation(false);

  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const RESERVED = ["edit", "api", "admin", "login", "logout", "join", "signup", "settings", "index", "directory", "members", "assets", "vendor", "_"];
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
    if (!user) {
      nav.append(h("a", { class: "btn small ghost", href: "/login", "data-nav": "" }, "Log in"));
    } else {
      nav.append(
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
        h("h1", {}, "Everything about you, ", h("em", {}, "on one link.")),
        h("p", {}, `A profile page for ${CFG.GROUP_NAME || "the group"} members: your jars, your links, your photos. Put the link in your Telegram bio and you're done.`),
        h("div", { class: "actions", style: "justify-content:center" },
          h("a", { class: "btn gold", href: "/join", "data-nav": "" }, "Make my profile"),
          h("a", { class: "btn", href: "/login", "data-nav": "" }, "Log in")),
        h("p", { class: "faint", style: "margin-top:14px" }, "You'll need the join code from the group chat to make a profile."),
      ),
      h("div", { class: "features" },
        feature("Your jars", "Link every Kink Jar you've made so people don't have to dig for them."),
        feature("Your links", "FetLife, wishlists, socials, photo albums. Anything you want to share."),
        feature("Your photos", "Upload a gallery. Mark anything NSFW and it stays blurred until tapped."),
        feature("Your call", "Your page is for anyone you share the link with. Join the member list only if you want to."),
      ),
    );
  }
  const feature = (t, d) => h("div", { class: "feature" }, h("h3", {}, t), h("p", {}, d));

  function renderLogin(after) {
    try { sessionStorage.setItem("vc_after_login", after); } catch {}
    renderAuth("login");
  }

  // ---------- member list (logged-in only, opt-in) ----------
  async function renderDirectory() {
    document.title = "Member list · Velvet Collar";
    const user = me();
    const list = await pb.collection("members").getFullList({ filter: "listed = true", sort: "display_name", fields: "id,slug,display_name,style,theme" });
    const rows = h("div", { class: "link-list" });
    const draw = (term) => {
      rows.replaceChildren();
      const t = term.trim().toLowerCase();
      const items = list.filter((m) => !t || (m.display_name + " " + m.slug).toLowerCase().includes(t));
      if (!items.length) rows.append(h("p", { class: "muted" }, list.length ? "No one matches that." : "No one has joined the list yet."));
      for (const m of items) {
        const row = h("a", { class: "link", href: "/" + m.slug, "data-nav": "" },
          h("span", { class: "mono", "aria-hidden": "true" }, (m.display_name || "?").slice(0, 2).toUpperCase()),
          h("span", { class: "txt" }, h("b", {}, m.display_name), h("small", {}, profileUrl(m.slug).replace(/^https?:\/\//, ""))),
          h("span", { class: "arrow", "aria-hidden": "true" }, "→"));
        L.apply(L.resolve(m.style, m.theme), row);
        rows.append(row);
      }
    };
    const search = h("input", { class: "search", type: "search", placeholder: `Search ${list.length} ${list.length === 1 ? "member" : "members"}`, "aria-label": "Search members", oninput: (e) => draw(e.target.value) });
    draw("");
    app.replaceChildren(
      h("div", { class: "owner-bar" },
        h("span", {}, "Your link: ", h("b", {}, profileUrl(user.slug))),
        h("span", { class: "actions", style: "margin:0" },
          h("button", { class: "btn small", onclick: () => copy(profileUrl(user.slug)) }, "Copy link"),
          h("a", { class: "btn small gold", href: "/edit", "data-nav": "" }, "Edit profile"))),
      user.listed ? "" : h("p", { class: "faint", style: "margin:0 0 12px" },
        "You're not on the list, so people only find you through your link. ",
        h("a", { href: "/edit#settings", "data-nav": "" }, "Join it in Settings.")),
      h("section", { class: "panel" },
        h("h2", {}, "Member list"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Only logged-in members can see this list, and only people who opted in are on it."),
        search, rows),
    );
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
    const jars = (p.jars || []).filter((j) => safeUrl(j.url));
    const links = (p.links || []).filter((l) => safeUrl(l.url));
    const tgUser = p.tg_username ? p.tg_username.replace(/^@/, "") : "";

    const head = h("div", { class: "profile-card" },
      h("div", { class: "banner" }),
      h("div", { class: "profile-head" },
        avatarEl(p),
        h("h1", { class: "profile-name" }, p.display_name),
        tgUser ? h("div", { class: "handle" }, "@" + tgUser) : null,
        look.mood_emoji || look.mood_text ? h("div", { class: "mood" }, look.mood_emoji ? h("span", { class: "em" }, look.mood_emoji) : null, look.mood_text) : null,
        h("div", { class: "chips" },
          p.pronouns ? h("span", { class: "chip" }, p.pronouns) : null,
          p.dynamic ? h("span", { class: "chip gold" }, p.dynamic) : null,
          p.location ? h("span", { class: "chip" }, p.location) : null,
          null),
        h("div", { class: "actions" },
          tgUser ? h("a", { class: "btn gold", href: "https://t.me/" + encodeURIComponent(tgUser), target: "_blank", rel: "noopener" }, "Message on Telegram") : null,
          h("button", { class: "btn", onclick: () => copy(profileUrl(p.slug)) }, "Copy link"))));

    const blocks = [];
    if (data.isOwner) {
      blocks.push(h("div", { class: "owner-bar" },
        h("span", {}, "This is your page. Paste ", h("b", {}, profileUrl(p.slug)), " into your Telegram bio."),
        h("a", { class: "btn small gold", href: "/edit", "data-nav": "" }, "Edit")));
    }
    blocks.push(head);

    if (p.bio) blocks.push(h("section", { class: "panel" }, h("h2", {}, "About"), h("p", { class: "bio" }, p.bio)));

    if (p.into || p.limits) {
      blocks.push(h("div", { class: "two" },
        p.into ? h("section", { class: "panel" }, h("h2", {}, "Into & curious about"), h("p", { class: "bio" }, p.into)) : null,
        p.limits ? h("section", { class: "panel limits" }, h("h2", {}, "Limits"), h("p", { class: "bio" }, p.limits)) : null));
    }

    if (jars.length) {
      blocks.push(h("section", { class: "panel" },
        h("h2", { class: "section-title" }, "Jars", h("span", { class: "count" }, String(jars.length))),
        h("div", { class: "jar-grid" }, jars.map((j) =>
          h("a", { class: "jar", href: safeUrl(j.url), target: "_blank", rel: "noopener" },
            h("div", { class: "jar-icon", "aria-hidden": "true" }, h("div", { class: "lid" }), h("div", { class: "body" })),
            h("b", {}, j.title || "Untitled jar"),
            h("small", {}, hostOf(j.url)))))));
    }

    if (links.length) {
      blocks.push(h("section", { class: "panel" },
        h("h2", {}, "Links"),
        h("div", { class: "link-list" }, links.map((l) => {
          const host = hostOf(l.url);
          const label = l.title || host;
          return h("a", { class: "link", href: safeUrl(l.url), target: "_blank", rel: "noopener nofollow" },
            h("span", { class: "mono", "aria-hidden": "true" }, label.slice(0, 2).toUpperCase()),
            h("span", { class: "txt" }, h("b", {}, label), h("small", {}, l.url.replace(/^https?:\/\/(www\.)?/, ""))),
            h("span", { class: "arrow", "aria-hidden": "true" }, "↗"));
        }))));
    }

    if (photos.length) blocks.push(gallerySection(photos));

    if (blocks.length === (data.isOwner ? 2 : 1)) {
      blocks.push(h("p", { class: "center-msg muted" }, data.isOwner ? "Your page is empty so far. Add your jars, links and photos from Edit." : "Nothing here yet."));
    }
    app.replaceChildren(...blocks);
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
    return h("section", { class: "panel" },
      h("div", { class: "toggle-row" }, h("h2", { class: "section-title", style: "margin:0" }, "Photos", h("span", { class: "count" }, String(photos.length))), toggle),
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
      h("span", { class: "hint" }, "This is also your login name. If you change it, log in with the new one."));

    // member list opt-in
    const listedBox = h("input", { type: "checkbox", checked: !!rec.listed });

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
        h("div", { class: "jar" },
          h("div", { class: "jar-icon", "aria-hidden": "true" }, h("div", { class: "lid" }), h("div", { class: "body" })),
          h("b", {}, (rec.jars && rec.jars[0] && rec.jars[0].title) || "One of your jars")),
        h("div", { class: "actions" }, h("span", { class: "btn gold small" }, "Message on Telegram"))));

    const colorInputs = {};
    function refreshLook() {
      L.apply(look, document.documentElement);
      L.apply(look, preview);
      L.particles(preview, look.particles, false);
      pvName.textContent = (nameI.value || "").trim() || "Your name";
      const av = avatarFile ? h("img", { class: "avatar", src: URL.createObjectURL(avatarFile), alt: "" })
        : avatarEl(removeAvatar ? { display_name: nameI.value } : Object.assign({}, rec, { display_name: nameI.value }));
      pvAvatar.replaceChildren(av);
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
              h("span", { class: "hint" }, "Logged-in members can browse the list. Leave it off and people only find you through your link.")))),
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
      wrap.read = () => [...rows.children].map((r) => {
        const [t, u] = r.querySelectorAll("input");
        return { title: t.value.trim(), url: u.value.trim() };
      }).filter((x) => x.url);
      return wrap;
    }
    const jarsEd = listEditor(rec.jars, "Jar name", "https://… link to the jar", 40);
    const linksEd = listEditor(rec.links, "Label (FetLife, Instagram…)", "https://…", 20, LINK_PRESETS);

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
      const bad = [...jarsEd.read(), ...linksEd.read()].find((x) => !safeUrl(x.url));
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
        fd.append("jars", JSON.stringify(jarsEd.read()));
        fd.append("links", JSON.stringify(linksEd.read()));
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

    const TABS = [
      { id: "profile", label: "✎ Profile", body: [
        h("section", { class: "panel" }, h("h2", {}, "The basics"),
          h("div", { class: "form-grid" },
            h("div", { class: "field full" }, h("span", { class: "label" }, "Profile photo"), avatarBox),
            field("Display name", nameI),
            field("Pronouns", input("pronouns", { maxlength: 40, placeholder: "she/her, he/him, they/them…" })),
            field("Dynamic / role", input("dynamic", { maxlength: 80, placeholder: "Switch, Dom, sub, pet, brat…" })),
            field("General area", input("location", { maxlength: 80, placeholder: "Optional. Keep it general." }), "Never put your exact address here."),
            field("Telegram username", input("tg_username", { maxlength: 33, placeholder: "@yourname", autocapitalize: "off", spellcheck: "false" }), "Optional. Adds a \"Message on Telegram\" button to your page."),
            slugField,
            field("About you", area("bio", { maxlength: 3000, placeholder: "Who you are, what you're looking for, how to approach you…" }), null, true))),
        h("section", { class: "panel" }, h("h2", {}, "Interests & limits"),
          h("div", { class: "form-grid" },
            field("Into & curious about", area("into", { maxlength: 2000 })),
            field("Limits", area("limits", { maxlength: 2000, placeholder: "Hard and soft limits. Shown in its own box." })))),
      ] },
      { id: "links", label: "🫙 Jars & links", body: [
        h("section", { class: "panel" }, h("h2", {}, "Your jars"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "Paste the link to each Kink Jar you've made."),
          jarsEd),
        h("section", { class: "panel" }, h("h2", {}, "Links"),
          h("p", { class: "faint", style: "margin-top:-6px" }, "FetLife, socials, wishlists, photo albums — anything you want people to find."),
          linksEd),
      ] },
      { id: "photos", label: "📸 Photos", body: [
        h("section", { class: "panel" }, h("h2", {}, "Photos"),
          h("div", { class: "toggle-row" },
            h("p", { class: "faint", style: "margin:0" }, "Photos save as soon as you add them. NSFW ones stay blurred until a viewer taps."),
            h("label", { class: "check" }, newNsfw, "Mark new uploads NSFW")),
          phInput, photoGrid),
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
      h("div", { class: "owner-bar" },
        h("span", {}, "Put ", h("b", {}, profileUrl(rec.slug)), " in your Telegram bio (Settings → Edit profile → Bio)."),
        h("span", { class: "actions", style: "margin:0" },
          h("button", { class: "btn small", type: "button", onclick: () => copy(profileUrl(rec.slug)) }, "Copy link"),
          h("a", { class: "btn small", href: "/" + rec.slug, "data-nav": "" }, "View page"))),
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
