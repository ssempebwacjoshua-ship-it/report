import styles from "./BrandedLoader.module.css";

type BrandedLoaderProps = {
  text?: string;
};

export function BrandedLoader({ text = "Loading..." }: BrandedLoaderProps) {
  return (
    <div className={styles.page} role="status" aria-live="polite" aria-label={text}>
      <div className={styles.inner}>
        <div className={styles.markWrap} aria-hidden="true">
          <span className={styles.pulse} />
          <span className={styles.logoPlate}>
            <img src="/ssamenj-logo.png" alt="" className={styles.logo} />
          </span>
        </div>
        <p className={styles.text}>{text}</p>
      </div>
    </div>
  );
}
