import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider } from "./hooks/useAuth";
import { BoardPage } from "./pages/BoardPage";
import { BoardsPage } from "./pages/BoardsPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/boards" replace />} />
      </Routes>
    </AuthProvider>
  );
}
