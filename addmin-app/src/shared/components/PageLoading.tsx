export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return <p className="p-12 text-center text-neutral-500">{label}</p>;
}
