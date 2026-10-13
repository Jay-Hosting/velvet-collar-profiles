/* The Admin page: reports, members, events, question of the week and content clean-up.
   Members with the "admin" or "owner" badge see every tab; "host" sees Events only. The server checks this too.
   Uses helpers app.js shares on window.VCMod.deps (h, pb, toast, go, me, errMsg, personChip, miniAvatar, copyText, fmtWhen). */
(() => {
  "use strict";
  const deps = () => window.VCMod.deps;
  const BADGES = [["owner", "🗝️ Owner"], ["admin", "🛡️ Admin"], ["host", "🎪 Host"], ["welcomer", "🤗 Welcomer"], ["helper", "🛠️ Helper"], ["vip", "👑 VIP"]];
  const TABS = [["reports", "⚑ Reports"], ["members", "👥 Members"], ["vetting", "✅ Vetting"], ["events", "📅 Events"], ["activity", "📈 Activity"], ["group", "🏠 Group page"], ["question", "❓ Question"], ["content", "🧹 Content"]];
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
    // Vetting is owners only; hosts get Events.
    const tabs = (sum.mod ? TABS : TABS.filter((t) => t[0] === "events")).filter((t) => t[0] !== "vetting" || sum.owner);
    if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
    const body = h("div", {});
    const nav = h("div", { class: "pills mod-tabs", role: "tablist" }, tabs.map(([id, label]) =>
      h("a", { class: "pill", href: "/admin/" + id, "data-nav": "", role: "tab", "aria-selected": String(id === tab), "aria-pressed": String(id === tab) },
        label, id === "reports" && sum.openReports ? h("span", { class: "nav-badge" }, String(sum.openReports)) : null,
        id === "vetting" && sum.newForms ? h("span", { class: "nav-badge" }, String(sum.newForms)) : null)));
    app.replaceChildren(h("section", { class: "mod-head" }, h("h1", {}, "🛡️ Admin"),
      h("p", { class: "muted" }, sum.mod ? "Everything here acts on the real accounts. Be kind, be careful." : "As a host you can add and edit events.")), nav, body);
    try { await ({ reports, members: (b) => members(b, sum), vetting, events, activity, group, question, content })[tab](body); }
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
          h("div", { class: "mod-row2" }, h("span", { class: m.guidelines_at ? "faint" : "warn-text" }, m.guidelines_at ? `📜 Agreed to the community guidelines ${day(m.guidelines_at)}` : "📜 Hasn't agreed to the community guidelines (joined before the checkbox)"),
            h("span", { class: m.age21_at ? "faint" : "warn-text" }, m.age21_at ? `🔞 Confirmed 21+ ${day(m.age21_at)}` : "🔞 Hasn't confirmed 21+")),
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

  // ---------- vetting: owners only. Sub-tabs: To review (forms and anyone waiting), On hold, Vetted, and a search ----------
  let vetView = "review";
  async function vetting(body) {
    const { h, pb, toast, personChip, errMsg, copyText } = deps();
    const search = h("input", { type: "search", placeholder: "Find any member to set a status", "aria-label": "Search members" });
    const pills = h("div", { class: "pills vet-tabs" });
    const holder = h("div", {});
    body.replaceChildren(h("section", { class: "panel" }, h("h2", {}, "✅ Vetting for play parties"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "Only owners can see this tab. Members send their form from ", h("code", {}, location.origin + "/vetting"),
        ". Setting a status marks their form read. Everyone else only ever sees a ✅ Vetted badge, and only owners see that."),
      pills, search), holder);
    let data, timer;
    const answer = (q, v) => {
      if (q.type === "agree") return v ? "✅ Agreed to the event guidelines" : "❌ Didn't agree";
      if (q.type === "yesno") return v === "yes" ? "Yes" : v === "no" ? "No" : "";
      if (q.type === "scale") return v ? `${v} / 5${v >= 5 ? " (this is my tribe)" : v <= 1 ? " (extremely uncomfortable)" : ""}` : "";
      return String(v || "");
    };
    const group = (m) => {
      const s = m.vetting.status, unread = m.form && !m.form.seen;
      if (unread || !s || s === "needs" || s === "renew") return "review";
      return s === "hold" ? "hold" : "vetted";
    };
    const row = (m) => {
      const el = h("div", { class: "mod-member vet-row" });
      const draw = () => {
        const L = data.labels, v = m.vetting, f = m.form;
        el.className = "mod-member vet-row" + (v.status ? " s-" + v.status : "") + (f && !f.seen ? " has-new" : "");
        const note = h("input", { type: "text", maxlength: 500, value: v.note || "", placeholder: "Private note (who vetted, when it expires, why it's on hold…)", "aria-label": "Vetting note" });
        const save = async (payload, msg) => {
          try { const r = await pb.send(`/api/vc/mod/vetting/${m.id}`, { method: "POST", body: payload }); m.vetting = r.vetting; if (payload.status !== undefined && m.form) m.form.seen = true; toast(msg); load(); }
          catch (err) { toast(errMsg(err), true); }
        };
        const photo = m.avatar ? h("a", { href: pb.files.getURL(m, m.avatar), target: "_blank", rel: "noopener", title: "Open full photo" }, h("img", { class: "avatar", src: pb.files.getURL(m, m.avatar, { thumb: "200x200" }), alt: "" })) : h("div", { class: "avatar" }, "?");
        let formEl;
        if (f) {
          const mark = h("button", { type: "button", class: "btn small " + (f.seen ? "ghost" : "gold"), onclick: async () => {
            try { await pb.send(`/api/vc/mod/vet-forms/${f.id}`, { method: "POST", body: { seen: !f.seen } }); toast(f.seen ? "Marked unread" : "Marked read"); load(); } catch (err) { toast(errMsg(err), true); }
          } }, f.seen ? "Mark unread" : "👀 Mark read");
          formEl = h("details", { class: "vet-form", open: !f.seen },
            h("summary", {}, f.seen ? "📋 Vetting form" : "📋 New vetting form", h("small", { class: "faint" }, ` · sent ${when(f.updated || f.created)}${f.seen && f.seen_by ? " · read by " + f.seen_by : ""}`)),
            h("dl", { class: "vf-answers" }, data.questions.flatMap((q) => { const a = answer(q, f.answers[q.id]); return [h("dt", {}, q.q), h("dd", { class: a ? "" : "empty" }, a || "(no answer)")]; })),
            h("div", { class: "actions" }, mark));
        } else {
          formEl = h("p", { class: "faint vet-noform" }, "No vetting form sent yet. ",
            h("button", { type: "button", class: "btn small ghost", onclick: () => copyText(`Hi ${m.display_name}! To get vetted for play parties, please fill in the form here: ${location.origin}/vetting`, "Copied a message to send them") }, "📋 Copy a message asking them to fill it in"));
        }
        el.replaceChildren(
          h("div", { class: "vf-head" }, photo, h("div", {}, personChip(m),
            h("div", { class: "faint", style: "font-size:.85rem" }, `@${m.slug}`, v.by ? ` · updated by ${v.by}${v.at ? " " + day(v.at) : ""}` : ""),
            h("div", { style: "font-size:.92rem;margin-top:2px" }, h("b", {}, L[v.status] || "No status yet"), f && !f.seen ? h("span", { class: "vet-new" }, "New form") : null))),
          h("div", { class: "pills" }, [["", "None"], ...["vetted", "needs", "renew", "hold"].map((k) => [k, L[k]])].map(([k, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String((v.status || "") === k),
            onclick: () => save({ status: k }, k ? `Set to ${label}` : "Status cleared") }, label))),
          h("div", { class: "mod-row2" }, note, h("button", { type: "button", class: "btn small ghost", onclick: () => save({ note: note.value }, "Note saved") }, "Save note")),
          formEl);
      };
      draw();
      return el;
    };
    const VIEWS = [["review", "📋 To review"], ["hold", "⏸️ On hold"], ["vetted", "✅ Vetted"]];
    const draw = () => {
      const q = search.value.trim();
      const counts = {}; VIEWS.forEach(([k]) => { counts[k] = q ? 0 : data.members.filter((m) => group(m) === k).length; });
      const fresh = data.members.filter((m) => m.form && !m.form.seen).length;
      pills.replaceChildren(...VIEWS.map(([k, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String(!q && vetView === k), onclick: () => { search.value = ""; vetView = k; load(); } },
        `${label} (${counts[k]})`, k === "review" && fresh ? h("span", { class: "nav-badge" }, String(fresh)) : null)));
      const tab = document.querySelector('.mod-tabs a[href="/admin/vetting"]');
      if (tab && !q) { tab.querySelector(".nav-badge")?.remove(); if (fresh) tab.append(h("span", { class: "nav-badge" }, String(fresh))); }
      let ms = q ? data.members : data.members.filter((m) => group(m) === vetView);
      // To review: new forms first (oldest first, so nobody waits too long), then everyone else by name.
      if (!q && vetView === "review") ms = ms.slice().sort((a, b) => { const an = a.form && !a.form.seen, bn = b.form && !b.form.seen; return an !== bn ? (an ? -1 : 1) : an ? String(a.form.created).localeCompare(String(b.form.created)) : a.display_name.localeCompare(b.display_name); });
      const empty = q ? "Nobody by that name." : vetView === "review" ? "Nothing to review. 🌙 All caught up." : vetView === "hold" ? "Nobody is on hold." : "Nobody is vetted yet.";
      holder.replaceChildren(...(ms.length ? ms.map(row) : [h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, empty))]));
    };
    const load = async () => {
      try { data = await pb.send("/api/vc/mod/vetting?q=" + encodeURIComponent(search.value.trim()), {}); }
      catch (err) { holder.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
      draw();
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
      url: h("input", { type: "url", maxlength: 300, placeholder: "https://… (optional)" }), hidden: h("input", { type: "checkbox" }), hosted: h("input", { type: "checkbox" }),
      vetting: h("select", {}, h("option", { value: "" }, "No vetting"), h("option", { value: "offered" }, "✅ You can get vetted here"), h("option", { value: "required" }, "🔒 Vetted members only")),
    };
    let editing = null;
    const title = h("h2", {}, "Add an event");
    const saveBtn = h("button", { type: "button", class: "btn gold" }, "Save event");
    const cancel = h("button", { type: "button", class: "btn ghost", style: "display:none" }, "Cancel edit");
    const fill = (ev) => {
      editing = ev ? ev.id : null;
      for (const k of Object.keys(f)) { if (k === "hidden" || k === "hosted") f[k].checked = !!(ev && ev[k]); else f[k].value = ev ? ev[k] || "" : ""; }
      title.textContent = ev ? `Editing: ${ev.title}` : "Add an event"; cancel.style.display = ev ? "" : "none";
      if (ev) title.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    cancel.addEventListener("click", () => fill(null));
    saveBtn.addEventListener("click", async () => {
      const payload = {}; for (const k of Object.keys(f)) payload[k] = k === "hidden" || k === "hosted" ? f[k].checked : f[k].value;
      saveBtn.disabled = true;
      try { await pb.send(editing ? `/api/vc/mod/events/${editing}` : "/api/vc/mod/events", { method: "POST", body: payload }); toast(editing ? "Event updated" : "Event added 🎉"); events(body); }
      catch (err) { toast(errMsg(err), true); saveBtn.disabled = false; }
    });
    const field = (label, el, hint) => h("label", { class: "field" }, h("span", { class: "label" }, label), el, hint ? h("span", { class: "hint" }, hint) : null);
    const now = Date.now();
    const evRow = (ev) => {
      const holder = h("div", { class: "att-holder", hidden: true });
      const peopleBtn = h("button", { type: "button", class: "btn small", "aria-expanded": "false" }, `👥 People (${ev.going + (ev.interested || 0)})`);
      peopleBtn.addEventListener("click", () => {
        holder.hidden = !holder.hidden; peopleBtn.setAttribute("aria-expanded", String(!holder.hidden));
        if (!holder.hidden) attendance(holder, ev);
      });
      return h("div", { class: "mod-event-wrap" }, h("div", { class: "mod-event" + (ev.hidden ? " is-hidden" : "") + (Date.parse(String(ev.starts).replace(" ", "T")) < now ? " past" : "") },
        h("div", {}, h("b", {}, `${ev.emoji || "📅"} ${ev.title}`), h("small", { class: "faint" }, ` · ${when(ev.starts)}${ev.where ? " · " + ev.where : ""} · ${ev.going} going${ev.interested ? ` · ${ev.interested} interested` : ""}${ev.attended ? ` · ✅ ${ev.attended} came` : ""}${ev.hosted ? " · 💜 hosted" : ""}${ev.vetting === "offered" ? " · ✅ vetting here" : ev.vetting === "required" ? " · 🔒 vetted only" : ""}${ev.hidden ? " · hidden" : ""}`)),
        h("span", { class: "actions", style: "margin:0" },
          peopleBtn,
          h("button", { type: "button", class: "btn small", onclick: () => fill(ev) }, "Edit"),
          h("button", { type: "button", class: "btn small ghost", onclick: async () => { if (!confirm(`Delete "${ev.title}"? Its RSVPs and attendance record are deleted with it. To keep the record, tick Hidden instead.`)) return; try { await pb.send(`/api/vc/mod/events/${ev.id}`, { method: "DELETE" }); toast("Deleted"); events(body); } catch (err) { toast(errMsg(err), true); } } }, "Delete"))),
        holder);
    };
    const upcoming = data.events.filter((ev) => Date.parse(String(ev.starts).replace(" ", "T")) >= now).reverse();
    const past = data.events.filter((ev) => Date.parse(String(ev.starts).replace(" ", "T")) < now);
    body.replaceChildren(
      h("section", { class: "panel" }, title,
        h("div", { class: "form-grid" }, field("Title", f.title), field("Emoji", f.emoji),
          field("Starts (Pacific time)", f.starts_pacific, "Like 2026-10-31 7:00 PM"), field("Ends (Pacific time)", f.ends_pacific),
          field("Where", f.where), field("Link", f.url), field("Vetting", f.vetting, "Vetted only shows velvet; get vetted here shows green")),
        field("Description", f.description),
        h("label", { class: "check" }, f.hosted, "💜 Hosted by Velvet Collar (pink on the calendar)"),
        h("label", { class: "check" }, f.hidden, "Hidden (save it as a draft)"),
        h("div", { class: "actions" }, saveBtn, cancel)),
      h("section", { class: "panel" }, h("h2", {}, "Coming up"), upcoming.length ? upcoming.map(evRow) : h("p", { class: "muted" }, "Nothing planned yet."),
        past.length ? h("details", {}, h("summary", { class: "faint" }, `Past events (${past.length})`), past.map(evRow)) : null));
  }

  // ---------- one event's people: RSVPs, who came, walk-ins, copy and download ----------
  async function attendance(holder, ev) {
    const { h, pb, toast, errMsg, personChip, copyText } = deps();
    holder.replaceChildren(h("p", { class: "faint" }, "Loading…"));
    let d;
    try { d = await pb.send(`/api/vc/mod/events/${ev.id}/people`, {}); } catch (err) { holder.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
    const reload = () => attendance(holder, ev);
    const P = d.people;
    const going = P.filter((x) => x.status === "going"), interested = P.filter((x) => x.status === "interested"), came = P.filter((x) => x.attended);
    const tick = async (x, on) => { try { await pb.send(`/api/vc/mod/rsvps/${x.id}`, { method: "POST", body: { attended: on } }); x.attended = on; reload(); } catch (err) { toast(errMsg(err), true); } };
    const row = (x) => {
      const box = h("input", { type: "checkbox", checked: x.attended, "aria-label": `${x.member.display_name} came` });
      box.addEventListener("change", () => tick(x, box.checked));
      return h("div", { class: "att-row" + (x.attended ? " came" : "") },
        h("label", { class: "check att-came", title: x.attended && x.attended_by ? `Checked in by ${x.attended_by}` : "Tick when they show up" }, box, "Came"),
        personChip(x.member),
        h("span", { class: "att-tags" },
          x.added_by ? h("span", { class: "att-tag walkin", title: `Added by ${x.added_by}` }, "➕ Walk-in") : h("span", { class: "att-tag " + x.status }, x.status === "going" ? "✓ Going" : "⭐ Interested"),
          x.member.hidden ? h("span", { class: "att-tag" }, "hidden profile") : !x.member.listed ? h("span", { class: "att-tag" }, "not on list") : null),
        h("small", { class: "faint att-meta" }, [x.member.tg_username ? "@" + x.member.tg_username : "", x.added_by ? "" : "RSVP'd " + day(x.created)].filter(Boolean).join(" · ")),
        h("button", { type: "button", class: "btn small ghost att-x", title: "Remove this RSVP", onclick: () => confirm(`Remove ${x.member.display_name} from this event?`) && pb.send(`/api/vc/mod/rsvps/${x.id}`, { method: "POST", body: { remove: true } }).then(reload, (err) => toast(errMsg(err), true)) }, "✕"));
    };
    // Walk-ins: someone who came without tapping I'm going.
    const who = h("input", { type: "text", placeholder: "Name or profile link of someone who came", "aria-label": "Add someone who came" });
    const add = h("button", { type: "button", class: "btn small gold" }, "➕ Add walk-in");
    const addIt = async () => {
      if (!who.value.trim()) return toast("Type their name or profile link.", true);
      add.disabled = true;
      try { const res = await pb.send(`/api/vc/mod/events/${ev.id}/people`, { method: "POST", body: { member: who.value.trim() } }); toast(`✅ ${res.name} marked as came`); reload(); }
      catch (err) { toast(errMsg(err), true); add.disabled = false; }
    };
    add.addEventListener("click", addIt); who.addEventListener("keydown", (e) => { if (e.key === "Enter") addIt(); });
    // Copy and download.
    const label = (x) => x.added_by ? "Walk-in" : x.status === "going" ? "Going" : "Interested";
    const names = (list) => list.map((x) => x.member.display_name + (x.member.tg_username ? ` (@${x.member.tg_username})` : "")).join("\n");
    const csvCell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const download = () => {
      const rows = [["Event", "Date", "Name", "Profile", "Telegram", "RSVP", "Came", "Checked in by", "RSVP'd at"],
        ...P.map((x) => [d.event.title, when(d.event.starts), x.member.display_name, location.origin + "/" + x.member.slug, x.member.tg_username ? "@" + x.member.tg_username : "", label(x), x.attended ? "Yes" : "No", x.attended_by, when(x.created)])];
      const a = h("a", { href: URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })),
        download: `${(d.event.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-attendance.csv` });
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    holder.replaceChildren(h("div", { class: "att-panel" },
      h("div", { class: "att-sum" }, h("b", {}, `${going.filter((x) => !x.added_by).length} going`), ` · ${interested.length} interested`, going.some((x) => x.added_by) ? ` · ${going.filter((x) => x.added_by).length} walk-in${going.filter((x) => x.added_by).length === 1 ? "" : "s"}` : "", " · ", h("b", {}, `✅ ${came.length} came`)),
      P.length ? h("div", { class: "att-list" }, P.map(row)) : h("p", { class: "faint" }, "Nobody has RSVP'd yet."),
      h("div", { class: "att-add" }, who, add),
      h("div", { class: "actions", style: "margin:8px 0 0" },
        h("button", { type: "button", class: "btn small ghost", onclick: () => copyText(names(came.length ? came : going), came.length ? `Copied ${came.length} who came` : `Copied ${going.length} going`) }, came.length ? "📋 Copy who came" : "📋 Copy who's going"),
        P.length ? h("button", { type: "button", class: "btn small ghost", onclick: download }, "⬇️ Download list (CSV)") : null),
      h("p", { class: "faint", style: "margin:6px 0 0" }, "Tick “Came” as people arrive (or afterwards) to keep a record. Walk-ins are people who came without RSVPing. The CSV opens in Excel, Numbers or Google Sheets.")));
  }

  // ---------- the group's own page (/velvetcollar): admins and owners ----------
  async function group(body) {
    const { h, pb, toast, errMsg } = deps();
    const d = await pb.send("/api/vc/group", {});
    const g = d.page;
    const field = (label, el, hint) => h("label", { class: "field" }, h("span", { class: "label" }, label), el, hint ? h("span", { class: "hint" }, hint) : null);
    const inp = (v, attrs) => h("input", Object.assign({ type: "text", value: v || "" }, attrs));
    const ta = (v, attrs) => { const t = h("textarea", attrs); t.value = v || ""; return t; };
    const f = {
      name: inp(g.name, { maxlength: 80 }), tagline: inp(g.tagline, { maxlength: 140, placeholder: "Curiosity, embodied" }),
      location: inp(g.location, { maxlength: 80, placeholder: "Sacramento, CA" }),
      about: ta(g.about, { maxlength: 6000, rows: 6, placeholder: "Who we are, what we do, who we're for…" }),
      public: h("input", { type: "checkbox", checked: g.public }), show_team: h("input", { type: "checkbox", checked: g.show_team }), show_events: h("input", { type: "checkbox", checked: g.show_events }),
    };
    // Images: pick a new one, or remove the current one.
    const imgs = {};
    const imgField = (key, label, hint, thumb) => {
      const st = imgs[key] = { file: null, remove: false };
      const prev = h("div", { class: "gp-img gp-" + key });
      const draw = () => {
        const src = st.file ? URL.createObjectURL(st.file) : !st.remove && g[key] ? pb.files.getURL(g, g[key], { thumb }) : "";
        prev.replaceChildren(src ? h("img", { src, alt: "" }) : h("span", { class: "faint" }, "No image"));
      };
      const pick = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", hidden: true });
      pick.addEventListener("change", () => { if (pick.files[0]) { if (pick.files[0].size > 10 * 1024 * 1024) return toast("That image is over 10 MB", true); st.file = pick.files[0]; st.remove = false; draw(); } });
      draw();
      return h("div", { class: "field" }, h("span", { class: "label" }, label), prev,
        h("div", { class: "actions", style: "margin:6px 0 0" },
          h("button", { type: "button", class: "btn small", onclick: () => pick.click() }, "Choose image"),
          h("button", { type: "button", class: "btn small ghost", onclick: () => { st.file = null; st.remove = true; draw(); } }, "Remove")),
        pick, h("span", { class: "hint" }, hint));
    };
    // A small list editor for links and sections.
    const listEditor = (items, blank, render, max, addLabel) => {
      const wrap = h("div", { class: "gp-list" });
      const draw = () => {
        wrap.replaceChildren(...items.map((it, i) => h("div", { class: "gp-item" }, render(it),
          h("div", { class: "gp-item-btns" },
            h("button", { type: "button", class: "btn small ghost", title: "Move up", disabled: i === 0, onclick: () => { items.splice(i - 1, 0, items.splice(i, 1)[0]); draw(); } }, "↑"),
            h("button", { type: "button", class: "btn small ghost", title: "Move down", disabled: i === items.length - 1, onclick: () => { items.splice(i + 1, 0, items.splice(i, 1)[0]); draw(); } }, "↓"),
            h("button", { type: "button", class: "btn small ghost", title: "Remove", onclick: () => { items.splice(i, 1); draw(); } }, "✕")))),
          items.length < max ? h("button", { type: "button", class: "btn small", onclick: () => { items.push(blank()); draw(); } }, addLabel) : null);
      };
      draw();
      return wrap;
    };
    const bind = (it, k, el) => { el.value = it[k] || ""; el.addEventListener("input", () => { it[k] = el.value; }); return el; };
    const links = (g.links || []).map((l) => Object.assign({}, l));
    const sections = (g.sections || []).map((x) => Object.assign({}, x));
    const linksEd = listEditor(links, () => ({ emoji: "", title: "", url: "", note: "" }), (l) => h("div", { class: "gp-link" },
      bind(l, "emoji", h("input", { type: "text", maxlength: 8, placeholder: "💬", "aria-label": "Emoji", class: "gp-emoji" })),
      bind(l, "title", h("input", { type: "text", maxlength: 80, placeholder: "Title, like Telegram group", "aria-label": "Title" })),
      bind(l, "url", h("input", { type: "url", maxlength: 500, placeholder: "https://…", "aria-label": "Link" })),
      bind(l, "note", h("input", { type: "text", maxlength: 140, placeholder: "Short note (optional)", "aria-label": "Note", class: "gp-note" }))), 30, "➕ Add a link");
    const sectionsEd = listEditor(sections, () => ({ emoji: "", title: "", body: "" }), (x) => h("div", { class: "gp-sec" },
      h("div", { class: "gp-sec-top" },
        bind(x, "emoji", h("input", { type: "text", maxlength: 8, placeholder: "✨", "aria-label": "Emoji", class: "gp-emoji" })),
        bind(x, "title", h("input", { type: "text", maxlength: 80, placeholder: "Heading, like How to join", "aria-label": "Heading" }))),
      bind(x, "body", h("textarea", { maxlength: 3000, rows: 4, placeholder: "Text. Leave a blank line between paragraphs.", "aria-label": "Text" }))), 12, "➕ Add a section");
    const save = h("button", { type: "button", class: "btn gold" }, "Save group page");
    save.addEventListener("click", async () => {
      const bad = links.find((l) => (l.url || l.title) && !/^https:\/\/\S+$/i.test(String(l.url || "").trim()));
      if (bad) return toast(`"${bad.title || bad.url || "A link"}" needs a link starting with https://`, true);
      const fd = new FormData();
      for (const k of ["name", "tagline", "location", "about"]) fd.append(k, f[k].value.trim());
      for (const k of ["public", "show_team", "show_events"]) fd.append(k, f[k].checked ? "true" : "false");
      fd.append("links", JSON.stringify(links)); fd.append("sections", JSON.stringify(sections));
      for (const k of ["logo", "cover"]) { if (imgs[k].file) fd.append(k, imgs[k].file); if (imgs[k].remove) fd.append(k + "_remove", "true"); }
      save.disabled = true; save.textContent = "Saving…";
      try { await pb.send("/api/vc/mod/group", { method: "POST", body: fd }); toast("🏠 Group page saved"); group(body); }
      catch (err) { toast(errMsg(err), true); save.disabled = false; save.textContent = "Save group page"; }
    });
    body.replaceChildren(
      h("section", { class: "panel" }, h("h2", {}, "🏠 The Velvet Collar page"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "The group's own profile at ", h("a", { href: "/velvetcollar", "data-nav": "" }, location.origin + "/velvetcollar"),
          ". Admins and owners can change it here.", g.updated_by ? ` Last saved by ${g.updated_by}, ${when(g.updated)}.` : ""),
        h("div", { class: "form-grid" }, field("Name", f.name), field("Tagline", f.tagline), field("Location", f.location)),
        field("About", f.about, "Leave a blank line between paragraphs."),
        h("div", { class: "form-grid" }, imgField("logo", "Logo", "Square works best. Shown in the circle.", "400x400"), imgField("cover", "Cover image", "Wide, like 1200 × 400. Shown across the top.", "1200x400"))),
      h("section", { class: "panel" }, h("h2", {}, "🔗 Links"), h("p", { class: "faint", style: "margin-top:-6px" }, "Telegram group, Discord, FetLife, Instagram, a donation page… They show in the Links box on the page, in this order."), linksEd),
      h("section", { class: "panel" }, h("h2", {}, "📄 Extra sections"), h("p", { class: "faint", style: "margin-top:-6px" }, "Anything else: how to join, what a munch is like, FAQs, where to find us. They show under About, in this order. The community guidelines are added automatically."), sectionsEd),
      h("section", { class: "panel" }, h("h2", {}, "⚙️ Settings"),
        h("label", { class: "check" }, f.public, "Anyone with the link can see the page (turn off for members only)"),
        h("label", { class: "check" }, f.show_team, "Show the team (owners, admins and hosts on the member list) to logged-in members"),
        h("label", { class: "check" }, f.show_events, "Show upcoming Velvet Collar-hosted events to logged-in members"),
        h("div", { class: "actions" }, save, h("a", { class: "btn ghost", href: "/velvetcollar", "data-nav": "" }, "View the page"))));
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

  // ---------- activity: busy times, who's most active, what gets used (admins and owners) ----------
  let actRange = 30, actHeat = "online", actSort = "overall", actAll = false;
  const PAGE_LABEL = { members: "👥 Member list", profile: "🪪 Profiles", playroom: "🎲 Playroom", events: "📅 Events", hunt: "🏹 The Hunt", whispers: "🤫 Whispers",
    edit: "✏️ Editing their profile", question: "❓ Question of the week", vetting: "📝 Vetting form", admin: "🛡️ Admin" };
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DOW_LONG = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const hr = (x) => { x = ((x % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? " AM" : " PM"); };
  const hrShort = (x) => (x % 12 || 12) + (x < 12 ? "a" : "p");
  const span = (a, n) => hr(a) + "–" + hr(a + n);
  const mins = (m) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? " " + (m % 60) + "m" : ""}`;
  const ago = (d) => {
    const t = Date.parse(String(d || "").replace(" ", "T")); if (isNaN(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 600) return "online now"; if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago"; const dd = Math.round(s / 86400); return dd === 1 ? "yesterday" : dd + " days ago";
  };
  const keyDay = (k, opts) => new Date(k + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...(opts || { month: "short", day: "numeric" }) });

  async function activity(body) {
    const { h, pb, personChip } = deps();
    if (!body.firstChild) body.append(h("p", { class: "muted" }, "Loading…"));
    const d = await pb.send("/api/vc/mod/activity?days=" + actRange, {});
    const T = d.totals, redraw = () => activity(body).catch(() => {});
    const pill = (on, label, fn) => h("button", { type: "button", class: "pill", "aria-pressed": String(on), onclick: fn }, label);
    const range = h("div", { class: "pills" }, [7, 30, 90].map((n) => pill(actRange === n, `Last ${n} days`, () => { actRange = n; redraw(); })));
    const freshTracking = !d.trackingSince || d.trackingSince > d.from;

    // Up or down against the period before.
    const trend = (now, prev) => {
      if (!prev) return null;
      const pct = Math.round((now - prev) / prev * 100);
      return h("small", { class: "act-trend " + (pct > 0 ? "up" : pct < 0 ? "down" : "") }, pct === 0 ? "same as before" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs the ${actRange} days before`);
    };
    const stat = (num, label, extra) => h("div", { class: "act-stat" }, h("b", {}, String(num)), h("span", {}, label), extra || null);
    const stats = h("div", { class: "act-stats" },
      stat(T.active, `active members (${T.members ? Math.round(T.active / T.members * 100) : 0}% of ${T.members})`, trend(T.active, T.activePrev)),
      stat(T.today, "on the site today"),
      stat(T.actions, "things done", trend(T.actions, T.actionsPrev)),
      stat(T.newMembers, "new members", trend(T.newMembers, T.newPrev)),
      stat(T.hours, "hours on the site, all together"));

    // ---- busy times: 24 hours down, 7 days across ----
    const grid = d.heat[actHeat];
    const max = Math.max(1, ...grid.flat());
    const total = grid.flat().reduce((a, b) => a + b, 0);
    const byHour = Array.from({ length: 24 }, (_, x) => grid.reduce((a, row) => a + row[x], 0));
    const byDay = grid.map((row) => row.reduce((a, b) => a + b, 0));
    const win = (n, best) => { let pick = 0, val = best ? -1 : Infinity; for (let x = 0; x < 24; x++) { let v = 0; for (let k = 0; k < n; k++) v += byHour[(x + k) % 24]; if (best ? v > val : v < val) { val = v; pick = x; } } return pick; };
    const topCells = [];
    grid.forEach((row, dw) => row.forEach((v, x) => { if (v) topCells.push([v, dw, x]); }));
    topCells.sort((a, b) => b[0] - a[0]);
    const dayMax = byDay.indexOf(Math.max(...byDay)), dayMin = byDay.indexOf(Math.min(...byDay));
    const heatSum = total ? h("ul", { class: "act-sum" },
      h("li", {}, "🔥 Busiest hours: ", h("b", {}, span(win(2, true), 2))),
      h("li", {}, "📆 Busiest day: ", h("b", {}, DOW_LONG[dayMax]), " · quietest: ", DOW_LONG[dayMin]),
      h("li", {}, "⭐ Peak times: ", topCells.slice(0, 3).map((c) => `${DOW[c[1]]} ${hr(c[2])}`).join(" · ")),
      h("li", {}, "🌙 Quietest stretch: ", span(win(4, false), 4)),
      h("li", { class: "faint" }, "Good time for announcements: just before ", span(win(2, true), 2), "."))
      : h("p", { class: "faint" }, actHeat === "online" ? "Nothing yet. This fills in as members use the site." : "Nothing done in this stretch yet.");
    const heat = h("div", { class: "act-heat", role: "table", "aria-label": "Activity by day and hour, Pacific time" },
      h("div", { class: "act-hrow head", role: "row" }, h("span", {}), DOW.map((x) => h("span", { role: "columnheader" }, x))),
      Array.from({ length: 24 }, (_, x) => h("div", { class: "act-hrow", role: "row" },
        h("span", { class: "act-hlabel", role: "rowheader" }, x % 3 === 0 ? hrShort(x) : ""),
        grid.map((row, dw) => { const v = row[x]; return h("span", { class: "act-cell", role: "cell", title: `${DOW[dw]} ${hr(x)}: ${v}`, style: v ? `--a:${(0.15 + 0.85 * v / max).toFixed(2)}` : "" }); }))));
    const heatPanel = h("section", { class: "panel" },
      h("h2", {}, "⏰ Busy times"),
      h("div", { class: "pills" }, pill(actHeat === "online", "🟢 On the site", () => { actHeat = "online"; redraw(); }), pill(actHeat === "doing", "⚡ Doing things", () => { actHeat = "doing"; redraw(); })),
      h("p", { class: "faint" }, actHeat === "online" ? "How many members had the site open, per hour (Pacific time). Darker is busier." : "Reactions, notes, RSVPs, answers, hunts, photos, whispers and so on, per hour (Pacific time)."),
      h("div", { class: "act-heatwrap" }, heat, heatSum));

    // ---- day by day ----
    const bars = (key, label) => {
      const mx = Math.max(1, ...d.series.map((s) => s[key]));
      return h("div", { class: "act-bars-wrap" }, h("p", { class: "act-bars-label" }, label, h("small", { class: "faint" }, ` · most in a day: ${mx === 1 && !d.series.some((s) => s[key]) ? 0 : mx}`)),
        h("div", { class: "act-bars" }, d.series.map((s) => h("span", { title: `${keyDay(s.day, { weekday: "short", month: "short", day: "numeric" })}: ${s[key]}`, style: `height:${Math.max(s[key] ? 4 : 1, Math.round(s[key] / mx * 100))}%` + (s.day === d.today ? ";opacity:1" : "") }))),
        h("div", { class: "act-bars-axis faint" }, h("span", {}, keyDay(d.series[0].day)), h("span", {}, "today")));
    };
    const dailyPanel = h("section", { class: "panel" }, h("h2", {}, "📊 Day by day"), bars("active", "Members on the site"), bars("actions", "Things done"));

    // ---- what gets used ----
    const meter = (label, n, mx, extra) => h("div", { class: "act-meter" }, h("span", {}, label), h("i", {}, h("em", { style: `width:${Math.round(n / Math.max(1, mx) * 100)}%` })), h("b", {}, String(n)), extra || null);
    const pMax = Math.max(1, ...d.pages.map((p) => p.count)), aMax = Math.max(1, ...d.actions.map((a) => a.count));
    const usePanel = h("section", { class: "panel" }, h("h2", {}, "🧭 What gets used"),
      h("div", { class: "act-two" },
        h("div", {}, h("h3", {}, "Sections opened"), d.pages.length ? d.pages.map((p) => meter(PAGE_LABEL[p.key] || p.key, p.count, pMax)) : h("p", { class: "faint" }, "Nothing yet.")),
        h("div", {}, h("h3", {}, "Things done"), d.actions.slice().sort((a, b) => b.count - a.count).map((a) => meter(`${a.emoji} ${a.label}`, a.count, aMax,
          a.prev ? h("small", { class: "faint", title: `The ${actRange} days before` }, `was ${a.prev}`) : null)))),
      h("p", { class: "faint" }, "Whispers and crushes only ever count as totals. Nobody's whispers or crushes are shown by name."));

    // ---- most active members ----
    const SORTS = { overall: ["Overall", (m) => m.days * 3 + m.actions + m.minutes / 30], days: ["Days on", (m) => m.days], minutes: ["Time on site", (m) => m.minutes], actions: ["Things done", (m) => m.actions] };
    const ranked = d.top.slice().sort((a, b) => SORTS[actSort][1](b) - SORTS[actSort][1](a));
    const shown = actAll ? ranked : ranked.slice(0, 15);
    const DID = { reactions: "🔥", notes: "💌", vouches: "🤝", rsvps: "📅", answers: "❓", hunts: "🏹", photos: "📷", vetforms: "📝" };
    const topPanel = h("section", { class: "panel" }, h("h2", {}, "🏆 Most active members"),
      h("div", { class: "pills" }, Object.entries(SORTS).map(([k, [label]]) => pill(actSort === k, label, () => { actSort = k; redraw(); }))),
      ranked.length ? h("div", { class: "act-table", role: "table" },
        h("div", { class: "act-tr head", role: "row" }, h("span", {}, "#"), h("span", {}, "Member"), h("span", {}, "Days on"), h("span", {}, "Time"), h("span", {}, "Did"), h("span", {}, "Last seen")),
        shown.map((m, i) => h("div", { class: "act-tr", role: "row" },
          h("span", { class: "act-rank" }, i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1)),
          h("span", { class: "act-who" }, personChip(m.member), h("small", { class: "faint act-did" }, Object.entries(m.did || {}).map(([k, n]) => `${DID[k] || ""}${n}`).join(" "))),
          h("span", { "data-l": "Days on" }, String(m.days)),
          h("span", { "data-l": "Time" }, m.minutes ? mins(m.minutes) : "–"),
          h("span", { "data-l": "Did" }, String(m.actions)),
          h("span", { "data-l": "Last seen", class: "faint" }, m.last ? ago(m.last) : "–"))))
        : h("p", { class: "faint" }, "No one yet."),
      ranked.length > 15 ? h("button", { type: "button", class: "btn small ghost", onclick: () => { actAll = !actAll; redraw(); } }, actAll ? "Show top 15" : `Show all ${ranked.length}`) : null,
      h("p", { class: "faint" }, "“Did” counts reactions, kind notes, vouches, RSVPs, answers, hunts started, photos and vetting forms. Time is how long they had the site open, in 5-minute steps."));

    // ---- new and quiet ----
    const newPanel = h("section", { class: "panel" }, h("h2", {}, `🌱 New in the last ${actRange} days (${d.newcomers.length})`),
      d.newcomers.length ? h("div", { class: "act-people" }, d.newcomers.map((n) => h("div", { class: "act-person" }, personChip(n.member),
        h("small", { class: "faint" }, `joined ${day(n.joined)} · ${n.last ? "last seen " + ago(n.last) : "not seen since"}${n.actions ? ` · did ${n.actions}` : ""}`))))
        : h("p", { class: "faint" }, "No new members in this stretch."));
    const quietPanel = h("details", { class: "panel act-quiet" }, h("summary", {}, h("b", {}, `😴 Quiet for 30+ days (${d.quiet.length})`), h("small", { class: "faint" }, " · tap to open")),
      freshTracking ? h("p", { class: "faint" }, `Visits have been counted since ${d.trackingSince ? keyDay(d.trackingSince, { month: "long", day: "numeric" }) : "today"}, so for now this lists everyone who hasn't opened the site since then. It gets accurate after 30 days.`) : null,
      d.quiet.length ? h("div", { class: "act-people" }, d.quiet.map((q) => h("div", { class: "act-person" }, personChip(q.member),
        h("small", { class: "faint" }, q.last ? `last seen ${ago(q.last)}` : "not seen yet")))) : h("p", { class: "faint" }, "Everyone's been around. 🎉"),
      h("p", { class: "faint" }, "Good people to check in on with a friendly hello."));

    body.replaceChildren(
      h("section", { class: "panel" }, h("h2", {}, "📈 Activity"), range,
        h("p", { class: "faint", style: "margin-bottom:0" }, "Times are Pacific. Only admins and owners can see this. ",
          freshTracking ? `Time on the site has been counted since ${d.trackingSince ? keyDay(d.trackingSince, { month: "long", day: "numeric" }) : "today"}; “things done” goes back further.` : "")),
      stats, heatPanel, topPanel, dailyPanel, usePanel, newPanel, quietPanel);
  }

  window.VCMod = { render, deps: null };
})();
