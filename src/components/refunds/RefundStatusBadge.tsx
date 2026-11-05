import { ToneBadge } from "@/components/Badges";
import type { RefundStatus } from "@/lib/domain/refunds";
import { REFUND_STATUS_LABELS, REFUND_STATUS_TONES } from "./labels";

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return <ToneBadge tone={REFUND_STATUS_TONES[status]} label={REFUND_STATUS_LABELS[status]} />;
}
