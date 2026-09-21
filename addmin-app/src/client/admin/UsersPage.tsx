import { useState } from "react";
import { useQuery, listOrgUsers, listOffices, inviteUser, updateUserOffice } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";

const ROLES = [
  "platform_admin",
  "office_admin",
  "checker",
  "payment_authorizer",
  "vendor_manager",
  "compliance_coordinator",
  "facility_staff",
  "office_head",
  "employee",
];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-800 shadow-xs focus:border-primary-500 focus:outline-hidden focus:ring-1 focus:ring-primary-500";

type Office = { id: string; name: string };

// Checkbox per office, with an inline role select that appears once that
// office is checked -- lets a user be, say, office_admin at one site and
// checker at another, instead of one role applied uniformly everywhere.
function OfficeRolePicker({
  offices,
  value,
  onChange,
  defaultRole,
}: {
  offices: Office[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  defaultRole: string;
}) {
  function toggle(officeId: string) {
    const next = { ...value };
    if (officeId in next) {
      delete next[officeId];
    } else {
      next[officeId] = defaultRole;
    }
    onChange(next);
  }

  function setRoleFor(officeId: string, role: string) {
    onChange({ ...value, [officeId]: role });
  }

  return (
    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border border-neutral-300 p-3">
      {offices.map((o) => (
        <div key={o.id} className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={o.id in value} onChange={() => toggle(o.id)} />
            {o.name}
          </label>
          {o.id in value && (
            <select
              className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
              value={value[o.id]}
              onChange={(e) => setRoleFor(o.id, e.target.value)}
            >
              {ROLES.filter((r) => r !== "platform_admin").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

// F-02: the only way a second (or Nth) user ever joins an org --
// src/server/admin/invites.ts creates an Invite and emails a signup link;
// this page is just the platform_admin-facing form for that action, which
// existed unused since Build Step 03.
export function UsersPage() {
  const { data: users, isLoading, error: loadError, refetch } = useQuery(listOrgUsers);
  const { data: offices } = useQuery(listOffices);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [officeRoles, setOfficeRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiresOffice = role !== "platform_admin";
  const [rowError, setRowError] = useState<string | null>(null);

  async function onOfficeChange(userId: string, newOfficeRoles: Record<string, string>) {
    setRowError(null);
    try {
      await updateUserOffice({ userId, officeRoles: newOfficeRoles });
      await refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not update office.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await inviteUser({ email, role, officeRoles: Object.keys(officeRoles).length > 0 ? officeRoles : undefined });
      setSuccess(`Invite sent to ${email}.`);
      setEmail("");
      setOfficeRoles({});
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="mx-auto w-full max-w-4xl p-12">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Users</h1>

      <ErrorBanner error={loadError} />

      <form onSubmit={onSubmit} className="card mb-8 flex flex-col gap-4 p-8">
        <h2 className="text-lg font-semibold text-neutral-900">Invite a teammate</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Default role</label>
            <select
              className={inputClass}
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (e.target.value === "platform_admin") setOfficeRoles({});
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {requiresOffice && (
            <div className="col-span-2">
              <label className="label">Offices &amp; role per office</label>
              <OfficeRolePicker
                offices={offices ?? []}
                value={officeRoles}
                onChange={setOfficeRoles}
                defaultRole={role}
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <Button
          type="submit"
          disabled={isSubmitting || !email || (requiresOffice && Object.keys(officeRoles).length === 0)}
          className="self-start"
        >
          Send invite
        </Button>
      </form>

      {rowError && <p className="mb-2 text-sm text-red-600">{rowError}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Offices &amp; roles</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const currentOfficeRoles = Object.fromEntries(
                Object.entries(u.office_scope ?? {}).map(([officeId, roles]) => [officeId, roles[0]]),
              );
              return (
                <tr key={u.id} className="border-t border-neutral-100 align-top">
                  <td className="px-4 py-3 text-neutral-900">{u.email}</td>
                  <td className="px-4 py-3 text-neutral-600">{u.role}</td>
                  <td className="px-4 py-3">
                    {u.role === "platform_admin" ? (
                      <span className="text-neutral-400">All offices</span>
                    ) : (
                      <OfficeRolePicker
                        offices={offices ?? []}
                        value={currentOfficeRoles}
                        onChange={(next) => onOfficeChange(u.id, next)}
                        defaultRole={u.role ?? ROLES[0]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
