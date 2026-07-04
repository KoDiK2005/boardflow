export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Board {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
}

export interface List {
  id: string;
  title: string;
  position: number;
  boardId: string;
  cards: Card[];
}

export interface Label {
  id: string;
  title: string;
  color: string;
  boardId: string;
}

export interface Comment {
  id: string;
  text: string;
  cardId: string;
  authorId: string;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  cardId: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
}

export interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  listId: string;
  labels: Label[];
  _count?: { attachments: number };
}

export type BoardRole = "ADMIN" | "EDITOR" | "VIEWER";
export type EffectiveRole = "OWNER" | BoardRole;

export interface BoardMember {
  id: string;
  userId: string;
  boardId: string;
  role: BoardRole;
  user: { id: string; name: string; email: string };
}

export interface BoardDetail extends Board {
  lists: List[];
  labels: Label[];
  members: BoardMember[];
  owner: { id: string; name: string };
}

export type NotificationType = "BOARD_INVITE" | "ROLE_CHANGED" | "COMMENT" | "MENTION";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  boardId: string | null;
  cardId: string | null;
  read: boolean;
  createdAt: string;
}
