/* Networking: find members who share your kink and romance interests, and browse interest circles.
   Opt-in: nobody appears here, or sees anyone, until they turn it on.
   Uses helpers app.js shares on window.VCNetwork.deps (h, pb, toast, errMsg, personChip, miniAvatar, fileUrl). */
(() => {
  "use strict";
  const deps = () => window.VCNetwork.deps;
  const LOOK = { friends: "🤝 Friends", partners: "💞 Partners", play: "🔥 Play", open: "✨ Open to anything" };
  const STYLE = { single: "Single", mono: "Monogamous", monogamish: "Monogamish", poly: "Polyamorous", solo_poly: "Solo poly", open: "Open relationship", swinger: "Swinger", ra: "Relationship anarchy", exploring: "Still figuring it out",
    enm: "ENM", kitchen_table: "Kitchen table poly", garden_party: "Garden party poly", parallel: "Parallel poly", hierarchical: "Hierarchical poly", non_hierarchical: "Non-hierarchical poly",
    polyfidelity: "Polyfidelity", triad: "Triad / throuple", quad: "Quad", polycule: "Polycule", mono_poly: "Mono/poly" };
  let tab = "matches", realm = "all";

  async function render(app) {
    const { h, pb, toast, errMsg } = deps();
    document.title = "Networking · Velvet Collar";
    let d = await pb.send("/api/vc/network", {});
    const head = h("section", { class: "playroom-head" }, h("h1", {}, "🤝 Networking"),
      h("p", { class: "muted" }, "Find members who share your kinks, your romantic side and your hobbies. Join interest circles, see who else is in them, and say hi."));
    const body = h("div", {});
    app.replaceChildren(head, body);
    const reload = async () => { d = await pb.send("/api/vc/network", {}); draw(); };
    const save = async (payload, msg) => {
      try { const r = await pb.send("/api/vc/network", { method: "POST", body: payload }); if (msg) toast(msg); return r; }
      catch (err) { toast(errMsg(err), true); return null; }
    };
    function draw() { body.replaceChildren(d.opted ? opted() : setup()); }

    // ---- picking circles (used by setup and "My interests") ----
    function picker(sel) {
      const wrap = h("div", { class: "net-picker" });
      const drawP = () => wrap.replaceChildren(...["kink", "romance"].map((r) => h("div", { class: "net-realm" },
        h("h3", {}, r === "kink" ? "⛓️ Kink" : "🌹 Romance"),
        h("div", { class: "pills" }, d.circles.filter((c) => c.realm === r).map((c) => h("button", { type: "button", class: "pill" + (d.suggested.includes(c.key) && !sel.has(c.key) ? " net-sugg" : ""), "aria-pressed": String(sel.has(c.key)),
          title: d.suggested.includes(c.key) ? "Suggested from your profile" : "", onclick: () => { sel.has(c.key) ? sel.delete(c.key) : sel.add(c.key); drawP(); } }, `${c.emoji} ${c.label}`))))));
      drawP();
      return wrap;
    }

    // ---- not in yet: explain and set up ----
    function setup() {
      const sel = new Set(d.mine.length ? d.mine : d.suggested);
      const intro = h("input", { type: "text", maxlength: 200, value: d.intro || "", placeholder: "What you'd love to find here, like “a rope buddy to practise with” or “someone for slow date nights”" });
      const go = h("button", { type: "button", class: "btn gold" }, "🤝 Turn on Networking");
      go.addEventListener("click", async () => {
        if (!sel.size) return toast("Pick at least one interest first.", true);
        go.disabled = true;
        const r = await save({ opt: true, circles: [...sel], intro: intro.value }, "🤝 You're in! Here are your matches.");
        if (r) { tab = "matches"; await reload(); } else go.disabled = false;
      });
      return h("div", {},
        h("section", { class: "panel net-hero" },
          h("h2", {}, "How it works"),
          h("ul", { class: "net-how" },
            h("li", {}, "✨ ", h("b", {}, "Matches: "), "members ranked by the kink, romance and hobby interests you share, with exactly what you have in common."),
            h("li", {}, "🫶 ", h("b", {}, "Circles: "), "interest groups like Rope, Aftercare or Date nights. Join the ones you like and see who else is in."),
            h("li", {}, "🔒 ", h("b", {}, "Opt-in: "), "you only appear here, and only see others, once you turn it on. Your limits are never matched on, and you can leave any time.")),
          h("p", { class: "faint", style: "margin:0" }, `${d.people} member${d.people === 1 ? " has" : "s have"} turned it on so far.`)),
        h("section", { class: "panel" },
          h("h2", {}, "Your interests"),
          h("p", { class: "faint", style: "margin-top:-6px" }, d.suggested.length ? "We've picked some from your profile to start you off. Tap to add or remove." : "Tap the ones you're into. You can change them any time."),
          picker(sel),
          nudges(),
          h("label", { class: "field", style: "margin-top:10px" }, h("span", { class: "label" }, "A line about what you're hoping to find (optional)"), intro),
          h("div", { class: "actions" }, go)));
    }

    // Tips for better matches: add jar shelves.
    function nudges() {
      const tips = [];
      if (!d.has.kink) tips.push(h("li", {}, "🫙 Add your ", h("b", {}, "Kink Jars"), " shelf (or fill in Into & curious about) in ", h("a", { href: "/edit#playroom", "data-nav": "" }, "Edit → Playroom"), " for kink matches."));
      if (!d.has.romance) tips.push(h("li", {}, "💞 Add your ", h("b", {}, "Romantic Jars"), " share link in ", h("a", { href: "/edit#playroom", "data-nav": "" }, "Edit → Playroom"), " for romance matches."));
      if (!d.has.hobbies) tips.push(h("li", {}, "🎨 Pick a few ", h("b", {}, "Hobbies"), " in ", h("a", { href: "/edit", "data-nav": "" }, "Edit → Profile"), " (there's a list to tap from) for hobby matches."));
      return tips.length ? h("ul", { class: "net-tips faint" }, tips) : null;
    }

    // ---- in: matches, circles, my interests ----
    function opted() {
      const tabs = h("div", { class: "pills mod-tabs", role: "tablist" }, [["matches", `✨ Matches (${d.matches.length})`], ["circles", "🫶 Circles"], ["mine", "⚙️ My interests"]].map(([k, l]) =>
        h("button", { type: "button", class: "pill", role: "tab", "aria-selected": String(tab === k), "aria-pressed": String(tab === k), onclick: () => { tab = k; draw(); } }, l)));
      const inner = h("div", {});
      if (tab === "matches") matches(inner); else if (tab === "circles") circles(inner); else mine(inner);
      return h("div", {}, tabs, inner);
    }

    const avatar = (m) => {
      const { miniAvatar } = deps();
      return h("a", { class: "net-av", href: "/" + m.slug, "data-nav": "" }, miniAvatar(m, "net-av-img"), m.online ? h("span", { class: "dot", title: "Online now" }) : null);
    };
    const personHead = (m, extra) => h("div", { class: "net-head" }, avatar(m),
      h("div", { class: "net-who" },
        h("a", { class: "net-name", href: "/" + m.slug, "data-nav": "" }, m.display_name),
        h("small", { class: "faint" }, [m.pronouns, m.dynamic].filter(Boolean).join(" · ")),
        h("div", { class: "net-tags" },
          (m.looking_for || []).filter((x) => LOOK[x]).map((x) => h("span", { class: "net-tag" }, LOOK[x])),
          (m.rel_style || []).map((x) => h("span", { class: "net-tag style" }, "💞 " + (STYLE[x] || x))))),
      extra || null);
    const tg = (m) => m.tg ? h("a", { class: "btn small ghost", href: "https://t.me/" + encodeURIComponent(m.tg), target: "_blank", rel: "noopener" }, "💬 Telegram") : null;

    function matches(holder) {
      const pick = h("div", { class: "pills" }, [["all", "Everything"], ["kink", "⛓️ Kink"], ["romance", "🌹 Romance"], ["hobby", "🎨 Hobbies"]].map(([k, l]) =>
        h("button", { type: "button", class: "pill", "aria-pressed": String(realm === k), onclick: () => { realm = k; draw(); } }, l)));
      const scoreOf = (m) => realm === "kink" ? m.kinkScore : realm === "romance" ? m.romanceScore : realm === "hobby" ? (m.hobbyScore || 0) : m.score;
      const list = d.matches.filter((m) => scoreOf(m) > 0).sort((a, b) => scoreOf(b) - scoreOf(a));
      const best = Math.max(1, ...list.map(scoreOf));
      const chips = (arr, cls) => arr.map((x) => h("span", { class: "net-chip " + cls }, x));
      const card = (m) => {
        const circ = realm === "hobby" ? [] : m.circles.filter((c) => realm === "all" || c.realm === realm);
        const parts = (r) => [
          r.love.length ? h("div", { class: "net-row" }, h("b", {}, "💞 Both love"), chips(r.love, "love")) : null,
          r.enjoy.length ? h("div", { class: "net-row" }, h("b", {}, "😊 Both enjoy"), chips(r.enjoy.slice(0, 8), "enjoy")) : null,
          r.curious.length ? h("div", { class: "net-row" }, h("b", {}, "🤔 Curious together"), chips(r.curious.slice(0, 6), "curious")) : null];
        // Kink and romance rows get a small heading when both show, so "Both love" isn't ambiguous.
        const labelled = (title, rows) => { const r = rows.filter(Boolean); return r.length ? h("div", { class: "net-block" }, realm === "all" ? h("div", { class: "net-block-h" }, title) : null, r) : null; };
        return h("article", { class: "panel net-card" },
          personHead(m, h("div", { class: "net-score", title: "How much you share" }, h("i", {}, h("em", { style: `width:${Math.round(scoreOf(m) / best * 100)}%` })), h("small", { class: "faint" }, "in common"))),
          m.intro ? h("p", { class: "net-intro" }, "“" + m.intro + "”") : null,
          circ.length ? h("div", { class: "net-row" }, h("b", {}, "🫶 Circles"), circ.map((c) => h("span", { class: "net-chip circle" }, `${c.emoji} ${c.label}`))) : null,
          realm === "all" || realm === "kink" ? labelled("⛓️ Kink", parts(m.kink)) : null,
          realm === "all" || realm === "romance" ? labelled("🌹 Romance", parts(m.romance)) : null,
          (realm === "all" || realm === "hobby") && (m.hobbies || []).length ? labelled("🎨 Hobbies", [h("div", { class: "net-row" }, h("b", {}, "🎨 You both like"), chips(m.hobbies.slice(0, 12), "hobby"))]) : null,
          m.lookingBoth.length ? h("p", { class: "faint", style: "margin:6px 0 0" }, "You're both looking for " + m.lookingBoth.map((x) => (LOOK[x] || x).replace(/^\S+\s/, "").toLowerCase()).join(" and ") + ".") : null,
          h("div", { class: "actions", style: "margin-top:10px" }, h("a", { class: "btn small", href: "/" + m.slug, "data-nav": "" }, "View profile"), tg(m)));
      };
      holder.replaceChildren(pick,
        list.length ? h("div", { class: "net-list" }, list.map(card))
          : h("section", { class: "panel" }, h("p", { class: "muted", style: "margin:0" }, d.people ? (realm === "hobby" ? "Nobody shares a hobby with you yet. Add a few more in Edit → Profile." : "No matches yet in this area. Join more circles, or add your jar shelves for better matches.") : "You're the first one here! Matches show up as more members turn on Networking."), nudges()),
        h("p", { class: "faint", style: "text-align:center" }, "Always ask first. Sharing an interest isn't a yes to anything."));
    }

    function circles(holder) {
      const mineSet = new Set(d.mine);
      const view = h("div", {});
      const openCircle = async (c) => {
        view.replaceChildren(h("p", { class: "faint" }, "Loading…"));
        let r; try { r = await pb.send(`/api/vc/network/circle/${c.key}`, {}); } catch (err) { view.replaceChildren(h("p", { class: "muted" }, errMsg(err))); return; }
        view.replaceChildren(h("section", { class: "panel net-circle" },
          h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, `${c.emoji} ${c.label}`), h("button", { type: "button", class: "btn small ghost", onclick: () => view.replaceChildren() }, "Close")),
          h("p", { class: "faint" }, `${r.members.length} member${r.members.length === 1 ? "" : "s"} in this circle.`),
          joinBtn(c),
          r.members.length ? h("div", { class: "net-people" }, r.members.map((m) => h("div", { class: "net-person" }, personHead(m), m.intro ? h("p", { class: "net-intro" }, "“" + m.intro + "”") : null, h("div", { class: "actions", style: "margin:6px 0 0" }, h("a", { class: "btn small", href: "/" + m.slug, "data-nav": "" }, "View profile"), tg(m)))))
            : h("p", { class: "muted" }, "Nobody here yet. Be the first!")));
        view.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      const joinBtn = (c) => h("button", { type: "button", class: "btn small " + (mineSet.has(c.key) ? "ghost" : "gold"), onclick: async () => {
        mineSet.has(c.key) ? mineSet.delete(c.key) : mineSet.add(c.key);
        const r = await save({ circles: [...mineSet] }, mineSet.has(c.key) ? `🫶 Joined ${c.label}` : `Left ${c.label}`);
        if (r) { d = await pb.send("/api/vc/network", {}); circles(holder); openCircle(c); }
      } }, mineSet.has(c.key) ? "Leave circle" : "🫶 Join circle");
      holder.replaceChildren(
        ...["kink", "romance"].map((r) => h("section", { class: "panel" }, h("h2", {}, r === "kink" ? "⛓️ Kink circles" : "🌹 Romance circles"),
          h("div", { class: "net-circles" }, d.circles.filter((c) => c.realm === r).map((c) => h("button", { type: "button", class: "net-circ" + (mineSet.has(c.key) ? " in" : ""), onclick: () => openCircle(c) },
            h("span", { class: "net-circ-e", "aria-hidden": "true" }, c.emoji), h("b", {}, c.label), h("small", {}, `${c.count} member${c.count === 1 ? "" : "s"}${mineSet.has(c.key) ? " · you're in" : ""}`)))))),
        view);
    }

    function mine(holder) {
      const sel = new Set(d.mine);
      const intro = h("input", { type: "text", maxlength: 200, value: d.intro || "", placeholder: "What you'd love to find here" });
      const saveBtn = h("button", { type: "button", class: "btn gold" }, "Save");
      saveBtn.addEventListener("click", async () => { const r = await save({ circles: [...sel], intro: intro.value }, "Saved"); if (r) await reload(); });
      holder.replaceChildren(h("section", { class: "panel" },
        h("h2", {}, "My interests"),
        h("p", { class: "faint", style: "margin-top:-6px" }, "Your circles. Matches also use your Kink Jars and Romantic Jars shelves, your Into list and your Hobbies, and never anything on your limits. Dashed ones are suggested from your profile."),
        picker(sel), nudges(),
        h("label", { class: "field", style: "margin-top:10px" }, h("span", { class: "label" }, "What you're hoping to find (optional)"), intro),
        h("div", { class: "actions" }, saveBtn,
          h("button", { type: "button", class: "btn ghost", onclick: async () => {
            if (!confirm("Leave Networking? You'll disappear from matches and circles. Your picks are kept if you come back.")) return;
            const r = await save({ opt: false }, "You've left Networking."); if (r) await reload();
          } }, "Leave Networking"))));
    }

    draw();
  }

  window.VCNetwork = { render, deps: null };
})();
