import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FormEvent, useState } from "react";
import { List } from "../api/types";
import { CardItem } from "./CardItem";

interface Props {
  list: List;
  onAddCard: (listId: string, title: string) => void;
  onOpenCard: (card: List["cards"][number]) => void;
}

export function ListColumn({ list, onAddCard, onOpenCard }: Props) {
  const [title, setTitle] = useState("");
  const { setNodeRef } = useDroppable({ id: list.id, data: { type: "list", list } });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAddCard(list.id, title);
    setTitle("");
  }

  return (
    <div className="list-column" ref={setNodeRef}>
      <h3>{list.title}</h3>
      <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="cards">
          {list.cards.map((card) => (
            <CardItem key={card.id} card={card} onOpen={onOpenCard} />
          ))}
        </div>
      </SortableContext>
      <form onSubmit={handleSubmit} className="new-card-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Новая карточка"
        />
        <button type="submit">+</button>
      </form>
    </div>
  );
}
