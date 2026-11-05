"use client";

import { ClipboardTaskListLtr20Regular, History20Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/kyc", label: "KYC review", icon: ClipboardTaskListLtr20Regular, adminOnly: false },
  { href: "/audit", label: "Audit log", icon: History20Regular, adminOnly: true },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {ITEMS.filter((item) => isAdmin || !item.adminOnly).map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                active ? "bg-black/[0.06] font-medium text-fg" : "text-fg hover:bg-black/[0.04]"
              }`}
            >
              <Icon className={`shrink-0 ${active ? "text-brand" : "text-fg-muted"}`} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
