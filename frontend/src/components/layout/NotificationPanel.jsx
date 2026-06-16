import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell } from "react-icons/fi";
import useAuth from "../../hooks/useAuth";
import { notificationService } from "../../services/notification.service";
import "../../styles/notificationPanel.css";

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

export default function NotificationPanel() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setLoading(true);
      const res = await notificationService.getNotifications(auth.token, { limit: 30 });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
      setUnreadCount(res?.data?.unreadCount ?? 0);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    const onChanged = () => loadNotifications();
    window.addEventListener("app:notifications-changed", onChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener("app:notifications-changed", onChanged);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) loadNotifications();
  };

  const handleMarkRead = async (item) => {
    if (!item?._id || item.isRead || !auth?.token) return;
    try {
      await notificationService.markRead(item._id, auth.token);
      setItems((prev) =>
        prev.map((row) => (row._id === item._id ? { ...row, isRead: true } : row))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
  };

  const handleNotificationClick = async (item) => {
    await handleMarkRead(item);

    const confirmationId = item?.meta?.confirmationId;
    if (!confirmationId) return;

    const isRepoAdmin = auth?.user?.role === "REPO_ADMIN";

    if (item?.type === "INVENTORY_SUBMITTED" && isRepoAdmin) {
      setOpen(false);
      navigate(`/confirmation/${confirmationId}`);
      return;
    }

    const isTracerInventory =
      item?.type === "TRACE_CONFIRMED" ||
      item?.type === "INVENTORY_REVISION_REQUESTED" ||
      item?.type === "INVENTORY_CONFIRMED" ||
      item?.meta?.action === "INVENTORY_UPDATE";

    if (isTracerInventory) {
      setOpen(false);
      navigate(`/inventory-update?confirmationId=${confirmationId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!auth?.token || unreadCount === 0) return;
    try {
      await notificationService.markAllRead(auth.token);
      setItems((prev) => prev.map((row) => ({ ...row, isRead: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="notification-panel" ref={panelRef}>
      <button
        type="button"
        className="notification-bell"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <FiBell aria-hidden />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown__head">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-dropdown__body">
            {loading && items.length === 0 ? (
              <p className="notification-empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="notification-empty">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className={`notification-item${
                    item.isRead ? "" : " notification-item--unread"
                  }${
                    item.type === "TRACE_CONFIRMED" ||
                    item.type === "INVENTORY_SUBMITTED" ||
                    item.type === "INVENTORY_REVISION_REQUESTED" ||
                    item.type === "INVENTORY_CONFIRMED" ||
                    item.meta?.action === "INVENTORY_UPDATE"
                      ? " notification-item--action"
                      : ""
                  }`}
                  onClick={() => handleNotificationClick(item)}
                >
                  <span className="notification-item__title">{item.title}</span>
                  <span className="notification-item__message">{item.message}</span>
                  <span className="notification-item__time">{formatWhen(item.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
