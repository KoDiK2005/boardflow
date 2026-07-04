import { Dispatch, SetStateAction, useEffect } from "react";
import { socket } from "../api/socket";
import { BoardDetail, BoardMember, Card, Label, List } from "../api/types";

export function useBoardSocket(
  boardId: string | undefined,
  setBoard: Dispatch<SetStateAction<BoardDetail | null>>,
) {
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

    function onMemberAdded(member: BoardMember) {
      setBoard((prev) =>
        prev && !prev.members.some((m) => m.id === member.id)
          ? { ...prev, members: [...prev.members, member] }
          : prev,
      );
    }

    function onMemberRemoved({ userId }: { userId: string }) {
      setBoard((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.userId !== userId) } : prev,
      );
    }

    function onMemberUpdated(member: BoardMember) {
      setBoard((prev) =>
        prev
          ? { ...prev, members: prev.members.map((m) => (m.id === member.id ? member : m)) }
          : prev,
      );
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
    socket.on("member:added", onMemberAdded);
    socket.on("member:removed", onMemberRemoved);
    socket.on("member:updated", onMemberUpdated);

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
      socket.off("member:added", onMemberAdded);
      socket.off("member:removed", onMemberRemoved);
      socket.off("member:updated", onMemberUpdated);
      socket.disconnect();
    };
  }, [boardId, setBoard]);
}
