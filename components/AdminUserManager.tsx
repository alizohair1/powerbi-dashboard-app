"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  branch: string | null;
  dashboard_url: string | null;
  created_at: string;
};

export default function AdminUserManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users);
      setError(null);
    } else {
      setError(data.error || "Could not load users");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateUser(id: string, updates: Partial<UserRow>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Update failed");
    }
  }

  async function removeUser(id: string, email: string) {
    if (!confirm(`Remove ${email}? This deletes their account permanently.`))
      return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.error || "Could not remove user");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            People
          </h1>
          <p className="text-sm text-ink/50 mt-0.5">
            {users.length} {users.length === 1 ? "person" : "people"} with
            access
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="clay-btn bg-accent text-white text-sm font-medium px-5 py-2.5 hover:bg-accentDeep transition-colors"
        >
          Add person
        </button>
      </div>

      {error && (
        <p className="text-sm text-warn bg-warn/10 rounded-clay-sm px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink/50">Loading…</p>
      ) : (
        <div className="clay overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50">
                  <th className="px-5 pt-5 pb-3 font-medium">Name</th>
                  <th className="px-5 pt-5 pb-3 font-medium">Email</th>
                  <th className="px-5 pt-5 pb-3 font-medium">Branch</th>
                  <th className="px-5 pt-5 pb-3 font-medium">
                    Dashboard link
                  </th>
                  <th className="px-5 pt-5 pb-3 font-medium">Role</th>
                  <th className="px-5 pt-5 pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRowEditor
                    key={u.id}
                    user={u}
                    onSave={(updates) => updateUser(u.id, updates)}
                    onRemove={() => removeUser(u.id, u.email)}
                  />
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-ink/40"
                    >
                      No one added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}

function UserRowEditor({
  user,
  onSave,
  onRemove,
}: {
  user: UserRow;
  onSave: (updates: Partial<UserRow>) => void;
  onRemove: () => void;
}) {
  const [dashboardUrl, setDashboardUrl] = useState(user.dashboard_url || "");
  const [branch, setBranch] = useState(user.branch || "");
  const [dirty, setDirty] = useState(false);

  return (
    <tr className="align-top">
      <td className="px-5 py-3 text-ink whitespace-nowrap">
        {user.full_name || "—"}
      </td>
      <td className="px-5 py-3 text-ink/70 whitespace-nowrap">
        {user.email}
      </td>
      <td className="px-5 py-3">
        <input
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setDirty(true);
          }}
          className="clay-well w-32 border-0 px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </td>
      <td className="px-5 py-3">
        <input
          value={dashboardUrl}
          onChange={(e) => {
            setDashboardUrl(e.target.value);
            setDirty(true);
          }}
          placeholder="Paste Power BI embed link"
          className="clay-well w-64 border-0 px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </td>
      <td className="px-5 py-3">
        <select
          value={user.role}
          onChange={(e) =>
            onSave({ role: e.target.value as "admin" | "user" })
          }
          className="clay-well border-0 px-3 py-2 text-sm"
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        <div className="flex justify-end gap-2">
          {dirty && (
            <button
              onClick={() => {
                onSave({ dashboard_url: dashboardUrl, branch });
                setDirty(false);
              }}
              className="clay-chip bg-gold/30 px-3 py-1.5 text-xs font-medium text-ink"
            >
              Save
            </button>
          )}
          <button
            onClick={onRemove}
            className="clay-chip bg-warn/10 px-3 py-1.5 text-xs font-medium text-warn"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [branch, setBranch] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        branch,
        dashboard_url: dashboardUrl,
        role,
      }),
    });

    setSaving(false);

    if (res.ok) {
      onCreated();
    } else {
      const data = await res.json();
      setError(data.error || "Could not add person");
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50">
      <div className="clay w-full max-w-md p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-lg font-semibold text-ink mb-5">
          Add person
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="clay-well w-full border-0 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            type="text"
            required
            minLength={6}
            placeholder="Temporary password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="clay-well w-full border-0 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="clay-well w-full border-0 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            type="text"
            placeholder="Branch (optional)"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="clay-well w-full border-0 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            type="text"
            placeholder="Power BI dashboard link (optional, can add later)"
            value={dashboardUrl}
            onChange={(e) => setDashboardUrl(e.target.value)}
            className="clay-well w-full border-0 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="clay-well w-full border-0 px-4 py-2.5 text-sm"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          {error && (
            <p className="text-sm text-warn bg-warn/10 rounded-clay-sm px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="clay-btn flex-1 bg-claySurface text-ink text-sm font-medium py-2.5 hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="clay-btn flex-1 bg-accent text-white text-sm font-medium py-2.5 hover:bg-accentDeep transition-colors disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add person"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
