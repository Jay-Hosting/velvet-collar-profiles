/* Hot Seat, built into the site. Players pick a question from the deck and send it to another player's inbox.
   Answers sit on the wall for a week, then move to the archive. A question that's been answered isn't asked again.
   Uses helpers app.js shares on window.VCHotSeat.deps. */
(() => {
  "use strict";
  const deps = () => window.VCHotSeat.deps;
  const ago = (d) => {
    const t = Date.parse(String(d || "").replace(" ", "T")); if (isNaN(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago";
    const dd = Math.round(s / 86400); return dd < 7 ? dd + "d ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const REPORT = [["harassment", "😣 It's harassing or unwanted"], ["consent", "🙅 It shares something about someone without their OK"], ["guidelines", "📜 It breaks the community guidelines"], ["other", "💬 Something else"]];
  let view = "play", archive = { page: 1, q: "" };

  async function render(app) {
    const { h, pb, toast, errMsg, personChip } = deps();
    document.title = "Hot Seat · Velvet Collar";
    view = "play";
    let d = await pb.send("/api/vc/hotseat", {});
    const root = h("div", { class: "hs" });
    const reload = async () => { d = await pb.send("/api/vc/hotseat", {}); draw(); };
    const act = async (path, body, msg) => { try { await pb.send(path, { method: "POST", body: body || {} }); if (msg) toast(msg); await reload(); } catch (err) { toast(errMsg(err), true); } };
    const who = (p) => (p ? personChip(p) : h("span", { class: "hs-anon" }, "🎭 Someone"));

    function report(a) {
      let reason = "";
      const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "hs_rep" });
      const close = () => modal.remove();
      modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
      const note = h("textarea", { rows: 2, maxlength: 500, placeholder: "Anything the admins should know (optional)" });
      modal.append(h("div", { class: "modal-box" },
        h("div", { class: "toggle-row" }, h("h2", { id: "hs_rep", style: "margin:0" }, "⚑ Report this"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
        h("p", { class: "muted", style: "margin:0" }, "Reports go to the admins. Nobody else is told who sent it."),
        h("div", { class: "vf-opts" }, REPORT.map(([k, l]) => h("label", { class: "check" }, h("input", { type: "radio", name: "hs_r", onchange: () => { reason = k; } }), l))),
        note,
        h("div", { class: "actions", style: "margin:0" }, h("button", { type: "button", class: "btn gold", onclick: async () => {
          if (!reason) return toast("Pick a reason.", true);
          try { const r = await pb.send(`/api/vc/hotseat/asks/${a.id}/report`, { method: "POST", body: { reason, note: note.value } }); close(); toast(r.hidden ? "Thank you. It's hidden until an admin looks." : "Thank you. The admins will take a look."); await reload(); }
          catch (err) { toast(errMsg(err), true); }
        } }, "⚑ Send report"))));
      document.body.append(modal);
    }

    // ---- joining ----
    function joinPanel() {
      return h("section", { class: "panel hs-join" },
        h("div", { class: "hs-chair", "aria-hidden": "true" }, "🔥"),
        h("h2", {}, "Want to play?"),
        h("p", { class: "muted" }, "Players send each other spicy, silly and sweet questions. Answer the ones that land in your inbox, pass on the rest, and read everyone's answers on the wall."),
        h("ul", { class: "mm-rules" },
          h("li", {}, "🙋 Only players can ask, answer or read."),
          h("li", {}, "🛟 Pass on anything, no questions asked. Nobody sees that you passed except the person who asked."),
          h("li", {}, "🎭 Ask with your name or anonymously."),
          h("li", {}, "🔒 What's said in the hot seat stays in the group.")),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn gold", onclick: () => act("/api/vc/hotseat/settings", { opt: true }, "🔥 You're in!") }, "🔥 I'm in")),
        h("p", { class: "faint" }, `${d.players} member${d.players === 1 ? " is" : "s are"} playing.`));
    }

    // ---- your inbox ----
    function inboxPanel() {
      if (!d.inbox.length) return h("section", { class: "panel hs-inbox empty" }, h("h2", {}, "📥 Your inbox"), h("p", { class: "muted", style: "margin:0" }, "Nobody's put you in the hot seat yet. Send someone a question and maybe they'll return the favour."));
      return h("section", { class: "panel hs-inbox" }, h("h2", {}, `📥 You're in the hot seat (${d.inbox.length})`),
        ...d.inbox.map((a) => {
          const text = h("textarea", { rows: 3, maxlength: 2000, placeholder: "Your answer…", "aria-label": "Your answer" });
          return h("article", { class: "hs-q incoming" },
            h("p", { class: "hs-from" }, a.from ? ["From ", personChip(a.from)] : "From 🎭 someone anonymous", h("small", { class: "faint" }, " · " + ago(a.created))),
            h("p", { class: "hs-question" }, a.question),
            text,
            h("div", { class: "actions" },
              h("button", { type: "button", class: "btn gold", onclick: () => { if (text.value.trim().length < 2) return toast("Write your answer first.", true); act(`/api/vc/hotseat/asks/${a.id}/answer`, { answer: text.value.trim() }, "🔥 Answered! It's on the wall."); } }, "Answer"),
              h("button", { type: "button", class: "btn ghost", onclick: () => act(`/api/vc/hotseat/asks/${a.id}/pass`, {}, "🛟 Passed. No questions asked.") }, "🛟 Pass"),
              h("button", { type: "button", class: "btn small ghost hs-flag", title: "Report", "aria-label": "Report this question", onclick: () => report(a) }, "⚑")),
            h("small", { class: "faint" }, `Unanswered questions go back on deck after ${d.rules.expireDays} days.`));
        }));
    }

    // ---- ask someone ----
    let picked = "";
    function askPanel() {
      const box = h("section", { class: "panel hs-ask" });
      const sentWaiting = d.sent.filter((a) => a.status === "pending").length;
      const people = d.roster;
      const drawAsk = () => {
        box.replaceChildren(...[
          h("h2", {}, "🎯 Put someone in the hot seat"),
          h("p", { class: "faint", style: "margin-top:-6px" }, `Tap a question, pick a player, send. Each question can only be answered once, so grab the good ones. ${d.deck.length} on deck right now.`),
          !people.length ? h("p", { class: "muted" }, "You're the only player so far. Invite someone to join!") : null,
          sentWaiting >= d.rules.maxSent ? h("p", { class: "muted" }, `You have ${sentWaiting} questions waiting on answers. You can send more once they're answered or passed.`) : null,
          h("div", { class: "hs-deck" }, d.deck.map((q) => {
            const open = picked === q.id;
            const card = h("div", { class: "hs-card" + (open ? " open" : "") });
            const pick = h("button", { type: "button", class: "hs-card-q", "aria-expanded": String(open), onclick: () => { picked = open ? "" : q.id; drawAsk(); } }, q.text);
            card.append(pick);
            if (open && people.length) {
              const sel = h("select", { "aria-label": "Who should answer?" }, h("option", { value: "" }, "Who's in the hot seat?"),
                people.map((p) => h("option", { value: p.id, disabled: p.inbox >= d.rules.maxInbox }, p.display_name + (p.inbox >= d.rules.maxInbox ? " (inbox full)" : ""))));
              const anon = h("input", { type: "checkbox" });
              card.append(h("div", { class: "hs-send" }, sel,
                h("label", { class: "check" }, anon, " 🎭 Ask anonymously"),
                h("button", { type: "button", class: "btn gold", onclick: async () => {
                  if (!sel.value) return toast("Pick who should answer.", true);
                  const name = people.find((p) => p.id === sel.value).display_name;
                  picked = "";
                  await act("/api/vc/hotseat/ask", { question: q.id, to: sel.value, anon: anon.checked }, `🔥 Sent to ${name}!`);
                } }, "Send")));
            }
            return card;
          }))].filter(Boolean));
      };
      drawAsk();
      return box;
    }

    // ---- the wall ----
    function answerCard(a, onChange) {
      const fire = h("button", { type: "button", class: "cb-rx" + (a.fired ? " on" : ""), "aria-pressed": String(!!a.fired), disabled: a.toMe, title: a.toMe ? "Yours" : "🔥 Hot", "aria-label": `Fire: ${a.fire}` },
        h("span", { "aria-hidden": "true" }, "🔥"), a.fire ? h("b", {}, String(a.fire)) : null);
      fire.addEventListener("click", async () => { try { Object.assign(a, await pb.send(`/api/vc/hotseat/asks/${a.id}/react`, { method: "POST" })); onChange(); } catch (err) { toast(errMsg(err), true); } });
      return h("article", { class: "hs-post" + (a.toMe ? " mine" : "") },
        h("div", { class: "hs-post-head" }, h("span", { class: "hs-seat" }, "🔥 ", a.to ? personChip(a.to) : "A member"), h("small", { class: "faint" }, ago(a.answered_at)),
          a.toMe ? null : h("button", { type: "button", class: "btn small ghost hs-flag", title: "Report", "aria-label": "Report this answer", onclick: () => report(a) }, "⚑")),
        h("p", { class: "hs-post-q" }, a.question),
        h("p", { class: "hs-post-a" }, a.answer),
        h("div", { class: "hs-post-foot" },
          h("small", { class: "faint" }, "Asked by ", a.from ? (a.fromMe ? "you" : a.from.display_name) : "🎭 someone"),
          a.flagged ? h("small", { class: "faint" }, " · 🔒 hidden while an admin reviews a report") : null,
          h("span", { class: "hs-post-act" }, fire,
            a.toMe ? h("button", { type: "button", class: "linkish", onclick: () => { if (confirm("Take your answer off the wall and out of the archive?")) act(`/api/vc/hotseat/asks/${a.id}/hide`, { hidden: true }, "Removed"); } }, "Remove") : null)));
    }
    function wallPanel() {
      const box = h("section", { class: "hs-wall-sec" });
      const drawW = () => box.replaceChildren(
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "📣 The wall"),
          h("button", { type: "button", class: "btn small ghost", onclick: () => { view = "archive"; archive = { page: 1, q: "" }; draw(); window.scrollTo(0, 0); } }, `🗂️ Archive (${d.archived})`)),
        h("p", { class: "faint", style: "margin:0" }, `Answers from the last ${d.rules.wallDays} days. After that they move to the archive.`),
        d.wall.length ? h("div", { class: "hs-wall" }, d.wall.map((a) => answerCard(a, drawW))) : h("p", { class: "muted" }, "No answers yet this week. Be the first to send a question!"));
      drawW();
      return box;
    }

    // ---- what you've sent ----
    function sentPanel() {
      if (!d.sent.length) return "";
      const ST = { pending: "⏳ Waiting", answered: "✅ Answered", passed: "🛟 Passed", expired: "⌛ Not answered in time" };
      return h("details", { class: "panel cb-mine" }, h("summary", {}, h("b", {}, `📤 Questions you've sent (${d.sent.length})`)),
        h("div", { class: "cb-mine-list" }, d.sent.map((a) => h("div", { class: "cb-mine-item" },
          h("p", {}, a.question),
          h("div", { class: "cb-row" }, h("small", {}, "To ", a.to ? a.to.display_name : "a member", a.anon ? " · 🎭 anonymously" : "", " · ", ST[a.status] || a.status),
            a.status === "pending" ? h("button", { type: "button", class: "btn small ghost", onclick: () => act(`/api/vc/hotseat/asks/${a.id}/withdraw`, {}, "Taken back. The question is back on deck.") }, "Take it back") : null)))));
    }

    // ---- the archive ----
    async function archiveView() {
      const list = h("div", { class: "hs-wall" });
      const pager = h("div", { class: "actions", style: "justify-content:center" });
      const info = h("p", { class: "faint", style: "margin:0" });
      const search = h("input", { type: "search", placeholder: "Search questions, answers or names", "aria-label": "Search the archive", value: archive.q });
      let tmr = null;
      search.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(() => { archive = { page: 1, q: search.value.trim() }; load(); }, 300); });
      const load = async () => {
        let r; try { r = await pb.send(`/api/vc/hotseat/archive?page=${archive.page}&q=` + encodeURIComponent(archive.q), {}); } catch (err) { list.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
        info.textContent = r.total ? `${r.total} answer${r.total === 1 ? "" : "s"}${archive.q ? " found" : ""}. Page ${r.page} of ${r.pages}.` : "";
        const redraw = () => list.replaceChildren(...(r.items.length ? r.items.map((a) => answerCard(a, redraw)) : [h("p", { class: "muted" }, archive.q ? "Nothing matches that." : "Nothing in the archive yet. Answers move here after a week on the wall.")]));
        redraw();
        pager.replaceChildren(
          h("button", { type: "button", class: "btn small ghost", disabled: r.page <= 1, onclick: () => { archive.page--; load(); window.scrollTo(0, 0); } }, "‹ Newer"),
          h("button", { type: "button", class: "btn small ghost", disabled: r.page >= r.pages, onclick: () => { archive.page++; load(); window.scrollTo(0, 0); } }, "Older ›"));
      };
      root.replaceChildren(
        h("section", { class: "playroom-head" }, h("h1", {}, "🗂️ Hot Seat archive"),
          h("p", { class: "muted" }, "Every answer from past weeks."),
          h("button", { type: "button", class: "btn small ghost", onclick: () => { view = "play"; draw(); } }, "‹ Back to the game")),
        search, info, list, pager);
      load();
    }

    function draw() {
      if (view === "archive" && d.opt) return archiveView();
      const head = h("section", { class: "playroom-head" }, h("h1", {}, "🔥 Hot Seat"),
        h("p", { class: "muted" }, "Pick a question, put someone in the hot seat, and read the answers on the wall."));
      if (!d.opt) { root.replaceChildren(head, joinPanel()); return; }
      root.replaceChildren(head, inboxPanel(), askPanel(), wallPanel(), sentPanel(),
        h("p", { class: "faint", style: "text-align:center" }, h("button", { type: "button", class: "linkish", onclick: () => { if (confirm("Leave Hot Seat? Questions waiting in your inbox go back on deck. Your answers stay on the wall.")) act("/api/vc/hotseat/settings", { opt: false }, "You've left Hot Seat. Come back any time."); } }, "Leave Hot Seat")));
    }
    draw();
    app.replaceChildren(root);
  }

  window.VCHotSeat = { render };
})();
