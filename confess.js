/* The Confession Box, built into the site. Members write anonymously, hosts approve, everyone reacts.
   Nobody's name is stored with a confession: the server keeps a one-way key so you can find your own.
   Uses helpers app.js shares on window.VCConfess.deps (h, pb, toast, errMsg). */
(() => {
  "use strict";
  const deps = () => window.VCConfess.deps;
  const REACTIONS = [["fire", "🔥", "Hot"], ["blush", "😳", "Blushing"], ["heart", "🫶", "Love this for you"], ["laugh", "😂", "Ha"],
    ["metoo", "🙋", "Me too"], ["eyes", "👀", "Curious"], ["purple", "💜", "Support"]];
  const HEATS = [["mild", "🌸", "Mild"], ["spicy", "🌶️", "Spicy"], ["fire", "🔥", "Scorching"]];
  const heatOf = (k) => HEATS.find((x) => x[0] === k) || HEATS[0];
  const PROMPTS = [
    "The first time I realised I was kinky…", "Something I've never said out loud…", "A fantasy I keep coming back to…",
    "The most nervous I've ever been before a scene…", "A kink I judged before I tried it…", "Something on my maybe list I'm working up to…",
    "The best aftercare I've ever had…", "What I wish I'd known when I started…", "A song that puts me in the mood…",
    "The silliest thing that's ever happened mid-scene…", "Something I'm secretly proud of…", "A compliment I still think about…",
    "My guilty-pleasure outfit…", "What actually makes me feel desired…", "A limit I changed my mind about…",
    "Where my mind goes when I'm bored at work…", "A thing I do that nobody in my vanilla life knows…", "My most-used toy, no shame…",
  ];
  const RULES = [
    ["🔞", "Members only, 21 and older."],
    ["🙊", "Only confess about yourself. Don't name, describe or hint at anyone else, in the group or out of it."],
    ["🚪", "A confession isn't an invitation. Someone being curious about something is not a yes to doing it with them."],
    ["🔒", "What's in the box stays in the box. No screenshots or sharing outside the group."],
    ["👀", "Hosts read everything first. Anything mean, coercive or identifying doesn't go up."],
    ["💜", "Reactions are for support. There's no dislike button on purpose."],
  ];
  const ago = (d) => {
    const t = Date.parse(String(d || "").replace(" ", "T")); if (isNaN(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago";
    const dd = Math.round(s / 86400); return dd < 7 ? dd + "d ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

  let filter = "all", sort = "new", shuffleSeed = Math.random();

  async function render(app) {
    const { h, pb, toast, errMsg } = deps();
    document.title = "Confession Box · Velvet Collar";
    let data;
    const load = async () => { data = await pb.send("/api/vc/confessions", {}); };
    await load();

    // ---- the rules (open the first time, folded after that) ----
    const seenRules = store.get("vc_cb_rules") === "1";
    const rules = h("details", { class: "panel cb-rules" }, h("summary", {}, h("b", {}, "📜 Before you confess"), h("small", { class: "faint" }, " · the house rules")),
      h("ul", {}, RULES.map(([e, t]) => h("li", {}, h("span", { "aria-hidden": "true" }, e), " ", t))),
      seenRules ? null : h("button", { type: "button", class: "btn small gold", onclick: () => { store.set("vc_cb_rules", "1"); rules.open = false; } }, "Got it, I'll follow these"));
    rules.open = !seenRules;

    // ---- write one ----
    const text = h("textarea", { maxlength: 1000, rows: 4, placeholder: "Slip a secret through the screen…", "aria-label": "Your confession" });
    const counter = h("small", { class: "faint" }, "0 / 1000");
    let prompt = "";
    const promptLine = h("div", { class: "cb-prompt" });
    const drawPrompt = () => promptLine.replaceChildren(...(prompt
      ? [h("span", {}, "💭 ", h("i", {}, prompt)), h("button", { type: "button", class: "btn small ghost", onclick: () => { prompt = ""; drawPrompt(); } }, "✕")]
      : []));
    const idea = h("button", { type: "button", class: "btn small ghost" }, "🎲 Give me an idea");
    idea.addEventListener("click", () => {
      let p; do { p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]; } while (p === prompt && PROMPTS.length > 1);
      prompt = p; drawPrompt();
      if (!text.value.trim()) { text.placeholder = p; }
      text.focus();
    });
    text.addEventListener("input", () => { counter.textContent = `${text.value.length} / 1000`; });
    let heat = "mild";
    const heatPills = h("div", { class: "pills", role: "radiogroup", "aria-label": "How hot is it?" });
    const drawHeat = () => heatPills.replaceChildren(...HEATS.map(([k, e, l]) => h("button", { type: "button", class: "pill", role: "radio", "aria-checked": String(heat === k), "aria-pressed": String(heat === k), onclick: () => { heat = k; drawHeat(); } }, `${e} ${l}`)));
    drawHeat();
    const cw = h("input", { type: "text", maxlength: 60, placeholder: "Content warning (optional), like “breath play”", "aria-label": "Content warning" });
    const send = h("button", { type: "button", class: "btn gold" }, "💌 Send to the hosts");
    send.addEventListener("click", async () => {
      if (text.value.trim().length < 3) return toast("Write a little more first.", true);
      send.disabled = true;
      try {
        await pb.send("/api/vc/confessions", { method: "POST", body: { text: text.value.trim(), heat, cw: cw.value.trim(), prompt } });
        text.value = ""; cw.value = ""; prompt = ""; drawPrompt(); counter.textContent = "0 / 1000"; text.placeholder = "Slip a secret through the screen…";
        toast("💌 Sent! It shows up once a host approves it.");
        await load(); drawMine();
      } catch (err) { toast(errMsg(err), true); }
      send.disabled = false;
    });
    const composer = h("section", { class: "panel cb-composer" },
      h("h2", {}, "✍️ Write a confession"),
      h("p", { class: "faint", style: "margin-top:-6px" }, "Nobody can see who wrote it, not even the admins. It goes to the hosts first and appears on the wall once they approve it."),
      h("div", { class: "cb-idea-row" }, idea, promptLine), text,
      h("div", { class: "cb-row" }, counter),
      h("span", { class: "label" }, "How hot is it?"), heatPills,
      cw, h("small", { class: "faint" }, "A content warning blurs it until someone taps to read."),
      h("div", { class: "actions", style: "margin-top:4px" }, send));

    // ---- your own confessions ----
    const mine = h("details", { class: "panel cb-mine" });
    const ST = { pending: "⏳ Waiting for the hosts", approved: "✅ On the wall", hidden: "🙈 Not posted" };
    function drawMine() {
      const list = data.mine || [];
      mine.replaceChildren(h("summary", {}, h("b", {}, `🗝️ Your confessions (${list.length})`), h("small", { class: "faint" }, " · only you can see this list")),
        list.length ? h("div", { class: "cb-mine-list" }, list.map((c) => h("div", { class: "cb-mine-item" },
          h("p", {}, c.text),
          h("div", { class: "cb-row" },
            h("small", { class: "cb-st cb-st-" + c.status }, ST[c.status] || c.status),
            c.status === "approved" ? h("small", { class: "faint" }, c.total ? `${c.total} reaction${c.total === 1 ? "" : "s"}` : "No reactions yet") : null,
            h("button", { type: "button", class: "btn small ghost", onclick: async () => {
              if (!confirm("Delete this confession for good?")) return;
              try { await pb.send(`/api/vc/confessions/${c.id}`, { method: "DELETE" }); toast("Deleted"); await load(); drawMine(); drawWall(); } catch (err) { toast(errMsg(err), true); }
            } }, "Delete")))))
          : h("p", { class: "faint" }, "Nothing yet. Your first one is waiting to be written."));
    }

    // ---- the wall ----
    const top = h("div", {});
    const filters = h("div", { class: "pills cb-filters", role: "group", "aria-label": "Filter by heat" });
    const sorts = h("div", { class: "pills cb-sorts", role: "group", "aria-label": "Sort" });
    const wall = h("div", { class: "cb-wall" });
    const card = (c, featured) => {
      const [, he, hl] = heatOf(c.heat);
      const body = h("p", { class: "cb-text" + (c.cw ? " blurred" : "") }, c.text);
      const reveal = c.cw ? h("button", { type: "button", class: "cb-cw", onclick: () => { body.classList.remove("blurred"); reveal.remove(); } }, `⚠️ ${c.cw} · tap to read`) : null;
      const rx = h("div", { class: "cb-reacts" });
      const drawRx = () => rx.replaceChildren(...REACTIONS.map(([k, e, l]) => {
        const n = c.reactions[k] || 0, on = c.mine.includes(k);
        return h("button", { type: "button", class: "cb-rx" + (on ? " on" : ""), "aria-pressed": String(on), title: l, "aria-label": `${l}: ${n}`, onclick: async () => {
          try { Object.assign(c, await pb.send(`/api/vc/confessions/${c.id}/react`, { method: "POST", body: { emoji: k } })); drawRx(); } catch (err) { toast(errMsg(err), true); }
        } }, h("span", { "aria-hidden": "true" }, e), n ? h("b", {}, String(n)) : null);
      }));
      drawRx();
      return h("article", { class: "cb-card heat-" + c.heat + (featured ? " featured" : "") + (c.isMine ? " is-mine" : "") },
        featured ? h("div", { class: "cb-feat" }, "👑 Confession of the week") : null,
        h("div", { class: "cb-meta" }, h("span", { class: "cb-heat" }, `${he} ${hl}`), c.isMine ? h("span", { class: "cb-yours" }, "yours") : null, h("span", { class: "faint" }, ago(c.at))),
        c.prompt ? h("p", { class: "cb-from-prompt faint" }, "💭 " + c.prompt) : null,
        reveal, body, rx);
    };
    function drawWall() {
      filters.replaceChildren(...[["all", "Everything"], ...HEATS.map(([k, e, l]) => [k, `${e} ${l}`])].map(([k, l]) =>
        h("button", { type: "button", class: "pill", "aria-pressed": String(filter === k), onclick: () => { filter = k; drawWall(); } }, l)));
      sorts.replaceChildren(...[["new", "🆕 Newest"], ["loved", "💜 Most loved"], ["shuffle", "🔀 Shuffle"]].map(([k, l]) =>
        h("button", { type: "button", class: "pill", "aria-pressed": String(sort === k), onclick: () => { if (k === "shuffle") shuffleSeed = Math.random(); sort = k; drawWall(); } }, l)));
      const feat = data.items.find((c) => c.id === data.top);
      top.replaceChildren(...(feat && filter === "all" ? [card(feat, true)] : []));
      let list = data.items.filter((c) => (filter === "all" || c.heat === filter) && !(feat && filter === "all" && c.id === feat.id));
      if (sort === "loved") list = list.slice().sort((a, b) => b.total - a.total);
      if (sort === "shuffle") { const r = (id) => { let x = 0; for (const ch of id + shuffleSeed) x = (x * 31 + ch.charCodeAt(0)) % 100003; return x; }; list = list.slice().sort((a, b) => r(a.id) - r(b.id)); }
      wall.replaceChildren(...(list.length ? list.map((c) => card(c)) : [h("p", { class: "muted" }, data.items.length ? "Nothing at this heat yet. Try another filter." : "The wall is empty. Be the first to confess 💌")]));
    }

    drawMine(); drawWall();
    app.replaceChildren(
      h("section", { class: "playroom-head cb-head" },
        h("h1", {}, "💌 The Confession Box"),
        h("p", { class: "muted" }, "Slip a secret through the screen. No names, ever. The group reacts, and nobody wins or loses.")),
      rules, composer, mine,
      h("section", { class: "cb-wall-head" }, h("h2", {}, "On the wall"), filters, sorts),
      top, wall,
      h("p", { class: "faint cb-foot" }, "Seen something on the wall that isn't okay? Tell a host or admin and it comes down, no questions asked."));
  }

  window.VCConfess = { render, deps: null };
})();
