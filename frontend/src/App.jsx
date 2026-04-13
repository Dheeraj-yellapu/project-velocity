import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Search from "./pages/Search";
import SearchDashboard from "./components/SearchDashboard";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import "./styles/global.css";

export default function App() {
  return (
    <Routes>
      {/* ── Public ────────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/user" replace />} />
      <Route path="/login" element={<Login />} />

      {/* ── User routes ───────────────────────────────────────────── */}
      <Route
        path="/user"
        element={
          <MainLayout mode="user" currentPage="dashboard">
            <SearchDashboard />
          </MainLayout>
        }
      />
      <Route
        path="/user/search"
        element={
          <MainLayout mode="user" currentPage="search">
            <Search />
          </MainLayout>
        }
      />

      {/* ── Admin route ───────────────────────────────────────────── */}
      <Route path="/admin" element={<AdminLayout />} />

      {/* ── Catch-all redirect ────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}