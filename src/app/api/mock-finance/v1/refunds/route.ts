import { handleListRefunds } from "@/lib/integrations/refundsApi/mockServer";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handleListRefunds(req);
}
