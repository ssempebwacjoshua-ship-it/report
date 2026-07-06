# Smart Device Automation Standard

This standard applies to StayOS/rentals device automation and to future SSAMENJ modules that control physical devices.

## Rules

- Automation requires an explicit business rule.
- Checkout grace periods must be defined.
- Manual override must exist.
- Audit every device action.
- Failed automation alerts an operator.
- Do not blindly trust device state.
- Guest safety comes before automation.
- No unsafe action without confirmation.

## StayOS Requirements

Before implementing checkout or device automation, define authorization, property/company scope, device ownership, retry behavior, manual override, emergency access, guest safety, audit events, and operator alerts.

## Report Lab And Platform Note

For Report Lab and platform-style repos, keep this as a future standard for rentals/StayOS-style modules, not current runtime functionality.
