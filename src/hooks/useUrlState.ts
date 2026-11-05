"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

/** Read/write URL search params so table state is shareable and server-rendered. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const paramsKey = params.toString();
  // Query requested but not yet committed; rapid successive updates build on it
  // so e.g. a row click right after a filter change does not drop the filter.
  const pendingQuery = useRef<string | null>(null);

  useEffect(() => {
    pendingQuery.current = null;
  }, [paramsKey]);

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(pendingQuery.current ?? paramsKey);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      pendingQuery.current = qs;
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [paramsKey, pathname, router],
  );

  return { params, setParams, isPending };
}
