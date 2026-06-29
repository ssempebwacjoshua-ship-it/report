import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../../client/apiBase";
import { isRenderablePassportPhotoUrl } from "../../shared/utils/passportPhotoUrl";

type Props = {
  name: string;
  src?: string | null;
  alt?: string;
  className?: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase() || "?";
}

function resolvePassportPhotoSrc(value: string): string {
  if (value.startsWith("/uploads/")) {
    return new URL(value, `${getApiBaseUrl()}/`).toString();
  }
  return value;
}

export function PassportPhotoAvatar({ name, src, alt, className = "" }: Props) {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const canRenderImage = isRenderablePassportPhotoUrl(normalizedSrc);
  const imageSrc = canRenderImage ? resolvePassportPhotoSrc(normalizedSrc) : "";
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">("loading");
  const imageContainerClassName = `overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim();
  const fallbackContainerClassName = `grid place-items-center overflow-hidden rounded-2xl border-dashed border-slate-300 bg-white text-center shadow-sm ${className}`.trim();

  useEffect(() => {
    setImageState("loading");
  }, [normalizedSrc]);

  const fallbackText = useMemo(() => {
    if (!normalizedSrc) return "No photo";
    return "Photo unavailable";
  }, [normalizedSrc]);

  if (canRenderImage && imageState !== "error") {
    return (
      <div className={imageContainerClassName}>
        <img
          src={imageSrc}
          alt={alt ?? `${name} passport photo`}
          className="h-full w-full object-cover"
          style={{ visibility: imageState === "loaded" ? "visible" : "hidden" }}
          onLoad={() => setImageState("loaded")}
          onError={() => setImageState("error")}
        />
      </div>
    );
  }

  return (
    <div className={fallbackContainerClassName}>
      <div>
        <div className="text-2xl font-black text-slate-700">{getInitials(name)}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{fallbackText}</div>
      </div>
    </div>
  );
}
