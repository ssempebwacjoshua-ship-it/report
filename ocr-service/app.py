from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from PIL import Image, ImageEnhance, ImageOps

PROVIDER = os.getenv("OCR_SERVICE_PROVIDER", "paddleocr")
OCR_DEBUG = os.getenv("OCR_DEBUG", "0") not in ("0", "false", "False", "")
DEBUG_DIR = Path(os.getenv("OCR_DEBUG_DIR", "tmp/ocr-debug/latest"))

app = FastAPI(title="School Connect OCR Service")
_paddle_ocr: Any | None = None
_text_rec: Any | None = None
_text_rec_failed = False


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


def get_text_recognizer() -> Any:
    """Lazy-initialise a recognition-only model (no text detection stage).

    Mark crops are single-line digit snippets. The full det+rec pipeline
    frequently fails on them: detection finds no text box in a small crop
    and the whole result comes back empty ("No text detected").
    Recognition-only feeds the crop straight to the recogniser, which is
    far more reliable for this shape of input. English models also cannot
    emit CJK characters (e.g. a struck-through 7 misread as 子).
    """
    global _text_rec, _text_rec_failed
    if _text_rec is not None or _text_rec_failed:
        return _text_rec

    try:
        from paddleocr import TextRecognition
    except Exception:
        _text_rec_failed = True
        return None

    for model_name in ("en_PP-OCRv5_mobile_rec", "en_PP-OCRv4_mobile_rec", None):
        try:
            _text_rec = TextRecognition(model_name=model_name) if model_name else TextRecognition()
            return _text_rec
        except Exception:
            _text_rec = None
            continue

    _text_rec_failed = True
    return None


def run_text_recognition(path: Path) -> tuple[str, float, Any]:
    """Run recognition-only OCR on a single-line crop. Returns ("", 0.0, err) on failure."""
    rec = get_text_recognizer()
    if rec is None:
        return "", 0.0, {"error": "TextRecognition unavailable"}

    try:
        results = list(rec.predict(str(path)))
    except Exception as exc:
        return "", 0.0, {"error": str(exc)}

    best_text, best_score = "", 0.0
    debug: list[dict[str, Any]] = []
    for item in results:
        text, score = "", 0.0
        for accessor in (
            lambda i: (i["rec_text"], i["rec_score"]),
            lambda i: (i["res"]["rec_text"], i["res"]["rec_score"]),
            lambda i: (i.get("rec_text"), i.get("rec_score")),
        ):
            try:
                text, score = accessor(item)
                if isinstance(text, str):
                    break
            except Exception:
                continue
        if isinstance(text, str) and text.strip():
            score = float(score or 0)
            debug.append({"rec_text": text, "rec_score": round(score, 4)})
            if score > best_score:
                best_text, best_score = text, score

    return best_text, best_score, debug


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
    if isinstance(result, dict):
        try:
            json.dumps(result)
            return result
        except TypeError:
            return {str(k): result_to_debug_dict(v) for k, v in result.items()}
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


DARK_THRESHOLD = 128  # grayscale value below which a pixel counts as ink


def _erase_border_lines(arr: np.ndarray) -> np.ndarray:
    """Erase cell-border line artifacts near the crop edges.

    Mark crops are cut from a printed table, so a horizontal rule often
    survives along the top/bottom edge and vertical rules along the sides.
    A stray bar through a handwritten 7 is exactly how PaddleOCR ends up
    reading 子. Border rules span (almost) the full width/height of the
    crop while digit strokes never do, so rows/columns near the edges
    that are mostly dark are safe to blank out.
    """
    h, w = arr.shape
    dark = arr < DARK_THRESHOLD

    row_margin = max(2, int(h * 0.20))
    col_margin = max(2, int(w * 0.10))

    row_frac = dark.mean(axis=1)
    for i in range(h):
        if (i < row_margin or i >= h - row_margin) and row_frac[i] > 0.45:
            arr[i, :] = 255

    col_frac = dark.mean(axis=0)
    for j in range(w):
        if (j < col_margin or j >= w - col_margin) and col_frac[j] > 0.45:
            arr[:, j] = 255

    return arr


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    """Prepare a mark crop for PaddleOCR digit recognition.

    Steps:
    1. Grayscale + contrast normalisation.
    2. Erase table border lines that survived cropping (top bars → 子 misreads).
    3. Crop tightly to the ink bounding box — crops are mostly blank white
       space, which makes the detection stage miss the small digit region.
    4. Scale to a consistent height and pad with white so strokes don't
       touch the edges.
    """
    img = img.convert("L")
    img = ImageOps.autocontrast(img, cutoff=1)

    arr = np.asarray(img, dtype=np.uint8).copy()
    arr = _erase_border_lines(arr)

    # Tight crop to the ink bounding box
    dark_rows = np.where((arr < DARK_THRESHOLD).any(axis=1))[0]
    dark_cols = np.where((arr < DARK_THRESHOLD).any(axis=0))[0]
    if len(dark_rows) == 0 or len(dark_cols) == 0:
        # Blank cell — return a small white image so OCR cleanly finds nothing
        return Image.new("L", (64, 48), 255)

    top, bottom = int(dark_rows[0]), int(dark_rows[-1])
    left, right = int(dark_cols[0]), int(dark_cols[-1])

    # Ignore specks (dust/JPEG noise) — require a minimally sized ink region
    if (bottom - top) < 5 or (right - left) < 3:
        return Image.new("L", (64, 48), 255)

    # Line-shaped ink (very wide, very short) is a residual table rule that
    # slipped past edge erasure — not handwriting. Treat the cell as blank.
    if (right - left + 1) > 5 * (bottom - top + 1):
        return Image.new("L", (64, 48), 255)

    margin = max(3, int((bottom - top) * 0.08))
    top = max(0, top - margin)
    bottom = min(arr.shape[0] - 1, bottom + margin)
    left = max(0, left - margin)
    right = min(arr.shape[1] - 1, right + margin)

    img = Image.fromarray(arr[top : bottom + 1, left : right + 1])

    # Normalise to a height the recogniser likes, preserving aspect ratio
    target_h = 80
    if img.height != target_h:
        scale = target_h / img.height
        img = img.resize((max(8, int(img.width * scale)), target_h), Image.LANCZOS)

    img = ImageEnhance.Contrast(img).enhance(1.6)

    # Pad so strokes don't touch image edges
    pad = 16
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


_MARK_LIKE = re.compile(r"[0-9]|^\s*(AB|A8|EX)\s*$", re.IGNORECASE)


def _is_mark_like(text: str) -> bool:
    """True when OCR text plausibly represents a mark (digits, AB, EX)."""
    return bool(text and _MARK_LIKE.search(text.strip()))


def run_full_pipeline(path: Path) -> tuple[str, float, Any]:
    """Run the full det+rec PaddleOCR pipeline (v2 ocr() or v3 predict())."""
    ocr = get_paddle_ocr()
    if ocr is None:
        return "", 0.0, {"error": "PaddleOCR failed to initialise"}

    raw_result: Any = []
    try:
        if hasattr(ocr, "predict"):
            raw_result = list(ocr.predict(str(path)))
        elif hasattr(ocr, "ocr"):
            raw_result = ocr.ocr(str(path))
    except Exception as exc:
        return "", 0.0, {"error": str(exc)}

    text, confidence = best_text_from_result(raw_result)
    return text, confidence, raw_result


def run_paddle(path: Path) -> tuple[str, float, Any]:
    """OCR a mark crop and return (text, confidence, raw_debug).

    Strategy: recognition-only first (reliable on single-line digit crops,
    cannot emit CJK), full det+rec pipeline as fallback. The candidate
    that actually looks like a mark wins; confidence breaks ties.
    """
    rec_text, rec_conf, rec_raw = run_text_recognition(path)

    # Confident, mark-like recognition-only result — done.
    if _is_mark_like(rec_text) and rec_conf >= 0.80:
        return rec_text, rec_conf, {"source": "rec_only", "rec_only": rec_raw}

    full_text, full_conf, full_raw = run_full_pipeline(path)

    debug = {
        "rec_only": rec_raw,
        "pipeline": result_to_debug_dict(full_raw),
    }

    candidates = [
        (rec_text, rec_conf, "rec_only"),
        (full_text, full_conf, "pipeline"),
    ]
    mark_like = [c for c in candidates if _is_mark_like(c[0])]
    pool = mark_like if mark_like else [c for c in candidates if c[0].strip()]
    if not pool:
        return "", 0.0, debug

    text, confidence, source = max(pool, key=lambda c: c[1])
    debug["source"] = source
    return text, confidence, debug


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
