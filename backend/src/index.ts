import "dotenv/config";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth";
import boardRoutes from "./routes/boards";
import listRoutes from "./routes/lists";
import cardRoutes from "./routes/cards";
import labelRoutes from "./routes/labels";
import commentRoutes from "./routes/comments";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/cards", cardRoutes);
app.use("/api/labels", labelRoutes);
app.use("/api/comments", commentRoutes);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`BoardFlow API listening on port ${port}`);
});
