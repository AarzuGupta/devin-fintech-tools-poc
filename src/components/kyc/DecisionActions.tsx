"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  MessageBar,
  MessageBarBody,
  Spinner,
  Textarea,
  Toast,
  ToastTitle,
  useToastController,
} from "@fluentui/react-components";
import { ArrowUp20Regular, Checkmark20Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideCaseAction } from "@/app/actions/kyc";
import { TOASTER_ID } from "@/components/Providers";
import { MIN_REASON_LENGTH, reasonRequired, type Decision } from "@/lib/domain/kyc";
import { STATUS_LABELS } from "@/lib/format";

const META: Record<Decision, { label: string; verb: string; icon: React.ReactElement; result: string }> = {
  APPROVE: { label: "Approve", verb: "approve", icon: <Checkmark20Regular />, result: "approved" },
  REJECT: { label: "Reject", verb: "reject", icon: <Dismiss20Regular />, result: "rejected" },
  ESCALATE: { label: "Escalate", verb: "escalate", icon: <ArrowUp20Regular />, result: "escalated" },
};

interface DecisionActionsProps {
  caseId: string;
  status: string;
  decisions: Decision[];
  readOnlyReason: string | null;
}

export function DecisionActions({ caseId, status, decisions, readOnlyReason }: DecisionActionsProps) {
  const router = useRouter();
  const { dispatchToast } = useToastController(TOASTER_ID);
  const [active, setActive] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (decisions.length === 0) {
    return (
      <p className="rounded-[10px] bg-canvas px-3 py-2.5 text-fg-muted" data-testid="decision-readonly">
        {readOnlyReason}
      </p>
    );
  }

  const open = (decision: Decision) => {
    setActive(decision);
    setReason("");
    setError(null);
  };

  const required = active ? reasonRequired(active) : false;
  const trimmed = reason.trim();
  const tooShort = required && trimmed.length < MIN_REASON_LENGTH;

  const confirm = () => {
    if (!active || tooShort) return;
    startTransition(async () => {
      const result = await decideCaseAction({ caseId, decision: active, reason: trimmed || null, expectedStatus: status });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setActive(null);
      dispatchToast(
        <Toast>
          <ToastTitle>
            {caseId} {META[result.data.status === "ESCALATED" ? "ESCALATE" : active].result}
          </ToastTitle>
        </Toast>,
        { intent: "success" },
      );
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => (
          <Button key={d} appearance={d === "APPROVE" ? "primary" : "secondary"} icon={META[d].icon} onClick={() => open(d)}>
            {META[d].label}
          </Button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(_, data) => !data.open && !isPending && setActive(null)} modalType="alert">
        <DialogSurface aria-describedby={undefined}>
          {active && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              <DialogBody>
                <DialogTitle>
                  {META[active].label} case {caseId}?
                </DialogTitle>
                <DialogContent className="space-y-3">
                  <p className="text-fg-muted">
                    Status will change from <strong>{STATUS_LABELS[status]}</strong> to{" "}
                    <strong>{STATUS_LABELS[META[active].result.toUpperCase()]}</strong>.
                    {active !== "ESCALATE" && " This decision is final and cannot be undone."}
                  </p>
                  <Field
                    label={required ? "Reason" : "Note (optional)"}
                    required={required}
                    validationState={error ? "error" : "none"}
                    hint={required ? `At least ${MIN_REASON_LENGTH} characters. Recorded in the audit trail.` : "Recorded in the audit trail."}
                  >
                    <Textarea
                      value={reason}
                      onChange={(_, d) => setReason(d.value)}
                      resize="vertical"
                      rows={4}
                      maxLength={1000}
                      placeholder={required ? `Explain why you are choosing to ${META[active].verb} this case` : ""}
                    />
                  </Field>
                  {error && (
                    <MessageBar intent="error">
                      <MessageBarBody>{error}</MessageBarBody>
                    </MessageBar>
                  )}
                </DialogContent>
                <DialogActions>
                  <Button appearance="secondary" disabled={isPending} onClick={() => setActive(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    appearance="primary"
                    disabled={isPending || tooShort}
                    icon={isPending ? <Spinner size="tiny" /> : undefined}
                  >
                    Confirm {META[active].label.toLowerCase()}
                  </Button>
                </DialogActions>
              </DialogBody>
            </form>
          )}
        </DialogSurface>
      </Dialog>
    </>
  );
}
