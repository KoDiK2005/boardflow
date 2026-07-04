import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { socket } from "../api/socket";
import { useAuth } from "../hooks/useAuth";
import { NotificationBell } from "./NotificationBell";

export function AppLayout() {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) return;

    function identify() {
      const token = localStorage.getItem("token");
      if (token) socket.emit("identify", token);
    }

    socket.on("connect", identify);
    socket.connect();

    return () => {
      socket.off("connect", identify);
      socket.disconnect();
    };
  }, [user?.id]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/boards" className="app-logo">
          <span className="app-logo-mark">B</span>
          BoardFlow
        </Link>
        <div className="app-header-right">
          <NotificationBell />
          <div className="app-user">
            <span className="app-user-avatar">{user?.name?.[0]?.toUpperCase()}</span>
            <span className="app-user-name">{user?.name}</span>
          </div>
          <button className="btn btn-ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
