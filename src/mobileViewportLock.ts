function installMobileViewportLock() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // iOS Safari gesture zoom guard
  const preventGesture = (event: Event) => {
    event.preventDefault();
  };

  document.addEventListener("gesturestart", preventGesture, { passive: false } as AddEventListenerOptions);
  document.addEventListener("gesturechange", preventGesture, { passive: false } as AddEventListenerOptions);
  document.addEventListener("gestureend", preventGesture, { passive: false } as AddEventListenerOptions);

  // Prevent two-finger pinch zoom
  document.addEventListener(
    "touchmove",
    (event: TouchEvent) => {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  // Prevent double-tap zoom
  let lastTouchEnd = 0;

  document.addEventListener(
    "touchend",
    (event: TouchEvent) => {
      const now = Date.now();

      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }

      lastTouchEnd = now;
    },
    { passive: false },
  );
}

installMobileViewportLock();

export {};
