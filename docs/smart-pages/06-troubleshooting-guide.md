# School Connect Smart Pages Troubleshooting Guide

## Login Problems

- Confirm the user is signed in with the correct school account.
- Confirm the app loaded the school session successfully.
- Clear stale browser sessions if the school recently changed accounts.
- Make sure the user is not trying to use a creator-only or lawyer-only token for a school page.

## Missing School Context

Symptoms:

- `401 Authentication required.`
- School pages do not load.
- Template routes reject access.

What to check:

- The school token is present.
- The request reached the school auth path.
- The school session has not expired.

## Smart Pages Entitlement Disabled

If platform integration is enabled, protected routes may return:

- `403 MODULE_NOT_ENABLED`
- `503 PLATFORM_INTEGRATION_UNAVAILABLE`

What to check:

- The module is enabled for that school in the parent platform.
- The platform service URL is reachable.
- The service token is configured on the server.

## Upload Failures

Common causes:

- No file was attached.
- The file type is not supported.
- The file is too large.
- The document is too blurry or cropped.

Safe recovery steps:

- Re-upload the file.
- Use a clearer scan or photo.
- Convert the document to PDF if needed.
- Try again with a cleaner source file.

## Unsupported File or Document Type

Current code supports:

- PDF
- Images
- CSV
- XLS
- XLSX

Not supported yet:

- Word documents

## Blurry or Cropped Scan or Photo

If the extraction result is weak:

- Upload a clearer image.
- Make sure all corners of the page are visible.
- Avoid dark shadows and strong glare.
- Retake the photo with the page straight.

If handwriting is difficult to read:

- Use high accuracy retry if available.
- Review every field manually before saving or publishing.

## AI or OCR Provider Unavailable

Possible symptoms:

- Extraction is stuck.
- Retry still fails.
- The document stays in processing for too long.
- The system returns a generic provider unavailable message.

What to check:

- `GEMINI_API_KEY`
- `OCR_ENABLED`
- `OCR_PROVIDER`
- `AZURE_OCR_FUNCTION_URL`
- Platform integration env vars if entitlement or usage is involved

Safe recovery steps:

- Retry extraction.
- Use a different input file.
- Wait for the provider to recover.
- Contact support if the issue persists.

## Extraction Result Is Wrong or Incomplete

This can happen when:

- The scan is unclear.
- The source document is missing text.
- The document contains handwriting.
- The page is cropped.
- The document type is unusual.

Recommended action:

1. Edit the extracted text.
1. Correct the title, dates, and any important fields.
1. Use the template picker only after the review step.
1. Do not publish until the content has been checked by a person.

## Template Route Access Issues

Current code behavior:

- School templates are protected and require school context.
- School template access also checks platform entitlement when integration is enabled.
- Lawyer templates are feature-flagged and return 404 when the lawyer vertical is disabled.

If the user sees a 404 or 403:

- Check the school session.
- Check entitlement in the parent platform.
- Check whether the lawyer vertical is intentionally disabled.

Known boundary note:

- The old `req.school` template-guard gap was fixed by mounting the school template routes after school context resolution.
- In the current code, the school template routes are treated as protected school-owned routes, not public static marketing routes.

## Smart Pages vs Report Lab Confusion

Use Smart Pages for:

- Notices
- Circulars
- Timetables
- Programmes
- Minutes
- Exam schedules
- Policies
- General school documents

Use Report Lab for:

- Marksheet and report flows

They are separate modules.

## Platform Integration 401/403/503 Responses

- `401 Authentication required.` means the school context is missing.
- `403 MODULE_NOT_ENABLED` means the module is not enabled for the school.
- `503 PLATFORM_INTEGRATION_UNAVAILABLE` means the parent platform could not be reached or was not configured.

Recovery steps:

- Recheck sign-in.
- Recheck school entitlement.
- Recheck platform URL and service token on the server.

## Deployment and Environment Issues

Check these when Smart Pages fails after deployment:

- `JWT_SECRET`
- `DATABASE_URL`
- `CLIENT_ORIGIN`
- `GEMINI_API_KEY`
- `OCR_ENABLED`
- `OCR_PROVIDER`
- `AZURE_OCR_FUNCTION_URL`
- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED`
- `SSAMENJ_PLATFORM_URL`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN`

If the server will not start, check the startup logs for `env-check` warnings or fatal messages.

## Railway and Vercel Common Mistakes

- Forgetting to run the build before start.
- Forgetting to apply Prisma migrations before production start.
- Setting local URLs in production.
- Exposing secrets in `VITE_` variables.
- Expecting Word uploads before the feature exists.

The repo does not currently include a deployment config file, so deployment settings must be supplied by the host environment.

## What Logs To Check

Useful log prefixes in this codebase include:

- `[platform-integration]`
- `[smart-pages-billing]`
- `[document-intelligence]`
- `[document-gemini]`
- `[env-check]`
- `[school-context-denied]`
- `[server-error]`

## Safe Recovery Steps

When something looks wrong:

1. Retry the action once.
1. Check the file quality.
1. Confirm the school session.
1. Confirm the module entitlement.
1. Review the extracted content manually.
1. Contact support if the issue still persists.

## When To Contact SSAMENJ Support

Contact support when:

- The school cannot log in.
- The entitlement check keeps failing.
- The upload works but extraction stays broken.
- The platform integration returns repeated 503 errors.
- The school wants help with onboarding, branding, or rollout.

Support contacts:

- Website: https://ssamenj.vercel.app/
- Global WhatsApp/contact: +971 56 370 4103
- Uganda Product Manager/contact: +256 774 549 869

