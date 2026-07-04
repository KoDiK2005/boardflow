import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormEvent, useState } from "react";
import { List } from "../api/types";
import { CardItem } from "./CardItem";

interface Props {
  list: List;
  onAddCard: (listId: string, title: string) => void;
  onOpenCard: (card: List["cards"][number]) => void;
  onDeleteList: (listId: string) => void;
  editable: boolean;
}

export function ListColumn({ list, onAddCard, onOpenCard, onDeleteList, editable }: Props) {
  const [title, setTitle] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { type: "list", list },
    disabled: !editable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddCard(list.id, title);
    setTitle("");
  }

  return (
    <div className="list-column" ref={setNodeRef} style={style}>
      <div className="list-header" {...attributes} {...listeners}>
        <h3>{list.title}</h3>
        {editable && (
          <button
            className="delete-list-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDeleteList(list.id)}
            title="Удалить список"
          >
            ×
          </button>
        )}
      </div>
      <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="cards">
          {list.cards.map((card) => (
            <CardItem key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </div>
      </SortableContext>
      {editable && (
        <form onSubmit={handleSubmit} className="new-card-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новая карточка"
          />
          <button type="submit">+</button>
        </form>
      )}
    </div>
  );
}
