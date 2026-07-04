import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { socket } from "../api/socket";
import { Card, Comment, Label } from "../api/types";

interface Props {
  card: Card;
  boardLabels: Label[];
  onClose: () => void;
  onUpdate: (card: Card) => void;
  onDelete: (cardId: string) => void;
}

export function CardModal({ card, boardLabels, onClose, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ? card.dueDate.slice(0, 10) : "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    api.get<Comment[]>("/comments", { params: { cardId: card.id } }).then((res) => setComments(res.data));
  }, [card.id]);

  useEffect(() => {
    function onCommentCreated(comment: Comment) {
      if (comment.cardId !== card.id) return;
      setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]));
    }

    socket.on("comment:created", onCommentCreated);
    return () => {
      socket.off("comment:created", onCommentCreated);
    };
  }, [card.id]);

  async function handleSave() {
    const { data } = await api.patch<Card>(`/cards/${card.id}`, {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    });
    onUpdate(data);
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
    setComments((prev) => [...prev, data]);
    setNewComment("");
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
        />

        <div className="modal-section">
          <h4>Метки</h4>
          <div className="labels-row">
            {boardLabels.map((label) => (
              <button
                key={label.id}
                className={`label-chip ${card.labels.some((l) => l.id === label.id) ? "active" : ""}`}
                style={{ backgroundColor: label.color }}
                onClick={() => handleToggleLabel(label)}
              >
                {label.title}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <h4>Дедлайн</h4>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} onBlur={handleSave} />
        </div>

        <div className="modal-section">
          <h4>Описание</h4>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            rows={4}
          />
        </div>

        <div className="modal-section">
          <h4>Комментарии</h4>
          <div className="comments-list">
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <strong>{c.author.name}</strong>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="new-comment-form">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Написать комментарий..."
            />
            <button type="submit">Отправить</button>
          </form>
        </div>

        <button className="delete-card-btn" onClick={handleDelete}>
          Удалить карточку
        </button>
      </div>
    </div>
  );
}
