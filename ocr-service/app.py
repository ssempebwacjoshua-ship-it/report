from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from PIL import Image, ImageEnhance, ImageOps

PROVIDER = os.getenv("OCR_SERVICE_PROVIDER", "paddleocr")
OCR_DEBUG = os.getenv("OCR_DEBUG", "0") not in ("0", "false", "False", "")
DEBUG_DIR = Path(os.getenv("OCR_DEBUG_DIR", "tmp/ocr-debug/latest"))

app = FastAPI(title="School Connect OCR Service")
_paddle_ocr: Any | None = None


def get_paddle_ocr() -> Any:
    """Lazy-initialise PaddleOCR once per process.

    PaddleOCR 3.x (paddleocr>=3.0, paddlepaddle==3.2.2) uses the PaddleX pipeline.
    - show_log was removed in 3.x — passing it raises ValueError.
    - use_angle_cls is deprecated; use_textline_orientation is its successor.
    - Orientation classifiers and doc-unwarping are disabled to avoid loading
      extra models that are not needed for small digit crops.
    """
    global _paddle_ocr
    if _paddle_ocr is not None:
        return _paddle_ocr

    from paddleocr import PaddleOCR

    strategies: list[dict[str, Any]] = [
        # Preferred: minimal pipeline for digit crops (no orientation, no unwarping)
        {
            "lang": "en",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
        },
        # Fallback: only disable unwarping
        {"lang": "en", "use_doc_orientation_classify": False, "use_doc_unwarping": False},
        # Final fallback: plain English OCR
        {"lang": "en"},
        # Last resort: no arguments
        {},
    ]

    for kwargs in strategies:
        try:
            _paddle_ocr = PaddleOCR(**kwargs)
            return _paddle_ocr
        except Exception:
            _paddle_ocr = None
            continue

    return None  # All strategies failed — caller must handle None


def best_text_from_result(result: Any) -> tuple[str, float]:
    """Extract the highest-confidence text from PaddleOCR output.

    Handles both PaddleOCR v3 (OCRResult objects with rec_texts/rec_scores)
    and v2 (nested list/tuple arrays).
    """
    candidates: list[tuple[str, float]] = []

    # ── PaddleOCR v3 format ────────────────────────────────────────────────────
    # predict() returns a list of OCRResult objects. Each result exposes
    # rec_texts (list[str]) and rec_scores (list[float]).
    if isinstance(result, (list, tuple)):
        for item in result:
            try:
                texts = item["rec_texts"]
                scores = item["rec_scores"]
                if texts and scores:
                    for text, score in zip(texts, scores):
                        if isinstance(text, str) and text.strip():
                            candidates.append((text, float(score or 0)))
            except (TypeError, KeyError, IndexError):
                pass  # Not v3 format; fall through to v2 parser

    if candidates:
        return max(candidates, key=lambda c: c[1])

    # ── PaddleOCR v2 fallback (nested arrays) ─────────────────────────────────
    def visit(node: Any) -> None:
        if node is None:
            return
        if isinstance(node, dict):
            text = node.get("text") or node.get("rec_text") or node.get("label")
            confidence = node.get("confidence") or node.get("score") or node.get("rec_score")
            if isinstance(text, str):
                candidates.append((text, float(confidence or 0)))
            for value in node.values():
                visit(value)
            return
        if isinstance(node, (list, tuple)):
            if (
                len(node) >= 2
                and isinstance(node[1], (list, tuple))
                and len(node[1]) >= 2
                and isinstance(node[1][0], str)
            ):
                candidates.append((node[1][0], float(node[1][1] or 0)))
            for value in node:
                visit(value)

    visit(result)
    if not candidates:
        return "", 0.0
    return max(candidates, key=lambda c: c[1])


def result_to_debug_dict(result: Any) -> Any:
    """Convert OCRResult/numpy arrays to a JSON-safe representation for debug output."""
    if result is None:
        return None
    if isinstance(result, (list, tuple)):
        items = []
        for item in result:
            try:
                # v3 OCRResult: extract only the text fields
                entry: dict[str, Any] = {}
                try:
                    entry["rec_texts"] = list(item["rec_texts"] or [])
                except (TypeError, KeyError):
                    pass
                try:
                    entry["rec_scores"] = [round(float(s), 4) for s in (item["rec_scores"] or [])]
                except (TypeError, KeyError):
                    pass
                if entry:
                    items.append(entry)
                    continue
            except Exception:
                pass
            items.append(str(item)[:200])
        return items
    return str(result)[:500]


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    """Enhance a crop image for better PaddleOCR digit recognition.

    Converts to grayscale, upscales small crops, boosts contrast,
    and adds white padding so digit strokes don't touch the edge.
    """
    img = img.convert("L")
    w, h = img.size

    # Upscale small crops — PaddleOCR needs meaningful pixel density
    min_w, min_h = 120, 48
    if w < min_w or h < min_h:
        scale = max(3, -(-min_w // max(1, w)), -(-min_h // max(1, h)))
        img = img.resize((w * scale, h * scale), Image.LANCZOS)

    # Normalise brightness range, then boost contrast
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Contrast(img).enhance(1.8)

    # Pad so strokes don't touch image edges
    pad = 10
    padded = Image.new("L", (img.width + pad * 2, img.height + pad * 2), 255)
    padded.paste(img, (pad, pad))
    return padded


def save_debug_file(name: str, data: bytes) -> None:
    """Write data to the debug directory (best-effort, never raises)."""
    if not OCR_DEBUG:
        return
    try:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        safe = name.replace("/", "-").replace("\\", "-")
        (DEBUG_DIR / safe).write_bytes(data)
    except Exception:
        pass


async def read_upload_bytes(upload: UploadFile) -> bytes:
    return await upload.read()


def bytes_to_rgb_image_file(data: bytes, suffix: str = ".jpg") -> Path:
    """Save raw bytes as a temporary RGB image file and return its path."""
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        handle.write(data)
        handle.close()
        img = Image.open(handle.name)
        img.convert("RGB").save(handle.name)
        return Path(handle.name)
    except Exception:
        Path(handle.name).unlink(missing_ok=True)
        raise


def run_paddle(path: Path) -> tuple[str, float, Any]:
    """Run PaddleOCR on a single image and return (text, confidence, raw_result).

    Works with both v2 (ocr()) and v3 (predict()) APIs.
    Returns ("", 0.0, error_dict) on failure so callers always get a valid tuple.
    """
    ocr = get_paddle_ocr()
    if ocr is None:
        return "", 0.0, {"error": "PaddleOCR failed to initialise"}

    raw_result: Any = []
    try:
        # PaddleOCR v3 uses predict()
        if hasattr(ocr, "predict"):
            raw_result = list(ocr.predict(str(path)))
        elif hasattr(ocr, "ocr"):
            raw_result = ocr.ocr(str(path))
        else:
            raw_result = []
    except Exception as exc:
        return "", 0.0, {"error": str(exc)}

    text, confidence = best_text_from_result(raw_result)
    return text, confidence, raw_result


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": PROVIDER}


@app.post("/ocr/crops")
async def ocr_crops(
    crop_ids: str = Form("[]"),
    files: list[UploadFile] = File(...),
) -> dict[str, Any]:
    try:
        ids = json.loads(crop_ids)
    except json.JSONDecodeError:
        ids = []
    if not isinstance(ids, list):
        ids = []

    results: list[dict[str, Any]] = []
    for index, upload in enumerate(files):
        crop_id = str(ids[index]) if index < len(ids) else f"crop-{index + 1}"
        suffix = Path(upload.filename or "crop.jpg").suffix or ".jpg"

        try:
            raw_bytes = await read_upload_bytes(upload)
        except Exception as exc:
            results.append({"cropId": crop_id, "text": "", "confidence": 0.0, "error": str(exc)})
            continue

        save_debug_file(f"{crop_id}-raw.png", raw_bytes)

        orig_path: Path | None = None
        proc_path: Path | None = None
        try:
            orig_path = bytes_to_rgb_image_file(raw_bytes, suffix)

            img = Image.open(orig_path)
            processed_img = preprocess_for_ocr(img)

            if OCR_DEBUG:
                import io as _io
                buf = _io.BytesIO()
                processed_img.save(buf, format="PNG")
                save_debug_file(f"{crop_id}-processed.png", buf.getvalue())

            proc_handle = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            processed_img.save(proc_handle.name, format="PNG")
            proc_handle.close()
            proc_path = Path(proc_handle.name)

            text, confidence, raw_result = run_paddle(proc_path)

            entry: dict[str, Any] = {"cropId": crop_id, "text": text, "confidence": confidence}
            if OCR_DEBUG:
                entry["raw"] = result_to_debug_dict(raw_result)

            results.append(entry)
        except Exception as exc:
            results.append({"cropId": crop_id, "text": "", "confidence": 0.0, "error": str(exc)})
        finally:
            if orig_path:
                orig_path.unlink(missing_ok=True)
            if proc_path:
                proc_path.unlink(missing_ok=True)

    return {"provider": PROVIDER, "results": results}


@app.post("/ocr/image-debug")
@app.post("/ocr/debug-image")
async def ocr_debug_image(file: UploadFile = File(...)) -> dict[str, Any]:
    """Accept one image crop and return provider, raw PaddleOCR output, text, and confidence.

    Always returns 200 — errors are surfaced in the response body.
    Useful for the digit smoke test and manual crop inspection.
    """
    suffix = Path(file.filename or "crop.jpg").suffix or ".jpg"

    try:
        raw_bytes = await read_upload_bytes(file)
    except Exception as exc:
        return {"provider": PROVIDER, "text": "", "confidence": 0.0, "error": str(exc)}

    orig_path: Path | None = None
    proc_path: Path | None = None
    try:
        orig_path = bytes_to_rgb_image_file(raw_bytes, suffix)
        img = Image.open(orig_path)
        processed_img = preprocess_for_ocr(img)

        proc_handle = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        processed_img.save(proc_handle.name, format="PNG")
        proc_handle.close()
        proc_path = Path(proc_handle.name)

        text, confidence, raw_result = run_paddle(proc_path)

        return {
            "provider": PROVIDER,
            "text": text,
            "confidence": confidence,
            "raw": result_to_debug_dict(raw_result),
        }
    except Exception as exc:
        return {"provider": PROVIDER, "text": "", "confidence": 0.0, "error": str(exc)}
    finally:
        if orig_path:
            orig_path.unlink(missing_ok=True)
        if proc_path:
            proc_path.unlink(missing_ok=True)
