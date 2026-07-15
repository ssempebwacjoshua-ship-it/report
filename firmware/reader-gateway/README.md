# SSAMENJ Reader Gateway

First production firmware for the SSAMENJ Reader Gateway on ESP32 + Wiegand.

This gateway is a transport layer only:

- Reads Wiegand 26, 34, and 37 credentials
- Sends scan events to School Connect over Wi-Fi
- Stores offline events in LittleFS
- Replays queued events oldest-first when connectivity returns
- Supports authenticated HTTPS pull OTA with SHA-256 and signature verification

It does not control doors, locks, relays, or fingerprint readers.

## Architecture

```text
Student Wristband
        ↓
Felix F-P001M
        ↓
Wiegand 26/34/37
        ↓
ESP32
        ↓
Wi-Fi
        ↓
School Connect API
```

## Wiegand wiring

Use the reader datasheet as the final authority. Typical wiring:

| Reader | ESP32 |
| --- | --- |
| D0 | GPIO 18 |
| D1 | GPIO 19 |
| GND | GND |
| VCC | 5V or reader-rated supply |

Important:

- Keep reader ground and ESP32 ground common.
- Power the Felix F-P001M according to its own voltage requirements.
- Use a level-safe wiring approach if your reader outputs are not already ESP32-safe.

For the current EL-SR10C installation, the verified data wiring remains:

| EL-SR10C wire | Connection |
| --- | --- |
| Green (D0) | ESP32 GPIO 18 |
| White (D1) | ESP32 GPIO 19 |
| Black (GND) | Reader supply negative and ESP32 GND |

## EL-SR10C buzzer and LED safety

Leave the reported purple BUZZ and yellow LED control wires disconnected until the exact reader variant is electrically verified. Available EL-SR10C documentation is not consistent with this unit's wire colors: one published sheet identifies blue as LED and yellow as BEEP. It does not specify enough input electrical detail to prove that a direct 3.3 V ESP32 connection is safe.

Treat both reader control inputs as active-low: feedback is requested by pulling the reader control line to reader ground. Do not connect either control wire directly to an ESP32 GPIO. Use a separate open-collector NPN transistor or a suitable optocoupler per control line so the ESP32 only drives the isolator/driver input. The reader-side transistor collector connects to the confirmed control wire and its emitter connects to reader ground. Select and validate base/input resistors against the chosen component's datasheet.

Before installing that interface, with the control wires isolated from the ESP32:

1. Confirm the wire labels for this exact unit from its label/manual or supplier.
2. Measure each disconnected control wire's idle voltage relative to reader black/GND.
3. Measure or safely establish the pull-down current required by the reader input.
4. Confirm that a current-limited, momentary pull-down produces the expected buzzer or LED response.
5. Confirm the chosen transistor/optocoupler voltage and current ratings exceed the measured values.

Only after those checks may the local ignored configuration set GPIO numbers and enable feedback. Example for an external active-high driver input:

```json
{
  "buzzerPin": 18,
  "ledPin": 19,
  "feedbackOutputsEnabled": false,
  "feedbackDriverActiveHigh": true
}
```

Keep `feedbackOutputsEnabled` set to `false` until the driver circuit and reader-side measurements are confirmed. GPIO 18 and GPIO 19 above are examples, not approved wiring assignments. Check the actual ESP32 board and connected peripherals before selecting pins. If an electrically isolated driver has an active-low ESP32 input, set `feedbackDriverActiveHigh` to `false`.

The reader may still emit its built-in scan beep. API-directed feedback starts immediately after the scan response arrives and therefore follows that automatic beep.

Important:

- If `feedbackOutputsEnabled` is `false`, or `buzzerPin` remains `-1`, the ESP32 does not drive a separate buzzer output.
- In that case, you will still hear only the reader's own generic scan beep even when the backend returns different `beep` values.
- Boot and tap serial logs now state explicitly when GPIO feedback is disabled.

When GPIO feedback has been electrically verified and enabled, the current firmware uses these patterns:

| API `beep` | Physical response | Serial log |
| --- | --- | --- |
| `success` | 1 short pulse | `Feedback: success` |
| `duplicate` | 2 quick short pulses | `Feedback: duplicate` |
| `warning` | 1 long pulse | `Feedback: warning` |
| `offline` or `offline_queued` | 1 short pulse, then 1 long pulse | `Feedback: offline` |
| `error` | 1 long error pulse | `Feedback: error` |

When feedback outputs are disabled, these serial logs still appear but no feedback GPIO is configured as an output.

Reader event serial logs now also print the scanned credential, backend HTTP status, and selected feedback pattern after each tap. Bearer tokens are never written to serial logs.

## Firmware modules

- `WiegandReader`
- `WiegandDecoder`
- `ConfigManager`
- `GatewayClient`
- `OfflineQueue`
- `DeviceRegistration`
- `FeedbackController`
- `ReaderGatewayApp`

## Configuration

The device loads JSON from LittleFS at:

```text
/reader-gateway/config.json
```

First-time provisioning workflow:

1. Flash the gateway firmware and LittleFS image once. The firmware supports first-time Wi-Fi setup from the device itself.

2. On first boot, when no Wi-Fi credentials are stored in NVS, the ESP32 opens a captive portal:

   ```text
   SSID: SSAMENJ-Setup-<last4ChipID>
   Password: ssamenj123
   URL fallback: http://192.168.4.1
   ```

3. The setup page asks the installer only for:
   - school Wi-Fi SSID;
   - Wi-Fi password;
   - one-time activation code.

   The installer is not asked for a bearer token, provisioning token, school UUID, API URL, OTA key, or backend secret.

4. On save, the firmware stores the Wi-Fi credentials and activation code locally, connects to Wi-Fi, stops AP mode, calls the activation endpoint, stores the returned device token and canonical reader assignment, and then resumes the normal School Connect heartbeat, offline queue replay, and attendance loop.

5. On later reboots, the gateway keeps retrying the stored Wi-Fi credentials. Temporary Wi-Fi loss does not reopen setup automatically and does not clear credentials.

6. Factory reset Wi-Fi by holding the ESP32 BOOT button for 10 seconds. This clears only the stored Wi-Fi credentials and reopens the setup portal.

Important:

- Fresh devices activate through `/api/readers/activate` using the one-time activation code.
- Once activation succeeds, the firmware stores the returned bearer token and normalizes future registration calls to `/api/readers/register`.
- Existing LittleFS `wifiSsid` and `wifiPassword` values remain as a fallback for previously provisioned devices until NVS credentials are saved.
- If a deployed reader token must be rotated, use Owner Console and recover the one-time token from the reader detail page immediately. The detail page now shows the rotated token once in a highlighted panel.
- `buzzerPin` remains optional. Use `-1` to disable the external driver output, or set a verified GPIO only after the isolated buzzer/LED interface has been validated for the exact reader hardware.

Example configuration:

```json
{
  "deviceId": "reader-gateway-74372C",
  "readerId": "attendance-gate-01",
  "schoolId": "",
  "deviceName": "Attendance Gate 01",
  "readerLocation": "Main Gate",
  "readerType": "GATE",
  "wifiSsid": "YOUR_WIFI_NAME",
  "wifiPassword": "YOUR_WIFI_PASSWORD",
  "activationCode": "123456",
  "tlsInsecure": true,
  "retryIntervalMs": 30000,
  "eventsPath": "/api/readers/events",
  "registrationPath": "/api/readers/activate",
  "heartbeatPath": "/api/readers/heartbeat",
  "firmwareVersion": "1.0.0",
  "wifiReconnectIntervalMs": 15000,
  "wiegandTimeoutMs": 30,
  "ntpServer": "pool.ntp.org"
}
```

Activation and registration contract:

- First-time setup posts `activationCode`, `hardwareId`, `deviceId`, `readerId`, `firmwareVersion`, `firmwareChannel`, and transport metadata to `/api/readers/activate`.
- The backend validates the code, binds the hardware identity to the pending reader, and returns the canonical `schoolId`, school name, device token, firmware channel, location, and reader type.
- After activation, the reader uses its stored bearer token on `/api/readers/register`, `/api/readers/heartbeat`, `/api/readers/events`, and OTA endpoints.

Bootstrap mechanism:

- `READER_GATEWAY_PRODUCTION_API_BASE_URL` controls the API base URL embedded into firmware at build time.
- The prebuild script generates `secrets/device_bootstrap.auto.h` locally and PlatformIO force-includes it during flashing.
- The generated header is ignored by git and never shown in the captive portal.
- Localhost firmware bootstrap is blocked by default; use a real HTTPS backend for field installs unless you explicitly opt into a lab-only local build.

## Build

Install PlatformIO, then from this folder:

```bash
pio run
```

## Flash

```bash
pio run -t upload
```

## Filesystem upload

```bash
pio run -t uploadfs
```

## Secure OTA

The gateway now uses backend-driven HTTPS pull OTA:

- The device checks `/api/readers/ota/check`
- The backend returns a staged release by `deviceId` or `firmwareChannel`
- The device downloads the artifact over HTTPS with bearer-token auth
- The device verifies the SHA-256 digest and ECDSA P-256 signature before install
- OTA uses ESP32 `ota_0` / `ota_1` partitions with rollback-aware boot validation
- LittleFS queue data survives firmware updates
- USB flashing remains the emergency recovery path

Required config keys:

```json
{
  "firmwareChannel": "stable",
  "otaCheckPath": "/api/readers/ota/check",
  "otaStatusPath": "/api/readers/ota/status",
  "otaCheckIntervalMs": 3600000,
  "otaPublicKeyId": "reader-gateway-2026",
  "otaPublicKeyPem": "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----\\n"
}
```

Important:

- The first OTA-capable install must still be flashed by USB.
- Do not publish an OTA port on the local network.
- Do not offer unsigned firmware images.
- If `tlsInsecure` is still `true`, firmware signature verification remains mandatory, but production should move to a real CA bundle in `tlsRootCaPem`.

## Example API request

```http
POST /api/readers/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "deviceId": "attendance-gate-01",
  "readerId": "attendance-gate-01",
  "schoolId": "school-001",
  "credential": "1234567890",
  "format": "wiegand34",
  "deviceTime": "2026-07-10T08:00:00Z",
  "firmwareVersion": "1.0.0",
  "eventId": "2b7d3a2c-8c2c-4f18-8f8e-85c7f85b4b7d",
  "retryCount": 0,
  "syncStatus": "pending"
}
```

## Expected response

```json
{
  "success": true,
  "action": "ATTENDANCE",
  "status": "ACCEPTED",
  "message": "Attendance recorded",
  "studentName": "John Doe",
  "beep": "success"
}
```

Tap responses from `POST /api/readers/events` use these device-directed `beep` values:

- `success` for accepted attendance
- `duplicate` for repeated taps inside the duplicate window
- `warning` for attendance windows that are closed or review-only
- `error` for an unregistered credential or other denied/error outcomes
- `offline_queued` when the event is stored locally because Wi-Fi/API is unavailable
- `offline` for network fallback feedback inside firmware
- `error` for unexpected API or device failures

## Notes

- Offline events are stored in LittleFS at `/reader-gateway/queue.ndjson` and retried oldest-first.
- Invalid zero-value Wiegand frames are dropped locally and never queued.
- The firmware does not decide attendance, wallet, library, or hostel rules.
- All business logic stays on School Connect.
