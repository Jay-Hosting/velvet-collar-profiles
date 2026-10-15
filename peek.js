/* Peekaboob, built into the site. Players post a photo of part of themselves (zoomed in on one spot, or the full view);
   everyone else guesses whose it is from the players' profile photos. Photos come through the game's own address,
   which checks who's asking, so a zoomed-in peek never gives away the full photo until you've guessed it.
   Uses helpers app.js shares on window.VCPeek.deps. */
(() => {
  "use strict";
  const deps = () => window.VCPeek.deps;
  const REPORT = [["minor", "🚸 Someone under 18"], ["consent", "🙅 Someone who didn't agree to be posted"], ["face", "🙂 A face is showing"], ["guidelines", "📜 Breaks the guidelines"], ["other", "💬 Something else"]];
  const urls = [];
  const ago = (d) => {
    const t = Date.parse(String(d || "").replace(" ", "T")); if (isNaN(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago"; return Math.round(s / 86400) + "d ago";
  };

  // Load a peek's photo with your login (a plain <img src> can't send it), as a private in-page copy.
  function peekImg(id, which, alt) {
    const { h, pb } = deps();
    const img = h("img", { alt: alt || "", class: "pk-img", draggable: "false" });
    fetch(pb.baseURL.replace(/\/+$/, "") + `/api/vc/peek/posts/${id}/img/${which}`, { headers: { Authorization: pb.authStore.token }, cache: "no-store" })
      .then((r) => (r.ok ? r.blob() : null)).then((b) => { if (!b) return; const u = URL.createObjectURL(b); urls.push(u); img.src = u; }).catch(() => {});
    return img;
  }

  async function render(app) {
    const { h, pb, toast, errMsg, personChip, miniAvatar, go } = deps();
    document.title = "Peekaboob · Velvet Collar";
    while (urls.length) URL.revokeObjectURL(urls.pop());
    let d = await pb.send("/api/vc/peek", {});
    const root = h("div", { class: "pk" });
    const reload = async () => { d = await pb.send("/api/vc/peek", {}); draw(); };
    const act = async (path, method, body, msg) => { try { await pb.send(path, { method, body }); if (msg) toast(msg); await reload(); } catch (err) { toast(errMsg(err), true); } };

    function report(p) {
      let reason = "";
      const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "pk_rep" });
      const close = () => modal.remove();
      modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
      const note = h("textarea", { rows: 2, maxlength: 500, placeholder: "Anything the admins should know (optional)" });
      modal.append(h("div", { class: "modal-box" },
        h("div", { class: "toggle-row" }, h("h2", { id: "pk_rep", style: "margin:0" }, "⚑ Report this peek"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
        h("div", { class: "vf-opts" }, REPORT.map(([k, l]) => h("label", { class: "check" }, h("input", { type: "radio", name: "pk_r", onchange: () => { reason = k; } }), l))),
        note,
        h("p", { class: "faint", style: "margin:0" }, "Anything showing a minor, someone who didn't agree, or a face is hidden straight away while the admins look."),
        h("div", { class: "actions", style: "margin:0" }, h("button", { type: "button", class: "btn gold", onclick: async () => {
          if (!reason) return toast("Pick a reason.", true);
          try { const r = await pb.send(`/api/vc/peek/posts/${p.id}/report`, { method: "POST", body: { reason, note: note.value } }); close(); toast(r.hidden ? "Thank you. It's hidden until an admin looks." : "Thank you. The admins will take a look."); await reload(); }
          catch (err) { toast(errMsg(err), true); }
        } }, "⚑ Send report"))));
      document.body.append(modal);
    }

    // ---- joining ----
    function joinPanel() {
      return h("section", { class: "panel pk-join" },
        h("div", { class: "pk-hero", "aria-hidden": "true" }, "🙈"),
        h("h2", {}, "Whose is it?"),
        h("p", { class: "muted" }, "Players post a peek of themselves: zoomed right in on one spot, or the full view. Everyone else tries to match it to the right profile photo. Zoomed-in peeks are worth more points."),
        h("ul", { class: "mm-rules" },
          h("li", {}, "🔞 Players only, 21 and over. Nudity is fine, and peeks are blurred until someone taps."),
          h("li", {}, "🙋 Only your own body. Nobody else in the photo, and no face (that would make it too easy, and it keeps you private)."),
          h("li", {}, "🔒 Only people who guess right find out it's you. Nobody can save the photos, and a zoomed peek never shows the full photo until someone guesses it."),
          h("li", {}, "🗑 Take a peek down whenever you like. It's gone for good, photo and all. Peeks finish after a week.")),
        d.hasPhoto ? h("div", { class: "actions" }, h("button", { type: "button", class: "btn gold", onclick: () => act("/api/vc/peek/settings", "POST", { opt: true }, "🙈 You're in!") }, "🙈 I'm in"))
          : h("p", { class: "photo-needed" }, "📷 Peekaboob matches peeks to profile photos, so you'll need one first. ", h("a", { href: "/edit", "data-nav": "" }, "Add a profile photo")),
        h("p", { class: "faint" }, `${d.players} member${d.players === 1 ? " is" : "s are"} playing.`));
    }

    // ---- guessing ----
    function picker(p, onDone) {
      const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "pk_pick" });
      const close = () => modal.remove();
      modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
      const choose = async (who) => {
        try {
          const r = await pb.send(`/api/vc/peek/posts/${p.id}/guess`, { method: "POST", body: { guess: who.id } });
          close();
          toast(r.correct ? `🎉 Yes! It's ${who.display_name}. +${r.points} point${r.points === 1 ? "" : "s"}` : r.post.triesLeft ? `Not ${who.display_name}. ${r.post.triesLeft} ${r.post.triesLeft === 1 ? "guess" : "guesses"} left.` : `Not ${who.display_name}. That was your last guess on this one.`);
          onDone();
        } catch (err) { toast(errMsg(err), true); }
      };
      const people = d.roster.filter((m) => !p.wrong.includes(m.id));
      modal.append(h("div", { class: "modal-box pk-pick" },
        h("div", { class: "toggle-row" }, h("h2", { id: "pk_pick", style: "margin:0" }, "Whose is it?"), h("button", { type: "button", class: "btn small ghost", "aria-label": "Close", onclick: close }, "✕")),
        h("p", { class: "faint", style: "margin:0" }, `${p.triesLeft} ${p.triesLeft === 1 ? "guess" : "guesses"} left${p.wrong.length ? " · people you've already ruled out are gone" : ""}.`),
        people.length ? h("div", { class: "pk-faces" }, people.map((m) => h("button", { type: "button", class: "pk-face", onclick: () => choose(m) }, miniAvatar(m, "pk-face-img"), h("span", {}, m.display_name))))
          : h("p", { class: "muted" }, "Nobody left to guess.")));
      document.body.append(modal);
    }
    function peekCard(p) {
      let shown = !p.nsfw;
      const media = h("div", { class: "pk-media" + (shown ? "" : " veiled") }, peekImg(p.id, p.solved && p.canFull ? "full" : "crop", "A peek"),
        shown ? null : h("button", { type: "button", class: "pk-reveal", onclick: (e) => { media.classList.remove("veiled"); e.currentTarget.remove(); } }, "🔞 Tap to peek"));
      return h("article", { class: "pk-card" + (p.solved ? " solved" : "") },
        h("div", { class: "pk-card-top" }, h("span", { class: "pk-mode" }, p.mode === "zoom" ? "🔍 Zoomed in" : "👀 Full view"), h("small", { class: "faint" }, ago(p.created)),
          h("button", { type: "button", class: "btn small ghost hs-flag", title: "Report", "aria-label": "Report this peek", onclick: () => report(p) }, "⚑")),
        media,
        p.hint ? h("p", { class: "pk-hint" }, "💭 " + p.hint) : null,
        p.solved ? h("div", { class: "pk-solved" }, "✅ It's ", p.owner ? personChip(p.owner) : "them", "!")
          : p.triesLeft ? h("div", { class: "actions", style: "margin:0" }, h("button", { type: "button", class: "btn gold", onclick: () => picker(p, reload) }, "🎯 Guess whose"),
              h("small", { class: "faint" }, `${p.triesLeft} of ${d.rules.tries} guesses left`))
            : h("p", { class: "faint", style: "margin:0" }, "Out of guesses. It stays a mystery 🙈"),
        h("small", { class: "faint" }, `${p.stats.guessers} ${p.stats.guessers === 1 ? "person has" : "people have"} guessed · ${p.stats.right} got it`));
    }

    // ---- posting ----
    function postPanel() {
      const box = h("section", { class: "panel pk-post" });
      let mode = "zoom", pic = null, full = null, sq = { x: 0.5, y: 0.5, s: 0.3 };
      const canvas = h("canvas", { class: "pk-canvas", "aria-label": "Your photo. Tap where to zoom in." });
      const size = h("input", { type: "range", min: "12", max: "60", value: "30", "aria-label": "How much to show" });
      const hint = h("input", { type: "text", maxlength: 120, placeholder: "A hint (optional), like “a tattoo I love”" });
      const nsfw = h("input", { type: "checkbox", checked: true });
      const agree = h("input", { type: "checkbox" });
      const file = h("input", { type: "file", accept: "image/*", class: "sr", id: "pk_file" });
      const drawCanvas = () => {
        if (!pic) return;
        const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
        ctx.drawImage(pic, 0, 0, W, H);
        if (mode !== "zoom") return;
        const s = sq.s * Math.min(W, H), x = sq.x * W - s / 2, y = sq.y * H - s / 2;
        ctx.save(); ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(x + s, y, -s, s); ctx.fill("evenodd"); ctx.restore();
        ctx.strokeStyle = "#ecc5ed"; ctx.lineWidth = Math.max(2, W / 200); ctx.setLineDash([10, 6]); ctx.strokeRect(x, y, s, s); ctx.setLineDash([]);
      };
      const clamp = () => { const W = canvas.width, H = canvas.height, s = sq.s * Math.min(W, H); sq.x = Math.min(1 - s / 2 / W, Math.max(s / 2 / W, sq.x)); sq.y = Math.min(1 - s / 2 / H, Math.max(s / 2 / H, sq.y)); };
      const place = (ev) => { if (mode !== "zoom" || !pic) return; const r = canvas.getBoundingClientRect(); sq.x = (ev.clientX - r.left) / r.width; sq.y = (ev.clientY - r.top) / r.height; clamp(); drawCanvas(); };
      let dragging = false;
      canvas.addEventListener("pointerdown", (ev) => { dragging = true; canvas.setPointerCapture(ev.pointerId); place(ev); });
      canvas.addEventListener("pointermove", (ev) => { if (dragging) place(ev); });
      canvas.addEventListener("pointerup", () => { dragging = false; });
      size.addEventListener("input", () => { sq.s = +size.value / 100; clamp(); drawCanvas(); });
      file.addEventListener("change", async () => {
        const f = file.files[0]; file.value = ""; if (!f) return;
        full = window.VCShrink ? await window.VCShrink(f, { max: 1600 }) : f;
        try { pic = await createImageBitmap(full); } catch { toast("Couldn't open that photo. Try a JPEG or PNG.", true); return; }
        const maxW = 900; const k = Math.min(1, maxW / pic.width);
        canvas.width = Math.round(pic.width * k); canvas.height = Math.round(pic.height * k);
        sq = { x: 0.5, y: 0.5, s: +size.value / 100 }; clamp(); drawPanel();
      });
      const makeCrop = async () => {
        const s = sq.s * Math.min(pic.width, pic.height), sx = sq.x * pic.width - s / 2, sy = sq.y * pic.height - s / 2;
        const c = document.createElement("canvas"); c.width = 640; c.height = 640;
        c.getContext("2d").drawImage(pic, sx, sy, s, s, 0, 0, 640, 640);
        const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
        return new File([b], "peek.jpg", { type: "image/jpeg" });
      };
      const send = h("button", { type: "button", class: "btn gold" }, "🙈 Post my peek");
      send.addEventListener("click", async () => {
        if (!pic) return toast("Pick a photo first.", true);
        if (!agree.checked) return toast("Please tick the box to confirm it's just you, with no face.", true);
        send.disabled = true;
        try {
          const fd = new FormData();
          fd.append("mode", mode); fd.append("full", full); if (mode === "zoom") fd.append("crop", await makeCrop());
          fd.append("hint", hint.value.trim()); fd.append("nsfw", String(nsfw.checked)); fd.append("agree", "true");
          await pb.send("/api/vc/peek/posts", { method: "POST", body: fd });
          toast("🙈 Your peek is live!"); await reload();
        } catch (err) { toast(errMsg(err), true); send.disabled = false; }
      });
      const modes = h("div", { class: "pills" });
      const drawPanel = () => {
        modes.replaceChildren(...[["zoom", "🔍 Zoomed in", "Pick one spot. Harder to guess, worth more points."], ["full", "👀 Full view", "The whole photo. Easier, fewer points."]].map(([k, l, t]) =>
          h("button", { type: "button", class: "pill", "aria-pressed": String(mode === k), title: t, onclick: () => { mode = k; drawPanel(); } }, l)));
        box.replaceChildren(...[
          h("h2", {}, "➕ Post a peek"),
          h("p", { class: "faint", style: "margin-top:-6px" }, `You can have ${d.rules.maxLive} in play at once. Each runs for ${d.rules.days} days.`),
          modes,
          h("p", { class: "faint", style: "margin:0" }, mode === "zoom" ? "🔍 Tap or drag on your photo to choose the spot, and use the slider to show more or less. Players only see the square." : "👀 Players see the whole photo. Keep your face out of it."),
          h("label", { class: "btn", for: "pk_file" }, pic ? "📷 Choose a different photo" : "📷 Choose a photo"), file,
          pic ? canvas : null,
          pic && mode === "zoom" ? h("label", { class: "pk-size" }, h("span", { class: "faint" }, "Show less"), size, h("span", { class: "faint" }, "more")) : null,
          hint,
          h("label", { class: "check" }, nsfw, " 🔞 Blur it until someone taps (nudity)"),
          h("label", { class: "check" }, agree, " It's only me, nobody else is in it, and my face isn't showing."),
          h("div", { class: "actions" }, send)].filter(Boolean));
        drawCanvas();
      };
      drawPanel();
      return box;
    }

    function minePanel() {
      if (!d.mine.length) return "";
      return h("section", { class: "panel pk-mine" }, h("h2", {}, "🙈 Your peeks"),
        h("div", { class: "pk-mine-list" }, d.mine.map((p) => h("div", { class: "pk-mine-item" },
          h("div", { class: "pk-thumb" }, peekImg(p.id, p.mode === "zoom" ? "crop" : "full", "Your peek")),
          h("div", { class: "pk-mine-txt" },
            h("b", {}, p.mode === "zoom" ? "🔍 Zoomed in" : "👀 Full view"),
            h("small", { class: "faint" }, `${p.live ? "In play" : "Finished"} · ${ago(p.created)}`),
            h("small", {}, `${p.stats.guessers} guessed · ${p.stats.right} got it`),
            p.flagged ? h("small", { class: "faint" }, "🔒 Hidden while an admin reviews a report") : null,
            h("button", { type: "button", class: "btn small ghost", onclick: () => { if (confirm("Take this peek down? The photo is deleted for good.")) act(`/api/vc/peek/posts/${p.id}`, "DELETE", undefined, "Taken down."); } }, "🗑 Take down"))))));
    }

    function boardPanel() {
      return h("section", { class: "panel tod-crown" }, h("h2", {}, "🏆 Sharpest eyes this week"),
        d.board.length ? h("ol", { class: "tod-leaders" }, d.board.map((x, i) => h("li", { class: i === 0 ? "first" : "" }, h("span", { class: "tod-rank" }, i === 0 ? "👑" : String(i + 1)), personChip(x.member), h("small", { class: "faint" }, `${x.points} point${x.points === 1 ? "" : "s"}`))))
          : h("p", { class: "muted" }, "No right guesses yet this week."),
        h("p", { class: "faint" }, "Zoomed-in peeks: 3 points first try, then 2, then 1. Full view: 2, then 1."));
    }

    function draw() {
      const head = h("section", { class: "playroom-head" }, h("h1", {}, "🙈 Peekaboob"), h("p", { class: "muted" }, "A peek of a body, a wall of profile photos. Whose is it?"));
      if (!d.opt) { root.replaceChildren(head, joinPanel()); return; }
      const open = d.feed.filter((p) => !p.solved && p.triesLeft), done = d.feed.filter((p) => p.solved || !p.triesLeft);
      root.replaceChildren(head,
        h("section", { class: "pk-feed-sec" }, h("h2", {}, `🎯 Guess these (${open.length})`),
          open.length ? h("div", { class: "pk-feed" }, open.map(peekCard)) : h("p", { class: "muted" }, d.roster.length ? "You've guessed everything in play. Post a peek of your own to keep it going!" : "You're the first player. Post a peek and invite others to join!")),
        postPanel(), minePanel(), boardPanel(),
        done.length ? h("details", { class: "panel cb-mine" }, h("summary", {}, h("b", {}, `✅ Ones you've played (${done.length})`)), h("div", { class: "pk-feed", style: "margin-top:10px" }, done.map(peekCard))) : "",
        h("p", { class: "faint", style: "text-align:center" }, h("button", { type: "button", class: "linkish", onclick: () => { if (confirm("Leave Peekaboob? Your peeks come down too.")) act("/api/vc/peek/settings", "POST", { opt: false }, "You've left Peekaboob."); } }, "Leave Peekaboob")));
    }
    draw();
    app.replaceChildren(root);
  }

  window.VCPeek = { render };
})();
