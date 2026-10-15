/* Kink Bingo, built into the site. A fresh 5×5 card every month (Pacific time), middle square free.
   Tick squares on your honour; the ✨ ones tick themselves when the site sees you do them. Lines and blackouts get shout-outs.
   Uses helpers app.js shares on window.VCBingo.deps. */
(() => {
  "use strict";
  const deps = () => window.VCBingo.deps;
  const KIND = { community: "🏘️ Community", social: "💬 Social", selfcare: "💜 Self-care", spicy: "🌶️ Spicy", free: "" };
  const monthName = (m) => new Date(m + "-15T12:00:00Z").toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const daysLeft = (to) => { const t = Date.parse(String(to).replace(" ", "T")); return Math.max(0, Math.ceil((t - Date.now()) / 86400000)); };

  // A little burst of confetti for a new line.
  function burst(h) {
    const box = h("div", { class: "bingo-burst", "aria-hidden": "true" });
    const bits = ["💜", "🎉", "✨", "🔥", "💋", "⭐"];
    for (let i = 0; i < 26; i++) {
      const s = h("span", {}, bits[i % bits.length]);
      s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * 0.4 + "s"; s.style.fontSize = 14 + Math.random() * 18 + "px";
      box.append(s);
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 2600);
  }

  async function render(app) {
    const { h, pb, toast, errMsg, personChip } = deps();
    document.title = "Kink Bingo · Velvet Collar";
    let d = await pb.send("/api/vc/bingo", {});
    let swapping = false;
    const root = h("div", { class: "bingo" });

    function grid() {
      const c = d.card;
      return h("div", { class: "bingo-grid" + (swapping ? " swapping" : ""), role: "grid", "aria-label": "Your bingo card" },
        c.squares.map((s) => {
          const label = `${s.text}${s.on ? ", done" : ""}${s.auto ? " (ticked by the site)" : ""}`;
          const b = h("button", { type: "button", class: `bingo-sq k-${s.kind}${s.on ? " on" : ""}${s.win ? " win" : ""}${s.auto ? " auto" : ""}`, "aria-pressed": String(s.on), "aria-label": label, title: s.text + (s.canAuto ? " ✨ ticks itself when you do it" : "") },
            h("span", { class: "bingo-emo", "aria-hidden": "true" }, s.emoji), h("span", { class: "bingo-txt" }, s.text),
            s.canAuto ? h("span", { class: "bingo-auto", "aria-hidden": "true" }, "✨") : null,
            s.on && s.kind !== "free" ? h("span", { class: "bingo-dab", "aria-hidden": "true" }) : null);
          if (s.kind === "free") { b.disabled = true; return b; }
          b.addEventListener("click", async () => {
            try {
              if (swapping) {
                if (s.on) return toast("Swap a square you haven't done yet.", true);
                d.card = (await pb.send("/api/vc/bingo/swap", { method: "POST", body: { id: s.id } })).card;
                swapping = false; toast("🔄 Swapped"); draw(); return;
              }
              if (s.auto) return toast("✨ The site ticked this one for you.");
              const r = await pb.send("/api/vc/bingo/tick", { method: "POST", body: { id: s.id } });
              const wasFull = !!d.card.full_at;
              d.card = r.card;
              if (r.card.full_at && !wasFull) { burst(h); toast("🌟 BLACKOUT! The whole card. Legend."); d = await pb.send("/api/vc/bingo", {}); }
              else if (r.newLine) { burst(h); toast(r.card.lines === 1 ? "🎉 BINGO! Your first line!" : `🎉 BINGO! That's ${r.card.lines} lines.`); d = await pb.send("/api/vc/bingo", {}); }
              draw();
            } catch (err) { toast(errMsg(err), true); }
          });
          return b;
        }));
    }

    function head() {
      const c = d.card;
      return h("section", { class: "playroom-head" },
        h("h1", {}, "🔢 Kink Bingo"),
        h("p", { class: "muted" }, `Your card for ${monthName(c.month)}. ${daysLeft(d.endsAt)} day${daysLeft(d.endsAt) === 1 ? "" : "s"} left, then a fresh one.`));
    }
    function stats() {
      const c = d.card;
      return h("div", { class: "tod-stats bingo-stats" },
        h("span", { class: "tod-stat" }, h("b", {}, `✅ ${c.ticked}/24`), h("small", {}, "squares")),
        h("span", { class: "tod-stat" }, h("b", {}, `🎉 ${c.lines}`), h("small", {}, c.lines === 1 ? "line" : "lines")),
        h("button", { type: "button", class: "tod-stat tod-stat-btn" + (swapping ? " active" : ""), disabled: !c.swapsLeft, "aria-pressed": String(swapping), onclick: () => { swapping = !swapping; draw(); if (swapping) toast("Tap a square you haven't done to swap it."); } },
          h("b", {}, `🔄 ${c.swapsLeft}`), h("small", {}, swapping ? "tap a square…" : `swap${c.swapsLeft === 1 ? "" : "s"} left`)),
        h("span", { class: "tod-stat" }, h("b", {}, `👥 ${d.players}`), h("small", {}, "playing")));
    }
    function howTo() {
      return h("details", { class: "panel cb-rules" }, h("summary", {}, h("b", {}, "📜 How it works")),
        h("ul", {},
          h("li", {}, "Tap a square when you've done it. It's the honour system, so play fair 😇"),
          h("li", {}, "✨ squares tick themselves when the site sees you do them (RSVPs, going to an event, notes, vouches and more)."),
          h("li", {}, "Five in a row, a column or a diagonal is a BINGO. The free 💜 middle counts."),
          h("li", {}, "Fill the whole card for a 🌟 blackout. First lines and blackouts get a shout-out below."),
          h("li", {}, "Not feeling a square? Swap it for another, twice a month. Squares that touch your limits never show up."),
          h("li", {}, "A new card is dealt on the 1st of every month.")));
    }
    function shoutouts() {
      const S = d.shoutouts || [];
      const full = S.filter((x) => x.full_at).sort((a, b) => a.full_at.localeCompare(b.full_at));
      const quiet = h("input", { type: "checkbox", checked: !!d.card.quiet });
      quiet.addEventListener("change", async () => { try { await pb.send("/api/vc/bingo/quiet", { method: "POST", body: { quiet: quiet.checked } }); d = await pb.send("/api/vc/bingo", {}); draw(); } catch (err) { toast(errMsg(err), true); } });
      const medal = (i) => ["🥇", "🥈", "🥉"][i] || "🎉";
      return h("section", { class: "panel bingo-shout" },
        h("h2", {}, "📣 Shout-outs"),
        full.length ? h("div", { class: "bingo-full" }, h("b", {}, "🌟 Blackout club: "), ...full.map((x) => personChip(x.member))) : null,
        S.length ? h("ol", { class: "tod-leaders" }, S.map((x, i) => h("li", { class: i === 0 ? "first" : "" }, h("span", { class: "tod-rank" }, medal(i)), personChip(x.member),
          h("small", { class: "faint" }, `${x.lines} line${x.lines === 1 ? "" : "s"}${x.full_at ? " · 🌟 blackout" : ""}${i === 0 ? " · first to bingo this month" : ""}`))))
          : h("p", { class: "muted" }, "Nobody's called bingo yet this month. It could be you."),
        h("label", { class: "check" }, quiet, " Keep me off the shout-outs"));
    }
    function past() {
      if (!d.past.length) return "";
      return h("details", { class: "panel cb-mine" }, h("summary", {}, h("b", {}, `🗂️ Past cards (${d.past.length})`)),
        h("div", { class: "cb-mine-list" }, d.past.map((p) => h("div", { class: "cb-mine-item cb-row" }, h("b", {}, monthName(p.month)),
          h("small", { class: "faint" }, `${p.ticked}/24 · ${p.lines} line${p.lines === 1 ? "" : "s"}${p.full ? " · 🌟 blackout" : ""}`)))));
    }
    function legend() {
      return h("p", { class: "faint bingo-legend" }, Object.entries(KIND).filter(([k]) => k !== "free").map(([k, l]) => h("span", { class: "bingo-key k-" + k }, l)), h("span", {}, "✨ ticks itself"));
    }
    function draw() {
      root.replaceChildren(head(), stats(), d.card.full_at ? h("div", { class: "bingo-banner" }, "🌟 Blackout! You filled the whole card.") : d.card.lines ? h("div", { class: "bingo-banner" }, `🎉 BINGO × ${d.card.lines}`) : "",
        grid(), legend(), howTo(), shoutouts(), past());
    }
    draw();
    app.replaceChildren(root);
  }

  window.VCBingo = { render };
})();
