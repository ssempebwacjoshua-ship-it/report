/** Dev-only horizontal overflow detector.
 * Logs elements wider than their container so layout regressions are caught
 * during development. Never runs in production builds.
 */
export function installOverflowDetector() {
  if (!import.meta.env.DEV) return;

  function check() {
    const offenders: { el: Element; over: number }[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const style = getComputedStyle(el);
      const scrollable = /(auto|scroll)/.test(style.overflowX);
      const over = el.scrollWidth - el.clientWidth;
      if (over > 1 && !scrollable) offenders.push({ el, over });
    });
    const pageOver = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    if (pageOver > 1) {
      console.warn(`[overflow] page is ${pageOver}px wider than viewport`, offenders.slice(0, 10));
    }
  }

  window.addEventListener("resize", check);
  window.addEventListener("load", () => setTimeout(check, 1000));
  document.addEventListener("click", () => setTimeout(check, 500), { passive: true });
}
