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

## Wiring

Use the reader datasheet as the final authority. Typical wiring:

| Reader | ESP32 |
| --- | --- |
| D0 | GPIO 4 |
| D1 | GPIO 5 |
| GND | GND |
| VCC | 5V or reader-rated supply |

Important:

- Keep reader ground and ESP32 ground common.
- Power the Felix F-P001M according to its own voltage requirements.
- Use a level-safe wiring approach if your reader outputs are not already ESP32-safe.

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

Example configuration:

```json
{
  "deviceId": "attendance-gate-01",
  "schoolId": "school-001",
  "readerId": "attendance-gate-01",
  "wifiSsid": "School Wi-Fi",
  "wifiPassword": "secret",
  "apiBaseUrl": "https://school-connect.example.com",
  "eventsPath": "/api/readers/events",
  "registrationPath": "/api/readers/register",
  "bearerToken": "replace-me",
  "firmwareVersion": "1.0.0",
  "retryIntervalMs": 10000,
  "wifiReconnectIntervalMs": 15000,
  "wiegandTimeoutMs": 30,
  "ntpServer": "pool.ntp.org",
  "tlsInsecure": true
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

- Offline events are stored in LittleFS and retried oldest-first.
- The firmware does not decide attendance, wallet, library, or hostel rules.
- All business logic stays on School Connect.
