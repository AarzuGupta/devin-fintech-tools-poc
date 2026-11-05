"use client";

import {
  Button,
  Menu,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  MenuItemRadio,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from "@fluentui/react-components";
import { PersonSwap20Regular, SignOut20Regular } from "@fluentui/react-icons";
import { useTransition } from "react";
import { signOut, switchDemoUser } from "@/app/actions/session";
import { RoleBadge } from "./Badges";

interface DemoUser {
  id: string;
  name: string;
  role: string;
}

export function DemoIdentitySwitcher({ current, users }: { current: DemoUser; users: DemoUser[] }) {
  const [isPending, startTransition] = useTransition();

  const switchTo = (userId: string) => {
    const form = new FormData();
    form.set("userId", userId);
    startTransition(() => switchDemoUser(form));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden rounded-full border border-[#f2dcb0] bg-[#fdf6ea] px-2.5 py-0.5 text-[12px] text-[#8a4b00] md:inline">
        Demo impersonation · not real authentication
      </span>
      <Menu
        checkedValues={{ user: [current.id] }}
        onCheckedValueChange={(_, data) => data.checkedItems[0] && switchTo(data.checkedItems[0])}
      >
        <MenuTrigger disableButtonEnhancement>
          <Button appearance="subtle" icon={<PersonSwap20Regular />} disabled={isPending} aria-label={`Demo identity: ${current.name}, ${current.role}. Switch identity`}>
            <span className="flex items-center gap-2">
              <span>{current.name}</span>
              <RoleBadge role={current.role} />
            </span>
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuGroup>
              <MenuGroupHeader>Switch demo identity (impersonation)</MenuGroupHeader>
              {users.map((user) => (
                <MenuItemRadio key={user.id} name="user" value={user.id} secondaryContent={user.role.toLowerCase()}>
                  {user.name}
                </MenuItemRadio>
              ))}
            </MenuGroup>
            <MenuDivider />
            <MenuItem icon={<SignOut20Regular />} onClick={() => startTransition(() => signOut())}>
              Sign out
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
