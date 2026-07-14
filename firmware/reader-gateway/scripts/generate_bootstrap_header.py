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


project_dir = Path(env["PROJECT_DIR"])
repo_root = project_dir.parent.parent
merged = {}
merged.update(load_dotenv(repo_root / ".env"))
merged.update(os.environ)

api_base_url = (
    merged.get("READER_GATEWAY_API_BASE_URL")
    or merged.get("APP_PUBLIC_URL")
    or merged.get("APP_URL")
    or merged.get("VITE_API_BASE_URL")
    or "https://school-connect.example.com"
)
provisioning_token = merged.get("READER_GATEWAY_PROVISIONING_TOKEN", "")
default_firmware_channel = merged.get("READER_GATEWAY_DEFAULT_FIRMWARE_CHANNEL", "stable")

header = f"""#pragma once
#define SSAMENJ_GATEWAY_DEFAULT_API_BASE_URL "{c_string(api_base_url)}"
#define SSAMENJ_GATEWAY_DEFAULT_PROVISIONING_TOKEN "{c_string(provisioning_token)}"
#define SSAMENJ_GATEWAY_DEFAULT_FIRMWARE_CHANNEL "{c_string(default_firmware_channel)}"
"""

output_path = project_dir / "secrets" / "device_bootstrap.auto.h"
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(header, encoding="utf-8")
