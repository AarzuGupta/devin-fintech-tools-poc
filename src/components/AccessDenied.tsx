export function AccessDenied({ message }: { message: string }) {
  return (
    <div role="alert" className="m-6 max-w-xl rounded-xl border border-stroke bg-surface p-6 shadow-card">
      <h2 className="text-[15px] font-semibold">Access denied</h2>
      <p className="mt-1 text-fg-muted">{message}</p>
    </div>
  );
}
