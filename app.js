/* Velvet Collar Profiles — front end (plain JS, no build step). */
(() => {
  "use strict";

  const CFG = window.VC_CONFIG || {};
  const pb = new PocketBase(CFG.API_URL);
  pb.autoCancellation(false);

  const app = document.getElementById("app");
  // Photos and videos can't be saved with right-click, long-press or drag (screenshots can't be blocked; this stops casual saving).
  // The one exception is your own profile card, which is made to be saved.
  const keep = (el) => el && el.closest && el.closest(".card-preview, .allow-save");
  document.addEventListener("contextmenu", (e) => { const t = e.target; if ((t.tagName === "IMG" || t.tagName === "VIDEO" || (t.closest && t.closest(".ph, .viewer-media, .tod-proof, .pr-media, .mod-photos"))) && !keep(t)) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if ((e.target.tagName === "IMG" || e.target.tagName === "VIDEO") && !keep(e.target)) e.preventDefault(); });
  const noSave = (v) => { v.setAttribute("controlsList", "nodownload noremoteplayback"); v.disablePictureInPicture = true; v.setAttribute("disablePictureInPicture", ""); };
  new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; if (n.tagName === "VIDEO") noSave(n); else n.querySelectorAll && n.querySelectorAll("video").forEach(noSave); } })
    .observe(document.body, { childList: true, subtree: true });
  const nav = document.getElementById("nav");
  const RESERVED = ["edit", "api", "admin", "login", "logout", "join", "signup", "settings", "playroom", "games", "index", "directory", "members", "assets", "vendor", "events", "question", "p", "hunt", "whispers", "mod", "vetting", "velvetcollar", "about", "group", "confessions", "confess", "network", "volunteer", "volunteers", "truthordare", "tod", "bingo", "match", "mystery", "_"];
  // "Looking for" choices: [value, emoji, label]. "open" and "nothing" each stand on their own.
  // Relationship style (up to 3) and relationship types between members. A type is what the other person is to you.
  // Relationship styles: [value, label, group, what it means]. Members pick up to 5.
  const REL_STYLES = [
    ["single", "Single", "general", "Not partnered right now."],
    ["mono", "Monogamous", "general", "One partner, both exclusive."],
    ["monogamish", "Monogamish", "general", "Mostly monogamous, with agreed exceptions."],
    ["open", "Open relationship", "general", "A couple who see or play with other people."],
    ["swinger", "Swinger", "general", "A couple who play with others, often together."],
    ["ra", "Relationship anarchy", "general", "No set rules or rankings; each relationship is shaped by the people in it."],
    ["exploring", "Still figuring it out", "general", "Working out what fits."],
    ["enm", "Ethically non-monogamous (ENM)", "poly", "The umbrella: more than one relationship, with everyone's knowledge and consent."],
    ["poly", "Polyamorous", "poly", "More than one loving relationship at a time."],
    ["solo_poly", "Solo poly", "poly", "Poly, and your own primary partner: no nesting or merging lives."],
    ["kitchen_table", "Kitchen table poly", "poly", "Everyone in the polycule is happy to hang out together, like around the kitchen table."],
    ["garden_party", "Garden party poly", "poly", "Friendly with metamours at events and gatherings, but not close."],
    ["parallel", "Parallel poly", "poly", "Partners know about each other but keep their relationships separate."],
    ["hierarchical", "Hierarchical poly", "poly", "A primary partner (or partners), with other relationships alongside."],
    ["non_hierarchical", "Non-hierarchical poly", "poly", "No primary: every relationship stands on its own."],
    ["polyfidelity", "Polyfidelity", "poly", "A closed group: everyone's committed within it."],
    ["triad", "Triad / throuple", "poly", "Three people together."],
    ["quad", "Quad", "poly", "Four people together, often two couples."],
    ["polycule", "Polycule", "poly", "A wider web of connected partners and metamours."],
    ["mono_poly", "Mono/poly", "poly", "One partner is monogamous and the other is poly."],
  ];
  const REL_TYPES = [["partner", "💞", "Partner"], ["spouse", "💍", "Spouse"], ["nesting", "🏡", "Nesting partner"], ["dating", "🌹", "Dating"], ["play", "🔥", "Play partner"],
    ["dom", "⛓️", "Dominant"], ["sub", "🎀", "submissive"], ["owner", "🗝️", "Owner"], ["pet", "🐾", "Pet"], ["caregiver", "🧸", "Caregiver"], ["little", "🍭", "Little"], ["friend", "🤝", "Close friend"]];
  const relType = (t) => REL_TYPES.find((x) => x[0] === t) || ["", "🔗", t];
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
  // Profile links show a preview card in Telegram (the Mac mini answers link-preview robots).
  // Telegram remembers a card per exact link, so shared links carry a short tag that changes
  // whenever the profile is saved; that way Telegram always fetches a fresh card.
  const shareUrl = (p) => {
    let n = 0; for (const c of String(p.updated || "")) n = (n * 31 + c.charCodeAt(0)) >>> 0;
    return profileUrl(p.slug) + (p.updated ? "?c=" + n.toString(36).slice(0, 5) : "");
  };
  const fileUrl = (rec, name, thumb) => (name ? pb.files.getURL(rec, name, thumb ? { thumb } : undefined) : "");

  function toast(msg, isErr) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.toggle("err", !!isErr);
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // One "📣 Share" button that opens a small menu: copy the link, a ready-made post (or the photo share window),
  // and the phone's own share sheet where there is one. opts: { url, title, label, cls, extra: [[emoji, title, hint, fn]] }
  function shareButton(opts) {
    const open = () => {
      const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Share" });
      const close = () => { modal.remove(); document.removeEventListener("keydown", esc); };
      const esc = (e) => { if (e.key === "Escape") close(); };
      modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
      const opt = (e, t, hint, fn) => h("button", { type: "button", class: "share-choice", onclick: () => { close(); fn(); } },
        h("span", { class: "share-choice-e", "aria-hidden": "true" }, e), h("span", {}, h("b", {}, t), h("small", {}, hint)));
      const items = [
        opt("🔗", "Copy link", "Paste it on its own in Telegram and it turns into a preview card.", () => copyText(opts.url, "🔗 Link copied")),
        ...(opts.extra || []).map(([e, t, hint, fn]) => opt(e, t, hint, fn)),
      ];
      if (navigator.share) items.push(opt("📤", "Share to an app", "Opens your phone's share menu: Telegram, Messages and so on.", () => navigator.share({ title: opts.title || "", url: opts.url }).catch(() => {})));
      modal.append(h("div", { class: "modal-box share-sheet" },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "📣 Share"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
        h("div", { class: "share-choices" }, items)));
      document.body.append(modal); document.addEventListener("keydown", esc);
      modal.querySelector(".share-choice").focus();
    };
    return h("button", { type: "button", class: opts.cls || "btn", onclick: open }, opts.label || "📣 Share");
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
    if (isNew) setTimeout(() => openHowTo(true), 400);
  }

  // A short how-to, step by step. Opens once after someone makes their profile, and from "How it works" in the footer.
  const HOWTO = [
    { e: "👋", t: "Welcome to Velvet Collar", p: ["This is where members of the group have a profile, find each other, see events and play games.", "Here's a 1-minute tour. You can open it again any time from “How it works” at the bottom of the page."] },
    { e: "✏️", t: "Fill in your profile", p: ["You're on your Edit page now. Add a photo, a little about you, what you're looking for, your relationship style, and your interests and limits.", "Everything is optional, so share as much or as little as you like. Tap Save profile at the bottom when you're done."], tip: "The glow-up meter at the top shows what's left to fill in." },
    { e: "🎨", t: "Make it look like you", p: ["The 🎨 Settings tab changes your colours, pattern, font, charm and mood.", "📸 Photos adds a gallery, 🔗 Links adds your other pages, and 🎲 Playroom holds your game links."] },
    { e: "👥", t: "Join the member list", p: ["New profiles aren't on the member list yet, so people can only find you through your link.", "When you're ready, add a profile photo and tick “Put me on the member list” in 🎨 Settings. You can hide yourself again whenever you like."], tip: "Your link is velvetcollarsac.com/ + your profile name. Tap 📣 Share on your page to copy it or post it in Telegram." },
    { e: "📅", t: "Events", p: ["The Events calendar shows munches, game nights and play parties. Tap I'm going or ☆ Interested, and add them to your own calendar.", "Some play parties need you to be vetted first. Fill in the vetting form from the Events page.", "Want to help out? Tap 🙋 Volunteer on an event."] },
    { e: "🎲", t: "The Playroom", p: ["Games to play with other members: 🏹 The Hunt, 🤫 Whispers (anonymous chats) and more.", "React to profiles, leave kind notes, vouch for people, and send secret crushes. They're only revealed if it's mutual."] },
    { e: "💜", t: "Look after each other", p: ["Ask first, respect limits, and keep what's shared here inside the group.", "If anything feels off, use Report inside a Whisper chat, or tell one of the team. You'll find them on the Velvet Collar page."], tip: "Don't want crushes, vouches, reactions or kind notes? Switch each one off in 🎨 Settings any time." },
  ];
  function openHowTo(isNew) {
    let i = 0;
    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "ht_title" });
    const close = () => { modal.remove(); document.removeEventListener("keydown", key); };
    const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight" && i < HOWTO.length - 1) { i++; draw(); } else if (e.key === "ArrowLeft" && i > 0) { i--; draw(); } };
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const box = h("div", { class: "modal-box ht-box" });
    const draw = () => {
      const st = HOWTO[i], last = i === HOWTO.length - 1;
      box.replaceChildren(
        h("div", { class: "ht-top" }, h("span", { class: "faint" }, `${i + 1} of ${HOWTO.length}`), h("button", { type: "button", class: "btn small ghost", onclick: close }, last ? "Close" : "Skip")),
        h("div", { class: "ht-emoji", "aria-hidden": "true" }, st.e),
        h("h2", { id: "ht_title", class: "ht-title" }, st.t),
        h("div", { class: "ht-body" }, st.p.map((x) => h("p", {}, x)), st.tip ? h("p", { class: "ht-tip" }, "💡 " + st.tip) : null),
        h("div", { class: "ht-dots", role: "tablist", "aria-label": "Steps" }, HOWTO.map((_, k) => h("button", { type: "button", class: "ht-dot" + (k === i ? " on" : ""), "aria-label": `Step ${k + 1}`, "aria-selected": String(k === i), onclick: () => { i = k; draw(); } }))),
        h("div", { class: "ht-nav" },
          i > 0 ? h("button", { type: "button", class: "btn ghost", onclick: () => { i--; draw(); } }, "← Back") : h("span", {}),
          last ? h("button", { type: "button", class: "btn gold", onclick: () => { close(); if (!isNew && me() && location.pathname !== "/edit") go("/edit"); } }, isNew ? "Let's fill in my profile ✨" : me() ? "Go to my Edit page" : "Got it")
            : h("button", { type: "button", class: "btn gold", onclick: () => { i++; draw(); } }, "Next →")));
    };
    draw();
    modal.append(box); document.body.append(modal); document.addEventListener("keydown", key);
  }
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-howto]"); if (a) { e.preventDefault(); openHowTo(false); } });

  // Members who joined before the 21+ check and the guidelines (or before the guidelines changed) confirm both once.
  // The box can't be dismissed: agree, or log out.
  let consentOk = false, consentOpen = false;
  async function checkConsent() {
    if (consentOk || consentOpen || !me()) return;
    const G = window.VCGuidelines;
    let st; try { st = await pb.send("/api/vc/consent?v=" + encodeURIComponent(G.VERSION), { requestKey: null }); } catch { return; }
    if (!st.needs21 && !st.needsGuidelines) { consentOk = true; return; }
    consentOpen = true;
    const age = h("input", { type: "checkbox", id: "cs_age", checked: !st.needs21 });
    const gl = h("input", { type: "checkbox", id: "cs_gl" });
    const msg = h("p", { class: "form-msg", role: "alert" });
    const btn = h("button", { type: "submit", class: "btn gold" }, "Agree and continue");
    const modal = h("div", { class: "modal consent-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "cs_title" });
    const form = h("form", { class: "modal-box consent-box" },
      h("div", { class: "consent-e", "aria-hidden": "true" }, "💜"),
      h("h2", { id: "cs_title", style: "margin:0;text-align:center" }, "One quick thing before you carry on"),
      h("p", { class: "muted", style: "margin:0" }, st.needs21 ? "Velvet Collar now asks every member to confirm their age and agree to our community guidelines. It only takes a moment, and you'll only be asked once."
        : "Our community guidelines have been updated. Please have a read and agree to keep using the site."),
      st.needs21 ? h("label", { class: "check", for: "cs_age" }, age, h("span", {}, "I'm 21 or older.")) : null,
      h("label", { class: "check", for: "cs_gl" }, gl, h("span", {}, "I've read and agree to the ", h("a", { href: "#", onclick: (e) => { e.preventDefault(); openGuidelines(() => { gl.checked = true; }); } }, "community guidelines"), ".")),
      msg,
      h("div", { class: "actions", style: "margin:0;justify-content:space-between" },
        h("button", { type: "button", class: "btn ghost", onclick: () => { modal.remove(); consentOpen = false; pb.authStore.clear(); go("/"); } }, "Log out"), btn));
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); msg.textContent = "";
      if (!age.checked) { msg.textContent = "Velvet Collar is for members 21 and older. Please confirm your age."; return age.focus(); }
      if (!gl.checked) { msg.textContent = "Please read and agree to the community guidelines first."; return gl.focus(); }
      btn.disabled = true;
      try {
        await pb.send("/api/vc/consent", { method: "POST", body: { age21: true, guidelines: G.VERSION } });
        consentOk = true; consentOpen = false; modal.remove(); toast("Thank you 💜 Enjoy the site.");
      } catch (err) { msg.textContent = errMsg(err); btn.disabled = false; }
    });
    modal.append(form); document.body.append(modal);
    setTimeout(() => (st.needs21 ? age : gl).focus(), 50);
  }

  // ---------- volunteer news: owners' decisions, shown once ----------
  let volChecked = false;
  // Announcements from the admins: shown on login and on every page change until seen (or, for must-read ones, acknowledged).
  let annOpen = false;
  async function announce() {
    if (annOpen || consentOpen || !me() || document.querySelector(".modal")) return;
    let d; try { d = await pb.send("/api/vc/announcements/pending", { requestKey: null }); } catch { return; }
    if (!d.item || annOpen || consentOpen || document.querySelector(".modal")) return;
    annOpen = true;
    const a = d.item, ack = a.kind === "ack";
    const modal = h("div", { class: "modal ann-modal" + (ack ? " ack" : " fun"), role: "dialog", "aria-modal": "true", "aria-labelledby": "ann_title" });
    const msg = h("p", { class: "form-msg", role: "alert" });
    const done = async (goTo) => {
      try { await pb.send(`/api/vc/announcements/${a.id}/seen`, { method: "POST", body: { ack: ack }, requestKey: null }); }
      catch (err) { if (ack) { msg.textContent = errMsg(err); return; } }
      modal.remove(); document.removeEventListener("keydown", key); annOpen = false;
      if (goTo) go(goTo); else if (d.more) setTimeout(announce, 400);
    };
    const key = (e) => { if (e.key === "Escape" && !ack) done(); };
    if (!ack) modal.addEventListener("click", (e) => { if (e.target === modal) done(); });
    const link = a.link && (a.link.startsWith("/") ? a.link : safeUrl(a.link));
    const linkBtn = link ? (a.link.startsWith("/")
      ? h("button", { type: "button", class: "btn" + (ack ? " ghost" : " gold"), onclick: () => (ack ? go(link) : done(link)) }, a.link_label || "Take a look")
      : h("a", { class: "btn" + (ack ? " ghost" : " gold"), href: link, target: "_blank", rel: "noopener" }, (a.link_label || "Open link") + " ↗")) : null;
    const box = h("div", { class: "modal-box ann-box" },
      ack ? null : h("button", { type: "button", class: "btn small ghost ann-x", "aria-label": "Close", onclick: () => done() }, "✕"),
      h("div", { class: "ann-emoji", "aria-hidden": "true" }, a.emoji || (ack ? "📣" : "🎉")),
      h("p", { class: "ann-kicker" }, ack ? "Please read: from the Velvet Collar team" : "News from Velvet Collar"),
      h("h2", { id: "ann_title" }, a.title),
      a.body ? h("div", { class: "ann-body" }, a.body) : null,
      a.by ? h("p", { class: "faint ann-by" }, `— ${a.by}${d.more ? ` · ${d.more} more after this` : ""}`) : null,
      msg);
    if (ack) {
      const chk = h("input", { type: "checkbox", id: "ann_ok" });
      const okBtn = h("button", { type: "button", class: "btn gold", disabled: true, onclick: () => done() }, "✅ I acknowledge");
      chk.addEventListener("change", () => { okBtn.disabled = !chk.checked; });
      box.append(h("label", { class: "check", for: "ann_ok" }, chk, h("span", {}, "I've read and understood this.")),
        h("div", { class: "actions ann-actions" }, linkBtn, okBtn));
    } else {
      box.append(h("div", { class: "actions ann-actions" }, h("button", { type: "button", class: "btn" + (linkBtn ? " ghost" : " gold"), onclick: () => done() }, "Got it 💜"), linkBtn));
    }
    modal.append(box);
    document.body.append(modal); document.addEventListener("keydown", key);
  }

  async function volNews() {
    if (volChecked || consentOpen || !me()) return;
    volChecked = true;
    let d; try { d = await pb.send("/api/vc/volunteer/news", { requestKey: null }); } catch { return; }
    if (!d.items || !d.items.length) return;
    const RL = { setup: "🧰 Setup", crew: "🎉 Party crew", breakdown: "🧹 Breakdown" };
    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "vn_title" });
    const close = async () => { modal.remove(); try { await pb.send("/api/vc/volunteer/news", { method: "POST", body: {} }); } catch {} };
    const one = (v) => {
      const ev = v.event ? `${v.event.emoji || "📅"} ${v.event.title} · ${fmtWhen(v.event.starts)}` : "📅 An upcoming event";
      return h("div", { class: "vn-item " + v.status },
        h("b", {}, v.status === "approved" ? "🎉 You're on the crew!" : v.status === "declined" ? "💜 Not this time" : "📨 Update on your volunteer form"),
        h("p", { class: "muted", style: "margin:2px 0" }, ev),
        v.status === "approved" && v.role.length ? h("p", { style: "margin:2px 0" }, "Your role: ", h("b", {}, v.role.map((r) => RL[r] || r).join(", "))) : null,
        v.status === "declined" ? h("p", { class: "faint", style: "margin:2px 0" }, "Volunteer spots rotate between events, so please do offer again for the next one.") : null,
        v.message ? h("p", { class: "vn-msg" }, "“" + v.message + "”") : null);
    };
    modal.append(h("div", { class: "modal-box" },
      h("h2", { id: "vn_title", style: "margin:0" }, "🙋 Volunteer news"),
      d.items.map(one),
      h("div", { class: "actions", style: "margin:0;justify-content:space-between" },
        h("a", { class: "btn ghost", href: "/volunteer", "data-nav": "", onclick: close }, "See my volunteering"),
        h("button", { type: "button", class: "btn gold", onclick: close }, "Got it 💜"))));
    document.body.append(modal);
  }

  // ---------- feedback: a floating 💡 button (and a footer link) open a small form ----------
  const FB_KINDS = [["idea", "💡", "An idea"], ["bug", "🐞", "Something's broken"], ["love", "💜", "Something I love"], ["other", "💬", "Something else"]];
  function openFeedback() {
    if (!me()) { toast("Log in to send feedback 💜", true); return; }
    let kind = "idea";
    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "fb_title" });
    const close = () => { modal.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const pills = h("div", { class: "pills", role: "radiogroup", "aria-label": "What kind of feedback" });
    const drawPills = () => pills.replaceChildren(...FB_KINDS.map(([k, e, l]) => h("button", { type: "button", class: "pill", role: "radio", "aria-checked": String(kind === k), "aria-pressed": String(kind === k), onclick: () => { kind = k; drawPills(); text.placeholder = PH[k]; } }, `${e} ${l}`)));
    const PH = { idea: "What would you love to see on the site?", bug: "What went wrong, and where? What did you expect to happen?", love: "What's working well for you?", other: "Anything at all…" };
    const text = h("textarea", { rows: 5, maxlength: 2000, placeholder: PH.idea, "aria-label": "Your feedback" });
    const anon = h("input", { type: "checkbox", id: "fb_anon" });
    const send = h("button", { type: "submit", class: "btn gold" }, "Send feedback");
    const form = h("form", { class: "modal-box fb-box" },
      h("div", { class: "toggle-row" }, h("h2", { id: "fb_title", style: "margin:0" }, "💡 Feedback"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
      h("p", { class: "muted", style: "margin:0" }, "Ideas, bugs, wishes, love notes. The admins read every one."),
      pills, text,
      h("label", { class: "check", for: "fb_anon" }, anon, h("span", {}, "Send anonymously (the admins won't see your name)")),
      h("div", { class: "actions", style: "margin:0" }, send));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (text.value.trim().length < 3) { toast("Tell us a little more first.", true); return text.focus(); }
      send.disabled = true;
      try { await pb.send("/api/vc/feedback", { method: "POST", body: { kind, text: text.value.trim(), anon: anon.checked, page: location.pathname } }); close(); toast("💜 Thank you! The admins will take a look."); }
      catch (err) { toast(errMsg(err), true); send.disabled = false; }
    });
    drawPills(); modal.append(form); document.body.append(modal); document.addEventListener("keydown", esc);
    setTimeout(() => text.focus(), 50);
  }
  const fbBtn = h("button", { type: "button", class: "fb-float", "aria-label": "Send feedback", title: "Send feedback", onclick: openFeedback }, h("span", { "aria-hidden": "true" }, "💡"), h("span", { class: "fb-float-t" }, "Feedback"));
  document.body.append(fbBtn);
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-feedback]"); if (a) { e.preventDefault(); openFeedback(); } });

  // The community guidelines in a pop-up. onAgree (optional) adds an "I agree" button.
  function openGuidelines(onAgree) {
    const G = window.VCGuidelines;
    const modal = h("div", { class: "modal gl-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "gl_title" });
    const close = () => { modal.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const item = (x) => Array.isArray(x) ? h("li", {}, x[0], h("ol", { type: "a" }, x[1].map((y) => h("li", {}, y)))) : h("li", {}, x);
    const scroller = h("div", { class: "gl-body", tabindex: "0" },
      G.intro.map((p) => h("p", {}, p)),
      h("p", { class: "gl-note" }, G.note),
      h("h3", {}, "Ground rules"),
      G.sections.flatMap(([title, list]) => [h("h4", {}, title), h("ol", {}, list.map(item))]));
    const agree = onAgree ? h("button", { type: "button", class: "btn gold", onclick: () => { onAgree(); close(); } }, "I've read them and agree") : null;
    modal.append(h("div", { class: "modal-box gl-box" },
      h("div", { class: "toggle-row gl-head" }, h("h2", { id: "gl_title", style: "margin:0" }, "📜 Community guidelines"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
      scroller,
      h("div", { class: "actions", style: "margin:0" }, agree, h("button", { type: "button", class: "btn ghost", onclick: close }, onAgree ? "Close" : "Done"))));
    document.body.append(modal);
    (agree || scroller).focus();
  }

  // Text boxes grow with what's typed, so long answers are easy to read and edit (especially on phones).
  function autoGrow(t) {
    if (!t || t.tagName !== "TEXTAREA" || !t.offsetParent) return;
    t.style.height = "auto";
    const max = Math.max(240, Math.round(window.innerHeight * 0.7));
    t.style.height = Math.min(t.scrollHeight + 2, max) + "px";
    t.style.overflowY = t.scrollHeight + 2 > max ? "auto" : "hidden";
  }
  const growAll = (root) => (root || document).querySelectorAll("textarea").forEach(autoGrow);
  document.addEventListener("input", (e) => autoGrow(e.target));
  document.addEventListener("focusin", (e) => autoGrow(e.target));
  window.addEventListener("resize", () => growAll());
  new MutationObserver(() => { clearTimeout(growAll._t); growAll._t = setTimeout(() => growAll(), 50); }).observe(document.getElementById("app"), { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

  // A password box with a Show / Hide button.
  function pwToggle(input) {
    const btn = h("button", { type: "button", class: "pw-eye", "aria-pressed": "false", "aria-label": "Show password" }, "Show");
    btn.addEventListener("click", () => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus();
    });
    return h("div", { class: "pw-wrap" }, input, btn);
  }

  function renderAuth(mode) {
    document.title = (mode === "join" ? "Make a profile" : "Log in") + " · Velvet Collar";
    const msg = h("p", { class: "status bad", role: "alert" });
    const field = (label, input, hint) => h("div", { class: "field" }, h("label", { for: (input.tagName === "INPUT" ? input : input.querySelector("input")).id }, label), input, hint ? h("span", { class: "hint" }, hint) : null);
    const slugIn = h("input", { type: "text", id: "a_slug", autocomplete: "username", autocapitalize: "off", spellcheck: "false", maxlength: 200, required: true, placeholder: mode === "join" ? "Pick a profile name, like velvet_kitten" : "Your profile name" });
    // Just the name. If someone pastes their whole link (or @name), keep only the name part.
    slugIn.addEventListener("input", () => { slugIn.value = slugIn.value.trim().toLowerCase().replace(/\/+$/, "").replace(/^.*\//, "").replace(/^@/, "").replace(/[^a-z0-9_-]/g, "").slice(0, 32); slugLink.textContent = slugIn.value ? `Your page: ${location.host}/${slugIn.value}` : ""; });
    const slugLink = h("span", { class: "hint slug-link" });
    const pwIn = h("input", { type: "password", id: "a_pw", autocomplete: mode === "join" ? "new-password" : "current-password", minlength: 8, maxlength: 72, required: true });
    const btn = h("button", { class: "btn gold", type: "submit" }, mode === "join" ? "Make my profile" : "Log in");
    let form;

    if (mode === "join") {
      const codeIn = h("input", { type: "text", id: "a_code", autocomplete: "off", autocapitalize: "off", spellcheck: "false", required: true });
      const pw2In = h("input", { type: "password", id: "a_pw2", autocomplete: "new-password", minlength: 8, maxlength: 72, required: true });
      const ageBox = h("input", { type: "checkbox", id: "a_age" });
      const ageRow = h("div", { class: "field gl-agree" }, h("label", { class: "check", for: "a_age" }, ageBox, h("span", {}, "I'm 21 or older.")));
      ageBox.addEventListener("change", () => ageRow.classList.remove("missing"));
      const glBox = h("input", { type: "checkbox", id: "a_gl" });
      const glRow = h("div", { class: "field gl-agree" },
        h("label", { class: "check", for: "a_gl" }, glBox, h("span", {}, "I've read and agree to the ",
          h("a", { href: "#", onclick: (e) => { e.preventDefault(); openGuidelines(() => { glBox.checked = true; glRow.classList.remove("missing"); }); } }, "community guidelines"), ".")),
        h("span", { class: "hint" }, "Tap the link to read them. This is for joining the group online; play parties have their own vetting."));
      glBox.addEventListener("change", () => glRow.classList.remove("missing"));
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
        h("div", { class: "field" }, h("label", { for: "a_slug" }, "Profile name"),
          slugIn,
          slugStatus, slugLink, h("span", { class: "hint" }, "What you log in with, and your page's address. It's also your display name to start with; you can change how your name shows in Edit.")),
        field("Password", pwToggle(pwIn), "At least 8 characters."),
        field("Password again", pwToggle(pw2In)),
        ageRow, glRow,
        msg, btn,
        h("p", { class: "faint" }, "Already have one? ", h("a", { href: "/login", "data-nav": "" }, "Log in")));
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); msg.textContent = "";
        if (pwIn.value !== pw2In.value) { msg.textContent = "The passwords don't match."; return pw2In.focus(); }
        if (!ageBox.checked) { msg.textContent = "Velvet Collar is for members 21 and older. Please confirm your age."; ageRow.classList.add("missing"); return ageBox.focus(); }
        if (!glBox.checked) { msg.textContent = "Please read and agree to the community guidelines first."; glRow.classList.add("missing"); return glBox.focus(); }
        btn.disabled = true; btn.textContent = "Making it…";
        try {
          const res = await pb.send("/api/vc/signup", { method: "POST", body: { join_code: codeIn.value, display_name: slugIn.value.charAt(0).toUpperCase() + slugIn.value.slice(1), slug: slugIn.value, password: pwIn.value, age21: ageBox.checked, guidelines: window.VCGuidelines.VERSION } });
          pb.authStore.save(res.token, res.record);
          afterAuth(res.record, true);
        } catch (err) {
          const d = err.response || {};
          msg.textContent = d.message || errMsg(err);
          const focus = { join_code: codeIn, display_name: slugIn, slug: slugIn, password: pwIn, age21: ageBox, guidelines: glBox }[d.field];
          if (focus) focus.focus();
          btn.disabled = false; btn.textContent = "Make my profile";
        }
      });
    } else {
      form = h("form", { class: "auth-form panel" },
        field("Profile name", slugIn),
        field("Password", pwToggle(pwIn)),
        msg, btn,
        h("p", { class: "faint" }, "New here? ", h("a", { href: "/join", "data-nav": "" }, "Make a profile"), " · Forgot your password? Ask an admin to reset it."));
      form.addEventListener("submit", async (e) => {
        e.preventDefault(); msg.textContent = "";
        btn.disabled = true; btn.textContent = "Logging in…";
        try {
          const res = await pb.collection("members").authWithPassword(slugIn.value.trim(), pwIn.value);
          afterAuth(res.record, false);
        } catch (err) {
          msg.textContent = err.status === 429 ? "Too many tries. Wait a minute and try again." : "That profile name and password don't match.";
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
    if (path === "events") return { name: "events" };
    if (path === "hunt") return { name: "hunt", start: (q.get("start") || "").toLowerCase() };
    if (path.startsWith("hunt/")) return { name: "huntgame", id: path.slice(5) };
    if (path === "whispers") return { name: "whispers" };
    if (path === "confessions" || path === "confess") return { name: "confessions" };
    if (path === "truthordare" || path === "tod") return { name: "truthordare" };
    if (path === "bingo") return { name: "bingo" };
    if (path === "hotseat" || path === "hot-seat") return { name: "hotseat" };
    if (path === "match" || path === "mystery") return { name: "match" };
    if (path === "network" || path === "networking") return { name: "network" };
    if (path.startsWith("whispers/")) return { name: "whisper", id: path.slice(9) };
    if (path === "mod" || path.startsWith("mod/")) return { name: "mod", tab: path.slice(4) };   // old address
    if (path === "admin" || path.startsWith("admin/")) return { name: "mod", tab: path.slice(6) };
    if (path === "question") return { name: "question" };
    if (path === "vetting" || path === "apply") return { name: "vetting" };
    if (path === "volunteer" || path === "volunteers") return { name: "volunteer" };
    if (path === "velvetcollar" || path === "about" || path === "group") return { name: "group" };
    return { name: "profile", slug: path.split("/")[0] };
  }
  function go(path) { history.pushState(null, "", path); render(); window.scrollTo(0, 0); }
  window.addEventListener("popstate", render);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); go(a.getAttribute("href")); }
  });

  // What's waiting on me: hunt invites, hunt turns and unread whispers. Shared by the nav badge and the Playroom tiles.
  let pendingAsk = null, pendingAt = 0;
  function getPending(fresh) {
    if (!me()) return Promise.resolve(null);
    if (pendingAsk && !fresh && Date.now() - pendingAt < 15000) return pendingAsk;
    pendingAt = Date.now();
    pendingAsk = Promise.all([pb.send("/api/vc/hunts", {}).catch(() => null), pb.send("/api/vc/whispers", {}).catch(() => null), pb.send("/api/vc/games/pending", {}).catch(() => null)]).then(([hu, wh, gm]) => {
      const hunts = hu ? hu.hunts : [], chats = wh ? wh.chats : [], games = gm || {};
      const invites = hunts.filter((x) => x.invitedMe), turns = hunts.filter((x) => x.myTurn), unread = chats.filter((x) => x.status === "active" && x.unread);
      const extra = (games.tod ? 1 : 0) + (games.bingo ? 1 : 0) + (games.match ? 1 : 0) + (games.hotseat || 0);
      return { invites, turns, unread, games, hunt: invites.length + turns.length, total: invites.length + turns.length + unread.length + extra };
    });
    return pendingAsk;
  }
  async function drawNavBadge(fresh) {
    const p = await getPending(fresh);
    const btn = nav.querySelector(".playroom-link");
    if (!btn) return;
    const old = btn.querySelector(".nav-badge"); if (old) old.remove();
    if (p && p.total) btn.append(h("span", { class: "nav-badge", "aria-label": `${p.total} waiting for you` }, String(p.total)));
  }
  setInterval(() => { if (me() && document.visibilityState === "visible") drawNavBadge(true); }, 90000);
  // Activity for the Admin "Activity" tab: which section was opened, and a beat every 5 minutes while the site is on screen.
  const PAGE_OF = { home: "members", profile: "profile", playroom: "playroom", events: "events", hunt: "hunt", huntgame: "hunt", whispers: "whispers", whisper: "whispers", confessions: "confessions", truthordare: "truthordare", bingo: "bingo", match: "match", hotseat: "hotseat", network: "network", edit: "edit", question: "question", vetting: "vetting", volunteer: "volunteer", mod: "admin" };
  function seen(page) { if (me()) pb.send("/api/vc/seen", { method: "POST", body: { page: page || "" }, requestKey: null }).catch(() => {}); }
  // Every 2 minutes while the site is on screen (that also keeps the green "online" dot fresh).
  setInterval(() => { if (document.visibilityState === "visible") seen(); }, 120000);
  // Leaving or switching away takes the dot off straight away (keepalive lets it finish as the page closes).
  function away() {
    if (!me()) return;
    try { fetch(pb.baseURL.replace(/\/+$/, "") + "/api/vc/seen", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", Authorization: pb.authStore.token }, body: JSON.stringify({ away: true }) }).catch(() => {}); } catch {}
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") seen(); else away(); });
  window.addEventListener("pagehide", away);
  document.addEventListener("visibilitychange", () => { if (me() && document.visibilityState === "visible") drawNavBadge(true); });

  function renderNav() {
    nav.replaceChildren();
    if (typeof fbBtn !== "undefined") fbBtn.hidden = !me() || route().name === "edit" || route().name === "mod";
    const user = me();
    const here = route().name;
    const playroom = h("a", { class: "btn small ghost playroom-link" + (here === "playroom" ? " current" : ""), href: "/playroom", "data-nav": "" }, "Playroom");
    if (!user) {
      // Visitors land on the events calendar; About is the group page (or the sign-up pitch).
      nav.append(
        h("a", { class: "btn small ghost" + (here === "events" ? " current" : ""), href: "/events", "data-nav": "" }, "Events"),
        h("a", { class: "btn small ghost" + (here === "group" ? " current" : ""), href: "/velvetcollar", "data-nav": "" }, "About"),
        h("a", { class: "btn small ghost", href: "/login", "data-nav": "" }, "Log in"),
        h("a", { class: "btn small gold", href: "/join", "data-nav": "" }, "Join"));
    } else {
      nav.append(
        playroom,
        h("a", { class: "btn small ghost" + (here === "events" ? " current" : ""), href: "/events", "data-nav": "" }, "Events"),
        h("a", { class: "btn small ghost" + (here === "home" ? " current" : ""), href: "/", "data-nav": "" }, "Members"),
        h("a", { class: "btn small ghost", href: "/" + user.slug, "data-nav": "" }, "My profile"),
        h("a", { class: "btn small gold", href: "/edit", "data-nav": "" }, "Edit"),
      );
      // Admins, owners and hosts get an Admin button (with a count of open reports, and new vetting forms for owners).
      const badges = user.badges || [];
      const isAdmin = badges.includes("admin") || badges.includes("owner");
      if (isAdmin || badges.includes("host")) {
        const modBtn = h("a", { class: "btn small ghost" + (here === "mod" ? " current" : ""), href: "/admin", "data-nav": "", title: "Admin tools" }, "🛡️ Admin");
        nav.append(modBtn);
        pb.send("/api/vc/mod/summary", {}).then((sm) => { const n = (sm.openReports || 0) + (sm.newForms || 0) + (sm.newConfessions || 0) + (sm.newFeedback || 0) + (sm.newVolunteers || 0) + (sm.vetMatches || 0); if (n) modBtn.append(h("span", { class: "nav-badge", "aria-label": `${n} waiting: reports, vetting forms and confessions to review` }, String(n))); }).catch(() => {});
      }
      drawNavBadge(here === "playroom");
    }
  }

  async function render() {
    renderNav();
    const r = route();
    setLook({}, null, false);
    app.replaceChildren(h("p", { class: "center-msg muted" }, "Loading…"));
    try {
      if (me()) { try { await pb.collection("members").authRefresh(); } catch (e) { if (e.status === 401 || e.status === 404) pb.authStore.clear(); } renderNav(); }
      seen(PAGE_OF[r.name]);
      checkConsent().then(volNews).then(announce);
      if (r.name === "home") return me() ? await renderDirectory() : await renderEvents(true);
      if (r.name === "edit") return me() ? await renderEditor() : renderLogin("/edit");
      if (r.name === "login" || r.name === "join") return me() ? go("/") : renderAuth(r.name);
      if (r.name === "playroom") return await renderPlayroom();
      if (r.name === "events") return await renderEvents();
      if (r.name === "hunt") return me() ? await window.VCHunt.renderLobby(app, r.start) : renderLogin("/hunt");
      if (r.name === "whispers") return me() ? await window.VCWhisper.renderLobby(app) : renderLogin("/whispers");
      if (r.name === "confessions") return me() ? await window.VCConfess.render(app) : renderLogin("/confessions");
      if (r.name === "match") return me() ? await window.VCMatch.render(app) : renderLogin("/match");
      if (r.name === "hotseat") return me() ? await window.VCHotSeat.render(app) : renderLogin("/hotseat");
      if (r.name === "bingo") return me() ? await window.VCBingo.render(app) : renderLogin("/bingo");
      if (r.name === "truthordare") return me() ? await window.VCTod.render(app) : renderLogin("/truthordare");
      if (r.name === "network") return me() ? await window.VCNetwork.render(app) : renderLogin("/network");
      if (r.name === "whisper") return me() ? await window.VCWhisper.renderChat(app, r.id) : renderLogin("/whispers/" + r.id);
      if (r.name === "mod") return me() ? await window.VCMod.render(app, r.tab) : renderLogin("/admin");
      if (r.name === "huntgame") return me() ? await window.VCHunt.renderGame(app, r.id) : renderLogin("/hunt/" + r.id);
      if (r.name === "question") return me() ? await renderQuestion() : renderLogin("/question");
      if (r.name === "vetting") return me() ? await renderVetting() : renderLogin("/vetting");
      if (r.name === "volunteer") return me() ? await renderVolunteer() : renderLogin("/volunteer");
      if (r.name === "group") return await renderGroup(me() ? undefined : renderLanding);
      return await renderProfile(r.slug);
    } catch (err) {
      // Busy for a moment: say so and try again by itself rather than showing an error.
      if (busyPath !== location.pathname) { busyPath = location.pathname; busyTries = 0; }
      if (err && err.status === 429 && busyTries < 4) {
        busyTries++;
        app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "One sec…"), h("p", { class: "muted" }, "Lots going on right now. Trying again in a few seconds.")));
        setTimeout(render, 6000 * busyTries);
        return;
      }
      app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "Hmm."), h("p", { class: "muted" }, errMsg(err))));
    }
  }
  let busyTries = 0, busyPath = "";

  // ---------- landing ----------
  function renderLanding() {
    document.title = "Velvet Collar Profiles";
    app.replaceChildren(
      h("section", { class: "hero" },
        h("div", { class: "logo", role: "img", "aria-label": "Velvet Collar: curiosity, embodied" },
          h("span", { class: "mark", "aria-hidden": "true" }),
          h("span", { class: "name", "aria-hidden": "true" }, "Velvet Collar"),
          h("span", { class: "tagline", "aria-hidden": "true" }, "Curiosity, embodied")),
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
    const whisperTile = h("a", { class: "game hunt-game", href: "/whispers", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🤫"),
      h("span", { class: "game-txt" }, h("b", {}, "Whispers"), h("span", {}, "Anonymous flirting with a matched member. No names, no faces, just words and emojis. Opt in to play.")),
      h("span", { class: "game-go" }, "Open"));
    const huntTile = h("a", { class: "game hunt-game", href: "/hunt", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🏹"),
      h("span", { class: "game-txt" }, h("b", {}, "The Hunt"), h("span", {}, "🐺 Hunter vs 🐇 prey: a turn-based kink chase for two. Each turn is one hour of the night. Catch them before dawn, or escape. Opt in to play.")),
      h("span", { class: "game-go" }, "Play"));
    const confessTile = h("a", { class: "game hunt-game", href: "/confessions", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "💌"),
      h("span", { class: "game-txt" }, h("b", {}, "The Confession Box"), h("span", {}, "Slip a secret through the screen. Anonymous confessions, approved by the hosts, and the group reacts.")),
      h("span", { class: "game-go" }, "Open"));
    const netTile = h("a", { class: "game hunt-game", href: "/network", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🤝"),
      h("span", { class: "game-txt" }, h("b", {}, "Networking"), h("span", {}, "Find members who share your kinks and your romantic side, and join interest circles. Opt in to play.")),
      h("span", { class: "game-go" }, "Open"));
    const todTile = h("a", { class: "game hunt-game", href: "/truthordare", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🎲"),
      h("span", { class: "game-txt" }, h("b", {}, "Truth or Dare Roulette"), h("span", {}, "A truth or a dare every day at the heat you pick, never touching your limits. Answer, add a photo if you dare, keep your streak and chase the weekly crown. Opt in to play.")),
      h("span", { class: "game-go" }, "Play"));
    const bingoTile = h("a", { class: "game hunt-game", href: "/bingo", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🔢"),
      h("span", { class: "game-txt" }, h("b", {}, "Kink Bingo"), h("span", {}, "A fresh 5×5 card every month: munches, kind notes, vouches and a few spicy squares. Five in a row gets a shout-out, a full card gets legend status.")),
      h("span", { class: "game-go" }, "Play"));
    const matchTile = h("a", { class: "game hunt-game", href: "/match", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🎭"),
      h("span", { class: "game-txt" }, h("b", {}, "Mystery Match"), h("span", {}, "Every Monday you're secretly paired with someone who shares your kinks, romance or hobbies. Chat all week under aliases, then reveal on Sunday if you both say yes. Opt in to play.")),
      h("span", { class: "game-go" }, "Play"));
    const hotTile = h("a", { class: "game hunt-game", href: "/hotseat", "data-nav": "" },
      h("span", { class: "game-emoji", "aria-hidden": "true" }, "🔥"),
      h("span", { class: "game-txt" }, h("b", {}, "Hot Seat"), h("span", {}, "Pick a question from the deck and put another player in the hot seat. Answers go on the wall for a week, then into the archive. Opt in to play.")),
      h("span", { class: "game-go" }, "Play"));
    grid.prepend(hotTile, todTile, matchTile, bingoTile, huntTile, whisperTile, confessTile, netTile);
    // Flag the tiles when something is waiting on you.
    getPending(true).then((p) => {
      if (!p) return;
      const flag = (tile, text, href) => {
        tile.classList.add("waiting");
        if (href) tile.setAttribute("href", href);
        tile.querySelector(".game-txt").prepend(h("span", { class: "game-badge" }, text));
      };
      const name = (g) => (g.other ? g.other.display_name : "Someone");
      if (p.hunt) flag(huntTile, p.hunt === 1 ? (p.invites.length ? `🔔 ${name(p.invites[0])} invited you` : `⚡ Your move against ${name(p.turns[0])}`)
        : [p.invites.length ? `🔔 ${p.invites.length} invite${p.invites.length === 1 ? "" : "s"}` : "", p.turns.length ? `⚡ ${p.turns.length} waiting on your move` : ""].filter(Boolean).join(" · "),
        p.hunt === 1 ? "/hunt/" + (p.invites[0] || p.turns[0]).id : null);
      if (p.games && p.games.hotseat) flag(hotTile, p.games.hotseat === 1 ? "🔥 You're in the hot seat!" : `🔥 ${p.games.hotseat} questions for you`);
      if (p.games && p.games.match) flag(matchTile, { new: "🎭 You have a new mystery match", unread: "💬 Your mystery match wrote to you", reveal: "🎭 It's reveal day!" }[p.games.match] || "🎭");
      if (p.games && p.games.bingo) flag(bingoTile, "🆕 This month's card is ready");
      if (p.games && p.games.tod) flag(todTile, p.games.tod === "spin" ? "🎰 Today's card is waiting" : "🎯 Your card needs an answer");
      if (p.unread.length) flag(whisperTile, p.unread.length === 1 ? `💬 ${p.unread[0].them} whispered to you` : `💬 ${p.unread.length} new whispers`,
        p.unread.length === 1 ? "/whispers/" + p.unread[0].id : null);
    });
    app.replaceChildren(
      h("section", { class: "playroom-head" },
        h("h1", {}, "Playroom"),
        h("p", { class: "muted" }, `Games made for ${CFG.GROUP_NAME || "the group"}. Each one opens in a new tab.`)),
      grid);
  }

  // ---------- events (added by admins in the dashboard) ----------
  // `landing`: the welcome page visitors see at / (what's coming up, and a way into the calendar).
  async function renderEvents(landing) {
    document.title = "Events · Velvet Collar";
    const data = await pb.send("/api/vc/events", {});
    const guest = !me();
    const toLogin = (path) => { try { sessionStorage.setItem("vc_after_login", "/events"); } catch {} go(path); };
    const all = [...data.past.slice().reverse(), ...data.upcoming];
    const now = Date.now();
    const isPast = (ev) => { const end = parseDate(ev.ends) || (parseDate(ev.starts) + 6 * 3600e3); return end < now; };
    // Pacific calendar day of a time, as "2026-10-24".
    const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    const dayKey = (t) => dayFmt.format(new Date(t));
    const today = dayKey(now);
    // Colour, first match wins: you're going (gold), vetted only (velvet), hosted by Velvet Collar (pink), get vetted here (green), anything else.
    const kind = (ev) => (ev.mine ? "going" : ev.vetting === "required" ? "vetonly" : ev.hosted ? "hosted" : ev.vetting === "offered" ? "vet" : "other");
    const KINDS = [["going", "You're going"], ["hosted", "Hosted by Velvet Collar"], ["vet", "Get vetted here"], ["vetonly", "Vetted members only"], ["other", "Other events"], ["bday", "Birthdays"]];
    // Birthdays members chose to put on the calendar. Feb 29 birthdays show on Feb 28 in other years.
    const BD = data.birthdays || [];
    const bdMd = (b, y) => b.birthday === "02-29" && !((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? "02-28" : b.birthday;
    const bdaysOn = (key) => BD.filter((b) => bdMd(b, +key.slice(0, 4)) === key.slice(5));
    const bdayCard = (b, y) => {
      const turning = b.birth_year ? y - b.birth_year : 0;
      const when = new Date(Date.UTC(y, +bdMd(b, y).slice(0, 2) - 1, +bdMd(b, y).slice(3), 12)).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
      const isToday = `${y}-${bdMd(b, y)}` === today;
      return h("article", { class: "event k-bday" },
        h("div", { class: "event-emoji", "aria-hidden": "true" }, isToday ? "🎉" : "🎂"),
        h("div", { class: "event-body" },
          h("div", { class: "event-tags" }, h("span", { class: "ev-tag bday" }, isToday ? "🎉 Today!" : "🎂 Birthday")),
          h("h2", {}, `${b.display_name}'s birthday`),
          h("p", { class: "event-when" }, when + (turning > 0 ? ` · turning ${turning}` : "")),
          h("div", { class: "actions", style: "margin:10px 0 0" }, personChip(b), h("a", { class: "btn small ghost", href: "/" + b.slug, "data-nav": "" }, isToday ? "Say happy birthday 💜" : "See their page"))));
    };

    // ---- add to calendar ----
    const icsTime = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
    const endOf = (ev) => parseDate(ev.ends) || parseDate(ev.starts) + 2 * 3600e3;
    const detailsOf = (ev) => [ev.description, ev.url && safeUrl(ev.url) ? ev.url : "", `${location.origin}/events`].filter(Boolean).join("\n\n");
    const icsEvent = (ev) => ["BEGIN:VEVENT", `UID:${ev.id}@${location.hostname}`, `DTSTAMP:${icsTime(now)}`, `DTSTART:${icsTime(parseDate(ev.starts))}`, `DTEND:${icsTime(endOf(ev))}`,
      `SUMMARY:${icsText((ev.emoji ? ev.emoji + " " : "") + ev.title)}`, ev.where ? `LOCATION:${icsText(ev.where)}` : "", `DESCRIPTION:${icsText(detailsOf(ev))}`, `URL:${location.origin}/events`, "END:VEVENT"].filter(Boolean);
    const downloadIcs = (list, name) => {
      const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Velvet Collar//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...list.flatMap(icsEvent), "END:VCALENDAR"].join("\r\n");
      const a = h("a", { href: URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" })), download: name });
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    const googleUrl = (ev) => "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: (ev.emoji ? ev.emoji + " " : "") + ev.title,
      dates: icsTime(parseDate(ev.starts)) + "/" + icsTime(endOf(ev)), details: detailsOf(ev), location: ev.where || "" }).toString();
    const slug = (s) => String(s || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
    const addMenu = (ev) => {
      const menu = h("div", { class: "cal-add-menu", hidden: true },
        h("a", { class: "btn small ghost", href: googleUrl(ev), target: "_blank", rel: "noopener" }, "Google Calendar ↗"),
        h("button", { type: "button", class: "btn small ghost", onclick: () => { downloadIcs([ev], slug(ev.title) + ".ics"); toast("Calendar file downloaded. Open it to add the event."); } }, "Apple / Outlook (.ics)"));
      const btn = h("button", { type: "button", class: "btn small ghost", "aria-expanded": "false", onclick: () => { menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); } }, "📅 Add to my calendar");
      return [btn, menu];
    };

    // ---- one event ----
    const eventCard = (ev, noId) => {
      const card = h("article", noId ? { class: "event" } : { class: "event", id: "ev_" + ev.id });
      const draw = (ev) => {
        const past = isPast(ev);
        const ends = ev.ends ? parseDate(ev.ends) : null;
        card.className = "event k-" + kind(ev) + (past ? " past" : "") + (ev.notInterested ? " not-int" : "");
        card.replaceChildren(
          h("div", { class: "event-emoji", "aria-hidden": "true" }, ev.emoji || "📅"),
          h("div", { class: "event-body" },
            h("div", { class: "event-tags" },
              ev.mine ? h("span", { class: "ev-tag going" }, past ? "✓ You went" : "✓ You're going") : null,
              ev.interested ? h("span", { class: "ev-tag interested" }, "⭐ You're interested") : null,
              ev.notInterested ? h("span", { class: "ev-tag" }, "🙈 Not interested") : null,
              ev.hosted ? h("span", { class: "ev-tag hosted" }, "💜 Hosted by Velvet Collar") : null,
              ev.volunteer ? h("a", { class: "ev-tag vol", href: "/volunteer", "data-nav": "" }, ev.volunteer.status === "approved" ? "🙋 You're volunteering" + (ev.volunteer.role.length ? ": " + ev.volunteer.role.map((r) => ({ setup: "setup", crew: "party crew", breakdown: "breakdown" })[r] || r).join(", ") : "") : "🙋 Volunteer form sent") : null,
              ev.vetting === "offered" ? h("a", { class: "ev-tag vet", href: "/vetting", "data-nav": "" }, "✅ Get vetted here") : null,
              ev.vetting === "required" ? h("a", { class: "ev-tag vetonly", href: "/vetting", "data-nav": "", title: "Fill in the vetting form first" }, "🔒 Vetted members only") : null),
            h("h2", {}, ev.title),
            h("p", { class: "event-when" }, ends ? fmtWhen(ev.starts).replace(" " + TZ_LABEL, "") + " – " + timeShort(ends) : fmtWhen(ev.starts), ev.where ? h("span", {}, " · 📍 " + ev.where) : null),
            ev.description ? h("p", { class: "event-desc" }, ev.description) : null,
            guest ? null : h("div", { class: "event-people" },
              ev.people.slice(0, 12).map(personChip),
              ev.others ? h("span", { class: "faint" }, `+${ev.others} more`) : null,
              !ev.going && !ev.interestedCount ? h("span", { class: "faint" }, past ? "Nobody signed up." : "Be the first to say you're going!") : null),
            ev.interestedCount && !guest ? h("div", { class: "event-people interested-row" },
              h("span", { class: "faint" }, "⭐ Interested:"),
              (ev.intPeople || []).slice(0, 12).map(personChip),
              ev.intOthers ? h("span", { class: "faint" }, `+${ev.intOthers} more`) : null) : null,
            h("div", { class: "actions", style: "margin:10px 0 0" },
              past ? h("span", { class: "faint" }, `${ev.going} went`) : guest ? h("span", { class: "faint guest-rsvp" }, "🔒 Members can RSVP · ",
                h("button", { type: "button", class: "linkish", onclick: () => toLogin("/login") }, "Log in")) : (() => {
                // "I'm going" and "Interested" are one choice: tapping the one you picked clears it.
                // "Not interested" hides it from your calendar (into the Not interested section); any other choice brings it back.
                const set = async (status, btns) => {
                  btns.forEach((x) => { x.disabled = true; });
                  const wasHidden = !!ev.notInterested;
                  try {
                    const upd = await pb.send("/api/vc/rsvp", { method: "POST", body: { event: ev.id, status } });
                    Object.assign(ev, upd);
                    if (wasHidden !== !!ev.notInterested) { drawGrid(); drawList(); } else { draw(ev); drawGrid(); }
                    toast(upd.notInterested ? "🙈 Hidden. It's under “Not interested” at the bottom if you change your mind." : upd.mine ? "🎉 See you there!" : upd.interested ? "⭐ Marked as interested" : wasHidden ? "👀 Back on your calendar" : "Taken off the list");
                  } catch (err) { toast(errMsg(err), true); btns.forEach((x) => { x.disabled = false; }); }
                };
                const go = h("button", { type: "button", class: "btn small " + (ev.mine ? "gold" : ""), "aria-pressed": String(!!ev.mine) }, ev.mine ? "✓ I'm going" : "I'm going");
                const maybe = h("button", { type: "button", class: "btn small interested-btn" + (ev.interested ? " on" : ""), "aria-pressed": String(!!ev.interested) }, ev.interested ? "⭐ Interested" : "☆ Interested");
                const nope = h("button", { type: "button", class: "btn small ghost not-int-btn", "aria-pressed": String(!!ev.notInterested), title: ev.notInterested ? "Put it back on your calendar" : "Hide it from your calendar" }, ev.notInterested ? "👀 Show it again" : "🙈 Not interested");
                go.addEventListener("click", () => set(ev.mine ? "" : "going", [go, maybe, nope]));
                maybe.addEventListener("click", () => set(ev.interested ? "" : "interested", [go, maybe, nope]));
                nope.addEventListener("click", () => set(ev.notInterested ? "" : "not", [go, maybe, nope]));
                return [go, maybe, nope];
              })(),
              past ? null : addMenu(ev),
              !past && !guest && ev.volunteers && !ev.volunteer ? h("a", { class: "btn small ghost", href: "/volunteer?event=" + ev.id, "data-nav": "" }, "🙋 Volunteer") : null,
              ev.url && safeUrl(ev.url) ? h("a", { class: "btn small ghost", href: safeUrl(ev.url), target: "_blank", rel: "noopener" }, "Details ↗") : null,
              !past ? h("span", { class: "faint" }, `${ev.going} going` + (ev.interestedCount ? ` · ${ev.interestedCount} interested` : "")) : null)));
      };
      draw(ev);
      return card;
    };

    // ---- the month grid ----
    let [vy, vm] = today.split("-").map(Number);   // shown year and month (1–12)
    let picked = "";                                // a picked day, or "" for the whole month
    const title = h("h2", { class: "cal-title" });
    const grid = h("div", { class: "cal-grid", role: "grid" });
    const listHead = h("div", { class: "toggle-row cal-list-head" });
    const list = h("div", { class: "events" });
    const monthKey = () => `${vy}-${String(vm).padStart(2, "0")}`;
    // Events you said "Not interested" to stay off the calendar; they're listed at the bottom instead.
    const evsOn = (key, withHidden) => all.filter((ev) => dayKey(parseDate(ev.starts)) === key && (withHidden || !ev.notInterested));
    function drawGrid() {
      title.textContent = new Date(Date.UTC(vy, vm - 1, 15)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
      const first = new Date(Date.UTC(vy, vm - 1, 1)).getUTCDay(), days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
      const cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => h("div", { class: "cal-dow", role: "columnheader" }, d));
      for (let i = 0; i < first; i++) cells.push(h("div", { class: "cal-day empty" }));
      for (let d = 1; d <= days; d++) {
        const key = `${monthKey()}-${String(d).padStart(2, "0")}`;
        const evs = evsOn(key), bds = bdaysOn(key), n = evs.length + bds.length;
        const cls = "cal-day" + (key === today ? " today" : "") + (key < today ? " gone" : "") + (key === picked ? " picked" : "") + (n ? " has" : "") + (bds.length ? " bday" : "");
        const chips = [
          ...bds.map((b) => h("span", { class: "cal-ev k-bday" }, h("span", { class: "cal-ev-e", "aria-hidden": "true" }, "🎂"), h("span", { class: "cal-ev-t" }, b.display_name))),
          ...evs.map((ev) => h("span", { class: "cal-ev k-" + kind(ev) + (ev.interested ? " int" : "") }, h("span", { class: "cal-ev-e", "aria-hidden": "true" }, ev.emoji || "📅"), h("span", { class: "cal-ev-t" }, (ev.interested ? "☆ " : "") + ev.title)))];
        cells.push(h(n ? "button" : "div", Object.assign({ class: cls }, n ? { type: "button", "aria-label": `${d}: ${[...bds.map((b) => b.display_name + "'s birthday"), ...evs.map((x) => x.title)].join(", ")}`, onclick: () => { picked = picked === key ? "" : key; drawGrid(); drawList(); } } : {}),
          h("span", { class: "cal-num" }, d),
          h("span", { class: "cal-evs" }, chips.slice(0, 3), n > 3 ? h("span", { class: "cal-more" }, `+${n - 3}`) : null)));
      }
      grid.replaceChildren(...cells);
    }
    function drawList() {
      const inView = picked ? evsOn(picked, true) : all.filter((ev) => dayKey(parseDate(ev.starts)).startsWith(monthKey()));
      const evs = inView.filter((ev) => !ev.notInterested), nope = inView.filter((ev) => ev.notInterested && !isPast(ev));
      const upcoming = evs.filter((ev) => !isPast(ev)), past = evs.filter(isPast).reverse();
      const label = picked ? new Date(picked + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : `All of ${title.textContent}`;
      listHead.replaceChildren(...[h("h2", { style: "margin:0" }, label), picked ? h("button", { type: "button", class: "btn small ghost", onclick: () => { picked = ""; drawGrid(); drawList(); } }, "Show the whole month") : null].filter(Boolean));
      const bds = picked ? bdaysOn(picked) : BD.filter((b) => bdMd(b, vy).startsWith(String(vm).padStart(2, "0") + "-")).sort((a, b) => bdMd(a, vy) < bdMd(b, vy) ? -1 : 1);
      list.replaceChildren(...bds.map((b) => bdayCard(b, vy)), ...upcoming.map(eventCard), ...past.map(eventCard));
      if (!evs.length && !bds.length) list.append(h("p", { class: "muted" }, picked ? "Nothing on this day." : "Nothing on the calendar this month yet. Keep an eye on the group chat!"));
      if (nope.length) list.append(h("details", { class: "not-int-box" }, h("summary", {}, `🙈 Not interested (${nope.length})`),
        h("p", { class: "faint", style: "margin:6px 0 10px" }, "Events you've hidden from your calendar. Tap “Show it again”, I'm going or Interested to bring one back."), ...nope.map(eventCard)));
    }
    const move = (n) => { vm += n; if (vm < 1) { vm = 12; vy--; } if (vm > 12) { vm = 1; vy++; } picked = ""; drawGrid(); drawList(); };
    const mine = () => data.upcoming.filter((ev) => ev.mine || ev.interested);
    const allMine = h("button", { type: "button", class: "btn small ghost", title: "One calendar file with every upcoming event you're going to or interested in", onclick: () => {
      const list = mine(); if (!list.length) return toast("Tap I'm going or Interested on an event first.", true);
      downloadIcs(list, "velvet-collar-my-events.ics"); toast(`Calendar file with ${list.length} event${list.length === 1 ? "" : "s"} downloaded. Open it to add them.`);
    } }, "📅 Add all my events");

    drawGrid(); drawList();
    // A link to a day (/events?day=2026-10-24) opens the calendar on that day.
    const askDay = new URLSearchParams(location.search).get("day") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(askDay)) { [vy, vm] = askDay.split("-").map(Number); picked = askDay; drawGrid(); drawList(); }
    // Start on the month of the next event if this month has nothing coming up.
    const next = askDay ? null : data.upcoming[0];
    const bdaySoon = BD.some((b) => `${vy}-${bdMd(b, vy)}` >= today && `${vy}-${bdMd(b, vy)}`.startsWith(monthKey()));
    if (next && !bdaySoon && !all.some((ev) => !isPast(ev) && dayKey(parseDate(ev.starts)).startsWith(monthKey()))) { [vy, vm] = dayKey(parseDate(next.starts)).split("-").map(Number); drawGrid(); drawList(); }
    // ---- coming up: the next few events, tap one to jump to it ----
    const openEvent = (ev) => {
      [vy, vm] = dayKey(parseDate(ev.starts)).split("-").map(Number); picked = dayKey(parseDate(ev.starts)); drawGrid(); drawList();
      const el = document.getElementById("ev_" + ev.id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
    };
    const soon = data.upcoming.filter((ev) => !ev.notInterested).slice(0, 4);
    const comingUp = h("section", { class: "coming-up" },
      h("h2", {}, "✨ Coming up"),
      soon.length ? h("div", { class: "cu-list" }, soon.map((ev) => {
        const t = parseDate(ev.starts);
        return h("button", { type: "button", class: "cu-card k-" + kind(ev), onclick: () => openEvent(ev) },
          h("span", { class: "cu-date" }, h("b", {}, new Date(t).toLocaleDateString(undefined, { day: "numeric", timeZone: TZ })), h("small", {}, new Date(t).toLocaleDateString(undefined, { month: "short", timeZone: TZ }))),
          h("span", { class: "cu-txt" }, h("b", {}, (ev.emoji ? ev.emoji + " " : "") + ev.title),
            h("small", {}, new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: TZ }) + (ev.going ? ` · ${ev.going} going` : "") + (ev.mine ? " · ✓ you're going" : ""))));
      })) : h("p", { class: "muted", style: "margin:0" }, "Nothing on the calendar yet. Keep an eye on the group chat!"));
    const calPanel = () => h("section", { class: "panel cal" },
        h("div", { class: "cal-bar" },
          h("button", { type: "button", class: "btn small ghost", "aria-label": "Previous month", onclick: () => move(-1) }, "‹"),
          title,
          h("button", { type: "button", class: "btn small ghost", "aria-label": "Next month", onclick: () => move(1) }, "›"),
          h("button", { type: "button", class: "btn small ghost cal-today", onclick: () => { [vy, vm] = today.split("-").map(Number); picked = ""; drawGrid(); drawList(); } }, "Today")),
        grid,
        guest ? h("div", { class: "cal-legend" }, KINDS.filter(([k]) => k !== "going" && k !== "bday").map(([k, l]) => h("span", {}, h("i", { class: "k-" + k, "aria-hidden": "true" }), l)))
          : h("div", { class: "cal-legend" }, KINDS.map(([k, l]) => h("span", {}, h("i", { class: "k-" + k, "aria-hidden": "true" }), l)), h("span", {}, h("i", { class: "k-int", "aria-hidden": "true" }), "You're interested"), allMine));
    // Visitors: a short welcome, then the next events in full, then the calendar to browse (folded on phones).
    if (guest && !landing) {
      app.replaceChildren(
        h("section", { class: "playroom-head guest-head" }, h("h1", {}, "Events calendar"),
          h("p", { class: "muted" }, "Tap a day to see what's on. Locations and who's going are shown to members."),
          h("div", { class: "actions" }, h("button", { type: "button", class: "btn gold", onclick: () => toLogin("/join") }, "Join us"),
            h("small", { class: "faint" }, "You'll need the join code from the group chat."))),
        calPanel(), listHead, list);
      return;
    }
    if (guest) {
      // The welcome page: the next event as an invitation, the rest as a short run of dates, and how to join.
      const fmt = (t, o) => new Date(t).toLocaleString(undefined, Object.assign({ timeZone: TZ }, o));
      const timeRange = (ev) => { const a = parseDate(ev.starts), b = ev.ends ? parseDate(ev.ends) : 0; return fmt(a, { hour: "numeric", minute: "2-digit" }) + (b ? " to " + fmt(b, { hour: "numeric", minute: "2-digit" }) : ""); };
      const dayHref = (ev) => "/events?day=" + dayKey(parseDate(ev.starts));
      const tagFor = (ev) => ev.vetting === "required" ? h("span", { class: "lp-tag vetonly" }, "Vetted members only") : ev.hosted ? h("span", { class: "lp-tag hosted" }, "Hosted by Velvet Collar") : ev.vetting === "offered" ? h("span", { class: "lp-tag vet" }, "Get vetted here") : null;
      const [first, ...rest] = data.upcoming;
      const ticket = first ? (() => {
        const t = parseDate(first.starts);
        return h("article", { class: "lp-ticket k-" + kind(first), "aria-label": "Next event: " + first.title },
          h("div", { class: "lp-stub" },
            h("span", { class: "lp-stub-dow" }, fmt(t, { weekday: "long" })),
            h("span", { class: "lp-stub-day" }, fmt(t, { day: "numeric" })),
            h("span", { class: "lp-stub-mon" }, fmt(t, { month: "long" }))),
          h("div", { class: "lp-ticket-body" },
            h("p", { class: "lp-next" }, "Next up"),
            h("h2", {}, (first.emoji ? first.emoji + " " : "") + first.title),
            h("p", { class: "lp-time" }, timeRange(first) + " " + TZ_LABEL),
            first.description ? h("p", { class: "lp-desc" }, first.description) : null,
            tagFor(first),
            h("div", { class: "lp-ticket-actions" }, ...addMenu(first),
              h("a", { class: "lp-link", href: dayHref(first), "data-nav": "" }, "See it on the calendar"))));
      })() : h("article", { class: "lp-ticket empty" }, h("div", { class: "lp-ticket-body" }, h("h2", {}, "Nothing posted yet"), h("p", { class: "lp-desc" }, "New munches and parties show up here as soon as the hosts add them.")));
      const run = rest.slice(0, 5);
      app.replaceChildren(
        h("section", { class: "lp-hero" },
          h("div", { class: "lp-intro" },
            h("p", { class: "lp-where" }, "Sacramento, 21 and over"),
            h("h1", {}, "Find your people, then find them in person."),
            h("p", { class: "lp-lede" }, "Velvet Collar is a sex-positive kink community. We host munches, game nights, classes and play parties built on consent and curiosity."),
            h("div", { class: "lp-cta" },
              h("button", { type: "button", class: "btn gold", onclick: () => toLogin("/join") }, "Join Velvet Collar"),
              h("button", { type: "button", class: "btn ghost", onclick: () => toLogin("/login") }, "Log in"))),
          ticket),
        run.length ? h("section", { class: "lp-run" },
          h("div", { class: "lp-run-head" }, h("h2", {}, "After that"), h("a", { class: "lp-link", href: "/events", "data-nav": "" }, "Full calendar")),
          h("ol", { class: "lp-dates" }, run.map((ev) => {
            const t = parseDate(ev.starts);
            return h("li", {}, h("a", { class: "lp-date-row k-" + kind(ev), href: dayHref(ev), "data-nav": "" },
              h("span", { class: "lp-d" }, h("b", {}, fmt(t, { day: "numeric" })), h("small", {}, fmt(t, { month: "short" }))),
              h("span", { class: "lp-r" }, h("b", {}, (ev.emoji ? ev.emoji + " " : "") + ev.title), h("small", {}, fmt(t, { weekday: "long" }) + ", " + timeRange(ev))),
              tagFor(ev)));
          })),
          data.upcoming.length > run.length + 1 ? h("p", { class: "faint lp-more" }, `${data.upcoming.length - run.length - 1} more on the calendar.`) : null) : null,
        h("section", { class: "lp-join" },
          h("h2", {}, "How to join"),
          h("ol", { class: "lp-steps" },
            h("li", {}, h("b", {}, "Get the join code"), h("span", {}, "It's shared in the Velvet Collar Telegram group chat.")),
            h("li", {}, h("b", {}, "Make your profile"), h("span", {}, "Your kinks, limits, links and photos, on one page you control.")),
            h("li", {}, h("b", {}, "RSVP and show up"), h("span", {}, "Members see where events are and who's going. Some play parties ask you to get vetted first."))),
          h("p", { class: "lp-join-foot" }, h("a", { class: "lp-link", href: "/velvetcollar", "data-nav": "" }, "More about Velvet Collar"))));
      return;
    }
    app.replaceChildren(
      h("section", { class: "playroom-head" }, h("h1", {}, "Events"),
        h("p", { class: "muted" }, "Munches, game nights and play parties. Tap a day to see what's on. Tap I'm going so people know who to look for, or Interested if you're thinking about it. Only members on the member list are shown by name."),
        h("p", { class: "vf-cta" }, "🔒 Some play parties need you to be vetted first. ", h("a", { href: "/vetting", "data-nav": "" }, "Fill in the vetting form →")),
        h("p", { class: "vf-cta" }, "🙋 Want to help make our events happen? ", h("a", { href: "/volunteer", "data-nav": "" }, "Volunteer at an event →"))),
      comingUp, calPanel(), listHead, list);
  }

  // ---------- the group's own profile page (/velvetcollar). Admins and owners edit it on the Admin page. ----------
  // `fallback` is used on the home page: if the group page is members-only or not set up, show the usual welcome page.
  async function renderGroup(fallback) {
    let d;
    try { d = await pb.send("/api/vc/group", {}); }
    catch (err) {
      if (fallback) return fallback();
      if (err.status === 401) return renderLogin("/velvetcollar"); if (err.status === 404) return notFound(); throw err;
    }
    const g = d.page, user = me();
    document.title = g.name;
    const pageUrl = location.origin + "/velvetcollar";
    const paras = (text) => String(text || "").split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((t) => h("p", { class: "bio group-p" }, t));
    const banner = h("div", { class: "banner group-banner" });
    if (g.cover) banner.style.backgroundImage = `linear-gradient(180deg, transparent 40%, rgba(0,0,0,.35)), url("${fileUrl(g, g.cover, "1200x400")}")`;
    const logo = g.logo ? h("img", { class: "avatar", src: fileUrl(g, g.logo, "400x400"), alt: "" })
      : h("div", { class: "avatar group-mark", "aria-hidden": "true" }, h("span", { class: "mark" }));
    const sharePost = () => copyText([`💜 ${g.name}`, g.tagline, g.location ? "📍 " + g.location : "", "", pageUrl].filter((x, i) => x || i === 3).join("\n"), "📣 Copied! Paste it in Telegram.");
    const head = h("div", { class: "profile-card group-card" }, banner,
      h("div", { class: "profile-head" }, logo,
        h("h1", { class: "profile-name" }, g.name),
        g.tagline ? h("div", { class: "handle group-tagline" }, g.tagline) : null,
        h("div", { class: "chips" },
          g.location ? h("span", { class: "chip" }, "📍 " + g.location) : null,
          d.members ? h("span", { class: "chip gold" }, `👥 ${d.members} member${d.members === 1 ? "" : "s"}`) : null,
          h("span", { class: "chip" }, "🔞 21+")),
        h("div", { class: "actions" },
          d.canEdit ? h("a", { class: "btn gold", href: "/admin/group", "data-nav": "" }, "✏️ Edit this page") : null,
          shareButton({ url: pageUrl, title: g.name, extra: [["📝", "Copy a ready-made post", "The group name, tagline and link, ready to paste in Telegram.", sharePost]] }))));
    const main = [], side = [];
    if (g.about) main.push(h("section", { class: "panel" }, h("h2", {}, "About us"), paras(g.about)));
    for (const sec of g.sections || []) main.push(h("section", { class: "panel" }, sec.title ? h("h2", {}, [sec.emoji, sec.title].filter(Boolean).join(" ")) : null, paras(sec.body)));
    main.push(h("section", { class: "panel" }, h("h2", {}, "📜 Community guidelines"),
      h("p", { class: "muted", style: "margin-top:0" }, "How we look after each other. Everyone agrees to these when they join."),
      h("button", { type: "button", class: "btn", onclick: () => openGuidelines(null) }, "Read the guidelines")));
    const links = (g.links || []).filter((l) => safeUrl(l.url));
    if (links.length) side.push(h("section", { class: "keyring" }, h("h2", {}, "🔗 Links"),
      h("div", { class: "link-list" }, links.map((l) => h("a", { class: "link", href: safeUrl(l.url), target: "_blank", rel: "noopener" },
        h("span", { class: "mono emoji", "aria-hidden": "true" }, l.emoji || "🔗"),
        h("span", { class: "txt" }, h("b", {}, l.title), h("small", {}, l.note || hostOf(l.url))),
        h("span", { class: "ext", "aria-hidden": "true" }, "↗"))))));
    if (d.events.length) side.push(h("section", { class: "panel" }, h("h2", {}, "💜 Our next events"),
      h("div", { class: "group-events" }, d.events.map((ev) => h("a", { class: "group-ev", href: "/events", "data-nav": "" },
        h("span", { class: "group-ev-e", "aria-hidden": "true" }, ev.emoji || "📅"),
        h("span", {}, h("b", {}, ev.title), h("small", { class: "faint" }, fmtWhen(ev.starts) + (ev.where ? " · " + ev.where : "") + (ev.vetting === "required" ? " · 🔒 vetted only" : ev.vetting === "offered" ? " · ✅ get vetted" : "")))))),
      h("a", { class: "btn small ghost", href: "/events", "data-nav": "", style: "margin-top:10px" }, "See the calendar →")));
    if (d.team.length) side.push(h("section", { class: "panel" }, h("h2", {}, "🛡️ The team"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "Questions, worries or ideas? Any of us can help."),
      h("div", { class: "group-team" }, d.team.map((m) => h("div", { class: "group-tm" }, personChip(m), h("small", { class: "faint" }, m.role))))));
    if (!user) side.push(h("section", { class: "panel" }, h("h2", {}, "Join us"),
      h("p", { class: "muted", style: "margin-top:0" }, "Members get a profile, the member list, events and games. You'll need the join code from the group chat."),
      h("div", { class: "actions", style: "margin:0" }, h("a", { class: "btn gold", href: "/join", "data-nav": "" }, "Make your profile"), h("a", { class: "btn ghost", href: "/login", "data-nav": "" }, "Log in"))));
    app.replaceChildren(head, h("div", { class: "profile-body" + (side.length ? "" : " no-side") }, h("div", { class: "main" }, main), side.length ? h("div", { class: "side" }, side) : null));
  }

  // ---------- vetting form (for play parties that need it; owners read it on the Admin page) ----------
  async function renderVetting() {
    document.title = "Get vetted · Velvet Collar";
    const data = await pb.send("/api/vc/vetting/form", {});
    const A = data.answers || {};
    const user = me();
    const ctl = {};   // question id -> { get(), focus() }
    const reqMark = (q) => (q.req ? h("span", { class: "vf-req", "aria-hidden": "true" }, " *") : null);
    const block = (q, ...kids) => h("div", { class: "vf-q", id: "q_" + q.id }, ...kids);
    const radios = (q, opts) => {
      const name = "vf_" + q.id;
      const els = opts.map(([v, label]) => { const r = h("input", { type: "radio", name, value: v }); if (String(A[q.id]) === String(v)) r.checked = true; return [r, label]; });
      return { els, get: () => { const c = els.find(([r]) => r.checked); return c ? c[0].value : ""; }, focus: () => els[0][0].focus() };
    };
    const qs = data.questions.map((q) => {
      const legend = h("span", { class: "label vf-label" }, q.q, reqMark(q));
      if (q.type === "text" || q.type === "email") {
        const inp = h("input", { type: q.type === "email" ? "email" : "text", id: "vf_" + q.id, maxlength: 200, value: A[q.id] || "", autocomplete: q.type === "email" ? "email" : "off" });
        ctl[q.id] = { get: () => inp.value.trim(), focus: () => inp.focus() };
        return block(q, h("label", { class: "field", for: "vf_" + q.id }, legend, inp));
      }
      if (q.type === "long") {
        const ta = h("textarea", { id: "vf_" + q.id, rows: 3, maxlength: 3000 }); ta.value = A[q.id] || "";
        ctl[q.id] = { get: () => ta.value.trim(), focus: () => ta.focus() };
        return block(q, h("label", { class: "field", for: "vf_" + q.id }, legend, ta));
      }
      if (q.type === "yesno") {
        const r = radios(q, [["yes", "Yes"], ["no", "No"]]); ctl[q.id] = r;
        return block(q, h("fieldset", { class: "vf-set" }, h("legend", {}, legend), h("div", { class: "vf-opts row" }, r.els.map(([el, l]) => h("label", { class: "check" }, el, l)))));
      }
      if (q.type === "choice") {
        const prev = String(A[q.id] || "");
        const isOther = prev.startsWith("Other: ");
        const r = radios(q, [...q.options.map((o) => [o, o]), ["other", "Other:"]]);
        const other = h("input", { type: "text", maxlength: 300, placeholder: "Tell us", "aria-label": "Other", value: isOther ? prev.slice(7) : "" });
        if (isOther) r.els[r.els.length - 1][0].checked = true;
        other.addEventListener("input", () => { if (other.value) r.els[r.els.length - 1][0].checked = true; });
        ctl[q.id] = { get: r.get, focus: r.focus, other: () => other.value.trim() };
        return block(q, h("fieldset", { class: "vf-set" }, h("legend", {}, legend), h("div", { class: "vf-opts" },
          r.els.map(([el, l], i) => h("label", { class: "check" }, el, l, i === r.els.length - 1 ? other : null)))));
      }
      if (q.type === "scale") {
        const r = radios(q, [1, 2, 3, 4, 5].map((n) => [String(n), String(n)])); ctl[q.id] = r;
        return block(q, h("fieldset", { class: "vf-set" }, h("legend", {}, legend),
          h("div", { class: "vf-scale" }, h("span", { class: "faint" }, q.low), h("div", { class: "vf-nums" }, r.els.map(([el, l]) => h("label", {}, el, h("span", {}, l)))), h("span", { class: "faint" }, q.high))));
      }
      if (q.type === "agree") {
        const cb = h("input", { type: "checkbox", id: "vf_" + q.id }); cb.checked = !!A[q.id];
        ctl[q.id] = { get: () => cb.checked, focus: () => cb.focus() };
        return block(q, h("fieldset", { class: "vf-set" }, h("legend", {}, legend), h("ul", { class: "vf-bullets" }, q.bullets.map((b) => h("li", {}, b))),
          h("label", { class: "check" }, cb, h("b", {}, "Yes, I agree"))));
      }
      return null;
    });

    const send = h("button", { type: "submit", class: "btn gold", disabled: !data.hasPhoto }, "Send my form");
    const form = h("form", { class: "panel vf-form", novalidate: true }, h("p", { class: "faint", style: "margin-top:0" }, h("span", { class: "vf-req" }, "*"), " Required"), qs,
      h("div", { class: "actions" }, send, !data.hasPhoto ? h("span", { class: "faint" }, "Add a profile photo first (see above).") : null));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const body = {};
      for (const q of data.questions) { body[q.id] = ctl[q.id].get(); if (ctl[q.id].other) body[q.id + "_other"] = ctl[q.id].other(); }
      const missing = data.questions.find((q) => q.req && !body[q.id]);
      form.querySelectorAll(".vf-q.missing").forEach((el) => el.classList.remove("missing"));
      if (missing) {
        document.getElementById("q_" + missing.id).classList.add("missing");
        document.getElementById("q_" + missing.id).scrollIntoView({ behavior: "smooth", block: "center" });
        ctl[missing.id].focus();
        return toast(missing.type === "agree" ? "Please agree to the event guidelines." : "That one's required.", true);
      }
      send.disabled = true;
      try {
        await pb.send("/api/vc/vetting/form", { method: "POST", body });
        toast("Form sent 📨");
        app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "📨 Thank you!"),
          h("p", {}, "Your form is with the owners. Our team is small, so please be patient. We try to respond within 3 business days."),
          h("p", { class: "muted" }, "We may ask for a copy of a government ID to finish vetting. Any copies are destroyed once your review is done."),
          h("a", { class: "btn", href: "/" + user.slug, "data-nav": "" }, "Back to my profile")));
        window.scrollTo(0, 0);
      } catch (err) {
        const f = err && err.response && err.response.field;
        if (f && document.getElementById("q_" + f)) { document.getElementById("q_" + f).classList.add("missing"); document.getElementById("q_" + f).scrollIntoView({ behavior: "smooth", block: "center" }); }
        toast(errMsg(err), true); send.disabled = !data.hasPhoto;
      }
    });

    // Members only ever learn that they're vetted. Nothing about pending, on hold or denied.
    const status = data.vetted ? h("section", { class: "panel vf-status ok" }, h("b", {}, "✅ You're vetted."), " Only you can see this. You don't need to send this again unless the team asks you to.") : null;
    const photo = h("section", { class: "panel vf-photo" + (data.hasPhoto ? "" : " missing") },
      avatarEl(user, "sm"),
      data.hasPhoto ? h("div", {}, h("b", {}, "📷 Profile photo: ✓"), h("p", { class: "faint", style: "margin:2px 0 0" }, "This is the photo the team will see with your form."))
        : h("div", {}, h("b", {}, "📷 A profile photo is required"), h("p", { class: "faint", style: "margin:2px 0 8px" }, "Add one to your profile so the team knows who to look for. Your answers here aren't saved until you send them."),
          h("a", { class: "btn small gold", href: "/edit", "data-nav": "" }, "Add a profile photo")));
    const formEl = data.vetted ? h("details", { class: "vf-again" }, h("summary", {}, "Send an updated form anyway"), form) : form;
    app.replaceChildren(
      h("section", { class: "playroom-head" }, h("h1", {}, "✅ Get vetted"),
        h("p", {}, "Welcome to Velvet. We cultivate inclusive, consent-based, and sex-positive events. This form helps us get to know you, your desires, and your values to ensure a great fit for our community. Some play parties need you to be vetted first."),
        h("p", { class: "muted" }, "After you send it, a member of our team will be in touch to discuss next steps. Our team is small, so please be patient. We try to respond within 3 business days."),
        h("p", { class: "faint" }, "We respect your privacy: only the group's owners read these answers. We may ask for a copy of a government ID to complete your application; any copies are destroyed once your vetting review is done. Never send ID photos here.")),
      status, photo, formEl);
  }

  // ---------- volunteering (owners approve on the Admin page) ----------
  const VOL_EXPECT = [
    ["🧰 Setup crew", ["Arrive on time (set-up start time will be shared by Nyc and Jess).", "Be prepared to jump in wherever help is needed: moving furniture, decorating, setting up equipment, organizing supplies, cleaning, or other general event preparation.", "Wear comfortable clothing and shoes suitable for lifting, carrying, and moving around.", "Ask questions if you're unsure how something should be done. We'd rather answer questions than have you guess.", "Respect the venue and handle all equipment and decorations with care.", "Once setup is complete, check back in with us before heading out."]],
    ["🎉 Party crew (during the party)", ["Arrive on time and check in with us (party crew time will be shared by Nyc and Jess).", "Help with last-minute prep and food.", "Help welcome guests and tour party spaces.", "Help hand out drinks and snacks.", "Restock supplies (water, snacks, safer sex supplies, paper products, etc.) as needed.", "Help keep common areas clean and tidy throughout the event.", "Help keep the atmosphere welcoming by being approachable, friendly, and helpful.", "Let us know if you notice spills, broken equipment, safety concerns, or supplies running low.", "If someone needs help or raises a concern, listen without judgment and promptly connect them with Nyc or Jess. Volunteers are not expected to mediate conflicts or handle consent issues.", "Don't drink to intoxication or use substances that would impair your ability to volunteer.", "If you'd like to join in scenes, check in with Nyc or Jess so we can adjust party coverage.", "Check in with us before heading out."]],
    ["🧹 Breakdown crew", ["Stay after the party to help with breakdown.", "Cleanup: removing decor, collecting trash, returning safer-sex supplies, collecting laundry and dishes, wiping down shared surfaces and equipment, and gathering lost and found.", "Venue reset: returning furniture to where it was, packing away decor, equipment, laundry and dishes, helping load supplies into the car, and telling us if anything is damaged or missing.", "Making sure the venue is back in the agreed-upon condition. Check in with us before you leave so we know everything's done."]],
    ["🚫 Volunteers are NOT expected to", ["Mediate disputes or investigate consent concerns. Grab Jess or Nyc.", "Handle emergencies beyond letting Nyc or Jess know.", "Take part in scenes, conversations, or physical affection they're uncomfortable with.", "Basically, if something feels uncomfortable, find Nyc or Jess! We'd much rather answer questions and step in than have you feel you need to solve a problem on your own."]],
  ];
  async function renderVolunteer() {
    document.title = "Volunteer · Velvet Collar";
    const d = await pb.send("/api/vc/volunteer", {});
    const P = d.prefill || {};
    const want = new URLSearchParams(location.search).get("event") || "";
    const ST = { pending: "⏳ Waiting for the owners", approved: "🎉 You're on the crew!", declined: "💜 Not this time", withdrawn: "↩️ Withdrawn" };
    const evLabel = (ev) => ev ? `${ev.emoji || "📅"} ${ev.title} · ${fmtWhen(ev.starts)}` : "📅 Any upcoming event";

    // ---- my forms ----
    const mineList = () => {
      const open = d.mine.filter((v) => v.status !== "withdrawn" && (!v.event || parseDate(v.event.starts) > Date.now() - 864e5));
      if (!open.length) return null;
      return h("section", { class: "panel vol-mine" }, h("h2", {}, "🙋 My volunteering"),
        open.map((v) => h("div", { class: "vol-row " + v.status },
          h("div", {}, h("b", {}, evLabel(v.event)), h("div", { class: "vol-st" }, ST[v.status] || v.status,
            v.status === "approved" && v.role.length ? h("span", {}, " · ", v.role.map((r) => d.roles[r] || r).join(", ")) : null,
            v.status === "pending" ? h("small", { class: "faint" }, " · you offered: " + v.roles.map((r) => d.roles[r] || r).join(", ")) : null),
            v.message ? h("p", { class: "vn-msg" }, "💬 “" + v.message + "”") : null),
          v.status === "pending" || v.status === "approved" ? h("button", { type: "button", class: "btn small ghost", onclick: async () => {
            if (!confirm(v.status === "approved" ? "Step down from volunteering at this event? Please also message Nyc or Jess so they can plan." : "Withdraw this volunteer form?")) return;
            try { await pb.send(`/api/vc/volunteer/${v.id}/withdraw`, { method: "POST", body: {} }); toast("Withdrawn"); renderVolunteer(); } catch (err) { toast(errMsg(err), true); }
          } }, v.status === "approved" ? "Step down" : "Withdraw") : null)));
    };

    // ---- the form ----
    const field = (id, label, el, req, hint) => h("div", { class: "vf-q", id: "q_" + id }, h("label", { class: "field", for: "vo_" + id }, h("span", { class: "label vf-label" }, label, req ? h("span", { class: "vf-req", "aria-hidden": "true" }, " *") : null), el, hint ? h("span", { class: "hint" }, hint) : null));
    const evSel = h("select", { id: "vo_event" }, h("option", { value: "" }, "Pick an event…"), d.events.map((ev) => h("option", { value: ev.id }, evLabel(ev))), h("option", { value: "any" }, "✨ Any upcoming event, wherever you need me"));
    if (want && d.events.some((ev) => ev.id === want)) evSel.value = want;
    const name = h("input", { type: "text", id: "vo_name", maxlength: 80, value: P.name || "", autocomplete: "name" });
    const pron = h("input", { type: "text", id: "vo_pronouns", maxlength: 40, value: P.pronouns || "", placeholder: "she/her, he/him, they/them…" });
    const phone = h("input", { type: "tel", id: "vo_phone", maxlength: 30, value: P.phone || "", autocomplete: "tel", placeholder: "(916) 555-0123" });
    const roleBoxes = ["setup", "crew", "breakdown", "any"].filter((k) => d.roles[k]).map((k) => { const cb = h("input", { type: "checkbox", value: k }); cb.checked = (P.roles || []).indexOf(k) !== -1; return h("label", { class: "check" }, cb, d.roles[k]); });
    const ta = (id, v, ph) => { const t = h("textarea", { id: "vo_" + id, rows: 3, maxlength: 2000, placeholder: ph || "" }); t.value = v || ""; return t; };
    const access = ta("access", P.access), why = ta("why", P.why), extra = ta("extra", P.extra, "“Nope!” is a fine answer.");
    const agreeBoxes = d.agree.map((t) => { const cb = h("input", { type: "checkbox" }); return [cb, h("label", { class: "check" }, cb, t)]; });
    const send = h("button", { type: "submit", class: "btn gold" }, "🙋 Send my volunteer form");
    const form = h("form", { class: "panel vf-form", novalidate: true },
      h("h2", { style: "margin-top:0" }, "Volunteer form"),
      h("p", { class: "faint", style: "margin-top:0" }, h("span", { class: "vf-req" }, "*"), " Required. Only the owners see your answers and phone number."),
      d.events.length ? null : h("p", { class: "vf-status panel" }, "No events are open for volunteers right now. You can still offer to help at “any upcoming event”, and the owners will match you up."),
      field("event", "Which event would you like to help with?", evSel, true),
      field("name", "Name / preferred name", name, true),
      field("pronouns", "Preferred pronouns", pron, false),
      field("phone", "Phone number", phone, true, "So Nyc and Jess can reach you about timings."),
      h("div", { class: "vf-q", id: "q_roles" }, h("fieldset", { class: "vf-set" }, h("legend", {}, h("span", { class: "label vf-label" }, "Which volunteer role(s) are you interested in?", h("span", { class: "vf-req" }, " *"))), h("div", { class: "vf-opts" }, roleBoxes))),
      field("access", "Do you have any accessibility needs or physical limitations we should know about?", access, false),
      field("why", "Why would you like to volunteer with Velvet Collar?", why, true),
      h("div", { class: "vf-q", id: "q_agree" }, h("fieldset", { class: "vf-set" }, h("legend", {}, h("span", { class: "label vf-label" }, "Expectations", h("span", { class: "vf-req" }, " *"))),
        h("p", { class: "faint", style: "margin:0 0 6px" }, "Read the expectations above, then tick each one."), h("div", { class: "vf-opts" }, agreeBoxes.map((x) => x[1])))),
      field("extra", "Is there anything you'd like us to know that would help make volunteering a great experience for you?", extra, true),
      h("div", { class: "actions" }, send));
    const flag = (id, msg, el) => {
      form.querySelectorAll(".vf-q.missing").forEach((x) => x.classList.remove("missing"));
      const q = document.getElementById("q_" + id); if (q) { q.classList.add("missing"); q.scrollIntoView({ behavior: "smooth", block: "center" }); }
      if (el) el.focus();
      toast(msg, true);
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const roles = roleBoxes.map((l) => l.querySelector("input")).filter((c) => c.checked).map((c) => c.value);
      if (!evSel.value) return flag("event", "Pick the event you'd like to help with.", evSel);
      if (!name.value.trim()) return flag("name", "Please tell us your name.", name);
      if (phone.value.replace(/\D/g, "").length < 7) return flag("phone", "Please add a phone number.", phone);
      if (!roles.length) return flag("roles", "Pick at least one role.");
      if (!why.value.trim()) return flag("why", "That one's required.", why);
      const unticked = agreeBoxes.find(([cb]) => !cb.checked);
      if (unticked) return flag("agree", "Please tick all the expectations.", unticked[0]);
      if (!extra.value.trim()) return flag("extra", "That one's required (“Nope!” is fine).", extra);
      send.disabled = true;
      try {
        await pb.send("/api/vc/volunteer", { method: "POST", body: { event: evSel.value, name: name.value, pronouns: pron.value, phone: phone.value, roles, access: access.value, why: why.value, extra: extra.value, agreed: true } });
        app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "🙋 Thank you!"),
          h("p", {}, "Your volunteer form is with the owners. You'll see their answer here on the site, and Nyc or Jess will reach out with details if you're on the crew."),
          h("p", { class: "muted" }, "Sending a form doesn't guarantee a volunteer spot or a discounted ticket. We rotate volunteers fairly between events."),
          h("div", { class: "actions", style: "justify-content:center" }, h("a", { class: "btn gold", href: "/volunteer", "data-nav": "" }, "See my volunteering"), h("a", { class: "btn ghost", href: "/events", "data-nav": "" }, "Back to Events"))));
        window.scrollTo(0, 0);
      } catch (err) {
        const f = err && err.response && err.response.field;
        if (f) flag(f, errMsg(err)); else toast(errMsg(err), true);
        send.disabled = false;
      }
    });

    app.replaceChildren(
      h("section", { class: "playroom-head" }, h("h1", {}, "🙋 Volunteer"),
        h("p", {}, "Thank you for your interest in volunteering with Velvet Collar! Our volunteers are an essential part of creating welcoming, safe, and memorable experiences for our community."),
        h("p", { class: "muted" }, "Volunteer opportunities include event setup, party crew during the event, and breakdown afterwards. We rotate opportunities fairly, while also considering each event's needs, your availability, and the events you plan to attend. Sending a form doesn't guarantee a volunteer spot or discounted ticket, but it helps us match volunteers to upcoming events.")),
      mineList() || "",
      h("section", { class: "panel vol-expect" }, h("h2", {}, "What volunteers do"),
        VOL_EXPECT.map(([t, items]) => h("details", { class: "vol-x" }, h("summary", {}, t), h("ul", {}, items.map((x) => h("li", {}, x)))))),
      form);
  }

  // ---------- question of the week (set by admins in the dashboard) ----------
  async function renderQuestion() {
    document.title = "Question of the week · Velvet Collar";
    const data = await pb.send("/api/vc/question", {});
    if (!data.question) {
      app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "No question this week"), h("p", { class: "muted" }, "Check back soon!")));
      return;
    }
    const ta = h("textarea", { maxlength: 280, rows: 3, placeholder: "Your answer…", "aria-label": "Your answer" });
    ta.value = data.mine || "";
    const save = h("button", { type: "button", class: "btn gold small" }, data.mine ? "Update my answer" : "Share my answer");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try { await pb.send("/api/vc/answer", { method: "POST", body: { text: ta.value.trim() } }); toast(ta.value.trim() ? "Answer shared! It's on your profile too." : "Answer removed"); renderQuestion(); }
      catch (err) { toast(errMsg(err), true); save.disabled = false; }
    });
    const answers = data.answers.filter((a) => a.text);
    app.replaceChildren(
      h("section", { class: "qotw-hero" }, h("span", { class: "pq" }, "❓ Question of the week"), h("h1", {}, data.question.text)),
      h("section", { class: "panel" }, h("h2", {}, "Your answer"), ta, h("div", { class: "actions", style: "margin:10px 0 0" }, save,
        h("span", { class: "faint" }, "Shows on your profile and below. Clear it and save to remove it."))),
      h("section", { class: "panel" }, h("h2", {}, `Answers (${answers.length + (data.unlisted || 0)})`),
        answers.length ? h("div", { class: "answers" }, answers.map((a) => h("div", { class: "answer" + (a.mine ? " mine" : "") }, personChip(a.member), h("p", {}, a.text))))
          : h("p", { class: "muted" }, "No answers yet. Go first!"),
        data.unlisted ? h("p", { class: "faint" }, `${data.unlisted} more from members who aren't on the member list.`) : null));
  }

  // ---------- member list (logged-in only, opt-in) ----------
  async function renderDirectory() {
    document.title = "Member list · Velvet Collar";
    const user = me();
    const list = await pb.collection("members").getFullList({ filter: "listed = true", sort: "display_name", fields: "id,collectionId,collectionName,slug,display_name,avatar,style,theme,looking_for,created,play_links,matches_off,birthday" });
    const rows = h("div", { class: "link-list" });
    let term = "", filter = "all";
    // The group's own page, pinned to the top of the list.
    const grp = await pb.send("/api/vc/group", {}).catch(() => null);
    const groupRow = grp ? h("a", { class: "link group-row", href: "/velvetcollar", "data-nav": "" },
      h("span", { class: "mono-wrap" }, grp.page.logo ? h("img", { class: "mono photo", src: fileUrl(grp.page, grp.page.logo, "400x400"), alt: "", loading: "lazy" })
        : h("span", { class: "mono group-mono", "aria-hidden": "true" }, h("span", { class: "mark" }))),
      h("span", { class: "txt" }, h("b", {}, grp.page.name, h("span", { class: "new-pill group-pill" }, "💜 Group")), h("small", {}, grp.page.tagline || "Our group page: about us, links and the team")),
      h("span", { class: "arrow", "aria-hidden": "true" }, "→")) : null;
    // Who's on the site right now (green dot). Refreshed every minute while the list is open.
    let onlineSet = new Set(), rank = new Map();
    const loadOnline = () => pb.send("/api/vc/online", { requestKey: null }).then((d) => { onlineSet = new Set(d.online || []); rank = new Map((d.order || []).map((id, i) => [id, i])); }).catch(() => {});
    await loadOnline();
    const FILTERS = [["all", "Everyone"], ["online", "🟢 Online now"], ["new", "🌱 New this week"], ...LOOKING.filter(([v]) => v !== "nothing").map(([v, e, l]) => [v, `${e} ${l}`])];
    const filterBar = h("div", { class: "pills dir-filters", role: "group", "aria-label": "Filter members" });
    const drawFilters = () => filterBar.replaceChildren(...FILTERS.map(([v, label]) =>
      h("button", { type: "button", class: "pill", "aria-pressed": String(filter === v), onclick: () => { filter = v; drawFilters(); draw(); } }, label)));
    // Sort: most active (online now, then most recently active), A–Z, or newest. Remembered on this device.
    let sortBy = "active"; try { sortBy = localStorage.getItem("vc_dir_sort") || "active"; } catch {}
    const SORTS = [["active", "🔥 Most active"], ["az", "A–Z"], ["new", "🌱 Newest"]];
    const sorted = (items) => {
      const byName = (a, b) => (a.display_name || "").localeCompare(b.display_name || "", undefined, { sensitivity: "base" });
      const byNew = (a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0);
      if (sortBy === "az") return items.slice().sort(byName);
      if (sortBy === "new") return items.slice().sort(byNew);
      const r = (m) => (rank.has(m.id) ? rank.get(m.id) : 1e9);
      return items.slice().sort((a, b) => (onlineSet.has(b.id) - onlineSet.has(a.id)) || (r(a) - r(b)) || byNew(a, b));
    };
    const sortSel = h("select", { class: "dir-sort", "aria-label": "Sort members", onchange: (e) => { sortBy = e.target.value; try { localStorage.setItem("vc_dir_sort", sortBy); } catch {} draw(); } }, SORTS.map(([v, l]) => h("option", { value: v }, l)));
    sortSel.value = sortBy;
    const matchesFilter = (m) => filter === "all" ? true : filter === "online" ? onlineSet.has(m.id) : filter === "new" ? isNew(m) : (m.looking_for || []).includes(filter) || (filter !== "open" && (m.looking_for || []).includes("open"));
    const draw = () => {
      rows.replaceChildren();
      const t = term.trim().toLowerCase();
      const items = sorted(list.filter((m) => (!t || (m.display_name + " " + m.slug).toLowerCase().includes(t)) && matchesFilter(m)));
      if (groupRow && filter === "all" && (!t || (grp.page.name + " velvetcollar group").toLowerCase().includes(t))) rows.append(groupRow);
      if (!items.length) rows.append(h("p", { class: "muted" }, list.length ? "No one matches that." : "No one has joined the list yet."));
      for (const m of items) {
        const row = h("a", { class: "link", href: "/" + m.slug, "data-nav": "" },
          h("span", { class: "mono-wrap" }, m.avatar
            ? h("img", { class: "mono photo", src: fileUrl(m, m.avatar, "200x200"), alt: "", loading: "lazy" })
            : h("span", { class: "mono", "aria-hidden": "true" }, (m.display_name || "?").slice(0, 2).toUpperCase()),
            onlineSet.has(m.id) ? h("span", { class: "dot", title: "Online now", "aria-label": "Online now" }) : null),
          h("span", { class: "txt" }, h("b", {}, m.display_name, isNew(m) ? h("span", { class: "new-pill" }, "New") : null, daysToBday(m.birthday) === 0 ? h("span", { class: "new-pill bday", title: "Birthday today" }, "🎂 Birthday") : null), lookingBadges(m.looking_for, true)),
          h("span", { class: "arrow", "aria-hidden": "true" }, "→"));
        L.apply(L.resolve(m.style, m.theme), row);
        rows.append(row);
      }
    };
    const search = h("input", { class: "search", type: "search", placeholder: `Search ${list.length} ${list.length === 1 ? "member" : "members"}`, "aria-label": "Search members", oninput: (e) => { term = e.target.value; draw(); } });
    drawFilters(); draw();
    const onlineTimer = setInterval(async () => {
      if (!rows.isConnected) return clearInterval(onlineTimer);
      if (document.visibilityState !== "visible") return;
      const before = [...onlineSet].sort().join(); await loadOnline();
      if ([...onlineSet].sort().join() !== before) draw();
    }, 60000);
    const twinsBtn = h("button", { type: "button", class: "btn small" }, "💞 Kink twins");
    const twinsHolder = h("div", {});
    twinsBtn.addEventListener("click", () => kinkTwins(list, twinsBtn, twinsHolder));
    const weekHolder = h("div", { class: "this-week" });
    const crushHolder = h("div", {});
    app.replaceChildren(
      user.listed ? "" : h("p", { class: "faint", style: "margin:0 0 12px" },
        "You're not on the list, so people only find you through your link. ",
        h("a", { href: "/edit#settings", "data-nav": "" }, "Join it in Settings.")),
      weekHolder,
      crushHolder,
      twinsHolder,
      h("section", { class: "panel" },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "Member list"), h("span", { class: "actions", style: "margin:0" }, h("a", { class: "btn small", href: "/network", "data-nav": "" }, "🤝 Networking"), twinsBtn)),
        h("p", { class: "faint", style: "margin-top:4px" }, "Only logged-in members can see this list, and only people who opted in are on it. Open-to-anything members show up under every filter."),
        h("div", { class: "dir-search-row" }, search, sortSel), filterBar, rows),
    );
    drawThisWeek(weekHolder, list);
    drawCrushes(crushHolder);
  }

  async function drawThisWeek(holder, list) {
    const [ev, q, hu, wh, rl] = await Promise.all([
      pb.send("/api/vc/events", {}).catch(() => null),
      pb.send("/api/vc/question", {}).catch(() => null),
      pb.send("/api/vc/hunts", {}).catch(() => null),
      pb.send("/api/vc/whispers", {}).catch(() => null),
      pb.send("/api/vc/relationships", {}).catch(() => null),
    ]);
    const cards = [];
    const next = ev && ev.upcoming.find((x) => !x.notInterested);
    cards.push(h("a", { class: "week-card", href: "/events", "data-nav": "" },
      h("span", { class: "pq" }, "📅 Next event"),
      next ? [h("b", {}, `${next.emoji || ""} ${next.title}`.trim()), h("small", {}, fmtWhen(next.starts) + (next.going ? ` · ${next.going} going` : ""))]
        : [h("b", {}, "Nothing planned yet"), h("small", {}, "See past events")]));
    if (q && q.question) {
      const n = q.answers.filter((a) => a.text).length + (q.unlisted || 0);
      cards.push(h("a", { class: "week-card", href: "/question", "data-nav": "" },
        h("span", { class: "pq" }, "❓ Question of the week"), h("b", {}, q.question.text),
        h("small", {}, q.mine ? `You answered · ${n} answer${n === 1 ? "" : "s"}` : `${n} answer${n === 1 ? "" : "s"} · add yours`)));
    }
    const unread = wh ? wh.chats.filter((x) => x.status === "active" && x.unread) : [];
    if (unread.length) cards.unshift(h("a", { class: "week-card hot", href: unread.length === 1 ? "/whispers/" + unread[0].id : "/whispers", "data-nav": "" },
      h("span", { class: "pq" }, "🤫 Whispers"), h("b", {}, unread.length === 1 ? `${unread[0].them} whispered to you` : `${unread.length} new whispers`), h("small", {}, "Tap to read")));
    const hot = hu ? hu.hunts.filter((x) => x.myTurn || x.invitedMe) : [];
    if (hot.length) cards.unshift(h("a", { class: "week-card hot", href: hot.length === 1 ? "/hunt/" + hot[0].id : "/hunt", "data-nav": "" },
      h("span", { class: "pq" }, "🏹 The Hunt"),
      h("b", {}, hot.length === 1 ? (hot[0].invitedMe ? `${hot[0].other ? hot[0].other.display_name : "Someone"} invited you to a hunt` : `Your move against ${hot[0].other ? hot[0].other.display_name : "them"}`) : `${hot.length} hunts need you`),
      h("small", {}, "Tap to play")));
    // Someone asked to link profiles with you.
    const asks = rl ? rl.relationships.filter((r) => r.status === "pending" && r.direction === "received") : [];
    if (asks.length) cards.unshift(h("a", { class: "week-card hot", href: "/edit#people", "data-nav": "" },
      h("span", { class: "pq" }, "💞 Relationship request"),
      h("b", {}, asks.length === 1 ? `${asks[0].other.display_name} wants to link your pages` : `${asks.length} people want to link your pages`),
      h("small", {}, "Tap to accept or decline")));
    // Birthdays in the next week, soonest first.
    const bdays = (list || []).map((m) => ({ m, d: daysToBday(m.birthday) })).filter((x) => x.d !== null && x.d <= 7).sort((a, b) => a.d - b.d);
    if (bdays.length) {
      const today = bdays.filter((x) => x.d === 0);
      const when = (x) => x.d === 0 ? "today" : x.d === 1 ? "tomorrow" : new Date(Date.now() + x.d * 864e5).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", weekday: "short" });
      const card = h("a", { class: "week-card" + (today.length ? " hot" : ""), href: "/" + bdays[0].m.slug, "data-nav": "" },
        h("span", { class: "pq" }, "🎂 Birthdays"),
        h("b", {}, today.length ? `${today.map((x) => x.m.display_name).join(" & ")}'s birthday today! 🎉` : bdays.slice(0, 3).map((x) => `${x.m.display_name} (${when(x)})`).join(", ")),
        h("small", {}, today.length ? "Say happy birthday 💜" + (bdays.length > today.length ? ` · ${bdays.length - today.length} more this week` : "") : bdays.length > 3 ? `+${bdays.length - 3} more this week` : "Coming up this week"));
      cards.splice(today.length ? 0 : cards.length, 0, card);
    }
    holder.replaceChildren(...cards);
  }

  async function drawCrushes(holder) {
    let c; try { c = await pb.send("/api/vc/crushes", {}); } catch { return; }
    if (!c.matches.length && !c.admirers && !c.sent.length) return;
    holder.replaceChildren(h("section", { class: "panel crush-panel" },
      h("h2", {}, "💘 Crushes"),
      c.matches.length ? [h("p", { class: "match-banner" }, `💞 It's mutual with ${c.matches.length === 1 ? c.matches[0].display_name : c.matches.length + " people"}!`), h("div", { class: "people" }, c.matches.map(personChip))] : null,
      c.admirers ? h("p", { class: "admirers" }, `🤫 ${c.admirers} secret admirer${c.admirers === 1 ? " has" : "s have"} a crush on you. If you crush them back, you'll both find out.`) : null,
      c.sent.filter((m) => !c.matches.some((x) => x.id === m.id)).length
        ? h("details", {}, h("summary", { class: "faint" }, "Your secret crushes"), h("div", { class: "people" }, c.sent.filter((m) => !c.matches.some((x) => x.id === m.id)).map(personChip))) : null));
  }

  // Ranks members by how much their Kink Jars shelf overlaps with yours.
  async function kinkTwins(list, btn, holder) {
    const K = window.KinkJarsImport, user = me();
    const mine = (user.play_links || []).find((l) => isKJ(l.url));
    if (!mine) { holder.replaceChildren(h("section", { class: "panel compat nudge" }, h("p", {}, "💞 Add your Kink Jars shelf in your ", h("a", { href: "/edit#playroom", "data-nav": "" }, "Playroom tab"), " to find your kink twins."))); return; }
    const others = list.filter((m) => m.id !== user.id && !m.matches_off && (m.play_links || []).some((l) => isKJ(l.url)));
    if (!others.length) { holder.replaceChildren(h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, "Nobody else on the list has added a Kink Jars shelf yet."))); return; }
    btn.disabled = true; btn.textContent = "Comparing…";
    try {
      const a = await K.resolve(mine.url);
      const scored = [];
      for (const m of others) {
        try {
          const b = await K.resolve(m.play_links.find((l) => isKJ(l.url)).url);
          const c = K.compare(a, b);
          const score = c.love.length * 3 + c.enjoy.length * 2 + c.curious.length;
          if (score) scored.push({ m, c, score });
        } catch {}
      }
      scored.sort((x, y) => y.score - x.score);
      holder.replaceChildren(h("section", { class: "panel twins" },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "💞 Your kink twins"), h("button", { type: "button", class: "btn small ghost", onclick: () => holder.replaceChildren() }, "Close")),
        h("p", { class: "faint" }, "Members whose Kink Jars shelves overlap most with yours. A conversation starter, not a promise: always ask first."),
        scored.length ? h("ol", { class: "twin-list" }, scored.slice(0, 10).map(({ m, c }) => h("li", {},
          personChip(m),
          h("span", { class: "twin-stats" }, [c.love.length ? `💞 ${c.love.length} both love` : "", c.enjoy.length ? `😊 ${c.enjoy.length} both enjoy` : "", c.curious.length ? `🤔 ${c.curious.length} curious` : ""].filter(Boolean).join(" · ")),
          c.love.length ? h("small", { class: "faint" }, c.love.slice(0, 3).join(", ")) : null)))
          : h("p", { class: "muted" }, "No overlaps yet. Plenty to talk about anyway!")));
    } catch (err) {
      holder.replaceChildren(h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, "Couldn't read your shelf: " + (err.message || "try again later"))));
    } finally { btn.disabled = false; btn.textContent = "💞 Kink twins"; }
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
        }, 15000);
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
  const KJ_URL = /https?:\/\/jay-hosting\.github\.io\/kink-jars\/?[^\s]*/i;
  // Limits as tags. If someone pasted their Kink Jars link instead of typing limits (or left them
  // blank), the hard limits are read from their shelf instead.
  function limitsBody(text, kjUrl) {
    const m = String(text || "").match(KJ_URL);
    const typed = String(text || "").replace(KJ_URL, "").replace(/https?:\/\/\S+/g, "").trim();
    const url = (m && m[0]) || kjUrl || "";
    const parsed = parseTags(typed);
    // Limits don't rotate: none of them should drop out of view while someone is reading.
    if (parsed) return parsed.prose ? [proseBlock(parsed.prose)] : parsed.groups.map((g) => h("div", { class: "tag-group" },
      g.label && !/^limits?$/i.test(g.label) ? h("h3", { class: "tag-label" }, g.label) : null,
      tagRow(g.items, { max: 8, rotate: false, cls: "tag-limit" })));
    if (!url || !window.KinkJarsImport) return null;
    const holder = h("div", {}, h("p", { class: "faint" }, "Reading their Kink Jars shelf…"));
    (async () => {
      try {
        const sum = window.KinkJarsImport.summarize(await window.KinkJarsImport.resolve(url));
        holder.replaceChildren(sum.limits.length
          ? h("div", { class: "tag-group" }, h("h3", { class: "tag-label" }, "Hard no (from Kink Jars)"), tagRow(sum.limits, { max: 8, rotate: false, cls: "tag-limit" }))
          : h("p", { class: "faint" }, "No hard limits marked on their Kink Jars shelf. Ask before trying anything."));
      } catch { holder.replaceChildren(h("a", { href: url, target: "_blank", rel: "noopener" }, "See their limits on Kink Jars ↗")); }
    })();
    return [holder];
  }
  function limitsSection(text, kjUrl) {
    const body = limitsBody(text, kjUrl);
    if (!body) return null;
    return h("section", { class: "limits-box" }, h("h2", {}, "Limits"), ...body);
  }

  // ---------- a fun, ready-to-paste Telegram post ----------
  function telegramPost(p, isOwner) {
    const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const url = shareUrl(p);
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
  // Hobbies people can tap to add in the editor (they can still type their own).
  const HOBBY_GROUPS = [
    ["🎮 Games", ["Video games", "Board games", "D&D / tabletop RPGs", "Card games", "Puzzles", "Trivia", "Escape rooms", "Magic: The Gathering"]],
    ["🎨 Creative", ["Drawing", "Painting", "Photography", "Writing", "Poetry", "Crafting", "Knitting & crochet", "Sewing", "Cosplay", "Pottery", "Woodworking", "3D printing", "Making music", "Singing", "DJing"]],
    ["🌲 Outdoors", ["Hiking", "Camping", "Gardening", "Fishing", "Kayaking", "Beach days", "Stargazing", "Road trips", "Travel", "Picnics"]],
    ["💪 Active", ["Gym", "Yoga", "Running", "Cycling", "Dancing", "Martial arts", "Rock climbing", "Swimming", "Pole fitness", "Roller skating", "Disc golf"]],
    ["🍳 Food & drink", ["Cooking", "Baking", "BBQ", "Coffee", "Tea", "Wine", "Craft beer", "Cocktails", "Trying new restaurants", "Brunch"]],
    ["🎬 Entertainment", ["Movies", "TV series", "Anime", "Reading", "Comics & manga", "Podcasts", "Live music", "Concerts", "Theater", "Karaoke", "Stand-up comedy", "Horror"]],
    ["🧠 Learning & tech", ["Tech & coding", "Gaming PCs", "Science", "History", "Languages", "Astrology", "Tarot", "Psychology", "True crime"]],
    ["🏡 Home & chill", ["Pets", "Cats", "Dogs", "Plants", "Home decor", "Thrifting", "Collecting", "Self-care", "Meditation", "Volunteering", "Cars", "Motorcycles", "Fashion", "Makeup"]],
  ];
  const hobbyList = (t) => [...new Set(String(t || "").split(/[,\n;•·]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 40);

  // ---------- the full "share my profile" post, with photos ----------
  const SHARE_PARTS = [
    ["looking", "Looking for", true], ["location", "Area", true], ["mood", "Mood", true], ["about", "About", false],
    ["hobbies", "Hobbies", true], ["into", "Into", true], ["limits", "Limits", true], ["ask", "Ask me about", true], ["care", "Care", false],
  ];
  const MAX_SHARE_PHOTOS = 6;
  const CAPTION_MAX = 1024;   // Telegram's limit for a photo caption
  function fullPost(p, on, kj) {
    const more = (items, n) => items.slice(0, n).join(", ") + (items.length > n ? ` +${items.length - n} more` : "");
    const short = (t, n) => { t = String(t).replace(/\s+/g, " ").trim(); if (t.length <= n) return t; const cut = t.slice(0, n); const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? ")); return end > n * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…"; };
    const look = L.resolve(p.style, p.theme);
    const out = [];
    out.push(["💜 " + p.display_name, p.pronouns, p.dynamic].filter(Boolean).join(" · "));
    if (on.location && p.location) out.push("📍 " + p.location);
    if (on.looking) {
      const lf = LOOKING.filter(([v]) => (p.looking_for || []).includes(v));
      if (lf.length) out.push(lf[0][0] === "nothing" ? `${lf[0][1]} ${lf[0][2]}` : "🔎 Looking for: " + lf.map(([, e, l]) => `${e} ${l}`).join(" · "));
    }
    if (on.mood && (look.mood_emoji || look.mood_text)) out.push(`${look.mood_emoji || "💬"} ${look.mood_text || ""}`.trim());
    if (on.about && p.bio) out.push("", short(p.bio, 220));
    const block = [];
    const hobbies = hobbyList(p.hobbies);
    if (on.hobbies && hobbies.length) block.push("🎨 Hobbies: " + more(hobbies, 8));
    if (on.into) {
      const parsed = parseTags(p.into);
      if (parsed && parsed.prose) block.push("💫 Into: " + short(parsed.prose, 200));
      else if (parsed) {
        for (const g of parsed.groups) {
          const k = (g.label || "").toLowerCase();
          if (k === "love") block.push("🔥 Love: " + more(g.items, 8));
          else if (k === "enjoy") block.push("😊 Enjoy: " + more(g.items, 6));
          else if (k.startsWith("curious") || k === "maybe") block.push("🤔 Curious about: " + more(g.items, 5));
          else block.push("💫 " + (g.label ? g.label + ": " : "Into: ") + more(g.items, 8));
        }
      } else if (kj) {
        if (kj.love.length) block.push("🔥 Love: " + more(kj.love, 8));
        if (kj.enjoy.length) block.push("😊 Enjoy: " + more(kj.enjoy, 6));
        if (kj.curious.length) block.push("🤔 Curious about: " + more(kj.curious, 5));
      }
    }
    if (on.limits) {
      const parsed = parseTags(p.limits);
      const items = parsed ? (parsed.prose ? null : parsed.groups.flatMap((g) => g.items)) : kj && !p.into ? kj.limits : [];
      if (parsed && parsed.prose) block.push("🚫 Limits: " + short(parsed.prose, 160));
      else if (items && items.length) block.push("🚫 Limits: " + more(items, 8));
    }
    if (block.length) out.push("", ...block);
    const extra = [];
    if (on.ask) (p.prompts || []).filter((x) => x && x.q && x.a).slice(0, 2).forEach((x) => extra.push(`💬 ${x.q.replace(/…$/, "")}: ${short(x.a, 140)}`));
    const care = p.care || {};
    if (on.care && care.approach) extra.push("🫶 How to approach me: " + short(care.approach, 140));
    if (on.care && care.aftercare) extra.push("🧸 Aftercare: " + short(care.aftercare, 140));
    if (extra.length) out.push("", ...extra);
    out.push("", "👉 Full profile: " + shareUrl(p));
    return out.join("\n");
  }

  // One picture made from several photos, for pasting on a computer (the clipboard holds one image).
  async function collage(urls) {
    const imgs = await Promise.all(urls.map((u) => new Promise((res, rej) => {
      const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = rej; i.src = u;
    })));
    const n = imgs.length, cols = { 1: 1, 2: 2, 3: 3, 4: 2 }[n] || 3, rows = Math.ceil(n / cols);
    const cell = n === 1 ? 1200 : 640, gap = 10;
    const cv = document.createElement("canvas");
    cv.width = cols * cell + (cols - 1) * gap; cv.height = rows * cell + (rows - 1) * gap;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#1f1f1f"; ctx.fillRect(0, 0, cv.width, cv.height);
    imgs.forEach((im, i) => {
      const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols;
      const x0 = (cv.width - (inRow * cell + (inRow - 1) * gap)) / 2;
      const x = x0 + (i - r * cols) * (cell + gap), y = r * (cell + gap);
      const s = Math.max(cell / im.naturalWidth, cell / im.naturalHeight);
      const w = im.naturalWidth * s, hh = im.naturalHeight * s;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cell, cell); ctx.clip();
      ctx.drawImage(im, x + (cell - w) / 2, y + (cell - hh) / 2, w, hh); ctx.restore();
    });
    return cv;
  }

  async function openShare(p, photos) {
    const pics = [];
    if (p.avatar) pics.push({ key: "avatar", thumb: fileUrl(p, p.avatar, "200x200"), full: fileUrl(p, p.avatar), nsfw: false, label: "Profile photo" });
    (photos || []).filter((ph) => !isVid(ph)).forEach((ph, i) => pics.push({ key: ph.id, thumb: fileUrl(ph, ph.image, "400x400"), full: fileUrl(ph, ph.image, "1200x0"), nsfw: !!ph.nsfw, label: ph.caption || "Photo " + (i + 1) }));
    const picked = new Set(pics.filter((x) => !x.nsfw).slice(0, 3).map((x) => x.key));
    const on = Object.fromEntries(SHARE_PARTS.map(([k, , d]) => [k, d]));
    let kj = null;

    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": "Share in Telegram" });
    const close = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const text = h("textarea", { class: "share-text", rows: 12, "aria-label": "Post text" });
    const count = h("p", { class: "hint share-count" });
    const nsfwNote = h("p", { class: "status bad", hidden: true }, "Telegram won't blur NSFW photos. Only post them where the group allows it.");
    const refreshCount = () => {
      const n = text.value.length;
      count.textContent = `${n.toLocaleString()} characters` + (picked.size && n > CAPTION_MAX
        ? `. Telegram captions fit ${CAPTION_MAX.toLocaleString()}, so the text will go as its own message after the photos. Untick a section to make it fit.` : "");
      count.classList.toggle("warn", !!picked.size && n > CAPTION_MAX);
      nsfwNote.hidden = !pics.some((x) => x.nsfw && picked.has(x.key));
    };
    const regen = () => { text.value = fullPost(p, on, kj); refreshCount(); };
    text.addEventListener("input", refreshCount);

    const opts = h("div", { class: "share-opts" }, SHARE_PARTS.map(([k, label]) => {
      const c = h("input", { type: "checkbox", checked: on[k] });
      c.addEventListener("change", () => { on[k] = c.checked; regen(); });
      return h("label", { class: "share-opt" }, c, label);
    }));

    const grid = h("div", { class: "share-photos" });
    const drawGrid = () => grid.replaceChildren(...pics.map((x) => {
      const sel = picked.has(x.key);
      const b = h("button", { type: "button", class: "share-ph" + (sel ? " on" : "") + (x.nsfw ? " nsfw" : ""), "aria-pressed": String(sel), "aria-label": x.label + (x.nsfw ? " (NSFW)" : "") },
        h("img", { src: x.thumb, alt: "", loading: "lazy" }),
        x.nsfw ? h("span", { class: "share-tag" }, "NSFW") : null,
        sel ? h("span", { class: "share-num" }, String([...picked].indexOf(x.key) + 1)) : null);
      b.addEventListener("click", () => {
        if (picked.has(x.key)) picked.delete(x.key);
        else if (picked.size >= MAX_SHARE_PHOTOS) return toast(`Up to ${MAX_SHARE_PHOTOS} photos`, true);
        else picked.add(x.key);
        drawGrid(); refreshCount();
      });
      return b;
    }));
    drawGrid();
    const chosen = () => [...picked].map((k) => pics.find((x) => x.key === k)).filter(Boolean);

    const files = async () => Promise.all(chosen().map(async (x, i) => {
      const blob = await (await fetch(x.full)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      return new File([blob], `${p.slug}-${i + 1}.${ext}`, { type: blob.type || "image/jpeg" });
    }));
    const busy = async (btn, label, fn) => {
      const was = btn.textContent; btn.disabled = true; btn.textContent = label;
      try { await fn(); } finally { btn.disabled = false; btn.textContent = was; }
    };

    const canShareFiles = (() => { try { return !!navigator.canShare && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }); } catch { return false; } })();
    const shareBtn = canShareFiles ? h("button", { type: "button", class: "btn gold" }, "📲 Share to Telegram") : null;
    if (shareBtn) shareBtn.addEventListener("click", () => busy(shareBtn, "Getting photos…", async () => {
      try {
        const f = picked.size ? await files() : [];
        await navigator.share(f.length ? { files: f, text: text.value } : { text: text.value });
      } catch (err) { if (err && err.name !== "AbortError") toast("Couldn't open sharing. Use Copy text instead.", true); }
    }));
    const copyText = h("button", { type: "button", class: "btn" + (shareBtn ? "" : " gold") }, "📋 Copy text");
    copyText.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text.value); toast("📋 Text copied! Paste it in Telegram."); }
      catch { text.select(); toast("Press Ctrl+C (or Cmd+C) to copy", true); }
    });
    const copyLink = h("button", { type: "button", class: "btn" }, "🔗 Copy link");
    copyLink.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(shareUrl(p)); toast("🔗 Link copied! Telegram shows a preview card when you paste it."); }
      catch { prompt("Copy your link:", shareUrl(p)); }
    });
    const copyPics = h("button", { type: "button", class: "btn" }, "🖼️ Copy photos");
    copyPics.addEventListener("click", () => {
      if (!picked.size) return toast("Pick a photo first", true);
      return busy(copyPics, "Making it…", async () => {
        try {
          const cv = await collage(chosen().map((x) => x.full));
          await navigator.clipboard.write([new ClipboardItem({ "image/png": new Promise((res) => cv.toBlob(res, "image/png")) })]);
          toast(picked.size > 1 ? "🖼️ Photos copied as one picture! Paste it in Telegram." : "🖼️ Photo copied! Paste it in Telegram.");
        } catch { toast("Your browser can't copy images. Use Save photos instead.", true); }
      });
    });
    const savePics = h("button", { type: "button", class: "btn ghost" }, "⬇️ Save photos");
    savePics.addEventListener("click", () => {
      if (!picked.size) return toast("Pick a photo first", true);
      return busy(savePics, "Saving…", async () => {
        try {
          for (const f of await files()) {
            const a = h("a", { href: URL.createObjectURL(f), download: f.name }); document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            await new Promise((r) => setTimeout(r, 350));
          }
        } catch { toast("Couldn't save the photos right now", true); }
      });
    });

    modal.append(h("div", { class: "modal-box share-box" },
      h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "📸 Post with photos"),
        h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Close", onclick: close }, "✕")),
      h("div", {}, h("h3", { class: "tag-label" }, "What to include"), opts),
      pics.length ? h("div", {}, h("h3", { class: "tag-label" }, `Photos (pick up to ${MAX_SHARE_PHOTOS})`), grid, nsfwNote) : null,
      h("div", {}, h("h3", { class: "tag-label" }, "Your post (you can edit it)"), text, count),
      h("div", { class: "actions share-actions" }, shareBtn, copyText, copyLink, pics.length ? [copyPics, savePics] : null),
      h("p", { class: "faint share-tip" }, shareBtn
        ? "Share to Telegram, pick the chat, and your photos go as an album with the text as the caption."
        : "In Telegram: paste the photos first, then copy the text and paste it as the caption."),
      h("p", { class: "faint share-tip" }, "Quickest: Copy link and paste it on its own. Telegram turns it into a card with your photo and highlights.")));
    document.body.append(modal);
    regen();

    // No interests typed in? Use their Kink Jars shelf instead.
    const kjLink = !p.into && window.KinkJarsImport && (p.play_links || []).find((l) => isKJ(l.url));
    if (kjLink) {
      try { kj = window.KinkJarsImport.summarize(await window.KinkJarsImport.resolve(kjLink.url)); if (text.value === fullPost(p, on, null)) regen(); } catch {}
    }
  }

  async function copyPost(p, isOwner) {
    const text = telegramPost(p, isOwner);
    try { await navigator.clipboard.writeText(text); toast("📣 Post copied! Paste it in Telegram."); }
    catch { prompt("Copy this post:", text); }
  }

  // ---------- badges ----------
  // Admin-given badges come from the dashboard; the rest are worked out from the profile.
  const ADMIN_BADGES = { owner: ["🗝️", "Owner", "Owns the group"], admin: ["🛡️", "Admin", "Keeps the group running"], host: ["🎪", "Event host", "Hosts group events"], welcomer: ["🤗", "Welcomer", "Says hi to new members"], helper: ["🛠️", "Helper", "Helps behind the scenes"], vip: ["👑", "VIP", "Someone special to the group"] };
  const parseDate = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? null : t; };
  const isNew = (m) => { const t = parseDate(m.created); return t && Date.now() - t < 7 * 864e5; };
  function badgesFor(p, photoCount) {
    const out = [];
    if (p.vetted) out.push(["✅", "Vetted", p.vetSelf ? "Vetted for play parties. Only you can see this." : "Vetted for play parties (only owners see this)"]);
    for (const b of p.badges || []) if (ADMIN_BADGES[b]) out.push(ADMIN_BADGES[b]);
    if (isNew(p)) out.push(["🌱", "New here", "Joined this week, say hi!"]);
    const plays = (p.play_links || []).map((l) => l.url || "");
    if (plays.some((u) => /kink-jars/i.test(u))) out.push(["🫙", "Jar collector", "Has a Kink Jars shelf"]);
    if (plays.some((u) => /romance\.jay-hosting/i.test(u))) out.push(["💞", "Sweetheart", "Has a Romantic Jars shelf"]);
    if (plays.length >= 2) out.push(["🎲", "Playroom regular", "Plays more than one game"]);
    if (photoCount >= 5) out.push(["📸", "Shutterbug", "Shares lots of photos"]);
    if ((p.prompts || []).length >= 3) out.push(["💬", "Open book", "Answered 3+ Ask me about cards"]);
    if (glowUp(p, photoCount).score >= 100) out.push(["✨", "Glowed up", "Filled in every part of their profile"]);
    { const lk = L.resolve(p.style, p.theme);
      const spooky = [[L.PALETTES, lk.palette], [L.PATTERNS, lk.pattern], [L.PARTICLES, lk.particles], [L.CHARMS, lk.charm]].some(([list, id]) => (list.find((x) => x.id === id) || {}).season === "halloween");
      if (spooky) out.push(["🎃", "Spooky season", "Dressed their page up for Halloween"]); }
    return out;
  }
  const badgeRow = (list) => list.length ? h("div", { class: "badges", "aria-label": "Badges" },
    list.map(([e, label, why]) => h("span", { class: "badge", title: why }, h("span", { "aria-hidden": "true" }, e), " " + label))) : null;

  // ---------- birthdays ("MM-DD", optional year), in Pacific time ----------
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const ptToday = () => { const s = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); return { y: +s.slice(0, 4), md: s.slice(5, 10) }; };
  const bdayText = (md) => { const [mo, dy] = String(md).split("-").map(Number); return MONTHS[mo - 1] ? `${MONTHS[mo - 1].slice(0, 3)} ${dy}` : ""; };
  const ageOf = (p) => { if (!p || !p.birthday || !p.birth_year || !p.show_age) return null; const t = ptToday(); return t.y - p.birth_year - (t.md >= p.birthday ? 0 : 1); };
  // Days until their next birthday (0 = today). Feb 29 birthdays land on Feb 28 in other years.
  const daysToBday = (md) => {
    if (!md) return null;
    const t = ptToday(), base = Date.UTC(t.y, +t.md.slice(0, 2) - 1, +t.md.slice(3));
    const at = (y) => { const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; const [mo, dy] = md === "02-29" && !leap ? [2, 28] : md.split("-").map(Number); return Date.UTC(y, mo - 1, dy); };
    let d = at(t.y); if (d < base) d = at(t.y + 1);
    return Math.round((d - base) / 864e5);
  };
  // All times show in the group's time zone (Pacific), whoever is looking.
  const TZ = CFG.TIME_ZONE || "America/Los_Angeles", TZ_LABEL = CFG.TIME_ZONE_LABEL || "PT";
  const timeShort = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: TZ }) + " " + TZ_LABEL;

  // ---------- profile glow-up meter ----------
  function glowUp(p, photoCount) {
    const look = L.resolve(p.style, p.theme);
    const care = p.care || {};
    const items = [
      [12, !!p.avatar, "Add a profile photo", "profile", ".avatar-edit"],
      [8, (p.looking_for || []).length > 0, "Say what you're looking for", "profile", '[aria-label="Looking for"]'],
      [6, !!(p.pronouns || p.dynamic), "Add pronouns or your dynamic", "profile", "#f_pronouns"],
      [10, !!p.bio, "Write a little About you", "profile", "#f_bio"],
      [8, !!p.hobbies, "List a few hobbies", "profile", "#f_hobbies"],
      [10, !!p.into, "Add what you're into", "profile", "#f_into"],
      [8, !!p.limits, "Add your limits", "profile", "#f_limits"],
      [8, (p.prompts || []).length > 0, "Answer an Ask me about card", "profile", ".prompt-rows"],
      [6, !!(care.approach || care.checkins || care.aftercare || care.reply), "Fill in Care & communication", "profile", "#care_approach"],
      [6, (p.links || []).length + (p.jars || []).length > 0, "Add a link", "links", "#pane-links .presets"],
      [8, photoCount > 0, "Upload a photo", "photos", 'label[for="photoInput"], #pane-photos'],
      [5, (p.play_links || []).length > 0, "Add a game link in the Playroom", "playroom", "#pane-playroom"],
      [5, !!(look.mood_emoji || look.mood_text), "Set a mood sticker", "settings", '[data-look="mood_emoji"]'],
    ];
    const score = items.reduce((n, [w, done]) => n + (done ? w : 0), 0);
    const todo = items.filter(([, done]) => !done).sort((a, b) => b[0] - a[0]);
    return { score, todo };
  }

  // ---------- profile song ----------
  function songEmbed(url) {
    url = safeUrl(url); if (!url) return null;
    let u; try { u = new URL(url); } catch { return null; }
    const host = u.hostname.replace(/^www\./, "");
    let src = null, height = 152;
    if (host === "open.spotify.com") {
      const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
      if (m) { src = `https://open.spotify.com/embed/${m[1]}/${m[2]}`; height = m[1] === "track" ? 152 : 232; }
    } else if (host === "music.apple.com") {
      src = "https://embed.music.apple.com" + u.pathname + u.search; height = u.searchParams.has("i") ? 175 : 300;
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
      const id = host === "youtu.be" ? u.pathname.slice(1) : (u.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]+)/) || [])[1] || u.searchParams.get("v");
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) { src = `https://www.youtube-nocookie.com/embed/${id}`; height = 200; }
    } else if (host === "soundcloud.com") {
      src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url) + "&color=%23988ae3&visual=false&show_comments=false"; height = 120;
    }
    if (!src) return h("a", { class: "key", href: url, target: "_blank", rel: "noopener nofollow" },
      h("span", { class: "mono emoji", "aria-hidden": "true" }, "🎵"), h("span", { class: "txt" }, h("b", {}, "My vibe song"), h("small", {}, hostOf(url))), h("span", { class: "ext", "aria-hidden": "true" }, "↗"));
    return h("iframe", { class: "song-frame", src, height: String(height), loading: "lazy", title: "Profile song",
      allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture", referrerpolicy: "strict-origin-when-cross-origin" });
  }

  // A name for a song link when no title was found: "Spotify playlist", "YouTube video"…
  function songSvc(url) {
    let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    return host === "open.spotify.com" ? "Spotify" : host === "music.apple.com" ? "Apple Music" : /youtu/.test(host) ? "YouTube" : host === "soundcloud.com" ? "SoundCloud" : hostOf(url);
  }
  function songLabel(s, i) {
    if (s.title) return s.title;
    let u; try { u = new URL(s.url); } catch { return "Song " + (i + 1); }
    let kind = (u.pathname.match(/\/(track|album|playlist|episode|song)\//) || [])[1];
    if (kind === "album" && u.searchParams.has("i")) kind = "song";
    return kind ? `${songSvc(s.url)} ${kind === "track" ? "song" : kind}` : `Song ${i + 1} · ${songSvc(s.url)}`;
  }
  // The profile playlist: one link plays on its own; several get one player and a list to pick from.
  function playlistEl(list) {
    list = (list || []).filter((s) => s && safeUrl(s.url));
    if (!list.length) return null;
    if (list.length === 1) return h("div", { class: "song-one" }, songEmbed(list[0].url), list[0].title ? h("p", { class: "song-cap" }, list[0].title) : null);
    const player = h("div", { class: "song-player" });
    const items = list.map((s, i) => h("li", {}, h("button", { type: "button", class: "song-item", onclick: () => pick(i) },
      h("span", { class: "song-n", "aria-hidden": "true" }, String(i + 1)), h("span", { class: "song-t" }, songLabel(s, i)), h("span", { class: "song-src" }, songSvc(s.url)))));
    const pick = (i) => {
      player.replaceChildren(songEmbed(list[i].url));
      items.forEach((li, j) => { const b = li.firstChild; b.classList.toggle("on", j === i); if (j === i) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    };
    const box = h("div", { class: "song-playlist" }, player, h("ol", { class: "song-list" }, items));
    pick(0);
    return box;
  }

  // ---------- little avatar helpers for lists of people ----------
  const miniAvatar = (m) => m.avatar
    ? h("img", { class: "mini-av", src: fileUrl(m, m.avatar, "200x200"), alt: "", loading: "lazy" })
    : h("span", { class: "mini-av", "aria-hidden": "true" }, (m.display_name || "?").slice(0, 1).toUpperCase());
  const personChip = (m) => h("a", { class: "person", href: "/" + m.slug, "data-nav": "" }, miniAvatar(m), h("span", {}, m.display_name));
  const fmtWhen = (d) => { const t = parseDate(d); return t ? new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ }) + " " + TZ_LABEL : ""; };
  function hearts(n) {
    if (reduceMotion()) return;
    const layer = h("div", { class: "heart-burst", "aria-hidden": "true" });
    for (let i = 0; i < (n || 24); i++) {
      const sp = h("span", {}, ["💘", "💞", "💜", "✨"][i % 4]);
      sp.style.left = Math.random() * 100 + "%";
      sp.style.animationDelay = Math.random() * 0.6 + "s";
      sp.style.fontSize = 16 + Math.random() * 22 + "px";
      layer.append(sp);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 3200);
  }

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
    const when = (d) => { try { return new Date(d.replace(" ", "T")).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: TZ }); } catch { return ""; } };
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

  const canShareOthers = () => { const b = (me() && me().badges) || []; return b.includes("admin") || b.includes("owner"); };

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
    const vet = data.vetting || {};
    p.vetted = !!vet.vetted; p.vetSelf = !!vet.self;   // owners see it on everyone; a member sees it only on their own profile
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
    // Owners also see the private vetting status and note.
    const staffVet = vet.staff ? h("div", { class: "staff-vet" + (vet.status ? " s-" + vet.status : "") },
      h("b", {}, "🔒 Vetting: "), vet.label || "Not vetted", vet.note ? h("span", {}, " · " + vet.note) : null,
      vet.by ? h("small", { class: "faint" }, ` · ${vet.by}`) : null, h("small", { class: "faint" }, " (only owners see this)")) : null;
    const badgeHolder = h("div", { class: "hold" }, badgeRow(badgesFor(p, photos.length)), staffVet);
    const crushHolder = h("span", { class: "crush-holder" });
    const huntHolder = h("span", { class: "hunt-holder" });
    const matchHolder = h("div", { class: "hold" });
    const head = h("div", { class: "profile-card" },
      h("div", { class: "banner" }),
      h("div", { class: "profile-head" },
        avatarWithCharm(p, look.charm),
        h("h1", { class: "profile-name" }, p.display_name),
        tgUser ? h("div", { class: "handle" }, "@" + tgUser, data.online ? h("span", { class: "online-now" }, h("span", { class: "dot", "aria-hidden": "true" }), "Online now") : null)
          : data.online ? h("div", { class: "handle" }, h("span", { class: "online-now" }, h("span", { class: "dot", "aria-hidden": "true" }), "Online now")) : null,
        lookingBadges(p.looking_for),
        look.mood_emoji || look.mood_text ? h("div", { class: "mood" }, look.mood_emoji ? h("span", { class: "em" }, look.mood_emoji) : null, look.mood_text) : null,
        h("div", { class: "chips" },
          p.pronouns ? h("span", { class: "chip" }, p.pronouns) : null,
          p.dynamic ? h("span", { class: "chip gold" }, p.dynamic) : null,
          // Relationship styles share one chip: "💞 Polyamorous · Kitchen table poly · ENM" (hover for what each means).
          (p.rel_style || []).length ? (() => {
            const sts = p.rel_style.map((v) => REL_STYLES.find((x) => x[0] === v) || [v, v, "", ""]);
            return h("span", { class: "chip", title: sts.map((st) => `${st[1]}: ${st[3]}`).join("\n") }, "💞 " + sts.map((st) => st[1].replace(/^Ethically non-monogamous \(ENM\)$/, "ENM")).join(" · "));
          })() : null,
          p.location ? h("span", { class: "chip" }, "📍 " + p.location) : null,
          p.birthday ? (daysToBday(p.birthday) === 0
            ? h("span", { class: "chip gold bday-today" }, "🎉 Birthday today!" + (ageOf(p) ? ` · ${ageOf(p)}` : ""))
            : h("span", { class: "chip", title: "Birthday" }, "🎂 " + bdayText(p.birthday) + (ageOf(p) ? ` · ${ageOf(p)}` : ""))) : null),
        badgeHolder,
        (data.relationships || []).length ? h("div", { class: "rel-row", "aria-label": "Relationships" }, data.relationships.map((r) => {
          const [, e, l] = relType(r.type);
          return h("span", { class: "rel-link", title: `${r.other.display_name} is ${p.display_name}'s ${l.toLowerCase()}` }, h("span", { class: "rel-lbl" }, `${e} ${l}`), personChip(r.other));
        })) : null,
        matchHolder,
        h("div", { class: "actions" },
          data.isOwner ? [h("a", { class: "btn gold", href: "/edit", "data-nav": "" }, "Edit my page"),
            vet.vetted ? null : h("a", { class: "btn ghost", href: "/vetting", "data-nav": "", title: "For play parties that need it" }, "✅ Get vetted")]
            : tgUser ? h("a", { class: "btn gold", href: "https://t.me/" + encodeURIComponent(tgUser), target: "_blank", rel: "noopener" }, "Message on Telegram") : null,
          data.isOwner ? null : crushHolder,
          data.isOwner ? null : huntHolder,
          // Sharing: your own page, or anyone's if you're an admin or owner.
          data.isOwner || canShareOthers() ? [
            shareButton({ url: profileUrl(p.slug), title: p.display_name, extra: data.isOwner
              ? [["🖼️", "Profile card", "A picture of your page with a QR code, to save or post anywhere.", () => openCard(p)],
                 ["📸", "Post with photos", "Write a post, pick which bits to include and add photos from your gallery.", () => openShare(p, photos)]]
              : [["📝", "Copy a ready-made post", "A fun post about them with their link, ready to paste in Telegram.", () => copyPost(p, false)]] })] : null),
        reactHolder));

    const blocks = [];
    blocks.push(head);

    // Side column: the things people open a profile for. First on phones, beside the text on desktop.
    const side = [];
    if (photos.length) side.push(gallerySide(photos, { canReport: !!me() && !data.isOwner, onHidden: () => render() }));
    const songList = Array.isArray(p.songs) && p.songs.length ? p.songs : p.song ? [{ url: p.song, title: "" }] : [];
    const song = playlistEl(songList);
    if (song) side.push(h("section", { class: "keyring song" }, h("h2", {}, songList.length > 1 ? "🎵 My vibe playlist" : "🎵 My vibe"), song));
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
    const hobbies = hobbyList(p.hobbies);
    if (hobbies.length) main.push(h("section", { class: "prose" }, h("h2", {}, "Hobbies"), tagRow(hobbies, { max: 10, rotate: false, cls: "tag-hobby" })));
    const prompts = (p.prompts || []).filter((x) => x && x.q && x.a);
    if (prompts.length) {
      main.push(h("section", { class: "prose" }, h("h2", {}, "Ask me about"),
        h("div", { class: "prompt-cards" }, prompts.map((x, i) =>
          h("div", { class: "prompt-card" }, h("span", { class: "pq" }, x.q), h("p", { class: "pa" }, x.a))))));
    }
    const qotwHolder = h("div", {});
    main.push(qotwHolder);
    if (p.into || p.limits || (p.play_links || []).some((l) => KJ_URL.test(l.url || ""))) {
      main.push(h("div", { class: "into-limits" },
        intoSection(p.into),
        limitsSection(p.limits, ((p.play_links || []).find((l) => KJ_URL.test(l.url || "")) || {}).url)));
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
    const vouchHolder = h("div", {});
    main.push(vouchHolder);
    const notesHolder = h("div", {});
    main.push(notesHolder);

    if (!side.length && main.length === 4) {
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

    // Crushes, vouches, this week's answer and event badges.
    async function loadExtras() {
      let x;
      try { x = await pb.send("/api/vc/extras/" + encodeURIComponent(p.slug), {}); } catch { return; }
      const extra = [];
      if (x.eventsAttended >= 3) extra.push(["🎟️", "Regular", "Has been to 3+ group events"]);
      else if (x.eventsAttended >= 1) extra.push(["🎟️", "Event-goer", "Has been to a group event"]);
      if (x.vouchCount >= 3) extra.push(["🤝", "Trusted", "Vouched for by 3+ members"]);
      if (x.hunt) {
        if (x.hunt.catches >= 3) extra.push(["🐺", "Apex hunter", `Caught ${x.hunt.catches} in The Hunt`]);
        if (x.hunt.escapes >= 3) extra.push(["🦊", "Escape artist", `Escaped ${x.hunt.escapes} hunts`]);
        if (x.hunt.played && x.hunt.catches < 3 && x.hunt.escapes < 3) extra.push(["🏹", "In the hunt", "Has played The Hunt"]);
      }
      if (extra.length) badgeHolder.replaceChildren(badgeRow([...badgesFor(p, photos.length), ...extra]));
      if (x.crush) drawCrush(x.crush, false);
      const hOpt = x.hunt && x.hunt.opt;
      if (me() && !data.isOwner && hOpt && hOpt !== "off") {
        const label = { prey: "🏹 Hunt them", hunter: "🐇 Be hunted", both: "🏹 Hunt" }[hOpt];
        huntHolder.replaceChildren(h("a", { class: "btn", href: "/hunt?start=" + p.slug, "data-nav": "", title: "Start a game of The Hunt" }, label));
      }
      qotwHolder.replaceChildren(qotwCard(p, x, data.isOwner) || "");
      vouchHolder.replaceChildren(vouchSection(p, x, data.isOwner, loadExtras) || "");
    }
    function drawCrush(c, justChanged) {
      const btn = h("button", { type: "button", class: "btn crush" + (c.mine ? " on" : ""), "aria-pressed": String(c.mine),
        title: c.mutual ? "You both have a crush!" : c.mine ? "Only you can see this. Tap to take it back." : "Secret! They're only told if they have a crush on you too." },
        c.mutual ? "💞 It's a match!" : c.mine ? "💘 Crush sent" : "💘 Secret crush");
      btn.addEventListener("click", async () => {
        if (!me()) return toast("Log in to send a crush", true);
        btn.disabled = true;
        try {
          const r = await pb.send("/api/vc/crush", { method: "POST", body: { slug: p.slug } });
          drawCrush(r, true);
          if (r.mutual) { hearts(30); toast(`💞 It's a match! ${p.display_name} has a crush on you too.`); }
          else toast(r.mine ? "💘 Sent. It stays secret unless they feel the same." : "Crush taken back");
        } catch (err) { toast(errMsg(err), true); btn.disabled = false; }
      });
      crushHolder.replaceChildren(btn);
      matchHolder.replaceChildren(c.mutual ? h("div", { class: "match-banner" }, `💞 You and ${p.display_name} have a crush on each other!`) : "");
    }
    loadExtras();
  }

  function qotwCard(p, x, isOwner) {
    if (!x.answer) return null;
    if (!x.answer.a) return isOwner ? h("section", { class: "qotw-card empty" }, h("span", { class: "pq" }, "❓ Question of the week"),
      h("p", { class: "pa" }, x.answer.q), h("a", { class: "btn small gold", href: "/question", "data-nav": "" }, "Answer it")) : null;
    return h("section", { class: "qotw-card" }, h("span", { class: "pq" }, "❓ Question of the week"),
      h("p", { class: "qq" }, x.answer.q), h("p", { class: "pa" }, x.answer.a),
      h("a", { class: "see-all", href: "/question", "data-nav": "" }, "See everyone's answers →"));
  }

  function vouchSection(p, x, isOwner, refresh) {
    const user = me();
    if (x.vouches_off && !isOwner) return null;
    const parts = [];
    const n = x.vouchCount;
    parts.push(h("p", { class: "vouch-count" }, n ? `🤝 Vouched for by ${n} member${n === 1 ? "" : "s"} who've met ${isOwner ? "you" : p.display_name}` : isOwner ? "No vouches yet. Members who've met you in person can vouch for you from your page." : `No vouches yet.`));
    if (x.vouches_off && isOwner) parts.push(h("p", { class: "faint" }, "Vouches are switched off in your Settings, so others can't see or add them."));
    if (!user && n) parts.push(h("p", { class: "faint" }, h("a", { href: "/login", "data-nav": "" }, "Log in"), " to see who."));
    if (x.vouches.length) parts.push(h("div", { class: "vouches" }, x.vouches.map((v) => h("div", { class: "vouch" },
      personChip(v.from),
      v.text ? h("p", {}, "“" + v.text + "”") : null,
      (isOwner || (user && v.from.id === user.id)) ? h("button", { type: "button", class: "see-all", onclick: async () => {
        try { await pb.send("/api/vc/vouches/" + v.id, { method: "DELETE" }); toast("Vouch removed"); refresh(); } catch (err) { toast(errMsg(err), true); }
      } }, "Remove") : null))));
    if (user && !isOwner && !x.vouches_off) {
      const box = h("div", { class: "vouch-form" });
      const open = () => {
        const ta = h("textarea", { maxlength: 140, rows: 2, placeholder: `Optional: a few words about ${p.display_name}`, "aria-label": "Vouch note" });
        ta.value = x.myVouch ? x.myVouch.text : "";
        const ok = h("input", { type: "checkbox", checked: !!x.myVouch });
        const save = h("button", { type: "button", class: "btn small gold" }, x.myVouch ? "Update" : "Vouch");
        save.addEventListener("click", async () => {
          if (!ok.checked) return toast(`Tick the box to say you've met ${p.display_name}`, true);
          save.disabled = true;
          try { await pb.send("/api/vc/vouch", { method: "POST", body: { slug: p.slug, text: ta.value.trim() } }); toast("🤝 Vouched!"); refresh(); }
          catch (err) { toast(errMsg(err), true); save.disabled = false; }
        });
        box.replaceChildren(ta, h("div", { class: "note-foot" }, h("label", { class: "check" }, ok, `I've met ${p.display_name} in person and they were lovely`), save));
      };
      if (x.myVouch) box.append(h("p", { class: "faint" }, "You've vouched for them. ", h("button", { type: "button", class: "see-all", onclick: open }, "Edit")));
      else box.append(h("button", { type: "button", class: "btn small", onclick: open }, "🤝 I've met them: vouch"));
      parts.push(box);
    }
    return h("section", { class: "prose vouch-box" }, h("h2", {}, "Vouches"), ...parts);
  }

  // ---------- photos & videos: a compact box in the side column, and a full-screen viewer ----------
  const isVid = (ph) => /\.(mp4|mov|webm|m4v)$/i.test(ph.image || "");
  // A square preview: the photo's thumbnail, or the video's first frame with a ▶.
  function mediaThumb(ph) {
    if (!isVid(ph)) return h("img", { src: fileUrl(ph, ph.image, "400x400"), alt: ph.caption || "", loading: "lazy" });
    return h("span", { class: "vid-thumb" }, h("video", { src: fileUrl(ph, ph.image) + "#t=0.5", preload: "metadata", muted: true, playsinline: true, tabindex: "-1", "aria-hidden": "true" }), h("span", { class: "vid-play", "aria-hidden": "true" }, "▶"));
  }
  function gallerySide(photos, opts) {
    opts = opts || {};
    const SHOW = 9;
    const anyNsfw = photos.some((x) => x.nsfw);
    let showNsfw = false;
    const grid = h("div", { class: "gallery-side" });
    const vids = photos.filter(isVid).length;
    const draw = () => grid.replaceChildren(...photos.slice(0, SHOW).map((ph, i) => {
      const more = i === SHOW - 1 && photos.length > SHOW ? photos.length - SHOW + 1 : 0;
      const veiled = ph.nsfw && !showNsfw;
      return h("button", { type: "button", class: "ph" + (veiled ? " nsfw" : "") + (isVid(ph) ? " is-vid" : "") + (ph.flagged ? " flagged" : ""), "aria-label": more ? `See all ${photos.length}` : veiled ? "NSFW, tap to view" : (ph.caption || (isVid(ph) ? "Video " : "Photo ") + (i + 1)),
        onclick: () => (more ? openGalleryAll(photos, opts, showNsfw) : openViewer(photos, i, showNsfw, opts)) },
        mediaThumb(ph),
        veiled ? h("div", { class: "veil" }, h("span", {}, isVid(ph) ? "▶ NSFW" : "NSFW")) : null,
        ph.flagged ? h("div", { class: "ph-flag" }, "🔒 Under review") : null,
        more ? h("div", { class: "ph-more" }, `+${more}`) : null);
    }));
    draw();
    const toggle = anyNsfw ? h("button", { class: "btn small ghost", type: "button", onclick: (e) => { showNsfw = !showNsfw; draw(); e.currentTarget.textContent = showNsfw ? "Blur NSFW" : "Show NSFW"; } }, "Show NSFW") : null;
    return h("section", { class: "keyring photos-side" },
      h("div", { class: "toggle-row" },
        h("button", { type: "button", class: "photos-title", title: "See them all", onclick: () => openGalleryAll(photos, opts, showNsfw) },
          h("h2", { style: "margin:0" }, vids ? "📸 Photos & videos" : "📸 Photos", h("small", { class: "faint" }, ` ${photos.length} ›`))),
        toggle),
      grid);
  }
  // Every photo and video as thumbnails; tap one to open it in the viewer.
  function openGalleryAll(items, opts, showNsfwStart) {
    let showNsfw = !!showNsfwStart;
    const modal = h("div", { class: "modal gallery-all", role: "dialog", "aria-modal": "true", "aria-label": "All photos and videos" });
    const close = () => { modal.remove(); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape" && !document.querySelector(".viewer")) close(); };
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const grid = h("div", { class: "gallery-all-grid" });
    const draw = () => grid.replaceChildren(...items.map((ph, i) => {
      const veiled = ph.nsfw && !showNsfw;
      return h("button", { type: "button", class: "ph" + (veiled ? " nsfw" : "") + (ph.flagged ? " flagged" : ""), "aria-label": ph.caption || (isVid(ph) ? "Video " : "Photo ") + (i + 1), onclick: () => openViewer(items, i, showNsfw, opts) },
        mediaThumb(ph), veiled ? h("div", { class: "veil" }, h("span", {}, isVid(ph) ? "▶ NSFW" : "NSFW")) : null, ph.flagged ? h("div", { class: "ph-flag" }, "🔒 Under review") : null);
    }));
    draw();
    const anyNsfw = items.some((x) => x.nsfw);
    modal.append(h("div", { class: "modal-box gallery-all-box" },
      h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, `📸 ${items.length} ${items.some(isVid) ? "photos & videos" : "photos"}`),
        h("span", { class: "actions", style: "margin:0" },
          anyNsfw ? h("button", { type: "button", class: "btn small ghost", onclick: (e) => { showNsfw = !showNsfw; draw(); e.currentTarget.textContent = showNsfw ? "Blur NSFW" : "Show NSFW"; } }, showNsfw ? "Blur NSFW" : "Show NSFW") : null,
          h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕"))),
      grid));
    document.body.append(modal); document.addEventListener("keydown", esc);
  }
  // Report a photo or video. A minor or missing consent hides it straight away until an admin has looked.
  const PHOTO_REPORT = [["minor", "🚸 Shows someone under 18"], ["consent", "🙅 Shows someone who didn't agree to be posted"], ["nsfw", "🔞 Explicit but not marked NSFW"], ["guidelines", "📜 Breaks the community guidelines another way"], ["other", "💬 Something else"]];
  function reportPhoto(ph, onDone, path) {
    if (!me()) { toast("Log in to report a photo.", true); return; }
    let reason = "";
    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "pr_title", style: "z-index:95" });
    const close = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const opts = h("div", { class: "vf-opts" }, PHOTO_REPORT.map(([k, l]) => h("label", { class: "check" }, h("input", { type: "radio", name: "pr_reason", value: k, onchange: () => { reason = k; } }), l)));
    const note = h("textarea", { rows: 2, maxlength: 500, placeholder: "Anything the admins should know (optional)" });
    const send = h("button", { type: "button", class: "btn gold" }, "⚑ Send report");
    send.addEventListener("click", async () => {
      if (!reason) return toast("Pick a reason.", true);
      send.disabled = true;
      try {
        const r = await pb.send(path || `/api/vc/photos/${ph.id}/report`, { method: "POST", body: { reason, note: note.value } });
        close(); toast(r.hidden ? "Thank you. It's hidden until an admin reviews it." : "Thank you. The admins will take a look."); if (onDone) onDone(r);
      } catch (err) { toast(errMsg(err), true); send.disabled = false; }
    });
    modal.append(h("div", { class: "modal-box" },
      h("div", { class: "toggle-row" }, h("h2", { id: "pr_title", style: "margin:0" }, "⚑ Report this"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
      h("p", { class: "muted", style: "margin:0" }, "What's wrong with it? Reports go to the admins and the owner isn't told who sent them."), opts, note,
      h("p", { class: "faint", style: "margin:0" }, "Photos of someone under 18 or someone who didn't agree to be posted are hidden straight away while the admins look."),
      h("div", { class: "actions", style: "margin:0" }, send)));
    document.body.append(modal);
  }
  // Full-screen viewer: ‹ › (or arrow keys, or swipe) to flip through, NSFW stays blurred until tapped.
  function openViewer(items, start, showNsfw, opts) {
    opts = opts || {};
    let i = start;
    const revealed = new Set();
    const stage = h("div", { class: "viewer-stage" });
    const cap = h("div", { class: "viewer-cap" });
    const count = h("span", { class: "viewer-count" });
    const modal = h("div", { class: "viewer", role: "dialog", "aria-modal": "true", "aria-label": "Photos and videos" });
    const close = () => { modal.remove(); document.removeEventListener("keydown", key); };
    const go = (d) => { i = (i + d + items.length) % items.length; draw(); };
    const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); };
    const draw = () => {
      const ph = items[i];
      const veiled = ph.nsfw && !showNsfw && !revealed.has(ph.id);
      const media = isVid(ph)
        ? h("video", { src: fileUrl(ph, ph.image), controls: true, playsinline: true, preload: "metadata", autoplay: !veiled })
        : h("img", { src: fileUrl(ph, ph.image, "1200x0"), alt: ph.caption || "" });
      stage.replaceChildren(h("div", { class: "viewer-media" + (veiled ? " veiled" : "") }, media,
        veiled ? h("button", { type: "button", class: "viewer-reveal", onclick: () => { revealed.add(ph.id); draw(); } }, "NSFW · tap to show") : null));
      cap.replaceChildren(ph.caption || "", ph.flagged ? h("span", { class: "faint" }, (ph.caption ? " · " : "") + "🔒 Hidden from others while an admin reviews a report") : "");
      count.textContent = items.length > 1 ? `${i + 1} / ${items.length}` : "";
      reportBtn.hidden = !opts.canReport;
    };
    const reportBtn = h("button", { type: "button", class: "btn small ghost viewer-report", onclick: () => reportPhoto(items[i], (r) => { if (r.hidden) { items[i].flagged = true; close(); if (opts.onHidden) opts.onHidden(); } }) }, "⚑ Report");
    let x0 = null;
    stage.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); });
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target === stage) close(); });
    const nav = items.length > 1;
    modal.append(
      h("div", { class: "viewer-top" }, count, h("span", { class: "actions", style: "margin:0" }, reportBtn, h("button", { type: "button", class: "btn iconbtn", "aria-label": "Close", onclick: close }, "✕"))),
      nav ? h("button", { type: "button", class: "viewer-nav prev", "aria-label": "Previous", onclick: () => go(-1) }, "‹") : "",
      stage,
      nav ? h("button", { type: "button", class: "viewer-nav next", "aria-label": "Next", onclick: () => go(1) }, "›") : "",
      cap);
    document.body.append(modal); document.addEventListener("keydown", key);
    draw();
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

    // Rough areas around Sacramento and the Bay Area (the old free-text "general area" was too vague).
    const AREAS = [
      ["Sacramento area", ["Sacramento", "Natomas", "West Sacramento", "Elk Grove", "Rancho Cordova", "Carmichael / Fair Oaks", "Citrus Heights", "Roseville", "Rocklin", "Lincoln", "Folsom", "El Dorado Hills", "Cameron Park / Placerville", "Auburn", "Davis", "Woodland", "Vacaville / Dixon", "Yuba City / Marysville", "Galt / Lodi"]],
      ["Bay Area", ["San Francisco", "Oakland", "Berkeley", "Richmond / El Cerrito", "Hayward / San Leandro", "Fremont / Newark", "San Jose", "Santa Clara / Sunnyvale", "Mountain View / Palo Alto", "San Mateo / Peninsula", "Walnut Creek / Concord", "Pleasanton / Livermore / Dublin", "Vallejo / Fairfield", "Napa", "Santa Rosa / Sonoma", "Marin", "Santa Cruz"]],
      ["Nearby", ["Stockton / Tracy", "Modesto", "Elsewhere in California", "Out of state"]],
    ];
    const areaSelect = () => {
      const cur = rec.location || "";
      const known = AREAS.some(([, list]) => list.includes(cur));
      const sel = h("select", { id: "f_location", name: "location" },
        h("option", { value: "" }, "Prefer not to say"),
        cur && !known ? h("option", { value: cur }, `${cur} (old answer, please pick one)`) : null,
        // A to Z inside each group ("Elsewhere in California" and "Out of state" stay at the end).
        AREAS.map(([group, list]) => h("optgroup", { label: group }, [...list].sort((a, b) => {
          const last = (x) => /^(Elsewhere|Out of state)/.test(x) ? 1 : 0;
          return last(a) - last(b) || a.localeCompare(b);
        }).map((a) => h("option", { value: a }, a)))));
      sel.value = cur;
      return sel;
    };
    const input = (name, attrs = {}) => h("input", Object.assign({ type: "text", id: "f_" + name, name, value: rec[name] || "" }, attrs));
    // Birthday: month and day, plus an optional year (only used to show your age, if you want).
    const [bMo, bDy] = (rec.birthday || "").split("-");
    const bMonth = h("select", { id: "f_bmonth", "aria-label": "Birthday month" }, h("option", { value: "" }, "Month"), MONTHS.map((m, i) => h("option", { value: String(i + 1).padStart(2, "0") }, m)));
    const bDay = h("select", { id: "f_bday", "aria-label": "Birthday day" }, h("option", { value: "" }, "Day"), Array.from({ length: 31 }, (_, i) => h("option", { value: String(i + 1).padStart(2, "0") }, String(i + 1))));
    const bYear = h("input", { type: "number", id: "f_byear", inputmode: "numeric", min: "1900", max: String(new Date().getFullYear() - 21), placeholder: "Year", title: "Birth year (optional)", "aria-label": "Birth year (optional)", value: rec.birth_year || "" });
    const showAge = h("input", { type: "checkbox", checked: rec.birth_year ? !!rec.show_age : true });
    const ageRow = h("label", { class: "check" }, showAge, "Show my age on my page");
    const calBox = h("input", { type: "checkbox", checked: !!rec.bday_cal });
    const calRow = h("label", { class: "check" }, calBox, "🎉 Put my birthday on the Events calendar");
    bMonth.value = bMo || ""; bDay.value = bDy || "";
    const syncBday = () => {
      const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][(+bMonth.value || 1) - 1];
      [...bDay.options].forEach((o) => { if (o.value) o.disabled = +o.value > max; });
      if (+bDay.value > max) bDay.value = "";
      bYear.disabled = !bMonth.value; ageRow.hidden = !bYear.value.trim() || !bMonth.value; calRow.hidden = !bMonth.value;
    };
    bMonth.addEventListener("change", syncBday); bYear.addEventListener("input", syncBday); syncBday();
    const bdayField = h("div", { class: "field" }, h("label", { for: "f_bmonth" }, "🎂 Birthday"),
      h("div", { class: "bday-row" }, bMonth, bDay, bYear), calRow, ageRow,
      h("span", { class: "hint" }, "Optional. Members see the month and day on your page, and on the calendar if you tick that box. The year is only used to show your age, and only if you tick that box."));
    const readBday = () => {
      if (!bMonth.value && !bDay.value) return { birthday: "", year: "" };
      if (!bMonth.value || !bDay.value) throw new Error("Pick both a month and a day for your birthday, or leave both blank.");
      const y = bYear.value.trim();
      if (y && !/^(19|20)\d\d$/.test(y)) throw new Error("Birth year should look like 1990, or leave it blank.");
      return { birthday: `${bMonth.value}-${bDay.value}`, year: y };
    };
    const area = (name, attrs = {}) => { const t = h("textarea", Object.assign({ id: "f_" + name, name }, attrs)); t.value = rec[name] || ""; return t; };
    // The hobbies box plus a tap-to-add list. Tapping adds or removes a hobby in the box; typing in the box updates the list.
    const hobbyField = (ta) => {
      const key = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const current = () => hobbyList(ta.value);
      const has = (x) => current().some((y) => key(y) === key(x));
      const pills = [];
      const sync = () => { const set = new Set(current().map(key)); pills.forEach(([b, x]) => b.setAttribute("aria-pressed", String(set.has(key(x))))); count.textContent = current().length ? `${current().length} picked` : ""; };
      const toggle = (x) => {
        const list = current();
        const next = has(x) ? list.filter((y) => key(y) !== key(x)) : [...list, x];
        ta.value = next.join(", ");
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        sync();
      };
      const count = h("span", { class: "faint hobby-count" });
      const groups = HOBBY_GROUPS.map(([g, items]) => h("div", { class: "hobby-group" }, h("b", {}, g),
        h("div", { class: "pills" }, items.map((x) => { const b = h("button", { type: "button", class: "pill hobby-pill", "aria-pressed": "false", onclick: () => toggle(x) }, x); pills.push([b, x]); return b; }))));
      const picker = h("details", { class: "hobby-picker" }, h("summary", {}, "🎨 Pick from a list ", count), h("div", { class: "hobby-groups" }, groups));
      ta.addEventListener("input", sync);
      sync();
      return h("div", { class: "hobby-field" }, ta, picker);
    };
    const field = (label, control, hint, full) => h("div", { class: "field" + (full ? " full" : "") }, h("label", { for: control.id || (control.querySelector("textarea, input, select") || {}).id || "" }, label), control, hint ? h("span", { class: "hint" }, hint) : null);

    // avatar
    const avWrap = h("div", {}, avatarEl(rec));
    const avInput = h("input", { type: "file", accept: "image/*", class: "sr", id: "avatarInput" });
    avInput.addEventListener("change", () => {
      const f = avInput.files[0]; if (!f) return;
      avatarFile = f; removeAvatar = false;
      avWrap.replaceChildren(h("img", { class: "avatar", src: URL.createObjectURL(f), alt: "" }));
      refreshLook(); syncPrivacy();
    });
    const avatarBox = h("div", { class: "avatar-edit" }, avWrap,
      h("div", { class: "actions", style: "margin:0" },
        h("label", { class: "btn small", for: "avatarInput" }, "Upload photo"), avInput,
        h("button", { class: "btn small ghost", type: "button", onclick: () => { avatarFile = null; removeAvatar = true; avWrap.replaceChildren(avatarEl({ display_name: nameI.value })); refreshLook(); syncPrivacy(); } }, "Remove")));

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
        shareButton({ url: profileUrl(rec.slug), title: rec.display_name, cls: "btn small", extra: [["📸", "Post with photos", "Write a post, pick which bits to include and add photos from your gallery.", () => openShare(rec, photos)]] }),
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
    // Relationship style picker (up to 5), in two groups, with what each one means.
    let relSel = (rec.rel_style || []).slice();
    const relPills = h("div", { class: "rel-groups", role: "group", "aria-label": "Relationship style" });
    const relPill = ([v, label, , what]) => h("button", { type: "button", class: "pill", title: what, "aria-pressed": String(relSel.includes(v)), onclick: () => {
      if (relSel.includes(v)) relSel = relSel.filter((x) => x !== v);
      else if (relSel.length >= 5) return toast("Pick up to 5", true);
      else relSel = relSel.concat(v);
      drawRelStyle();
    } }, label);
    const drawRelStyle = () => relPills.replaceChildren(
      h("div", { class: "pills" }, REL_STYLES.filter((x) => x[2] === "general").map(relPill)),
      h("b", { class: "rel-group-h" }, "🌈 Polyamory & ENM"),
      h("div", { class: "pills" }, REL_STYLES.filter((x) => x[2] === "poly").map(relPill)));
    drawRelStyle();
    const relStyleField = h("div", { class: "field full" }, h("span", { class: "label" }, "💞 Relationship style"), relPills,
      h("details", { class: "rel-help" }, h("summary", {}, "What do these mean?"),
        h("dl", {}, REL_STYLES.flatMap(([, label, , what]) => [h("dt", {}, label), h("dd", {}, what)]))),
      h("span", { class: "hint" }, "Optional. Pick up to 5. Shown on your page."));

    // My people: relationships with other members. They only show once the other person accepts.
    const peoplePanel = h("section", { class: "panel", id: "people" });
    let memberNames = null;
    async function drawPeople() {
      let d;
      try { d = await pb.send("/api/vc/relationships", {}); } catch (err) { peoplePanel.replaceChildren(h("h2", {}, "💞 My people"), h("p", { class: "muted" }, errMsg(err))); return; }
      if (!memberNames) { try { memberNames = await pb.collection("members").getFullList({ filter: "listed = true", sort: "display_name", fields: "slug,display_name" }); } catch { memberNames = []; } }
      const act = async (r, action, msg) => { try { await pb.send(`/api/vc/relationships/${r.id}`, { method: "POST", body: { action } }); toast(msg); drawPeople(); } catch (err) { toast(errMsg(err), true); } };
      const label = (t) => { const [, e, l] = relType(t); return `${e} ${l}`; };
      const incoming = d.relationships.filter((r) => r.status === "pending" && r.direction === "received");
      const linked = d.relationships.filter((r) => r.status === "accepted");
      const waiting = d.relationships.filter((r) => r.status === "pending" && r.direction === "sent");
      const row = (r, text, ...btns) => h("div", { class: "rel-item" + (r.status === "pending" ? " pending" : "") }, personChip(r.other), h("span", { class: "rel-what" }, text), h("span", { class: "rel-btns" }, ...btns));
      const who = h("input", { type: "text", id: "rel_who", list: "rel_members", placeholder: "Their name or profile link", autocomplete: "off", "aria-label": "Who" });
      const what = h("select", { id: "rel_type", "aria-label": "What they are to you" }, h("option", { value: "" }, "They are my…"), REL_TYPES.map(([v, e, l]) => h("option", { value: v }, `${e} ${l}`)));
      const send = h("button", { type: "button", class: "btn small gold" }, "Send request");
      send.addEventListener("click", async () => {
        let v = who.value.trim();
        const byName = memberNames.find((m) => m.display_name.toLowerCase() === v.toLowerCase());
        if (byName) v = byName.slug;
        v = v.replace(/^https?:\/\/[^/]+\//i, "").replace(/[/?#].*$/, "").replace(/^@/, "");
        if (!v) return toast("Who is it? Type their name or profile link.", true);
        if (!what.value) return toast("Pick what they are to you.", true);
        send.disabled = true;
        try { const res = await pb.send("/api/vc/relationships", { method: "POST", body: { to: v, type: what.value } }); toast(`💌 Request sent to ${res.other.display_name}`); drawPeople(); }
        catch (err) { toast(errMsg(err), true); send.disabled = false; }
      });
      peoplePanel.replaceChildren(...[
        h("h2", {}, "💞 My people"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Link your page to someone else's: a partner, spouse, your Dom, your pet… They get a request, and it only shows on both pages once they say yes. Only logged-in members see these, and either of you can remove it any time."),
        incoming.length ? h("div", { class: "rel-group" }, h("h3", {}, "💌 Waiting for your answer"), incoming.map((r) => row(r, `wants to show as your ${label(r.type)}`,
          h("button", { type: "button", class: "btn small gold", onclick: () => act(r, "accept", "💞 Linked! It's on both your pages now.") }, "Accept"),
          h("button", { type: "button", class: "btn small ghost", onclick: () => act(r, "decline", "Declined") }, "Decline")))) : null,
        linked.length ? h("div", { class: "rel-group" }, h("h3", {}, "On your page"), linked.map((r) => row(r, label(r.type),
          h("button", { type: "button", class: "btn small ghost", onclick: () => confirm(`Remove ${r.other.display_name} from your page? It comes off theirs too.`) && act(r, "remove", "Removed") }, "Remove")))) : null,
        waiting.length ? h("div", { class: "rel-group" }, h("h3", {}, "⏳ Waiting for them"), waiting.map((r) => row(r, label(r.type),
          h("button", { type: "button", class: "btn small ghost", onclick: () => act(r, "remove", "Request cancelled") }, "Cancel")))) : null,
        h("div", { class: "rel-add" }, who, what, send),
        h("datalist", { id: "rel_members" }, memberNames.filter((m) => m.slug !== rec.slug).map((m) => h("option", { value: m.display_name }))),
        h("p", { class: "faint", style: "margin:6px 0 0" }, "Not on the member list? Use their profile link name (the part after velvetcollarsac.com/).")].filter(Boolean));
    }
    drawPeople();

    const lookingField = h("div", { class: "field full" },
      h("span", { class: "label" }, "What you're looking for right now"),
      lookingPills,
      h("span", { class: "hint" }, "Shown right under your name. Pick any that fit, or Open to anything, and change it whenever things change."));

    // member list opt-in
    const listedBox = h("input", { type: "checkbox", checked: !!rec.listed });
    const reactBox = h("input", { type: "checkbox", checked: !rec.reactions_off });
    const notesBox = h("input", { type: "checkbox", checked: !rec.notes_off });
    const matchBox = h("input", { type: "checkbox", checked: !rec.matches_off });
    const crushBox = h("input", { type: "checkbox", checked: !rec.crushes_off });
    const vouchBox = h("input", { type: "checkbox", checked: !rec.vouches_off });
    const onlineBox = h("input", { type: "checkbox", checked: !rec.hide_online });
    // These only work once there's a profile photo. Without one they're off and greyed out;
    // adding a photo switches the usual ones back on (you can still untick them before saving).
    const privBoxes = [listedBox, reactBox, notesBox, matchBox, crushBox, vouchBox, onlineBox];
    const photoNote = h("p", { class: "photo-needed", hidden: true }, "📷 Add a profile photo to turn these on. Until then you're not on the member list and people can't react, leave notes, send crushes or vouch for you.");
    let hadPhoto = !!rec.avatar;
    const syncPrivacy = () => {
      const has = !!avatarFile || (!removeAvatar && !!rec.avatar);
      photoNote.hidden = has;
      for (const b of privBoxes) { b.disabled = !has; if (!has) b.checked = false; b.closest("label")?.classList.toggle("is-off", !has); }
      if (has && !hadPhoto) for (const b of [reactBox, notesBox, matchBox, crushBox, vouchBox, onlineBox]) b.checked = true;
      hadPhoto = has;
    };
    setTimeout(syncPrivacy, 0);   // once the Privacy section below has been built

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

    const seasonTag = (o) => o.season && L.SEASONS[o.season] ? h("small", { class: "season-tag", title: "Until " + L.SEASONS[o.season].until }, L.SEASONS[o.season].label.split(" ")[0]) : null;
    const pills = (key, list, decorate) => h("div", { class: "pills", role: "group" }, L.available(list).map((o) =>
      h("button", { type: "button", class: "pill" + (o.season ? " seasonal" : ""), "data-look": key, "data-val": o.id, "aria-pressed": "false",
        onclick: () => { look[key] = o.id; refreshLook(); } }, decorate ? decorate(o) : null, o.name, seasonTag(o))));

    const paletteGrid = h("div", { class: "pal-grid" }, L.available(L.PALETTES).map((pal) =>
      h("button", { type: "button", class: "pal" + (pal.season ? " seasonal" : ""), "data-look": "palette", "data-val": pal.id, "aria-pressed": "false",
        onclick: () => { Object.assign(look, { palette: pal.id, deep: pal.deep, mid: pal.mid, glow: pal.glow, accent: pal.accent }); refreshLook(); } },
        h("span", { class: "sw", style: `background:linear-gradient(120deg, ${pal.deep}, ${pal.mid} 45%, ${pal.glow})` }, h("i", { style: `background:${pal.accent}` })),
        h("b", {}, pal.name, seasonTag(pal)))));

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
      const pal = rand(L.available(L.PALETTES));
      Object.assign(look, { palette: pal.id, deep: pal.deep, mid: pal.mid, glow: pal.glow, accent: pal.accent,
        pattern: rand(L.available(L.PATTERNS).slice(1)).id, ring: rand(L.RINGS).id, font: rand(L.FONTS).id,
        particles: rand(L.available(L.PARTICLES)).id, corners: rand(L.CORNERS).id });
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
      const f = h("form", { class: "pw-form" }, h("span", { class: "label" }, "Password"), pwToggle(oldIn), pwToggle(newIn), btn);
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
          L.available(L.PALETTES).some((x) => x.season) ? h("p", { class: "season-note" }, "🎃 The Halloween pack is here until November 1: spooky palettes, spider webs, bats and new charms. Look for the 🎃.") : null,
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
              photoNote,
              h("label", { class: "check", style: "margin-top:8px" }, listedBox, "Put me on the member list"),
              h("span", { class: "hint" }, "Logged-in members can browse the list. Leave it off and people only find you through your link.")),
            h("div", { class: "field full" },
              h("span", { class: "label" }, "On my page"),
              h("label", { class: "check" }, reactBox, "Let members leave reactions (🔥 💜 🐾 ✨, always anonymous)"),
              h("label", { class: "check" }, notesBox, "Let members leave kind notes (you OK each one first)"),
              h("label", { class: "check" }, matchBox, "Show logged-in members what we have in common on Kink Jars (and include me in Kink twins)"),
              h("label", { class: "check" }, crushBox, "Let members send me secret crushes (you only find out if it's mutual)"),
              h("label", { class: "check" }, vouchBox, "Let members who've met me vouch for me"),
              h("label", { class: "check" }, onlineBox, "Show a 🟢 green dot when I'm on the site")))),
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
        const u = h("input", { type: "url", placeholder: it.ph || urlPh, value: it.url || "", inputmode: "url", "aria-label": "Link" });
        // Pasted without https:// (like fetlife.com/users/123)? Add it so the link works.
        u.addEventListener("blur", () => { const v = u.value.trim(); if (v && !/^[a-z]+:\/\//i.test(v) && /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(v)) u.value = "https://" + v; });
        const row = h("div", { class: "row" }, t, u, h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Remove", onclick: () => row.remove() }, "✕"));
        rows.append(row);
        return { t, u };
      };
      (items || []).forEach(add);
      const wrap = h("div", {}, rows,
        h("button", { type: "button", class: "btn small", onclick: () => { const r = add(); r && r.t.focus(); } }, "+ Add"),
        presets ? h("div", { class: "presets" }, presets.map(([label]) =>
          h("button", { type: "button", class: "btn small ghost", onclick: () => { const r = add({ title: label, ph: `Paste your ${label} link here` }); if (r) r.u.focus(); } }, "+ " + label))) : null);
      wrap.add = add;
      wrap.read = () => [...rows.children].map((r) => {
        const [t, u] = r.querySelectorAll("input");
        return { title: t.value.trim(), url: u.value.trim() };
      }).filter((x) => x.url);
      return wrap;
    }
    // Vibe playlist: up to 6 song (or whole-playlist) links.
    const songsEd = (() => {
      const MAX = 6;
      const start = Array.isArray(rec.songs) && rec.songs.length ? rec.songs.map((x) => x.url) : rec.song ? [rec.song] : [];
      const rows = h("div", { class: "song-rows" });
      const addBtn = h("button", { type: "button", class: "btn small ghost" }, "+ Add another song");
      const row = (v) => {
        const inp = h("input", { type: "url", maxlength: 300, value: v || "", placeholder: rows.children.length ? "https://… (another song)" : "https://open.spotify.com/track/…", "aria-label": "Song link" });
        inp.addEventListener("blur", () => { const t = inp.value.trim(); if (t && !/^https?:\/\//i.test(t) && /\./.test(t)) inp.value = "https://" + t; });
        const el = h("div", { class: "song-row" }, inp, h("button", { type: "button", class: "btn small ghost", "aria-label": "Remove this song", onclick: () => { el.remove(); if (!rows.children.length) rows.append(row("")); sync(); } }, "✕"));
        return el;
      };
      const sync = () => { addBtn.style.display = rows.children.length >= MAX ? "none" : ""; };
      addBtn.addEventListener("click", () => { if (rows.children.length < MAX) { const r = row(""); rows.append(r); r.querySelector("input").focus(); } sync(); });
      (start.length ? start : [""]).slice(0, MAX).forEach((v) => rows.append(row(v)));
      sync();
      return { el: h("div", { class: "songs-ed" }, rows, addBtn), read: () => [...rows.querySelectorAll("input")].map((i) => i.value.trim()).filter(Boolean).map((url) => ({ url })) };
    })();
    const linksEd = listEditor([...(rec.jars || []), ...(rec.links || [])], "Name (FetLife, wishlist…)", "Paste the link here", 40, LINK_PRESETS);
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
    const phInput = h("input", { type: "file", accept: "image/*,video/mp4,video/quicktime,video/webm,.mov,.mp4,.m4v,.webm", multiple: true, class: "sr", id: "photoInput" });
    // Upload rules: tick to agree before adding anything (remembered on this device once agreed).
    let rulesOk = false; try { rulesOk = localStorage.getItem("vc_photo_rules") === "1"; } catch {}
    const rulesTick = h("input", { type: "checkbox", id: "photoRules", checked: rulesOk });
    rulesTick.addEventListener("change", () => { rulesOk = rulesTick.checked; try { localStorage.setItem("vc_photo_rules", rulesOk ? "1" : "0"); } catch {} drawPhotos(); });
    const photoRules = h("section", { class: "photo-rules" },
      h("b", {}, "📜 Before you upload"),
      h("ul", {},
        h("li", {}, h("b", {}, "No children. "), "Nothing showing anyone under 18, sexual or not, including in the background."),
        h("li", {}, h("b", {}, "Consent. "), "Only photos and videos of yourself, or of people who agreed to be posted here. If anyone else is in it, ask them first."),
        h("li", {}, h("b", {}, "Mark explicit ones NSFW. "), "Anything with nudity or sex gets the NSFW tick so it's blurred until someone chooses to look."),
        h("li", {}, h("b", {}, "Follow the community guidelines. "), "Nothing hateful, nothing that outs someone, nothing you don't have the rights to.")),
      h("p", { class: "faint", style: "margin:4px 0 8px" }, "Members can report anything that breaks these. Reports of a minor or of someone who didn't consent hide it straight away while the admins review it."),
      h("label", { class: "check", for: "photoRules" }, rulesTick, h("span", {}, "I understand and my uploads follow these rules.")));
    phInput.addEventListener("change", async () => {
      const files = [...phInput.files]; phInput.value = "";
      if (!rulesOk) { toast("Please read and tick the upload rules first.", true); photoRules.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      for (let f of files) {
        if (photos.length >= 100) { toast("Galleries are limited to 100 photos and videos", true); break; }
        const vid = /^video\//.test(f.type) || /\.(mp4|mov|webm|m4v)$/i.test(f.name);
        if (!vid && window.VCShrink) f = await window.VCShrink(f);
        if (vid && f.size > 50 * 1024 * 1024) { toast(`${f.name} is over 50 MB. Try a shorter clip.`, true); continue; }
        if (!vid && f.size > 12 * 1024 * 1024) { toast(`${f.name} is over 12 MB.`, true); continue; }
        try {
          toast((vid ? "Uploading video " : "Uploading ") + f.name + (vid ? "… this can take a minute" : "…"));
          const fd = new FormData();
          fd.append("owner", rec.id); fd.append("image", f); fd.append("nsfw", newNsfw.checked ? "true" : "false");
          fd.append("sort", String(photos.length));
          photos.push(await pb.collection("photos").create(fd));
          drawPhotos();
        } catch (err) { toast(errMsg(err), true); }
      }
      toast("Gallery saved");
    });
    function drawPhotos() {
      try { drawGlow(); } catch {}   // not set up yet on the first draw
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
          return h("div", { class: "ph-card" + (ph.flagged ? " flagged" : "") },
            h("span", { class: "ph-media" }, mediaThumb(ph), ph.flagged ? h("span", { class: "ph-flag", title: "Someone reported this, so it's hidden from others until an admin reviews it." }, "🔒 Under review") : null),
            h("div", { class: "ctl" }, cap,
              h("div", { class: "line" },
                h("label", { class: "check" }, nsfw, "NSFW"),
                h("span", {},
                  h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Move earlier", onclick: () => move(-1) }, "←"),
                  h("button", { type: "button", class: "btn iconbtn ghost", "aria-label": "Move later", onclick: () => move(1) }, "→"),
                  h("button", { type: "button", class: "btn iconbtn danger", "aria-label": "Delete", onclick: async () => {
                    if (!confirm(isVid(ph) ? "Delete this video?" : "Delete this photo?")) return;
                    try { await pb.collection("photos").delete(ph.id); photos = photos.filter((x) => x.id !== ph.id); drawPhotos(); toast("Photo deleted"); }
                    catch (err) { toast(errMsg(err), true); }
                  } }, "🗑")))));
        }),
        h("label", { class: "upload" + (rulesOk ? "" : " locked"), for: rulesOk ? "photoInput" : "photoRules", onclick: () => { if (!rulesOk) toast("Tick the upload rules first 💜", true); } }, h("span", {}, h("b", {}, rulesOk ? "+ Add photos or videos" : "🔒 Tick the rules above to upload"), h("br"), h("small", {}, `${photos.length} of 100 · photos up to 12 MB · up to 10 videos (MP4, MOV, WebM), 50 MB each`))),
      );
    }
    drawPhotos();

    // save
    const saveBtn = h("button", { class: "btn gold", type: "button" }, "Save profile");
    saveBtn.addEventListener("click", async () => {
      if (!nameI.value.trim()) return toast("Add a display name", true);
      if (!slugOk) return toast("Pick a different profile name", true);
      const bad = [...linksEd.read(), ...readPlayLinks(), ...songsEd.read()].find((x) => !safeUrl(x.url));
      if (bad) return toast(`"${bad.url}" needs to start with https://`, true);
      let bday; try { bday = readBday(); } catch (err) { return toast(err.message, true); }
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      try {
        const fd = new FormData();
        fd.append("birthday", bday.birthday);
        fd.append("birth_year", bday.year || "0");
        fd.append("show_age", bday.year && showAge.checked ? "true" : "false");
        fd.append("bday_cal", bday.birthday && calBox.checked ? "true" : "false");
        fd.append("display_name", nameI.value.trim());
        fd.append("slug", slugI.value.trim());
        for (const k of ["pronouns", "dynamic", "location", "bio", "hobbies", "into", "limits"]) fd.append(k, document.getElementById("f_" + k).value.trim());
        fd.append("tg_username", document.getElementById("f_tg_username").value.trim().replace(/^@/, ""));
        fd.append("style", JSON.stringify(look));
        fd.append("listed", listedBox.checked ? "true" : "false");
        fd.append("reactions_off", reactBox.checked ? "false" : "true");
        fd.append("notes_off", notesBox.checked ? "false" : "true");
        fd.append("matches_off", matchBox.checked ? "false" : "true");
        fd.append("crushes_off", crushBox.checked ? "false" : "true");
        fd.append("vouches_off", vouchBox.checked ? "false" : "true");
        fd.append("hide_online", onlineBox.checked ? "false" : "true");
        fd.append("songs", JSON.stringify(songsEd.read()));
        if (lookingSel.length) lookingSel.forEach((v) => fd.append("looking_for", v)); else fd.append("looking_for", "");
        if (relSel.length) relSel.forEach((v) => fd.append("rel_style", v)); else fd.append("rel_style", "");
        fd.append("jars", "[]"); // jars now live in links
        fd.append("links", JSON.stringify(linksEd.read()));
        fd.append("play_links", JSON.stringify(readPlayLinks()));
        fd.append("prompts", JSON.stringify(readPrompts()));
        fd.append("care", JSON.stringify(readCare()));
        if (avatarFile) fd.append("avatar", window.VCShrink ? await window.VCShrink(avatarFile, { max: 1200 }) : avatarFile);
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
        otherEd = listEditor(others, "Game name", "Paste the link here", 10);
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
            relStyleField,
            field("Display name", nameI),
            field("Pronouns", input("pronouns", { maxlength: 40, placeholder: "she/her, he/him, they/them…" })),
            field("Dynamic / role", input("dynamic", { maxlength: 80, placeholder: "Switch, Dom, sub, pet, brat…" })),
            field("Area", areaSelect(), "Roughly where you are, so people nearby can find you. Optional."),
            bdayField,
            field("About you", area("bio", { maxlength: 3000, placeholder: "Who you are, what you're looking for, how to approach you…" }), null, true),
            field("Hobbies", hobbyField(area("hobbies", { maxlength: 1000, class: "short", placeholder: "Gaming, hiking, baking, D&D…" })), "The everyday you. Tap some below, or type your own separated by commas. They show as tags.", true),
            h("div", { class: "field full" }, h("label", {}, "🎵 Vibe playlist"), songsEd.el,
              h("span", { class: "hint" }, "Songs that are very you. Paste Spotify, Apple Music, YouTube or SoundCloud links, up to 6. A Spotify or Apple Music playlist link plays the whole playlist.")))),
        peoplePanel,
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
        h("section", { class: "panel" }, h("h2", {}, "Photos & videos"),
          photoRules,
          h("div", { class: "toggle-row" },
            h("p", { class: "faint", style: "margin:0" }, "They save as soon as you add them. NSFW ones stay blurred until a viewer taps."),
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

    // Glow-up meter: how complete the saved profile is, and the next thing to add.
    const glowHolder = h("div", {});
    // Open the right tab, scroll to the exact spot, put the cursor there and give it a little glow.
    function goTo(tab, sel) {
      showTab(tab);
      requestAnimationFrame(() => {
        const el = sel && document.querySelector(sel);
        if (!el) return;
        const field = el.closest(".field") || el.closest("section") || el;
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusEl = el.matches("input, textarea, select, button") ? el : el.querySelector("input:not([type=file]):not(.sr), textarea, select, button");
        if (focusEl) setTimeout(() => focusEl.focus({ preventScroll: true }), 350);
        field.classList.remove("glow-target"); void field.offsetWidth; field.classList.add("glow-target");
        setTimeout(() => field.classList.remove("glow-target"), 2600);
      });
    }
    const drawGlow = () => {
      const g = glowUp(rec, photos.length);
      const next = g.todo[0];
      const tabLabel = (id) => (TABS.find((t) => t.id === id) || {}).label || "";
      glowHolder.replaceChildren(h("section", { class: "glow-meter" + (g.score >= 100 ? " full" : "") },
        h("div", { class: "glow-ring", style: `--pct:${g.score}`, role: "img", "aria-label": `Profile ${g.score}% complete` }, h("span", {}, g.score + "%")),
        h("div", { class: "glow-txt" },
          h("b", {}, g.score >= 100 ? "✨ Fully glowed up!" : g.score >= 70 ? "Looking good!" : g.score >= 40 ? "Getting there" : "Let's dress up your page"),
          next ? h("span", {}, "Next: ", h("button", { type: "button", class: "see-all", onclick: () => goTo(next[3], next[4]) }, next[2]), h("small", { class: "faint" }, ` (+${next[0]}% · ${tabLabel(next[3])})`))
            : h("span", { class: "faint" }, "You've earned the ✨ Glowed up badge."))));
    };
    drawGlow();
    saveBtn.addEventListener("click", () => setTimeout(drawGlow, 800));

    app.replaceChildren(
      glowHolder,
      tabBar,
      ...TABS.map((t) => panes[t.id]),
      h("div", { class: "savebar" }, h("a", { class: "btn ghost", href: "/" + rec.slug, "data-nav": "" }, "Cancel"), saveBtn),
    );
    nameI.addEventListener("input", refreshLook);
    const startHash = location.hash.slice(1);
    showTab(startHash);
    if (startHash === "people") setTimeout(() => peoplePanel.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    refreshLook();
  }

  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || "Copied"); }
    catch { prompt("Copy this:", text); }
  }
  if (window.VCWhisper) window.VCWhisper.deps = { h, pb, toast, go, me, errMsg, personChip };
  if (window.VCConfess) window.VCConfess.deps = { h, pb, toast, go, me, errMsg };
  if (window.VCHotSeat) window.VCHotSeat.deps = { h, pb, toast, go, me, errMsg, personChip };
  if (window.VCMatch) window.VCMatch.deps = { h, pb, toast, go, me, errMsg, personChip };
  if (window.VCBingo) window.VCBingo.deps = { h, pb, toast, go, me, errMsg, personChip };
  if (window.VCTod) window.VCTod.deps = { h, pb, toast, go, me, errMsg, personChip, fileUrl, openViewer, reportPhoto };
  if (window.VCNetwork) window.VCNetwork.deps = { h, pb, toast, go, me, errMsg, personChip, miniAvatar, fileUrl };
  if (window.VCMod) window.VCMod.deps = { h, pb, toast, go, me, errMsg, personChip, miniAvatar, copyText };
  if (window.VCHunt) window.VCHunt.deps = { h, pb, toast, go, me, errMsg, personChip, miniAvatar, parseTags, copyText, limitsBody };

  render();
})();
