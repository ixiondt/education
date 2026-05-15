#!/usr/bin/env python3
"""
Generate a complete free audio pack for the Letters & Numbers PWA using
Microsoft Edge's neural TTS via the `edge-tts` library (open-source,
no API key required, redistributable for personal use).

What it produces
----------------
  audio/letters/name/A.mp3 ... Z.mp3   (26)   "A", "B", "C", ...
  audio/letters/sound/A.mp3 ... Z.mp3  (26)   "ah", "buh", "kuh", ...
  audio/letters/word/A.mp3 ... Z.mp3   (26)   "Apple", "Bee", "Cat", ...
  audio/numbers/0.mp3 ... 10.mp3       (11)   "zero", "one", "two", ...
                                       === 89 clips total ===

The PWA's existing tryAudio() chain (see app.js sayLetter / sayNumber /
sayWord) automatically prefers these MP3 files over synthetic TTS when
the customAudio setting is set to "auto" in Settings. So once generated,
no app code changes needed.

Quick start
-----------
  python -m pip install --user edge-tts
  python scripts/generate-voices.py

  # then in the app: Settings -> Custom audio files -> Use if present

Voices to try
-------------
The script defaults to "en-US-AriaNeural" — a warm, kid-friendly female
voice. To use a different one:

  python scripts/generate-voices.py --voice en-US-JennyNeural
  python scripts/generate-voices.py --voice en-GB-SoniaNeural
  python scripts/generate-voices.py --voice en-US-AnaNeural   # this one is younger-sounding

List all available voices:

  python -c "import asyncio, edge_tts; print('\\n'.join(v['ShortName'] for v in asyncio.run(edge_tts.list_voices()) if v['Locale'].startswith('en')))"

Re-running
----------
Idempotent — safe to re-run. Files are overwritten in place, so you can
swap voices anytime. If you want a different voice for a single letter
(e.g., a parent voice for A specifically), record it through the in-app
Settings -> Record your voice flow; IndexedDB recordings take priority
over MP3 files.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Windows console defaults to cp1252; force UTF-8 so progress prints don't
# crash on Unicode characters (the audio files themselves are unaffected).
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError):
    pass

try:
    import edge_tts
except ImportError:
    sys.stderr.write(
        "edge-tts is not installed. Install it with:\n"
        "    python -m pip install --user edge-tts\n"
    )
    sys.exit(1)


# ---------- Content (must match letters.js / curriculum.js) ----------

LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
NUMBERS = list("0123456789") + ["10"]

# Approximate phonemes for each letter — matches LETTER_SOUNDS in letters.js
SOUNDS = {
    # 'consonant + uh' form for stops; same pattern for continuants so the
    # whole alphabet has a consistent TTS-friendly phonics cadence. The
    # phonetically-precise sustained forms ('sss','zzz') sound buzzy through
    # neural TTS — Aria reads them as a literal hiss/buzz rather than a
    # short phoneme. The 'uh' form trades a small amount of phonetic
    # accuracy for far better audio quality.
    "A": "ah",  "B": "buh", "C": "kuh", "D": "duh", "E": "eh",
    "F": "fuh", "G": "guh", "H": "huh", "I": "ih",  "J": "juh",
    "K": "kuh", "L": "luh", "M": "muh", "N": "nuh", "O": "oh",
    "P": "puh", "Q": "kwuh","R": "ruh", "S": "suh", "T": "tuh",
    "U": "uh",  "V": "vuh", "W": "wuh", "X": "ks",  "Y": "yuh", "Z": "zuh",
}

# Picture-words — matches LETTER_WORDS in letters.js
WORDS = {
    "A": "Apple",  "B": "Bee",      "C": "Cat",       "D": "Dog",
    "E": "Elephant","F": "Fish",     "G": "Goat",     "H": "Hat",
    "I": "Ice",    "J": "Jellyfish","K": "Kite",      "L": "Lion",
    "M": "Monkey", "N": "Nest",     "O": "Octopus",   "P": "Pig",
    "Q": "Queen",  "R": "Rabbit",   "S": "Snake",     "T": "Tree",
    "U": "Umbrella","V": "Van",     "W": "Whale",     "X": "Fox",
    "Y": "Yarn",   "Z": "Zebra",
}

# Numbers in words — synth pronounces digits ok but words are more reliable
NUMBER_WORDS = {
    "0": "zero",  "1": "one",   "2": "two",   "3": "three",  "4": "four",
    "5": "five",  "6": "six",   "7": "seven", "8": "eight",
    "9": "nine",  "10": "ten",
}

# v5 — concept labels for whole-child modes. Path: audio/<category>/<key>.mp3
# Spoken text is the human-readable label; key is the filename.
FEELINGS = {
    "happy": "happy", "sad": "sad", "angry": "angry", "surprised": "surprised",
    "scared": "scared", "tired": "tired", "excited": "excited", "calm": "calm",
}

BODY = {
    "eye": "eye", "nose": "nose", "ear": "ear", "mouth": "mouth",
    "hand": "hand", "foot": "foot", "arm": "arm", "leg": "leg",
}

SHAPES_LBL = {
    "circle": "circle", "square": "square", "triangle": "triangle",
    "rectangle": "rectangle", "oval": "oval", "star": "star",
    "heart": "heart", "hexagon": "hexagon",
}

COLORS_LBL = {
    "red": "red", "blue": "blue", "yellow": "yellow", "green": "green",
    "orange": "orange", "purple": "purple", "pink": "pink",
    "brown": "brown", "black": "black", "white": "white",
}

ANIMALS = {
    "bear": "bear", "fish": "fish", "bird": "bird", "lion": "lion",
    "penguin": "penguin", "camel": "camel", "cow": "cow",
    "monkey": "monkey", "frog": "frog", "butterfly": "butterfly",
    # v5.5 — toddler-tap additions
    "dog": "dog", "cat": "cat", "pig": "pig", "sheep": "sheep",
    "rabbit": "rabbit", "duck": "duck", "bee": "bee",
}

HABITATS = {
    "forest": "forest", "water": "water", "tree": "tree",
    "grassland": "grassland", "ice": "ice", "desert": "desert",
    "farm": "farm", "jungle": "jungle", "pond": "pond", "flower": "flower",
}

HELPERS = {
    "firefighter": "firefighter", "doctor": "doctor", "teacher": "teacher",
    "police": "police officer", "chef": "chef", "farmer": "farmer",
    "mechanic": "mechanic", "mail": "mail carrier",
}

# v5.5 — toddler-tap everyday objects + people (first words)
SMABARN = {
    "ball": "ball", "milk": "milk", "apple": "apple", "car": "car",
    "bath": "bath", "shoe": "shoe", "bed": "bed",
    "sun": "sun", "moon": "moon",
    "baby": "baby", "mama": "mama", "dada": "dada",
}

# Sight words (Dolch pre-primer) — 40 high-frequency reading words.
# Keys are filename-safe (always lowercase) — Linux droplet is case-sensitive,
# so the app requests audio/sight-words/<lowercase>.mp3.
# Values are what TTS actually says (preserves "I" capitalization for natural reading).
SIGHT = {
    "a":"a", "and":"and", "at":"at", "away":"away", "big":"big",
    "blue":"blue", "can":"can", "come":"come", "down":"down",
    "find":"find", "for":"for", "funny":"funny", "go":"go",
    "help":"help", "here":"here", "i":"I", "in":"in", "is":"is",
    "it":"it", "jump":"jump", "little":"little", "look":"look",
    "make":"make", "me":"me", "my":"my", "not":"not", "on":"on",
    "one":"one", "play":"play", "red":"red", "run":"run",
    "said":"said", "see":"see", "the":"the", "three":"three",
    "to":"to", "two":"two", "up":"up", "we":"we", "where":"where",
    "yellow":"yellow", "you":"you",
}

# Vocabulary words used in Rhyme + Blend + animals/helpers names spoken inline
VOC = {
    "cat":"cat", "hat":"hat", "bat":"bat",
    "dog":"dog", "frog":"frog", "log":"log",
    "sun":"sun", "bun":"bun",
    "bee":"bee", "tree":"tree",
    "car":"car", "star":"star", "jar":"jar",
    "cake":"cake", "snake":"snake",
    "ball":"ball", "wall":"wall",
    "ring":"ring", "king":"king",
    "pig":"pig", "bus":"bus", "bug":"bug", "cup":"cup",
    "jam":"jam", "leg":"leg", "web":"web", "net":"net",
    "fox":"fox", "van":"van",
}

# Reusable spoken phrases — round-start prompts, etc.
PHRASES = {
    "how-many":   "How many?",
    "count-them": "Count them.",
    "lets-count": "Let's count.",
    "how-many-do-you-see": "How many do you see?",
    "whats-next": "What comes next?",
    "where-does-it-live": "Where does it live?",
    "find-the-circle":    "Find the circle.",
    "find-the-square":    "Find the square.",
    "find-the-triangle":  "Find the triangle.",
    "find-the-rectangle": "Find the rectangle.",
    "find-the-oval":      "Find the oval.",
    "find-the-star":      "Find the star.",
    "find-the-heart":     "Find the heart.",
    "find-the-hexagon":   "Find the hexagon.",
    "find-red":     "Find red.",
    "find-blue":    "Find blue.",
    "find-yellow":  "Find yellow.",
    "find-green":   "Find green.",
    "find-orange":  "Find orange.",
    "find-purple":  "Find purple.",
    "find-pink":    "Find pink.",
    "find-brown":   "Find brown.",
    "find-black":   "Find black.",
    "find-white":   "Find white.",
    "find-happy":     "Find the happy face.",
    "find-sad":       "Find the sad face.",
    "find-angry":     "Find the angry face.",
    "find-surprised": "Find the surprised face.",
    "find-scared":    "Find the scared face.",
    "find-tired":     "Find the tired face.",
    "find-excited":   "Find the excited face.",
    "find-calm":      "Find the calm face.",
    "where-is-the-eye":   "Where is the eye?",
    "where-is-the-nose":  "Where is the nose?",
    "where-is-the-ear":   "Where is the ear?",
    "where-is-the-mouth": "Where is the mouth?",
    "where-is-the-hand":  "Where is the hand?",
    "where-is-the-foot":  "Where is the foot?",
    "where-is-the-arm":   "Where is the arm?",
    "where-is-the-leg":   "Where is the leg?",
    "fire-question":    "Who helps when there is a fire?",
    "sick-question":    "Who helps when you are sick?",
    "learn-question":   "Who helps you learn at school?",
    "safety-question":  "Who keeps people safe on the street?",
    "food-question":    "Who makes food in a restaurant?",
    "grow-question":    "Who grows our food?",
    "car-question":     "Who fixes cars?",
    "mail-question":    "Who brings the mail?",
    "pick-what":        "Pick what you want to play with.",
    "surprise":         "Surprise me!",
    "plus":             "plus",
    "minus":            "minus",
    "equals":           "equals",
    # v5.9 — time of day
    "time-morning":     "morning",
    "time-noon":        "noon",
    "time-evening":     "evening",
    "time-night":       "night",
    # v5.23 — game-specific phrases. Without these the games fall back
    # to device TTS (often robotic male voice on Windows). Run with
    # --only phrases to regenerate just this section after editing.
    "watch-the-stars":      "Watch the stars, then tap them in order.",
    "memory-praise":        "Nice memory!",
    "tap-green-not-red":    "Tap the green ones. Don't tap the red ones.",
    "focus-praise":         "Great focus!",
    "stop-praise":          "Amazing! You stopped every red one!",
    "sort-by-color-first":  "Sort by color first.",
    "now-sort-color":       "Now sort by color.",
    "now-sort-shape":       "Now sort by shape.",
    "switch-praise":        "Great switching!",
    "watch-the-sky":        "Watch the sky. Tap the shooting stars when they fly.",
    "watch-praise":         "Nice watching!",
    "ready-three":          "Get ready. Three.",
    "count-two":            "Two.",
    "count-one":            "One.",
    "lift-off":             "Lift off!",
    # v6.5.1 — Adventure narration. Each chapter has a stable
    # audioKey in adventures.js that maps 1:1 here. Regenerate with
    #   python scripts/generate-voices.py --only phrases
    # whenever new adventures land.
    "adv-bunny-picnic-1":   "Bunny is packing food. Help sort what to bring!",
    "adv-bunny-picnic-2":   "Count the carrots in the basket.",
    "adv-bunny-picnic-3":   "Now find the letters that spell BUNNY.",
    "adv-bunny-picnic-4":   "Bunny had a wonderful picnic. Thank you!",
    "adv-fox-shoes-1":      "Fox is hopping on one foot. Where are the shoes?",
    "adv-fox-shoes-2":      "Spell FOX to call them back!",
    "adv-fox-shoes-3":      "Count Fox's two new shoes.",
    "adv-fox-shoes-4":      "Hooray! Fox can run again.",
    "adv-rainbow-1":        "Find each color of the rainbow!",
    "adv-rainbow-2":        "Draw your favorite rainbow.",
    "adv-rainbow-3":        "Play a happy rhythm!",
    "adv-rainbow-4":        "What a beautiful day.",
    "adv-snowy-1":          "How does the cold make you feel?",
    "adv-snowy-2":          "Take a moment to breathe like snow drifting.",
    "adv-snowy-3":          "What's the weather like today?",
    "adv-snowy-4":          "A peaceful snow day. Well done.",
    "adv-pirate-1":         "Spell out T-R-E-A-S-U-R-E to unlock the chest.",
    "adv-pirate-2":         "Count the gold coins inside!",
    "adv-pirate-3":         "Sort the shiny things from the rocks.",
    "adv-pirate-4":         "Aaarrr! What a haul, matey.",
    "adv-garden-1":         "Sort the seeds by shape.",
    "adv-garden-2":         "Water the garden. Count the buckets.",
    "adv-garden-3":         "Look at the patterns the leaves make.",
    "adv-garden-4":         "Your garden is growing beautifully.",
    "adv-space-1":          "Get ready for liftoff!",
    "adv-space-2":          "Solve the asteroid equations to clear the way!",
    "adv-space-3":          "Find the planet shapes in the sky.",
    "adv-space-4":          "Welcome back to Earth, astronaut!",
    "adv-forest-1":         "What's the weather like for our hike?",
    "adv-forest-2":         "Spot the animals along the trail.",
    "adv-forest-3":         "Help keep the forest clean. Sort the trash.",
    "adv-forest-4":         "Nature thanks you.",
    "adv-birthday-1":       "Count the candles on the cake.",
    "adv-birthday-2":       "Spell P-A-R-T-Y!",
    "adv-birthday-3":       "How does the birthday feel?",
    "adv-birthday-4":       "Happy birthday! What a great party.",
    "adv-kindness-1":       "What kind choice would you make?",
    "adv-kindness-2":       "Who in your family are you grateful for?",
    "adv-kindness-3":       "Send a kind feeling to someone you love.",
    "adv-kindness-4":       "Kindness is its own gift. Thank you for noticing.",
    "adv-music-1":          "Tap a rhythm with the band.",
    "adv-music-2":          "Move your body to the beat!",
    "adv-music-3":          "Listen to the sound. Can you hear the letters?",
    "adv-music-4":          "What a song!",
    "adv-morning-1":        "Put your morning in order.",
    "adv-morning-2":        "How are you feeling today?",
    "adv-morning-3":        "Take three slow breaths to wake up gently.",
    "adv-morning-4":        "You're ready for the day. Have a good one!",
    "adv-baby-bird-1":      "Hear the bird's first chirp. What letter is that?",
    "adv-baby-bird-2":      "Spell B-I-R-D to call them home.",
    "adv-baby-bird-3":      "Two little eggs are still in the nest. Count them!",
    "adv-baby-bird-4":      "The whole family is together now.",
    "adv-starry-1":         "Watch the night sky carefully.",
    "adv-starry-2":         "Sort the stars by what you see.",
    "adv-starry-3":         "Take a deep breath and look at the moon.",
    "adv-starry-4":         "Goodnight, stars.",
    "adv-whale-1":          "Whales live in the water. Let's match the animals.",
    "adv-whale-2":          "Hold your breath like Whale. Slow. Deep.",
    "adv-whale-3":          "Count the fish swimming past!",
    "adv-whale-4":          "Back to the surface. What a deep dive.",
}

# v5.9 — time-of-day scenario vocabulary (single-word entries only, so the
# resolveWordAudio function in app.js can find them by normalized key)
TIME_VOC = {
    "sunrise":   "sunrise",
    "pancakes":  "pancakes",
    "eggs":      "eggs",
    "sandwich":  "sandwich",
    "sunset":    "sunset",
    "dinner":    "dinner",
    "sleep":     "sleep",
}


async def synth_one(voice: str, text: str, out_path: Path, rate: str = "-10%", volume: str = "+0%"):
    """Generate one MP3 and write to disk."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicator = edge_tts.Communicate(text=text, voice=voice, rate=rate, volume=volume)
    await communicator.save(str(out_path))


# ===========================================================================
# v5.13 — multi-locale voice support
# ---------------------------------------------------------------------------
# K-12 needs Norwegian (matching Rammeplan content) and we eyed Spanish/French
# for v6. The audio path layout becomes:
#   audio/<category>/<key>.mp3              — default locale (en-US)
#   audio/<locale>/<category>/<key>.mp3     — non-default locales
# The PWA's audio resolver tries the locale-specific path first and falls
# back to the default. Pick the locale at generation time:
#   python scripts/generate-voices.py --locale en-US --voice en-US-AriaNeural
#   python scripts/generate-voices.py --locale nb-NO --voice nb-NO-PernilleNeural
#   python scripts/generate-voices.py --locale es-ES --voice es-ES-ElviraNeural
#   python scripts/generate-voices.py --locale fr-FR --voice fr-FR-DeniseNeural
#
# The translation dicts below are minimal stubs for v5.13. Filling them out
# is content work — handled per Band as K-12 content lands.

# Norwegian alphabet adds three letters: Æ, Ø, Å. Plus the consonant-phonemes
# differ (e.g. "G" is /ɡ/ which Norwegian renders as "geh", not "guh").
# Stubbed minimal so the script runs; expand when Band B Norsk content arrives.
NORSK = {
    "letters_extra": ["Æ", "Ø", "Å"],
    "sounds": {  # uses Norwegian short-vowel + voiced-consonant cadence
        "A": "ah",  "B": "beh", "C": "seh", "D": "deh", "E": "eh",
        "F": "ef",  "G": "geh", "H": "haw", "I": "ee",  "J": "yeh",
        "K": "kaw", "L": "el",  "M": "em",  "N": "en",  "O": "oh",
        "P": "peh", "Q": "ku",  "R": "ehrr","S": "es",  "T": "teh",
        "U": "oo",  "V": "veh", "W": "double-veh", "X": "eks",
        "Y": "ee",  "Z": "set", "Æ": "eh",  "Ø": "uh",  "Å": "oh",
    },
    "numbers": { "0": "null", "1": "én", "2": "to", "3": "tre", "4": "fire",
                 "5": "fem",  "6": "seks", "7": "sju", "8": "åtte",
                 "9": "ni", "10": "ti" },
}

SPANISH = {
    "sounds": {
        "A": "ah",  "B": "beh", "C": "seh", "D": "deh", "E": "eh",
        "F": "efe", "G": "geh", "H": "ah-cheh", "I": "ee", "J": "ho-tah",
        "K": "kah", "L": "eleh","M": "emeh","N": "eneh","O": "oh",
        "P": "peh", "Q": "kuh", "R": "ereh","S": "eseh","T": "teh",
        "U": "oo",  "V": "uveh","W": "doh-bleh-uveh","X": "ekis",
        "Y": "ee-grieh-gah", "Z": "thethah",
    },
    "numbers": { "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
                 "5": "cinco", "6": "seis", "7": "siete", "8": "ocho",
                 "9": "nueve", "10": "diez" },
}

LOCALE_DEFAULT_VOICE = {
    "en-US": "en-US-AriaNeural",
    "en-GB": "en-GB-SoniaNeural",
    "nb-NO": "nb-NO-PernilleNeural",
    "es-ES": "es-ES-ElviraNeural",
    "es-MX": "es-MX-DaliaNeural",
    "fr-FR": "fr-FR-DeniseNeural",
}


async def main():
    parser = argparse.ArgumentParser(description="Generate a free alphabet/number audio pack via Edge TTS")
    parser.add_argument(
        "--locale", default="en-US",
        choices=list(LOCALE_DEFAULT_VOICE.keys()),
        help="Locale to generate (en-US default; non-default locales output under audio/<locale>/...)"
    )
    parser.add_argument("--voice", default=None,
                        help="Edge TTS voice name; defaults to a good neural voice for the chosen --locale")
    parser.add_argument("--rate", default="-10%", help="Speech rate adjustment (default: -10%% for kid clarity)")
    parser.add_argument("--out", default="audio", help="Output root directory (default: ./audio)")
    parser.add_argument(
        "--only",
        choices=["names", "sounds", "words", "numbers", "concepts", "phrases", "all"],
        default="all",
        help="Which subset to generate"
    )
    parser.add_argument("--skip-existing", action="store_true", help="Skip files that already exist")
    args = parser.parse_args()

    # If --voice wasn't passed, pick the default for the locale
    if not args.voice:
        args.voice = LOCALE_DEFAULT_VOICE[args.locale]

    # Non-default locales output under audio/<locale>/... so the PWA resolver
    # can stack them on top of the en-US base pack.
    if args.locale != "en-US":
        args.out = str(Path(args.out) / args.locale)
        # Swap the SOUNDS / NUMBER_WORDS tables to the locale-specific ones
        global SOUNDS, NUMBER_WORDS, LETTERS
        if args.locale.startswith("nb"):
            SOUNDS = {**SOUNDS, **NORSK["sounds"]}
            NUMBER_WORDS = NORSK["numbers"]
            LETTERS = LETTERS + NORSK["letters_extra"]
        elif args.locale.startswith("es"):
            SOUNDS = {**SOUNDS, **SPANISH["sounds"]}
            NUMBER_WORDS = SPANISH["numbers"]
        # fr-FR: TODO when v6 lands; fall through with English content for now

    root = Path(args.out)
    print(f"Generating audio pack")
    print(f"  Voice : {args.voice}")
    print(f"  Rate  : {args.rate}")
    print(f"  Output: {root.resolve()}")
    print()

    # Build the work list
    work = []
    if args.only in ("names", "all"):
        for L in LETTERS:
            work.append((root / "letters" / "name" / f"{L}.mp3", L))
    if args.only in ("sounds", "all"):
        for L in LETTERS:
            work.append((root / "letters" / "sound" / f"{L}.mp3", SOUNDS[L]))
    if args.only in ("words", "all"):
        for L in LETTERS:
            work.append((root / "letters" / "word" / f"{L}.mp3", WORDS[L]))
    if args.only in ("numbers", "all"):
        for N in NUMBERS:
            work.append((root / "numbers" / f"{N}.mp3", NUMBER_WORDS[N]))
    if args.only in ("concepts", "all"):
        for category, items in [
            ("feelings",   FEELINGS),
            ("body",       BODY),
            ("shapes",     SHAPES_LBL),
            ("colors",     COLORS_LBL),
            ("animals",    ANIMALS),
            ("habitats",   HABITATS),
            ("helpers",    HELPERS),
            ("voc",        VOC),
            ("sight-words", SIGHT),
            ("smabarn",    SMABARN),
            ("voc",        TIME_VOC),  # piggyback on voc/ for time scenarios
        ]:
            for key, text in items.items():
                work.append((root / category / f"{key}.mp3", text))
    if args.only in ("phrases", "all"):
        for key, text in PHRASES.items():
            work.append((root / "phrases" / f"{key}.mp3", text))

    total = len(work)
    done = 0
    skipped = 0
    failed = 0

    # Run with bounded concurrency — friendly to the Edge endpoint
    sem = asyncio.Semaphore(4)

    async def one_unit(out_path: Path, text: str):
        nonlocal done, skipped, failed
        if args.skip_existing and out_path.exists():
            skipped += 1
            print(f"  [skip] {out_path.relative_to(root.parent)} (exists)")
            return
        async with sem:
            try:
                await synth_one(args.voice, text, out_path, rate=args.rate)
                done += 1
                print(f"  [ ok ] {out_path.relative_to(root.parent)}  ←  {text!r}")
            except Exception as e:
                failed += 1
                print(f"  [FAIL] {out_path.relative_to(root.parent)} — {e}", file=sys.stderr)

    await asyncio.gather(*(one_unit(p, t) for p, t in work))

    print()
    print(f"Done. {done} generated, {skipped} skipped, {failed} failed (of {total} total).")
    print()
    print("Next: open the app -> Settings -> 'Custom audio files' -> 'Use if present'")
    print("The PWA will now play these MP3s in place of synthetic TTS.")


if __name__ == "__main__":
    asyncio.run(main())
