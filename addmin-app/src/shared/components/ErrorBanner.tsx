// A query that 403s (e.g. MFA not yet enrolled, office out of scope) used to
// fail silently -- the page just looked stuck/blank with no indication why.
// Every list/detail page built on useQuery renders this so failures are visible.
export function ErrorBanner({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error.message || "Something went wrong loading this page."}
    </div>
  );
}
