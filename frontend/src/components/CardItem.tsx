import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isOverdue } from "../api/dates";
import { Card } from "../api/types";

export function CardItem({ card, onOpen }: { card: Card; onOpen: (card: Card) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="card-item"
      onClick={() => onOpen(card)}
    >
      {card.labels.length > 0 && (
        <div className="card-labels">
          {card.labels.map((label) => (
            <span key={label.id} className="label-dot" style={{ backgroundColor: label.color }} />
          ))}
        </div>
      )}
      <p>{card.title}</p>
      {card.dueDate && (
        <span className={`due-date ${isOverdue(card.dueDate) ? "overdue" : ""}`}>
          {new Date(card.dueDate).toLocaleDateString()}
        </span>
      )}
      {!!card._count?.attachments && (
        <span className="card-attachment-badge">📎 {card._count.attachments}</span>
      )}
    </div>
  );
}
