import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { socket } from "../api/socket";
import { BoardDetail, Card, Label, List } from "../api/types";
import { CardModal } from "../components/CardModal";
import { ListColumn } from "../components/ListColumn";

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [newListTitle, setNewListTitle] = useState("");
  const [newLabelTitle, setNewLabelTitle] = useState("");
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const labelColors = ["#61bd4f", "#f2d600", "#ff9f1a", "#eb5a46", "#c377e0", "#0079bf"];

  useEffect(() => {
    if (!boardId) return;
    api.get<BoardDetail>(`/boards/${boardId}`).then((res) => setBoard(res.data));
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;

    socket.connect();
    socket.emit("join-board", boardId);

    function updateList(listId: string, updater: (list: List) => List) {
      setBoard((prev) =>
        prev ? { ...prev, lists: prev.lists.map((l) => (l.id === listId ? updater(l) : l)) } : prev,
      );
    }

    function onListCreated(list: List) {
      setBoard((prev) =>
        prev && !prev.lists.some((l) => l.id === list.id)
          ? { ...prev, lists: [...prev.lists, { ...list, cards: [] }] }
          : prev,
      );
    }

    function onListUpdated(list: List) {
      updateList(list.id, (l) => ({ ...l, title: list.title }));
    }

    function onListDeleted({ id }: { id: string }) {
      setBoard((prev) => (prev ? { ...prev, lists: prev.lists.filter((l) => l.id !== id) } : prev));
    }

    function onCardCreated(card: Card) {
      setBoard((prev) => {
        if (!prev) return prev;
        const list = prev.lists.find((l) => l.id === card.listId);
        if (!list || list.cards.some((c) => c.id === card.id)) return prev;
        return {
          ...prev,
          lists: prev.lists.map((l) =>
            l.id === card.listId ? { ...l, cards: [...l.cards, card] } : l,
          ),
        };
      });
    }

    function onCardUpdated(card: Card) {
      setBoard((prev) => {
        if (!prev) return prev;
        const withoutCard = prev.lists.map((l) => ({
          ...l,
          cards: l.cards.filter((c) => c.id !== card.id),
        }));
        return {
          ...prev,
          lists: withoutCard.map((l) =>
            l.id === card.listId ? { ...l, cards: [...l.cards, card] } : l,
          ),
        };
      });
    }

    function onCardDeleted({ id }: { id: string }) {
      setBoard((prev) =>
        prev
          ? { ...prev, lists: prev.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== id) })) }
          : prev,
      );
    }

    function onLabelCreated(label: Label) {
      setBoard((prev) =>
        prev && !prev.labels.some((l) => l.id === label.id)
          ? { ...prev, labels: [...prev.labels, label] }
          : prev,
      );
    }

    function onLabelDeleted({ id }: { id: string }) {
      setBoard((prev) => (prev ? { ...prev, labels: prev.labels.filter((l) => l.id !== id) } : prev));
    }

    function onCardLabelChanged({
      cardId,
      label,
      attached,
    }: {
      cardId: string;
      label: Label;
      attached: boolean;
    }) {
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lists: prev.lists.map((l) => ({
            ...l,
            cards: l.cards.map((c) =>
              c.id === cardId
                ? {
                    ...c,
                    labels: attached
                      ? c.labels.some((existing) => existing.id === label.id)
                        ? c.labels
                        : [...c.labels, label]
                      : c.labels.filter((existing) => existing.id !== label.id),
                  }
                : c,
            ),
          })),
        };
      });
    }

    socket.on("list:created", onListCreated);
    socket.on("list:updated", onListUpdated);
    socket.on("list:deleted", onListDeleted);
    socket.on("card:created", onCardCreated);
    socket.on("card:updated", onCardUpdated);
    socket.on("card:deleted", onCardDeleted);
    socket.on("label:created", onLabelCreated);
    socket.on("label:deleted", onLabelDeleted);
    socket.on("card:label-changed", onCardLabelChanged);

    return () => {
      socket.emit("leave-board", boardId);
      socket.off("list:created", onListCreated);
      socket.off("list:updated", onListUpdated);
      socket.off("list:deleted", onListDeleted);
      socket.off("card:created", onCardCreated);
      socket.off("card:updated", onCardUpdated);
      socket.off("card:deleted", onCardDeleted);
      socket.off("label:created", onLabelCreated);
      socket.off("label:deleted", onLabelDeleted);
      socket.off("card:label-changed", onCardLabelChanged);
      socket.disconnect();
    };
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

  async function handleRenameBoard(title: string) {
    if (!board || !title.trim() || title === board.title) return;
    await api.patch(`/boards/${board.id}`, { title });
    setBoard({ ...board, title });
  }

  async function handleDeleteList(listId: string) {
    if (!board) return;
    await api.delete(`/lists/${listId}`);
    setBoard({ ...board, lists: board.lists.filter((l) => l.id !== listId) });
  }

  async function handleAddLabel(e: FormEvent) {
    e.preventDefault();
    if (!newLabelTitle.trim() || !board) return;
    const color = labelColors[board.labels.length % labelColors.length];
    const { data } = await api.post("/labels", { boardId: board.id, title: newLabelTitle, color });
    setBoard({ ...board, labels: [...board.labels, data] });
    setNewLabelTitle("");
  }

  function handleCardUpdate(updated: Card) {
    if (!board) return;
    setBoard({
      ...board,
      lists: board.lists.map((l) => ({
        ...l,
        cards: l.cards.map((c) => (c.id === updated.id ? updated : c)),
      })),
    });
    setOpenCard(updated);
  }

  function handleCardDelete(cardId: string) {
    if (!board) return;
    setBoard({
      ...board,
      lists: board.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })),
    });
    setOpenCard(null);
  }

  if (!board) return <p>Загрузка...</p>;

  return (
    <div className="board-page">
      <input
        className="board-title-input"
        defaultValue={board.title}
        key={board.title}
        onBlur={(e) => handleRenameBoard(e.target.value)}
      />

      <form onSubmit={handleAddLabel} className="new-label-form">
        <input
          value={newLabelTitle}
          onChange={(e) => setNewLabelTitle(e.target.value)}
          placeholder="Новая метка"
        />
        <button type="submit">Добавить метку</button>
      </form>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="lists-row">
          {board.lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              onAddCard={handleAddCard}
              onOpenCard={setOpenCard}
              onDeleteList={handleDeleteList}
            />
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

      {openCard && (
        <CardModal
          card={openCard}
          boardLabels={board.labels}
          onClose={() => setOpenCard(null)}
          onUpdate={handleCardUpdate}
          onDelete={handleCardDelete}
        />
      )}
    </div>
  );
}
