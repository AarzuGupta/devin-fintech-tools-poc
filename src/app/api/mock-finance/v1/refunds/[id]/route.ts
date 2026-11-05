import { handleGetRefund } from "@/lib/integrations/refundsApi/mockServer";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleGetRefund(req, id);
}
