const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../modules/users/user.model");

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        String(socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("_id role companyId name");
      if (!user || !user.isActive) {
        return next(new Error("Unauthorized"));
      }

      socket.user = {
        userId: user._id,
        role: user.role,
        companyId: user.companyId,
        name: user.name,
      };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, companyId } = socket.user;
    socket.join(`user:${userId}`);
    if (companyId) {
      socket.join(`company:${companyId}`);
    }
    socket.emit("connected", { ok: true });

    socket.on("disconnect", () => {});
  });

  return io;
}

function getIO() {
  return io;
}

function emitToCompany(companyId, event, payload) {
  if (!io || !companyId) return;
  io.to(`company:${companyId}`).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initSocket,
  getIO,
  emitToCompany,
  emitToUser,
};
