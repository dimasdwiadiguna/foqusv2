"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker (production builds only) and, when a new version has installed,
 * offers "Reload to update" (Step 1.5). Nothing reloads on its own.
 */
export function ServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    let reloading = false;

    const onController = () => {
      // Only reload when the owner asked for the update (the first install also takes control).
      if (reloading) window.location.reload();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void reg?.update().catch(() => {});
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        const offer = (w: ServiceWorker | null) => {
          if (w && navigator.serviceWorker.controller) setWaiting(w);
        };
        offer(r.waiting);
        r.addEventListener("updatefound", () => {
          const w = r.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed") offer(w);
          });
        });
      })
      .catch(() => {
        // Without a worker the app still runs online; there is nothing to show.
      });

    navigator.serviceWorker.addEventListener("controllerchange", onController);
    document.addEventListener("visibilitychange", onVisible);
    (window as Window & { __foqusReload?: () => void }).__foqusReload = () => {
      reloading = true;
    };
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-[max(env(safe-area-inset-top),8px)]">
      <div className="flex w-full max-w-[448px] items-center gap-3 rounded-card border border-accent/60 bg-surface-raised px-4 py-2 shadow-xl">
        <p className="min-w-0 flex-1">A new version is ready.</p>
        <button
          type="button"
          className="min-h-11 rounded-full bg-accent px-4 font-semibold text-bg"
          onClick={() => {
            (window as Window & { __foqusReload?: () => void }).__foqusReload?.();
            waiting.postMessage("SKIP_WAITING");
          }}
        >
          Reload to update
        </button>
      </div>
    </div>
  );
}
