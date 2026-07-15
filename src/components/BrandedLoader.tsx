import { useState } from "react";
import ssamenjLogo from "../assets/ssamenj-logo-transparent.png";
import styles from "./BrandedLoader.module.css";

type BrandedLoaderProps = {
  message?: string;
  fullScreen?: boolean;
  compact?: boolean;
  text?: string;
};

export function BrandedLoader({
  message,
  fullScreen = true,
  compact = false,
  text,
}: BrandedLoaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const label = message ?? text ?? "Loading school workspace...";
  const className = [
    fullScreen ? styles.page : styles.inline,
    compact ? styles.compact : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} role="status" aria-live="polite" aria-label={label}>
      <div className={styles.inner}>
        <div className={styles.markWrap} aria-hidden="true">
          <span className={styles.glow} />
          <span className={styles.ring} />
          {logoFailed ? (
            <span className={styles.logoFallback}>S</span>
          ) : (
            <img
              src={ssamenjLogo}
              alt="SSAMENJ"
              className={styles.logo}
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
        <p className={styles.text}>{label}</p>
      </div>
    </div>
  );
}
