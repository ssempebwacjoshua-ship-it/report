import { useEffect } from "react";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, type JsonLdValue, type SeoPage } from "../../config/seo";

type SeoProps = SeoPage & {
  image?: string;
  type?: "website" | "article";
  structuredData?: JsonLdValue;
};

function upsertMeta(
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  const selector = `link[rel="${rel}"]`;
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

function upsertJsonLd(structuredData?: JsonLdValue) {
  const selector = 'script[data-seo-json-ld="true"]';
  let element = document.head.querySelector(selector) as HTMLScriptElement | null;

  if (!structuredData) {
    element?.remove();
    return;
  }

  const payload = Array.isArray(structuredData)
    ? { "@context": "https://schema.org", "@graph": structuredData }
    : "@context" in structuredData
      ? structuredData
      : { "@context": "https://schema.org", ...structuredData };

  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.dataset.seoJsonLd = "true";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(payload);
}

export function Seo({
  title,
  description,
  canonicalPath,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  structuredData,
}: SeoProps) {
  useEffect(() => {
    const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "application-name", SITE_NAME);
    upsertMeta("name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);
    upsertLink("canonical", canonicalUrl);
    upsertJsonLd(structuredData);
  }, [canonicalPath, description, image, structuredData, title, type]);

  return null;
}
