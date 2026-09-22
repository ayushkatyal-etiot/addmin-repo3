import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useAuth } from "wasp/client/auth";
import { useQuery, listOffices, getMfaStatus } from "wasp/client/operations";

export const SELECTED_OFFICE_STORAGE_KEY = "addmin.selectedOfficeId";

const MFA_ROUTES = ["/mfa-setup", "/mfa-verify"];

export type OfficeRow = {
  id: string;
  code: string;
  name: string;
  office_type: string;
  ownership_type: string;
  setup_status: string;
  completion_pct: number;
};

type SelectedOfficeContextValue = {
  offices: OfficeRow[] | undefined;
  officeId: string;
  selectedOffice: OfficeRow | undefined;
  isLoading: boolean;
  error: unknown;
  setOfficeId: (id: string) => void;
  hasOffices: boolean;
};

const SelectedOfficeContext = createContext<SelectedOfficeContextValue | null>(null);

/** Safe to call from wizard submit handlers even outside React (writes localStorage). */
export function persistSelectedOfficeId(id: string) {
  if (id) localStorage.setItem(SELECTED_OFFICE_STORAGE_KEY, id);
  else localStorage.removeItem(SELECTED_OFFICE_STORAGE_KEY);
}

export function SelectedOfficeProvider({ children }: { children: ReactNode }) {
  const { data: user } = useAuth();
  const location = useLocation();
  const onMfaRoute = MFA_ROUTES.some((path) => location.pathname.startsWith(path));

  const { data: mfaStatus, isLoading: mfaLoading } = useQuery(getMfaStatus, undefined, {
    enabled: !!user && !onMfaRoute,
  });

  const mfaBlocksOfficeApi =
    !!user &&
    !onMfaRoute &&
    !mfaLoading &&
    !!mfaStatus &&
    ((mfaStatus.mfaRequired && !mfaStatus.mfaEnabled) ||
      (mfaStatus.mfaEnabled && !mfaStatus.mfaVerifiedThisWindow));

  const officesQueryEnabled = !!user && !onMfaRoute && !mfaBlocksOfficeApi;

  const { data: offices, isLoading: officesLoading, error } = useQuery(listOffices, undefined, {
    enabled: officesQueryEnabled,
  });

  const [officeId, setOfficeIdState] = useState(
    () => localStorage.getItem(SELECTED_OFFICE_STORAGE_KEY) ?? "",
  );

  useEffect(() => {
    if (!offices) return;
    if (offices.length === 0) {
      if (officeId) {
        setOfficeIdState("");
        persistSelectedOfficeId("");
      }
      return;
    }
    const stillValid = offices.some((o) => o.id === officeId);
    if (!stillValid) {
      const next = offices[0]!.id;
      setOfficeIdState(next);
      persistSelectedOfficeId(next);
    }
  }, [offices, officeId]);

  function setOfficeId(id: string) {
    setOfficeIdState(id);
    persistSelectedOfficeId(id);
  }

  const selectedOffice = offices?.find((o) => o.id === officeId);
  const effectiveOfficeId = selectedOffice?.id ?? "";

  const isLoading = officesQueryEnabled ? officesLoading : false;

  const value = useMemo(
    (): SelectedOfficeContextValue => ({
      offices,
      officeId: effectiveOfficeId,
      selectedOffice,
      isLoading,
      error: officesQueryEnabled ? error : undefined,
      setOfficeId,
      hasOffices: (offices?.length ?? 0) > 0,
    }),
    [offices, effectiveOfficeId, selectedOffice, isLoading, error, officesQueryEnabled],
  );

  return <SelectedOfficeContext.Provider value={value}>{children}</SelectedOfficeContext.Provider>;
}

export function useSelectedOffice() {
  const ctx = useContext(SelectedOfficeContext);
  if (!ctx) {
    throw new Error("useSelectedOffice must be used within SelectedOfficeProvider (inside MfaGate for logged-in routes).");
  }
  return ctx;
}

export function NoOfficesInScope() {
  return (
    <div className="card p-8 text-center text-neutral-500">
      No offices in your scope. Ask an admin to assign you to an office when inviting you.
    </div>
  );
}
