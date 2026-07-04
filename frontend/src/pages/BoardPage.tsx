import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { BoardDetail, Card } from "../api/types";
import { ListColumn } from "../components/ListColumn";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [newListTitle, setNewListTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!boardId) return;
    api.get<BoardDetail>(`/boards/${boardId}`).then((res) => setBoard(res.data));
  }, [boardId]);

  async function handleAddList(e: FormEvent) {
    e.preventDefault();
    if (!newListTitle.trim() || !board) return;
    const { data } = await api.post("/lists", { boardId: board.id, title: newListTitle });
    setBoard({ ...board, lists: [...board.lists, { ...data, cards: [] }] });
    setNewListTitle("");
  }

  async function handleAddCard(listId: string, title: string) {
    if (!board) return;
    const { data } = await api.post<Card>("/cards", { listId, title });
    setBoard({
      ...board,
      lists: board.lists.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, data] } : l)),
    });
  }

  function findCardList(cardId: string) {
    return board?.lists.find((l) => l.cards.some((c) => c.id === cardId)) ?? null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!board) return;
    const { active, over } = event;
    if (!over) return;

    const sourceList = findCardList(active.id as string);
    if (!sourceList) return;

    const overIsList = board.lists.some((l) => l.id === over.id);
    const destList = overIsList
      ? board.lists.find((l) => l.id === over.id)!
      : findCardList(over.id as string);
    if (!destList) return;

    const card = sourceList.cards.find((c) => c.id === active.id)!;
    const withoutCard = sourceList.cards.filter((c) => c.id !== card.id);

    let destCards;
    if (sourceList.id === destList.id) {
      destCards = withoutCard;
    } else {
      destCards = [...destList.cards];
    }

    const overIndex = overIsList
      ? destCards.length
      : destCards.findIndex((c) => c.id === over.id);
    const insertIndex = overIndex === -1 ? destCards.length : overIndex;
    destCards.splice(insertIndex, 0, card);

    const newLists = board.lists.map((l) => {
      if (l.id === sourceList.id && l.id === destList.id) return { ...l, cards: destCards };
      if (l.id === sourceList.id) return { ...l, cards: withoutCard };
      if (l.id === destList.id) return { ...l, cards: destCards };
      return l;
    });
    setBoard({ ...board, lists: newLists });

    await api.patch(`/cards/${card.id}`, {
      listId: destList.id,
      position: insertIndex,
    });
  }

  if (!board) return <p>Загрузка...</p>;

  return (
    <div className="board-page">
      <h1>{board.title}</h1>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="lists-row">
          {board.lists.map((list) => (
            <ListColumn key={list.id} list={list} onAddCard={handleAddCard} />
          ))}
        </div>
      </DndContext>
      <form onSubmit={handleAddList} className="new-list-form">
        <input
          value={newListTitle}
          onChange={(e) => setNewListTitle(e.target.value)}
          placeholder="Новый список"
        />
        <button type="submit">Добавить список</button>
      </form>
    </div>
  );
}
