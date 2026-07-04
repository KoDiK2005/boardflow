import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { socket } from "../api/socket";
import { useAuth } from "../hooks/useAuth";
import { NotificationBell } from "./NotificationBell";

export function AppLayout() {
  const { user } = useAuth();

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
    <div className="app-layout">
      <div className="app-topbar">
        <NotificationBell />
      </div>
      <Outlet />
    </div>
  );
}
