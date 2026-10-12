/* The Hunt: a turn-by-turn text chase between two members who've opted in.
   Uses helpers app.js shares on window.VCHunt.deps (h, pb, toast, go, me, errMsg, personChip, miniAvatar, parseTags, copyText). */
(() => {
  "use strict";

  const SPOTS = [
    { e: "🌳", n: "Old oak" }, { e: "💧", n: "Creek bed" }, { e: "🛖", n: "Abandoned cabin" },
    { e: "🌿", n: "Thorn thicket" }, { e: "🌕", n: "Moonlit clearing" }, { e: "🪨", n: "Rocky ledge" },
  ];
  // The 4×4 forest used by new games (row by row).
  const GRID = [
    { e: "🌳", n: "Old oak" }, { e: "💧", n: "Creek bed" }, { e: "🛖", n: "Abandoned cabin" }, { e: "🌿", n: "Thorn thicket" },
    { e: "🌕", n: "Moonlit clearing" }, { e: "🪨", n: "Rocky ledge" }, { e: "🪵", n: "Hollow log" }, { e: "🍄", n: "Mushroom ring" },
    { e: "🏹", n: "Hunter's blind" }, { e: "🌉", n: "Fallen bridge" }, { e: "🦊", n: "Fox den" }, { e: "🌫️", n: "Misty pond" },
    { e: "🪣", n: "Old well" }, { e: "🌾", n: "Bramble maze" }, { e: "✨", n: "Firefly meadow" }, { e: "⛪", n: "Ruined chapel" },
  ];
  // The trail forest used by new games: 12 spots round a loop, two shortcuts across.
  const TRAIL = [
    { e: "🌳", n: "Old oak" }, { e: "💧", n: "Creek bed" }, { e: "🛖", n: "Abandoned cabin" }, { e: "🌿", n: "Thorn thicket" },
    { e: "🦊", n: "Fox den" }, { e: "🌫️", n: "Misty pond" }, { e: "⛪", n: "Ruined chapel" }, { e: "✨", n: "Firefly meadow" },
    { e: "🌾", n: "Bramble maze" }, { e: "🪣", n: "Old well" }, { e: "🌕", n: "Moonlit clearing" }, { e: "🪨", n: "Rocky ledge" },
  ];
  const TRAIL_LINKS = [[2, 5], [8, 11]];
  const TRAIL_D = (() => {
    const n = 12, adj = [];
    for (let i = 0; i < n; i++) adj.push([(i + 1) % n, (i + n - 1) % n]);
    TRAIL_LINKS.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    return adj.map((_, s) => { const d = Array(n).fill(-1); d[s] = 0; const q = [s]; while (q.length) { const x = q.shift(); adj[x].forEach((y) => { if (d[y] < 0) { d[y] = d[x] + 1; q.push(y); } }); } return d; });
  })();
  const spotsFor = (g) => (g && g.map && g.map.spots ? g.map.spots : g && g.board === "grid16" ? GRID : g && g.board === "trail12" ? TRAIL : SPOTS);
  // Where spot i sits round the loop on this game's map (each map is turned, and sometimes mirrored).
  const posOf = (g, i) => { const m = g && g.map; if (!m) return i; return m.flip ? (m.rot - i + 24) % 12 : (i + m.rot) % 12; };
  const THEME_PICKS = [["", "🎲 Surprise me"], ["forest", "🌲 Forest"], ["manor", "🏰 Manor"], ["city", "🌃 City"]];
  const HOURS = ["Midnight", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM"];
  const DAWN = (g) => (g && g.board === "grid16" ? "6 AM" : g && g.board === "trail12" ? "5 AM" : "4 AM");
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
      teasing: ["{h} tears through the {s}. Nothing… but the scent is fresh. {p} is near, heart pounding.", "The {s} is empty, but something creaks right next door. {h} smiles."],
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
      flirty: ["The sky turns pink. {p} skips out of the {w} without a scratch. {h} owes up!"],
      teasing: ["Dawn breaks. {p} slips free into the morning light, leaving {h} empty-handed and wanting."],
      spicy: ["First light. {p} escapes, breathless and smug, while {h} is left aching for next time."],
    },
  };
  // Ready-made lines players can tap instead of typing. Up to four show at a time; 🔄 deals more.
  const QUICK = {
    prey: {
      flirty: [
        "Bet you can't find me 😝", "Ready or not… oh wait, that's your line", "You're getting colder. Brrr.",
        "I left you a trail of glitter. Just kidding.", "Psst… over here! (Or am I?)", "Catch me and I might let you buy me a drink",
        "Somebody's slow tonight 🐢", "I can hear you tripping over roots 😂", "You'll never guess. Not in a million years.",
        "Is that the best you've got, wolf?", "Peekaboo… nope, gone again", "I'm hiding somewhere very cute",
        "You look lost. Need a map?", "Close your eyes and count to ten. Then cry.", "I may have stolen your snacks on the way",
        "Find me and you get a hug. Maybe.", "Running in heels is a skill, you know", "Tag, you're still it",
        "I'm humming so you can find me. Badly.", "Winner picks the dessert 🍰", "Plot twist: I'm very good at this",
      ],
      teasing: [
        "Come and get me… if you can 😈", "My heart's pounding. Is yours?", "So close… but not close enough.",
        "I can feel you looking for me", "Getting warmer? Wouldn't you like to know.", "Breathe a little louder, I can't hear you yet",
        "You want me that badly?", "Keep chasing. I like the attention.", "One wrong turn and I'm gone forever",
        "Careful. I bite back.", "Your footsteps give you away, hunter", "I'll make you work for every inch of this {w}",
        "Go on, beg the moon for a clue", "If you catch me, then what?", "I'm right where you're not looking",
        "Can you smell my perfume yet?", "I love it when you get frustrated", "Run faster. I dare you.",
        "I'm wearing your favourite. Shame you can't see it.", "You're cute when you're losing", "Catch me and I'll tell you what I was thinking about 😏",
      ],
      spicy: [
        "You'll have to earn this, beast 🔥", "Hunt me harder.", "I'm shaking… and I like it.",
        "Every step you take makes me want to run faster", "Catch me and I'm yours. Fail and you're mine.", "Pin me if you can.",
        "You can't tame what you can't find", "Your hunger is showing, wolf", "I want to hear you growl when you miss",
        "Closer… closer… wrong.", "Don't you want to know what happens when you catch me?", "I'm leaving claw marks everywhere I've been",
        "Make me regret running", "Is that a promise or a threat? Either way, keep coming.", "The dark suits you. So does losing.",
        "My pulse is racing for you", "I'll make you chase me all night", "Find me before I decide to find you",
        "I'm already throbbing just thinking about you finding me", "Find me and every inch of me is yours", "I want to be caught, pinned and thoroughly ruined",
        "Catch me and I'll be moaning your name before dawn", "Hunt me down and take what you've been craving all night", "I'm hiding with my clothes half off. Hurry.",
        "Thinking about your hands on me is making it hard to stay quiet", "Drag me out, strip me down, make me yours", "If you catch me, don't you dare stop until I'm shaking",
        "I want your breath on my neck before you take me", "I'm so worked up I might just let you win", "Every time you miss, I get a little more worked up",
      ],
    },
    hunter: {
      flirty: [
        "Ready or not, here I come! 🐺", "I can smell cookies. Are you hiding cookies?", "Found a sock. Is this yours?",
        "You can run, but you'll get tired eventually", "I brought a flashlight. And snacks.", "Come out, come out, wherever you are!",
        "That giggle is going to get you caught", "I'm very patient. And very nosy.", "Every corner, every shadow. I'll check them all.",
        "You're cute when you hide", "I heard that, you know", "My nose is never wrong. Mostly.",
        "Should I howl? I'm going to howl.", "I'll find you before the owls do", "Coming closer… 👀",
        "Hide well, little bunny", "Fun fact: I've never lost at hide and seek", "Your boots left prints. Rookie mistake.",
        "I'm counting to ten. Very slowly. 1… 2…", "Loser buys breakfast 🥞", "I can hear you trying not to laugh",
      ],
      teasing: [
        "I can hear your heart racing", "Run, little rabbit 😏", "You can't hide from me forever.",
        "I'm getting closer. You know I am.", "That creak? That was you.", "I love a prey with spirit",
        "Your scent is all over this trail", "Every hour you run, the sweeter the catch", "Don't make me come in there",
        "Careful, I'm right behind you. Or am I?", "I'll find you. I always do.", "Keep running, I'm enjoying the view",
        "Breathe quieter, darling", "The moon's on my side tonight", "Nowhere left to hide soon",
        "I can wait. Can you?", "You'll be begging me to find you", "Tick tock, little one",
        "I like it when you make me work for it", "Every miss just makes the catch sweeter", "Hide better. Or don't. Your choice 😏",
      ],
      spicy: [
        "When I catch you, you're mine 🔥", "I can taste your fear on the wind.", "Run. I want you breathless.",
        "Every step brings me closer to claiming you", "There's nowhere in this {w} I won't follow you", "I'm going to pin you down when I find you",
        "Hide well. I'm starving.", "Your heartbeat is a dinner bell", "I'll drag you out of there myself",
        "You made a mistake teasing me", "I want to see you tremble", "The hunt is the foreplay. The catch is the fun.",
        "Keep running. It only makes me hungrier.", "I'll leave marks you'll feel tomorrow", "You're already mine, you just don't know it yet",
        "Scream if you want. Nobody's coming.", "On your knees when I find you", "Mine. Soon.",
        "I'm going to devour every inch of you", "When I find you, I'm taking you right where you're hiding", "I can already taste you",
        "I'll have you moaning so loud the whole {w} hears", "Hide all you like. I'm going to make you come apart when I find you", "Strip as you run. It saves me time.",
        "I want you breathless, trembling and begging for more", "Every second you hide, I'm planning exactly how I'll use you", "When I catch you, I'm not letting go until sunrise",
        "Your body is going to remember tonight", "I'm going to take my time with you. All of it.", "Run. The harder you make me work, the harder I'll take you",
      ],
    },
  };
  const EMOJI = {
    prey: ["🐇", "😝", "😈", "🫣", "💨", "🥵", "💋", "🙈", "✨", "🌙"],
    hunter: ["🐺", "😏", "👀", "🔥", "🌕", "👅", "😈", "🦴", "⛓️", "🐾"],
  };
  // ---- Smarter quick lines: a hint about where you're hiding, and teases from both Kink Jars shelves. ----
  // Hint lines. {c} = the place's hint ("it smells like red wine"), {C} = the same, capitalised.
  const WHERE = {
    prey: {
      flirty: ["Hint: {c} 😘", "Little clue: {c}. Good luck!", "Okay, one clue: {c}", "{C}. That's all you're getting 😇"],
      teasing: ["{C}. Warmer?", "Want a clue? {c}. Now come and earn me.", "{C}… and I'm getting impatient", "Here's a crumb: {c}. Follow it."],
      spicy: ["{C}. Come find me and take what's yours.", "{C}, and I'm wearing less than you think. Hurry.", "One clue, then come claim me: {c}", "{C}. Find me and I'm yours until sunrise."],
    },
    // {s} = the spot the hunter is about to search.
    hunter: {
      flirty: ["Checking the {s} next 👀", "Knock knock, {s}. Anyone home?", "Something tells me you're at the {s}"],
      teasing: ["The {s}. I can feel it.", "Coming for the {s}. Run if you're close.", "Heading to the {s}. Hope you're decent."],
      spicy: ["If you're in the {s}, you're mine in ten seconds", "I'm tearing the {s} apart looking for you", "The {s}. Be there. Be ready."],
    },
  };
  // Kink teases. {k} = the jar ("spanking"), {K} capitalised, {catch} = "when I catch you" / "if you catch me",
  // {while} = "while you hide" / "while you hunt". Keys: wear/see are clothing jars (I wear it / you wear it);
  // give/get are split jars (I do it to you / you do it to me); both = jars with one side.
  const TEASE = {
    // Only on their shelf (you haven't rated it).
    theirs: {
      give: { flirty: ["I peeked at your jars. {K}, huh? 😏 Noted.", "{Catch}, I know where to start: {k} 😇"],
        teasing: ["Your jars told me about {k}. {Catch}, we're starting there.", "Keep it up and {k} is coming your way"],
        spicy: ["{Catch}, it's {k} until you're shaking 🔥", "I read your jars. {K}. Hope you're ready, because I am."] },
      get: { flirty: ["I saw {k} on your jars… is that a promise? 😳", "So you like being the one doing {k}… 👀"],
        teasing: ["I know you're into {k}. Earn it.", "{K}? Your jars say you'd be good at it. Prove it."],
        spicy: ["Your jars say {k}. {Catch}, show me what you've got 🔥", "I can't stop thinking about you and {k}"] },
      both: { flirty: ["Your jars say you're into {k} 👀", "I've been reading your jars. {K}? Interesting…"],
        teasing: ["{K}, huh? Think about that {while} 😏", "Somebody's into {k}. I remember."],
        spicy: ["{K}. I saw it on your jars and haven't stopped thinking about it 🔥", "{Catch}, we're talking about {k}. Up close."] },
      wear: { flirty: ["I hear you like {k}. Guess what I'm wearing 😇"], teasing: ["{Catch}, you'll find out I'm in {k}"], spicy: ["{K}, and nothing else. That's what's waiting for you 🔥"] },
      see: { flirty: ["I know you like wearing {k} 👀"], teasing: ["{Catch}, I want you in {k}"], spicy: ["{Catch}, you're wearing {k} for me and nothing else"] },
    },
    // On both shelves.
    mutual: {
      give: { flirty: ["We both like {k}. Just saying 😇", "{Catch}, {k} is on the menu"],
        teasing: ["We're both into {k}. {Catch}, you're getting it.", "Every minute you hide is another minute of {k} later"],
        spicy: ["We're both into {k}. {Catch}, I'm not holding back.", "{K}, slow and thorough. {Catch}, you'll feel every second."] },
      get: { flirty: ["We match on {k} 😳 Just so you know."],
        teasing: ["We're both into {k}, and I'm on the receiving end. Think about that 😏", "You, me and {k}. Tick tock."],
        spicy: ["{K}. Both our jars, and I want all of it.", "I'm aching for {k}. You know exactly what to do with me."] },
      both: { flirty: ["We both said yes to {k} 😊", "Kink twins on {k}? Cute."],
        teasing: ["We both love {k}. Funny how that works 😏", "{K}. Think about it {while}."],
        spicy: ["{K}. Top of both our lists. Tonight it's happening.", "We're both into {k}. {Catch}, no more waiting."] },
      wear: { flirty: ["We both like {k}. Guess who's wearing it tonight 😇"], teasing: ["{K} on me, eyes on you. That's the deal."], spicy: ["I'm in {k} right now, and you'd better hurry."] },
      see: { flirty: ["We both like {k} 😏 Wear it for me sometime?"], teasing: ["You. {K}. Tonight."], spicy: ["{Catch}, I want you in {k}, and I want you now."] },
    },
    // Both rated it 4 or 5 ("love"): the drive-it-home lines.
    love: {
      give: { teasing: ["{K} is a favourite on both our jars. {Catch}, you're getting a lot of it."],
        spicy: ["We both love {k}. {Catch}, I'm not stopping until you beg.", "{K}. You crave it, I crave giving it. {Catch}, there's no mercy.", "I've been thinking about {k} all night. {Catch}, you'll feel every second of it."] },
      get: { teasing: ["{K}. Both our favourites, and I'm the lucky one. Hurry."],
        spicy: ["We both love {k}, and I want all of it. Don't you dare go easy on me.", "{K}. My favourite thing on both our jars. Take me there.", "{Catch}, it's {k} until I can't think straight."] },
      both: { teasing: ["{K}: a favourite on both our jars. We're dangerous together 😈"],
        spicy: ["We both love {k}. Tonight I want it all, again and again.", "{K} is all I can think about. {Catch}, it's happening.", "Your favourite, my favourite: {k}. No more waiting 🔥"] },
      wear: { spicy: ["You love seeing {k}, I love wearing it. Come peel it off me."] },
      see: { spicy: ["You in {k}. Both our favourites. I'm already losing my mind."] },
    },
    // Jars made for this game, when both of you like them.
    chase: {
      flirty: ["{K} is on both our jars. This game was made for us 😊"],
      teasing: ["We both love {k}. Run like you mean it. Hunt like you mean it."],
      spicy: ["{K}, both of us. Tonight neither of us is playing nice.", "We both love {k}. This is exactly what we wanted 😈"],
    },
  };
  const CHASE_JARS = new Set(["Hunter & hunted", "Primal play", "Fear play", "Captor & captive", "Chasing"]);
  // How each jar reads in a sentence, when its label doesn't.
  const SAY = {
    "Tied up": { give: "tying you up", get: "being tied up" }, "Tied to the bed": { give: "tying you to the bed", get: "being tied to the bed" },
    "Hands held down": { give: "pinning your hands down", get: "having my hands pinned down" },
    "Over the knee": { give: "putting you over my knee", get: "going over your knee" }, "Collar in public": { give: "collaring you in public", get: "wearing your collar in public" },
    "On display": { give: "putting you on display", get: "being put on display" }, "Good girl / good boy": { give: "telling you you're good", get: "being told I'm good" },
    "Kneeling": { give: "making you kneel", get: "kneeling for you" }, "Hand on throat (no pressure)": { give: "my hand on your throat", get: "your hand on my throat" },
    "Doing stuff in public": "public mischief", "Nothing at all": "nothing at all", "Light pain": "a little pain", "Heavy pain": "a lot of pain",
    "Risk of getting caught": "the risk of getting caught", "Being watched": "being watched", "Feet": "feet",
  };

  // Gentle enough for Flirty games. Teasing skips the heaviest jars; Spicy can use anything both of you said yes to.
  const MILD = new Set(["Kissing", "Neck kissing", "Cuddling", "Massage", "Feathers", "Tickling", "Teasing", "Hair play", "Collars",
    "Blindfolds", "Body worship", "Foot rubs", "Slow & sensual", "Praise", "Pet names", "Good girl / good boy", "Dirty talk",
    "Moaning & noise", "Spanking", "Hunter & hunted", "Primal play", "Pet play", "Roleplay", "Strangers meeting", "Pick-up scenario",
    "Cosplay", "Uniforms", "Sexting", "Phone & video sex", "Mirrors", "Public teasing", "Begging", "Rewards", "Asking permission",
    "Biting", "Scratching", "Hair pulling", "Ice play", "Wax play", "Leashes", "Kneeling", "Rope / shibari", "Handcuffs", "Tied up",
    "Light bondage", "Remote-control toys", "Vibrators", "Kink clubs & dungeons", "Wrestling", "Hands held down"]);
  const HEAVY_CATS = new Set(["toys", "fluids", "breath"]);
  const HEAVY = new Set(["Heavy pain", "Punching", "Kicking", "Face slapping", "Genital slapping", "Breast whipping", "Single tail whip",
    "Consensual non-consent", "Kidnapping fantasy", "Vore (fantasy)", "Humiliation & degradation", "Public humiliation", "Fire play"]);
  const SKIP_CATS = new Set(["roles", "groups"]);   // identities and other people don't make good teases

  // General lines that name an act; they're hidden when that act is either player's hard limit.
  const LINE_TAGS = [
    [/\bmarks?\b|claw/i, ["Leaving marks", "Scratching"]], [/knees|kneel/i, ["Kneeling"]], [/\bpin(ned)?\b/i, ["Hands held down", "Wrestling", "Immobilization"]],
    [/\bbeg/i, ["Begging"]], [/\bbite\b|\bbitten\b/i, ["Biting"]], [/\buse you\b/i, ["Objectification", "Free use"]], [/\bstrip/i, ["Forced nudity"]],
    [/\bruin/i, ["Ruined orgasms"]], [/\bscream/i, ["Fear play"]], [/\btaste\b|\bdevour/i, ["Oral"]], [/\bno mercy\b/i, ["Heavy pain"]],
  ];
  const lineOk = (t, blocked) => !blocked.size || !LINE_TAGS.some(([re, jars]) => re.test(t) && jars.some((j) => blocked.has(j)));
  // Jars that are a hard no (Kink Jars or typed limits) for either player.
  function blockedJars(mine, theirs, words) {
    const out = new Set();
    (window.KINKJARS || []).forEach(([code, label]) => {
      const a = (mine && mine.r.get(code)) || [], b = (theirs && theirs.r.get(code)) || [];
      if (a.includes(7) || b.includes(7) || hitsLimit(label, words)) out.add(label);
    });
    return out;
  }
  const norm = (t) => String(t).toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  // Anything on either person's typed limits is off the table (Kink Jars hard nos are checked jar by jar).
  function limitWords(...texts) {
    const out = [];
    texts.forEach((t) => String(t || "").replace(/https?:\/\/\S+/g, " ").split(/[\n,;•·|]+/).forEach((x) => {
      const n = norm(x.replace(/^[^:]{0,24}:/, "")); if (n.length >= 3) out.push(n);
    }));
    return out;
  }
  const hitsLimit = (label, words) => { const n = norm(label); return words.some((w) => n === w || (w.length >= 4 && n.includes(w)) || (n.length >= 4 && w.includes(n))); };

  // Build the list of teases from my shelf (may be null) and theirs.
  function kinkTeases(mine, theirs, words) {
    const ok = (v) => v >= 1 && v <= 5;
    const out = [];
    (window.KINKJARS || []).forEach(([code, label, sA, , , cat]) => {
      if (SKIP_CATS.has(cat) || hitsLimit(label, words)) return;
      const t = theirs.r.get(code) || [0, 0], m = (mine && mine.r.get(code)) || [0, 0];
      if (t.includes(7) || m.includes(7)) return;   // a hard no for either of you anywhere on this jar: leave it alone
      const base = { label, cat, chase: CHASE_JARS.has(label) };
      const push = (my, th, dir) => {
        if (ok(my) && ok(th)) out.push({ ...base, dir, lvl: my >= 4 && th >= 4 ? "love" : "mutual" });
        else if (th >= 3 && th <= 5 && (my === 0 || my === 6)) out.push({ ...base, dir, lvl: "theirs" });
      };
      if (sA) {
        const gear = cat === "gear";
        push(m[0], t[1], gear ? "wear" : "give");   // my doing side meets their receiving side
        push(m[1], t[0], gear ? "see" : "get");
      } else push(m[0] || m[1], t[0] || t[1], "both");
    });
    return out;
  }
  const heatOk = (c, heat) => heat === "spicy" || (heat === "teasing" ? !HEAVY_CATS.has(c.cat) && !HEAVY.has(c.label) : c.cat === "gear" || MILD.has(c.label));

  function teaseLine(c, role, heat) {
    let pool = [];
    if (c.chase && c.lvl !== "theirs") pool = TEASE.chase[heat];
    if (c.lvl === "love" && heat !== "flirty") pool = pool.concat((TEASE.love[c.dir] || {})[heat] || []);
    if (!pool.length || Math.random() < 0.35) pool = pool.concat(TEASE[c.lvl === "theirs" ? "theirs" : "mutual"][c.dir][heat] || []);
    const say = SAY[c.label];
    const k = (say && typeof say === "object" ? say[c.dir] || say.get : say) || c.label.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
    const caught = role === "hunter" ? "when I catch you" : "if you catch me";
    return pool[Math.floor(Math.random() * pool.length)]
      .replace(/\{K\}/g, cap(k)).replace(/\{k\}/g, k).replace(/\{Catch\}/g, cap(caught)).replace(/\{catch\}/g, caught)
      .replace(/\{while\}/g, role === "hunter" ? "while you hide" : "while you hunt");
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function pickTease(list, heat) {
    const fit = list.filter((c) => heatOk(c, heat));
    if (!fit.length) return null;
    const w = (c) => (c.lvl === "love" ? (heat === "spicy" ? 6 : 4) : c.lvl === "mutual" ? 2 : 1) * (c.chase ? 2 : 1);
    let r = Math.random() * fit.reduce((a, c) => a + w(c), 0);
    for (const c of fit) { r -= w(c); if (r <= 0) return c; }
    return fit[0];
  }

  // A small picker under the line box: four lines (a hint, a tease and two for the heat; 🔄 for more) and some emojis.
  function quickPicker(h, role, heat, input) {
    const pool = (QUICK[role] && QUICK[role][heat]) || QUICK[role].flirty;
    const used = new Set();
    let where = null, teases = [], blocked = new Set();
    const chips = h("div", { class: "quick-lines" });
    const chip = (t, cls) => h("button", { type: "button", class: "quick" + (cls ? " " + cls : ""), onclick: () => { input.value = t.slice(0, 140); input.focus(); } }, t);
    const whereLine = () => {
      if (!where) return null;
      const list = WHERE[role][heat];
      if (role === "prey" && !where.c) return null;
      const ok = list.filter((x) => lineOk(x, blocked));
      const t = (ok.length ? ok : list)[Math.floor(Math.random() * (ok.length ? ok : list).length)];
      return t.replace(/\{C\}/g, cap(where.c || "")).replace(/\{c\}/g, where.c || "").replace(/\{s\}/g, where.n.toLowerCase());
    };
    let hint = null, tease = null, extra = [];
    const draw = () => {
      const top = [hint ? [hint, "hint"] : null, tease ? [tease, "tease"] : null].filter(Boolean);
      chips.replaceChildren(...top.concat(extra.slice(0, 4 - top.length).map((t) => [t, ""])).map(([t, cls]) => chip(t, cls)),
        h("button", { type: "button", class: "quick more", title: "More lines", "aria-label": "Show more lines", onclick: deal }, "🔄"));
    };
    function deal() {
      hint = whereLine();
      const c = pickTease(teases, heat);
      tease = null;
      for (let n = 0; c && n < 8 && !tease; n++) { const t = teaseLine(c, role, heat); if (lineOk(t, blocked)) tease = t; }
      const fine = pool.map((t, i) => i).filter((i) => lineOk(pool[i], blocked));
      if (fine.filter((i) => !used.has(i)).length < 4) used.clear();
      extra = fine.filter((i) => !used.has(i)).sort(() => Math.random() - 0.5).slice(0, 4);
      extra.forEach((i) => used.add(i));
      extra = extra.map((i) => pool[i].replace(/\{w\}/g, WORD));
      draw();
    }
    deal();
    const emojis = h("div", { class: "quick-emoji", role: "group", "aria-label": "Add an emoji" }, (EMOJI[role] || []).map((em) =>
      h("button", { type: "button", onclick: () => { if ((input.value + em).length <= 140) { input.value = (input.value ? input.value.replace(/\s*$/, " ") : "") + em; input.focus(); } } }, em)));
    const el = h("div", { class: "quick-picker" }, h("span", { class: "faint" }, "Tap one, type your own, or skip it. 📍 is a hint about your spot, 🫙 comes from your Kink Jars."), chips, emojis);
    // The map tells the picker which spot you've tapped, so the hint line can match it.
    el.setWhere = (spot) => { where = spot; hint = whereLine(); draw(); };
    el.setTeases = (list, block) => { teases = list; blocked = block || blocked; deal(); };
    return el;
  }

  const pick = (list, seed) => list[Math.abs(seed) % list.length];
  let WORD = "forest";
  const fill = (t, v) => t.replace(/\{h\}/g, v.h).replace(/\{p\}/g, v.p).replace(/\{s\}/g, v.s).replace(/\{w\}/g, WORD);

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
      const roleRow = h("div", { class: "pills" }); const heatRow = h("div", { class: "pills" }); const themeRow = h("div", { class: "pills" });
      let theme = "";
      const drawRows = () => {
        roleRow.replaceChildren(...roles.map(([v, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(role === v), onclick: () => { role = v; drawRows(); } }, l)));
        heatRow.replaceChildren(...HEATS.map(([v, l, d]) => h("button", { type: "button", class: "pill", title: d, "aria-pressed": String(heat === v), onclick: () => { heat = v; drawRows(); } }, l)));
        themeRow.replaceChildren(...THEME_PICKS.map(([v, l]) => h("button", { type: "button", class: "pill", "aria-pressed": String(theme === v), onclick: () => { theme = v; drawRows(); } }, l)));
      };
      drawRows();
      const forfeit = h("input", { type: "text", maxlength: 140, placeholder: "e.g. A cheeky selfie", list: "hunt-forfeits", "aria-label": "Forfeit" });
      const msg = h("input", { type: "text", maxlength: 200, placeholder: "Optional: a little message with the invite", "aria-label": "Message" });
      const send = h("button", { type: "button", class: "btn gold" }, "🏹 Send the invite");
      send.addEventListener("click", async () => {
        send.disabled = true;
        try { const g = await pb.send("/api/vc/hunts", { method: "POST", body: { slug: p.slug, role, heat, theme, forfeit: forfeit.value.trim(), message: msg.value.trim() } }); toast("Invite sent! Give them a nudge in Telegram."); go("/hunt/" + g.id); }
        catch (err) { toast(errMsg(err), true); send.disabled = false; }
      });
      startHolder.replaceChildren(h("section", { class: "panel hunt-start" },
        h("div", { class: "toggle-row" }, h("h2", { style: "margin:0" }, "Hunt with ", p.display_name), h("button", { type: "button", class: "btn small ghost", onclick: () => startHolder.replaceChildren() }, "Close")),
        h("span", { class: "label" }, "Who's chasing who"), roleRow,
        h("span", { class: "label" }, "Heat"), heatRow,
        h("span", { class: "label" }, "Where", h("small", { class: "faint" }, " (the places are shuffled every game)")), themeRow,
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
          h("p", { class: "queue-on" }, h("span", { class: "dot", "aria-hidden": "true" }), `You're in the queue as ${roleLabel} (${q.queued.heats.map((x) => (HEATS.find((y) => y[0] === x) || [, x])[1]).join(", ")}). The moment someone from the other side joins, your hunt starts.`),
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
      const join = h("button", { type: "button", class: "btn gold" }, "🎲 Throw me in");
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
        h("p", { class: "faint", style: "margin-top:-6px" }, "Don't want to pick? Say which side you want and get paired with a random member from the other side. The game starts as soon as you're matched (you've both said yes by joining). Where you'll play is a surprise: 🌲 the forest, 🏰 the manor or 🌃 the city after dark."),
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
        h("p", {}, "Midnight in the forest, an old manor or the city after dark. One of you hides, one of you hunts. Twelve hiding spots on a loop of paths, and a new map every game. Each hour the prey creeps one or two steps along the paths, and the hunter searches one spot. Track them down before dawn and they're yours. Survive until 5 AM and the prey wins."),
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
          h("li", {}, "Every game gets a new map: the forest, an old manor or the city after dark, with 12 places picked at random and the two shortcuts in new spots. The prey starts anywhere, then each hour must move one or two steps along the paths."),
          h("li", {}, "The hunter searches one spot each hour. If the prey is one step away, the hunter hears them, and can start tracking."),
          h("li", {}, "Catch them before dawn (five hours, midnight to 5 AM) and the hunter claims them. Otherwise the prey escapes."),
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
    WORD = (g.map && g.map.word) || "forest";
    const SP = spotsFor(g), grid = g.board === "grid16", trail = g.board === "trail12", picks = g.searches || 1;
    const over = ["caught", "escaped", "red", "declined", "cancelled"].includes(g.status);

    // Story so far
    const story = h("ol", { class: "hunt-log" });
    g.log.forEach((r, i) => {
      const lines = [];
      const hour = HOURS[r.round - 1] || "";
      if (r.prey_spot !== undefined && r.prey_spot !== null && (g.role === "prey" || over))
        lines.push(h("p", { class: "hide-line" }, `${g.role === "prey" ? "You" : other.display_name} slipped into the ${SP[r.prey_spot].n.toLowerCase()} ${SP[r.prey_spot].e}`));
      if (r.prey_line) lines.push(h("p", { class: "say prey" }, `${nameOf("prey")}: “${r.prey_line}”`));
      if (r.search !== null && r.search !== undefined) {
        if (r.hunter_line) lines.push(h("p", { class: "say hunter" }, `${nameOf("hunter")}: “${r.hunter_line}”`));
        const both = [r.search, r.search2].filter((x) => x !== null && x !== undefined);
        const where = r.result === "caught" && r.caught_at !== undefined && r.caught_at !== null ? SP[r.caught_at].n.toLowerCase()
          : both.map((x) => SP[x].n.toLowerCase()).join(" and the ");
        let t = fill(pick(TEXT[r.result] ? TEXT[r.result][g.heat] : ["…"], i + r.search), { h: names.h, p: names.p, s: where });
        if (where.includes(" and the ")) t = t.replace(/ is empty/g, " are both empty");
        lines.push(h("p", { class: "narr " + r.result }, (r.result === "caught" ? "🐺 " : r.result === "close" ? "👂 " : "🍃 ") + t));
      } else if (g.status === "active") lines.push(h("p", { class: "faint" }, g.role === "hunter" ? "They've hidden somewhere…" : "Waiting for the hunter to search…"));
      story.append(h("li", {}, h("span", { class: "hour" }, hour), ...lines));
    });
    if (g.status === "escaped") story.append(h("li", { class: "dawn" }, h("span", { class: "hour" }, "Dawn · " + DAWN(g)), h("p", { class: "narr escaped" }, "🌅 " + fill(pick(TEXT.escaped[g.heat], 0), { h: names.h, p: names.p, s: "" }))));

    // Map: the 4×4 forest (new games) or six spots around a trail (older games).
    const searched = new Map(), hid = new Set();
    if (over) g.log.forEach((r) => { if (r.prey_spot !== undefined && r.prey_spot !== null) hid.add(r.prey_spot); });
    if (g.role === "hunter" || over) g.log.forEach((r) => {
      [r.search, r.search2].forEach((x) => { if (x === null || x === undefined) return;
        const res = r.result === "caught" ? (x === r.caught_at || r.caught_at === undefined ? "caught" : "far") : r.result;
        if (searched.get(x) !== "caught") searched.set(x, res); });
    });
    let chosen = [];
    const needed = g.role === "hunter" ? picks : 1;
    const lastPrey = g.lastPreySpot;
    const currentHide = g.role === "prey" && g.log.length && g.log[g.log.length - 1].search == null ? g.log[g.log.length - 1].prey_spot : null;
    const canPick = g.myTurn;
    const map = h("div", { class: "hunt-map" + (grid ? " grid" : "") + (trail ? " trail12" : "") + (g.map ? " theme-" + g.map.theme : ""), role: "group", "aria-label": g.map ? g.map.label : "The forest" });
    // Trail lines: the loop, plus the shortcuts across.
    const trailSvg = () => {
      const pt = (i) => { const k = posOf(g, i); return [50 + 38 * Math.sin(k * Math.PI / 6), 50 - 38 * Math.cos(k * Math.PI / 6)]; };
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("class", "trail-lines"); svg.setAttribute("aria-hidden", "true");
      const line = (a, b, cls) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); const l = document.createElementNS(svg.namespaceURI, "line");
        l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); l.setAttribute("class", cls); svg.append(l); };
      for (let i = 0; i < 12; i++) line(i, (i + 1) % 12, "path");
      TRAIL_LINKS.forEach(([a, b]) => line(a, b, "path shortcut"));
      return svg;
    };
    const reach = (i) => !trail || g.role !== "prey" || lastPrey === null || lastPrey === undefined || (TRAIL_D[lastPrey][i] >= 1 && TRAIL_D[lastPrey][i] <= (g.maxStep || 2));
    const drawMap = () => map.replaceChildren(grid ? "" : trail ? trailSvg() : h("div", { class: "trail", "aria-hidden": "true" }), ...SP.map((sp, i) => {
      const tooFar = canPick && g.role === "prey" && !reach(i);
      const blocked = (canPick && g.role === "prey" && i === lastPrey) || tooFar;
      const mark = (searched.has(i) ? { caught: "🎯", close: "👂", far: "🔍" }[searched.get(i)] : "") + (hid.has(i) && searched.get(i) !== "caught" ? "🐇" : "");
      const on = chosen.includes(i);
      const b = h("button", { type: "button", class: "spot" + (on ? " chosen" : "") + (currentHide === i ? " hiding" : "") + (tooFar ? " far" : ""), style: `--i:${trail ? posOf(g, i) : i}`,
        disabled: !canPick || blocked, "aria-pressed": String(on), title: tooFar ? "Too far: you can move 1–2 steps along the paths" : blocked ? "You hid here last hour" : sp.n },
        h("span", { class: "se", "aria-hidden": "true" }, sp.e), h("span", { class: "sn" }, sp.n),
        mark ? h("span", { class: "spot-mark", "aria-hidden": "true" }, mark) : null,
        currentHide === i ? h("span", { class: "spot-mark", "aria-hidden": "true" }, "🫣") : null);
      b.addEventListener("click", () => {
        if (on) chosen = chosen.filter((x) => x !== i);
        else if (needed === 1) chosen = [i];
        else chosen = [...chosen, i].slice(-needed);
        drawMap();
        picker.setWhere(chosen.length ? SP[chosen[chosen.length - 1]] : null);
        const nm = chosen.map((x) => SP[x].n.toLowerCase());
        go2.disabled = chosen.length !== needed;
        go2.textContent = g.role === "prey" ? (nm.length ? "Hide in the " + nm[0] : "Pick a hiding spot")
          : chosen.length === needed ? "Search the " + nm.join(" and the ") : needed === 2 ? `Pick ${needed - chosen.length} more spot${needed - chosen.length === 1 ? "" : "s"}` : "Pick a spot to search";
      });
      return b;
    }));
    const line = h("input", { type: "text", maxlength: 140, placeholder: g.role === "prey" ? "Optional: a taunt for the hunter" : "Optional: something to growl", "aria-label": "Your line" });
    const picker = quickPicker(h, g.role, g.heat, line);
    // Teases from both Kink Jars shelves; lines touching either person's limits are hidden.
    if (g.myTurn) (async () => {
      const K = window.KinkJarsImport, words = limitWords(g.otherLimits, g.myLimits);
      let mine = null, theirs = null;
      if (K && g.myKj) { try { mine = await K.resolve(g.myKj); } catch {} }
      if (K && g.otherKj) { try { theirs = await K.resolve(g.otherKj); } catch {} }
      picker.setTeases(theirs && !g.kinkOff ? kinkTeases(mine, theirs, words) : [], blockedJars(mine, theirs, words));
    })();
    const go2 = h("button", { type: "button", class: "btn gold", disabled: true }, g.role === "prey" ? "Pick a hiding spot" : picks === 2 ? "Pick two spots to search" : "Pick a spot to search");
    go2.addEventListener("click", async () => {
      if (chosen.length !== needed) return;
      go2.disabled = true;
      try {
        const upd = await pb.send(`/api/vc/hunts/${g.id}/move`, { method: "POST", body: g.role === "hunter" && needed > 1 ? { spots: chosen, line: line.value.trim() } : { spot: chosen[0], line: line.value.trim() } });
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
          ? (lastPrey !== null && lastPrey !== undefined ? (trail ? `You're at the ${SP[lastPrey].n.toLowerCase()}. Move 1 or 2 steps along the paths. ` : `You can't stay at the ${SP[lastPrey].n.toLowerCase()}. `) : trail ? "Start anywhere. After this you can only move 1 or 2 steps along the paths each hour. " : "") + "Tap a spot on the map."
          : trail ? "Pick a spot to search. They move 1–2 steps along the paths each hour, and if they're right next to where you search, you'll hear them." : picks === 2 ? "Pick two spots to search. If they're right beside either one (not diagonal), you'll hear them." : "Tap a spot on the trail. If they're right next to it, you'll hear them."),
        map, line, picker, h("div", { class: "actions" }, go2, red));
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
        h("p", { class: "hunt-meta" }, g.random ? "🎲 Random match · " : "", g.map ? `${g.map.e} ${g.map.label} · ` : "", heat[1], g.status === "active" ? ` · ${HOURS[g.round - 1]} (hour ${g.round} of ${g.rounds})` : "", g.forfeit ? ` · Loser owes: ${g.forfeit}` : "")),
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
