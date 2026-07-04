import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { socket } from "../api/socket";
import { Notification } from "../api/types";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Notification[]>("/notifications").then((res) => setNotifications(res.data));
  }, []);

  useEffect(() => {
    function onNotification(notification: Notification) {
      setNotifications((prev) => [notification, ...prev]);
    }

    socket.on("notification:new", onNotification);
    return () => {
      socket.off("notification:new", onNotification);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleToggle() {
    setOpen((prev) => !prev);
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
    }
    setOpen(false);
    if (notification.boardId) navigate(`/boards/${notification.boardId}`);
  }

  async function handleMarkAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div className="notification-bell">
      <button className="bell-btn" onClick={handleToggle}>
        🔔
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <strong>Уведомления</strong>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                Прочитать всё
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 && <p className="notification-empty">Пока пусто</p>}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notification-item ${n.read ? "" : "unread"}`}
                onClick={() => handleNotificationClick(n)}
              >
                <p>{n.message}</p>
                <span className="notification-time">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
