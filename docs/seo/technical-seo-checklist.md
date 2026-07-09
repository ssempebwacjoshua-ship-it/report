# Technical SEO Checklist

## Page-level checks

- Unique title tag on every public page.
- Unique meta description on every public page.
- Correct canonical URL on every public page.
- `robots` meta set to `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`.
- One visible H1 per public page.
- Heading structure flows from H1 to H2 to H3 without skipping purposefully.
- Internal links point to the real public pages.
- CTA buttons point to contact, demos, pricing, or the relevant product page.
- Image alt text describes the image meaningfully.

## Structured data checks

- `Organization` exists sitewide.
- `WebSite` exists sitewide.
- `SoftwareApplication` is used on product landing pages.
- `BreadcrumbList` is used where the page hierarchy is clear.
- `FAQPage` is used only when the FAQ content is visibly present on the page.
- No fake reviews, ratings, awards, clients, or usage numbers.

## Sitewide checks

- `robots.txt` points to the sitemap.
- `sitemap.xml` includes only real public URLs.
- `manifest.json` returns valid JSON, not HTML.
- No private routes, dashboard routes, or API routes in the sitemap.
- No duplicate indexable aliases unless they have a clear purpose.

## Deployment checks

- Build the app before deployment.
- Verify the live deployment in Chrome.
- Recheck Search Console after the deployment is live.

