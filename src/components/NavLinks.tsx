"use client";

import { ClipboardTaskListLtr20Regular, Flag20Regular, History20Regular, ReceiptMoney20Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { title: "Compliance", items: [{ href: "/kyc", label: "KYC review", icon: ClipboardTaskListLtr20Regular, adminOnly: false }] },
  { title: "Finance operations", items: [{ href: "/refunds", label: "Refunds", icon: ReceiptMoney20Regular, adminOnly: false }] },
  { title: "Administration", items: [{ href: "/audit", label: "Audit log", icon: History20Regular, adminOnly: true }] },
];

const linkBase = "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px]";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const items = section.items.filter((item) => isAdmin || !item.adminOnly);
        if (!items.length) return null;
        return (
          <div key={section.title}>
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">{section.title}</p>
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`${linkBase} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
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
          </div>
        );
      })}
      <div>
        <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Planned</p>
        <div className={`${linkBase} whitespace-nowrap text-fg-subtle`} aria-disabled="true" title="Not built yet">
          <Flag20Regular className="shrink-0" />
          Feature flags
          <span className="ml-auto rounded-[5px] bg-[#f0f0f2] px-1.5 text-[11px] leading-[18px]">Soon</span>
        </div>
      </div>
    </div>
  );
}
