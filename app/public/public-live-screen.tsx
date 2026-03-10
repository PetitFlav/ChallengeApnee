"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PublicLiveScreenProps = {
  challengeName: string;
  startTime: string;
  endTime: string | null;
  initialTotalDistanceM: number;
  dataEndpoint: string;
  refreshIntervalMs: number;
};

type PublicDataPayload = {
  totalDistanceM: number;
  updatedAt: string;
};

const MIN_ANIMATION_DURATION_MS = 600;
const MAX_ANIMATION_DURATION_MS = 2500;
const METERS_PER_SECOND = 3200;

function formatKilometers(distanceM: number) {
  return (distanceM / 1000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function PublicLiveScreen({
  challengeName,
  startTime,
  endTime,
  initialTotalDistanceM,
  dataEndpoint,
  refreshIntervalMs,
}: PublicLiveScreenProps) {
  const [targetDistanceM, setTargetDistanceM] = useState(initialTotalDistanceM);
  const [displayedDistanceM, setDisplayedDistanceM] = useState(initialTotalDistanceM);
  const [updatedAtLabel, setUpdatedAtLabel] = useState(formatClock(new Date()));
  const [currentTimeLabel, setCurrentTimeLabel] = useState(formatClock(new Date()));

  const displayedDistanceRef = useRef(initialTotalDistanceM);

  useEffect(() => {
    displayedDistanceRef.current = displayedDistanceM;
  }, [displayedDistanceM]);

  useEffect(() => {
    let animationFrameId = 0;
    const startValue = displayedDistanceRef.current;
    const distanceDelta = targetDistanceM - startValue;

    if (distanceDelta <= 0) {
      setDisplayedDistanceM(targetDistanceM);
      return;
    }

    const durationMs = Math.min(
      MAX_ANIMATION_DURATION_MS,
      Math.max(MIN_ANIMATION_DURATION_MS, (distanceDelta / METERS_PER_SECOND) * 1000),
    );

    const animationStartedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - animationStartedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const nextValue = Math.round(startValue + distanceDelta * easedProgress);
      setDisplayedDistanceM(nextValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [targetDistanceM]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimeLabel(formatClock(new Date()));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const fetchLatestDistance = async () => {
      try {
        const response = await fetch(dataEndpoint, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as PublicDataPayload;
        if (isCancelled) return;

        setTargetDistanceM((current) => Math.max(current, payload.totalDistanceM));
        setUpdatedAtLabel(formatClock(new Date(payload.updatedAt)));
      } catch {
        // Keep previous values for robustness on transient errors.
      }
    };

    fetchLatestDistance();
    const intervalId = window.setInterval(fetchLatestDistance, refreshIntervalMs);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [dataEndpoint, refreshIntervalMs]);

  const centerDistanceLabel = useMemo(() => formatKilometers(displayedDistanceM), [displayedDistanceM]);

  return (
    <div className="fixed inset-0 flex min-h-screen flex-col bg-black text-white">
      <header className="px-10 pt-8 text-center">
        <p className="text-4xl font-semibold tracking-wide">{challengeName}</p>
        <p className="mt-3 text-2xl text-slate-300">
          Début {startTime} · Fin {endTime ?? "--:--"} · Maintenant {currentTimeLabel}
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-[16vw] font-black leading-none tracking-tight text-cyan-300">{centerDistanceLabel}</p>
          <p className="mt-6 text-5xl font-semibold uppercase tracking-[0.4em] text-slate-200">km</p>
        </div>
      </main>

      <footer className="px-10 pb-6 text-center text-lg text-slate-400">Dernière mise à jour : {updatedAtLabel}</footer>
    </div>
  );
}
