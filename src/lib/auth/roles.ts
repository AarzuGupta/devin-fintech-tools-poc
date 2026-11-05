export const ROLES = ["VIEWER", "ANALYST", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  VIEWER: "Viewer",
  ANALYST: "Analyst",
  ADMIN: "Admin",
};

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
}
