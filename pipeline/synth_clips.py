"""Synthesise the finder's Somali sentences once, as audio clips, with Meta MMS TTS.

    pip install torch transformers scipy        # CPU wheels are enough
    python pipeline/synth_clips.py [--out frontend/public/voice/so] [--dry-run]

Model: facebook/mms-tts-som (VITS, CC BY-NC 4.0: hackathon use only; a deployment
replaces the clips with recordings by a Somali speaker). Output: one WAV per sentence
template key in frontend/src/finder/strings.ts and one per listed facility name, plus
manifest.json mapping key -> path, which the finder plays in order after an answer.

Templates contain placeholders ({place}, {facility}, {km}, {dir}); a clip of a template
is the template read with the placeholders removed, which is why the spoken answer is
shorter than the written one: the written line carries the numbers, the clip carries the
sentence. The clips are only synthesised for Somali lines that a Somali speaker has
cleared: edit APPROVED below after the review, nothing is synthesised for keys not in it.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STRINGS_TS = ROOT / "frontend" / "src" / "finder" / "strings.ts"

# keys whose Somali wording has been checked by a Somali speaker (fill in after the review)
APPROVED: set[str] = {
    # "nearestIs", "walkTime", "walkTimeOnly", "referralIs", "nextIs", "serviceUnknown",
    # "registerDate", "flagged", "noFacility", "notSure", "outOfScope", "didYouMean",
}


def somali_lines() -> dict[str, str]:
    """Pull the Somali column out of strings.ts for the sentence templates (a small regex, no TS parser)."""
    src = STRINGS_TS.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    for m in re.finditer(r"^\s*(\w+): \{ en: '((?:[^'\\]|\\.)*)', so: '((?:[^'\\]|\\.)*)' \}", src, re.M):
        key, so = m.group(1), m.group(3).replace("\\'", "'")
        out[key] = so
    return out


def strip_placeholders(s: str) -> str:
    s = re.sub(r"\{[a-z]+\}", "", s)
    s = s.replace("(draft)", "")
    return re.sub(r"\s+", " ", s).strip(" ,.;:") + "."


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "frontend" / "public" / "voice" / "so"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)

    lines = somali_lines()
    todo = {k: strip_placeholders(v) for k, v in lines.items() if k in APPROVED}
    if not todo:
        sys.exit("APPROVED is empty: have a Somali speaker check the sentences in strings.ts, add their keys to APPROVED, then run again.")
    print(f"{len(todo)} approved sentence templates:")
    for k, v in todo.items():
        print(f"  {k:16s} {v}")
    if args.dry_run:
        return

    import numpy as np
    import torch
    from scipy.io import wavfile
    from transformers import AutoTokenizer, VitsModel

    tok = AutoTokenizer.from_pretrained("facebook/mms-tts-som")
    model = VitsModel.from_pretrained("facebook/mms-tts-som")
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"lang": "so", "model": "facebook/mms-tts-som (CC BY-NC 4.0), synthesised at build time", "clips": {}}
    for key, text in todo.items():
        with torch.no_grad():
            wav = model(**tok(text, return_tensors="pt")).waveform[0].numpy()
        path = out / f"{key}.wav"
        wavfile.write(path, model.config.sampling_rate, (np.clip(wav, -1, 1) * 32767).astype(np.int16))
        manifest["clips"][key] = f"/voice/so/{path.name}"
        print(f"  wrote {path.name} ({len(wav)/model.config.sampling_rate:.1f} s)")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"manifest: {out / 'manifest.json'}")


if __name__ == "__main__":
    main()
