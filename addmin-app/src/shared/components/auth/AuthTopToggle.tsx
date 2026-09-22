import { ButtonLink } from "../Button";

// Sign in / Sign up segmented pill shown top-right on the login and signup
// screens only (Login Flow.dc.html panels 1-2) -- every other auth screen
// has just the lone logo badge.
export function AuthTopToggle({ active }: { active: "signin" | "signup" }) {
  return (
    <div className="relative z-10 flex items-center gap-2 rounded-md bg-white/90 p-1 shadow-xs">
      <ButtonLink to="/login" size="sm" variant={active === "signin" ? "primary" : "ghost"}>
        Sign in
      </ButtonLink>
      <ButtonLink to="/signup" size="sm" variant={active === "signup" ? "primary" : "ghost"}>
        Sign up
      </ButtonLink>
    </div>
  );
}
