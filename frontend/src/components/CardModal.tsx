import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { formatFileSize } from "../api/format";
import { encodeMentionToken, MentionableUser } from "../api/mentions";
import { socket } from "../api/socket";
import { Attachment, Card, Comment, Label } from "../api/types";
import { MentionText } from "./MentionText";

interface Props {
  card: Card;
  boardLabels: Label[];
  mentionableUsers: MentionableUser[];
  editable: boolean;
  onClose: () => void;
  onUpdate: (card: Card) => void;
  onDelete: (cardId: string) => void;
}

export function CardModal({
  card,
  boardLabels,
  mentionableUsers,
  editable,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ? card.dueDate.slice(0, 10) : "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Comment[]>("/comments", { params: { cardId: card.id } }).then((res) => setComments(res.data));
  }, [card.id]);

  useEffect(() => {
    api.get<Attachment[]>(`/cards/${card.id}/attachments`).then((res) => setAttachments(res.data));
  }, [card.id]);

  useEffect(() => {
    function onAttachmentCreated(attachment: Attachment) {
      if (attachment.cardId !== card.id) return;
      setAttachments((prev) =>
        prev.some((a) => a.id === attachment.id) ? prev : [...prev, attachment],
      );
    }

    function onAttachmentDeleted({ id, cardId }: { id: string; cardId: string }) {
      if (cardId !== card.id) return;
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    }

    socket.on("attachment:created", onAttachmentCreated);
    socket.on("attachment:deleted", onAttachmentDeleted);
    return () => {
      socket.off("attachment:created", onAttachmentCreated);
      socket.off("attachment:deleted", onAttachmentDeleted);
    };
  }, [card.id]);

  useEffect(() => {
    function onCommentCreated(comment: Comment) {
      if (comment.cardId !== card.id) return;
      setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]));
    }

    function onCommentDeleted({ id, cardId }: { id: string; cardId: string }) {
      if (cardId !== card.id) return;
      setComments((prev) => prev.filter((c) => c.id !== id));
    }

    socket.on("comment:created", onCommentCreated);
    socket.on("comment:deleted", onCommentDeleted);
    return () => {
      socket.off("comment:created", onCommentCreated);
      socket.off("comment:deleted", onCommentDeleted);
    };
  }, [card.id]);

  async function handleSave() {
    if (!editable) return;
    const currentDueDate = card.dueDate ? card.dueDate.slice(0, 10) : "";
    const unchanged =
      title === card.title && description === (card.description ?? "") && dueDate === currentDueDate;
    if (unchanged) return;

    const { data } = await api.patch<Card>(`/cards/${card.id}`, {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    });
    onUpdate(data);
  }

  async function handleDeleteComment(commentId: string) {
    await api.delete(`/comments/${commentId}`);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  function updateAttachmentCount(delta: number) {
    const current = card._count?.attachments ?? attachments.length;
    onUpdate({ ...card, _count: { attachments: current + delta } });
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<Attachment>(`/cards/${card.id}/attachments`, formData);
      setAttachments((prev) => (prev.some((a) => a.id === data.id) ? prev : [...prev, data]));
      updateAttachmentCount(1);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(attachment: Attachment) {
    const response = await api.get(`/attachments/${attachment.id}`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.originalName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAttachment(attachmentId: string) {
    await api.delete(`/attachments/${attachmentId}`);
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    updateAttachmentCount(-1);
  }

  async function handleToggleLabel(label: Label) {
    const hasLabel = card.labels.some((l) => l.id === label.id);
    if (hasLabel) {
      await api.delete(`/labels/${label.id}/cards/${card.id}`);
      onUpdate({ ...card, labels: card.labels.filter((l) => l.id !== label.id) });
    } else {
      await api.post(`/labels/${label.id}/cards/${card.id}`);
      onUpdate({ ...card, labels: [...card.labels, label] });
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { data } = await api.post<Comment>("/comments", { cardId: card.id, text: newComment });
    setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
    setNewComment("");
    setMentionQuery(null);
  }

  function handleCommentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setNewComment(value);
    const cursor = e.target.selectionStart ?? value.length;
    const match = value.slice(0, cursor).match(/@([A-Za-z0-9]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  const mentionSuggestions =
    mentionQuery !== null
      ? mentionableUsers
          .filter((u) => u.name.toLowerCase().replace(/\s+/g, "").startsWith(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : [];

  function handleSelectMention(user: MentionableUser) {
    const input = commentInputRef.current;
    const cursor = input?.selectionStart ?? newComment.length;
    const before = newComment.slice(0, cursor).replace(/@([A-Za-z0-9]*)$/, `@${encodeMentionToken(user.name)} `);
    const newValue = before + newComment.slice(cursor);
    setNewComment(newValue);
    setMentionQuery(null);
    requestAnimationFrame(() => input?.focus());
  }

  async function handleDelete() {
    await api.delete(`/cards/${card.id}`);
    onDelete(card.id);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <input
          className="card-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          readOnly={!editable}
        />

        <div className="modal-section">
          <h4>Метки</h4>
          <div className="labels-row">
            {boardLabels.map((label) => (
              <button
                key={label.id}
                className={`label-chip ${card.labels.some((l) => l.id === label.id) ? "active" : ""}`}
                style={{ backgroundColor: label.color }}
                onClick={() => editable && handleToggleLabel(label)}
                disabled={!editable}
              >
                {label.title}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <h4>Дедлайн</h4>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={handleSave}
            disabled={!editable}
          />
        </div>

        <div className="modal-section">
          <h4>Описание</h4>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            rows={4}
            readOnly={!editable}
          />
        </div>

        <div className="modal-section">
          <h4>Вложения</h4>
          <div className="attachments-list">
            {attachments.map((a) => (
              <div key={a.id} className="attachment-item">
                <button className="attachment-name" onClick={() => handleDownload(a)}>
                  📎 {a.originalName}
                </button>
                <span className="attachment-size">{formatFileSize(a.size)}</span>
                {editable && (
                  <button
                    className="delete-attachment-btn"
                    onClick={() => handleDeleteAttachment(a.id)}
                    title="Удалить вложение"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <div className="attachment-upload">
              <input type="file" ref={fileInputRef} onChange={handleUploadFile} disabled={uploading} />
              {uploading && <span>Загрузка...</span>}
            </div>
          )}
        </div>

        <div className="modal-section">
          <h4>Комментарии</h4>
          <div className="comments-list">
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment-header">
                  <strong>{c.author.name}</strong>
                  {editable && (
                    <button
                      className="delete-comment-btn"
                      onClick={() => handleDeleteComment(c.id)}
                      title="Удалить комментарий"
                    >
                      ×
                    </button>
                  )}
                </div>
                <p>
                  <MentionText text={c.text} users={mentionableUsers} />
                </p>
              </div>
            ))}
          </div>
          {editable && (
            <form onSubmit={handleAddComment} className="new-comment-form">
              <div className="mention-input-wrapper">
                <input
                  ref={commentInputRef}
                  value={newComment}
                  onChange={handleCommentInputChange}
                  placeholder="Написать комментарий... (@ для упоминания)"
                />
                {mentionSuggestions.length > 0 && (
                  <div className="mention-suggestions">
                    {mentionSuggestions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="mention-suggestion-item"
                        onClick={() => handleSelectMention(u)}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit">Отправить</button>
            </form>
          )}
        </div>

        {editable && (
          <button className="delete-card-btn" onClick={handleDelete}>
            Удалить карточку
          </button>
        )}
      </div>
    </div>
  );
}
