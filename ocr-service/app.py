from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from PIL import Image

PROVIDER = os.getenv("OCR_SERVICE_PROVIDER", "paddleocr")

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


async def save_upload_as_image(upload: UploadFile) -> Path:
    suffix = Path(upload.filename or "crop.jpg").suffix or ".jpg"
    data = await upload.read()
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        handle.write(data)
        handle.close()
        image = Image.open(handle.name)
        image.convert("RGB").save(handle.name)
        return Path(handle.name)
    except Exception:
        Path(handle.name).unlink(missing_ok=True)
        raise


def run_paddle(path: Path) -> tuple[str, float]:
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
    return best_text_from_result(result)


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
        path = await save_upload_as_image(upload)
        try:
            text, confidence = run_paddle(path)
            results.append({"cropId": crop_id, "text": text, "confidence": confidence})
        except Exception as exc:
            results.append({"cropId": crop_id, "text": "", "confidence": 0.0, "error": str(exc)})
        finally:
            path.unlink(missing_ok=True)

    return {"provider": PROVIDER, "results": results}


@app.post("/ocr/image-debug")
async def ocr_image_debug(file: UploadFile = File(...)) -> dict[str, Any]:
    path = await save_upload_as_image(file)
    try:
        text, confidence = run_paddle(path)
        return {"provider": PROVIDER, "text": text, "confidence": confidence}
    finally:
        path.unlink(missing_ok=True)
