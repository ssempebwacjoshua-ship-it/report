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


def c_int(value: str, default: int) -> int:
    normalized = value.strip()
    if not normalized:
        return default
    return int(normalized, 10)


def c_bool(value: str, default: bool) -> int:
    normalized = value.strip().lower()
    if not normalized:
        return 1 if default else 0
    return 1 if normalized in {"1", "true", "yes", "on"} else 0


def is_local_url(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized.startswith("http://localhost") or normalized.startswith("http://127.0.0.1")


project_dir = Path(env["PROJECT_DIR"])
repo_root = project_dir.parent.parent
merged = {}
merged.update(load_dotenv(repo_root / ".env"))
merged.update(os.environ)

api_base_url = (
    merged.get("READER_GATEWAY_PRODUCTION_API_BASE_URL")
    or merged.get("READER_GATEWAY_API_BASE_URL")
    or merged.get("APP_PUBLIC_URL")
    or merged.get("PUBLIC_APP_URL")
    or merged.get("APP_URL")
    or merged.get("VITE_API_BASE_URL")
    or "https://report-production-b00d.up.railway.app"
)
provisioning_token = merged.get("READER_GATEWAY_PROVISIONING_TOKEN", "")
default_firmware_channel = merged.get("READER_GATEWAY_DEFAULT_FIRMWARE_CHANNEL", "stable")
bootstrap_keys = {
    "device_id": "READER_GATEWAY_DEFAULT_DEVICE_ID",
    "reader_id": "READER_GATEWAY_DEFAULT_READER_ID",
    "school_id": "READER_GATEWAY_DEFAULT_SCHOOL_ID",
    "device_name": "READER_GATEWAY_DEFAULT_DEVICE_NAME",
    "reader_location": "READER_GATEWAY_DEFAULT_READER_LOCATION",
    "reader_type": "READER_GATEWAY_DEFAULT_READER_TYPE",
    "device_token": "READER_GATEWAY_DEFAULT_DEVICE_TOKEN",
}
bootstrap_values = {name: merged.get(key, "") for name, key in bootstrap_keys.items()}
feedback_buzzer_pin = c_int(merged.get("READER_GATEWAY_DEFAULT_BUZZER_PIN", ""), -1)
feedback_led_pin = c_int(merged.get("READER_GATEWAY_DEFAULT_LED_PIN", ""), -1)
feedback_outputs_enabled = c_bool(merged.get("READER_GATEWAY_DEFAULT_FEEDBACK_OUTPUTS_ENABLED", ""), False)
feedback_driver_active_high = c_bool(merged.get("READER_GATEWAY_DEFAULT_FEEDBACK_DRIVER_ACTIVE_HIGH", ""), False)
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
#define SSAMENJ_GATEWAY_DEFAULT_DEVICE_ID "{c_string(bootstrap_values['device_id'])}"
#define SSAMENJ_GATEWAY_DEFAULT_READER_ID "{c_string(bootstrap_values['reader_id'])}"
#define SSAMENJ_GATEWAY_DEFAULT_SCHOOL_ID "{c_string(bootstrap_values['school_id'])}"
#define SSAMENJ_GATEWAY_DEFAULT_DEVICE_NAME "{c_string(bootstrap_values['device_name'])}"
#define SSAMENJ_GATEWAY_DEFAULT_READER_LOCATION "{c_string(bootstrap_values['reader_location'])}"
#define SSAMENJ_GATEWAY_DEFAULT_READER_TYPE "{c_string(bootstrap_values['reader_type'])}"
#define SSAMENJ_GATEWAY_DEFAULT_DEVICE_TOKEN "{c_string(bootstrap_values['device_token'])}"
#define SSAMENJ_GATEWAY_DEFAULT_BUZZER_PIN ({feedback_buzzer_pin})
#define SSAMENJ_GATEWAY_DEFAULT_LED_PIN ({feedback_led_pin})
#define SSAMENJ_GATEWAY_DEFAULT_FEEDBACK_OUTPUTS_ENABLED {feedback_outputs_enabled}
#define SSAMENJ_GATEWAY_DEFAULT_FEEDBACK_DRIVER_ACTIVE_HIGH {feedback_driver_active_high}
"""

output_path = project_dir / "secrets" / "device_bootstrap.auto.h"
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(header, encoding="utf-8")
