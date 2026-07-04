import "dotenv/config";
import { createServer } from "http";
import { app } from "./app";
import { initSocket } from "./socket";

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(port, () => {
  console.log(`BoardFlow API listening on port ${port}`);
});
