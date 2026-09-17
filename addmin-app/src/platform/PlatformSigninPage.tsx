import { useState } from "react";

// Deliberately not built on Wasp's <LoginForm>/useAuth -- PlatformOperator
// isn't a Wasp auth user at all (see src/server/platform/platformAuth.ts).
// This posts straight to the raw /platform/login api route.
export function PlatformSigninPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Login failed.");
      }
      const body = await res.json();
      // /platform/organizations (the actual console) doesn't exist until a
      // later build step -- confirming the session here instead of a 404 redirect.
      setSignedInAs(body.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (signedInAs) {
    return (
      <div className="flex justify-center">
        <div className="card mt-32 h-fit w-full max-w-md px-8 py-10">
          <p className="text-neutral-900">
            Signed in as <strong>{signedInAs}</strong>. The Platform Ops
            Console (org list, etc.) is built in a later build step.
          </p>
        </div>
      </div>
    );
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
