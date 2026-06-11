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
    global _paddle_ocr
    if _paddle_ocr is None:
        from paddleocr import PaddleOCR

        try:
            _paddle_ocr = PaddleOCR(use_angle_cls=False, lang="en", show_log=False)
        except TypeError:
            _paddle_ocr = PaddleOCR(lang="en")
    return _paddle_ocr


def best_text_from_result(result: Any) -> tuple[str, float]:
    candidates: list[tuple[str, float]] = []

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
            if len(node) >= 2 and isinstance(node[1], (list, tuple)) and len(node[1]) >= 2:
                text = node[1][0]
                confidence = node[1][1]
                if isinstance(text, str):
                    candidates.append((text, float(confidence or 0)))
            for value in node:
                visit(value)

    visit(result)
    if not candidates:
        return "", 0.0
    return max(candidates, key=lambda item: item[1])


def preprocess_for_ocr(img: Image.Image) -> Image.Image:
    """Enhance an image for better PaddleOCR digit recognition.

    Converts to grayscale, upscales small crops, boosts contrast, adds
    white padding so digit strokes don't touch the image edge.
    """
    # Grayscale first — PaddleOCR handles L images fine
    img = img.convert("L")
    w, h = img.size

    # Upscale tiny crops: digits need room to be recognised
    min_w, min_h = 120, 48
    if w < min_w or h < min_h:
        scale = max(3, -(-min_w // max(1, w)), -(-min_h // max(1, h)))  # ceiling div
        img = img.resize((w * scale, h * scale), Image.LANCZOS)

    # Auto-contrast normalises the brightness range
    img = ImageOps.autocontrast(img, cutoff=1)
    # Contrast boost makes pen strokes pop against the background
    img = ImageEnhance.Contrast(img).enhance(1.8)

    # Pad so digit strokes don't touch the edges (helps PaddleOCR bounding-box detection)
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
    data = await upload.read()
    return data


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
    """Run PaddleOCR and return (normalized_text, confidence, raw_result)."""
    ocr = get_paddle_ocr()
    if hasattr(ocr, "ocr"):
        try:
            result = ocr.ocr(str(path), cls=False)
        except TypeError:
            result = ocr.ocr(str(path))
    elif hasattr(ocr, "predict"):
        result = ocr.predict(str(path))
    else:
        result = []
    text, confidence = best_text_from_result(result)
    return text, confidence, result


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

        # Save raw crop for debug inspection
        save_debug_file(f"{crop_id}-raw.png", raw_bytes)

        orig_path: Path | None = None
        proc_path: Path | None = None
        try:
            orig_path = bytes_to_rgb_image_file(raw_bytes, suffix)

            # Preprocess: grayscale, upscale, contrast boost, padding
            img = Image.open(orig_path)
            processed_img = preprocess_for_ocr(img)

            # Save processed crop for debug inspection
            if OCR_DEBUG:
                import io as _io
                buf = _io.BytesIO()
                processed_img.save(buf, format="PNG")
                save_debug_file(f"{crop_id}-processed.png", buf.getvalue())

            # Write processed image to a temp file for PaddleOCR
            proc_handle = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            processed_img.save(proc_handle.name, format="PNG")
            proc_handle.close()
            proc_path = Path(proc_handle.name)

            text, confidence, raw_result = run_paddle(proc_path)

            entry: dict[str, Any] = {
                "cropId": crop_id,
                "text": text,
                "confidence": confidence,
            }
            if OCR_DEBUG:
                entry["raw"] = str(raw_result)

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

    Useful for manual debugging and the digit smoke test.
    """
    suffix = Path(file.filename or "crop.jpg").suffix or ".jpg"
    raw_bytes = await read_upload_bytes(file)

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
            "raw": raw_result,
        }
    finally:
        if orig_path:
            orig_path.unlink(missing_ok=True)
        if proc_path:
            proc_path.unlink(missing_ok=True)
