// A query that 403s (e.g. MFA not yet enrolled, office out of scope) used to
// fail silently -- the page just looked stuck/blank with no indication why.
// Every list/detail page built on useQuery renders this so failures are visible.
function formatErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Something went wrong loading this page.";
}

export function ErrorBanner({ error }: { error: unknown }) {
  const message = formatErrorMessage(error);
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
