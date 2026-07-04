# School Connect Report Lab Troubleshooting Guide

## Login Problems

### Symptom

- User cannot sign in
- Login returns invalid credentials
- School account appears suspended

### Safe Checks

1. Confirm the email and password.
2. Confirm the school code.
3. Confirm the school account is active.
4. Confirm the user is still active.

### Support Action

- Reset the password or reactivate the account through the admin process.
- If the school is suspended, contact SSAMENJ support.

## Missing School Context

### Symptom

- Pages show authentication or school context errors
- Data does not load after login

### Likely Cause

- Token is missing
- Session expired
- Wrong school code was used
- Cross-tenant access was attempted

### Safe Recovery

1. Log out and log in again.
2. Confirm the correct school code.
3. Reload the page.

## Missing Classes Or Streams

### Symptom

- Student creation cannot find the selected class or stream
- Report generation returns empty results
- Import options are incomplete

### Likely Cause

- School structure has not been provisioned fully
- The selected school section does not include the expected class
- Streams were not created yet

### Safe Recovery

1. Open Settings.
2. Check School Structure.
3. Confirm the required sections and streams.
4. Ask onboarding support to provision the missing structure if needed.

## Duplicate Class Errors

### Symptom

- Saving school structure fails with a duplicate class error
- Prisma returns `P2002`

### Known Recent Issue

- Prisma `P2002` unique constraint on `SchoolClass (schoolId, name)`

### Likely Cause

- Provisioning or upsert idempotency mismatch
- A class with the same school and name already exists
- A repair script or onboarding flow attempted to create the same canonical class again

### User-Safe Message

- "This class already exists for your school. Please reload school structure or contact support if the error keeps happening."

### Developer Resolution Direction

- Check the class provisioning path for repeated create/upsert attempts
- Confirm whether the lookup key matches the unique index
- Make the provisioning flow idempotent for both `schoolId + code` and `schoolId + name` collisions

## Duplicate Student Admission Number Errors

### Symptom

- Student creation or import fails

### Likely Cause

- Two students were given the same admission number in the same school

### Safe Recovery

1. Search for the admission number in the student list.
2. Use a unique admission number.
3. Re-run the import or creation flow.

## Marks Import Failures

### Symptom

- Dry run shows many invalid rows
- Commit does not save marks
- Import file is rejected

### Likely Cause

- Wrong column headers
- Missing admission numbers
- Wrong class or stream text
- Invalid marks format
- Duplicate rows

### Safe Recovery

1. Download the template again.
2. Re-check the school class, stream, subject, term, and exam type values.
3. Run dry run first.
4. Fix every invalid row before commit.

## Upload Or OCR Failures

### Symptom

- Scan upload fails
- OCR returns a friendly unavailable message
- Scan cannot be parsed

### Likely Cause

- File too large
- Unsupported file type
- Unclear image
- OCR provider unavailable
- Gemini or Azure configuration problem

### Safe Recovery

1. Re-upload a clear image or PDF.
2. Use a supported file type.
3. Check provider configuration.
4. Retry after a short wait if the provider is temporarily unavailable.

## AI Provider Unavailable

### Symptom

- Gemini scan extraction returns 503
- OCR read returns 503

### Likely Cause

- API key missing
- Provider rate limit
- Network or DNS failure
- External service outage

### Safe Recovery

1. Check the server environment configuration.
2. Retry the scan.
3. Use digital CSV import as a fallback if the provider stays down.

## Report Generation Errors

### Symptom

- Reports page is empty
- Student cards do not appear
- Print preview is missing data

### Likely Cause

- No active academic year
- No active term
- Wrong class or stream selected
- No finalized marks
- Subject setup is incomplete

### Safe Recovery

1. Confirm the active year and term.
2. Confirm the correct class and stream.
3. Confirm marks were finalized.
4. Confirm the subject list exists.

## Verification Errors

### Symptom

- Public verification code is not found
- Parent report link shows revoked or superseded

### Likely Cause

- Wrong reference code
- Report was revoked
- A newer report replaced the older one
- Token expired or was mistyped

### Safe Recovery

1. Re-check the reference code.
2. Confirm the report was actually issued.
3. Use the latest issued report link.

## Print Or Layout Issues

### Symptom

- Report prints badly
- PDF page breaks look wrong
- Branding does not appear as expected

### Likely Cause

- Browser zoom or print settings
- Missing branding asset
- Wrong layout settings

### Safe Recovery

1. Print from the report preview screen.
2. Use browser print preview.
3. Check report personalization settings.
4. Confirm logo, stamp, and signature uploads are present.

## Mobile Or PWA Display Issues

### Symptom

- Layout is cramped on a phone
- Buttons overlap
- Content scrolls strangely

### Safe Recovery

1. Refresh the app.
2. Use the latest browser version.
3. Test on a larger screen for setup tasks.
4. Report repeated layout issues to the development team.

## Deployment Issues

### Symptom

- App works locally but not in production
- Pages fail after deployment
- API calls fail on the deployed site

### Common Causes

- Wrong `VITE_API_BASE_URL`
- Missing `DATABASE_URL`
- Missing `JWT_SECRET`
- Wrong `CLIENT_ORIGIN`
- Missing `APP_BASE_URL` or `PUBLIC_APP_URL`

### Safe Recovery

1. Verify the deployment environment variables.
2. Rebuild the app.
3. Check backend logs.
4. Confirm the frontend points at the correct API.

## Prisma Migration Or Generate Issues

### Symptom

- Prisma client errors
- Missing table or column errors
- Startup failure after deployment

### Safe Recovery

1. Run the Prisma generate step.
2. Apply migrations in the correct environment.
3. Check whether the database schema matches the code.
4. Re-run the build.

## Common Railway Or Vercel Mistakes

- Putting backend secrets into frontend `VITE_` variables
- Forgetting `CLIENT_ORIGIN`
- Using localhost URLs in production
- Forgetting `APP_BASE_URL` for parent report links
- Deploying with an outdated database schema

## What Logs To Check

- Backend startup logs
- Import and OCR logs
- Report generation logs
- Railway service logs
- Browser console errors

## Safe Recovery Steps

1. Stop making repeated changes until the error is understood.
2. Reproduce the issue with one school account.
3. Check the logs.
4. Confirm the school context and current settings.
5. Retry only after fixing the obvious cause.

## When To Contact SSAMENJ Support

Contact SSAMENJ support when:

- The same error keeps returning after a refresh
- You suspect a data repair is needed
- A deployment environment variable is missing
- The OCR or Gemini provider keeps failing
- The school structure appears corrupted
- You need help with the first report cycle

## Support Contacts

- Website: https://ssamenj.vercel.app/
- Global WhatsApp/contact: +971 56 370 4103
- Uganda product manager/contact: +256 774 549 869

