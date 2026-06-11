"""Digit smoke test: generate synthetic images and verify PaddleOCR can read them.

If PaddleOCR cannot read clean generated digit images, the provider setup is broken.
If it can read generated digits but not scan crops, the crop geometry or preprocessing is wrong.

Usage:
    python test_digits.py              # uses http://127.0.0.1:8003
    python test_digits.py --url http://localhost:8003
"""
from __future__ import annotations

import argparse
import io
import sys
import textwrap

import requests
from PIL import Image, ImageDraw, ImageFont

DIGITS = ["7", "6", "8", "2", "9", "4", "1", "0", "AB", "EX"]
DEFAULT_URL = "http://127.0.0.1:8003"


def make_digit_image(text: str, size: tuple[int, int] = (80, 40)) -> bytes:
    """Render text onto a white image and return PNG bytes."""
    img = Image.new("L", size, color=255)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except (IOError, OSError):
        try:
            font = ImageFont.truetype("DejaVuSans.ttf", 24)
        except (IOError, OSError):
            font = ImageFont.load_default()

    # Centre the text
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size[0] - tw) // 2
    y = (size[1] - th) // 2
    draw.text((x, y), text, fill=0, font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def run_tests(base_url: str) -> int:
    """Run OCR tests. Returns number of failures."""
    # Health check first
    try:
        health = requests.get(f"{base_url}/health", timeout=5)
        health.raise_for_status()
        print(f"OCR service: {health.json()}\n")
    except Exception as exc:
        print(f"ERROR: Cannot reach OCR service at {base_url}: {exc}", file=sys.stderr)
        return len(DIGITS)

    failures = 0
    for digit in DIGITS:
        data = make_digit_image(digit)
        files = {"file": (f"digit-{digit}.png", data, "image/png")}
        try:
            resp = requests.post(f"{base_url}/ocr/debug-image", files=files, timeout=15)
            resp.raise_for_status()
            body = resp.json()
            got = (body.get("text") or "").strip()
            conf = body.get("confidence", 0.0)

            # Accept close matches (OCR may return lowercase or with spaces)
            normalised = got.upper().replace(" ", "")
            expected_norm = digit.upper().replace(" ", "")
            passed = normalised == expected_norm

            status = "PASS" if passed else "FAIL"
            if not passed:
                failures += 1
            print(f"{status}  expected={digit!r:4s}  got={got!r:6s}  conf={conf:.0%}")
        except Exception as exc:
            failures += 1
            print(f"FAIL  expected={digit!r:4s}  ERROR: {exc}")

    print(f"\n{'=' * 40}")
    passed_count = len(DIGITS) - failures
    print(f"Passed: {passed_count} / {len(DIGITS)}")
    if failures:
        print(
            textwrap.dedent("""
            Interpretation:
            - Failures on generated digits → PaddleOCR model or setup is broken.
            - Pass on generated digits but fails on scan crops → crop geometry or preprocessing is wrong.
            """).strip()
        )
    return failures


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PaddleOCR digit smoke test")
    parser.add_argument("--url", default=DEFAULT_URL, help="OCR service base URL")
    args = parser.parse_args()
    sys.exit(run_tests(args.url))
