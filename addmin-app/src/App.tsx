import { Outlet } from "react-router";
import "./App.css";
import { useAuth } from "wasp/client/auth";
import { Link } from "wasp/client/router";
import Logo from "./assets/addmin-logo.png";
import { ButtonLink } from "./shared/components/Button";
import { Sidebar } from "./shared/components/Sidebar";
import { MfaGate } from "./shared/components/MfaGate";

// Logged-out routes (marketing/auth pages) keep a slim top bar -- there's no
// nav to show yet. Once signed in, the left Sidebar takes over and the rest
// of the viewport is the scrollable content area.
function PublicTopBar() {
  return (
    <header className="flex justify-center border-b border-neutral-200 bg-white shadow-sm">
      <div className="flex w-full max-w-(--breakpoint-lg) items-center justify-between p-4 px-12">
        <Link to="/" className="flex items-center gap-2">
          <img src={Logo} alt="AddMin" className="h-16 w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <ButtonLink to="/signup">Sign up</ButtonLink>
          <ButtonLink to="/login" variant="ghost">
            Login
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

export function App() {
  const { data: user } = useAuth();

  if (!user) {
    return (
      <main className="flex min-h-screen w-full flex-col bg-neutral-50 text-neutral-800">
        <PublicTopBar />
        <MfaGate>
          <Outlet />
        </MfaGate>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-full bg-neutral-50 text-neutral-800">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MfaGate>
          <Outlet />
        </MfaGate>
      </div>
    </main>
  );
}
