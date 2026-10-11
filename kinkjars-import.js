/* Reads a Kink Jars share link and turns the shelf into profile text.
   Link formats handled (same as Kink Jars itself):
     #k=flavor.name.codes[.custom…].v4   (each side 0–7 packed into one character)
     #k=…v3 and the older #j=1~/#j=2~ formats
     #s=ID  short links, looked up through Kink Jars' public link service */
(() => {
  "use strict";
  const ROWS = window.KINKJARS || [];
  const BY_CODE = new Map(ROWS.map((r) => [r[0], { label: r[1], sides: r[2] ? [r[2], r[3]] : null, cat: r[4], catId: r[5] }]));
  const A64 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_";
  const MAYBE = 6, HARDNO = 7;
  // Kink Jars' own public short-link service (the same key its page uses; it can only look links up).
  const SB_URL = "https://mumzmbpzsnjshbbeavgf.supabase.co";
  const SB_KEY = "sb_publishable_NeVH3MY3VZj1ShuEs_4j5Q_D4l4xCst";

  const dec = (t) => { try { return decodeURIComponent(t); } catch { return ""; } };
  const decV = (ch, v4) => {
    if (v4) { const v = A64.indexOf(ch); return v < 0 ? null : [Math.floor(v / 8), v % 8]; }
    const v = parseInt(ch, 36); return v >= 0 && v < 36 ? [Math.floor(v / 6), v % 6] : null;
  };

  function parse(text) {
    const t = String(text).trim();
    const k = t.match(/#(?:cmp=|c)?k=([A-Za-z0-9%._-]+)/);
    if (k) {
      const parts = k[1].split(".");
      const v4 = parts[parts.length - 1] === "v4";
      if (/^v[34]$/.test(parts[parts.length - 1])) parts.pop();
      if (parts.length < 3) return null;
      const [, nm, codes, ...cust] = parts;
      const r = new Map(), custom = [];
      const str = codes === "_" ? "" : codes;
      for (let i = 0; i + 5 <= str.length; i += 5) { const ab = decV(str[i + 4], v4); if (ab) r.set(str.slice(i, i + 4), ab); }
      cust.forEach((c) => { const ab = decV(c[1], v4), label = dec(c.slice(2)).slice(0, 40); if (label && ab) custom.push({ label, split: c[0] === "1", ab }); });
      return { name: nm === "_" ? "" : dec(nm).slice(0, 28), r, custom };
    }
    const mm = t.replace(/%7E/gi, "~").match(/#(?:j|cmp)=([^\s]*)$/);
    if (!mm) return null;
    const m0 = ("#j=" + mm[1]).replace(/^#j=1~/, "#j=2~").match(/^#j=2~([a-z]+)~([^~]*)~([0-9a-z]*)(?:~([^~]*))?$/);
    if (!m0) return null;
    const r = new Map(), custom = [];
    for (let i = 0; i + 5 <= m0[3].length; i += 5) { const ab = decV(m0[3][i + 4], false); if (ab && ab[0] <= 5) r.set(m0[3].slice(i, i + 4), ab); }
    (m0[4] || "").split(",").filter(Boolean).forEach((c) => { const ab = decV(c[1], false), label = dec(c.slice(2)).slice(0, 40); if (label && ab) custom.push({ label, split: c[0] === "1", ab }); });
    return { name: dec(m0[2]).slice(0, 28), r, custom };
  }

  async function resolve(text) {
    const t = String(text).trim();
    if (/#inbox=/.test(t)) throw new Error("That's your private inbox link. Use your share link instead (Share & compare, then Get my share link).");
    const s = t.match(/#c?s=([A-Za-z0-9]{4,12})(?![A-Za-z0-9])/);
    if (!s) {
      const p = parse(t);
      if (!p) throw new Error("That doesn't look like a Kink Jars share link. It should contain #s= or #k=.");
      return p;
    }
    const res = await fetch(`${SB_URL}/rest/v1/rpc/get_link`, {
      method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_id: s[1] }),
    });
    if (!res.ok) throw new Error("Kink Jars couldn't find that link. It may have been turned off; make a new one on Kink Jars.");
    const data = await res.json();
    if (!data || !data.payload) throw new Error("Kink Jars couldn't find that link. It may have been turned off; make a new one on Kink Jars.");
    const p = parse("#k=" + data.payload);
    if (!p) throw new Error("That link doesn't have a shelf in it.");
    return p;
  }

  // Turn ratings into lists. Each entry is "Label" or "Label (side)".
  function summarize(p) {
    const love = [], enjoy = [], curious = [], limits = [], roles = [];
    let unknown = 0;
    const place = (label, side, v, roleCat) => {
      const name = side ? `${label} (${side.toLowerCase()})` : label;
      if (v === HARDNO) limits.push(name);
      else if (v === MAYBE) curious.push(name);
      else if (roleCat) { if (v >= 3) roles.push({ label, v }); }   // roles go to the Dynamic field, not the lists
      else if (v >= 4) love.push({ name, v });
      else if (v >= 1) enjoy.push({ name, v });
    };
    // Group the two sides of a jar when they got the same answer: "Spanking (give, get)" reads better as "Spanking".
    const add = (label, sides, ab, roleCat) => {
      if (!sides) { place(label, null, ab[0] || ab[1], roleCat); return; }
      const [a, b] = ab;
      const bucket = (v) => (v === HARDNO ? "no" : v === MAYBE ? "maybe" : v >= 4 ? "love" : v >= 1 ? "enjoy" : "");
      if (a && b && bucket(a) === bucket(b)) { place(label, null, Math.max(a, b), roleCat); return; }
      if (a) place(label, sides[0], a, roleCat);
      if (b) place(label, sides[1], b, roleCat);
    };
    for (const [code, ab] of p.r) {
      const jar = BY_CODE.get(code);
      if (!jar) { unknown++; continue; }
      add(jar.label, jar.sides, ab, jar.catId === "roles");
    }
    for (const c of p.custom) add(c.label, c.split ? ["Give", "Get"] : null, c.ab, false);
    const byV = (x, y) => y.v - x.v;
    return {
      name: p.name,
      love: love.sort(byV).map((x) => x.name),
      enjoy: enjoy.sort(byV).map((x) => x.name),
      curious, limits, unknown,
      roles: roles.sort(byV).map((x) => x.label.replace(/^Being an? /i, "").replace(/^\w/, (c) => c.toUpperCase())),
    };
  }

  // Profile fields hold up to 2,000 characters; long shelves are shortened with "and N more".
  const MAX = 1950;
  function fit(build, lists) {
    const cut = lists.map((l) => l.slice());
    let text = build(cut);
    while (text.length > MAX) {
      const longest = cut.reduce((m, l) => (l.length > m.length ? l : m), []);
      if (!longest.length) break;
      longest.more = (longest.more || 0) + 1;
      longest.pop();
      text = build(cut);
    }
    return text;
  }
  const join = (l, sep) => l.join(sep) + (l.more ? `${sep === "\n" ? "\n" : ", "}and ${l.more} more` : "");
  function intoText(s) {
    return fit(([love, enjoy, curious]) => {
      const lines = [];
      if (love.length) lines.push("Love: " + join(love, ", "));
      if (enjoy.length) lines.push("Enjoy: " + join(enjoy, ", "));
      if (curious.length) lines.push("Curious about: " + join(curious, ", "));
      return lines.join("\n\n");
    }, [s.love, s.enjoy, s.curious]);
  }
  const limitsText = (s) => fit(([l]) => join(l, "\n"), [s.limits]);

  window.KinkJarsImport = { resolve, parse, summarize, intoText, limitsText };
})();
