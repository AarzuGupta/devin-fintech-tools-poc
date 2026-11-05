export function AccessDenied({ message }: { message: string }) {
  return (
    <div role="alert" className="m-6 rounded border border-stroke bg-surface p-6">
      <h2 className="text-base font-semibold">Access denied</h2>
      <p className="mt-1 text-fg-muted">{message}</p>
    </div>
  );
}
