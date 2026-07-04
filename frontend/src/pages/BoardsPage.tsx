import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Board } from "../api/types";

export function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Board[]>("/boards")
      .then((res) => setBoards(res.data))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data } = await api.post<Board>("/boards", { title });
    setBoards((prev) => [...prev, data]);
    setTitle("");
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <h1>Мои доски</h1>
        <p className="page-subtitle">Управляйте проектами и командной работой в одном месте</p>
      </div>

      <form onSubmit={handleCreate} className="new-board-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название новой доски"
        />
        <button type="submit" className="btn btn-primary">
          Создать доску
        </button>
      </form>

      {!loading && boards.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-icon">🗂️</p>
          <p>Пока нет ни одной доски</p>
          <p className="empty-state-hint">Создайте первую доску, чтобы начать работу</p>
        </div>
      )}

      <div className="boards-grid">
        {boards.map((board, i) => (
          <Link
            key={board.id}
            to={`/boards/${board.id}`}
            className="board-card"
            style={{ ["--accent-index" as string]: i % 6 }}
          >
            {board.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
