/* Velvet Collar Profiles — draws a shareable profile card (1080×1350 PNG) on a canvas. */
(() => {
  "use strict";
  const W = 1080, H = 1350;

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  // The collar-and-heart mark, drawn in `color` with the hollow parts cut out.
  function drawMark(ctx, x, y, w, color) {
    const s = w / 800, hgt = 520 * s;
    const off = document.createElement("canvas"); off.width = Math.ceil(w); off.height = Math.ceil(hgt);
    const o = off.getContext("2d");
    o.scale(s, s); o.translate(-50, -50); o.fillStyle = color;
    o.beginPath(); o.ellipse(447, 175, 388, 115, 0, 0, Math.PI * 2); o.fill();
    o.globalCompositeOperation = "destination-out";
    o.fill(new Path2D("M40 240H130Q447 170 760 240H860V262L835 258Q447 402 60 258L40 262Z"));
    o.globalCompositeOperation = "source-over";
    o.fill(new Path2D("M60 258Q447 402 835 258V370Q447 570 60 370Z"));
    o.globalCompositeOperation = "destination-out";
    o.beginPath(); o.arc(447, 425, 140, 0, Math.PI * 2); o.fill();
    o.globalCompositeOperation = "source-over";
    o.save(); o.translate(-165, -111); o.scale(10.2, 10.2);
    o.fill(new Path2D("M60 63.5s-10.5-6.4-10.5-13.1c0-3.3 2.6-5.7 5.6-5.7 2.2 0 3.9 1.2 4.9 3 1-1.8 2.7-3 4.9-3 3 0 5.6 2.4 5.6 5.7 0 6.7-10.5 13.1-10.5 13.1z"));
    o.restore();
    ctx.drawImage(off, x, y);
    return hgt;
  }

  function wrapLines(ctx, text, maxW, maxLines) {
    const words = String(text).split(/\s+/); const lines = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines) break; }
      else cur = t;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + "…").width > maxW && last.length) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s,.;:]+$/, "") + "…";
    }
    return lines;
  }

  // Centered rows of pills. Returns the y after the last row.
  function pills(ctx, items, y, opts) {
    const { font, padX = 26, h = 62, gap = 14, maxW = W - 160, fill, stroke, color, maxRows = 2 } = opts;
    ctx.font = font;
    const rows = [[]]; let rowW = 0;
    for (const t of items) {
      const w = Math.min(ctx.measureText(t).width + padX * 2, maxW);
      if (rowW + w + (rows[rows.length - 1].length ? gap : 0) > maxW) { if (rows.length === maxRows) break; rows.push([]); rowW = 0; }
      rows[rows.length - 1].push([t, w]); rowW += w + (rows[rows.length - 1].length > 1 ? gap : 0);
    }
    for (const row of rows) {
      const total = row.reduce((a, [, w]) => a + w, 0) + gap * (row.length - 1);
      let x = (W - total) / 2;
      for (const [t, w] of row) {
        rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
        ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        let label = t; while (ctx.measureText(label).width > w - padX * 2 && label.length > 3) label = label.slice(0, -2) + "…";
        ctx.fillText(label, x + w / 2, y + h / 2 + 2);
        x += w + gap;
      }
      y += h + gap;
    }
    return y;
  }

  const loadImage = (src) => new Promise((res) => {
    if (!src) return res(null);
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => res(img); img.onerror = () => res(null); img.src = src;
  });

  async function draw(d) {
    // d: { name, mood, looking:[[emoji,label]], loves:[], ask:{q,a}, url, avatarUrl, look, charm }
    await (document.fonts && document.fonts.ready);
    const look = d.look;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const slab = '"Roboto Slab", Rockwell, Georgia, serif', sans = '"Manrope", system-ui, sans-serif';

    // background + banner
    ctx.fillStyle = "#19191a"; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, 900); glow.addColorStop(0, "rgba(255,255,255,.08)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 420); g.addColorStop(0, look.deep); g.addColorStop(0.55, look.mid); g.addColorStop(1, look.glow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 400);
    ctx.globalAlpha = 0.08; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    for (let x = -400; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, 400); ctx.lineTo(x + 190, 0); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // brand
    const mh = drawMark(ctx, 60, 50, 96, look.accent);
    ctx.fillStyle = "#ecc5ed"; ctx.font = `800 40px ${slab}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("VELVET COLLAR", 172, 50 + mh / 2 + 2);

    // avatar
    const cx = W / 2, cy = 370, r = 132;
    ctx.beginPath(); ctx.arc(cx, cy, r + 22, 0, Math.PI * 2); ctx.fillStyle = "#19191a"; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fillStyle = look.accent; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const img = await loadImage(d.avatarUrl);
    if (img) {
      const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
      ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    } else {
      ctx.fillStyle = "#262529"; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = look.accent; ctx.font = `800 140px ${slab}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((d.name || "?").trim().charAt(0).toUpperCase(), cx, cy + 8);
    }
    ctx.restore();
    if (d.charm) {
      ctx.beginPath(); ctx.arc(cx, cy + r + 30, 30, 0, Math.PI * 2); ctx.fillStyle = "#222224"; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = look.accent; ctx.stroke();
      ctx.font = `34px ${sans}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d.charm, cx, cy + r + 32);
    }

    // name + mood
    let y = cy + r + (d.charm ? 150 : 110);
    let size = 96; ctx.font = `800 ${size}px ${slab}`;
    while (ctx.measureText(d.name).width > W - 140 && size > 50) { size -= 4; ctx.font = `800 ${size}px ${slab}`; }
    ctx.fillStyle = look.name_color || "#ecc5ed"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(d.name, W / 2, y);
    y += 60;
    if (d.mood) { ctx.font = `600 36px ${sans}`; ctx.fillStyle = "#cfc8da"; ctx.fillText(wrapLines(ctx, d.mood, W - 200, 1)[0], W / 2, y); y += 40; }
    y += 20;

    // looking for
    if (d.looking.length) {
      y = pills(ctx, d.looking.map(([e, l]) => `${e} ${l}`), y, { font: `700 32px ${sans}`, fill: "rgba(255,255,255,.06)", stroke: look.accent, color: "#f4eef5", maxRows: 1 });
      y += 10;
    }

    // top loves
    if (d.loves.length) {
      ctx.font = `700 28px ${sans}`; ctx.fillStyle = "#9a96a8"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("Into", W / 2, y + 26); y += 46;
      y = pills(ctx, d.loves.slice(0, 6), y, { font: `600 30px ${sans}`, h: 56, fill: "rgba(152,138,227,.16)", stroke: "rgba(152,138,227,.6)", color: "#f4eef5", maxRows: d.ask ? 1 : 2 });
    }

    // ask me about
    if (d.ask) {
      const bx = 110, bw = W - 220, by = y + 16;
      ctx.font = `500 34px ${sans}`;
      const room = Math.floor((H - 150 - by - 110) / 46);
      const lines = room >= 1 ? wrapLines(ctx, d.ask.a, bw - 80, Math.min(3, room)) : [];
      const bh = 110 + lines.length * 46;
      if (lines.length) {
        rr(ctx, bx, by, bw, bh, 30); ctx.fillStyle = "rgba(152,138,227,.12)"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(152,138,227,.45)"; ctx.stroke();
        ctx.textAlign = "left"; ctx.fillStyle = look.name_color || "#ecc5ed"; ctx.font = `600 34px ${slab}`;
        ctx.fillText(d.ask.q, bx + 40, by + 62);
        ctx.fillStyle = "#e6dfe9"; ctx.font = `500 34px ${sans}`;
        lines.forEach((l, i) => ctx.fillText(l, bx + 40, by + 112 + i * 46));
      }
    }

    // footer
    ctx.textAlign = "center"; ctx.fillStyle = look.accent; ctx.font = `800 40px ${sans}`;
    ctx.fillText(d.url.replace(/^https?:\/\//, ""), W / 2, H - 92);
    ctx.fillStyle = "#8f8a9b"; ctx.font = `700 24px ${sans}`;
    ctx.fillText("CURIOSITY, EMBODIED", W / 2, H - 46);
    return cv;
  }

  window.VCCard = { draw };
})();
