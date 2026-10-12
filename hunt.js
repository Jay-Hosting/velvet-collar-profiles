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
  // Kink teases: what you'll actually do, written per jar. g = I do it to you, r = you do it to me
  // (for one-sided jars the hunter uses g and the prey uses r). sg / sr are gentler versions for Flirty games;
  // jars without them don't show in Flirty.
  const ACTS = {
    // power & control
    "Orgasm control": { g: ["decide exactly when you're allowed to come, and make you wait for it"], r: ["take control of when I get to come, and make me earn every one"] },
    "Orgasm denial": { g: ["bring you right to the edge and leave you there, over and over"], r: ["keep me right on the edge and refuse to let me finish"] },
    "Edging": { g: ["edge you until you're shaking and begging me to let you finish"], r: ["edge me until I'm shaking and begging"] },
    "Forced orgasms": { g: ["hold you down and make you come until you can't take any more"], r: ["hold me down and make me come until I can't take any more"] },
    "Ruined orgasms": { g: ["take you right to the end and ruin it at the last second"], r: ["take me right to the end and ruin it at the last second"] },
    "Begging": { g: ["make you beg for every single thing you want"], r: ["make me beg for every single thing"], sg: ["make you ask very nicely"], sr: ["make me ask nicely"] },
    "Punishments": { g: ["punish you for every minute you made me chase you"], r: ["punish me for every minute I made you chase me"] },
    "Commands": { g: ["give you orders, and watch you obey every one"], r: ["tell me exactly what to do, and watch me do it"] },
    "Verbal commands": { g: ["tell you exactly what to do and watch you obey"], r: ["give me orders and make me obey"] },
    "Kneeling": { g: ["put you on your knees and keep you there"], r: ["put me on my knees and keep me there"], sg: ["have you kneel for me"], sr: ["have me kneel for you"] },
    "Collars": { g: ["buckle a collar around your neck and lead you home"], r: ["buckle your collar around my neck"], sg: ["put a collar on you"], sr: ["put your collar on me"] },
    "Leashes": { g: ["clip a leash on you and walk you back nice and slow"], r: ["clip a leash on me and lead me wherever you want"], sg: ["clip a leash on you"], sr: ["clip a leash on me"] },
    "Chastity": { g: ["lock you up and keep the key for myself"], r: ["lock me up and keep the key"] },
    "Teasing": { g: ["tease you slowly until you're squirming"], r: ["tease me until I'm squirming"], sg: ["tease you until you squirm"], sr: ["tease me until I squirm"] },
    "Forced nudity": { g: ["strip you bare and keep you that way"], r: ["strip me bare and keep me that way"] },
    "Masturbation on command": { g: ["make you touch yourself while I watch, and stop only when I say"], r: ["make me touch myself for you, and stop only when you say"] },
    "Bratting & taming": { g: ["tame every bit of brat out of you"], r: ["tame every bit of brat out of me"], sg: ["tame that bratty mouth of yours"], sr: ["try to tame my bratty mouth"] },
    "Asking permission": { g: ["make you ask permission for everything"], r: ["make me ask permission for everything"] },
    "Rewards": { g: ["reward you very, very well"], r: ["reward me for being so good"], sg: ["reward you nicely"], sr: ["reward me nicely"] },
    "Choosing their outfits": { g: ["dress you in exactly what I pick"], r: ["dress me in exactly what you pick"] },
    "On display": { g: ["put you on display and take my time looking"], r: ["put me on display and take your time looking"] },
    // impact
    "Spanking": { g: ["bend you over and spank you until you're counting out loud"], r: ["bend me over and spank me until I can't sit"], sg: ["give you a few good spanks"], sr: ["give me a few good spanks"] },
    "Over the knee": { g: ["put you over my knee and make you count"], r: ["put me over your knee and make me count"], sg: ["put you over my knee"], sr: ["put me over your knee"] },
    "Paddling": { g: ["bend you over and paddle you until you're glowing red"], r: ["paddle me until I'm glowing red"] },
    "Flogging": { g: ["tie you up and flog you, slow and steady"], r: ["flog me until I'm shaking"] },
    "Caning": { g: ["line you up and cane you, one stroke at a time"], r: ["cane me one slow stroke at a time"] },
    "Riding crops": { g: ["trace a crop over your skin before it lands"], r: ["use a crop on me until I flinch every time it moves"] },
    "Hair pulling": { g: ["wrap my hand in your hair and pull your head back"], r: ["grab my hair and pull my head back"], sg: ["tug your hair, just a little"], sr: ["tug my hair, just a little"] },
    "Biting": { g: ["leave bite marks all the way down your neck"], r: ["bite me hard enough that I feel it tomorrow"], sg: ["nibble on your neck"], sr: ["nibble on my neck"] },
    "Scratching": { g: ["drag my nails down your back"], r: ["drag your nails down my back"], sg: ["run my nails down your back"], sr: ["run your nails down my back"] },
    "Leaving marks": { g: ["leave marks on you that you'll see in the mirror tomorrow"], r: ["leave marks on me that I'll see tomorrow"] },
    "Nipple clamps": { g: ["clamp your nipples and tug the chain"], r: ["clamp my nipples and pull the chain"] },
    "Counting strokes": { g: ["make you count every stroke out loud"], r: ["make me count every stroke out loud"] },
    "Wrestling": { g: ["wrestle you down and pin you under me"], r: ["wrestle me down and pin me under you"], sg: ["wrestle you to the ground"], sr: ["wrestle me to the ground"] },
    // bondage
    "Tied up": { g: ["tie your wrists and take my time with you"], r: ["tie me up and take your time with me"], sg: ["tie your wrists with something silky"], sr: ["tie my wrists with something silky"] },
    "Light bondage": { g: ["tie you up just enough that you can't get away"], r: ["tie me up just enough that I can't get away"], sg: ["tie you up, just a little"], sr: ["tie me up, just a little"] },
    "Heavy bondage": { g: ["bind you so completely you can't move an inch"], r: ["bind me so I can't move an inch"] },
    "Rope / shibari": { g: ["wrap you in rope, knot by knot, until you can't move"], r: ["wrap me in rope until I can't move"] },
    "Handcuffs": { g: ["cuff your hands behind your back"], r: ["cuff my hands behind my back"], sg: ["cuff you"], sr: ["cuff me"] },
    "Tied to the bed": { g: ["tie you to the bed, spread out and helpless"], r: ["tie me to the bed and leave me helpless"] },
    "Gags": { g: ["gag you so nobody hears what I'm doing to you"], r: ["gag me so nobody hears"] },
    "Blindfolds": { g: ["blindfold you so you never know where I'll touch next"], r: ["blindfold me so I never know what's coming"], sg: ["blindfold you and make you guess"], sr: ["blindfold me and make me guess"] },
    "Spreader bars": { g: ["lock your ankles in a spreader bar"], r: ["lock me open in a spreader bar"] },
    "Hands held down": { g: ["pin your wrists above your head"], r: ["pin my wrists above my head"], sg: ["pin your hands down"], sr: ["pin my hands down"] },
    "Immobilization": { g: ["hold you so still you can't even squirm"], r: ["hold me so still I can't even squirm"] },
    // sensation
    "Wax play": { g: ["drip hot wax down your spine"], r: ["drip hot wax down my spine"], sg: ["drip warm wax on your skin"], sr: ["drip warm wax on my skin"] },
    "Ice play": { g: ["trace an ice cube down your body and follow it with my mouth"], r: ["run ice down my body and follow it with your mouth"], sg: ["trace an ice cube down your back"], sr: ["trace an ice cube down my back"] },
    "Feathers": { g: ["drag a feather over every inch of you until you can't stay still"], r: ["tease me with a feather until I can't stay still"], sg: ["trace a feather over every inch of you"], sr: ["tease me with a feather"] },
    "Tickling": { g: ["pin you down and tickle you until you surrender"], r: ["pin me down and tickle me until I surrender"], sg: ["tickle you until you surrender"], sr: ["tickle me until I surrender"] },
    "Vibrators": { g: ["hold a vibrator against you and not let you pull away"], r: ["hold a vibrator on me until I can't stand it"], sg: ["try a little vibration on you"], sr: ["try a little vibration on me"] },
    "Massage": { g: ["make you rub me down, slow, everywhere"], r: ["make me rub you down, slow, everywhere"], sg: ["have you give me a long, slow massage"], sr: ["have me give you a long, slow massage"] },
    "Sensory deprivation": { g: ["take away your sight and sound so all you can feel is me"], r: ["take away everything but your touch"] },
    "Overstimulation": { g: ["keep going long after you're too sensitive to take it"], r: ["keep going long after I'm too sensitive to take it"] },
    "Knife play (no cutting)": { g: ["drag the flat of a blade slowly across your skin"], r: ["trace a blade slowly across my skin"] },
    // breath
    "Choking": { g: ["wrap my hand around your throat and squeeze"], r: ["wrap your hand around my throat"] },
    "Hand on throat (no pressure)": { g: ["rest my hand on your throat while I kiss you"], r: ["rest your hand on my throat while you kiss me"] },
    "Face-sitting": { g: ["sit on your face until all you can breathe is me"], r: ["sit on my face"] },
    "Hand over mouth": { g: ["keep my hand over your mouth so nobody hears you"], r: ["keep your hand over my mouth so nobody hears me"] },
    // words
    "Dirty talk": { g: ["whisper exactly what I'm going to do to you, in filthy detail"], r: ["tell me exactly what you're going to do to me, in filthy detail"], sg: ["whisper every dirty thought I've had tonight"], sr: ["whisper every dirty thought you've had tonight"] },
    "Praise": { g: ["tell you how good you are while you do exactly as you're told"], r: ["tell me how good I am while I do as I'm told"], sg: ["tell you how good you've been"], sr: ["tell me how good I've been"] },
    "Good girl / good boy": { g: ["tell you you're being so good for me while you obey"], r: ["tell me I'm being so good for you while I obey"], sg: ["tell you you've been good"], sr: ["tell me I've been good"] },
    "Humiliation & degradation": { g: ["remind you exactly what you are"], r: ["remind me exactly what I am"] },
    "Name calling": { g: ["call you every filthy name you deserve"], r: ["call me every filthy name I deserve"] },
    "Pet names": { g: ["call you my pet while you crawl to me"], r: ["call me your pet"], sg: ["call you every sweet name I can think of"], sr: ["call me something sweet"] },
    "Moaning & noise": { g: ["make you moan loud enough for the whole {w} to hear"], r: ["make me moan loud enough for the whole {w} to hear"], sg: ["make you moan a little"], sr: ["make me moan a little"] },
    "Objectification": { g: ["use you like you're mine to use"], r: ["use me like I'm yours to use"] },
    // body
    "Kissing": { g: ["kiss you hard up against the nearest wall"], r: ["kiss me hard up against the nearest wall"], sg: ["kiss you breathless"], sr: ["kiss me breathless"] },
    "Neck kissing": { g: ["kiss my way down your neck, slow"], r: ["kiss your way down my neck, slow"], sg: ["kiss your neck"], sr: ["kiss my neck"] },
    "Cuddling": { g: ["pull you in close and not let go"], r: ["pull me in close and not let go"], sg: ["pull you in close"], sr: ["pull me in close"] },
    "Body worship": { g: ["make you worship every inch of me with your mouth"], r: ["make me worship every inch of you"], sg: ["make you kiss every inch of me"], sr: ["make me kiss every inch of you"] },
    "Oral": { g: ["put you on your knees and make you use your mouth on me"], r: ["put me on my knees and make me use my mouth on you"] },
    "Fingering & hand stuff": { g: ["slide my hand between your legs and take my time"], r: ["slide your hand between my legs and take your time"] },
    "Grinding": { g: ["pin you down and grind against you until you're desperate"], r: ["grind against me until I'm desperate"] },
    "Rough sex": { g: ["take you hard, right where I find you"], r: ["take me hard, right where you find me"] },
    "Slow & sensual": { g: ["take you slow, so slow you beg me to hurry"], r: ["take me slow, so slow I beg you to hurry"], sg: ["take things slow with you"], sr: ["take things slow with me"] },
    "Nipple play": { g: ["tease your nipples until you're arching for more"], r: ["tease my nipples until I'm arching for more"] },
    "Ass worship": { g: ["put you on your knees behind me and make you worship my ass"], r: ["put me on my knees behind you and make me worship your ass"] },
    "Foot rubs": { g: ["make you rub my feet"], r: ["make me rub your feet"], sg: ["have you rub my feet"], sr: ["have me rub your feet"] },
    "Masturbation": { g: ["watch you touch yourself and not let you stop"], r: ["watch me touch myself, and don't look away"] },
    "Hair play": { g: ["run my fingers through your hair, then grab a fistful"], r: ["run your fingers through my hair, then grab a fistful"], sg: ["play with your hair"], sr: ["play with my hair"] },
    "Cock worship": { g: ["put you on your knees and make you worship my cock"], r: ["put me on my knees and make me worship your cock"] },
    "Pussy worship": { g: ["make you worship my pussy until I say stop"], r: ["make me worship your pussy until you say stop"] },
    "Boot worship": { g: ["make you lick my boots clean"], r: ["make me lick your boots clean"] },
    "Feet": { g: ["make you worship my feet"], r: ["make me worship your feet"] },
    "Sucking a strap-on": { g: ["make you suck my strap-on"], r: ["make me suck your strap-on"] },
    // toys
    "Anal": { g: ["bend you over and take your ass, slow"], r: ["bend me over and take my ass"] },
    "Rimming": { g: ["push your face down and make you use your tongue on me"], r: ["push my face down and make me use my tongue on you"] },
    "Pegging": { g: ["peg you slow and deep"], r: ["peg me slow and deep"] },
    "Plugs": { g: ["slide a plug in you and make you wear it the rest of the night"], r: ["plug me and make me wear it all night"] },
    "Strap-ons": { g: ["strap on and fuck you properly"], r: ["strap on and take me"] },
    "Dildos": { g: ["fuck you with a toy until you're begging"], r: ["use a toy on me until I'm begging"] },
    "Wands": { g: ["press a wand against you and hold it there"], r: ["hold a wand on me until I break"] },
    "Remote-control toys": { g: ["put a toy in you and keep the remote in my pocket"], r: ["make me wear a toy and keep the remote"], sg: ["make you wear a toy while I hold the remote"], sr: ["hand you the remote to my toy"] },
    "Prostate play": { g: ["find your prostate and not let up"], r: ["find my prostate and not let up"] },
    // fluids
    "Spit": { g: ["spit in your mouth and make you say thank you"], r: ["spit in my mouth"] },
    "Cum play": { g: ["cover you and make you play with it"], r: ["cover me in it"] },
    "Cum in mouth": { g: ["finish in your mouth"], r: ["finish in my mouth"] },
    "Swallowing": { g: ["finish in your mouth and watch you swallow"], r: ["finish in my mouth and watch me swallow"] },
    "Facials": { g: ["finish all over your face"], r: ["finish all over my face"] },
    "Creampies": { g: ["finish deep inside you"], r: ["finish deep inside me"] },
    "Cum on body": { g: ["finish all over you"], r: ["finish all over me"] },
    "Squirting": { g: ["soak you completely"], r: ["make me squirt all over you"] },
    // out and about (one-sided jars)
    "Outdoor sex": { g: ["take you right here under the open sky"], r: ["take me right here under the open sky"] },
    "Risk of getting caught": { g: ["take you somewhere we could get caught any second"], r: ["take me somewhere we could get caught any second"] },
    "Exhibitionism": { g: ["show you off where anyone could see"], r: ["show me off where anyone could see"] },
    "Mirrors": { g: ["put you in front of a mirror so you watch everything I do"], r: ["put me in front of a mirror so I watch everything"] },
    "Public teasing": { g: ["tease you where everyone can see and nobody knows"], r: ["tease me where everyone can see and nobody knows"], sg: ["tease you in public"], sr: ["tease me in public"] },
    "Sexting": { g: ["send you something that'll ruin your whole day"], r: ["send me something that'll ruin my whole day"], sg: ["send you something that'll make you blush"], sr: ["send me something that'll make me blush"] },
    // scenes (one-sided jars)
    "Hunter & hunted": { g: ["drag you down like the prey you are"], r: ["drag me down like the prey I am"], sg: ["drag you back to my den"], sr: ["drag me back to your den"] },
    "Primal play": { g: ["take you down on the ground like an animal"], r: ["take me down on the ground like an animal"], sg: ["pounce on you"], sr: ["pounce on me"] },
    "Captor & captive": { g: ["drag you back to my lair and keep you there"], r: ["drag me back to your lair and keep me there"] },
    "Fear play": { g: ["make you wonder what I'm going to do next"], r: ["make me afraid of what you'll do next"] },
    "Consensual non-consent": { g: ["take what I want from you, however much you squirm"], r: ["take what you want from me, however much I squirm"] },
    "Free use": { g: ["use you whenever I want for the rest of the night"], r: ["use me whenever you want for the rest of the night"] },
    "Pet play": { g: ["make you crawl to me like a good pet"], r: ["make me crawl to you like a good pet"] },
    "Strangers meeting": { g: ["pretend we've never met and seduce you all over again"], r: ["pretend we've never met and seduce me all over again"], sg: ["pretend we've never met"], sr: ["pretend we've never met"] },
    "Breeding talk": { g: ["breed you"], r: ["breed me"] },
  };
  // The prey's scared lines: short, in their own words, one jar at a time (Teasing and Spicy).
  const FEAR = {
    "Spanking": ["I can already feel your hand coming down. I'm not ready.", "Please, not a spanking. I won't be able to sit tomorrow."],
    "Over the knee": ["If you get me over your knee, I'm done for."], "Paddling": ["I saw the paddle. I'm not coming out."],
    "Flogging": ["I keep hearing the flogger in my head. Stay away."], "Caning": ["Not the cane. Anything but the cane."],
    "Riding crops": ["Every snap I hear out here, I think it's the crop."], "Hair pulling": ["If your hand gets in my hair, it's over."],
    "Biting": ["My neck's still sore from last time. Stay away."], "Scratching": ["I don't want your nails anywhere near me."],
    "Leaving marks": ["If you catch me, everyone's going to see the marks tomorrow."], "Nipple clamps": ["I know you've got the clamps. I'm staying right here."],
    "Counting strokes": ["I'm not counting for you. I'm not."], "Wrestling": ["You're stronger than me. That's the problem."],
    "Tied up": ["If you get rope on me, I'm not getting away."], "Light bondage": ["One knot and I'm yours. Don't find me."],
    "Heavy bondage": ["If you tie me down properly, I'm never getting loose."], "Rope / shibari": ["I can hear rope sliding through your hands."],
    "Handcuffs": ["I heard the cuffs click. Please stay away."], "Tied to the bed": ["Don't drag me back to that bed."],
    "Gags": ["If you gag me, nobody hears a thing. That's what scares me."], "Blindfolds": ["Don't blindfold me. I need to see you coming."],
    "Spreader bars": ["Not the spreader bar. Please."], "Hands held down": ["If you pin my wrists, I can't fight you off."],
    "Immobilization": ["If you hold me down, I won't be able to move at all."],
    "Orgasm control": ["You'll decide when I get to come. I'm not ready for that."], "Orgasm denial": ["You'll keep me on the edge all night. I know you will."],
    "Edging": ["I can't take being edged again. Stay away."], "Forced orgasms": ["You won't stop. That's what scares me."],
    "Ruined orgasms": ["Please don't ruin it for me again."], "Begging": ["I'm not begging. I won't. Don't make me."],
    "Punishments": ["I know I've earned a punishment. I'm still hiding."], "Commands": ["If you start giving orders, I'll obey. I hate that."],
    "Verbal commands": ["One word from you and I'll obey. Don't say it."], "Kneeling": ["Don't put me on my knees. Please."],
    "Collars": ["If that collar goes on, I'm yours. Stay away."], "Leashes": ["I can hear the leash jingling."],
    "Chastity": ["Don't lock me up again."], "Teasing": ["Please don't tease me. I can't take it tonight."],
    "Forced nudity": ["I'm not letting you strip me. I'm not."], "Masturbation on command": ["Don't make me touch myself in front of you."],
    "Bratting & taming": ["You'll tame me. That's exactly what I'm scared of."], "Asking permission": ["I don't want to ask permission for everything."],
    "On display": ["Don't put me on display."], "Wax play": ["I can smell the candle. I'm not coming out."],
    "Ice play": ["Keep that ice away from me."], "Feathers": ["Not the feathers. I'll break."],
    "Tickling": ["If you tickle me, I'll scream and give myself away."], "Vibrators": ["I can hear it buzzing. Stay away."],
    "Sensory deprivation": ["If you take my eyes and ears, all I'll have is you."], "Overstimulation": ["You won't stop when I'm too sensitive. I know you won't."],
    "Knife play (no cutting)": ["I saw the blade. I'm not moving."], "Choking": ["If your hand gets around my throat, I'm done."],
    "Hand on throat (no pressure)": ["I can almost feel your hand on my throat."], "Hand over mouth": ["If your hand covers my mouth, nobody hears me."],
    "Dirty talk": ["Don't say those things to me. I'll melt."], "Praise": ["If you call me good, I'll do anything. Don't."],
    "Good girl / good boy": ["Don't call me good. I'll fold."], "Humiliation & degradation": ["Don't remind me what I am."],
    "Name calling": ["Don't call me those names. Please."], "Pet names": ["If you call me pet, I'll come crawling."],
    "Moaning & noise": ["If you make me moan, you'll know exactly where I am."], "Objectification": ["Don't use me like that. Please."],
    "Kissing": ["If you kiss me, I'll stop running."], "Neck kissing": ["Stay away from my neck. It's my weakness."],
    "Body worship": ["You'll make me worship you. Every inch."], "Rimming": ["I know where my tongue is going if you catch me."],
    "Ass worship": ["You'll have me on my knees behind you. I know it."], "Cock worship": ["I know what you'll make me worship."],
    "Pussy worship": ["I know what you'll make me worship."], "Boot worship": ["You'll have me licking your boots. I just know it."],
    "Sucking a strap-on": ["I know what you're going to put in my mouth."], "Feet": ["You'll have me at your feet. Literally."], "Oral": ["I know exactly where my mouth is going if you catch me.", "If you catch me, I'm ending up on my knees. I know it."],
    "Fingering & hand stuff": ["Keep your hands to yourself. Please."], "Rough sex": ["You'll be rough with me. I know you will."],
    "Nipple play": ["Stay away from my nipples. I mean it."], "Anal": ["Not my ass. Please, not tonight."],
    "Plugs": ["If you plug me, I'll feel it all night."], "Strap-ons": ["I saw the strap-on. I'm not coming out."],
    "Dildos": ["Keep that toy away from me."], "Wands": ["Not the wand. I can't handle the wand."],
    "Remote-control toys": ["If that toy goes in, you control everything."], "Pegging": ["I'm not ready to be pegged. Not yet."],
    "Spit": ["Don't spit on me. Please."], "Facials": ["Not my face. Please."],
    "Outdoor sex": ["Not out here. Someone could see."], "Risk of getting caught": ["Not here. Someone will catch us."],
    "Exhibitionism": ["Don't show me off. Please."], "Mirrors": ["Don't make me watch."],
    "Hunter & hunted": ["You're the hunter. I'm the prey. I know how this ends."], "Primal play": ["You don't even sound human anymore."],
    "Captor & captive": ["If you drag me back to your lair, I'm never leaving."], "Fear play": ["I'm actually scared now."],
    "Consensual non-consent": ["If you catch me, struggling won't help. I know that."], "Free use": ["If you catch me, I'm yours to use. That terrifies me."],
    "Pet play": ["Don't make me crawl."],
  };
  // In Flirty games the scared line is just nerves.
  const NERVES = ["Okay, I'm actually a little nervous now 😳", "Why is my heart beating this fast? 🙈", "If you find me, I'm going to squeal so loud",
    "I'm hiding behind my hands right now 🙈", "I heard something. Is that you? Please say no.", "Don't laugh, but I'm shaking a little"];
  // How a tease is said. {a} = the act; "give" = I do it to you, "get" = you do it to me.
  const FRAMES = {
    hunter: {
      give: { flirty: ["Find you first, then maybe I'll {a} 😏", "When I catch you, I might just {a}"],
        teasing: ["When I catch you, I'm going to {a}.", "Keep running. I'm still going to {a}."],
        spicy: ["When I catch you, I'm going to {a}.", "No more games. I'm going to {a}.", "All I can think about is how I'm going to {a}."] },
      get: { flirty: ["When I catch you, maybe you'll {a} 😏"],
        teasing: ["When I catch you, you're going to {a}.", "Once I find you, you're going to {a}."],
        spicy: ["When I catch you, you're going to {a}. No arguing.", "I'm going to find you, and you're going to {a}.", "When I get my hands on you, you'll {a}."] },
    },
    prey: {
      give: { flirty: ["Catch me and maybe I'll {a} 😇", "If you catch me, I might {a}"],
        teasing: ["If you catch me, I'm going to {a}.", "Win this and I'll {a}."],
        spicy: ["Catch me and I'll {a}.", "Find me and I'm going to {a}. Hurry.", "I'm hiding here thinking about how I'm going to {a}."] },
      // The prey doesn't ask for it. Two moods: scared, and secretly wanting it. (The taunts come from the general lines.)
      scared: {
        flirty: ["If you find me, you'll {a}. So please don't find me.", "Keeping very, very still, because I know you'd {a}."],
        teasing: ["Every sound, I think it's you, coming to {a}.", "Don't find me. I know you'll {a}.", "I can hear you. If you find me, you'll {a}, and I won't be able to stop you."],
        spicy: ["I can hear you breathing. If you find me, you'll {a}, and there's nothing I can do.", "Please don't find me. I know exactly what you'll do: {a}.", "My hands won't stop shaking. You're going to {a}."],
      },
      horny: {
        flirty: ["Part of me hopes you find me and {a}.", "Hiding… but not very hard. Maybe you'll {a}."],
        teasing: ["I'm hiding, but I keep hoping you'll find me and {a}.", "Part of me wants to get caught, just so you'll {a}."],
        spicy: ["God, I want you to find me and {a}.", "I'm so worked up thinking about you coming to {a}.", "I'm barely hiding. Find me and {a}."],
      },
    },
  };
  const GEAR_SAY = { "Lingerie": "lingerie", "Stockings": "stockings", "Heels": "heels", "Leather": "leather", "Latex": "latex", "Rubber": "rubber",
    "PVC": "PVC", "Corsets": "a corset", "Harnesses": "a harness", "Boots": "boots", "Gloves": "gloves", "Fishnets": "fishnets", "Suits & ties": "a suit and tie",
    "Jockstraps": "a jockstrap", "Collar & tags": "a collar and tags", "Spandex": "spandex", "Slutty outfits": "something slutty" };
  // Clothing jars: "wear" = I wear it, "see" = you wear it for me. {k} = the item.
  const GEAR = {
    hunter: { wear: ["Hide all you like. I'm in {k}, and I'm coming for you.", "When I catch you, you'll find out what's under this. Hint: {k}."],
      see: ["When I catch you, you're putting on {k} for me.", "You're wearing {k} for me tonight."] },
    prey: { wear: ["Of all nights to be hiding in {k}. Please don't find me.", "I'm hiding in nothing but {k}. Part of me hopes you find me."],
      see: ["If you catch me, I want to see you in {k}.", "Find me, then put on {k} for me."] },
  };
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
  // The hunter is always the one doing it, and the prey always the one it's done to: the hunter's doing side
  // has to meet the prey's receiving side. (For clothing, the prey is the one who wears it.)
  // Jars where the one being served is in charge: the prey does the serving (their first side), the hunter receives.
  const SERVICE = new Set(["Oral", "Rimming", "Body worship", "Ass worship", "Foot rubs", "Massage", "Cock worship", "Pussy worship", "Boot worship", "Heel worship", "Feet", "Muscle worship"]);
  function kinkTeases(mine, theirs, words, role) {
    const ok = (v) => v >= 1 && v <= 5;
    const out = [];
    (window.KINKJARS || []).forEach(([code, label, sA, , , cat]) => {
      if (SKIP_CATS.has(cat) || hitsLimit(label, words) || (!ACTS[label] && !GEAR_SAY[label])) return;
      const t = theirs.r.get(code) || [0, 0], m = (mine && mine.r.get(code)) || [0, 0];
      if (t.includes(7) || m.includes(7)) return;   // a hard no for either of you anywhere on this jar: leave it alone
      const base = { label, cat };
      const push = (my, th, dir) => {
        if (ok(my) && ok(th)) out.push({ ...base, dir, lvl: my >= 4 && th >= 4 ? "love" : "mutual" });
        else if (th >= 3 && th <= 5 && (my === 0 || my === 6)) out.push({ ...base, dir, lvl: "theirs" });
      };
      if (sA) {
        const gear = cat === "gear";
        if (gear) { if (role === "hunter") push(m[1], t[0], "see"); else push(m[0], t[1], "wear"); }   // the prey wears it, the hunter looks
        else if (SERVICE.has(label)) { if (role === "hunter") push(m[1], t[0], "give"); else push(m[0], t[1], "get"); }   // the prey serves
        else if (role === "hunter") push(m[0], t[1], "give");   // my doing side meets their receiving side
        else push(m[1], t[0], "get");                            // their doing side meets my receiving side
      } else push(m[0] || m[1], t[0] || t[1], "both");
    });
    return out;
  }
  const heatOk = (c, heat) => heat === "spicy" || (heat === "teasing" ? !HEAVY_CATS.has(c.cat) && !HEAVY.has(c.label) : c.cat === "gear" || !!(ACTS[c.label] && ACTS[c.label].sg));

  function teaseLine(c, role, heat, mood) {
    const any = (l) => l[Math.floor(Math.random() * l.length)];
    if (c.cat === "gear") { const l = GEAR[role][c.dir === "wear" ? "wear" : "see"]; return (role === "prey" ? l[mood === "horny" ? 1 : 0] : any(l)).replace(/\{k\}/g, GEAR_SAY[c.label]); }
    // One-sided jars: the hunter does it, the prey asks for it.
    if (role === "prey" && mood === "scared") return heat === "flirty" ? any(NERVES) : FEAR[c.label] ? any(FEAR[c.label]) : null;
    const dir = c.dir === "both" ? (role === "hunter" ? "give" : "get") : c.dir;
    const A = ACTS[c.label], soft = heat === "flirty";
    const acts = dir === "give" ? (soft ? A.sg : A.g) : (soft ? A.sr : A.r);
    if (!acts || !acts.length) return null;
    const frames = role === "prey" ? FRAMES.prey[mood || "scared"][heat] : FRAMES[role][dir][heat];
    const act = any(acts);
    return any(frames).replace(/\{A\}/g, cap(act)).replace(/\{a\}/g, act).replace(/\{w\}/g, WORD);
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function pickTease(list, heat) {
    const fit = list.filter((c) => heatOk(c, heat));
    if (!fit.length) return null;
    const w = (c) => (c.lvl === "love" ? (heat === "spicy" ? 6 : 4) : c.lvl === "mutual" ? 2 : 1);
    let r = Math.random() * fit.reduce((a, c) => a + w(c), 0);
    for (const c of fit) { r -= w(c); if (r <= 0) return c; }
    return fit[0];
  }

  // The winner's last word: lines by heat and how it ended, plus jar lines ("Caught. Now I'm going to …").
  const FINAL = {
    hunter: {
      flirty: ["Gotcha! 🐺 Told you I'd find you", "Caught you fair and square 😏", "That was fun. Same time tomorrow?", "Found you. Now come here 💜",
        "You were adorable trying to hide", "Caught! You owe me, cutie", "Nobody hides from me for long 😘"],
      teasing: ["Caught. Every hour you ran made this sweeter", "Look who's mine now", "All that running and you still ended up in my hands",
        "Don't even think about squirming away", "Now you find out what I do with my catch", "Got you. Breathe. You'll need it.", "Shh. You're not going anywhere."],
      spicy: ["Caught. On your knees.", "Mine. Every inch of you.", "You're going to feel tonight for days", "All that running just made me hungrier",
        "Strip. Now.", "You made me hunt all night. Now you pay for it.", "Pinned, breathless and all mine", "Hold still. I've earned this."],
    },
    prey: {
      flirty: ["Made it to dawn! 🌅 Better luck next time, wolf", "Too slow 😝", "Sunrise and I'm still free. Rematch?", "Aww, did you lose me? 😇",
        "I'll be picturing your sad little face all day", "Free as a bird. A very smug bird. 🐦"],
      teasing: ["All night and you never even touched me", "You were so close. That must hurt.", "Hungry? Shame.", "I could hear you getting frustrated. Delicious.",
        "Next time, hunt like you mean it", "I'll let you catch me… maybe next time", "Sweet dreams, hunter. Dream of me."],
      spicy: ["You'll be aching for me all day", "Think about what you missed while you're alone tonight", "I was right there, wearing almost nothing. Too bad.",
        "Go to bed hungry, hunter", "I was so turned on the whole time you missed me", "Next time I might let you win. Maybe.", "Now I'm the one who decides what happens to you"],
    },
  };
  const FINAL_FRAMES = {
    hunter: {
      give: { flirty: ["Caught you 😏 Now I get to {a}.", "Gotcha. Time to {a}."], teasing: ["Caught. Now hold still while I {a}.", "Mine. First, I'm going to {a}."],
        spicy: ["Caught. Now I'm going to {a}, and you're going to take it.", "You're mine now. I'm going to {a}.", "Down you go. Time to {a}."] },
      get: { flirty: ["Caught you 😏 Now you get to {a}."], teasing: ["Caught. Now you're going to {a}.", "Gotcha. You know what happens now: {a}."],
        spicy: ["Caught. Now {a}. Go on.", "You're mine. Now {a}, and don't stop until I say."] },
    },
    prey: {
      give: { flirty: ["Made it to dawn 😇 Next time maybe I'll {a}."], teasing: ["Too slow. Now I'm the one who gets to {a}.", "Dawn's here, so I'm calling the shots: I'm going to {a}."],
        spicy: ["I won, so here's what happens: I'm going to {a}.", "Sunrise, and you're mine instead. I'm going to {a}."] },
      get: { flirty: ["Made it! 😮‍💨 You almost got to {a}."], teasing: ["Phew. I really thought you were going to {a}.", "Dawn. I was so sure you'd {a}."],
        spicy: ["I'm still shaking. You were so close to getting to {a}.", "Sunrise, and I'm safe. I kept picturing how you'd {a}…"] },
    },
  };
  function finalTease(c, role, heat) {
    const any = (l) => l[Math.floor(Math.random() * l.length)];
    if (c.cat === "gear") return role === "hunter"
      ? (c.dir === "wear" ? `Caught. Want to see what's under ${GEAR_SAY[c.label]}?` : `Caught. Go put on ${GEAR_SAY[c.label]} for me.`)
      : `Made it to dawn, still in ${GEAR_SAY[c.label]}. You never saw a thing 😮‍💨`;
    const dir = c.dir === "both" ? (role === "hunter" ? "give" : "get") : c.dir;
    const A = ACTS[c.label], soft = heat === "flirty";
    const acts = dir === "give" ? (soft ? A.sg : A.g) : (soft ? A.sr : A.r);
    if (!acts || !acts.length) return null;
    return any(FINAL_FRAMES[role][dir][heat]).replace(/\{a\}/g, any(acts)).replace(/\{w\}/g, WORD);
  }

  // A small picker under the line box: four lines (a hint, a tease and two for the heat; 🔄 for more) and some emojis.
  function quickPicker(h, role, heat, input, opts) {
    opts = opts || {};
    const LINES = opts.pool || QUICK;
    const pool = (LINES[role] && LINES[role][heat]) || LINES[role].flirty;
    const max = opts.max || 140;
    const used = new Set();
    let where = null, near = [], teases = [], blocked = new Set();
    const chips = h("div", { class: "quick-lines" });
    const chip = (t, cls) => h("button", { type: "button", class: "quick" + (cls ? " " + cls : ""), onclick: () => { input.value = t.slice(0, max); input.focus(); } }, t);
    const whereLine = () => {
      if (!where) return null;
      const list = WHERE[role][heat];
      // The prey's hint is about a random spot they could be in: the one they picked, or one a move away from it.
      const spot = role === "prey" && near.length ? near[Math.floor(Math.random() * near.length)] : where;
      if (role === "prey" && !spot.c) return null;
      const ok = list.filter((x) => lineOk(x, blocked));
      const t = (ok.length ? ok : list)[Math.floor(Math.random() * (ok.length ? ok : list).length)];
      return t.replace(/\{C\}/g, cap(spot.c || "")).replace(/\{c\}/g, spot.c || "").replace(/\{s\}/g, spot.n.toLowerCase());
    };
    let hint = null, tease = [], extra = [];
    const draw = () => {
      const top = [hint ? [hint, "hint"] : null, ...tease.map((t) => [t, "tease"])].filter(Boolean);
      chips.replaceChildren(...top.concat(extra.slice(0, 4 - top.length).map((t) => [t, ""])).map(([t, cls]) => chip(t, cls)),
        h("button", { type: "button", class: "quick more", title: "More lines", "aria-label": "Show more lines", onclick: deal }, "🔄"));
    };
    function deal() {
      hint = whereLine();
      // The prey gets a scared line and a horny one; the hunter (and the last word) gets one.
      const moods = role === "prey" && !opts.tease ? ["scared", "horny"] : [null];
      tease = [];
      moods.forEach((mood) => {
        for (let n = 0; n < 8; n++) {
          const c = pickTease(teases, heat); if (!c) break;
          const t = (opts.tease || teaseLine)(c, role, heat, mood);
          if (t && lineOk(t, blocked) && !tease.includes(t)) { tease.push(t); break; }
        }
      });
      const fine = pool.map((t, i) => i).filter((i) => lineOk(pool[i], blocked));
      if (fine.filter((i) => !used.has(i)).length < 4) used.clear();
      extra = fine.filter((i) => !used.has(i)).sort(() => Math.random() - 0.5).slice(0, 4);
      extra.forEach((i) => used.add(i));
      extra = extra.map((i) => pool[i].replace(/\{w\}/g, WORD));
      draw();
    }
    deal();
    const emojis = h("div", { class: "quick-emoji", role: "group", "aria-label": "Add an emoji" }, (EMOJI[role] || []).map((em) =>
      h("button", { type: "button", onclick: () => { if ((input.value + em).length <= max) { input.value = (input.value ? input.value.replace(/\s*$/, " ") : "") + em; input.focus(); } } }, em)));
    const el = h("div", { class: "quick-picker" }, h("span", { class: "faint" }, opts.caption || "Tap one, type your own, or skip it. 📍 is a hint about your spot, 🫙 comes from your Kink Jars."), chips, emojis);
    // The map tells the picker which spot you've tapped, so the hint line can match it.
    el.setWhere = (spot, alts) => { where = spot; near = alts || []; hint = whereLine(); draw(); };
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
    // Games still going are always shown (anything waiting on you first). Finished ones are tucked
    // underneath, newest first, three at a time.
    const ago = (t) => { const d = (Date.now() - new Date(String(t).replace(" ", "T"))) / 864e5; return !(d >= 0) ? "" : d < 1 ? "today" : d < 2 ? "yesterday" : d < 7 ? `${Math.floor(d)} days ago` : new Date(String(t).replace(" ", "T")).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }); };
    const heatLabel = (g) => (HEATS.find((x) => x[0] === g.heat) || [, ""])[1];
    const row = (g, done) => h("a", { class: "hunt-row" + (g.invitedMe || g.myTurn ? " hot" : "") + (done ? " done" : ""), href: "/hunt/" + g.id, "data-nav": "" },
      g.other ? deps().miniAvatar(g.other) : null,
      h("span", { class: "txt" }, h("b", {}, (g.role === "hunter" ? (done ? "🐺 You hunted " : "🐺 You're hunting ") : "🐇 Hunted by ") + (g.other ? g.other.display_name : "someone"), g.random ? h("span", { class: "new-pill" }, "🎲 Random") : null),
        h("small", {}, statusText(g) + " · " + heatLabel(g) + (done && g.updated ? " · " + ago(g.updated) : ""))),
      h("span", { class: "arrow", "aria-hidden": "true" }, "→"));
    const recent = (g) => Date.now() - new Date(String(g.updated).replace(" ", "T")) < 2 * 864e5;
    const live = data.hunts.filter((g) => g.status === "invited" || g.status === "active").sort((a, b) => (b.invitedMe || b.myTurn) - (a.invitedMe || a.myTurn));
    const done = data.hunts.filter((g) => !(g.status === "invited" || g.status === "active") && g.status !== "cancelled" && (g.status !== "declined" || recent(g)));
    let shown = 3;
    const doneList = h("div", { class: "hunt-list" });
    const moreBtn = h("button", { type: "button", class: "btn small ghost" });
    const drawDone = () => {
      doneList.replaceChildren(...done.slice(0, shown).map((g) => row(g, true)));
      const left = done.length - shown;
      moreBtn.hidden = left <= 0;
      moreBtn.textContent = `Show ${Math.min(left, 5)} more`;
    };
    moreBtn.addEventListener("click", () => { shown += 5; drawDone(); });
    drawDone();
    const gameList = !data.hunts.length ? h("p", { class: "muted" }, "No hunts yet.") : h("div", {},
      live.length ? h("div", { class: "hunt-list" }, live.map((g) => row(g, false))) : h("p", { class: "faint", style: "margin:0" }, "Nothing going right now."),
      done.length ? h("div", { class: "hunt-done" }, h("h3", {}, `Finished (${done.length})`), doneList, h("div", { class: "actions", style: "margin-top:8px" }, moreBtn)) : null);

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
        const at = chosen.length ? chosen[chosen.length - 1] : null;
        picker.setWhere(at === null ? null : SP[at], at !== null && trail && g.role === "prey"
          ? SP.filter((_, j) => TRAIL_D[at][j] <= (g.maxStep || 2)) : null);
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
    const loadTeases = async (pk) => {
      const K = window.KinkJarsImport, words = limitWords(g.otherLimits, g.myLimits);
      let mine = null, theirs = null;
      if (K && g.myKj) { try { mine = await K.resolve(g.myKj); } catch {} }
      if (K && g.otherKj) { try { theirs = await K.resolve(g.otherKj); } catch {} }
      pk.setTeases(theirs && !g.kinkOff ? kinkTeases(mine, theirs, words, g.role) : [], blockedJars(mine, theirs, words));
    };
    if (g.myTurn) loadTeases(picker);
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
        const lastPicker = quickPicker(h, g.role, g.heat, ta, { pool: FINAL, tease: finalTease, max: 280, caption: "Tap one, write your own, or leave it. 🫙 comes from your Kink Jars." });
        loadTeases(lastPicker);
        const send = h("button", { type: "button", class: "btn small gold" }, "Have the last word");
        send.addEventListener("click", async () => { try { await pb.send(`/api/vc/hunts/${g.id}/final`, { method: "POST", body: { text: ta.value.trim() } }); renderGame(app, g.id); } catch (err) { toast(errMsg(err), true); } });
        parts.push(h("p", { class: "faint" }, "Winner gets the last word (optional)."), ta, lastPicker, h("div", { class: "actions" }, send));
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
