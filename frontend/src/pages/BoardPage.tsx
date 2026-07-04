import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { canEdit, getMyRole } from "../api/permissions";
import { BoardDetail, Card } from "../api/types";
import { CardModal } from "../components/CardModal";
import { ListColumn } from "../components/ListColumn";
import { MembersPanel } from "../components/MembersPanel";
import { useAuth } from "../hooks/useAuth";
import { useBoardSocket } from "../hooks/useBoardSocket";

export function BoardPage() {
  const { user } = useAuth();
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

  useBoardSocket(boardId, setBoard);

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

  if (!board || !user) return <p>Загрузка...</p>;

  const myRole = getMyRole(board, user.id);
  const editable = canEdit(myRole);

  return (
    <div className="board-page">
      <input
        className="board-title-input"
        defaultValue={board.title}
        key={board.title}
        onBlur={(e) => handleRenameBoard(e.target.value)}
        readOnly={!editable}
      />

      {!editable && <p className="viewer-notice">Режим просмотра: у вас нет прав на редактирование</p>}

      <MembersPanel
        boardId={board.id}
        myRole={myRole}
        members={board.members}
        onMemberAdded={(member) => setBoard({ ...board, members: [...board.members, member] })}
        onMemberRemoved={(userId) =>
          setBoard({ ...board, members: board.members.filter((m) => m.userId !== userId) })
        }
        onMemberUpdated={(member) =>
          setBoard({
            ...board,
            members: board.members.map((m) => (m.id === member.id ? member : m)),
          })
        }
      />

      {editable && (
        <form onSubmit={handleAddLabel} className="new-label-form">
          <input
            value={newLabelTitle}
            onChange={(e) => setNewLabelTitle(e.target.value)}
            placeholder="Новая метка"
          />
          <button type="submit">Добавить метку</button>
        </form>
      )}

      <DndContext sensors={sensors} onDragEnd={editable ? handleDragEnd : undefined}>
        <div className="lists-row">
          {board.lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              onAddCard={handleAddCard}
              onOpenCard={setOpenCard}
              onDeleteList={handleDeleteList}
              editable={editable}
            />
          ))}
        </div>
      </DndContext>
      {editable && (
        <form onSubmit={handleAddList} className="new-list-form">
          <input
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            placeholder="Новый список"
          />
          <button type="submit">Добавить список</button>
        </form>
      )}

      {openCard && (
        <CardModal
          card={openCard}
          boardLabels={board.labels}
          editable={editable}
          onClose={() => setOpenCard(null)}
          onUpdate={handleCardUpdate}
          onDelete={handleCardDelete}
        />
      )}
    </div>
  );
}
