"use client";

import { Button } from "@fluentui/react-components";
import { useTransition } from "react";
import { switchDemoUser } from "@/app/actions/session";

export function DemoSignInButton({ userId, name }: { userId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      appearance="primary"
      size="small"
      disabled={isPending}
      aria-label={`Continue as ${name}`}
      onClick={() => {
        const form = new FormData();
        form.set("userId", userId);
        startTransition(() => switchDemoUser(form));
      }}
    >
      Continue
    </Button>
  );
}
