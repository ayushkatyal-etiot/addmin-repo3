import { useState } from "react";
import { useQuery, listOrgUsers, listOffices, inviteUser, updateUserOffice, updateUserManager } from "wasp/client/operations";
import { Button } from "../../shared/components/Button";
import { ErrorBanner } from "../../shared/components/ErrorBanner";
import { sentenceCase } from "../../shared/text";

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
type OrgUser = { id: string; email: string | null; role: string | null; office_scope: unknown; manager_user_id: string | null };

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
        <div key={o.id} className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={o.id in value} onChange={() => toggle(o.id)} />
            {o.name}
          </label>
          {o.id in value && (
            <select
              className="select-field w-45"
              value={value[o.id]}
              onChange={(e) => setRoleFor(o.id, e.target.value)}
            >
              {ROLES.filter((r) => r !== "platform_admin").map((r) => (
                <option key={r} value={r}>
                  {sentenceCase(r)}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

// Users.dc.html's "Offices & roles" edit surface -- a modal instead of the
// old always-open inline picker per row, so a long office list doesn't
// balloon every row's height. Edits are a local draft; only "Save" calls
// updateUserOffice, "Cancel"/backdrop-click discards.
function ManageOfficesDialog({
  user,
  offices,
  onClose,
  onSaved,
}: {
  user: OrgUser;
  offices: Office[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}) {
  const initial = Object.fromEntries(
    Object.entries((user.office_scope ?? {}) as Record<string, string[]>).map(([officeId, roles]) => [
      officeId,
      roles[0],
    ]),
  );
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setIsSaving(true);
    setError(null);
    try {
      await updateUserOffice({ userId: user.id, officeRoles: draft });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update offices.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/48"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-105 max-w-[90vw] flex-col gap-4 overflow-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-lg font-semibold text-neutral-900">Offices &amp; roles</div>
          <div className="text-sm text-neutral-600">{user.email}</div>
        </div>

        <OfficeRolePicker offices={offices} value={draft} onChange={setDraft} defaultRole={user.role ?? ROLES[0]} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
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
  const [managingUserId, setManagingUserId] = useState<string | null>(null);

  const requiresOffice = role !== "platform_admin";
  const [rowError, setRowError] = useState<string | null>(null);

  // F-16: who approves this user's asset requests -- see createAssetRequest
  // (src/server/asset/asset.ts). "" in the select means "no manager".
  async function onManagerChange(userId: string, managerUserId: string) {
    setRowError(null);
    try {
      await updateUserManager({ userId, managerUserId: managerUserId || null });
      await refetch();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not update manager.");
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

  const managingUser = (users ?? []).find((u) => u.id === managingUserId) ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Users</h1>
      <ErrorBanner error={loadError} />

      <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-6">
        <h2 className="text-base font-semibold text-neutral-900">Invite a teammate</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className={inputClass}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Default role</label>
            <select
              className="select-field"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                if (e.target.value === "platform_admin") setOfficeRoles({});
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {sentenceCase(r)}
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
        {success && <p className="text-sm text-primary-600">{success}</p>}

        <div>
          <Button
            type="submit"
            disabled={isSubmitting || !email || (requiresOffice && Object.keys(officeRoles).length === 0)}
          >
            Send invite
          </Button>
        </div>
      </form>

      {rowError && <p className="text-sm text-red-600">{rowError}</p>}

      <table className="table-shell">
        <thead>
          <tr>
            <th className="table-head-cell">Email</th>
            <th className="table-head-cell">Role</th>
            <th className="table-head-cell">Offices &amp; roles</th>
            <th className="table-head-cell">Manager</th>
            <th className="table-head-cell" />
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u) => {
            const officeIds = Object.keys((u.office_scope ?? {}) as Record<string, string[]>);
            const officeSummary =
              officeIds.length === 0
                ? "No offices"
                : officeIds
                    .map((id) => offices?.find((o) => o.id === id)?.name)
                    .filter(Boolean)
                    .join(", ");
            const isPlatformAdmin = u.role === "platform_admin";

            return (
              <tr key={u.id} className="table-row-hover">
                <td className="table-cell font-bold text-neutral-900">{u.email}</td>
                <td className="table-cell text-neutral-600">{sentenceCase(u.role ?? "")}</td>
                <td className="table-cell">
                  <span className="text-neutral-600">{isPlatformAdmin ? "All offices" : officeSummary}</span>
                </td>
                <td className="table-cell">
                  <select
                    className="select-field"
                    value={u.manager_user_id ?? ""}
                    onChange={(e) => onManagerChange(u.id, e.target.value)}
                  >
                    <option value="">No manager</option>
                    {(users ?? [])
                      .filter((m) => m.id !== u.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.email}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="table-cell text-right">
                  {!isPlatformAdmin && (
                    <Button variant="secondary" size="sm" onClick={() => setManagingUserId(u.id)}>
                      Manage offices
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {managingUser && (
        <ManageOfficesDialog
          user={managingUser}
          offices={offices ?? []}
          onClose={() => setManagingUserId(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
