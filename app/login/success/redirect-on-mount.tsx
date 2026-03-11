"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RedirectOnMount() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.push("/");
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
