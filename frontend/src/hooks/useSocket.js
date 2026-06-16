import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import useAuth from "./useAuth";

function resolveSocketUrl() {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  const api = process.env.REACT_APP_API_BASE_URL || "/api";
  if (api.startsWith("http")) {
    return api.replace(/\/api\/?$/, "");
  }
  return undefined;
}

const SOCKET_URL = resolveSocketUrl();

export default function useSocket(onEvent) {
  const { auth } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!auth?.token) return undefined;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      auth: { token: auth.token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    if (typeof onEvent === "function") {
      socket.on("notifications:new", (payload) => onEvent("notifications:new", payload));
      socket.on("case:location", (payload) => onEvent("case:location", payload));
      socket.on("tracer:location", (payload) => onEvent("tracer:location", payload));
      socket.on("case:trace-status", (payload) => onEvent("case:trace-status", payload));
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [auth?.token, onEvent]);

  return socketRef;
}
