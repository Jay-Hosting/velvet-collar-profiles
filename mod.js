/* The Admin page: reports, members, events, question of the week and content clean-up.
   Members with the "admin" or "owner" badge see every tab; "host" sees Events only. The server checks this too.
   Uses helpers app.js shares on window.VCMod.deps (h, pb, toast, go, me, errMsg, personChip, miniAvatar, copyText, fmtWhen). */
(() => {
  "use strict";
  const deps = () => window.VCMod.deps;
  const BADGES = [["owner", "🗝️ Owner"], ["admin", "🛡️ Admin"], ["host", "🎪 Host"], ["welcomer", "🤗 Welcomer"], ["helper", "🛠️ Helper"], ["vip", "👑 VIP"]];
  const TABS = [["reports", "⚑ Reports"], ["members", "👥 Members"], ["vetting", "✅ Vetting"], ["events", "📅 Events"], ["question", "❓ Question"], ["content", "🧹 Content"]];
  const PT = { timeZone: "America/Los_Angeles" };
  const when = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleString("en-US", { ...PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT"; };
  const day = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleDateString("en-US", { ...PT, weekday: "short", month: "short", day: "numeric" }); };

  async function render(app, tab) {
    const { h, pb, toast, go, errMsg } = deps();
    document.title = "Admin · Velvet Collar";
    let sum;
    try { sum = await pb.send("/api/vc/mod/summary", {}); } catch (err) { sum = { mod: false, host: false }; }
    if (!sum.host) {
      app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "Admins only"), h("p", { class: "muted" }, "This page is for the group's admins and hosts."), h("a", { class: "btn", href: "/", "data-nav": "" }, "Back to members")));
      return;
    }
    const tabs = sum.mod ? TABS : TABS.filter((t) => t[0] === "events" || t[0] === "vetting");
    if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
    const body = h("div", {});
    const nav = h("div", { class: "pills mod-tabs", role: "tablist" }, tabs.map(([id, label]) =>
      h("a", { class: "pill", href: "/admin/" + id, "data-nav": "", role: "tab", "aria-selected": String(id === tab), "aria-pressed": String(id === tab) },
        label, id === "reports" && sum.openReports ? h("span", { class: "nav-badge" }, String(sum.openReports)) : null)));
    app.replaceChildren(h("section", { class: "mod-head" }, h("h1", {}, "🛡️ Admin"),
      h("p", { class: "muted" }, sum.mod ? "Everything here acts on the real accounts. Be kind, be careful." : "As a host you can add and edit events.")), nav, body);
    try { await ({ reports, members: (b) => members(b, sum), vetting, events, question, content })[tab](body); }
    catch (err) { body.replaceChildren(h("p", { class: "muted" }, errMsg(err))); }
  }

  // ---------- reports ----------
  async function reports(body) {
    const { h, pb, toast, personChip, errMsg } = deps();
    const data = await pb.send("/api/vc/mod/reports", {});
    const act = async (path, payload, msg) => { try { await pb.send(path, { method: "POST", body: payload }); toast(msg); reports(body); } catch (err) { toast(errMsg(err), true); } };
    if (!data.reports.length) { body.replaceChildren(h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, "No reports. 🌙 All quiet."))); return; }
    body.replaceChildren(...data.reports.map((r) => {
      const who = r.reported;
      const lines = String(r.message || "").split("\n").filter(Boolean).map((l) => h("p", { class: /^Them:/.test(l) ? "them" : "rep" }, l.replace(/^Them:/, `${who ? who.display_name : "Them"}:`).replace(/^Reporter:/, `${r.reporter ? r.reporter.display_name : "Reporter"}:`)));
      return h("section", { class: "panel mod-report" + (r.handled ? " handled" : "") },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, r.handled ? "✅ Handled" : "⚑ Open report"), h("small", { class: "faint" }, when(r.created))),
        h("p", { class: "mod-who" }, "Reported: ", who ? personChip(who) : h("i", {}, "member deleted"), " · by ", r.reporter ? personChip(r.reporter) : h("i", {}, "member deleted")),
        r.reason ? h("p", {}, h("b", {}, "Why: "), r.reason) : null,
        h("div", { class: "mod-transcript" }, lines.length ? lines : h("p", { class: "faint" }, "(no messages saved)")),
        h("div", { class: "actions" },
          h("button", { type: "button", class: "btn small" + (r.handled ? " ghost" : " gold"), onclick: () => act(`/api/vc/mod/reports/${r.id}`, { handled: !r.handled }, r.handled ? "Reopened" : "Marked handled") }, r.handled ? "Reopen" : "✅ Mark handled"),
          who && who.whisper_opt ? h("button", { type: "button", class: "btn small ghost", onclick: () => confirm(`Turn off Whispers for ${who.display_name}?`) && act(`/api/vc/mod/members/${who.id}`, { whisper_opt: false }, "Whispers turned off for them") }, "🤫 Turn off their Whispers") : null,
          who && who.hunt_opt !== "off" ? h("button", { type: "button", class: "btn small ghost", onclick: () => confirm(`Take ${who.display_name} out of The Hunt?`) && act(`/api/vc/mod/members/${who.id}`, { hunt_opt: "off" }, "Hunt turned off for them") }, "🏹 Turn off their Hunt") : null,
          who && !who.hidden ? h("button", { type: "button", class: "btn small danger", onclick: () => confirm(`Hide ${who.display_name}'s profile? Nobody else will see it until you unhide it.`) && act(`/api/vc/mod/members/${who.id}`, { hidden: true }, "Profile hidden") }, "🙈 Hide their profile") : null,
          who && who.hidden ? h("span", { class: "faint" }, "Their profile is hidden.") : null));
    }));
  }

  // ---------- members ----------
  async function members(body, sum) {
    const { h, pb, toast, personChip, errMsg, copyText } = deps();
    const search = h("input", { type: "search", placeholder: "Search by name or profile name", "aria-label": "Search members" });
    const list = h("div", { class: "mod-members" });
    const out = h("div", {});
    body.replaceChildren(h("section", { class: "panel" }, search, out, list));
    let timer;
    const load = async () => {
      let data; try { data = await pb.send("/api/vc/mod/members?q=" + encodeURIComponent(search.value.trim()), {}); } catch (err) { list.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
      out.replaceChildren(h("p", { class: "faint" }, search.value.trim() ? `${data.members.length} found` : `Newest members first · ${data.total} in all`));
      list.replaceChildren(...data.members.map(row));
    };
    const save = async (m, payload, msg) => {
      try { const upd = await pb.send(`/api/vc/mod/members/${m.id}`, { method: "POST", body: payload }); toast(msg); Object.assign(m, upd); return true; }
      catch (err) { toast(errMsg(err), true); return false; }
    };
    function row(m) {
      const el = h("div", { class: "mod-member" + (m.hidden ? " is-hidden" : "") });
      const draw = () => {
        // Only an owner can give or remove the Owner badge.
        const badgeRow = h("div", { class: "pills" }, BADGES.map(([id, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String(m.badges.includes(id)),
          disabled: id === "owner" && !(sum && sum.owner), title: id === "owner" && !(sum && sum.owner) ? "Only an owner can change this" : "",
          onclick: async () => { const next = m.badges.includes(id) ? m.badges.filter((b) => b !== id) : [...m.badges, id]; if (await save(m, { badges: next }, "Badges updated")) draw(); } }, label)));
        el.className = "mod-member" + (m.hidden ? " is-hidden" : "");
        el.replaceChildren(
          h("div", { class: "toggle-row" }, h("span", {}, personChip(m), h("small", { class: "faint" }, ` @${m.slug} · joined ${day(m.created)}`, m.hidden ? " · 🙈 hidden" : "", m.listed ? "" : " · not on the list")),
            h("span", { class: "actions", style: "margin:0" },
              h("button", { type: "button", class: "btn small " + (m.hidden ? "gold" : "ghost"), onclick: async () => { if (!m.hidden && !confirm(`Hide ${m.display_name}'s profile?`)) return; if (await save(m, { hidden: !m.hidden }, m.hidden ? "Unhidden" : "Hidden")) draw(); } }, m.hidden ? "Unhide" : "🙈 Hide"),
              h("button", { type: "button", class: "btn small ghost", onclick: async () => {
                if (!confirm(`Give ${m.display_name} a new temporary password? Their old one stops working.`)) return;
                try {
                  const r = await pb.send(`/api/vc/mod/members/${m.id}/password`, { method: "POST" });
                  const msg = `Hi! Your temporary Velvet Collar password is ${r.password} . Log in with your profile name (${r.slug}) at ${location.origin}/login and change it in Settings.`;
                  el.querySelector(".mod-pw")?.remove();
                  el.append(h("div", { class: "mod-pw" }, h("p", {}, "New password: ", h("code", {}, r.password), " (shown once)"),
                    h("button", { type: "button", class: "btn small", onclick: () => copyText(msg, "Copied a message to send them privately") }, "📋 Copy a message for them")));
                } catch (err) { toast(errMsg(err), true); }
              } }, "🔑 Reset password"))),
          h("div", { class: "mod-row2" }, h("span", { class: "faint" }, "Badges:"), badgeRow),
          h("div", { class: "mod-row2" }, h("span", { class: "faint" }, `Whispers: ${m.whisper_opt ? "on" : "off"} · Hunt: ${m.hunt_opt}`),
            m.whisper_opt ? h("button", { type: "button", class: "btn small ghost", onclick: async () => { if (await save(m, { whisper_opt: false }, "Whispers off")) draw(); } }, "Turn off Whispers") : null,
            m.hunt_opt !== "off" ? h("button", { type: "button", class: "btn small ghost", onclick: async () => { if (await save(m, { hunt_opt: "off" }, "Hunt off")) draw(); } }, "Turn off Hunt") : null));
      };
      draw();
      return el;
    }
    search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 300); });
    load();
  }

  // ---------- vetting: staff can see, only owners can change ----------
  async function vetting(body) {
    const { h, pb, toast, personChip, errMsg } = deps();
    const ORDER = ["needs", "renew", "hold", "vetted"];
    const search = h("input", { type: "search", placeholder: "Find a member to set their status", "aria-label": "Search members" });
    const holder = h("div", {});
    const intro = h("p", { class: "faint", style: "margin-top:-6px" }, "");
    body.replaceChildren(h("section", { class: "panel" }, h("h2", {}, "✅ Vetting for play parties"), intro, search, holder));
    let timer;
    const load = async () => {
      let data;
      try { data = await pb.send("/api/vc/mod/vetting?q=" + encodeURIComponent(search.value.trim()), {}); }
      catch (err) { holder.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
      const L = data.labels;
      intro.textContent = (data.canEdit ? "You're an owner, so you can change statuses. " : "Only owners can change statuses. ")
        + "Everyone sees a ✅ Vetted badge on profiles; the other statuses and notes are only for admins, owners and hosts.";
      const row = (m) => {
        const v = m.vetting;
        const el = h("div", { class: "mod-member vet-row" + (v.status ? " s-" + v.status : "") });
        const note = h("input", { type: "text", maxlength: 500, value: v.note || "", placeholder: "Private note (who vetted, when it expires, why it's on hold…)", "aria-label": "Vetting note" });
        const save = async (payload, msg) => {
          try { const r = await pb.send(`/api/vc/mod/vetting/${m.id}`, { method: "POST", body: payload }); Object.assign(m, r); toast(msg); draw(); }
          catch (err) { toast(errMsg(err), true); }
        };
        const draw = () => {
          const vv = m.vetting;
          el.className = "mod-member vet-row" + (vv.status ? " s-" + vv.status : "");
          el.replaceChildren(
            h("div", { class: "toggle-row" }, personChip(m), h("small", { class: "faint" }, vv.by ? `Updated by ${vv.by}${vv.at ? " · " + day(vv.at) : ""}` : "No status yet")),
            data.canEdit
              ? h("div", { class: "pills" }, [["", "None"], ...["vetted", "needs", "renew", "hold"].map((k) => [k, L[k]])].map(([k, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String((vv.status || "") === k),
                  onclick: () => save({ status: k }, k ? `Set to ${label}` : "Status cleared") }, label)))
              : h("p", { style: "margin:0" }, h("b", {}, L[vv.status] || "Not vetted")),
            data.canEdit
              ? h("div", { class: "mod-row2" }, note, h("button", { type: "button", class: "btn small ghost", onclick: () => save({ note: note.value }, "Note saved") }, "Save note"))
              : vv.note ? h("p", { class: "faint", style: "margin:0" }, "📝 " + vv.note) : null);
        };
        draw();
        return el;
      };
      const ms = data.members.slice().sort((a, b) => (ORDER.indexOf(a.vetting.status) + 1 || 9) - (ORDER.indexOf(b.vetting.status) + 1 || 9));
      if (!ms.length) { holder.replaceChildren(h("p", { class: "muted" }, search.value.trim() ? "Nobody by that name." : (data.canEdit ? "Nobody has a vetting status yet. Search for a member to set one." : "Nobody has a vetting status yet."))); return; }
      if (search.value.trim()) { holder.replaceChildren(...ms.map(row)); return; }
      holder.replaceChildren(...ORDER.map((k) => { const grp = ms.filter((m) => m.vetting.status === k); return grp.length ? h("div", {}, h("h3", { class: "vet-group" }, `${L[k]} (${grp.length})`), ...grp.map(row)) : null; }).filter(Boolean));
    };
    search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(load, 300); });
    load();
  }

  // ---------- events ----------
  async function events(body) {
    const { h, pb, toast, errMsg } = deps();
    const data = await pb.send("/api/vc/mod/events", {});
    const f = {
      title: h("input", { type: "text", maxlength: 80, placeholder: "Halloween munch" }), emoji: h("input", { type: "text", maxlength: 8, placeholder: "🎃", style: "max-width:6em" }),
      starts_pacific: h("input", { type: "text", maxlength: 40, placeholder: "2026-10-31 7:00 PM" }), ends_pacific: h("input", { type: "text", maxlength: 40, placeholder: "2026-10-31 10:00 PM (optional)" }),
      where: h("input", { type: "text", maxlength: 120, placeholder: "Where (or 'DM for address')" }), description: h("textarea", { rows: 3, maxlength: 1000, placeholder: "What to expect, what to bring…" }),
      url: h("input", { type: "url", maxlength: 300, placeholder: "https://… (optional)" }), hidden: h("input", { type: "checkbox" }),
    };
    let editing = null;
    const title = h("h2", {}, "Add an event");
    const saveBtn = h("button", { type: "button", class: "btn gold" }, "Save event");
    const cancel = h("button", { type: "button", class: "btn ghost", style: "display:none" }, "Cancel edit");
    const fill = (ev) => {
      editing = ev ? ev.id : null;
      for (const k of Object.keys(f)) { if (k === "hidden") f.hidden.checked = !!(ev && ev.hidden); else f[k].value = ev ? ev[k] || "" : ""; }
      title.textContent = ev ? `Editing: ${ev.title}` : "Add an event"; cancel.style.display = ev ? "" : "none";
      if (ev) title.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    cancel.addEventListener("click", () => fill(null));
    saveBtn.addEventListener("click", async () => {
      const payload = {}; for (const k of Object.keys(f)) payload[k] = k === "hidden" ? f.hidden.checked : f[k].value;
      saveBtn.disabled = true;
      try { await pb.send(editing ? `/api/vc/mod/events/${editing}` : "/api/vc/mod/events", { method: "POST", body: payload }); toast(editing ? "Event updated" : "Event added 🎉"); events(body); }
      catch (err) { toast(errMsg(err), true); saveBtn.disabled = false; }
    });
    const field = (label, el, hint) => h("label", { class: "field" }, h("span", { class: "label" }, label), el, hint ? h("span", { class: "hint" }, hint) : null);
    const now = Date.now();
    const evRow = (ev) => h("div", { class: "mod-event" + (ev.hidden ? " is-hidden" : "") + (Date.parse(String(ev.starts).replace(" ", "T")) < now ? " past" : "") },
      h("div", {}, h("b", {}, `${ev.emoji || "📅"} ${ev.title}`), h("small", { class: "faint" }, ` · ${when(ev.starts)}${ev.where ? " · " + ev.where : ""} · ${ev.going} going${ev.hidden ? " · hidden" : ""}`)),
      h("span", { class: "actions", style: "margin:0" },
        h("button", { type: "button", class: "btn small", onclick: () => fill(ev) }, "Edit"),
        h("button", { type: "button", class: "btn small ghost", onclick: async () => { if (!confirm(`Delete "${ev.title}"? RSVPs go with it.`)) return; try { await pb.send(`/api/vc/mod/events/${ev.id}`, { method: "DELETE" }); toast("Deleted"); events(body); } catch (err) { toast(errMsg(err), true); } } }, "Delete")));
    const upcoming = data.events.filter((ev) => Date.parse(String(ev.starts).replace(" ", "T")) >= now).reverse();
    const past = data.events.filter((ev) => Date.parse(String(ev.starts).replace(" ", "T")) < now);
    body.replaceChildren(
      h("section", { class: "panel" }, title,
        h("div", { class: "form-grid" }, field("Title", f.title), field("Emoji", f.emoji),
          field("Starts (Pacific time)", f.starts_pacific, "Like 2026-10-31 7:00 PM"), field("Ends (Pacific time)", f.ends_pacific),
          field("Where", f.where), field("Link", f.url)),
        field("Description", f.description),
        h("label", { class: "check" }, f.hidden, "Hidden (save it as a draft)"),
        h("div", { class: "actions" }, saveBtn, cancel)),
      h("section", { class: "panel" }, h("h2", {}, "Coming up"), upcoming.length ? upcoming.map(evRow) : h("p", { class: "muted" }, "Nothing planned yet."),
        past.length ? h("details", {}, h("summary", { class: "faint" }, `Past events (${past.length})`), past.map(evRow)) : null));
  }

  // ---------- question of the week ----------
  async function question(body) {
    const { h, pb, toast, errMsg } = deps();
    const data = await pb.send("/api/vc/mod/questions", {});
    const nextMonday = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
    const text = h("input", { type: "text", maxlength: 140, placeholder: "What's a kink you'd never have guessed you'd love?" });
    const starts = h("input", { type: "date", value: nextMonday });
    const add = h("button", { type: "button", class: "btn gold" }, "Add question");
    add.addEventListener("click", async () => {
      try { await pb.send("/api/vc/mod/questions", { method: "POST", body: { text: text.value, starts: starts.value } }); toast("Question queued ❓"); question(body); }
      catch (err) { toast(errMsg(err), true); }
    });
    const now = Date.now();
    const live = data.questions.find((q) => !q.hidden && Date.parse(String(q.starts).replace(" ", "T")) <= now);
    body.replaceChildren(
      h("section", { class: "panel" }, h("h2", {}, "Queue a question"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "The newest question whose start day has arrived is the one members see. Queue a few ahead and they'll go live by themselves."),
        h("div", { class: "form-grid" }, h("label", { class: "field" }, h("span", { class: "label" }, "Question"), text), h("label", { class: "field" }, h("span", { class: "label" }, "Starts"), starts)),
        h("div", { class: "actions" }, add)),
      h("section", { class: "panel" }, h("h2", {}, "Questions"), data.questions.length ? data.questions.map((q) => {
        const t = Date.parse(String(q.starts).replace(" ", "T"));
        const state = q.hidden ? "hidden" : live && live.id === q.id ? "🟢 live now" : t > now ? "queued" : "past";
        return h("div", { class: "mod-event" + (q.hidden ? " is-hidden" : "") },
          h("div", {}, h("b", {}, q.text), h("small", { class: "faint" }, ` · ${day(q.starts)} · ${state} · ${q.answers} answer${q.answers === 1 ? "" : "s"}`)),
          h("span", { class: "actions", style: "margin:0" },
            h("button", { type: "button", class: "btn small ghost", onclick: async () => { try { await pb.send(`/api/vc/mod/questions/${q.id}`, { method: "POST", body: { hidden: !q.hidden } }); question(body); } catch (err) { toast(errMsg(err), true); } } }, q.hidden ? "Show" : "Hide"),
            h("button", { type: "button", class: "btn small ghost", onclick: async () => { if (!confirm("Delete this question and its answers?")) return; try { await pb.send(`/api/vc/mod/questions/${q.id}`, { method: "DELETE" }); toast("Deleted"); question(body); } catch (err) { toast(errMsg(err), true); } } }, "Delete")));
      }) : h("p", { class: "muted" }, "No questions yet.")));
  }

  // ---------- content clean-up ----------
  async function content(body, kind) {
    const { h, pb, toast, errMsg, personChip } = deps();
    kind = kind || "photos";
    const pick = h("div", { class: "pills" }, [["photos", "📷 Photos"], ["notes", "💌 Kind notes"], ["answers", "❓ Answers"]].map(([k, l]) =>
      h("button", { type: "button", class: "pill", "aria-pressed": String(k === kind), onclick: () => content(body, k) }, l)));
    const holder = h("div", {}, h("p", { class: "faint" }, "Loading…"));
    body.replaceChildren(h("section", { class: "panel" }, pick, h("p", { class: "faint" }, "Newest first. Deleting is permanent."), holder));
    const data = await pb.send(`/api/vc/mod/content/${kind}`, {});
    const del = (it, what) => h("button", { type: "button", class: "btn small ghost", onclick: async () => {
      if (!confirm(`Delete this ${what}? This can't be undone.`)) return;
      try { await pb.send(`/api/vc/mod/content/${kind}/${it.id}`, { method: "DELETE" }); toast("Deleted"); content(body, kind); } catch (err) { toast(errMsg(err), true); }
    } }, "🗑 Delete");
    const who = (m) => (m ? personChip(m) : h("i", {}, "deleted member"));
    if (!data.items.length) { holder.replaceChildren(h("p", { class: "muted" }, "Nothing here.")); return; }
    if (kind === "photos") holder.replaceChildren(h("div", { class: "mod-photos" }, data.items.map((it) => h("figure", {},
      h("a", { href: pb.files.getURL(it, it.image), target: "_blank", rel: "noopener" }, h("img", { src: pb.files.getURL(it, it.image, { thumb: "240x240" }), alt: it.caption || "Photo", loading: "lazy", class: it.nsfw ? "nsfw" : "" })),
      h("figcaption", {}, who(it.owner), h("small", { class: "faint" }, ` ${day(it.created)}${it.nsfw ? " · NSFW" : ""}`), del(it, "photo"))))));
    else if (kind === "notes") holder.replaceChildren(...data.items.map((it) => h("div", { class: "mod-event" },
      h("div", {}, h("p", { style: "margin:0 0 4px" }, `“${it.text}”`), h("small", { class: "faint" }, "To ", ), it.to ? who(it.to) : "", h("small", { class: "faint" }, " · from "), who(it.from),
        h("small", { class: "faint" }, ` · ${it.signed ? "signed" : "anonymous"} · ${it.approved ? "shown" : "waiting"} · ${day(it.created)}`)),
      del(it, "note"))));
    else holder.replaceChildren(...data.items.map((it) => h("div", { class: "mod-event" },
      h("div", {}, h("small", { class: "faint" }, it.question), h("p", { style: "margin:2px 0 4px" }, it.text), who(it.by), h("small", { class: "faint" }, ` · ${day(it.created)}`)),
      del(it, "answer"))));
  }

  window.VCMod = { render, deps: null };
})();
