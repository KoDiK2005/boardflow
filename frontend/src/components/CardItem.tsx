import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "../api/types";

export function CardItem({ card }: { card: Card }) {
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="card-item">
      <p>{card.title}</p>
      {card.dueDate && <span className="due-date">{new Date(card.dueDate).toLocaleDateString()}</span>}
    </div>
  );
}
