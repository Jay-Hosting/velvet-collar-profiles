/* The Admin page: reports, members, events, question of the week and content clean-up.
   Members with the "admin" or "owner" badge see every tab; "host" sees Events only. The server checks this too.
   Uses helpers app.js shares on window.VCMod.deps (h, pb, toast, go, me, errMsg, personChip, miniAvatar, copyText, fmtWhen). */
(() => {
  "use strict";
  const deps = () => window.VCMod.deps;
  const BADGES = [["owner", "🗝️ Owner"], ["admin", "🛡️ Admin"], ["host", "🎪 Host"], ["welcomer", "🤗 Welcomer"], ["helper", "🛠️ Helper"], ["vip", "👑 VIP"]];
  const TABS = [["reports", "⚑ Reports"], ["members", "👥 Members"], ["vetting", "✅ Vetting"], ["volunteers", "🙋 Volunteers"], ["noprofile", "📜 No profile yet"], ["events", "📅 Events"], ["confessions", "💌 Confessions"], ["games", "🎲 Games"], ["feedback", "💡 Feedback"], ["backlog", "📋 Backlog"], ["activity", "📈 Activity"], ["group", "🏠 Group page"], ["question", "❓ Question"], ["content", "🧹 Content"]];
  // The tabs, grouped so the page stays tidy: a row of groups, then the tabs inside the open group.
  const GROUPS = [
    ["people", "👥 People", ["members", "vetting", "noprofile"]],
    ["events", "📅 Events", ["events", "volunteers"]],
    ["moderation", "🛡️ Moderation", ["reports", "confessions", "games", "content"]],
    ["ideas", "💡 Ideas", ["feedback", "backlog"]],
    ["site", "🏠 Site", ["group", "question"]],
    ["activity", "📈 Activity", ["activity"]],
  ];
  const SUB_LABEL = { members: "👥 All members", events: "📅 Calendar", question: "❓ Question of the week" };
  const PT = { timeZone: "America/Los_Angeles" };
  const when = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleString("en-US", { ...PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT"; };
  const dayY = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleDateString("en-US", { ...PT, month: "short", day: "numeric", year: "numeric" }); };
  // Links from handles people typed into the old form: Telegram opens a chat, FetLife opens their profile.
  const NOT_HANDLE = /^(none|na|no|nope|nah|nothing|not yet|n\/?a|yes|idk|unknown|pending|tbd|-+)$/i;
  const tgLink = (t) => {
    if (NOT_HANDLE.test(String(t || "").trim())) return "";
    const v = String(t || "").trim().replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
    return /^[A-Za-z0-9_]{5,32}$/.test(v) ? "https://t.me/" + v : "";
  };
  const fetLink = (f) => {
    const v = String(f || "").trim();
    if (NOT_HANDLE.test(v)) return "";
    const m = /^(?:https?:\/\/)?(?:www\.)?fetlife\.com\/(?:users\/)?([A-Za-z0-9_-]+)/i.exec(v);
    if (m) return "https://fetlife.com/" + (/^\d+$/.test(m[1]) ? "users/" : "") + m[1];
    const h2 = v.replace(/^@/, "");
    return /^[A-Za-z0-9_-]{2,40}$/.test(h2) ? "https://fetlife.com/" + h2 : "";
  };
  // A tag that's a link when the handle is usable, plain text when it isn't.
  const handleTag = (h, kind, value, extraClass) => {
    const url = kind === "tg" ? tgLink(value) : fetLink(value);
    const label = (kind === "tg" ? "✈️ " : "FetLife: ") + value;
    return url ? h("a", { class: "att-tag link-tag" + (extraClass ? " " + extraClass : ""), href: url, target: "_blank", rel: "noopener noreferrer", title: kind === "tg" ? "Open a Telegram chat" : "Open their FetLife profile" }, label, " ↗")
      : h("span", { class: "att-tag" + (extraClass ? " " + extraClass : "") }, label);
  };
  // An answer from a vetting form: the FetLife and Telegram answers open as links when they're real handles.
  const answerEl = (h, q, a) => {
    const url = q.id === "fetlife" ? fetLink(a) : q.id === "telegram" ? tgLink(a) : "";
    return url ? h("a", { class: "ans-link", href: url, target: "_blank", rel: "noopener noreferrer", title: q.id === "fetlife" ? "Open their FetLife profile" : "Open a Telegram chat" }, a, " ↗") : a;
  };
  const day = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleDateString("en-US", { ...PT, weekday: "short", month: "short", day: "numeric" }); };


  // ---------- the Admin guide: what each page does. Each person only sees the parts for pages they can open. ----------
  // [id, emoji + title, the tab it explains (or "" for the intro), short summary, [steps], [good to know]]
  const GUIDE = [
    ["start", "🧭 Start here", "", "How the Admin page is laid out and who can see what.", [
      "The top row is the sections: 👥 People, 📅 Events, 🛡️ Moderation, 💡 Ideas, 🏠 Site and 📈 Activity. Tap one and its pages show in the row underneath.",
      "A pink number means something is waiting for you. It adds up on the section and on the 🛡️ Admin button in the menu.",
      "Plain “Admin” opens the first page with something waiting, so you can work through the queue.",
      "📖 Admin guide opens on the page you're on. Use the menu at the top of the guide to jump to any other topic.",
    ], [
      "🗝️ Owners see everything, including vetting, volunteers and the old application sheet.",
      "🛡️ Admins see everything except those three.",
      "🎪 Hosts only see Events, Confessions and Games.",
      "Everything here acts on real accounts and is saved straight away. Anything that can't be undone asks you first.",
    ]],
    ["members", "👥 All members", "members", "Everyone on the site, and a member card for each person.", [
      "The list shows 25 at a time. Search by name, profile name or Telegram, and use Previous / Next for more.",
      "Filters: 🟢 Online now, 🔥 Active this week, 🌱 New this week, 💤 Quiet 30+ days, 🛡️ Team, ⚠️ Missing 21+ / guidelines, 🙈 Hidden and 👻 Not on the list (owners also get ✅ Vetted / Not vetted).",
      "Sort by 🔥 Recently active (online first), 🌱 Newest, 🔑 Last login or A–Z.",
      "Tap anyone to open their member card: last active and last login, days active (7 / 30 / 90), time on the site, a 30-day activity chart, what time of day they're usually on, what they use most, what they've done, events they're going to and came to, how complete their profile is, and their account settings.",
      "Owners also see vetting, their old application and any volunteering on the card.",
      "Admin actions are at the bottom of the card: 🙈 hide or unhide the profile, 🔑 reset their password (copy the ready-made message and send it privately), badges, and turning off Whispers or The Hunt.",
    ], [
      "Last login counts password logins from now on, so it shows “Not recorded yet” until someone next logs in.",
      "Hiding is the gentle option: nothing is deleted.",
      "Whispers, crushes, confessions and anonymous feedback are never shown per person.",
    ]],
    ["vetting", "✅ Vetting", "vetting", "Who's vetted for play parties. Owners only.", [
      "📋 To review lists new vetting forms (oldest first) and anyone marked Needs vetting or Needs re-vetting.",
      "Open a member's 📋 Vetting form to read their answers. FetLife and Telegram answers are links.",
      "Tap a status: ✅ Vetted, 📝 Needs vetting, 🔄 Needs re-vetting, ⏸️ On hold or 🚫 Denied. Setting a status marks their form read.",
      "Use the private note for who vetted them, when it expires or why it's on hold.",
      "No form yet? 📋 Copy a message asking them to fill it in.",
      "To set a status for someone who isn't on the list yet, find them with the search box.",
    ], [
      "Members only ever see “✅ You're vetted” on their own page. Nobody sees pending, on hold or denied, and nobody sees anyone else's status.",
    ]],
    ["matches", "🔗 Possible matches", "vetting", "Linking members to their application in the old Google Form sheet. Owners only.", [
      "Inside ✅ Vetting, the 🔗 Possible matches filter lists members who might match an old application. New members are checked automatically.",
      "🟢 Strong: a Telegram or FetLife handle matches exactly. 🟡 Close: a handle almost matches (a typo, extra numbers, 0 for o). 🟠 Name only.",
      "The coloured chips compare each detail: ✓ same, ≈ almost, ✗ different.",
      "✅ Yes, this is them links it: their status comes from the sheet (if you hadn't set one), a note is added and their answers are attached to their vetting form.",
      "✕ Not them hides that application for that member for good.",
      "Can't find someone? Use 🔍 Find in old applications on their row and search by name, email, Telegram or FetLife. Linked by mistake? Tap Unlink.",
    ], []],
    ["noprofile", "📜 No profile yet", "noprofile", "Everyone from the old application sheet who hasn't made a profile. Owners only.", [
      "Filter by ✅ Vetted, 📝 Not vetted yet, ⏸️ On hold or 🚫 Denied, or search by name, email, Telegram or FetLife.",
      "📋 Read their application shows their full answers.",
      "📋 Copy invite copies a message with the join link and join code. ✉️ Email invite opens your email app with it written. Telegram and FetLife tags open their chat or profile.",
      "When they join and you confirm the match in 🔗 Possible matches, they drop off this list.",
    ], [
      "Denied and on-hold people don't get invite buttons.",
    ]],
    ["events", "📅 Events calendar", "events", "Add and edit events, and keep a record of who came.", [
      "Fill in the form at the top and Save. Times are Pacific, typed like 2026-10-31 7:00 PM.",
      "Vetting: “You can get vetted here” shows green; “Vetted members only” shows velvet with a 🔒.",
      "💜 Hosted by Velvet Collar shows pink on the calendar. 🙋 Open for volunteers puts the event on the volunteer form with a 🙋 Volunteer button. Hidden saves it as a draft.",
      "Edit loads an event back into the form. Delete removes it with its RSVPs; tick Hidden instead to keep the record.",
      "👥 People on an event shows who's going and who's interested. Tick Came as people arrive, add walk-ins, and copy or download the list.",
    ], []],
    ["volunteers", "🙋 Volunteers", "volunteers", "Volunteer forms for events. Owners only.", [
      "Forms are grouped by event, with a running count of who's approved for each role.",
      "Each form has their answers, phone (📞 call, 💬 text) and Telegram.",
      "Tick the role they'll do, add a message if you like (“Setup starts at 5pm, Jess will text you the address”) and tap 🎉 Approve, or 💜 Not this time.",
      "They see your answer and message in a pop-up the next time they open the site, and approved volunteers get a 🙋 tag on the event.",
      "The private note is for owners only. ↩️ Back to review undoes a decision.",
    ], [
      "To open an event for volunteers, tick 🙋 Open for volunteers when you edit it.",
    ]],
    ["reports", "⚑ Reports", "reports", "Reported photos and videos, and reports from Whispers.", [
      "📷 Reported photos & videos come first. Anything reported for showing a minor or someone who didn't consent is already hidden from members.",
      "Tap to view (they start blurred), read who reported it and why, then: 🗑 Delete it, 🔒 Keep hidden, 🔞 Mark NSFW (and show it) or ✅ It's fine, show it.",
      "Each report shows who reported whom, why, and the saved messages.",
      "✅ Mark handled when it's dealt with (Reopen if needed).",
      "Quick actions: 🤫 turn off their Whispers, 🏹 take them out of The Hunt, or 🙈 hide their profile.",
    ], []],
    ["confessions", "💌 Confessions", "confessions", "The anonymous Confession Box. Hosts can moderate it too.", [
      "New confessions wait in ⏳ To review. ✅ Approve puts them on the wall; 🙈 Don't post hides them.",
      "Take down anything mean, coercive, or that points to a real person.",
    ], [
      "Nobody, including owners, can see who wrote a confession.",
    ]],
    ["games", "🎲 Games", "games", "The Playroom games' moving parts. Hosts can use it too.", [
      "🎭 Mystery Match: weekly totals only. Who is paired with whom stays private, even from owners.",
      "🔢 Kink Bingo: this month's numbers are at the bottom of the page. The squares are part of the site itself, so changing them needs a site update.",
      "🎲 Truth or Dare: member card ideas wait in ⏳ Member ideas. ✅ Add to deck, ✏️ Edit first if it needs a tweak, or 🙅 Not this one.",
      "🛟 Players & safeword passes (admins and owners): passes refill every Monday on their own; Reset passes gives someone theirs back early, or use Reset everyone's passes.",
      "➕ Add a card puts your own straight into the deck. 📦 Retire takes a card out without deleting it.",
      "Heat levels: 🌸 Mild, 🌶️ Spicy, 🔥 Scorching. Players only get cards at or below the heat they chose.",
    ], [
      "Cards that touch a member's limits are never dealt to them, so tag-worthy words (rope, impact, photo…) help.",
      "Reported answers and photos show up in ⚑ Reports.",
    ]],
    ["content", "🧹 Content", "content", "Clean up photos, kind notes and question answers.", [
      "Pick 📷 Photos, 💌 Kind notes or ❓ Answers. Newest first.",
      "🗑 Delete removes it for good.",
    ], []],
    ["feedback", "💡 Feedback", "feedback", "What members send with the 💡 Feedback button.", [
      "Each note is 💡 an idea, 🐞 something broken, 💜 a love note or 💬 other, with the page they were on.",
      "Move it to 🛠️ Planned, ✅ Done or 🚫 Not doing. The private note is for admins only.",
      "📋 Add to backlog turns it into a backlog item and marks it Planned.",
    ], [
      "Anonymous feedback can't be traced back to anyone.",
    ]],
    ["backlog", "📋 Backlog", "backlog", "Everything we plan to build or fix.", [
      "Add an item with a title, notes and a priority, or add it from Feedback.",
      "🔨 Start marks it in progress; in-progress and high-priority items sit at the top.",
      "Tick the box when it's done. If it came from feedback, that feedback is marked Done too.",
    ], []],
    ["group", "🏠 Group page", "group", "The Velvet Collar page at /velvetcollar.", [
      "Edit the name, tagline, location and about text, and upload a logo and cover photo.",
      "🔗 Links: Telegram, Discord, FetLife, a donation page and so on.",
      "📄 Extra sections: how to join, what a munch is like, FAQs.",
      "⚙️ Settings: show it to visitors who aren't logged in, show the team, and show upcoming hosted events.",
    ], []],
    ["question", "❓ Question of the week", "question", "The weekly question on the Playroom.", [
      "Type a question and pick the day it starts. Queue a few ahead and they go live by themselves.",
      "The newest question whose start day has arrived is the live one (🟢 live now).",
      "Hide or delete questions; deleting removes their answers too.",
    ], []],
    ["activity", "📈 Activity", "activity", "When people are on the site and what they use.", [
      "Pick the last 7, 30 or 90 days. The numbers compare with the period before.",
      "⏰ Busy times shows the busiest days and hours (Pacific time): handy for when to post or plan events.",
      "📊 Day by day, 🧭 What gets used, 🏆 Most active members, 🌱 New members, and quiet members who haven't been on in a month.",
    ], [
      "Whispers and crushes only ever show as totals, never per person.",
    ]],
  ];
  function openGuide(allowed, at) {
    const { h } = deps();
    const parts = GUIDE.filter((g) => !g[2] || allowed.has(g[2]));
    let cur = Math.max(0, parts.findIndex((g) => g[0] === at));
    const modal = h("div", { class: "modal guide-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "ag_title" });
    const close = () => { modal.remove(); document.removeEventListener("keydown", key); };
    const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") go(cur + 1); if (e.key === "ArrowLeft") go(cur - 1); };
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    // Topics in a dropdown (the list is long), with Back / Next to step through in order.
    const nav = h("select", { class: "guide-select", "aria-label": "Guide topic", onchange: () => go(+nav.value) }, parts.map((g, j) => h("option", { value: String(j) }, g[1])));
    const count = h("small", { class: "faint" });
    const page = h("div", { class: "guide-page" });
    const prev = h("button", { type: "button", class: "btn ghost", onclick: () => go(cur - 1) }, "← Back");
    const next = h("button", { type: "button", class: "btn gold", onclick: () => (cur === parts.length - 1 ? close() : go(cur + 1)) });
    const go = (i) => {
      cur = Math.max(0, Math.min(parts.length - 1, i));
      const [id, title, , intro, steps, tips] = parts[cur];
      nav.value = String(cur);
      count.textContent = `${cur + 1} of ${parts.length}`;
      page.replaceChildren(
        h("h2", { id: "ag_title", style: "margin:0" }, title),
        h("p", { class: "muted", style: "margin:4px 0 0" }, intro),
        h("ol", { class: "guide-steps" }, steps.map((t) => h("li", {}, t))),
        tips.length ? h("div", { class: "guide-tips" }, h("b", {}, "Good to know"), h("ul", {}, tips.map((t) => h("li", {}, t)))) : "");
      prev.disabled = cur === 0;
      next.textContent = cur === parts.length - 1 ? "Done 💜" : "Next →";
      page.scrollTop = 0;
    };
    modal.append(h("div", { class: "modal-box guide-box" },
      h("div", { class: "toggle-row" }, h("b", {}, "📖 Admin guide"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
      nav, page, h("div", { class: "guide-foot" }, prev, count, next)));
    document.body.append(modal); document.addEventListener("keydown", key);
    go(cur);
  }

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
    const tabs = (sum.mod ? TABS : TABS.filter((t) => t[0] === "events" || t[0] === "confessions" || t[0] === "games")).filter((t) => (t[0] !== "vetting" && t[0] !== "volunteers" && t[0] !== "noprofile") || sum.owner);
    // Things waiting for someone, per tab (shown as a count on the tab and its group).
    const waiting = { reports: sum.openReports || 0, vetting: (sum.newForms || 0) + (sum.vetMatches || 0), confessions: sum.newConfessions || 0, games: sum.newTodCards || 0, volunteers: sum.newVolunteers || 0, feedback: sum.newFeedback || 0 };
    const allowed = new Set(tabs.map((t) => t[0]));
    const label = Object.fromEntries(tabs);
    const groups = GROUPS.map(([id, name, ids]) => [id, name, ids.filter((t) => allowed.has(t))]).filter((g) => g[2].length);
    // No tab in the link (or one this person can't open): start where something is waiting, else People (or Events for hosts).
    if (!allowed.has(tab)) tab = tabs.map((t) => t[0]).find((t) => waiting[t]) || (allowed.has("members") ? "members" : tabs[0][0]);
    const open = groups.find((g) => g[2].includes(tab));
    const badge = (n) => (n ? h("span", { class: "nav-badge" }, String(n)) : null);
    const body = h("div", {});
    const groupNav = h("div", { class: "pills mod-groups", role: "tablist", "aria-label": "Admin sections" }, groups.map(([id, name, ids]) =>
      h("a", { class: "pill", href: "/admin/" + ids[0], "data-nav": "", role: "tab", "aria-selected": String(open && open[0] === id), "aria-pressed": String(open && open[0] === id) },
        name, badge(ids.reduce((n, t) => n + (waiting[t] || 0), 0)))));
    const nav = h("div", { class: "pills mod-tabs", role: "tablist", "aria-label": "Pages in this section", hidden: !open || open[2].length < 2 }, (open ? open[2] : []).map((id) =>
      h("a", { class: "pill", href: "/admin/" + id, "data-nav": "", role: "tab", "aria-selected": String(id === tab), "aria-pressed": String(id === tab) },
        SUB_LABEL[id] || label[id], badge(waiting[id]))));
    // One way in: the guide opens on the page you're looking at; pick any other topic from its menu.
    const helpBtn = h("button", { type: "button", class: "btn small ghost guide-btn", title: "How this page works, and everything else", onclick: () => openGuide(allowed, tab) }, "📖 Admin guide");
    app.replaceChildren(h("section", { class: "mod-head" }, h("div", { class: "toggle-row" }, h("h1", {}, "🛡️ Admin"), helpBtn),
      h("p", { class: "muted" }, sum.mod ? "Everything here acts on the real accounts. Be kind, be careful." : "As a host you can add and edit events.")), groupNav, nav, body);
    try { await ({ reports, members: (b) => members(b, sum), vetting, volunteers, noprofile, events, confessions, games, feedback, backlog, activity, group, question, content })[tab](body); }
    catch (err) { body.replaceChildren(h("p", { class: "muted" }, errMsg(err))); }
  }

  // ---------- reports ----------
  // Reported photos and videos: look, then keep it hidden, mark it NSFW, restore it or delete it.
  const PR_L = { minor: "🚸 Someone under 18", consent: "🙅 Someone who didn't agree to be posted", nsfw: "🔞 Explicit, not marked NSFW", guidelines: "📜 Breaks the guidelines", other: "💬 Other" };
  const PR_OUT = { restore: "✅ Restored", nsfw: "🔞 Marked NSFW", delete: "🗑 Deleted", keep_hidden: "🔒 Kept hidden" };
  async function photoReports(holder, refresh) {
    const { h, pb, toast, personChip, errMsg } = deps();
    let d; try { d = await pb.send("/api/vc/mod/photo-reports", {}); } catch (err) { holder.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
    if (!d.items.length) { holder.replaceChildren(); return; }
    const act = async (it, action, msg) => {
      if (action === "delete" && !confirm("Delete this for good? This can't be undone.")) return;
      try { await pb.send(`/api/vc/mod/photo-reports/${it.photo.id}`, { method: "POST", body: { action } }); toast(msg); refresh(); } catch (err) { toast(errMsg(err), true); }
    };
    holder.replaceChildren(h("h2", { class: "mod-sec-h" }, `📷 Reported photos & videos (${d.items.length})`), ...d.items.map((it) => {
      const ph = it.photo, url = pb.files.getURL(ph, ph.image), vid = /\.(mp4|mov|webm|m4v)$/i.test(ph.image);
      let shown = false;
      const media = h("div", { class: "pr-media blurred" }, vid ? h("video", { src: url, controls: true, preload: "metadata" }) : h("img", { src: pb.files.getURL(ph, ph.image, { thumb: "400x400" }), alt: "" }),
        h("button", { type: "button", class: "pr-reveal", onclick: (e) => { shown = !shown; media.classList.toggle("blurred", !shown); e.currentTarget.textContent = shown ? "Blur" : "Tap to view"; } }, "Tap to view"));
      return h("section", { class: "panel mod-report pr-card" },
        h("div", { class: "pr-grid" }, media,
          h("div", {},
            h("p", { class: "mod-who", style: "margin-top:0" }, "Posted by ", ph.owner ? personChip(ph.owner) : h("i", {}, "member deleted"),
              ph.flagged ? h("span", { class: "att-tag" }, "🔒 Hidden from members") : h("span", { class: "att-tag" }, "👀 Still showing"), ph.nsfw ? h("span", { class: "att-tag" }, "NSFW") : null),
            ph.caption ? h("p", { class: "faint", style: "margin:4px 0" }, "“" + ph.caption + "”") : null,
            h("ul", { class: "pr-list" }, it.reports.map((r) => h("li", {}, h("b", {}, PR_L[r.reason] || r.reason), " · ", r.reporter ? personChip(r.reporter) : h("i", {}, "deleted"),
              h("small", { class: "faint" }, ` · ${when(r.created)}`), r.note ? h("div", { class: "faint" }, "“" + r.note + "”") : null))),
            h("div", { class: "actions" },
              h("button", { type: "button", class: "btn small danger", onclick: () => act(it, "delete", "Deleted") }, "🗑 Delete it"),
              h("button", { type: "button", class: "btn small ghost", onclick: () => act(it, "keep_hidden", "Kept hidden") }, "🔒 Keep hidden"),
              h("button", { type: "button", class: "btn small ghost", onclick: () => act(it, "nsfw", "Marked NSFW and shown") }, "🔞 Mark NSFW"),
              h("button", { type: "button", class: "btn small gold", onclick: () => act(it, "restore", "Restored") }, "✅ It's fine, show it")))));
    }));
  }

  // Reported Truth or Dare answers: hide the photo, take it off the wall, mark it NSFW, or say it's fine.
  const TR_OUT = { restore: "✅ Restored", nsfw: "🔞 Marked NSFW", remove_photo: "🗑 Photo removed", unshare: "🙈 Taken off the wall", keep_hidden: "🔒 Kept hidden" };
  async function todReports(holder, refresh) {
    const { h, pb, toast, personChip, errMsg } = deps();
    let d; try { d = await pb.send("/api/vc/mod/tod-reports", {}); } catch (err) { holder.replaceChildren(); return; }
    if (!d.items.length) { holder.replaceChildren(); return; }
    const act = async (it, action) => {
      if (action === "remove_photo" && !confirm("Remove this photo for good?")) return;
      try { await pb.send(`/api/vc/mod/tod-reports/${it.play.id}`, { method: "POST", body: { action } }); toast(TR_OUT[action]); refresh(); } catch (err) { toast(errMsg(err), true); }
    };
    holder.replaceChildren(h("h2", { class: "mod-sec-h" }, `🎲 Reported Truth or Dare answers (${d.items.length})`), ...d.items.map((it) => {
      const p = it.play;
      let shown = false;
      const media = p.proof ? h("div", { class: "pr-media blurred" }, h("img", { src: pb.files.getURL(p, p.proof, { thumb: "400x400" }), alt: "" }),
        h("button", { type: "button", class: "pr-reveal", onclick: (e) => { shown = !shown; media.classList.toggle("blurred", !shown); e.currentTarget.textContent = shown ? "Blur" : "Tap to view"; } }, "Tap to view")) : h("div", {});
      return h("section", { class: "panel mod-report pr-card" },
        h("div", { class: p.proof ? "pr-grid" : "" }, p.proof ? media : "",
          h("div", {},
            h("p", { class: "mod-who", style: "margin-top:0" }, "Played by ", p.by ? personChip(p.by) : h("i", {}, "member deleted"),
              p.flagged ? h("span", { class: "att-tag" }, "🔒 Hidden from members") : p.shared ? h("span", { class: "att-tag" }, "👀 On the wall") : h("span", { class: "att-tag" }, "Not on the wall"), p.nsfw ? h("span", { class: "att-tag" }, "NSFW") : null),
            h("p", { class: "faint", style: "margin:4px 0" }, (p.kind === "dare" ? "🎯 Dare: " : "💭 Truth: ") + p.text),
            p.answer ? h("p", { class: "mod-cb-text" }, p.answer) : null,
            h("ul", { class: "pr-list" }, it.reports.map((r) => h("li", {}, h("b", {}, PR_L[r.reason] || r.reason), " · ", r.reporter ? personChip(r.reporter) : h("i", {}, "deleted"),
              h("small", { class: "faint" }, ` · ${when(r.created)}`), r.note ? h("div", { class: "faint" }, "“" + r.note + "”") : null))),
            h("div", { class: "actions" },
              p.proof ? h("button", { type: "button", class: "btn small danger", onclick: () => act(it, "remove_photo") }, "🗑 Remove photo") : null,
              h("button", { type: "button", class: "btn small ghost", onclick: () => act(it, "unshare") }, "🙈 Take off the wall"),
              h("button", { type: "button", class: "btn small ghost", onclick: () => act(it, "keep_hidden") }, "🔒 Keep hidden"),
              p.proof ? h("button", { type: "button", class: "btn small ghost", onclick: () => act(it, "nsfw") }, "🔞 Mark NSFW") : null,
              h("button", { type: "button", class: "btn small gold", onclick: () => act(it, "restore") }, "✅ It's fine")))));
    }));
  }

  async function reports(body) {
    const { h, pb, toast, personChip, errMsg } = deps();
    const data = await pb.send("/api/vc/mod/reports", {});
    const act = async (path, payload, msg) => { try { await pb.send(path, { method: "POST", body: payload }); toast(msg); reports(body); } catch (err) { toast(errMsg(err), true); } };
    const photoHolder = h("div", {}), todHolder = h("div", {});
    photoReports(photoHolder, () => reports(body));
    todReports(todHolder, () => reports(body));
    if (!data.reports.length) { body.replaceChildren(photoHolder, todHolder, h("section", { class: "panel" }, h("h2", { class: "mod-sec-h", style: "margin-top:0" }, "🤫 Whisper reports"), h("p", { class: "muted", style: "margin:0" }, "No reports. 🌙 All quiet."))); return; }
    body.replaceChildren(photoHolder, todHolder, h("h2", { class: "mod-sec-h" }, "🤫 Whisper reports"), ...data.reports.map((r) => {
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

  // ---------- members: a paged list (filtered and sorted on the server) and a card for each member ----------
  let mbF = "all", mbSort = "active", mbPage = 1, mbQ = "";
  const agoM = (ts) => {
    const t = Date.parse(String(ts || "").replace(" ", "T")); if (isNaN(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 90) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago";
    const d = Math.round(s / 86400); return d < 30 ? d + (d === 1 ? " day ago" : " days ago") : d < 365 ? Math.round(d / 30) + " mo ago" : Math.round(d / 365) + " yr ago";
  };
  const VET_L = { vetted: "✅ Vetted", needs: "📝 Needs vetting", renew: "🔄 Re-vet", hold: "⏸️ On hold", denied: "🚫 Denied" };
  const BADGE_E = { owner: "🗝️", admin: "🛡️", host: "🎪", welcomer: "🤗", helper: "🛠️", vip: "👑" };
  async function members(body, sum) {
    const { h, pb, errMsg, miniAvatar } = deps();
    const F_LABEL = [["all", "Everyone"], ["online", "🟢 Online now"], ["active", "🔥 Active this week"], ["new", "🌱 New this week"], ["inactive", "💤 Quiet 30+ days"],
      ["staff", "🛡️ Team"], ["consent", "⚠️ Missing 21+ / guidelines"], ["hidden", "🙈 Hidden"], ["unlisted", "👻 Not on the list"], ["vetted", "✅ Vetted"], ["unvetted", "Not vetted"]];
    const search = h("input", { type: "search", placeholder: "Search by name, profile name or Telegram", "aria-label": "Search members", value: mbQ });
    const sortSel = h("select", { "aria-label": "Sort", class: "mb-sort" }, [["active", "🔥 Recently active"], ["new", "🌱 Newest"], ["login", "🔑 Last login"], ["name", "A–Z"]].map(([v, l]) => h("option", { value: v }, l)));
    sortSel.value = mbSort;
    const pills = h("div", { class: "pills mb-filters" });
    const info = h("p", { class: "faint", style: "margin:0" });
    const list = h("div", { class: "mb-list" });
    const pager = h("div", { class: "mb-pager" });
    body.replaceChildren(h("section", { class: "panel" }, h("div", { class: "dir-search-row" }, search, sortSel), pills, info), h("section", { class: "panel mb-panel" }, list, pager));
    const row = (m) => h("button", { type: "button", class: "mb-row" + (m.hidden ? " is-hidden" : ""), onclick: () => openCard(m.id, sum, () => load()) },
      h("span", { class: "mb-av" }, miniAvatar(m, "mb-av-img"), m.online ? h("span", { class: "dot", title: "Online now" }) : null),
      h("span", { class: "mb-main" },
        h("span", { class: "mb-name" }, h("b", {}, m.display_name), " ", m.badges.map((b) => BADGE_E[b] ? h("span", { title: b }, BADGE_E[b]) : null)),
        h("small", { class: "faint" }, `@${m.slug} · joined ${dayY(m.created)}`)),
      h("span", { class: "mb-meta" },
        h("span", { class: "mb-seen" + (m.online ? " on" : "") }, m.online ? "🟢 Online now" : m.lastSeen ? "Active " + agoM(m.lastSeen) : "Never active"),
        h("small", { class: "faint" }, `${m.days30} day${m.days30 === 1 ? "" : "s"} active this month`)),
      h("span", { class: "mb-flags" },
        sum.owner && m.vetting ? h("span", { class: "att-tag" }, VET_L[m.vetting] || m.vetting) : null,
        m.hidden ? h("span", { class: "att-tag" }, "🙈 Hidden") : null,
        !m.listed ? h("span", { class: "att-tag", title: "Not on the member list" }, "👻") : null,
        m.no21 || m.noGuidelines ? h("span", { class: "att-tag warn", title: [m.no21 ? "Hasn't confirmed 21+" : "", m.noGuidelines ? "Hasn't agreed to the guidelines" : ""].filter(Boolean).join(" · ") }, "⚠️") : null),
      h("span", { class: "arrow", "aria-hidden": "true" }, "›"));
    const load = async () => {
      let d;
      try { d = await pb.send(`/api/vc/mod/members/list?f=${mbF}&sort=${mbSort}&page=${mbPage}&q=` + encodeURIComponent(mbQ), {}); }
      catch (err) { list.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
      if (mbPage > d.pages) { mbPage = d.pages; return load(); }
      pills.replaceChildren(...F_LABEL.filter(([k]) => d.counts[k] !== undefined).map(([k, l]) =>
        h("button", { type: "button", class: "pill", "aria-pressed": String(mbF === k), onclick: () => { mbF = k; mbPage = 1; load(); } }, `${l} (${d.counts[k]})`)));
      info.textContent = `${d.matched} of ${d.total} members${mbQ ? ` matching “${mbQ}”` : ""}. Tap anyone for their member card.`;
      list.replaceChildren(...(d.items.length ? d.items.map(row) : [h("p", { class: "muted", style: "margin:0" }, "Nobody here.")]));
      pager.replaceChildren(...(d.pages > 1 ? [
        h("button", { type: "button", class: "btn small ghost", disabled: mbPage <= 1, onclick: () => { mbPage--; load(); list.scrollIntoView({ block: "start" }); } }, "‹ Previous"),
        h("span", { class: "faint" }, `Page ${d.page} of ${d.pages}`),
        h("button", { type: "button", class: "btn small ghost", disabled: mbPage >= d.pages, onclick: () => { mbPage++; load(); list.scrollIntoView({ block: "start" }); } }, "Next ›")] : []));
    };
    let t;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { mbQ = search.value.trim(); mbPage = 1; load(); }, 300); });
    sortSel.addEventListener("change", () => { mbSort = sortSel.value; mbPage = 1; load(); });
    load();
  }

  // One member's card: activity, what they've done, events, profile, account, vetting (owners) and admin actions.
  async function openCard(id, sum, onChange) {
    const { h, pb, toast, errMsg, copyText, miniAvatar } = deps();
    const modal = h("div", { class: "modal mb-modal", role: "dialog", "aria-modal": "true", "aria-label": "Member card" });
    const box = h("div", { class: "modal-box mb-card" }, h("p", { class: "faint" }, "Loading…"));
    let changed = false;
    const close = () => { modal.remove(); document.removeEventListener("keydown", esc); if (changed && onChange) onChange(); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.append(box); document.body.append(modal); document.addEventListener("keydown", esc);
    const save = async (payload, msg) => {
      try { await pb.send(`/api/vc/mod/members/${id}`, { method: "POST", body: payload }); toast(msg); changed = true; draw(); return true; }
      catch (err) { toast(errMsg(err), true); return false; }
    };
    const draw = async () => {
      let d; try { d = await pb.send(`/api/vc/mod/members/${id}/card`, {}); } catch (err) { box.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
      const m = d.member, a = d.activity;
      const tile = (label, value, sub) => h("div", { class: "mb-tile" }, h("small", { class: "faint" }, label), h("b", {}, value), sub ? h("small", { class: "faint" }, sub) : null);
      const hrs = (min) => (min >= 60 ? (Math.round(min / 6) / 10) + " h" : min + " min");
      const maxDay = Math.max(1, ...a.series.map((x) => x.minutes));
      const maxHr = Math.max(1, ...a.hours);
      const hr = (x) => (x % 12 || 12) + (x < 12 ? "a" : "p");
      const peak = a.hours.some(Boolean) ? a.hours.indexOf(Math.max(...a.hours)) : -1;
      const sec = (title, ...kids) => h("section", { class: "mb-sec" }, h("h3", {}, title), ...kids);
      const did = d.did;
      const counts = [["🔥 Reactions given", did.reactions], ["💖 Reactions received", did.reactionsGot], ["💌 Kind notes sent", did.notes], ["📬 Notes received", did.notesGot],
        ["🤝 Vouches given", did.vouches], ["🙌 Vouched for", did.vouchesGot], ["📅 RSVPs", did.rsvps], ["✅ Events attended", did.attended], ["📷 Photos", did.photos],
        ["❓ Question answers", did.answers], ["🏹 Hunts started", did.hunts], ["💞 Relationships", did.relationships]];
      const yes = (v, on, off) => h("span", { class: "mb-flag " + (v ? "ok" : "no") }, v ? on : off);
      const badgeRow = h("div", { class: "pills" }, BADGES.map(([bid, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String(m.badges.includes(bid)),
        disabled: bid === "owner" && !sum.owner, title: bid === "owner" && !sum.owner ? "Only an owner can change this" : "",
        onclick: () => save({ badges: m.badges.includes(bid) ? m.badges.filter((b) => b !== bid) : [...m.badges, bid] }, "Badges updated") }, label)));
      const pwHolder = h("div", {});
      box.replaceChildren(
        h("div", { class: "mb-card-head" },
          h("span", { class: "mb-av big" }, miniAvatar(m, "mb-av-img"), a.online ? h("span", { class: "dot" }) : null),
          h("div", { class: "mb-card-who" }, h("h2", { style: "margin:0" }, m.display_name, " ", m.badges.map((b) => BADGE_E[b] ? h("span", { title: b }, BADGE_E[b]) : null)),
            h("small", { class: "faint" }, [`@${m.slug}`, m.pronouns, m.location, `joined ${dayY(m.created)}`].filter(Boolean).join(" · ")),
            h("div", { class: "actions", style: "margin:6px 0 0" }, h("a", { class: "btn small", href: "/" + m.slug, "data-nav": "", onclick: close }, "View profile ›"),
              m.tg ? h("a", { class: "btn small ghost", href: "https://t.me/" + encodeURIComponent(m.tg.replace(/^@/, "")), target: "_blank", rel: "noopener" }, "✈️ Telegram") : null)),
          h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
        h("div", { class: "mb-tiles" },
          tile("Last active", a.online ? "🟢 Online now" : a.lastSeen ? agoM(a.lastSeen) : "Never", a.lastSeen ? when(a.lastSeen) : ""),
          tile("Last login", m.lastLogin ? agoM(m.lastLogin) : "Not recorded yet", m.logins ? `${m.logins} login${m.logins === 1 ? "" : "s"} since tracking began` : ""),
          tile("Days active", `${a.days7} / ${a.days30} / ${a.days90}`, "last 7 / 30 / 90 days"),
          tile("Time on the site", hrs(a.minutes30), `this month · ${hrs(a.minutesTotal)} in all`)),
        sec("📈 Last 30 days", h("div", { class: "mb-bars", role: "img", "aria-label": "Minutes on the site per day for the last 30 days" },
          a.series.map((x) => h("i", { title: `${x.day}: ${x.minutes} min`, style: `height:${Math.max(x.minutes ? 6 : 2, Math.round(x.minutes / maxDay * 100))}%`, class: x.minutes ? "" : "zero" }))),
          h("small", { class: "faint" }, a.firstSeen ? `First seen ${dayY(a.firstSeen)} (activity tracking started recently, so older visits aren't counted).` : "No visits recorded yet.")),
        sec("⏰ Usually on", h("div", { class: "mb-hours" }, a.hours.map((v, i) => h("i", { title: `${hr(i)}: ${v * 5} min`, style: `opacity:${v ? 0.25 + 0.75 * v / maxHr : 0.06}` }))),
          h("div", { class: "mb-hours-l faint" }, h("span", {}, "12a"), h("span", {}, "6a"), h("span", {}, "12p"), h("span", {}, "6p"), h("span", {}, "12a")),
          h("small", { class: "faint" }, peak >= 0 ? `Busiest around ${hr(peak)}m (Pacific).` : "Not enough activity yet.")),
        a.pages.length ? sec("🧭 Uses most", h("div", { class: "pills" }, a.pages.map((x) => h("span", { class: "att-tag" }, `${PAGE_LABEL[x.key] || x.key} · ${x.count}`)))) : "",
        sec("🙌 What they've done", h("div", { class: "mb-counts" }, counts.map(([l, v]) => h("div", { class: v ? "" : "zero" }, h("b", {}, String(v)), h("small", {}, l))))),
        sec("📅 Events",
          h("p", { style: "margin:0" }, h("b", {}, "Going next: "), d.events.upcoming.length ? d.events.upcoming.map((ev) => `${ev.emoji || "📅"} ${ev.title} (${dayY(ev.starts)})`).join(" · ") : "Nothing yet."),
          h("p", { style: "margin:6px 0 0" }, h("b", {}, `Came to (${did.attended}): `), d.events.attended.length ? d.events.attended.map((ev) => `${ev.emoji || "📅"} ${ev.title} (${dayY(ev.starts)})`).join(" · ") : "None recorded. Tick “Came” on an event's 👥 People list.")),
        sec("✨ Profile", h("div", { class: "pills" }, d.profile.map((x) => h("span", { class: "mb-flag " + (x.ok ? "ok" : "no") }, (x.ok ? "✓ " : "✗ ") + x.label))),
          h("small", { class: "faint" }, `${d.profile.filter((x) => x.ok).length} of ${d.profile.length} filled in.`)),
        sec("⚙️ Account", h("div", { class: "pills" },
          yes(m.age21_at, "🔞 21+ confirmed " + dayY(m.age21_at), "🔞 Hasn't confirmed 21+"),
          yes(m.guidelines_at, "📜 Guidelines agreed " + dayY(m.guidelines_at), "📜 Hasn't agreed to the guidelines"),
          yes(m.listed, "📋 On the member list", "👻 Not on the member list"),
          yes(!m.hidden, "👀 Profile visible", "🙈 Profile hidden"),
          h("span", { class: "mb-flag" }, m.hideOnline ? "🙈 Hides online status" : "🟢 Shows online status"),
          h("span", { class: "mb-flag" }, m.networking ? "🤝 In Networking" : "🤝 Not in Networking"),
          h("span", { class: "mb-flag" }, `🤫 Whispers ${m.whisper_opt ? "on" : "off"}`), h("span", { class: "mb-flag" }, `🏹 Hunt: ${m.hunt_opt}`))),
        d.vetting ? sec("🔒 Vetting (owners only)",
          h("p", { style: "margin:0" }, h("b", {}, VET_L[d.vetting.status] || "No status"), d.vetting.by ? h("span", { class: "faint" }, ` · ${d.vetting.by}${d.vetting.at ? " · " + dayY(d.vetting.at) : ""}`) : null),
          d.vetting.note ? h("p", { class: "faint", style: "margin:4px 0 0" }, "📝 " + d.vetting.note) : null,
          d.application ? h("p", { class: "faint", style: "margin:4px 0 0" }, `📜 Old application: sheet row ${d.application.row} · applied ${dayY(d.application.applied)} · sheet said “${d.application.status_raw || "no status"}”`) : null,
          d.volunteering && d.volunteering.length ? h("p", { class: "faint", style: "margin:4px 0 0" }, "🙋 Volunteering: " + d.volunteering.map((v) => `${v.event} (${v.status}${v.role.length ? ", " + v.role.join("/") : ""})`).join(" · ")) : null,
          h("a", { class: "btn small ghost", href: "/admin/vetting", "data-nav": "", onclick: close, style: "margin-top:6px" }, "Open Vetting ›")) : "",
        sec("🛠️ Admin actions",
          h("div", { class: "mb-row2" }, h("small", { class: "faint" }, "Badges"), badgeRow),
          h("div", { class: "actions", style: "margin:8px 0 0" },
            h("button", { type: "button", class: "btn small " + (m.hidden ? "gold" : "ghost"), onclick: () => { if (!m.hidden && !confirm(`Hide ${m.display_name}'s profile?`)) return; save({ hidden: !m.hidden }, m.hidden ? "Unhidden" : "Hidden"); } }, m.hidden ? "Unhide profile" : "🙈 Hide profile"),
            h("button", { type: "button", class: "btn small ghost", onclick: async () => {
              if (!confirm(`Give ${m.display_name} a new temporary password? Their old one stops working.`)) return;
              try {
                const r = await pb.send(`/api/vc/mod/members/${id}/password`, { method: "POST" });
                const msg = `Hi! Your temporary Velvet Collar password is ${r.password} . Log in with your profile name (${r.slug}) at ${location.origin}/login and change it in Settings.`;
                pwHolder.replaceChildren(h("div", { class: "mod-pw" }, h("p", {}, "New password: ", h("code", {}, r.password), " (shown once)"),
                  h("button", { type: "button", class: "btn small", onclick: () => copyText(msg, "Copied a message to send them privately") }, "📋 Copy a message for them")));
              } catch (err) { toast(errMsg(err), true); }
            } }, "🔑 Reset password"),
            m.whisper_opt ? h("button", { type: "button", class: "btn small ghost", onclick: () => save({ whisper_opt: false }, "Whispers off") }, "Turn off Whispers") : null,
            m.hunt_opt !== "off" ? h("button", { type: "button", class: "btn small ghost", onclick: () => save({ hunt_opt: "off" }, "Hunt off") }, "Turn off Hunt") : null),
          pwHolder));
    };
    draw();
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
      return s === "hold" || s === "denied" ? s : "vetted";
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
            h("summary", {}, f.seen ? "📋 Vetting form" : "📋 New vetting form", h("small", { class: "faint" }, f.answers._applied ? ` · applied ${dayY(f.answers._applied)} · from the application sheet` : ` · sent ${when(f.updated || f.created)}${f.seen && f.seen_by ? " · read by " + f.seen_by : ""}`)),
            h("dl", { class: "vf-answers" }, data.questions.flatMap((q) => { const a = answer(q, f.answers[q.id]); return [h("dt", {}, q.q), h("dd", { class: a ? "" : "empty" }, a ? answerEl(h, q, a) : "(no answer)")]; })),
            h("div", { class: "actions" }, mark));
        } else {
          formEl = h("p", { class: "faint vet-noform" }, "No vetting form sent yet. ",
            h("button", { type: "button", class: "btn small ghost", onclick: () => copyText(`Hi ${m.display_name}! To get vetted for play parties, please fill in the form here: ${location.origin}/vetting`, "Copied a message to send them") }, "📋 Copy a message asking them to fill it in"));
        }
        el.replaceChildren(
          h("div", { class: "vf-head" }, photo, h("div", {}, personChip(m),
            h("div", { class: "faint", style: "font-size:.85rem" }, `@${m.slug}`, v.by ? ` · updated by ${v.by}${v.at ? " " + day(v.at) : ""}` : ""),
            h("div", { style: "font-size:.92rem;margin-top:2px" }, h("b", {}, L[v.status] || "No status yet"), f && !f.seen ? h("span", { class: "vet-new" }, "New form") : null))),
          h("div", { class: "pills" }, [["", "None"], ...["vetted", "needs", "renew", "hold", "denied"].map((k) => [k, L[k]])].map(([k, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String((v.status || "") === k),
            onclick: () => save({ status: k }, k ? `Set to ${label}` : "Status cleared") }, label))),
          h("div", { class: "mod-row2" }, note, h("button", { type: "button", class: "btn small ghost", onclick: () => save({ note: note.value }, "Note saved") }, "Save note")),
          historyBox(m),
          formEl);
      };
      draw();
      return el;
    };
    const VIEWS = [["review", "📋 To review"], ["matches", "🔗 Possible matches"], ["hold", "⏸️ On hold"], ["vetted", "✅ Vetted"], ["denied", "🚫 Denied"]];
    const draw = () => {
      const q = search.value.trim();
      const counts = {}; VIEWS.forEach(([k]) => { counts[k] = q ? 0 : k === "matches" ? (mt ? mt.items.length : 0) : data.members.filter((m) => group(m) === k).length; });
      const fresh = data.members.filter((m) => m.form && !m.form.seen).length;
      pills.replaceChildren(...VIEWS.map(([k, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String(!q && vetView === k), onclick: () => { search.value = ""; vetView = k; load(); } },
        `${label} (${counts[k]})`, k === "review" && fresh ? h("span", { class: "nav-badge" }, String(fresh)) : null, k === "matches" && counts[k] ? h("span", { class: "nav-badge" }, String(counts[k])) : null)));
      if (!q && vetView === "matches") return drawMatches();
      const tab = document.querySelector('.mod-tabs a[href="/admin/vetting"]');
      const nb = fresh + (mt ? mt.items.length : 0);
      if (tab && !q) { tab.querySelector(".nav-badge")?.remove(); if (nb) tab.append(h("span", { class: "nav-badge" }, String(nb))); }
      let ms = q ? data.members : data.members.filter((m) => group(m) === vetView);
      // To review: new forms first (oldest first, so nobody waits too long), then everyone else by name.
      if (!q && vetView === "review") ms = ms.slice().sort((a, b) => { const an = a.form && !a.form.seen, bn = b.form && !b.form.seen; return an !== bn ? (an ? -1 : 1) : an ? String(a.form.created).localeCompare(String(b.form.created)) : a.display_name.localeCompare(b.display_name); });
      const empty = q ? "Nobody by that name." : vetView === "review" ? "Nothing to review. 🌙 All caught up." : vetView === "hold" ? "Nobody is on hold." : vetView === "denied" ? "Nobody is denied." : "Nobody is vetted yet.";
      holder.replaceChildren(...(ms.length ? ms.map(row) : [h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, empty))]));
    };
    // ---- the old application sheet: shared bits ----
    const TIERS = { strong: ["🟢 Strong match", "hit"], close: ["🟡 Close match", "close"], name: ["🟠 Name only", "weak"] };
    const FIELD = { telegram: "✈️ Telegram", fetlife: "FetLife", name: "Name" };
    // Side by side: what matches the member's profile and what doesn't.
    const cmpRow = (c) => c.fields ? h("div", { class: "vm-cmp" }, ["telegram", "fetlife", "name"].map((k) => {
      const f = c.fields[k];
      if (f.state === "missing") return h("span", { class: "vm-f none" }, FIELD[k] + " — not given");
      if (f.state === "match") return h("span", { class: "vm-f ok" }, `${FIELD[k]} ✓ ${f.sheet}`);
      if (f.state === "close") return h("span", { class: "vm-f close" }, `${FIELD[k]} ≈ sheet: ${f.sheet} · profile: ${f.profile}`);
      return h("span", { class: "vm-f no" }, `${FIELD[k]} ✗ sheet: ${f.sheet}${f.profile ? " · profile: " + f.profile : ""}`);
    })) : null;
    const appCard = (m, c, actions) => h("div", { class: "vm-cand t-" + (c.tier || "none") },
      h("div", {},
        h("b", {}, c.name || "(no name)"), h("small", { class: "faint" }, ` · applied ${dayY(c.applied)} · sheet row ${c.row}`),
        h("div", { class: "vm-tags" },
          c.tier ? h("span", { class: "att-tag " + TIERS[c.tier][1] }, TIERS[c.tier][0]) : null,
          h("span", { class: "att-tag" }, "Sheet: " + (c.status_raw || "no status") + (c.status ? " → " + (data.labels[c.status] || c.status) : "")),
          c.telegram ? handleTag(h, "tg", c.telegram) : null,
          c.fetlife ? handleTag(h, "fet", c.fetlife) : null)),
      cmpRow(c),
      c.notes ? h("p", { class: "faint", style: "margin:6px 0 0" }, "📝 " + c.notes) : null,
      h("details", { class: "vm-ans" }, h("summary", { class: "faint" }, "Read their application"),
        h("dl", { class: "vf-answers" }, data.questions.flatMap((q) => { const a = answer(q, c.answers[q.id]); return a ? [h("dt", {}, q.q), h("dd", {}, answerEl(h, q, a))] : []; }))),
      actions && actions.length ? h("div", { class: "actions", style: "margin:8px 0 0" }, actions) : null);
    const linkApp = async (m, c) => {
      try { await pb.send(`/api/vc/mod/vet-matches/${c.id}`, { method: "POST", body: { member: m.id, action: "link" } }); toast(`Linked to ${m.display_name}.` + (c.status ? ` Status from the sheet: ${data.labels[c.status] || c.status} (if they didn't have one).` : "")); load(); }
      catch (err) { toast(errMsg(err), true); }
    };
    // On each member: their linked application, or a search of the sheet to find and link it by hand.
    const historyBox = (m) => {
      const box = h("div", { class: "vm-find" });
      if (m.history) {
        box.append(h("p", { class: "faint", style: "margin:0" }, `📜 Old application: sheet row ${m.history.row} · ${m.history.name} · applied ${dayY(m.history.applied)} · sheet said “${m.history.status_raw || "no status"}” `,
          h("button", { type: "button", class: "btn small ghost", onclick: async () => {
            if (!confirm(`Unlink this application from ${m.display_name}? Their status, note and attached answers stay as they are.`)) return;
            try { await pb.send(`/api/vc/mod/vet-matches/${m.history.id}`, { method: "POST", body: { member: m.id, action: "unlink" } }); toast("Unlinked"); load(); } catch (err) { toast(errMsg(err), true); }
          } }, "Unlink")));
        return box;
      }
      const q = h("input", { type: "search", placeholder: "Search the old applications: name, email, Telegram or FetLife", "aria-label": "Search old applications" });
      const res = h("div", { class: "vm-results" });
      let t;
      q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => {
        if (q.value.trim().length < 2) return res.replaceChildren();
        try {
          const r = await pb.send(`/api/vc/mod/vet-history?member=${m.id}&q=` + encodeURIComponent(q.value.trim()), {});
          res.replaceChildren(...(r.items.length ? r.items.map((c) => appCard(m, c, [c.linkedTo ? h("span", { class: "faint" }, "Already linked to ", personChip(c.linkedTo))
            : h("button", { type: "button", class: "btn small gold", onclick: () => linkApp(m, c) }, `✅ Link to ${m.display_name}`)])) : [h("p", { class: "faint", style: "margin:0" }, "No applications found.")]));
        } catch (err) { toast(errMsg(err), true); }
      }, 300); });
      const wrap = h("div", { class: "vm-search", hidden: true }, q, res);
      box.append(h("button", { type: "button", class: "btn small ghost", onclick: () => { wrap.hidden = !wrap.hidden; if (!wrap.hidden) q.focus(); } }, "🔍 Find in old applications"), wrap);
      return box;
    };

    // ---- possible matches with the old application sheet ----
    let mt = null;
    const ANS = { experience: "Experience with sex-positive spaces", interest: "What interests them", consent: "What consent looks and feels like", referred: "Referred by" };
    const drawMatches = () => {
      const L = data.labels;
      const cand = (m, c) => appCard(m, c, [
        h("button", { type: "button", class: "btn small gold", onclick: () => linkApp(m, c) }, "✅ Yes, this is them"),
        h("button", { type: "button", class: "btn small ghost", onclick: async () => {
          try { await pb.send(`/api/vc/mod/vet-matches/${c.id}`, { method: "POST", body: { member: m.id, action: "dismiss" } }); toast("Dismissed"); load(); } catch (err) { toast(errMsg(err), true); }
        } }, "✕ Not them")]);
      holder.replaceChildren(
        h("section", { class: "panel" }, h("p", { class: "faint", style: "margin:0" },
          `Members who might match an application in the old Google Form sheet (${mt.linked} of ${mt.total} applications are linked to a profile so far). Confirming sets their status from the sheet (unless you've already given them one), adds a note, and attaches their answers to their vetting form. 🟢 a handle matches exactly · 🟡 a handle almost matches (typo, extra numbers, 0 for o) · 🟠 only the name matches. Can't find someone? Use 🔍 Find in old applications on their row in the other lists.`)),
        ...(mt.items.length ? mt.items.map(({ member: m, candidates }) => h("section", { class: "panel vm-member" },
          h("div", {},
            h("div", {}, personChip(m), h("div", { class: "faint", style: "font-size:.85rem" }, `@${m.slug}${m.tg ? " · ✈️ " + m.tg : ""} · now: ${L[m.vetting.status] || "no status"}`),
              h("div", { style: "font-size:.92rem;margin-top:2px" }, h("b", {}, candidates.length === 1 ? "1 possible application" : `${candidates.length} possible applications`)))),
          candidates.map((c) => cand(m, c))))
          : [h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, "No possible matches to review. 🌙"))]));
    };
    const load = async () => {
      try { mt = await pb.send("/api/vc/mod/vet-matches", {}); } catch (_) { mt = { items: [], total: 0, linked: 0 }; }
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
      url: h("input", { type: "url", maxlength: 300, placeholder: "https://… (optional)" }), hidden: h("input", { type: "checkbox" }), hosted: h("input", { type: "checkbox" }), volunteers: h("input", { type: "checkbox" }),
      vetting: h("select", {}, h("option", { value: "" }, "No vetting"), h("option", { value: "offered" }, "✅ You can get vetted here"), h("option", { value: "required" }, "🔒 Vetted members only")),
    };
    let editing = null;
    const title = h("h2", {}, "Add an event");
    const saveBtn = h("button", { type: "button", class: "btn gold" }, "Save event");
    const cancel = h("button", { type: "button", class: "btn ghost", style: "display:none" }, "Cancel edit");
    const fill = (ev) => {
      editing = ev ? ev.id : null;
      for (const k of Object.keys(f)) { if (k === "hidden" || k === "hosted" || k === "volunteers") f[k].checked = !!(ev && ev[k]); else f[k].value = ev ? ev[k] || "" : ""; }
      title.textContent = ev ? `Editing: ${ev.title}` : "Add an event"; cancel.style.display = ev ? "" : "none";
      if (ev) title.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    cancel.addEventListener("click", () => fill(null));
    saveBtn.addEventListener("click", async () => {
      const payload = {}; for (const k of Object.keys(f)) payload[k] = k === "hidden" || k === "hosted" || k === "volunteers" ? f[k].checked : f[k].value;
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
        h("div", {}, h("b", {}, `${ev.emoji || "📅"} ${ev.title}`), h("small", { class: "faint" }, ` · ${when(ev.starts)}${ev.where ? " · " + ev.where : ""} · ${ev.going} going${ev.interested ? ` · ${ev.interested} interested` : ""}${ev.attended ? ` · ✅ ${ev.attended} came` : ""}${ev.hosted ? " · 💜 hosted" : ""}${ev.volunteers ? " · 🙋 volunteers wanted" : ""}${ev.vetting === "offered" ? " · ✅ vetting here" : ev.vetting === "required" ? " · 🔒 vetted only" : ""}${ev.hidden ? " · hidden" : ""}`)),
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
        h("label", { class: "check" }, f.volunteers, "🙋 Open for volunteers (shows on the volunteer form, with a 🙋 Volunteer button on the event)"),
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

  // ---------- confessions: hosts, admins and owners approve or hide them. Nobody sees who wrote them. ----------
  let cbView = "pending";
  async function confessions(body) {
    const { h, pb, toast, errMsg } = deps();
    const d = await pb.send("/api/vc/mod/confessions?status=" + cbView, {});
    const HEAT = { mild: "🌸 Mild", spicy: "🌶️ Spicy", fire: "🔥 Scorching" };
    const set = async (c, status, msg) => { try { await pb.send(`/api/vc/mod/confessions/${c.id}`, { method: "POST", body: { status } }); toast(msg); confessions(body); } catch (err) { toast(errMsg(err), true); } };
    const tab = document.querySelector('.mod-tabs a[href="/admin/confessions"]');
    if (tab) { tab.querySelector(".nav-badge")?.remove(); if (d.counts.pending) tab.append(h("span", { class: "nav-badge" }, String(d.counts.pending))); }
    const VIEWS = [["pending", "⏳ To review"], ["approved", "✅ On the wall"], ["hidden", "🙈 Hidden"]];
    const row = (c) => h("div", { class: "mod-cb" },
      h("div", { class: "mod-cb-meta" }, h("b", {}, HEAT[c.heat] || c.heat), c.cw ? h("span", { class: "att-tag" }, "⚠️ " + c.cw) : null,
        h("small", { class: "faint" }, ` · sent ${when(c.created)}${c.reviewed_by && cbView !== "pending" ? ` · ${cbView === "approved" ? "approved" : "hidden"} by ${c.reviewed_by}` : ""}${cbView === "approved" ? ` · ${c.total} reaction${c.total === 1 ? "" : "s"}` : ""}`)),
      c.prompt ? h("p", { class: "faint", style: "margin:4px 0 0" }, "💭 " + c.prompt) : null,
      h("p", { class: "mod-cb-text" }, c.text),
      h("div", { class: "actions", style: "margin:6px 0 0" },
        cbView !== "approved" ? h("button", { type: "button", class: "btn small gold", onclick: () => set(c, "approved", "✅ On the wall") }, "✅ Approve") : null,
        cbView !== "hidden" ? h("button", { type: "button", class: "btn small ghost", onclick: () => set(c, "hidden", "🙈 Hidden") }, cbView === "approved" ? "🙈 Take down" : "🙈 Don't post") : null,
        cbView === "hidden" ? h("button", { type: "button", class: "btn small ghost", onclick: () => set(c, "pending", "Back in the queue") }, "↩️ Back to review") : null));
    body.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, "💌 Confession Box"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "New confessions wait here until a host approves them. Nobody, including admins, can see who wrote what. Take down anything mean, coercive or that points to a real person. Members find the box at ",
        h("a", { href: "/confessions", "data-nav": "" }, location.origin + "/confessions"), "."),
      h("div", { class: "pills" }, VIEWS.map(([k, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(cbView === k), onclick: () => { cbView = k; confessions(body); } }, `${l} (${d.counts[k]})`))),
      d.items.length ? h("div", { class: "mod-cb-list" }, d.items.map(row)) : h("p", { class: "muted" }, cbView === "pending" ? "Nothing waiting. 🌙" : "Nothing here.")));
  }

  // ---------- games: the Truth or Dare deck (hosts and up) ----------
  let todView = "pending";
  async function games(body) {
    const { h, pb, toast, errMsg, personChip } = deps();
    const [d, tp, bg, mm] = await Promise.all([pb.send("/api/vc/mod/tod?status=" + todView, {}), pb.send("/api/vc/mod/tod/players", {}).catch(() => null), pb.send("/api/vc/mod/bingo", {}).catch(() => null), pb.send("/api/vc/mod/match", {}).catch(() => null)]);
    const HEAT = [["mild", "🌸 Mild"], ["spicy", "🌶️ Spicy"], ["fire", "🔥 Scorching"]];
    const heatL = Object.fromEntries(HEAT);
    const tab = document.querySelector('.mod-tabs a[href="/admin/games"]');
    if (tab) { tab.querySelector(".nav-badge")?.remove(); if (d.counts.pending) tab.append(h("span", { class: "nav-badge" }, String(d.counts.pending))); }
    const save = async (c, patch, msg) => { try { await pb.send(`/api/vc/mod/tod/${c.id}`, { method: "POST", body: patch }); toast(msg); games(body); } catch (err) { toast(errMsg(err), true); } };
    const sel = (opts, v) => h("select", {}, opts.map(([k, l]) => h("option", { value: k, selected: k === v }, l)));
    const row = (c) => {
      const kind = sel([["truth", "💭 Truth"], ["dare", "🎯 Dare"]], c.kind), heat = sel(HEAT, c.heat);
      const text = h("textarea", { rows: 2, maxlength: 300 }, c.text);
      const edit = h("div", { class: "tod-edit", hidden: true }, h("div", { class: "row2" }, kind, heat), text,
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn small gold", onclick: () => save(c, { kind: kind.value, heat: heat.value, text: text.value }, "Saved") }, "Save")));
      return h("div", { class: "mod-cb" },
        h("div", { class: "mod-cb-meta" }, h("b", {}, (c.kind === "dare" ? "🎯 Dare" : "💭 Truth") + " · " + (heatL[c.heat] || c.heat)),
          c.author ? h("span", {}, " · idea from ", personChip(c.author)) : null,
          h("small", { class: "faint" }, ` · ${when(c.created)}${c.reviewed_by && todView !== "pending" ? " · " + c.reviewed_by : ""}`)),
        h("p", { class: "mod-cb-text" }, c.text), edit,
        h("div", { class: "actions", style: "margin:6px 0 0" },
          todView !== "approved" ? h("button", { type: "button", class: "btn small gold", onclick: () => save(c, { status: "approved", kind: kind.value, heat: heat.value, text: text.value }, "✅ In the deck") }, "✅ Add to deck") : null,
          todView === "pending" ? h("button", { type: "button", class: "btn small ghost", onclick: () => save(c, { status: "rejected" }, "Not added") }, "🙅 Not this one") : null,
          todView === "approved" ? h("button", { type: "button", class: "btn small ghost", onclick: () => save(c, { status: "retired" }, "Retired") }, "📦 Retire") : null,
          h("button", { type: "button", class: "btn small ghost", onclick: () => { edit.hidden = !edit.hidden; } }, "✏️ Edit")));
    };
    // Add a card straight into the deck.
    const nk = sel([["truth", "💭 Truth"], ["dare", "🎯 Dare"]], "truth"), nh = sel(HEAT, "mild");
    const nt = h("textarea", { rows: 2, maxlength: 300, placeholder: "Write a truth question or a dare…" });
    const addForm = h("details", { class: "tod-add" }, h("summary", {}, "➕ Add a card"),
      h("div", { class: "row2" }, nk, nh), nt,
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn small gold", onclick: async () => {
        try { await pb.send("/api/vc/mod/tod", { method: "POST", body: { kind: nk.value, heat: nh.value, text: nt.value } }); toast("Added to the deck"); games(body); } catch (err) { toast(errMsg(err), true); }
      } }, "Add")));
    // Players and their safeword passes (admins and owners only). Passes refill on their own every Monday.
    function todPlayers(tp) {
      const reset = async (id, name) => {
        if (id === "all" && !confirm("Give every player all their safeword passes back for this week?")) return;
        try { const r = await pb.send(`/api/vc/mod/tod/players/${id}/reset-passes`, { method: "POST" }); toast(id === "all" ? `🛟 Passes reset for ${r.count} players` : `🛟 ${name} has all ${tp.passes} passes again`); games(body); } catch (err) { toast(errMsg(err), true); }
      };
      const dl = new Date(tp.nextRefill + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
      return h("details", { class: "panel tod-players" }, h("summary", {}, h("b", {}, `🛟 Players & safeword passes (${tp.players.length})`)),
        h("p", { class: "faint" }, `Everyone gets ${tp.passes} passes a week. They refill on their own every Monday (next: ${dl}). Reset gives someone their passes back early. Other members never see who passed.`),
        tp.players.length ? h("div", { class: "actions" }, h("button", { type: "button", class: "btn small ghost", onclick: () => reset("all") }, "🛟 Reset everyone's passes")) : null,
        tp.players.length ? h("div", { class: "mod-cb-list" }, tp.players.map((x) => h("div", { class: "mod-cb cb-row" },
          h("span", { class: "mod-cb-meta" }, personChip(x.member), h("small", { class: "faint" }, `🛟 ${x.passesLeft}/${tp.passes} passes · 🔥 ${x.streak} day streak`)),
          h("button", { type: "button", class: "btn small ghost", disabled: x.passesLeft >= tp.passes, onclick: () => reset(x.member.id, x.member.display_name) }, "Reset passes"))))
          : h("p", { class: "muted" }, "Nobody's playing yet."));
    }
    const VIEWS = [["pending", "⏳ Member ideas"], ["approved", "🃏 In the deck"], ["rejected", "🙅 Not added"], ["retired", "📦 Retired"]];
    body.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, "🎲 Truth or Dare deck"),
      h("p", { class: "faint", style: "margin-top:-6px" }, `${d.players} member${d.players === 1 ? " is" : "s are"} playing. Members can suggest cards; they wait here until a host adds them. Cards that touch someone's limits are never dealt to them. Edit before adding if a card needs a tweak. Members play at `,
        h("a", { href: "/truthordare", "data-nav": "" }, location.origin + "/truthordare"), "."),
      addForm,
      h("div", { class: "pills" }, VIEWS.map(([k, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(todView === k), onclick: () => { todView = k; games(body); } }, `${l} (${d.counts[k]})`))),
      d.items.length ? h("div", { class: "mod-cb-list" }, d.items.map(row)) : h("p", { class: "muted" }, todView === "pending" ? "No ideas waiting. 🌙" : "Nothing here.")),
      tp ? todPlayers(tp) : "",
      bg ? h("section", { class: "panel" },
        h("h2", {}, "🔢 Kink Bingo this month"),
        h("p", { class: "faint", style: "margin-top:-6px" }, `Everyone gets a new card on the 1st, drawn from ${bg.squares} squares. Members play at `, h("a", { href: "/bingo", "data-nav": "" }, location.origin + "/bingo"), "."),
        h("div", { class: "tod-stats" },
          h("span", { class: "tod-stat" }, h("b", {}, String(bg.opened)), h("small", {}, "opened a card")),
          h("span", { class: "tod-stat" }, h("b", {}, String(bg.players)), h("small", {}, "ticked something")),
          h("span", { class: "tod-stat" }, h("b", {}, String(bg.lines)), h("small", {}, "got a line")),
          h("span", { class: "tod-stat" }, h("b", {}, String(bg.full)), h("small", {}, "blackouts"))),
        bg.top.length ? h("div", {}, h("h3", {}, "Most ticked (honour system)"), h("div", { class: "pills" }, bg.top.map((t) => h("span", { class: "att-tag" }, `${t.text} · ${t.count}`)))) : null) : "",
      mm ? h("section", { class: "panel" },
        h("h2", {}, "🎭 Mystery Match this week"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Totals only. Nobody, including admins, can see who's matched with whom. Reports from a match show up in ⚑ Reports with the Whispers ones, marked [Mystery Match]. Members play at ", h("a", { href: "/match", "data-nav": "" }, location.origin + "/match"), "."),
        h("div", { class: "tod-stats" },
          h("span", { class: "tod-stat" }, h("b", {}, String(mm.players)), h("small", {}, "playing")),
          h("span", { class: "tod-stat" }, h("b", {}, String(mm.pairs)), h("small", {}, "pairs this week")),
          h("span", { class: "tod-stat" }, h("b", {}, String(mm.talking)), h("small", {}, "pairs talking")),
          h("span", { class: "tod-stat" }, h("b", {}, String(mm.reveals || mm.lastWeekReveals)), h("small", {}, mm.reveals ? "reveals" : "reveals last week")))) : "");
  }

  // ---------- applicants from the old sheet who haven't made a profile yet (owners only) ----------
  let npView = "vetted", npQ = "";
  async function noprofile(body) {
    const { h, pb, toast, errMsg, copyText } = deps();
    const VIEWS = [["vetted", "✅ Vetted"], ["needs", "📝 Not vetted yet"], ["hold", "⏸️ On hold"], ["denied", "🚫 Denied"], ["all", "All"]];
    const search = h("input", { type: "search", placeholder: "Search by name, email, Telegram or FetLife", "aria-label": "Search applicants", value: npQ });
    const pills = h("div", { class: "pills" });
    const info = h("p", { class: "faint", style: "margin:0" });
    const list = h("div", { class: "np-list" });
    const more = h("button", { type: "button", class: "btn ghost", hidden: true }, "Show more");
    let offset = 0, d = null;
    // Their answers from the application form, in the same order as the vetting form.
    const ans = (q, v) => {
      if (q.type === "agree") return v ? "✅ Agreed to the event guidelines" : "";
      if (q.type === "yesno") return v === "yes" ? "Yes" : v === "no" ? "No" : "";
      if (q.type === "scale") return v ? `${v} / 5${v >= 5 ? " (this is my tribe)" : v <= 1 ? " (extremely uncomfortable)" : ""}` : "";
      return String(v || "");
    };
    const appDetails = (c) => {
      const rows = (d.questions || []).flatMap((q) => { const a = ans(q, (c.answers || {})[q.id]); return a ? [h("dt", {}, q.q), h("dd", {}, answerEl(h, q, a))] : []; });
      return rows.length ? h("details", { class: "vm-ans" }, h("summary", { class: "faint" }, "📋 Read their application"), h("dl", { class: "vf-answers" }, rows)) : null;
    };
    const invite = (c) => `Hi ${c.name || "there"}! 💜 Velvet Collar has member profiles now: your own page for your kinks, limits, links and photos, plus the events calendar and games. Make yours at ${location.origin}/join${d.joinCode ? " with the join code " + d.joinCode : ""}. It only takes a minute!`;
    const row = (c) => {
      return h("div", { class: "np-row" },
        h("div", { class: "np-main" },
          h("div", {}, h("b", {}, c.name || "(no name)"), h("small", { class: "faint" }, ` · applied ${dayY(c.applied)} · sheet row ${c.row}`)),
          h("div", { class: "vm-tags" },
            h("span", { class: "att-tag" }, d.labels[c.status] || c.status_raw || "No status"),
            c.status_raw && !/^(yes|emailed|denied|on hold)$/i.test(c.status_raw) ? h("span", { class: "att-tag" }, "Sheet: " + c.status_raw) : null,
            c.telegram ? handleTag(h, "tg", c.telegram) : null,
            c.fetlife ? handleTag(h, "fet", c.fetlife) : null,
            c.email ? h("span", { class: "att-tag" }, "✉️ " + c.email) : null),
          c.notes ? h("p", { class: "faint", style: "margin:4px 0 0" }, "📝 " + c.notes) : null,
          appDetails(c)),
        c.status === "denied" || c.status === "hold" ? null : h("div", { class: "actions", style: "margin:6px 0 0" },
          h("button", { type: "button", class: "btn small ghost", onclick: () => copyText(invite(c), "Invite message copied") }, "📋 Copy invite"),
          c.email ? h("a", { class: "btn small ghost", href: "mailto:" + encodeURIComponent(c.email) + "?subject=" + encodeURIComponent("Your Velvet Collar profile") + "&body=" + encodeURIComponent(invite(c)) }, "✉️ Email invite") : null));
    };
    const load = async (append) => {
      if (!append) offset = 0;
      try { d = await pb.send(`/api/vc/mod/vet-history/unlinked?status=${npView}&offset=${offset}&q=` + encodeURIComponent(npQ), {}); }
      catch (err) { list.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
      pills.replaceChildren(...VIEWS.map(([k, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(npView === k), onclick: () => { npView = k; load(); } }, `${l} (${d.counts[k]})`)));
      info.textContent = npQ ? `${d.total} found for “${npQ}”.` : `${d.total} ${npView === "all" ? "applicants" : "people"} without a profile on the site.`;
      const rows = d.items.map(row);
      if (append) list.append(...rows); else list.replaceChildren(...(rows.length ? rows : [h("p", { class: "muted", style: "margin:0" }, "Nobody here. 🌙")]));
      offset += d.items.length;
      more.hidden = offset >= d.total;
    };
    let t;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { npQ = search.value.trim(); load(); }, 300); });
    more.addEventListener("click", () => load(true));
    body.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, "📜 No profile yet"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "Everyone from the old application sheet who isn't linked to a profile on the site. When someone joins, they're matched in ✅ Vetting → 🔗 Possible matches, and once you confirm they drop off this list. Only owners see this tab."),
      pills, search, info), h("section", { class: "panel" }, list, more));
    load();
  }

  // ---------- volunteers: owners approve or decline volunteer forms ----------
  let voView = "pending";
  async function volunteers(body) {
    const { h, pb, toast, personChip, errMsg } = deps();
    const d = await pb.send("/api/vc/mod/volunteers?status=" + voView, {});
    const RL = { setup: "🧰 Setup", crew: "🎉 Party crew", breakdown: "🧹 Breakdown" };
    const ST = { pending: "⏳ To review", approved: "🎉 Approved", declined: "💜 Declined", withdrawn: "↩️ Withdrawn" };
    const VET = { vetted: "✅ Vetted", needs: "📝 Needs vetting", renew: "🔄 Needs re-vetting", hold: "⏸️ On hold", denied: "🚫 Denied" };
    const evWhen = (ev) => { const t = Date.parse(String(ev.starts || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleString("en-US", { ...PT, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
    const tab = document.querySelector('.mod-tabs a[href="/admin/volunteers"]');
    if (tab) { tab.querySelector(".nav-badge")?.remove(); if (d.counts.pending) tab.append(h("span", { class: "nav-badge" }, String(d.counts.pending))); }
    const post = async (v, b, msg) => { try { await pb.send(`/api/vc/mod/volunteers/${v.id}`, { method: "POST", body: b }); toast(msg); volunteers(body); } catch (err) { toast(errMsg(err), true); } };
    const qa = (label, text) => text ? h("div", { class: "vo-qa" }, h("small", { class: "faint" }, label), h("p", {}, text)) : null;

    const card = (v) => {
      const m = v.member;
      const offered = v.roles.indexOf("any") !== -1 ? ["setup", "crew", "breakdown"] : v.roles;
      const pick = v.role.length ? v.role : (v.roles.indexOf("any") !== -1 ? [] : v.roles);
      const boxes = Object.keys(RL).map((k) => { const cb = h("input", { type: "checkbox", value: k }); cb.checked = pick.indexOf(k) !== -1; return h("label", { class: "check" + (offered.indexOf(k) === -1 ? " faint" : "") }, cb, RL[k]); });
      const chosen = () => boxes.map((l) => l.querySelector("input")).filter((c) => c.checked).map((c) => c.value);
      const msg = h("textarea", { rows: 2, maxlength: 1000, placeholder: "Message to them (optional). They'll see it on the site, e.g. “Setup starts at 5pm, Jess will text you the address.”" }); msg.value = v.message || "";
      const note = h("input", { type: "text", maxlength: 1000, value: v.note || "", placeholder: "Private note for owners (optional)" });
      const decided = v.status === "approved" || v.status === "declined";
      return h("div", { class: "mod-cb vo-card vo-" + v.status },
        h("div", { class: "mod-cb-meta" }, m ? personChip(m) : h("i", {}, "member deleted"),
          h("b", {}, v.name), v.pronouns ? h("span", { class: "faint" }, "(" + v.pronouns + ")") : null,
          m && m.vetting ? h("span", { class: "att-tag" }, VET[m.vetting] || m.vetting) : null,
          voView === "all" ? h("span", { class: "att-tag" }, ST[v.status]) : null,
          h("small", { class: "faint" }, ` · sent ${when(v.created)}${v.reviewed_by ? ` · ${v.status} by ${v.reviewed_by}` : ""}`)),
        h("div", { class: "vo-contact" },
          h("a", { class: "btn small ghost", href: "tel:" + v.phone.replace(/[^\d+]/g, "") }, "📞 " + v.phone),
          h("a", { class: "btn small ghost", href: "sms:" + v.phone.replace(/[^\d+]/g, "") }, "💬 Text"),
          m && m.tg ? h("a", { class: "btn small ghost", href: "https://t.me/" + encodeURIComponent(m.tg), target: "_blank", rel: "noopener" }, "✈️ Telegram @" + m.tg) : null),
        h("p", { style: "margin:6px 0 0" }, h("small", { class: "faint" }, "Offered: "), v.roles.map((r) => d.roles[r] || r).join(", ")),
        qa("Why they'd like to volunteer", v.why), qa("Accessibility needs / limitations", v.access), qa("To make volunteering great for them", v.extra),
        h("small", { class: "faint" }, v.agreed ? "✓ Agreed to all the volunteer expectations" : "⚠️ Didn't agree to the expectations"),
        v.status === "withdrawn" ? h("p", { class: "faint" }, "They withdrew this form.") : h("div", { class: "vo-decide" },
          h("div", { class: "vo-roles" }, h("small", { class: "faint" }, "Their role:"), boxes),
          msg, note,
          h("div", { class: "actions", style: "margin:0" },
            v.status !== "approved" ? h("button", { type: "button", class: "btn small gold", onclick: () => { const r = chosen(); if (!r.length) return toast("Tick the role they'll do first.", true); post(v, { status: "approved", role: r, message: msg.value, note: note.value }, "🎉 Approved. They'll see it next time they open the site."); } }, "🎉 Approve") : null,
            v.status !== "declined" ? h("button", { type: "button", class: "btn small ghost", onclick: () => post(v, { status: "declined", message: msg.value, note: note.value }, "💜 Declined. They'll see it next time they open the site.") }, "💜 Not this time") : null,
            decided ? h("button", { type: "button", class: "btn small ghost", onclick: () => post(v, { role: chosen(), message: msg.value, note: note.value }, "Saved") }, "💾 Save changes") : null,
            decided ? h("button", { type: "button", class: "btn small ghost", onclick: () => post(v, { status: "pending" }, "Back to review") }, "↩️ Back to review") : null)));
    };

    // Group by event, soonest first ("any event" last).
    const groups = {};
    for (const v of d.items) { const k = v.event ? v.event.id : "any"; (groups[k] = groups[k] || { ev: v.event, list: [] }).list.push(v); }
    const keys = Object.keys(groups).sort((a, b) => a === "any" ? 1 : b === "any" ? -1 : (groups[a].ev.starts < groups[b].ev.starts ? -1 : 1));
    const crew = (list) => { const c = {}; list.filter((v) => v.status === "approved").forEach((v) => v.role.forEach((r) => { c[r] = (c[r] || 0) + 1; })); return Object.keys(RL).filter((r) => c[r]).map((r) => `${RL[r]} ${c[r]}`).join(" · "); };
    const VIEWS = ["pending", "approved", "declined", "withdrawn"];
    const total = VIEWS.reduce((n, k) => n + d.counts[k], 0);
    body.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, "🙋 Volunteers"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "Volunteer forms members send from ", h("a", { href: "/volunteer", "data-nav": "" }, location.origin + "/volunteer"), " (or 🙋 Volunteer on a Velvet Collar event). Pick their role and approve, or let them know it's not this time. They see your answer and message the next time they open the site, and approved volunteers see a 🙋 tag on the event. Only owners see this tab and their phone numbers."),
      h("div", { class: "pills" }, VIEWS.map((k) => h("button", { type: "button", class: "pill", "aria-pressed": String(voView === k), onclick: () => { voView = k; volunteers(body); } }, `${ST[k]} (${d.counts[k]})`)),
        h("button", { type: "button", class: "pill", "aria-pressed": String(voView === "all"), onclick: () => { voView = "all"; volunteers(body); } }, `All (${total})`)),
      d.items.length ? keys.map((k) => { const g = groups[k]; const c = crew(g.list); return h("div", { class: "vo-group" },
        h("h3", {}, g.ev ? `${g.ev.emoji || "📅"} ${g.ev.title}` : "✨ Any upcoming event", h("small", { class: "faint" }, g.ev ? " · " + evWhen(g.ev) + " PT" : ""), c ? h("span", { class: "att-tag" }, "Crew: " + c) : null),
        h("div", { class: "mod-cb-list" }, g.list.map(card))); })
        : h("p", { class: "muted" }, voView === "pending" ? "No volunteer forms waiting. 🌙" : "Nothing here.")));
  }

  // ---------- feedback: ideas, bugs and love notes from members ----------
  let fbView = "new";
  async function feedback(body) {
    const { h, pb, toast, personChip, errMsg } = deps();
    const d = await pb.send("/api/vc/mod/feedback?status=" + fbView, {});
    const KIND = { idea: "💡 Idea", bug: "🐞 Something's broken", love: "💜 Love note", other: "💬 Other" };
    const STATUS = { new: "🆕 New", planned: "🛠️ Planned", done: "✅ Done", declined: "🚫 Not doing" };
    const post = async (f, b, msg) => { try { await pb.send(`/api/vc/mod/feedback/${f.id}`, { method: "POST", body: b }); toast(msg); feedback(body); } catch (err) { toast(errMsg(err), true); } };
    const tab = document.querySelector('.mod-tabs a[href="/admin/feedback"]');
    if (tab) { tab.querySelector(".nav-badge")?.remove(); if (d.counts.new) tab.append(h("span", { class: "nav-badge" }, String(d.counts.new))); }
    const VIEWS = [["new", "🆕 New"], ["planned", "🛠️ Planned"], ["done", "✅ Done"], ["declined", "🚫 Not doing"], ["all", "All"]];
    const total = d.counts.new + d.counts.planned + d.counts.done + d.counts.declined;
    const row = (f) => {
      const note = h("input", { type: "text", maxlength: 500, value: f.reply || "", placeholder: "Private note for the admins (optional)", "aria-label": "Admin note" });
      return h("div", { class: "mod-cb fb-item fb-" + f.kind },
        h("div", { class: "mod-cb-meta" }, h("b", {}, KIND[f.kind] || f.kind), fbView === "all" ? h("span", { class: "att-tag" }, STATUS[f.status]) : null,
          h("small", { class: "faint" }, " · from "), f.member ? personChip(f.member) : h("i", { class: "faint" }, "Anonymous"),
          h("small", { class: "faint" }, ` · ${when(f.created)}${f.page ? " · on " + f.page : ""}${f.handled_by ? " · last touched by " + f.handled_by : ""}`)),
        h("p", { class: "mod-cb-text" }, f.text),
        h("div", { class: "fb-note" }, note, h("button", { type: "button", class: "btn small ghost", onclick: () => post(f, { reply: note.value }, "Note saved") }, "Save note")),
        h("div", { class: "actions", style: "margin:6px 0 0" },
          f.backlog ? h("a", { class: "att-tag", href: "/admin/backlog", "data-nav": "" }, f.backlog === "done" ? "📋 Done on the backlog" : "📋 On the backlog")
            : h("button", { type: "button", class: "btn small gold", onclick: async () => { try { await pb.send("/api/vc/mod/backlog", { method: "POST", body: { feedback: f.id } }); toast("📋 Added to the backlog"); feedback(body); } catch (err) { toast(errMsg(err), true); } } }, "📋 Add to backlog"),
          ["planned", "done", "declined", "new"].filter((s) => s !== f.status).map((s) => h("button", { type: "button", class: "btn small " + "ghost", onclick: () => post(f, { status: s }, STATUS[s]) }, s === "new" ? "↩️ Back to new" : STATUS[s])),
          h("button", { type: "button", class: "btn small danger", onclick: () => confirm("Delete this feedback for good?") && post(f, { remove: true }, "Deleted") }, "🗑️ Delete")));
    };
    body.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, "💡 Feedback"),
      h("p", { class: "faint", style: "margin-top:-6px" }, `Ideas, bugs and love notes members send with the 💡 Feedback button (bottom corner of every page, and the footer). ${total} so far. Move each one to Planned, Done or Not doing to keep track. Anonymous ones can't be traced back to anyone.`),
      h("div", { class: "pills" }, VIEWS.map(([k, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(fbView === k), onclick: () => { fbView = k; feedback(body); } }, k === "all" ? `${l} (${total})` : `${l} (${d.counts[k]})`))),
      d.items.length ? h("div", { class: "mod-cb-list" }, d.items.map(row)) : h("p", { class: "muted" }, fbView === "new" ? "Nothing new. 🌙" : "Nothing here.")));
  }

  // ---------- backlog: what the admins plan to build or fix ----------
  let blView = "open";
  async function backlog(body) {
    const { h, pb, toast, personChip, errMsg } = deps();
    const d = await pb.send("/api/vc/mod/backlog?status=" + blView, {});
    const PRIO = { high: "🔥 High", normal: "Normal", low: "🐢 Low" };
    const KIND = { idea: "💡", bug: "🐞", love: "💜", other: "💬" };
    const post = async (it, b, msg) => { try { await pb.send(`/api/vc/mod/backlog/${it.id}`, { method: "POST", body: b }); if (msg) toast(msg); backlog(body); } catch (err) { toast(errMsg(err), true); } };
    const prioSel = (v, onchange) => { const sel = h("select", { "aria-label": "Priority", onchange }, Object.keys(PRIO).map((k) => h("option", { value: k }, PRIO[k] === "Normal" ? "Normal priority" : PRIO[k]))); sel.value = v; return sel; };

    // Add form
    const tIn = h("input", { type: "text", maxlength: 140, placeholder: "What should we build or fix?", "aria-label": "Title" });
    const nIn = h("textarea", { rows: 2, maxlength: 3000, placeholder: "Notes (optional)", "aria-label": "Notes" });
    const pIn = prioSel("normal");
    const add = h("form", { class: "bl-add" }, tIn, nIn, h("div", { class: "bl-add-row" }, pIn, h("button", { type: "submit", class: "btn gold" }, "➕ Add to backlog")));
    add.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (tIn.value.trim().length < 2) { toast("Give it a short title.", true); return tIn.focus(); }
      try { await pb.send("/api/vc/mod/backlog", { method: "POST", body: { title: tIn.value, notes: nIn.value, priority: pIn.value } }); toast("📋 Added"); blView = "open"; backlog(body); } catch (err) { toast(errMsg(err), true); }
    });

    const row = (it) => {
      const done = it.status === "done";
      const tick = h("input", { type: "checkbox", checked: done, "aria-label": done ? "Mark as not done" : "Mark as done", onchange: () => post(it, { status: done ? "todo" : "done" }, done ? "Back on the list" : "✅ Done! Nice work.") });
      const view = h("div", { class: "bl-body" },
        h("div", { class: "bl-title" }, h("b", {}, it.title),
          it.status === "doing" ? h("span", { class: "att-tag bl-doing" }, "🔨 In progress") : null,
          it.priority !== "normal" && !done ? h("span", { class: "att-tag bl-" + it.priority }, PRIO[it.priority]) : null),
        it.notes ? h("p", { class: "bl-notes" }, it.notes) : null,
        it.feedback ? h("div", { class: "bl-fb" }, h("small", { class: "faint" }, `${KIND[it.feedback.kind] || "💬"} From feedback by `),
          it.feedback.member ? personChip(it.feedback.member) : h("i", { class: "faint" }, "Anonymous"),
          it.feedback.text !== it.title && it.feedback.text !== it.notes ? h("p", { class: "faint bl-quote" }, "“" + it.feedback.text + "”") : null) : null,
        h("small", { class: "faint" }, `Added by ${it.added_by || "?"} · ${when(it.created)}${done && it.done_at ? ` · done by ${it.done_by} · ${when(it.done_at)}` : ""}`));
      const box = h("div", { class: "bl-item" + (done ? " done" : "") }, h("label", { class: "bl-tick" }, tick), view);
      const edit = () => {
        const t = h("input", { type: "text", maxlength: 140, value: it.title, "aria-label": "Title" });
        const n = h("textarea", { rows: 3, maxlength: 3000, "aria-label": "Notes" }); n.value = it.notes || "";
        box.replaceChildren(h("label", { class: "bl-tick" }, tick), h("div", { class: "bl-body" }, t, n,
          h("div", { class: "actions", style: "margin:0" },
            h("button", { type: "button", class: "btn small gold", onclick: () => post(it, { title: t.value, notes: n.value }, "Saved") }, "Save"),
            h("button", { type: "button", class: "btn small ghost", onclick: () => backlog(body) }, "Cancel"))));
        t.focus();
      };
      view.append(h("div", { class: "actions", style: "margin:4px 0 0" },
        !done ? h("button", { type: "button", class: "btn small ghost", onclick: () => post(it, { status: it.status === "doing" ? "todo" : "doing" }) }, it.status === "doing" ? "⏸️ Pause" : "🔨 Start") : null,
        !done ? prioSel(it.priority, (e) => post(it, { priority: e.target.value })) : null,
        h("button", { type: "button", class: "btn small ghost", onclick: edit }, "✏️ Edit"),
        h("button", { type: "button", class: "btn small danger", onclick: () => confirm(`Delete “${it.title}” from the backlog?`) && post(it, { remove: true }, "Deleted") }, "🗑️")));
      return box;
    };
    const VIEWS = [["open", `📋 To do (${d.counts.open})`], ["done", `✅ Done (${d.counts.done})`], ["all", `All (${d.counts.open + d.counts.done})`]];
    body.replaceChildren(h("section", { class: "panel" },
      h("h2", {}, "📋 Backlog"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "Everything we plan to build or fix. Add your own here, or tap “📋 Add to backlog” on any ", h("a", { href: "/admin/feedback", "data-nav": "" }, "feedback"), ". Tick an item when it's done; feedback it came from is marked done too."),
      add,
      h("div", { class: "pills" }, VIEWS.map(([k, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(blView === k), onclick: () => { blView = k; backlog(body); } }, l))),
      d.items.length ? h("div", { class: "bl-list" }, d.items.map(row)) : h("p", { class: "muted" }, blView === "done" ? "Nothing finished yet." : "All clear! 🎉")));
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
      h("a", { href: pb.files.getURL(it, it.image), target: "_blank", rel: "noopener" }, /\.(mp4|mov|webm|m4v)$/i.test(it.image)
        ? h("video", { src: pb.files.getURL(it, it.image) + "#t=0.5", preload: "metadata", muted: true, class: it.nsfw ? "nsfw" : "", title: "Video: open to play" })
        : h("img", { src: pb.files.getURL(it, it.image, { thumb: "240x240" }), alt: it.caption || "Photo", loading: "lazy", class: it.nsfw ? "nsfw" : "" })),
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
  const PAGE_LABEL = { members: "👥 Member list", profile: "🪪 Profiles", playroom: "🎲 Playroom", events: "📅 Events", hunt: "🏹 The Hunt", whispers: "🤫 Whispers", confessions: "💌 Confession Box", truthordare: "🎲 Truth or Dare", bingo: "🔢 Kink Bingo", match: "🎭 Mystery Match", network: "🤝 Networking", volunteer: "🙋 Volunteer form",
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
