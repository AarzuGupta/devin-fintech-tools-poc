"use client";

import { Button } from "@fluentui/react-components";
import { ArrowClockwise16Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RetryButton({ label = "Retry" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="small" icon={<ArrowClockwise16Regular />} disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Retrying…" : label}
    </Button>
  );
}
