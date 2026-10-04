"""Download the speech model the finder side-loads, into frontend/public/models/whisper-tiny/.

    python pipeline/fetch_models.py

Model: OpenAI Whisper tiny (MIT), ONNX export by onnx-community
(https://huggingface.co/onnx-community/whisper-tiny), quantized files only:
encoder_model_quantized.onnx (10,124,990 bytes) and decoder_model_merged_quantized.onnx
(30,719,241 bytes), plus the small config and tokenizer files. About 44 MB in all;
transformers.js loads them from /models/whisper-tiny/ with dtype q8. Somali is one of
Whisper's 99 languages; recognition quality for Somali is weak, which the finder
handles by confirming every heard place name.

Run from a normal internet connection. Files already present are kept.
"""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "frontend" / "public" / "models" / "whisper-tiny"
REPO = "https://huggingface.co/onnx-community/whisper-tiny/resolve/main/"
FILES = [
    "config.json",
    "generation_config.json",
    "preprocessor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "added_tokens.json",
    "normalizer.json",
    "onnx/encoder_model_quantized.onnx",
    "onnx/decoder_model_merged_quantized.onnx",
]


def main() -> None:
    total = 0
    for rel in FILES:
        dest = DEST / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and dest.stat().st_size > 0:
            print(f"  present {rel} ({dest.stat().st_size:,} bytes)")
            total += dest.stat().st_size
            continue
        req = Request(REPO + rel, headers={"User-Agent": "geo-health-somalia/0.1"})
        try:
            with urlopen(req, timeout=300) as r, open(dest, "wb") as f:
                n = 0
                while True:
                    chunk = r.read(1 << 20)
                    if not chunk:
                        break
                    f.write(chunk)
                    n += len(chunk)
            total += n
            print(f"  ok  {rel} ({n:,} bytes)")
        except Exception as exc:  # noqa: BLE001
            if dest.exists():
                dest.unlink()
            sys.exit(f"download failed for {rel}: {exc}")
    print(f"\n{len(FILES)} files, {total/1e6:.1f} MB in {DEST}")
    print("Next: cd frontend && npm run prepare-offline   (copies the ONNX runtime into public/ort/)")


if __name__ == "__main__":
    main()
