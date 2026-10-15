/* Truth or Dare Roulette, built into the site. One card a day at the heat you pick, never touching your limits.
   Answer in words, add a photo if you dare, pass with a safeword when you want. Streaks, a wall, and a weekly crown.
   Uses helpers app.js shares on window.VCTod.deps. */
(() => {
  "use strict";
  const deps = () => window.VCTod.deps;
  const HEATS = [["mild", "🌸", "Mild"], ["spicy", "🌶️", "Spicy"], ["fire", "🔥", "Scorching"]];
  const heatOf = (k) => HEATS.find((x) => x[0] === k) || HEATS[0];
  const KIND = { truth: ["💭", "Truth"], dare: ["🎯", "Dare"] };
  const RULES = [
    ["🔞", "Members only, 21 and older."],
    ["🛟", "Safeword passes are no-questions-asked. Other members never see that you passed, and your streak stays safe."],
    ["📷", "Photos are optional. Only post yourself, or someone who said yes to being posted. Never anyone under 18."],
    ["🔞", "Tick NSFW on anything explicit so it stays blurred until someone taps."],
    ["🚪", "A dare is for you to do alone or with a partner who's already into it. It's never a reason to message someone who didn't ask."],
    ["🔒", "What's on the wall stays in the group. No screenshots or sharing outside."],
  ];
  const ago = (d) => {
    const t = Date.parse(String(d || "").replace(" ", "T")); if (isNaN(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago";
    const dd = Math.round(s / 86400); return dd < 7 ? dd + "d ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const dayLabel = (key) => new Date(key + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  // Time until midnight Pacific, when the next card is ready.
  function untilTomorrow() {
    const now = new Date();
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
    const left = (24 * 60) - (Number(parts.hour) * 60 + Number(parts.minute));
    const hh = Math.floor(left / 60), mm = left % 60;
    return hh ? `${hh}h ${mm}m` : `${mm}m`;
  }

  async function render(app) {
    const { h, pb, toast, errMsg, personChip, openViewer, reportPhoto } = deps();
    document.title = "Truth or Dare · Velvet Collar";
    let d;
    const load = async () => { d = await pb.send("/api/vc/tod", {}); };
    await load();
    const root = h("div", { class: "tod" });
    const settings = async (body, msg) => { try { await pb.send("/api/vc/tod/settings", { method: "POST", body }); if (msg) toast(msg); await load(); draw(); } catch (err) { toast(errMsg(err), true); } };
    const proofItem = (p) => ({ id: p.id, collectionId: p.collectionId, collectionName: "tod_plays", image: p.proof, nsfw: p.nsfw, caption: "" });

    // ---- the rules ----
    const rulesBox = () => {
      const seen = store.get("vc_tod_rules") === "1";
      const box = h("details", { class: "panel cb-rules" }, h("summary", {}, h("b", {}, "📜 How it works"), h("small", { class: "faint" }, " · and the house rules")),
        h("p", { class: "faint", style: "margin:6px 0" }, `Every day you get one card: pick truth, dare, or let the wheel decide. Cards come at your heat level (and a few milder ones), and anything touching your limits is never dealt to you. Answer before midnight Pacific to grow your streak. You get ${d.player.passes} safeword passes a week, and they refill every Monday.`),
        h("ul", {}, RULES.map(([e, t]) => h("li", {}, h("span", { "aria-hidden": "true" }, e), " ", t))),
        seen ? null : h("button", { type: "button", class: "btn small gold", onclick: () => { store.set("vc_tod_rules", "1"); box.open = false; } }, "Got it"));
      box.open = !seen;
      return box;
    };

    const heatPills = (cur, onPick) => h("div", { class: "pills", role: "radiogroup", "aria-label": "Heat level" }, HEATS.map(([k, e, l]) =>
      h("button", { type: "button", class: "pill", role: "radio", "aria-checked": String(cur === k), "aria-pressed": String(cur === k), onclick: () => onPick(k) }, `${e} ${l}`)));

    // ---- not playing yet ----
    function joinPanel() {
      let heat = d.player.heat || "mild";
      const pills = h("div", {});
      const drawP = () => pills.replaceChildren(heatPills(heat, (k) => { heat = k; drawP(); }));
      drawP();
      return h("section", { class: "panel tod-join" },
        h("div", { class: "tod-hero", "aria-hidden": "true" }, h("span", { class: "tod-card-back t" }, "💭"), h("span", { class: "tod-card-back d" }, "🎯")),
        h("h2", {}, "Ready to play?"),
        h("p", { class: "muted" }, "One truth or dare a day, dealt just for you. Choose how hot you like it. You can change it any time."),
        pills,
        h("p", { class: "faint" }, "🌸 Mild: flirty, getting-to-know-you. 🌶️ Spicy: suggestive, toys and fantasies. 🔥 Scorching: explicit, for the brave."),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn gold", onclick: () => settings({ opt: true, heat }, "🎲 You're in!") }, "🎲 I'm in")));
    }

    // ---- the status bar ----
    function statusBar() {
      const p = d.player;
      const heatBox = h("div", { class: "tod-heat", hidden: true }, heatPills(p.heat, (k) => settings({ heat: k }, `${heatOf(k)[1]} ${heatOf(k)[2]} from your next card`)));
      return h("section", { class: "tod-status" },
        h("div", { class: "tod-stats" },
          h("span", { class: "tod-stat", title: "Days in a row" }, h("b", {}, `🔥 ${p.streak}`), h("small", {}, p.streak === 1 ? "day streak" : "day streak")),
          h("span", { class: "tod-stat", title: "Your best streak" }, h("b", {}, `🏅 ${p.best}`), h("small", {}, "best")),
          h("span", { class: "tod-stat", title: "Safeword passes left this week" }, h("b", {}, `🛟 ${p.passesLeft}`), h("small", {}, `pass${p.passesLeft === 1 ? "" : "es"} left · refill Mon`)),
          h("button", { type: "button", class: "tod-stat tod-stat-btn", "aria-label": "Change heat level", onclick: () => { heatBox.hidden = !heatBox.hidden; } }, h("b", {}, heatOf(p.heat)[1]), h("small", {}, heatOf(p.heat)[2] + " ✎"))),
        heatBox);
    }

    // ---- today's card ----
    function cardFace(p, big) {
      const [ke, kl] = KIND[p.kind] || KIND.truth, [, he, hl] = heatOf(p.heat);
      return h("div", { class: "tod-card kind-" + p.kind + " heat-" + p.heat + (big ? " big" : "") },
        h("div", { class: "tod-card-top" }, h("span", {}, `${ke} ${kl}`), h("span", {}, `${he} ${hl}`)),
        h("p", { class: "tod-card-text" }, p.text));
    }
    function spinPanel() {
      const wheel = h("div", { class: "tod-wheel", "aria-hidden": "true" }, h("span", {}, "💭"), h("span", {}, "🎯"), h("span", {}, "🎲"));
      const btns = h("div", { class: "tod-pick" });
      const spin = async (kind) => {
        btns.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        wheel.classList.add("spinning");
        try {
          const [r] = await Promise.all([pb.send("/api/vc/tod/spin", { method: "POST", body: { kind } }), new Promise((ok) => setTimeout(ok, 1100))]);
          d.today = r.play; draw();
          const c = root.querySelector(".tod-card.big"); if (c) c.classList.add("dealt");
        } catch (err) { toast(errMsg(err), true); wheel.classList.remove("spinning"); btns.querySelectorAll("button").forEach((b) => { b.disabled = false; }); }
      };
      btns.append(
        h("button", { type: "button", class: "btn tod-truth", onclick: () => spin("truth") }, "💭 Truth"),
        h("button", { type: "button", class: "btn gold tod-spin", onclick: () => spin("") }, "🎰 Spin the wheel"),
        h("button", { type: "button", class: "btn tod-dare", onclick: () => spin("dare") }, "🎯 Dare"));
      return h("section", { class: "panel tod-today" }, h("h2", {}, "🎰 Today's card"), wheel, h("p", { class: "muted", style: "text-align:center" }, "Truth, dare, or let fate decide?"), btns);
    }
    function answerForm(p, editing) {
      const text = h("textarea", { rows: 4, maxlength: 1000, placeholder: p.kind === "dare" ? "Tell us how it went…" : "Your answer…", "aria-label": "Your answer" }, p.answer || "");
      const counter = h("small", { class: "faint" }, `${text.value.length} / 1000`);
      text.addEventListener("input", () => { counter.textContent = `${text.value.length} / 1000`; });
      const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", class: "tod-file", "aria-label": "Photo proof" });
      const preview = h("div", { class: "tod-preview" });
      let removePhoto = false;
      const showPrev = (src) => preview.replaceChildren(...(src ? [h("img", { src, alt: "" }), h("button", { type: "button", class: "btn small ghost", onclick: () => { file.value = ""; removePhoto = !!p.proof; showPrev(""); } }, "✕ Remove")] : []));
      if (p.proof) showPrev(deps().fileUrl(proofItem(p), p.proof, "400x400"));
      file.addEventListener("change", () => {
        const f = file.files[0]; if (!f) return;
        if (f.size > 12 * 1024 * 1024) { toast("Photos can be up to 12 MB.", true); file.value = ""; return; }
        removePhoto = false; showPrev(URL.createObjectURL(f));
      });
      const nsfw = h("input", { type: "checkbox", checked: !!p.nsfw });
      const shared = h("input", { type: "checkbox", checked: p.status === "dealt" ? true : !!p.shared });
      const send = h("button", { type: "button", class: "btn gold" }, editing ? "Save" : p.kind === "dare" ? "🎯 Dare done" : "💭 Answer");
      send.addEventListener("click", async () => {
        if (text.value.trim().length < 2 && !file.files[0] && !(p.proof && !removePhoto)) return toast("Write an answer, or add a photo for proof.", true);
        if (file.files[0] && !store.get("vc_photo_rules") && !confirm("Before you post: only photos of yourself, or of someone who agreed to be posted. Never anyone under 18. Post it?")) return;
        send.disabled = true;
        const fd = new FormData();
        fd.append("answer", text.value.trim()); fd.append("nsfw", String(nsfw.checked)); fd.append("shared", String(shared.checked));
        if (file.files[0]) fd.append("proof", file.files[0]);
        if (removePhoto) fd.append("removePhoto", "true");
        try {
          await pb.send("/api/vc/tod/answer", { method: "POST", body: fd });
          toast(editing ? "Saved" : p.kind === "dare" ? "🔥 Dare done!" : "💜 Answered!");
          await load(); draw();
        } catch (err) { toast(errMsg(err), true); send.disabled = false; }
      });
      return h("div", { class: "tod-answer" }, text, h("div", { class: "cb-row" }, counter),
        h("div", { class: "tod-photo-row" }, h("label", { class: "btn small ghost tod-file-btn" }, "📷 Add a photo (optional)", file), preview),
        h("label", { class: "check" }, nsfw, " 🔞 NSFW (blur it until someone taps)"),
        h("label", { class: "check" }, shared, " 📣 Share on the wall"),
        h("div", { class: "actions" }, send,
          editing ? h("button", { type: "button", class: "btn ghost", onclick: () => draw() }, "Cancel") : null,
          !editing ? h("button", { type: "button", class: "btn ghost tod-pass", disabled: !d.player.passesLeft, title: d.player.passesLeft ? "" : "No passes left. They refill on Monday.", onclick: async () => {
            try { await pb.send("/api/vc/tod/pass", { method: "POST" }); toast("🛟 Passed. No questions asked."); await load(); draw(); } catch (err) { toast(errMsg(err), true); }
          } }, `🛟 Safeword pass (${d.player.passesLeft} left)`) : null));
    }
    function todayPanel() {
      const p = d.today;
      if (!p) return spinPanel();
      const head = h("h2", {}, p.status === "dealt" ? "🃏 Your card for today" : p.status === "passed" ? "🛟 Passed today" : "✅ Done for today");
      if (p.status === "dealt") return h("section", { class: "panel tod-today" }, head, cardFace(p, true), answerForm(p, false));
      if (p.status === "passed") return h("section", { class: "panel tod-today" }, head, h("p", { class: "muted" }, `No questions asked. Your streak is safe. Your next card is ready in ${untilTomorrow()}.`));
      const box = h("section", { class: "panel tod-today" });
      const show = () => box.replaceChildren(head, cardFace(p, true),
        p.answer ? h("p", { class: "tod-my-answer" }, p.answer) :"",
        p.proof ? h("button", { type: "button", class: "tod-proof" + (p.nsfw ? " nsfw" : ""), onclick: () => openViewer([proofItem(p)], 0, true) }, h("img", { src: deps().fileUrl(proofItem(p), p.proof, "400x400"), alt: "Your photo" })) :"",
        h("p", { class: "faint" }, p.shared ? `📣 On the wall${p.fire ? ` · 🔥 ${p.fire}` : ""}` : "🔒 Just for you", ` · next card in ${untilTomorrow()}`),
        h("div", { class: "actions" },
          h("button", { type: "button", class: "btn small ghost", onclick: () => box.replaceChildren(head, cardFace(p, true), answerForm(p, true)) }, "✏️ Edit"),
          h("button", { type: "button", class: "btn small ghost", onclick: async () => {
            try { await pb.send(`/api/vc/tod/plays/${p.id}/share`, { method: "POST", body: { shared: !p.shared } }); await load(); draw(); } catch (err) { toast(errMsg(err), true); }
          } }, p.shared ? "🙈 Take off the wall" : "📣 Share on the wall")));
      show();
      return box;
    }

    // ---- the crown ----
    function crownPanel() {
      const L = d.leaders || [];
      return h("section", { class: "panel tod-crown" },
        h("h2", {}, "👑 Boldest player this week"),
        d.lastCrown ? h("p", { class: "faint", style: "margin-top:-6px" }, "Last week's crown: ", personChip(d.lastCrown.member), ` · ${d.lastCrown.done} card${d.lastCrown.done === 1 ? "" : "s"}`) : null,
        L.length ? h("ol", { class: "tod-leaders" }, L.map((x, i) => h("li", { class: i === 0 ? "first" : "" }, h("span", { class: "tod-rank" }, i === 0 ? "👑" : String(i + 1)), personChip(x.member),
          h("small", { class: "faint" }, `${x.done} card${x.done === 1 ? "" : "s"} · ${"🔥".repeat(Math.min(3, Math.round(x.heat / Math.max(1, x.done))))}${x.fire ? ` · ${x.fire} 🔥 from others` : ""}`))))
          : h("p", { class: "muted" }, "Nobody yet this week. The crown is up for grabs."),
        h("p", { class: "faint" }, "Most cards done Monday to Sunday wins. Ties go to the hottest cards, then the most 🔥 from everyone else."));
    }

    // ---- the wall ----
    let wallHeat = "all";
    const wallBox = h("section", { class: "tod-wall-sec" });
    function drawWall() {
      const items = d.wall.filter((p) => wallHeat === "all" || p.heat === wallHeat);
      wallBox.replaceChildren(
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "📣 The wall"), h("small", { class: "faint" }, "the last 7 days")),
        h("div", { class: "pills" }, [["all", "Everything"], ...HEATS.map(([k, e, l]) => [k, `${e} ${l}`])].map(([k, l]) =>
          h("button", { type: "button", class: "pill", "aria-pressed": String(wallHeat === k), onclick: () => { wallHeat = k; drawWall(); } }, l))),
        items.length ? h("div", { class: "tod-wall" }, items.map(wallCard)) : h("p", { class: "muted" }, "Nothing shared yet. Be the first!"));
    }
    function wallCard(p) {
      const [ke, kl] = KIND[p.kind] || KIND.truth, [, he] = heatOf(p.heat);
      const fireBtn = h("button", { type: "button", class: "cb-rx" + (p.fired ? " on" : ""), "aria-pressed": String(!!p.fired), disabled: p.mine, title: p.mine ? "Yours" : "🔥 Hot", "aria-label": `Fire: ${p.fire}` },
        h("span", { "aria-hidden": "true" }, "🔥"), p.fire ? h("b", {}, String(p.fire)) : null);
      fireBtn.addEventListener("click", async () => {
        try { Object.assign(p, await pb.send(`/api/vc/tod/plays/${p.id}/react`, { method: "POST" })); drawWall(); } catch (err) { toast(errMsg(err), true); }
      });
      const report = p.mine ? null : h("button", { type: "button", class: "btn small ghost tod-report", title: "Report", "aria-label": "Report this", onclick: () => reportPhoto(p, (r) => { if (r.hidden) { d.wall = d.wall.filter((x) => x.id !== p.id); drawWall(); } }, `/api/vc/tod/plays/${p.id}/report`) }, "⚑");
      return h("article", { class: "tod-post kind-" + p.kind + " heat-" + p.heat + (p.mine ? " is-mine" : "") },
        h("div", { class: "tod-post-head" }, personChip(p.by), h("small", { class: "faint" }, ago(p.updated)), report),
        h("p", { class: "tod-post-card" }, h("span", {}, `${ke} ${kl} ${he}`), " ", p.text),
        p.answer ? h("p", { class: "tod-post-answer" }, p.answer) : null,
        p.proof ? h("button", { type: "button", class: "tod-proof" + (p.nsfw ? " nsfw" : ""), onclick: () => openViewer([proofItem(p)], 0, false) },
          h("img", { src: deps().fileUrl(proofItem(p), p.proof, "400x400"), alt: "Photo proof" }), p.nsfw ? h("span", { class: "tod-nsfw" }, "NSFW · tap") : null) : null,
        p.flagged ? h("p", { class: "faint" }, "🔒 Hidden from others while an admin reviews a report") : null,
        h("div", { class: "cb-reacts" }, fireBtn));
    }

    // ---- your history ----
    function historyPanel() {
      const list = (d.history || []).filter((p) => p.status !== "dealt" || p.day !== d.day);
      const ST = { done: "✅", passed: "🛟", dealt: "⌛" };
      return h("details", { class: "panel cb-mine" }, h("summary", {}, h("b", {}, `🗂️ Your cards (${list.length})`), h("small", { class: "faint" }, " · only you see passes")),
        list.length ? h("div", { class: "cb-mine-list" }, list.map((p) => h("div", { class: "cb-mine-item" },
          h("div", { class: "cb-row" }, h("small", {}, `${ST[p.status] || ""} ${dayLabel(p.day)} · ${(KIND[p.kind] || KIND.truth).join(" ")} ${heatOf(p.heat)[1]}`), p.fire ? h("small", { class: "faint" }, `🔥 ${p.fire}`) : null),
          h("p", { class: "faint", style: "margin:2px 0" }, p.text),
          p.answer ? h("p", { style: "margin:2px 0" }, p.answer) : p.status === "passed" ? h("p", { class: "faint", style: "margin:2px 0" }, "Passed") : null)))
          : h("p", { class: "faint" }, "Your played cards will collect here."));
    }

    // ---- suggest a card ----
    function ideaPanel() {
      let kind = "truth", heat = "mild";
      const kindPills = h("div", {}), hp = h("div", {});
      const drawK = () => kindPills.replaceChildren(h("div", { class: "pills" }, Object.entries(KIND).map(([k, [e, l]]) => h("button", { type: "button", class: "pill", "aria-pressed": String(kind === k), onclick: () => { kind = k; drawK(); } }, `${e} ${l}`))));
      const drawH = () => hp.replaceChildren(heatPills(heat, (k) => { heat = k; drawH(); }));
      drawK(); drawH();
      const text = h("textarea", { rows: 2, maxlength: 300, placeholder: "Your truth question or dare…", "aria-label": "Your card idea" });
      const ST = { pending: "⏳ Waiting for the hosts", approved: "✅ In the deck", rejected: "🙅 Not added", retired: "📦 Retired" };
      const mine = d.ideas || [];
      return h("details", { class: "panel tod-idea" }, h("summary", {}, h("b", {}, "💡 Suggest a card"), h("small", { class: "faint" }, ` · ${d.deck.mild + d.deck.spicy + d.deck.fire} in the deck`)),
        h("p", { class: "faint" }, "Got a good one? The hosts add the best ideas to the deck. Keep it about the player, never about a specific person."),
        kindPills, hp, text,
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn small gold", onclick: async () => {
          try { await pb.send("/api/vc/tod/cards", { method: "POST", body: { kind, heat, text: text.value } }); toast("💡 Sent to the hosts"); await load(); draw(); } catch (err) { toast(errMsg(err), true); }
        } }, "Send to the hosts")),
        mine.length ? h("div", { class: "cb-mine-list" }, mine.map((c) => h("div", { class: "cb-mine-item" },
          h("p", {}, `${(KIND[c.kind] || KIND.truth)[0]} ${heatOf(c.heat)[1]} ${c.text}`),
          h("div", { class: "cb-row" }, h("small", { class: "cb-st cb-st-" + (c.status === "approved" ? "approved" : c.status === "pending" ? "pending" : "hidden") }, ST[c.status] || c.status),
            c.status === "pending" ? h("button", { type: "button", class: "btn small ghost", onclick: async () => {
              try { await pb.send(`/api/vc/tod/cards/${c.id}`, { method: "DELETE" }); toast("Withdrawn"); await load(); draw(); } catch (err) { toast(errMsg(err), true); }
            } }, "Withdraw") : null)))) : null);
    }

    function draw() {
      const head = h("section", { class: "playroom-head" },
        h("h1", {}, "🎲 Truth or Dare Roulette"),
        h("p", { class: "muted" }, "A card a day, at your heat, never past your limits."));
      if (!d.player.opt) { root.replaceChildren(head, rulesBox(), joinPanel(), crownPanel()); return; }
      drawWall();
      root.replaceChildren(head, statusBar(), todayPanel(), rulesBox(), crownPanel(), wallBox, historyPanel(), ideaPanel(),
        h("p", { class: "faint", style: "text-align:center" }, h("button", { type: "button", class: "linkish", onclick: () => { if (confirm("Stop playing? Your streak resets if you miss a day, but your cards stay.")) settings({ opt: false }, "You've stepped out. Come back any time."); } }, "Stop playing")));
    }
    draw();
    app.replaceChildren(root);
  }

  window.VCTod = { render };
})();
