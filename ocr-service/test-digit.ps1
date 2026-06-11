# test-digit.ps1 — PaddleOCR digit smoke test
# Usage:  .\test-digit.ps1 [-Url http://127.0.0.1:8003]
#
# Generates clean synthetic digit images (7, 6, 8, 2, 9, 4, 1, 0, AB, EX) and
# sends them to the OCR service.  Helps distinguish two failure modes:
#
#   FAIL on generated digits  → PaddleOCR model or setup is broken.
#   PASS on generated digits, FAIL on scan crops → crop geometry / preprocessing is wrong.

param(
    [string]$Url = "http://127.0.0.1:8003"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Prefer the venv python if present
$venvPy = Join-Path $scriptDir ".venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    $python = $venvPy
} else {
    $python = "python"
}

$testScript = Join-Path $scriptDir "test_digits.py"
if (-not (Test-Path $testScript)) {
    Write-Error "test_digits.py not found at $testScript"
    exit 1
}

& $python $testScript --url $Url
exit $LASTEXITCODE
