import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { BoardMember } from "../api/types";

interface Props {
  boardId: string;
  ownerId: string;
  currentUserId: string;
  members: BoardMember[];
  onMemberAdded: (member: BoardMember) => void;
  onMemberRemoved: (userId: string) => void;
}

export function MembersPanel({
  boardId,
  ownerId,
  currentUserId,
  members,
  onMemberAdded,
  onMemberRemoved,
}: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isOwner = ownerId === currentUserId;

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    try {
      const { data } = await api.post<BoardMember>(`/boards/${boardId}/members`, { email });
      onMemberAdded(data);
      setEmail("");
    } catch {
      setError("Не удалось пригласить: пользователь не найден или уже участник");
    }
  }

  async function handleRemove(userId: string) {
    await api.delete(`/boards/${boardId}/members/${userId}`);
    onMemberRemoved(userId);
  }

  return (
    <div className="members-panel">
      <h4>Участники</h4>
      <div className="members-list">
        {members.map((m) => (
          <span key={m.id} className="member-chip">
            {m.user.name}
            {isOwner && (
              <button onClick={() => handleRemove(m.user.id)} title="Удалить участника">
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {isOwner && (
        <form onSubmit={handleInvite} className="invite-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email участника"
          />
          <button type="submit">Пригласить</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
