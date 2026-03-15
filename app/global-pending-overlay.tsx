"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function isInternalNavigableLink(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function GlobalPendingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [manualPending, setManualPending] = useState(false);
  const [inFlightRequests, setInFlightRequests] = useState(0);
  const releaseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setManualPending(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const onSubmit = () => {
      setManualPending(true);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!isInternalNavigableLink(event.target)) return;
      setManualPending(true);
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = input instanceof Request ? input.url : input.toString();
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const isSameOrigin = new URL(requestUrl, window.location.origin).origin === window.location.origin;
      const shouldTrack = isSameOrigin && method !== "GET";

      if (shouldTrack) {
        setInFlightRequests((current) => current + 1);
      }

      try {
        return await originalFetch(input, init);
      } finally {
        if (shouldTrack) {
          setInFlightRequests((current) => Math.max(0, current - 1));
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const isPending = useMemo(() => manualPending || inFlightRequests > 0, [inFlightRequests, manualPending]);

  useEffect(() => {
    if (releaseTimeoutRef.current) {
      window.clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = null;
    }

    if (isPending) return;

    releaseTimeoutRef.current = window.setTimeout(() => {
      setManualPending(false);
      releaseTimeoutRef.current = null;
    }, 150);

    return () => {
      if (releaseTimeoutRef.current) {
        window.clearTimeout(releaseTimeoutRef.current);
        releaseTimeoutRef.current = null;
      }
    };
  }, [isPending]);

  useEffect(() => {
    if (!isPending) {
      document.body.classList.remove("cursor-progress");
      return;
    }

    document.body.classList.add("cursor-progress");

    return () => {
      document.body.classList.remove("cursor-progress");
    };
  }, [isPending]);

  if (!isPending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 backdrop-blur-[1px]" aria-live="polite" aria-busy>
      <div className="flex min-w-[220px] items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 text-slate-700 shadow-lg">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" />
        <p className="text-sm font-medium">Traitement en cours...</p>
      </div>
    </div>
  );
}
