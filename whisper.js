/* Whispers: anonymous, opt-in flirting chats. No names, no faces, just words and emojis.
   Uses helpers app.js shares on window.VCWhisper.deps (h, pb, toast, go, me, errMsg, personChip). */
(() => {
  "use strict";
  const HEATS = [["flirty", "😊 Flirty"], ["teasing", "😏 Teasing"], ["spicy", "🔥 Spicy"]];
  const EMOJI = ["😏", "😈", "🔥", "🥵", "💋", "😘", "🫦", "👀", "🙈", "😳", "🤭", "💜", "✨", "🍑", "🍒", "💦", "⛓️", "🐾", "🌙", "😇"];
  const OPENERS = {
    flirty: [
      "Well hello there, mystery 😏", "So… do you come to anonymous chats often?", "Tell me something that made you smile today",
      "What's your idea of a perfect first date?", "I'm told I'm trouble. Want to find out?", "Describe your ideal lazy Sunday",
      "What's something you're secretly really good at?", "Compliment incoming: you have excellent taste in matches", "Coffee or cocktails?",
      "What's the cheesiest pickup line you secretly love?", "Rate your flirting skills out of ten", "What gives you butterflies?",
      "Truth or dare?", "What's your love language?", "If we were on a date right now, where would we be?",
    ],
    teasing: [
      "I have a feeling you're a bit of a menace 😈", "What's a compliment that would make you blush?", "Tell me your favourite way to be teased",
      "Bratty or obedient tonight?", "What's the last thing that made your heart race?", "I bet I could make you squirm with just words",
      "What's on your mind right now? Be honest.", "Describe your perfect night in three words", "Do you prefer to chase or be chased?",
      "What's something you want but haven't asked for yet?", "Good or a little bit bad tonight?", "Tell me a secret. I won't tell. I can't 😉",
      "What would you do if I were right next to you?", "Whisper something that'd make me lose my train of thought", "How do you like to be told you're good?",
    ],
    spicy: [
      "What's the first thing you'd do if we were alone right now? 🔥", "Tell me exactly how you like to be touched", "Where would you want my hands first?",
      "What's a fantasy you've never said out loud?", "Describe what you're wearing. Or not wearing.", "I want to hear what you'd beg for",
      "Dominate or be dominated tonight?", "Tell me where you want to be kissed", "What's the filthiest thought you've had today?",
      "How rough is too rough for you?", "Make me blush. I dare you.", "What would you let me do to you?",
      "Tell me what gets you there every time", "Slow and teasing, or fast and desperate?", "What do you want to hear me say?",
    ],
  };

  const deps = () => window.VCWhisper.deps;
  const parseDate = (d) => { const t = Date.parse(String(d || "").replace(" ", "T")); return isNaN(t) ? null : t; };
  const left = (d) => {
    const t = parseDate(d); if (!t) return "";
    const ms = t - Date.now(); if (ms <= 0) return "fading now";
    const hrs = Math.floor(ms / 3600e3), mins = Math.floor((ms % 3600e3) / 60e3);
    return hrs ? `fades in ${hrs}h ${mins}m` : `fades in ${mins}m`;
  };
  let poll = null;

  // ---------- lobby ----------
  async function renderLobby(app) {
    const { h, pb, toast, go, errMsg } = deps();
    clearInterval(poll);
    document.title = "Whispers · Velvet Collar";
    const data = await pb.send("/api/vc/whispers", {});
    let on = data.opt;
    const heats = new Set(data.heats.length ? data.heats : ["flirty", "teasing"]);

    const settings = h("section", { class: "panel whisper-settings" });
    const drawSettings = () => {
      const toggle = h("button", { type: "button", class: "btn " + (on ? "gold" : ""), "aria-pressed": String(on) }, on ? "🤫 Whispers are on" : "Turn on Whispers");
      toggle.addEventListener("click", async () => {
        try { await pb.send("/api/vc/whispers/opt", { method: "POST", body: { on: !on, heats: [...heats] } }); on = !on; toast(on ? "🤫 You're in. Find someone when you're ready." : "Whispers off. Nobody can match with you."); renderLobby(app); }
        catch (err) { toast(errMsg(err), true); }
      });
      const heatRow = h("div", { class: "pills" }, HEATS.map(([v, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(heats.has(v)), onclick: async () => {
        if (heats.has(v) && heats.size > 1) heats.delete(v); else heats.add(v);
        drawSettings();
        if (on) { try { await pb.send("/api/vc/whispers/opt", { method: "POST", body: { on: true, heats: [...heats] } }); } catch {} }
      } }, l)));
      settings.replaceChildren(h("h2", {}, "Your Whispers"),
        h("div", { class: "actions", style: "margin:0" }, toggle),
        h("span", { class: "label" }, "Heat I'm up for"), heatRow,
        h("p", { class: "faint" }, `${data.optedIn} member${data.optedIn === 1 ? " has" : "s have"} Whispers on.`));
    };
    drawSettings();

    const finder = h("section", { class: "panel whisper-find" });
    if (on) {
      if (data.queued) {
        const leave = h("button", { type: "button", class: "btn small ghost" }, "Stop looking");
        leave.addEventListener("click", async () => { try { await pb.send("/api/vc/whispers/find", { method: "DELETE" }); renderLobby(app); } catch (err) { toast(errMsg(err), true); } });
        finder.append(h("h2", {}, "🌙 Looking for someone…"),
          h("p", { class: "queue-on" }, h("span", { class: "dot", "aria-hidden": "true" }), "You're in line. As soon as someone who suits you starts looking, you'll be whispering. You can close this page."),
          data.waiting ? h("p", { class: "faint" }, `${data.waiting} other${data.waiting === 1 ? " is" : "s are"} waiting, but not a match for your heat or interests yet.`) : null,
          h("div", { class: "actions" }, leave));
        const known = new Set(data.chats.map((c) => c.id));
        poll = setInterval(async () => {
          if (!document.body.contains(finder)) return clearInterval(poll);
        if (document.hidden) return;   // background tabs wait until you look at them again
          try { const fresh = await pb.send("/api/vc/whispers", {}); const nu = fresh.chats.find((c) => c.status === "active" && !known.has(c.id)); if (nu) { clearInterval(poll); toast("🤫 Someone's here…"); go("/whispers/" + nu.id); } } catch {}
        }, 15000);
      } else {
        const find = h("button", { type: "button", class: "btn gold" }, "🤫 Find someone");
        find.addEventListener("click", async () => {
          find.disabled = true;
          try { const r = await pb.send("/api/vc/whispers/find", { method: "POST" }); if (r.matched) { toast("🤫 Matched! Say hello…"); go("/whispers/" + r.matched); } else { toast("You're in line. We'll match you soon."); renderLobby(app); } }
          catch (err) { toast(errMsg(err), true); find.disabled = false; }
        });
        finder.append(h("h2", {}, "Start a whisper"),
          h("p", { class: "faint" }, "We'll pair you with someone whose interests and heat line up with yours, and who isn't on your limits. You'll both get a secret name."),
          h("div", { class: "actions" }, find));
      }
    }

    const active = data.chats.filter((c) => c.status === "active");
    const list = active.length ? h("div", { class: "hunt-list" }, active.map((c) => h("a", { class: "hunt-row" + (c.unread ? " hot" : ""), href: "/whispers/" + c.id, "data-nav": "" },
      h("span", { class: "mini-av whisper-av", "aria-hidden": "true" }, "🤫"),
      h("span", { class: "txt" }, h("b", {}, c.them, c.unread ? h("span", { class: "new-pill" }, "New") : null),
        h("small", {}, `You're ${c.me} · ${(HEATS.find((x) => x[0] === c.heat) || [, ""])[1]} · ${left(c.expires)}`)),
      h("span", { class: "arrow", "aria-hidden": "true" }, "→")))) : h("p", { class: "muted" }, on ? "No whispers yet." : "Turn on Whispers to get started.");

    app.replaceChildren(...[
      h("section", { class: "hunt-hero whisper-hero" },
        h("div", { class: "hunt-moon", "aria-hidden": "true" }, "🤫"),
        h("h1", {}, "Whispers"),
        h("p", {}, "Anonymous flirting. No names, no faces, just words and emojis. We match you behind the scenes with someone whose interests line up with yours. Chats fade after 24 hours unless you both want more.")),
      settings, on ? finder : null,
      h("section", { class: "panel" }, h("h2", {}, "Your whispers"), list),
      h("section", { class: "panel hunt-rules" }, h("h2", {}, "How it stays anonymous, and safe"),
        h("ol", {},
          h("li", {}, "Neither of you sees a name, photo or profile. You each get a secret name like \"Velvet Fox\"."),
          h("li", {}, "Words and emojis only. Links and @usernames are removed automatically."),
          h("li", {}, "You'll only find out who it was if you both tap 🎭 Reveal. Either of you can just leave instead."),
          h("li", {}, "Chats fade after 24 hours and the messages are deleted. Both tap ⏳ Keep going for another day."),
          h("li", {}, "End a chat any time. 🚫 End & block means you're never matched again."),
          h("li", {}, "⚑ Report a message if something's not OK. Only then can the group's admins see who sent it."),
          h("li", {}, "Everyone here is 21+. Be kind, respect limits, and stop the moment someone says stop.")))].filter(Boolean));
  }

  // ---------- one chat ----------
  async function renderChat(app, id) {
    const { h, pb, toast, go, errMsg, personChip } = deps();
    clearInterval(poll);
    let c;
    try { c = await pb.send("/api/vc/whispers/" + encodeURIComponent(id), {}); }
    catch (err) { app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "This whisper has faded"), h("p", { class: "muted" }, "Chats disappear after 24 hours, or when someone ends them."), h("a", { class: "btn", href: "/whispers", "data-nav": "" }, "Back to Whispers"))); return; }
    document.title = "Whispers · Velvet Collar";
    const heat = (HEATS.find((x) => x[0] === c.heat) || HEATS[0]);
    let lastAt = c.messages.length ? c.messages[c.messages.length - 1].at : "";
    const live = c.status === "active";

    const thread = h("div", { class: "whisper-thread", role: "log", "aria-live": "polite" });
    const bubble = (m) => {
      const b = h("div", { class: "wmsg " + (m.mine ? "mine" : "theirs"), "data-id": m.id }, h("p", {}, m.text),
        h("span", { class: "wtime" }, new Date(parseDate(m.at)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })));
      if (!m.mine && live) b.append(h("button", { type: "button", class: "wreport", title: "Report this message", "aria-label": "Report this message", onclick: () => report(m) }, "⚑"));
      return b;
    };
    const addMsgs = (list) => { list = list.filter((m) => !thread.querySelector(`[data-id="${m.id}"]`)); list.forEach((m) => thread.append(bubble(m))); if (list.length) { lastAt = list[list.length - 1].at; thread.scrollTop = thread.scrollHeight; } };
    if (!c.messages.length && live) thread.append(h("p", { class: "faint wempty" }, `Say hello to ${c.them}. They can't see who you are.`));
    addMsgs(c.messages);

    async function report(m) {
      const reason = prompt("Report this message to the admins? They'll see who sent it. The chat will end and you won't be matched again.\n\nOptional: tell them why.");
      if (reason === null) return;
      try { await pb.send(`/api/vc/whispers/${c.id}/report`, { method: "POST", body: { message: m.id, reason } }); toast("Reported. Thank you for speaking up 💜"); go("/whispers"); }
      catch (err) { toast(errMsg(err), true); }
    }

    const box = h("textarea", { rows: 2, maxlength: 500, placeholder: `Whisper to ${c.them}…`, "aria-label": "Your message" });
    const send = h("button", { type: "button", class: "btn gold" }, "Send");
    const doSend = async () => {
      const text = box.value.trim(); if (!text) return box.focus();
      send.disabled = true;
      try {
        await pb.send(`/api/vc/whispers/${c.id}/send`, { method: "POST", body: { text } });
        box.value = "";
        const fresh = await pb.send(`/api/vc/whispers/${c.id}?after=${encodeURIComponent(lastAt)}`, {});
        const emptyNote = thread.querySelector(".wempty"); if (emptyNote) emptyNote.remove();
        addMsgs(fresh.messages);
      } catch (err) { toast(errMsg(err), true); }
      finally { send.disabled = false; box.focus(); }
    };
    send.addEventListener("click", doSend);
    box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });

    // Quick openers (three at a time) and emojis.
    const pool = OPENERS[c.heat] || OPENERS.flirty, used = new Set();
    const quick = h("div", { class: "quick-lines" });
    const deal = () => {
      if (used.size > pool.length - 3) used.clear();
      const picks = []; while (picks.length < 3) { const i = Math.floor(Math.random() * pool.length); if (!used.has(i)) { used.add(i); picks.push(pool[i]); } }
      quick.replaceChildren(...picks.map((t) => h("button", { type: "button", class: "quick", onclick: () => { box.value = t; box.focus(); } }, t)),
        h("button", { type: "button", class: "quick more", "aria-label": "Show three more", title: "Three more", onclick: deal }, "🔄"));
    };
    deal();
    const emojis = h("div", { class: "quick-emoji" }, EMOJI.map((em) => h("button", { type: "button", onclick: () => { if ((box.value + em).length <= 500) { box.value = (box.value ? box.value.replace(/\s*$/, " ") : "") + em; box.focus(); } } }, em)));

    // Keep going, reveal, end.
    const controls = h("div", { class: "whisper-controls" });
    const drawControls = (v) => {
      const keepTxt = v.keep.me ? (v.keep.them ? "⏳ Kept!" : "⏳ Waiting for them to keep going") : v.keep.them ? "⏳ They want more. Keep going?" : "⏳ Keep going";
      const keep = h("button", { type: "button", class: "btn small" + (v.keep.them && !v.keep.me ? " gold" : ""), disabled: v.keep.me }, keepTxt);
      keep.addEventListener("click", async () => { try { const r = await pb.send(`/api/vc/whispers/${c.id}/keep`, { method: "POST" }); c.expires = r.expires; drawControls(r); drawHead(); toast(r.keep.me ? "Waiting for them to keep going too" : "Another 24 hours ⏳"); } catch (err) { toast(errMsg(err), true); } });
      const revTxt = v.reveal.me ? (v.reveal.them ? "🎭 Revealed" : "🎭 Undo reveal") : v.reveal.them ? "🎭 They want to reveal. You too?" : "🎭 Reveal me";
      const reveal = h("button", { type: "button", class: "btn small" + (v.reveal.them && !v.reveal.me ? " gold" : ""), disabled: v.reveal.me && v.reveal.them,
        title: "Names are only shown when you both tap Reveal" }, revTxt);
      reveal.addEventListener("click", async () => { try { const r = await pb.send(`/api/vc/whispers/${c.id}/reveal`, { method: "POST" }); drawControls(r); drawReveal(r); toast(r.revealed ? `🎭 It's ${r.revealed.display_name}!` : r.reveal.me ? "Ready to reveal. If they tap it too, you'll see each other." : "Reveal undone"); } catch (err) { toast(errMsg(err), true); } });
      const end = h("button", { type: "button", class: "btn small ghost" }, "🚪 End");
      end.addEventListener("click", async () => { if (!confirm("End this whisper? The messages will be deleted.")) return; try { await pb.send(`/api/vc/whispers/${c.id}/end`, { method: "POST", body: {} }); toast("Whisper ended"); go("/whispers"); } catch (err) { toast(errMsg(err), true); } });
      const block = h("button", { type: "button", class: "btn small danger" }, "🚫 End & block");
      block.addEventListener("click", async () => { if (!confirm("End this whisper and never be matched with them again?")) return; try { await pb.send(`/api/vc/whispers/${c.id}/end`, { method: "POST", body: { block: true } }); toast("Ended and blocked"); go("/whispers"); } catch (err) { toast(errMsg(err), true); } });
      controls.replaceChildren(keep, reveal, end, block);
    };
    const revealHolder = h("div", {});
    const drawReveal = (v) => revealHolder.replaceChildren(v.revealed ? h("div", { class: "match-banner whisper-reveal" }, "🎭 You revealed to each other: ", personChip(v.revealed)) : "");
    const head = h("section", { class: "whisper-head" });
    const drawHead = () => head.replaceChildren(...[
      h("a", { class: "see-all", href: "/whispers", "data-nav": "" }, "← Whispers"),
      h("h1", {}, c.them),
      h("p", { class: "hunt-meta" }, `You're ${c.me} · ${heat[1]} · ${live ? left(c.expires) : c.status === "faded" ? "faded" : "ended"}`),
      c.shared && c.shared.length ? h("p", { class: "faint" }, "You both like: " + c.shared.join(", ")) : null].filter(Boolean));
    drawHead(); drawControls(c); drawReveal(c);

    app.replaceChildren(...[head, revealHolder,
      h("section", { class: "panel whisper-chat" }, thread,
        live ? h("div", { class: "whisper-compose" }, box, h("div", { class: "actions", style: "margin:0" }, send)) : h("p", { class: "muted" }, c.endedBy === "them" ? "They ended this whisper." : "This whisper has ended."),
        live ? h("div", { class: "quick-picker" }, h("span", { class: "faint" }, "Need an opener?"), quick, emojis) : null),
      live ? controls : null,
      h("p", { class: "faint center" }, "Anonymous until you both reveal. ⚑ on any of their messages reports it to the admins.")].filter(Boolean));
    thread.scrollTop = thread.scrollHeight;

    if (live) poll = setInterval(async () => {
      if (!document.body.contains(thread)) return clearInterval(poll);
        if (document.hidden) return;   // background tabs wait until you look at them again
      try {
        const fresh = await pb.send(`/api/vc/whispers/${c.id}?after=${encodeURIComponent(lastAt)}`, {});
        if (fresh.status !== "active") { clearInterval(poll); renderChat(app, c.id); return; }
        const theirs = fresh.messages.filter((m) => !thread.querySelector(`[data-id="${m.id}"]`));
        if (theirs.length) { const emptyNote = thread.querySelector(".wempty"); if (emptyNote) emptyNote.remove(); addMsgs(theirs); }
        drawControls(fresh); drawReveal(fresh); c.expires = fresh.expires;
      } catch {}
    }, 5000);
  }

  window.VCWhisper = { renderLobby, renderChat, deps: null };
})();
