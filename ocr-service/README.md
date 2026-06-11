# School Connect OCR Service

Optional local OCR service for scanned handwritten marksheet crops. The Node app still owns marksheet context, roster mapping, template geometry, validation, dry-run, and commit. OCR only suggests marks.

## Provider

Default provider: PaddleOCR.

The service exposes:

- `GET /health`
- `POST /ocr/crops`
- `POST /ocr/image-debug`

`/ocr/crops` accepts cropped mark images from the Node template pipeline and returns:

```json
{
  "provider": "paddleocr",
  "results": [
    {
      "cropId": "S1A-001-split-1",
      "text": "7",
      "confidence": 0.82
    }
  ]
}
```

## Setup

```powershell
cd C:\Users\ssemp\school-connect-reports-lab\ocr-service
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8003
```

Then start the app with PaddleOCR enabled:

```powershell
cd C:\Users\ssemp\school-connect-reports-lab
$env:OCR_PROVIDER="paddleocr"
$env:PADDLE_OCR_URL="http://localhost:8003"
npm run dev
```

## Safety

- Do not send the whole marksheet as source of truth.
- Do not OCR student names or admission numbers as source of truth.
- Do not OCR signatures or remarks in the main import flow.
- OCR suggestions are optional. Operator marks are used for dry-run and commit.
- If this service is unavailable, the Node app falls back to the next provider and finally manual entry.
