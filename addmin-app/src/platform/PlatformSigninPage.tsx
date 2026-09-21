import { useState } from "react";
import { platformApiUrl } from "./apiBase";

// Deliberately not built on Wasp's <LoginForm>/useAuth -- PlatformOperator
// isn't a Wasp auth user at all (see src/server/platform/platformAuth.ts).
// This posts straight to the raw /platform/login api route.
export function PlatformSigninPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(platformApiUrl("/platform/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Login failed.");
      }
      window.location.href = "/platform/organizations";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex justify-center">
      <div className="card mt-32 h-fit w-full max-w-md px-8 py-10">
        <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
          Platform Operator sign in
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          AddMin-internal only. This is a separate login from the customer
          app.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="MFA code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary-500 px-4 py-2 font-semibold text-white hover:bg-primary-600"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
