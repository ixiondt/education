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
}


async def synth_one(voice: str, text: str, out_path: Path, rate: str = "-10%", volume: str = "+0%"):
    """Generate one MP3 and write to disk."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicator = edge_tts.Communicate(text=text, voice=voice, rate=rate, volume=volume)
    await communicator.save(str(out_path))


async def main():
    parser = argparse.ArgumentParser(description="Generate a free alphabet/number audio pack via Edge TTS")
    parser.add_argument("--voice", default="en-US-AriaNeural", help="Edge TTS voice name (default: en-US-AriaNeural)")
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
            ("feelings", FEELINGS),
            ("body",     BODY),
            ("shapes",   SHAPES_LBL),
            ("colors",   COLORS_LBL),
            ("animals",  ANIMALS),
            ("habitats", HABITATS),
            ("helpers",  HELPERS),
            ("voc",      VOC),
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
