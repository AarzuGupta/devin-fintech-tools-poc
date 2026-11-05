"use client";

import { Spinner } from "@fluentui/react-components";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid flex-1 place-items-center">
      <Spinner size="small" label={label} />
    </div>
  );
}
