"use client";

import { Dismiss20Regular } from "@fluentui/react-icons";
import Link from "next/link";

export function PanelCloseLink({ href, label = "Close case details" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:bg-black/[0.05] hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Dismiss20Regular />
    </Link>
  );
}
