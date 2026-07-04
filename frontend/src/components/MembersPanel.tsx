import { FormEvent, useState } from "react";
import { canManageMembers } from "../api/permissions";
import { api } from "../api/client";
import { BoardMember, BoardRole, EffectiveRole } from "../api/types";

interface Props {
  boardId: string;
  myRole: EffectiveRole | null;
  members: BoardMember[];
  onMemberAdded: (member: BoardMember) => void;
  onMemberRemoved: (userId: string) => void;
  onMemberUpdated: (member: BoardMember) => void;
}

const roleLabels: Record<BoardRole, string> = {
  ADMIN: "Админ",
  EDITOR: "Редактор",
  VIEWER: "Наблюдатель",
};

export function MembersPanel({
  boardId,
  myRole,
  members,
  onMemberAdded,
  onMemberRemoved,
  onMemberUpdated,
}: Props) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<BoardRole>("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const manageAllowed = canManageMembers(myRole);
  const isOwnerView = myRole === "OWNER";

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    try {
      const { data } = await api.post<BoardMember>(`/boards/${boardId}/members`, {
        email,
        role: inviteRole,
      });
      onMemberAdded(data);
      setEmail("");
    } catch {
      setError("Не удалось пригласить: пользователь не найден, уже участник, или роль недоступна");
    }
  }

  async function handleRemove(userId: string) {
    await api.delete(`/boards/${boardId}/members/${userId}`);
    onMemberRemoved(userId);
  }

  async function handleRoleChange(userId: string, role: BoardRole) {
    const { data } = await api.patch<BoardMember>(`/boards/${boardId}/members/${userId}`, { role });
    onMemberUpdated(data);
  }

  return (
    <div className="members-panel">
      <h4>Участники</h4>
      <div className="members-list">
        {members.map((m) => (
          <span key={m.id} className="member-chip">
            {m.user.name}
            {manageAllowed ? (
              <select
                value={m.role}
                onChange={(e) => handleRoleChange(m.user.id, e.target.value as BoardRole)}
                disabled={m.role === "ADMIN" && !isOwnerView}
              >
                <option value="ADMIN" disabled={!isOwnerView}>
                  Админ
                </option>
                <option value="EDITOR">Редактор</option>
                <option value="VIEWER">Наблюдатель</option>
              </select>
            ) : (
              <span className="member-role">{roleLabels[m.role]}</span>
            )}
            {manageAllowed && (
              <button onClick={() => handleRemove(m.user.id)} title="Удалить участника">
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {manageAllowed && (
        <form onSubmit={handleInvite} className="invite-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email участника"
          />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as BoardRole)}>
            <option value="ADMIN" disabled={!isOwnerView}>
              Админ
            </option>
            <option value="EDITOR">Редактор</option>
            <option value="VIEWER">Наблюдатель</option>
          </select>
          <button type="submit">Пригласить</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
