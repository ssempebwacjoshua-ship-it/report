# Samsung S20 Gate-Only Setup

Scope:
Only touch this module: device setup documentation for the Samsung S20 gate terminal.

Do not touch:
Backend routes, attendance logic, reader firmware, Smart Pages, Reports, Students, Photos, Auth, or Settings UI.

## Purpose

Use a Samsung S20 as a dedicated Gate & Security terminal for School Connect / Report Lab. The device should launch directly into the gate workflow and should not be usable as a normal staff phone.

This document has two tracks:

1. Production setup with Samsung Knox / Android Enterprise kiosk mode.
2. Temporary manual fallback using Android screen pinning.

## Gate URL

Use the live gate entry URL already provided by School Connect / Report Lab for the school gate workflow.

Current gate route in the app:

- `/gate/nfc/:token`

For field setup, technicians should use the full live production URL supplied for that school and gate operator workflow. Do not use localhost URLs on the device.

## Before Going To School

1. Confirm the Samsung S20 is fully charged and the battery health is acceptable for all-day gate use.
2. Confirm the device has been factory reset if it was previously used as a personal phone or test phone.
3. Prepare the live production gate URL for that school.
4. Prepare the dedicated gate operator credentials.
5. Prepare the device admin PIN/password known only to SSAMENJ or the school system administrator.
6. Disable any plan to use a personal Google account on the device.
7. Decide the deployment mode:
   - Production: Samsung Knox / Android Enterprise kiosk
   - Temporary fallback: Android screen pinning
8. If using Knox Manage, make sure the tenant license, enrollment method, and kiosk profile are ready before leaving.
9. If using a web/PWA gate flow, confirm Chrome is available and updated.
10. Record the exact school name, gate terminal label, assigned operator, and maintenance PIN holder.

## Production Setup With Samsung Knox / Android Enterprise

Preferred production model:

- Enroll the Samsung S20 into Samsung Knox / Android Enterprise.
- Configure a single-app or tightly restricted multi-app kiosk.
- Allow only the School Connect gate workflow app or browser shell.

Samsung Knox references used:

- Knox Manage kiosk mode overview: Samsung documents kiosk devices as dedicated terminals with restricted app and feature access.
- Knox Manage Kiosk Wizard: Samsung documents creating kiosk launchers from `Kiosk > Add`.
- Knox Browser in kiosk mode: Samsung documents using Knox Browser as a kiosk utility and setting a homepage URL.

Recommended production kiosk design:

1. Enroll the phone into Knox Manage or the organization's Android Enterprise MDM.
2. Create a kiosk profile for the Gate terminal.
3. Prefer single-app kiosk if a wrapped app or approved kiosk browser is available.
4. If browser-based, use Knox Browser in kiosk mode or a managed Chrome setup if Knox Browser is not available yet.
5. Set the kiosk home/launch URL to the live School Connect gate URL.
6. Hide system UI as far as the MDM allows:
   - status bar
   - notifications
   - recent apps
   - app switching
   - settings
7. Allow only the minimum packages needed for operation:
   - kiosk browser or managed Chrome
   - School Connect app later, if a native app replaces the PWA
   - optional remote support tool approved by admin
8. Block or remove:
   - Play Store
   - YouTube
   - WhatsApp
   - Samsung Internet unless it is the managed kiosk browser
   - Gmail
   - Gallery
   - Camera, unless later approved
   - Bluetooth, unless required later
   - hotspot
   - USB file transfer
   - location, unless later required
9. Apply policy restrictions:
   - prevent app install/uninstall
   - block adding personal accounts
   - block developer options
   - block safe boot if the MDM supports it
   - block factory reset by normal users where supported
10. Set auto-launch to the gate kiosk app/browser on boot.
11. Set a strong admin PIN/password not shared with gate staff.
12. Keep automatic date, time, and timezone enabled.

## Temporary Manual Setup Using Android Screen Pinning

Use this only when Knox / MDM is not ready yet.

This is not as strong as production kiosk mode. It is a stopgap for controlled school deployment.

## On The Samsung S20

1. Factory reset the phone if it was previously used by another person.
2. Complete the initial Android setup with only the organization-approved account if one is required.
3. Do not add any personal Gmail, Samsung account, or staff account unless explicitly required for MDM enrollment.
4. Install only the minimum needed app path:
   - Chrome if the gate workflow is PWA/web-based
5. Set a strong screen lock:
   - use PIN or password
   - prefer a 6-digit or longer PIN at minimum
6. Keep the admin PIN known only to SSAMENJ/admin.
7. Turn on automatic date/time and timezone.
8. Set screen timeout long enough for gate work, but not excessive.
9. Disable biometric unlock for general gate staff if the admin wants strict shared-device control.
10. Remove all home screen shortcuts except the gate shortcut.

## Gate App/PWA Setup

1. Open Chrome.
2. Navigate to the live School Connect / Report Lab gate URL for that school.
3. Sign in with the dedicated gate operator account if the flow requires login.
4. Verify the page is the actual Gate & Security workflow, not the general dashboard.
5. In Chrome, install the site to the home screen:
   - use `Add to Home screen` or `Install app` if Chrome offers the PWA install prompt
6. Open the installed shortcut from the home screen.
7. Confirm it launches in app-like standalone mode and returns directly to the gate flow.
8. If the gate route uses a long tokenized URL, test reopening the shortcut after closing it.
9. Remove any duplicate Chrome shortcuts that could confuse gate staff.

## Lockdown Settings

### Production Knox / MDM Lockdown

Set these in the kiosk or device restriction profile where supported:

1. Allow only the gate kiosk app or browser.
2. Hide or disable:
   - Settings
   - Play Store
   - Samsung Galaxy Store
   - Gmail
   - Messages
   - YouTube
   - WhatsApp
   - Camera
   - File manager
3. Restrict hardware and radios:
   - Bluetooth off
   - hotspot off
   - NFC off unless the phone itself later needs NFC
   - USB file transfer blocked
   - location off unless needed
4. Restrict navigation:
   - block notifications shade if supported
   - block recent apps
   - block app switching
   - block browser navigation outside the approved gate URL if using a kiosk browser
5. Prevent account misuse:
   - no personal Google account
   - no personal Samsung account
   - no ad hoc app installs

### Temporary Manual Lockdown

1. Enable App pinning:
   - `Settings > Security and privacy > More security settings > Pin app`
2. Turn on the option that requires the PIN/password before unpinning.
3. Open the installed gate PWA or Chrome tab.
4. Open recent apps.
5. Tap the app icon.
6. Tap `Pin`.
7. Verify the device cannot switch away without the admin PIN.
8. Turn off or reduce notifications where possible.
9. Disable or hide unused apps from the home screen.
10. Disable quick access to Bluetooth, hotspot, and unrelated controls where possible.
11. Remove browser bookmarks unrelated to School Connect.

Google's Android help documents app pinning as:

- `Settings > Security or Security & location > Advanced > App pinning`
- when enabled, the device can require the PIN, pattern, or password before unpinning

## Final Verification

1. Reboot the phone.
2. Confirm it returns directly to the kiosk workflow or that the gate shortcut is the only visible operator path.
3. Confirm the gate operator can complete only gate/security actions.
4. Confirm staff cannot:
   - open Play Store
   - browse unrelated websites
   - access personal mail
   - install apps
   - switch to social or messaging apps
5. Confirm the gate URL still loads after reboot.
6. Confirm screen pinning or kiosk mode remains active.
7. Confirm the device date/time is correct.
8. Confirm mobile data or Wi-Fi policy matches the school deployment plan.
9. Confirm the maintenance PIN is recorded in the admin handover notes, not shared with gate staff.

## How To Unlock For Maintenance

1. Use the admin PIN/password only.
2. If using temporary app pinning:
   - unpin using the Android unpin gesture for the navigation mode in use
   - enter the admin PIN/password
3. If using Knox / MDM kiosk:
   - exit kiosk from the MDM console or approved admin action
   - do not give the exit PIN to gate staff
4. Perform only the needed maintenance:
   - update the gate shortcut
   - rotate credentials
   - apply managed updates
   - verify device time/network
5. Re-enter kiosk or pinned mode immediately after maintenance.

## Recommended Restrictions Summary

Use this default gate-only restriction set unless a school-specific exception is approved:

- Allowed:
  - School Connect gate PWA or kiosk browser
  - required system services
  - approved remote support if necessary
- Blocked:
  - Play Store
  - personal Gmail
  - YouTube
  - WhatsApp
  - app installs
  - general settings changes
  - browser use outside the gate URL
  - Bluetooth
  - hotspot
  - USB file transfer
  - location
  - camera

## Notes For Field Technicians

1. Production kiosk mode should use Samsung Knox / Android Enterprise, not screen pinning alone.
2. Screen pinning is only a temporary fallback.
3. If the gate workflow is purely web-based today, the cleanest production option is a managed kiosk browser with a locked homepage URL.
4. If a native gate app is introduced later, reuse the same kiosk restrictions and replace the browser/PWA entry with that app.
5. Do not leave the Samsung S20 signed into a personal account after deployment.
