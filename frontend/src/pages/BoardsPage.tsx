import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Board } from "../api/types";
import { useAuth } from "../hooks/useAuth";

export function BoardsPage() {
  const { user, logout } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    api.get<Board[]>("/boards").then((res) => setBoards(res.data));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data } = await api.post<Board>("/boards", { title });
    setBoards((prev) => [...prev, data]);
    setTitle("");
  }

  return (
    <div className="boards-page">
      <header>
        <h1>BoardFlow</h1>
        <div>
          <span>{user?.name}</span>
          <button onClick={logout}>Выйти</button>
        </div>
      </header>

      <form onSubmit={handleCreate} className="new-board-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название новой доски"
        />
        <button type="submit">Создать доску</button>
      </form>

      <div className="boards-grid">
        {boards.map((board) => (
          <Link key={board.id} to={`/boards/${board.id}`} className="board-card">
            {board.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
