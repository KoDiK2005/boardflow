import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server | undefined;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    socket.on("join-board", (boardId: string) => {
      socket.join(`board:${boardId}`);
    });

    socket.on("leave-board", (boardId: string) => {
      socket.leave(`board:${boardId}`);
    });
  });

  return io;
}

export function emitToBoard(boardId: string, event: string, payload: unknown) {
  io?.to(`board:${boardId}`).emit(event, payload);
}
