import { Outlet, useLocation } from "react-router";
import "./App.css";
import { useAuth } from "wasp/client/auth";
import { Sidebar } from "./shared/components/Sidebar";
import { Topbar } from "./shared/components/Topbar";
import { MfaGate } from "./shared/components/MfaGate";
import { SelectedOfficeProvider } from "./shared/SelectedOfficeContext";
import { isAuthScreenPath } from "./shared/authScreenRoutes";

// Auth-screen routes use full-bleed AuthScreen chrome (no Sidebar/Topbar).
// Wizard + platform console routes are auth-screen layout but still need
// SelectedOfficeProvider — mount it only after MfaGate passes so listOffices
// is not called while MFA is pending.
export function App() {
  const { data: user } = useAuth();
  const location = useLocation();
  const authScreen = isAuthScreenPath(location.pathname);

  const outlet = <Outlet />;

  if (!user) {
    return (
      <main className="min-h-screen w-full bg-neutral-50 text-neutral-800">
        <MfaGate>{outlet}</MfaGate>
      </main>
    );
  }

  const authenticatedContent = authScreen ? (
    <main className="min-h-screen w-full bg-neutral-50 text-neutral-800">{outlet}</main>
  ) : (
    <main className="flex min-h-screen w-full bg-neutral-50 text-neutral-800">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="min-h-0 flex-1 overflow-auto">{outlet}</div>
      </div>
    </main>
  );

  return (
    <MfaGate>
      <SelectedOfficeProvider>{authenticatedContent}</SelectedOfficeProvider>
    </MfaGate>
  );
}
