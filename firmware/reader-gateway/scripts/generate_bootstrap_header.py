from pathlib import Path
import os

Import("env")


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        values[key] = value
    return values


def c_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def is_local_url(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized.startswith("http://localhost") or normalized.startswith("http://127.0.0.1")


project_dir = Path(env["PROJECT_DIR"])
repo_root = project_dir.parent.parent
merged = {}
merged.update(load_dotenv(repo_root / ".env"))
merged.update(os.environ)

api_base_url = (
    merged.get("READER_GATEWAY_API_BASE_URL")
    or merged.get("READER_GATEWAY_PRODUCTION_API_BASE_URL")
    or merged.get("APP_PUBLIC_URL")
    or merged.get("PUBLIC_APP_URL")
    or merged.get("APP_URL")
    or merged.get("VITE_API_BASE_URL")
    or "https://ssamenj.online/report-lab"
)
provisioning_token = merged.get("READER_GATEWAY_PROVISIONING_TOKEN", "")
default_firmware_channel = merged.get("READER_GATEWAY_DEFAULT_FIRMWARE_CHANNEL", "stable")
allow_local_bootstrap = merged.get("READER_GATEWAY_ALLOW_LOCAL_API_BOOTSTRAP", "").strip().lower() in {"1", "true", "yes"}

if is_local_url(api_base_url) and not allow_local_bootstrap:
    raise SystemExit(
        "Refusing to embed a localhost reader API URL into firmware. "
        "Set READER_GATEWAY_PRODUCTION_API_BASE_URL to the live HTTPS backend, "
        "or explicitly set READER_GATEWAY_ALLOW_LOCAL_API_BOOTSTRAP=true for local lab testing."
    )

header = f"""#pragma once
#define SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL "{c_string(api_base_url)}"
#define SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN "{c_string(provisioning_token)}"
#define SSAMENJ_GATEWAY_DEFAULT_FIRMWARE_CHANNEL "{c_string(default_firmware_channel)}"
"""

output_path = project_dir / "secrets" / "device_bootstrap.auto.h"
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(header, encoding="utf-8")
