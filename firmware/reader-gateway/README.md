# SSAMENJ Reader Gateway

First production firmware for the SSAMENJ Reader Gateway on ESP32 + Wiegand.

This gateway is a transport layer only:

- Reads Wiegand 26, 34, and 37 credentials
- Sends scan events to School Connect over Wi-Fi
- Stores offline events in LittleFS
- Replays queued events oldest-first when connectivity returns
- Supports OTA firmware updates

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

The reader may still emit its built-in scan beep. API-directed feedback starts immediately after the scan response arrives and therefore follows that automatic beep:

| API `beep` | Physical response | Serial log |
| --- | --- | --- |
| `success` | 1 short pulse | `Feedback: success` |
| `duplicate` (or legacy `warning`) | 2 short pulses | `Feedback: duplicate` |
| `error` | 1 long pulse | `Feedback: error` |
| `offline` / queued locally | 3 short pulses | `Feedback: offline` |

When feedback outputs are disabled, these serial logs still appear but no feedback GPIO is configured as an output.

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

1. Copy the committed example to the live LittleFS config path:

   ```powershell
   Copy-Item .\data\reader-gateway\config.json.example .\data\reader-gateway\config.json
   ```

2. Edit `data/reader-gateway/config.json` and fill in:
   - `wifiSsid`
   - `wifiPassword`
   - `schoolId`
   - `readerId`
   - `apiBaseUrl`
   - `bearerToken`
   - optional `heartbeatPath`
   - optional `tlsInsecure`
   - optional `retryIntervalMs`
   - optional `buzzerPin` and `ledPin` after electrical verification
   - `feedbackOutputsEnabled` (safe default: `false`)
   - `feedbackDriverActiveHigh` for the external driver input

3. Upload the filesystem image to the ESP32 with PlatformIO LittleFS:

   ```powershell
   & "$env:USERPROFILE\.platformio\penv\Scripts\platformio.exe" run --target uploadfs --upload-port COM6
   ```

4. Reboot the reader. On boot, the serial monitor should move from `Queued Offline` to:

   ```text
   Wi-Fi Connected
   Upload Success
   ```

Example configuration:

```json
{
  "readerId": "attendance-gate-01",
  "schoolId": "YOUR_SCHOOL_ID",
  "wifiSsid": "YOUR_WIFI_NAME",
  "wifiPassword": "YOUR_WIFI_PASSWORD",
  "apiBaseUrl": "https://YOUR_API_DOMAIN",
  "bearerToken": "YOUR_DEVICE_TOKEN",
  "tlsInsecure": true,
  "retryIntervalMs": 30000,
  "eventsPath": "/api/readers/events",
  "registrationPath": "/api/readers/register",
  "heartbeatPath": "/api/readers/heartbeat",
  "firmwareVersion": "1.0.0",
  "wifiReconnectIntervalMs": 15000,
  "wiegandTimeoutMs": 30,
  "ntpServer": "pool.ntp.org"
}
```

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

## OTA

Once Wi-Fi is connected and OTA is enabled in the firmware, later deployments can use Arduino OTA without a USB cable.

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
  "message": "Attendance recorded",
  "studentName": "John Doe",
  "beep": "success"
}
```

## Notes

- Offline events are stored in LittleFS at `/reader-gateway/queue.ndjson` and retried oldest-first.
- Invalid zero-value Wiegand frames are dropped locally and never queued.
- The firmware does not decide attendance, wallet, library, or hostel rules.
- All business logic stays on School Connect.
