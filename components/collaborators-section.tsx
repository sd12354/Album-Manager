"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VinylSpinner } from "@/components/vinyl-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CollectionRole } from "@/types";

interface MemberRow {
  id: string;
  member_id: string;
  member_email: string | null;
  role: CollectionRole;
}

interface InviteRow {
  id: string;
  email: string;
  role: CollectionRole;
}

interface SharedRow {
  id: string;
  owner_id: string;
  owner_email: string | null;
  role: CollectionRole;
}

export function CollaboratorsSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollectionRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/collection/members");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error ?? "Could not load collaborators.");
        setMembers([]);
        setInvites([]);
        setSharedWithMe([]);
        return;
      }
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
      setSharedWithMe(data.sharedWithMe ?? []);
    } catch {
      setLoadError("Network error loading collaborators.");
      setMembers([]);
      setInvites([]);
      setSharedWithMe([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email address.");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/collection/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not send invite");
        return;
      }
      toast.success(
        data.status === "added"
          ? `${trimmed} now has access`
          : `Invite recorded — ${trimmed} gets access when they sign in`
      );
      setEmail("");
      setRole("viewer");
      await load();
    } catch {
      toast.error("Network error sending invite");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, nextRole: CollectionRole) {
    setBusyId(memberId);
    try {
      const res = await fetch("/api/collection/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: nextRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not update role");
        return;
      }
      toast.success("Role updated");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function transferOwnership(
    newOwnerId: string,
    newOwnerEmail: string | null
  ) {
    const recipient = newOwnerEmail ?? newOwnerId;
    const message =
      `Transfer this entire collection to ${recipient}?\n\n` +
      `• Every album you own will move to their account.\n` +
      `• You will be downgraded to an Editor on the now-shared collection — you can still edit, just not invite collaborators or create marketplace listings.\n` +
      `• Any active eBay/Discogs listings stay on YOUR marketplace accounts. The new owner will need to connect their own marketplace credentials to manage future listings.\n` +
      `• This action is permanent. The new owner would have to transfer it back to undo.\n\n` +
      `Continue?`;
    if (typeof window === "undefined" || !window.confirm(message)) return;

    setBusyId(newOwnerId);
    try {
      const res = await fetch("/api/collection/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Transfer failed", { duration: 8000 });
        return;
      }
      toast.success(
        `Collection transferred to ${recipient}. You're now an editor of the shared collection.`,
        { duration: 8000 }
      );
      await load();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(body: Record<string, string>, id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/collection/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Action failed");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <VinylSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Invite people to view or help manage your collection. Editors can add,
          edit, price, and photograph albums; viewers have read-only access.
          Marketplace listing and shipping stay with you as the owner.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm">
          <p className="font-medium text-red-300">Could not load collaborators</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Try again
          </Button>
        </div>
      )}

      {/* Invite form */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <Label className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-accent" />
          Invite a collaborator
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="person@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Select
            value={role}
            onValueChange={(v) => setRole(v as CollectionRole)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={inviting}>
            {inviting ? <VinylSpinner size="xs" /> : "Invite"}
          </Button>
        </div>
      </div>

      {/* People with access */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          People with access
        </Label>
        {members.length === 0 && invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collaborators yet. Invite someone above.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-medium uppercase">
                  {(m.member_email ?? "?").slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {m.member_email ?? m.member_id}
                </span>
                <Select
                  value={m.role}
                  onValueChange={(v) => changeRole(m.member_id, v as CollectionRole)}
                >
                  <SelectTrigger className="w-[120px]" disabled={busyId === m.member_id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => transferOwnership(m.member_id, m.member_email)}
                  disabled={busyId === m.member_id}
                  title="Transfer collection ownership to this collaborator"
                  className="text-muted-foreground transition-colors hover:text-amber-400 disabled:opacity-40"
                >
                  <Crown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => revoke({ memberId: m.member_id }, m.member_id)}
                  disabled={busyId === m.member_id}
                  title="Remove access"
                  className="text-muted-foreground transition-colors hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {inv.email}
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Pending · {inv.role}
                  </span>
                </span>
                <button
                  onClick={() => revoke({ inviteId: inv.id }, inv.id)}
                  disabled={busyId === inv.id}
                  title="Cancel invite"
                  className="text-muted-foreground transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collections shared with me */}
      {sharedWithMe.length > 0 && (
        <div className="space-y-2">
          <Label>Collections shared with you</Label>
          <div className="divide-y divide-border rounded-lg border border-border">
            {sharedWithMe.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {s.owner_email ?? s.owner_id}
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.role}
                  </span>
                </span>
                <button
                  onClick={() => revoke({ leaveOwnerId: s.owner_id }, s.id)}
                  disabled={busyId === s.id}
                  className="text-xs text-muted-foreground transition-colors hover:text-red-400"
                >
                  Leave
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
