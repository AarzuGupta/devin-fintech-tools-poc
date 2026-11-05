export interface CaseRow {
  id: string;
  customerId: string;
  customerName: string;
  customerType: string;
  riskTier: string;
  reviewReason: string;
  status: string;
  assignedReviewer: string | null;
  createdAt: string;
  reviewDeadline: string;
  overdue: boolean;
}
