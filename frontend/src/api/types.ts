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

export interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  listId: string;
}

export interface BoardDetail extends Board {
  lists: List[];
}
