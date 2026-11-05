"use client";

import { Dismiss20Regular } from "@fluentui/react-icons";
import Link from "next/link";

export function PanelCloseLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label="Close case details"
      className="grid h-8 w-8 place-items-center rounded hover:bg-stroke-subtle focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Dismiss20Regular />
    </Link>
  );
}
