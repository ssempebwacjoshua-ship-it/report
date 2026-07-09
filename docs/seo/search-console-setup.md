# Search Console Setup

## Verified Property

The SSAMENJ Search Console property is already verified. Do not add new verification tags and do not remove the existing verification tags in `index.html`.

## Current Public Resources

- Homepage: `https://ssamenj.vercel.app/`
- Sitemap: `https://ssamenj.vercel.app/sitemap.xml`
- Robots: `https://ssamenj.vercel.app/robots.txt`
- Manifest: `https://ssamenj.vercel.app/manifest.json`

## Submission Steps

1. Open Search Console for the verified SSAMENJ property.
2. Submit `https://ssamenj.vercel.app/sitemap.xml`.
3. Inspect the key landing pages after deployment:
   - `/`
   - `/report-lab`
   - `/smart-pages`
   - `/nfc`
   - `/pricing`
   - `/demos`
   - `/contact`
   - `/rentflow`
   - `/cashless-canteen`
   - `/stayos`
4. Confirm that the inspected pages are rendered as their own landing pages and not homepage fallbacks.
5. Recheck coverage and crawl fetch status after Google has time to revisit the site.

## Notes

- Keep the sitemap limited to public indexable URLs only.
- Keep the manifest and sitemap available at the root of the deployed site.
- If Search Console reports fetch issues, verify the live deployment first in Chrome before changing the site again.

