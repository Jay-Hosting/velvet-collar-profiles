/* Mystery Match, built into the site. Every Monday you're paired with someone who shares your kinks, romance or hobbies.
   You chat all week under aliases. On Sunday you can each choose to reveal; names show only if you both say yes.
   Uses helpers app.js shares on window.VCMatch.deps. */
(() => {
  "use strict";
  const deps = () => window.VCMatch.deps;
  const REALMS = [["kink", "⛓️", "Kinks"], ["romance", "💞", "Romance"], ["hobby", "🎨", "Hobbies"]];
  const dayLabel = (key) => new Date(key + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const short = (key) => new Date(key + "T12:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const daysTo = (from, to) => Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86400000);
  const time = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? "" : new Date(t).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }); };
  let polls = [];
  const stopPolls = () => { polls.forEach(clearInterval); polls = []; };

  async function render(app) {
    const { h, pb, toast, errMsg, personChip } = deps();
    document.title = "Mystery Match · Velvet Collar";
    stopPolls();
    let d = await pb.send("/api/vc/match", {});
    const root = h("div", { class: "mm" });
    const settings = async (body, msg) => { try { await pb.send("/api/vc/match/settings", { method: "POST", body }); if (msg) toast(msg); d = await pb.send("/api/vc/match", {}); draw(); } catch (err) { toast(errMsg(err), true); } };

    function realmPicker(cur, onChange) {
      const sel = new Set(cur);
      const box = h("div", { class: "pills", role: "group", "aria-label": "Match me on" });
      const drawR = () => box.replaceChildren(...REALMS.map(([k, e, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(sel.has(k)), onclick: () => {
        if (sel.has(k) && sel.size === 1) return toast("Keep at least one.", true);
        sel.has(k) ? sel.delete(k) : sel.add(k); drawR(); if (onChange) onChange([...sel]);
      } }, `${e} ${l}`)));
      drawR();
      box.value = () => [...sel];
      return box;
    }

    function joinPanel() {
      const pick = realmPicker(d.player.realms);
      return h("section", { class: "panel mm-join" },
        h("div", { class: "mm-masks", "aria-hidden": "true" }, "🎭"),
        h("h2", {}, "Meet someone, mysteriously"),
        h("p", { class: "muted" }, "Every Monday you're paired with a member who shares your interests. You chat all week under secret aliases, with a few clues about what you have in common. On Sunday you can each choose to reveal. Names only show if you both say yes."),
        h("span", { class: "label" }, "Match me on"), pick,
        h("ul", { class: "mm-rules" },
          h("li", {}, "🤫 No names, handles, links or phone numbers until you've both revealed."),
          h("li", {}, "🚪 You can end a match any time, block them from future weeks, or report it."),
          h("li", {}, "💜 A reveal is a hello, not a promise. No one owes anyone a date or a scene.")),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn gold", onclick: () => settings({ opt: true, realms: pick.value() }, "🎭 You're in! Your first match is on its way.") }, "🎭 I'm in")),
        h("p", { class: "faint" }, `${d.players} member${d.players === 1 ? " is" : "s are"} playing.`));
    }

    function clues(p) {
      return p.clues.length ? h("div", { class: "mm-clues" }, h("small", { class: "faint" }, "You both:"), ...p.clues.map((c) => h("span", { class: "att-tag" }, c)))
        : h("p", { class: "faint", style: "margin:0" }, "🃏 A wildcard match: nothing obvious in common. Find out what is!");
    }

    function revealBox(p, refresh) {
      if (p.revealed) return h("div", { class: "mm-reveal done" }, h("b", {}, "🎉 It's a reveal! "), p.who ? personChip(p.who) : h("i", {}, "(their profile is hidden)"),
        h("p", { class: "faint", style: "margin:6px 0 0" }, `${p.them} was ${p.who ? p.who.display_name : "a member"} all along. Say hi on their profile.`));
      if (p.status !== "active") return "";
      if (!p.revealOpen) {
        const n = daysTo(d.today, p.revealDay);
        return h("div", { class: "mm-reveal" }, `🗓️ The reveal opens ${n <= 1 ? "tomorrow" : "on " + dayLabel(p.revealDay)}${n > 1 ? ` (${n} days)` : ""}.`);
      }
      const set = async (yes) => { try { const r = await pb.send(`/api/vc/match/${p.id}/reveal`, { method: "POST", body: { yes } }); Object.assign(p, r.pair); refresh(); if (r.pair.revealed) toast("🎉 You both said yes!"); } catch (err) { toast(errMsg(err), true); } };
      return h("div", { class: "mm-reveal open" },
        h("b", {}, "🎭 Reveal day! Want to know who they are?"),
        h("p", { class: "faint", style: "margin:4px 0 8px" }, p.iRevealed ? "You said yes. If they say yes too, you'll both see each other's names. They won't see your answer unless they say yes." : "Names only show if you both say yes. Nobody finds out if one of you says no."),
        h("div", { class: "actions", style: "margin:0" },
          p.iRevealed ? h("button", { type: "button", class: "btn small ghost", onclick: () => set(false) }, "Changed my mind")
            : h("button", { type: "button", class: "btn gold", onclick: () => set(true) }, "💜 Yes, reveal me")));
    }

    function chatPanel(p, readOnly) {
      const list = h("div", { class: "mm-msgs", role: "log", "aria-live": "polite" });
      const box = h("section", { class: "panel mm-chat" });
      let msgs = [];
      const drawMsgs = () => {
        const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
        list.replaceChildren(...(msgs.length ? msgs.map((m) => h("div", { class: "mm-msg" + (m.mine ? " mine" : "") }, h("p", {}, m.text), h("small", {}, time(m.at))))
          : [h("p", { class: "faint mm-empty" }, readOnly ? "No messages." : `Break the ice! ${p.them} is waiting to hear from you.`)]));
        if (stick) list.scrollTop = list.scrollHeight;
      };
      const load = async () => {
        try { const r = await pb.send(`/api/vc/match/${p.id}`, { requestKey: null }); const changed = r.messages.length !== msgs.length; msgs = r.messages; const was = p.revealed; Object.assign(p, r.pair); if (changed) drawMsgs(); if (p.revealed !== was) draw(); }
        catch (err) { stopPolls(); }
      };
      const input = h("textarea", { rows: 2, maxlength: 500, placeholder: `Message ${p.them}…`, "aria-label": "Message" });
      const send = h("button", { type: "button", class: "btn gold" }, "Send");
      const go = async () => {
        const t = input.value.trim(); if (!t) return;
        send.disabled = true;
        try { const m = await pb.send(`/api/vc/match/${p.id}/send`, { method: "POST", body: { text: t } }); msgs.push(m); input.value = ""; drawMsgs(); list.scrollTop = list.scrollHeight; }
        catch (err) { toast(errMsg(err), true); }
        send.disabled = false; input.focus();
      };
      send.addEventListener("click", go);
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); go(); } });
      const menu = h("details", { class: "mm-menu" }, h("summary", { class: "btn small ghost" }, "⋯"),
        h("div", { class: "mm-menu-box" },
          h("button", { type: "button", class: "btn small ghost", onclick: () => end(false) }, "👋 End this match"),
          h("button", { type: "button", class: "btn small ghost", onclick: () => end(true) }, "🚫 End and never match us again"),
          h("button", { type: "button", class: "btn small danger", onclick: report }, "⚑ Report")));
      async function end(block) {
        if (!confirm(block ? "End the match and make sure you're never paired again?" : "End this match? You'll get a new one on Monday.")) return;
        try { await pb.send(`/api/vc/match/${p.id}/end`, { method: "POST", body: { block } }); toast("Match ended."); d = await pb.send("/api/vc/match", {}); draw(); } catch (err) { toast(errMsg(err), true); }
      }
      async function report() {
        const why = prompt("What happened? The admins will see your last messages with them. The match ends and you won't be paired again.");
        if (why === null) return;
        try { await pb.send(`/api/vc/match/${p.id}/report`, { method: "POST", body: { reason: why } }); toast("Thank you. The admins will take a look."); d = await pb.send("/api/vc/match", {}); draw(); } catch (err) { toast(errMsg(err), true); }
      }
      box.append(
        h("div", { class: "mm-head" },
          h("div", { class: "mm-who" }, h("span", { class: "mm-avatar", "aria-hidden": "true" }, "🎭"),
            h("div", {}, h("b", {}, p.revealed && p.who ? `${p.them} · ${p.who.display_name}` : p.them), h("small", { class: "faint" }, `You're ${p.me}`))),
          p.status === "active" && !readOnly ? menu : ""),
        clues(p), revealBox(p, () => draw()), list,
        readOnly || p.status !== "active" ? h("p", { class: "faint" }, p.status !== "active" ? (p.endedByMe ? "You ended this match." : "This match has ended.") : "This week is over, so the chat is closed.")
          : h("div", { class: "mm-send" }, input, send));
      load().then(() => { drawMsgs(); list.scrollTop = list.scrollHeight; });
      if (!readOnly && p.status === "active") { const t = setInterval(() => { if (!document.body.contains(list)) { clearInterval(t); return; } if (document.visibilityState === "visible") load(); }, 8000); polls.push(t); }
      return box;
    }

    function pastPanel() {
      const list = (d.past || []).filter((p) => !d.lastWeek || p.id !== d.lastWeek.id);
      if (!list.length) return "";
      return h("details", { class: "panel cb-mine" }, h("summary", {}, h("b", {}, `🗂️ Past matches (${list.length})`)),
        h("div", { class: "cb-mine-list" }, list.map((p) => h("div", { class: "cb-mine-item cb-row" },
          h("span", {}, h("b", {}, p.them), h("small", { class: "faint" }, ` · week of ${short(p.week)}`)),
          p.revealed && p.who ? personChip(p.who) : h("small", { class: "faint" }, "🎭 Stayed a mystery")))));
    }

    function settingsPanel() {
      return h("details", { class: "panel mm-settings" }, h("summary", {}, h("b", {}, "⚙️ Match settings")),
        h("span", { class: "label" }, "Match me on"), realmPicker(d.player.realms, (r) => settings({ realms: r }, "Saved. It counts from next Monday.")),
        h("p", { class: "faint" }, "Clues come from your profile: your Into list, Kink Jars and Romantic Jars shelves, hobbies and Networking circles. Anything on either person's limits never shows up."),
        h("button", { type: "button", class: "linkish", onclick: () => { if (confirm("Stop playing? Your current match stays open until Sunday, but you won't get new ones.")) settings({ opt: false }, "You've stepped out. Come back any time."); } }, "Stop playing"));
    }

    function draw() {
      stopPolls();
      const head = h("section", { class: "playroom-head" }, h("h1", {}, "🎭 Mystery Match"),
        h("p", { class: "muted" }, `A new anonymous match every Monday. Reveal on Sunday, if you both say yes.`));
      if (!d.player.opt && !d.current) { root.replaceChildren(head, joinPanel(), pastPanel()); return; }
      const parts = [head];
      if (d.current) parts.push(chatPanel(d.current, false));
      else parts.push(h("section", { class: "panel mm-wait" }, h("div", { class: "mm-masks", "aria-hidden": "true" }, "⏳"), h("h2", {}, "You're in the pool"),
        h("p", { class: "muted" }, d.players < 2 ? "You're the first one here! As soon as someone else joins, you'll be matched." : "Everyone's paired up for this week, so you'll be matched as soon as someone new joins, or on Monday at the latest.")));
      if (d.lastWeek) parts.push(h("h2", { class: "mm-sub" }, "Last week's match"), chatPanel(d.lastWeek, !d.lastWeek.revealed));
      parts.push(pastPanel(), d.player.opt ? settingsPanel() : h("p", { class: "faint", style: "text-align:center" }, h("button", { type: "button", class: "linkish", onclick: () => settings({ opt: true }, "🎭 Welcome back!") }, "Start playing again")));
      root.replaceChildren(...parts);
    }
    draw();
    app.replaceChildren(root);
  }

  window.VCMatch = { render };
})();
