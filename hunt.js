/* The Hunt: a turn-by-turn text chase between two members who've opted in.
   Uses helpers app.js shares on window.VCHunt.deps (h, pb, toast, go, me, errMsg, personChip, miniAvatar, parseTags, copyText). */
(() => {
  "use strict";

  const SPOTS = [
    { e: "🌳", n: "Old oak" }, { e: "💧", n: "Creek bed" }, { e: "🛖", n: "Abandoned cabin" },
    { e: "🌿", n: "Thorn thicket" }, { e: "🌕", n: "Moonlit clearing" }, { e: "🪨", n: "Rocky ledge" },
  ];
  const HOURS = ["Midnight", "1 AM", "2 AM", "3 AM", "4 AM"];
  const HEATS = [
    ["flirty", "😊 Flirty", "Playful and suggestive"],
    ["teasing", "😏 Teasing", "Breathless chasing, a little rough"],
    ["spicy", "🔥 Spicy", "Pinned, caught and claimed"],
  ];
  const FORFEITS = ["A cheeky selfie", "Three compliments, out loud in the group", "A voice note saying \"you win\"",
    "Winner picks my next mood sticker", "Winner's choice: truth or dare"];
  const OPTS = [["off", "Not playing"], ["prey", "🐇 Hunt me"], ["hunter", "🐺 I hunt"], ["both", "🔁 Either"]];

  // Narration. {h} = hunter, {p} = prey, {s} = spot.
  const TEXT = {
    close: {
      flirty: ["{h} checks the {s}. Empty, but there's a giggle from somewhere close by…", "Nothing at the {s}, though {h} spots a dropped ribbon. Warm. Very warm."],
      teasing: ["{h} tears through the {s}. Nothing… but the scent is fresh. {p} is near, heart pounding.", "The {s} is empty, but a twig snaps right next door. {h} smiles."],
      spicy: ["{h} rips the {s} apart. Empty. But {p} is breathing hard just out of reach.", "Not at the {s}. Close, though. Close enough that {h} can almost taste it."],
    },
    far: {
      flirty: ["{h} peeks into the {s}. Not a trace. {p} is probably very smug right now.", "The {s} is empty. Somewhere far off, {p} is humming."],
      teasing: ["{h} prowls the {s}, but the trail's gone cold. Wherever {p} is, they're quiet.", "Nothing at the {s}. {h} pauses, listening. Silence."],
      spicy: ["{h} stalks the {s}, growling. Nothing. {p} is out there, and the hunger only grows.", "Empty. {h} slams a hand against the {s}. Patience. The night is long."],
    },
    caught: {
      flirty: ["Found you! {h} pops up at the {s} and {p} is caught, red-cheeked and laughing."],
      teasing: ["A hand closes around {p}'s wrist at the {s}. {h} pulls them in close: \"Got you.\""],
      spicy: ["{h} pins {p} against the {s}. No more running. Caught, claimed, and very much theirs."],
    },
    escaped: {
      flirty: ["The sky turns pink. {p} skips out of the forest without a scratch. {h} owes up!"],
      teasing: ["Dawn breaks. {p} slips free into the morning light, leaving {h} empty-handed and wanting."],
      spicy: ["First light. {p} escapes, breathless and smug, while {h} is left aching for next time."],
    },
  };
  const pick = (list, seed) => list[Math.abs(seed) % list.length];
  const fill = (t, v) => t.replace(/\{h\}/g, v.h).replace(/\{p\}/g, v.p).replace(/\{s\}/g, v.s);

  function deps() { return window.VCHunt.deps; }

  // ---------- lobby ----------
  async function renderLobby(app, startSlug) {
    const { h, pb, toast, go, errMsg, personChip } = deps();
    document.title = "The Hunt · Velvet Collar";
    clearInterval(poll);
    const [data, players, queue] = await Promise.all([pb.send("/api/vc/hunts", {}), pb.send("/api/vc/hunt-players", {}), pb.send("/api/vc/hunt-queue", {})]);
    let opt = data.opt || "off";

    const optRow = h("div", { class: "pills", role: "group", "aria-label": "Hunt settings" });
    const drawOpt = () => optRow.replaceChildren(...OPTS.map(([v, label]) => h("button", { type: "button", class: "pill", "aria-pressed": String(opt === v), onclick: async () => {
      try {
        const me = deps().me(); const upd = await pb.collection("members").update(me.id, { hunt_opt: v }); pb.authStore.save(pb.authStore.token, upd); opt = v; drawOpt();
        // Keep a random-queue spot on the same side as this setting.
        if (current && current.queued) {
          if (v === "off") { drawRandom(await pb.send("/api/vc/hunt-queue", { method: "DELETE" })); clearInterval(poll); toast("You're out of the hunt and the queue"); return; }
          const role = { prey: "prey", hunter: "hunter", both: "either" }[v];
          if (role !== current.queued.role) {
            const r = await pb.send("/api/vc/hunt-queue", { method: "POST", body: { role, heats: current.queued.heats } });
            if (r.matched) { toast("🎲 Matched! The hunt is on 🌕"); go("/hunt/" + r.matched); return; }
            drawRandom(r); toast("Saved, and your queue spot switched to match 🏹"); return;
          }
        }
        toast(v === "off" ? "You're out of the hunt" : "Saved. Let the games begin 🏹");
      }
      catch (err) { toast(errMsg(err), true); }
    } }, label)));
    drawOpt();

    const statusText = (g) => g.invitedMe ? "🔔 Invited you" : g.status === "invited" ? "Waiting for them to accept" : g.myTurn ? "⚡ Your turn" :
      g.status === "active" ? `Their turn · ${HOURS[g.round - 1] || ""}` : { caught: g.role === "hunter" ? "🐺 You caught them" : "🪤 You got caught", escaped: g.role === "prey" ? "🌅 You escaped" : "💨 They escaped",
        red: "🛑 Stopped (red)", declined: "Declined", cancelled: "Cancelled" }[g.status] || g.status;
    const games = data.hunts.slice().sort((a, b) => (b.invitedMe || b.myTurn) - (a.invitedMe || a.myTurn));
    const gameList = games.length ? h("div", { class: "hunt-list" }, games.map((g) => h("a", { class: "hunt-row" + (g.invitedMe || g.myTurn ? " hot" : ""), href: "/hunt/" + g.id, "data-nav": "" },
      g.other ? deps().miniAvatar(g.other) : null,
      h("span", { class: "txt" }, h("b", {}, (g.role === "hunter" ? "🐺 You're hunting " : "🐇 Hunted by ") + (g.other ? g.other.display_name : "someone"), g.random ? h("span", { class: "new-pill" }, "🎲 Random") : null),
        h("small", {}, statusText(g) + " · " + (HEATS.find((x) => x[0] === g.heat) || [, ""])[1])),
      h("span", { class: "arrow", "aria-hidden": "true" }, "→")))) : h("p", { class: "muted" }, "No hunts yet.");

    // Start a hunt
    const startHolder = h("div", {});
    const openStart = (p) => {
      const me = deps().me();
      const iCanHunt = ["hunter", "both"].includes(opt), iCanRun = ["prey", "both"].includes(opt);
      const theyRun = ["prey", "both"].includes(p.opt), theyHunt = ["hunter", "both"].includes(p.opt);
      const roles = [];
      if (iCanHunt && theyRun) roles.push(["hunter", `🐺 I hunt ${p.display_name}`]);
      if (iCanRun && theyHunt) roles.push(["prey", `🐇 ${p.display_name} hunts me`]);
      if (!roles.length) { startHolder.replaceChildren(h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, opt === "off" ? "Pick how you want to play above first." : `${p.display_name} is up for ${({ prey: "being hunted", hunter: "hunting" })[p.opt] || "something else"}, which doesn't match your setting. Try "Either".`))); return; }
      let role = roles[0][0], heat = "flirty";
      const roleRow = h("div", { class: "pills" }); const heatRow = h("div", { class: "pills" });
      const drawRows = () => {
        roleRow.replaceChildren(...roles.map(([v, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(role === v), onclick: () => { role = v; drawRows(); } }, l)));
        heatRow.replaceChildren(...HEATS.map(([v, l, d]) => h("button", { type: "button", class: "pill", title: d, "aria-pressed": String(heat === v), onclick: () => { heat = v; drawRows(); } }, l)));
      };
      drawRows();
      const forfeit = h("input", { type: "text", maxlength: 140, placeholder: "e.g. A cheeky selfie", list: "hunt-forfeits", "aria-label": "Forfeit" });
      const msg = h("input", { type: "text", maxlength: 200, placeholder: "Optional: a little message with the invite", "aria-label": "Message" });
      const send = h("button", { type: "button", class: "btn gold" }, "🏹 Send the invite");
      send.addEventListener("click", async () => {
        send.disabled = true;
        try { const g = await pb.send("/api/vc/hunts", { method: "POST", body: { slug: p.slug, role, heat, forfeit: forfeit.value.trim(), message: msg.value.trim() } }); toast("Invite sent! Give them a nudge in Telegram."); go("/hunt/" + g.id); }
        catch (err) { toast(errMsg(err), true); send.disabled = false; }
      });
      startHolder.replaceChildren(h("section", { class: "panel hunt-start" },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "Hunt with ", p.display_name), h("button", { type: "button", class: "btn small ghost", onclick: () => startHolder.replaceChildren() }, "Close")),
        h("span", { class: "label" }, "Who's chasing who"), roleRow,
        h("span", { class: "label" }, "Heat"), heatRow,
        h("span", { class: "label" }, "The forfeit", h("small", { class: "faint" }, " (whoever loses owes it)")), forfeit,
        h("datalist", { id: "hunt-forfeits" }, FORFEITS.map((f) => h("option", { value: f }))),
        h("span", { class: "label" }, "Message"), msg,
        h("p", { class: "faint" }, "They'll need to accept before it starts. Either of you can call 🛑 Red at any moment."),
        send));
      startHolder.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    const playerList = players.players.length ? h("div", { class: "people hunt-players" }, players.players.map((p) => {
      const b = h("button", { type: "button", class: "person" }, deps().miniAvatar(p), h("span", {}, p.display_name), h("small", { class: "faint" }, { prey: "🐇", hunter: "🐺", both: "🔁" }[p.opt] || ""));
      b.addEventListener("click", () => openStart(p));
      return b;
    })) : h("p", { class: "muted" }, "Nobody on the member list has opted in yet. Be the first!");

    // Random hunt: wait to be paired with someone from the other side.
    const randomBox = h("section", { class: "panel hunt-random" });
    let current = queue;
    const drawRandom = (q) => {
      current = q;
      const w = q.waiting || {};
      const others = (w.prey || 0) + (w.hunter || 0) + (w.either || 0);
      const waitingLine = h("p", { class: "faint" }, others
        ? `${q.queued ? "Also waiting" : "Waiting right now"}: 🐇 ${w.prey || 0} prey · 🐺 ${w.hunter || 0} hunters · 🔁 ${w.either || 0} either`
        : q.queued ? "Nobody else is waiting yet. You're first in line, so the next person who joins from the other side gets you." : "Nobody's waiting right now. Join and you'll be first in line.");
      if (q.queued) {
        const roleLabel = { prey: "🐇 prey", hunter: "🐺 a hunter", either: "🔁 either role" }[q.queued.role];
        const leave = h("button", { type: "button", class: "btn small ghost" }, "Leave the queue");
        leave.addEventListener("click", async () => { try { drawRandom(await pb.send("/api/vc/hunt-queue", { method: "DELETE" })); clearInterval(poll); toast("Out of the queue"); } catch (err) { toast(errMsg(err), true); } });
        randomBox.replaceChildren(h("h2", {}, "🎲 Random hunt"),
          h("p", { class: "queue-on" }, h("span", { class: "dot", "aria-hidden": "true" }), `You're in the forest as ${roleLabel} (${q.queued.heats.map((x) => (HEATS.find((y) => y[0] === x) || [, x])[1]).join(", ")}). The moment someone from the other side joins, your hunt starts.`),
          waitingLine,
          h("p", { class: "faint" }, "Your spot lasts 24 hours. You can close this page; the game will be waiting in Your hunts."),
          h("div", { class: "actions" }, leave));
        clearInterval(poll);
        poll = setInterval(async () => {
          if (!document.body.contains(randomBox)) return clearInterval(poll);
          try {
            const fresh = await pb.send("/api/vc/hunts", {});
            const nu = fresh.hunts.find((x) => x.random && x.status === "active" && !data.hunts.some((y) => y.id === x.id));
            if (nu) { clearInterval(poll); toast("🎲 You've been matched! The hunt is on 🌕"); go("/hunt/" + nu.id); }
          } catch {}
        }, 20000);
        return;
      }
      let role = { prey: "prey", hunter: "hunter" }[opt] || "either";
      const heats = new Set(["flirty", "teasing"]);
      const roleRow = h("div", { class: "pills" }), heatRow = h("div", { class: "pills" });
      const drawRows = () => {
        roleRow.replaceChildren(...[["prey", "🐇 Be the prey"], ["hunter", "🐺 Be the hunter"], ["either", "🔁 Either"]].map(([v, l]) =>
          h("button", { type: "button", class: "pill", "aria-pressed": String(role === v), onclick: () => { role = v; drawRows(); } }, l)));
        heatRow.replaceChildren(...HEATS.map(([v, l, d]) => h("button", { type: "button", class: "pill", title: d, "aria-pressed": String(heats.has(v)),
          onclick: () => { if (heats.has(v) && heats.size > 1) heats.delete(v); else heats.add(v); drawRows(); } }, l)));
      };
      drawRows();
      const join = h("button", { type: "button", class: "btn gold" }, "🌲 Throw me in the forest");
      join.addEventListener("click", async () => {
        join.disabled = true;
        try {
          const r = await pb.send("/api/vc/hunt-queue", { method: "POST", body: { role, heats: [...heats] } });
          // Match "Are you playing?" to the side picked here.
          const wantOpt = { prey: "prey", hunter: "hunter", either: "both" }[role];
          if (opt !== wantOpt) {
            try { const me = deps().me(); const upd = await pb.collection("members").update(me.id, { hunt_opt: wantOpt }); pb.authStore.save(pb.authStore.token, upd); opt = wantOpt; drawOpt(); } catch {}
          }
          if (r.matched) { toast("🎲 Matched straight away! The hunt is on 🌕"); go("/hunt/" + r.matched); return; }
          toast("You're in the queue. We'll pair you as soon as someone joins.");
          drawRandom(r);
        } catch (err) { toast(errMsg(err), true); join.disabled = false; }
      });
      randomBox.replaceChildren(h("h2", {}, "🎲 Random hunt"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Don't want to pick? Say which side you want and get paired with a random member from the other side. The game starts as soon as you're matched (you've both said yes by joining)."),
        h("span", { class: "label" }, "I want to"), roleRow,
        h("span", { class: "label" }, "Heat I'm up for", h("small", { class: "faint" }, " (pick one or more)")), heatRow,
        waitingLine, h("div", { class: "actions" }, join));
    };
    drawRandom(queue);

    const st = data.stats || {};
    app.replaceChildren(...[
      h("section", { class: "hunt-hero" },
        h("div", { class: "hunt-moon", "aria-hidden": "true" }, "🌕"),
        h("h1", {}, "The Hunt"),
        h("p", {}, "Midnight in the forest. One of you hides, one of you hunts. Each hour the prey slips to a new hiding spot and the hunter searches one. Find them before dawn and they're yours. Survive until 4 AM and the prey wins."),
        st.played ? h("p", { class: "faint" }, `Your record: 🐺 ${st.catches} caught · 🌅 ${st.escapes} escaped`) : null),
      h("section", { class: "panel" }, h("h2", {}, "Are you playing?"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Only people who opt in can be invited. Change it any time."), optRow),
      randomBox,
      h("section", { class: "panel" }, h("h2", {}, "Your hunts"), gameList),
      h("section", { class: "panel" }, h("h2", {}, "Invite someone"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "🐇 wants to be hunted · 🐺 likes to hunt · 🔁 either. Only people on the member list show here."), playerList),
      startHolder,
      h("section", { class: "panel hunt-rules" }, h("h2", {}, "How it works"),
        h("ol", {},
          h("li", {}, "Join a 🎲 Random hunt to be paired with someone from the other side, or invite someone and pick the heat and a forfeit. Invites need a yes (passing is fine, no hard feelings)."),
          h("li", {}, "Each hour, the prey hides in one of six spots. They can't stay put two hours in a row."),
          h("li", {}, "The hunter searches one spot. Spots are on a trail; searching right next to the prey means you hear them."),
          h("li", {}, "Catch them before dawn (4 hours) and the hunter claims them. Otherwise the prey escapes."),
          h("li", {}, "The winner gets the last word, and the loser owes the forfeit."),
          h("li", {}, "🛑 Red stops the game instantly for either of you. No winner, no forfeit, no questions.")))].filter(Boolean));
    if (startSlug) { const p = players.players.find((x) => x.slug === startSlug); if (p) openStart(p); }
  }

  // ---------- one game ----------
  let poll = null;
  async function renderGame(app, id) {
    const { h, pb, toast, go, errMsg, personChip, parseTags, copyText } = deps();
    clearInterval(poll);
    let g;
    try { g = await pb.send("/api/vc/hunts/" + encodeURIComponent(id), {}); }
    catch (err) { app.replaceChildren(h("div", { class: "center-msg" }, h("h1", {}, "No hunt here"), h("p", { class: "muted" }, errMsg(err)), h("a", { class: "btn", href: "/hunt", "data-nav": "" }, "Back to the Hunt"))); return; }
    document.title = "The Hunt · Velvet Collar";
    const me = deps().me();
    const other = g.other || { display_name: "them" };
    // Narration uses both names (it reads better than "You pauses").
    const myName = me.display_name || "You";
    const names = { h: g.role === "hunter" ? myName : other.display_name, p: g.role === "prey" ? myName : other.display_name };
    const nameOf = (r) => (r === g.role ? "You" : other.display_name);
    const heat = HEATS.find((x) => x[0] === g.heat) || HEATS[0];
    const over = ["caught", "escaped", "red", "declined", "cancelled"].includes(g.status);

    // Story so far
    const story = h("ol", { class: "hunt-log" });
    g.log.forEach((r, i) => {
      const lines = [];
      const hour = HOURS[r.round - 1] || "";
      if (r.prey_spot !== undefined && r.prey_spot !== null && (g.role === "prey" || over))
        lines.push(h("p", { class: "hide-line" }, `${g.role === "prey" ? "You" : other.display_name} slipped into the ${SPOTS[r.prey_spot].n.toLowerCase()} ${SPOTS[r.prey_spot].e}`));
      if (r.prey_line) lines.push(h("p", { class: "say prey" }, `${nameOf("prey")}: “${r.prey_line}”`));
      if (r.search !== null && r.search !== undefined) {
        if (r.hunter_line) lines.push(h("p", { class: "say hunter" }, `${nameOf("hunter")}: “${r.hunter_line}”`));
        const t = fill(pick(TEXT[r.result] ? TEXT[r.result][g.heat] : ["…"], i + r.search), { h: names.h, p: names.p, s: SPOTS[r.search].n.toLowerCase() });
        lines.push(h("p", { class: "narr " + r.result }, (r.result === "caught" ? "🐺 " : r.result === "close" ? "👂 " : "🍃 ") + t));
      } else if (g.status === "active") lines.push(h("p", { class: "faint" }, g.role === "hunter" ? "They've hidden somewhere…" : "Waiting for the hunter to search…"));
      story.append(h("li", {}, h("span", { class: "hour" }, hour), ...lines));
    });
    if (g.status === "escaped") story.append(h("li", { class: "dawn" }, h("span", { class: "hour" }, "Dawn"), h("p", { class: "narr escaped" }, "🌅 " + fill(pick(TEXT.escaped[g.heat], 0), { h: names.h, p: names.p, s: "" }))));

    // Map: six spots around a trail.
    const searched = new Map(), hid = new Set();
    if (over) g.log.forEach((r) => { if (r.prey_spot !== undefined && r.prey_spot !== null) hid.add(r.prey_spot); });
    if (g.role === "hunter" || over) g.log.forEach((r) => { if (r.search !== null && r.search !== undefined) searched.set(r.search, r.result); });
    let chosen = null;
    const lastPrey = g.lastPreySpot;
    const currentHide = g.role === "prey" && g.log.length && g.log[g.log.length - 1].search == null ? g.log[g.log.length - 1].prey_spot : null;
    const canPick = g.myTurn;
    const map = h("div", { class: "hunt-map", role: "group", "aria-label": "The forest" });
    const drawMap = () => map.replaceChildren(h("div", { class: "trail", "aria-hidden": "true" }), ...SPOTS.map((sp, i) => {
      const blocked = canPick && g.role === "prey" && i === lastPrey;
      const mark = (searched.has(i) ? { caught: "🎯", close: "👂", far: "🔍" }[searched.get(i)] : "") + (hid.has(i) && searched.get(i) !== "caught" ? "🐇" : "");
      const b = h("button", { type: "button", class: "spot" + (chosen === i ? " chosen" : "") + (currentHide === i ? " hiding" : ""), style: `--i:${i}`,
        disabled: !canPick || blocked, "aria-pressed": String(chosen === i), title: blocked ? "You hid here last hour" : sp.n },
        h("span", { class: "se", "aria-hidden": "true" }, sp.e), h("span", { class: "sn" }, sp.n),
        mark ? h("span", { class: "spot-mark", "aria-hidden": "true" }, mark) : null,
        currentHide === i ? h("span", { class: "spot-mark", "aria-hidden": "true" }, "🫣") : null);
      b.addEventListener("click", () => { chosen = i; drawMap(); go2.disabled = false; go2.textContent = (g.role === "prey" ? "Hide in the " : "Search the ") + sp.n.toLowerCase(); });
      return b;
    }));
    const line = h("input", { type: "text", maxlength: 140, placeholder: g.role === "prey" ? "Optional: a taunt for the hunter" : "Optional: something to growl", "aria-label": "Your line" });
    const go2 = h("button", { type: "button", class: "btn gold", disabled: true }, g.role === "prey" ? "Pick a hiding spot" : "Pick a spot to search");
    go2.addEventListener("click", async () => {
      if (chosen === null) return;
      go2.disabled = true;
      try {
        const upd = await pb.send(`/api/vc/hunts/${g.id}/move`, { method: "POST", body: { spot: chosen, line: line.value.trim() } });
        if (upd.status === "caught") toast(g.role === "hunter" ? "🐺 Caught them!" : "🪤 Caught…");
        else if (upd.status === "escaped") toast(g.role === "prey" ? "🌅 You made it to dawn!" : "💨 They got away");
        else toast(g.role === "prey" ? "🫣 Hidden. Send them a nudge!" : "Searched. Their move.");
        renderGame(app, g.id);
      } catch (err) { toast(errMsg(err), true); go2.disabled = false; }
    });

    const nudgeText = () => g.status === "invited"
      ? `🏹 ${other.display_name}, I've invited you to a hunt at midnight 🌕 Dare you? ${location.origin}/hunt/${g.id}`
      : `🏹 Your move in our hunt, ${other.display_name} 👀 ${location.origin}/hunt/${g.id}`;
    const nudge = h("button", { type: "button", class: "btn small" }, "📣 Copy a nudge for Telegram");
    nudge.addEventListener("click", () => copyText(nudgeText(), "📣 Nudge copied! Paste it to them in Telegram."));
    const red = h("button", { type: "button", class: "btn small danger" }, g.status === "invited" ? (g.invitedMe ? "Pass" : "Cancel invite") : "🛑 Red");
    red.addEventListener("click", async () => {
      try { await pb.send(`/api/vc/hunts/${g.id}/red`, { method: "POST" }); toast(g.status === "invited" ? "Done" : "🛑 Game stopped. Check in with each other 💜"); renderGame(app, g.id); }
      catch (err) { toast(errMsg(err), true); }
    });

    // What to do now
    let action;
    if (g.status === "invited" && g.invitedMe) {
      const accept = h("button", { type: "button", class: "btn gold" }, "🏹 I'm in");
      accept.addEventListener("click", async () => { try { await pb.send(`/api/vc/hunts/${g.id}/respond`, { method: "POST", body: { accept: true } }); toast("Game on! 🌕"); renderGame(app, g.id); } catch (err) { toast(errMsg(err), true); } });
      action = h("section", { class: "panel hunt-action" },
        h("h2", {}, `${other.display_name} wants to ${g.role === "prey" ? "hunt you" : "be hunted by you"}`),
        g.message ? h("p", { class: "say" }, `“${g.message}”`) : null,
        h("p", {}, `Heat: ${heat[1]} (${heat[2].toLowerCase()})`),
        g.forfeit ? h("p", {}, `Loser owes: ${g.forfeit}`) : null,
        h("div", { class: "actions" }, accept, red));
    } else if (g.status === "invited") {
      action = h("section", { class: "panel hunt-action" }, h("h2", {}, `Waiting for ${other.display_name} to accept`),
        h("p", { class: "faint" }, "There's no bot, so let them know in Telegram."), h("div", { class: "actions" }, nudge, red));
    } else if (g.status === "active" && g.myTurn) {
      action = h("section", { class: "panel hunt-action your-turn" },
        h("h2", {}, g.role === "prey" ? `${HOURS[g.round - 1]}. Where do you hide?` : `${HOURS[g.round - 1]}. Where do you search?`),
        h("p", { class: "faint" }, g.role === "prey"
          ? (lastPrey !== null ? `You can't stay at the ${SPOTS[lastPrey].n.toLowerCase()}. ` : "") + "Tap a spot on the trail."
          : "Tap a spot on the trail. If they're right next to it, you'll hear them."),
        map, line, h("div", { class: "actions" }, go2, red));
    } else if (g.status === "active") {
      action = h("section", { class: "panel hunt-action" },
        h("h2", {}, `${HOURS[g.round - 1]}. ${other.display_name}'s move`),
        h("p", { class: "faint" }, g.role === "prey" ? "You're hidden. Stay very, very quiet…" : "They're picking a hiding spot. This page checks for their move every 20 seconds."),
        map, h("div", { class: "actions" }, nudge, h("button", { type: "button", class: "btn small ghost", onclick: () => renderGame(app, g.id) }, "Refresh"), red));
      poll = setInterval(async () => {
        if (!document.body.contains(action)) return clearInterval(poll);
        try { const fresh = await pb.send("/api/vc/hunts/" + g.id, {}); if (fresh.updated !== g.updated) { clearInterval(poll); renderGame(app, g.id); } } catch {}
      }, 20000);
    } else {
      const winner = g.status === "caught" ? "hunter" : g.status === "escaped" ? "prey" : null;
      const won = winner === g.role;
      const banner = {
        caught: won ? "🐺 You caught them!" : "🪤 You've been caught", escaped: won ? "🌅 You escaped!" : "💨 They escaped at dawn",
        red: `🛑 ${g.redBy === "you" ? "You" : other.display_name} called red. No winner, no forfeit. Check in with each other 💜`,
        declined: "This hunt was passed on. No hard feelings.", cancelled: "This invite was cancelled.",
      }[g.status];
      const parts = [h("h2", {}, banner)];
      if (winner && g.forfeit) parts.push(h("p", {}, won ? `${other.display_name} owes you: ` : "You owe: ", h("b", {}, g.forfeit)));
      if (g.final_words) parts.push(h("p", { class: "final" }, `${winner === g.role ? "You" : other.display_name}: “${g.final_words}”`));
      else if (won) {
        const ta = h("textarea", { maxlength: 280, rows: 2, placeholder: g.role === "hunter" ? "Your claim: what happens to your catch now?" : "Your victory taunt", "aria-label": "Last word" });
        const send = h("button", { type: "button", class: "btn small gold" }, "Have the last word");
        send.addEventListener("click", async () => { try { await pb.send(`/api/vc/hunts/${g.id}/final`, { method: "POST", body: { text: ta.value.trim() } }); renderGame(app, g.id); } catch (err) { toast(errMsg(err), true); } });
        parts.push(h("p", { class: "faint" }, "Winner gets the last word."), ta, h("div", { class: "actions" }, send));
      } else if (winner) parts.push(h("p", { class: "faint" }, `${other.display_name} gets the last word…`));
      if (winner) {
        const who = (r) => (r === g.role ? (me.display_name || "I") : other.display_name);
        const brag = winner === "hunter" ? `🐺 ${who("hunter")} hunted down ${who("prey")} before dawn in The Hunt 🌕` : `🌅 ${who("prey")} slipped away from ${who("hunter")} and made it to dawn in The Hunt 🌕`;
        parts.push(h("div", { class: "actions" }, h("a", { class: "btn small", href: "/hunt?start=" + (other.slug || ""), "data-nav": "" }, "🔁 Rematch"),
          h("button", { type: "button", class: "btn small ghost", onclick: () => copyText(brag + " " + location.origin + "/hunt", "📣 Copied! Paste it in the group.") }, "📣 Brag in Telegram")));
      } else if (g.status === "red") parts.push(h("div", { class: "actions" }, h("a", { class: "btn small ghost", href: "/hunt", "data-nav": "" }, "Back to the Hunt")));
      action = h("section", { class: "panel hunt-action over " + g.status }, ...parts);
      if (over && winner) map.classList.add("reveal");
    }

    const limits = deps().limitsBody(g.otherLimits, g.otherKj);
    app.replaceChildren(...[
      h("section", { class: "hunt-head" },
        h("a", { class: "see-all", href: "/hunt", "data-nav": "" }, "← The Hunt"),
        h("div", { class: "vs" },
          h("div", { class: "side" }, h("span", { class: "role" }, "🐺 Hunter"), g.role === "hunter" ? h("b", {}, "You") : personChip(other)),
          h("span", { class: "vs-x", "aria-hidden": "true" }, "vs"),
          h("div", { class: "side" }, h("span", { class: "role" }, "🐇 Prey"), g.role === "prey" ? h("b", {}, "You") : personChip(other))),
        h("p", { class: "hunt-meta" }, g.random ? "🎲 Random match · " : "", heat[1], g.status === "active" ? ` · ${HOURS[g.round - 1]} (hour ${g.round} of ${g.rounds})` : "", g.forfeit ? ` · Loser owes: ${g.forfeit}` : "")),
      action,
      over && g.log.length ? h("section", { class: "panel" }, h("h2", {}, "Where everyone was"), map) : null,
      g.log.length ? h("section", { class: "panel" }, h("h2", {}, "The night so far"), story) : null,
      limits ? h("section", { class: "panel hunt-limits limits-box" }, h("h2", {}, `${other.display_name}'s limits`), ...limits)
        : h("section", { class: "panel hunt-limits" }, h("h2", {}, `${other.display_name}'s limits`), h("p", { class: "faint" }, "They haven't listed any limits. Keep it light and check in.")),
      h("p", { class: "faint center" }, "Text only, and always within each other's limits. 🛑 Red ends it instantly for either of you.")].filter(Boolean));
    if (over) drawMap(); else if (g.status === "active") drawMap();
  }

  window.VCHunt = { renderLobby, renderGame, SPOTS, deps: null };
})();
