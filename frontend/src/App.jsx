import { useState } from "react";
import Login from "./pages/Login";
import Search from "./pages/Search";
import AdminDashboard from "./pages/AdminDashBoard";
import SearchDashboard from "./components/SearchDashboard";
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";
import "./styles/global.css";

export default function App() {
  // Simple in-memory router
  const [page, setPage] = useState("login"); // login | search | dashboard | admin
  const [authMode, setAuthMode] = useState(null); // user | admin
  const [adminSection, setAdminSection] = useState("overview");

  const navigate = (target) => setPage(target);

  const handleLogin = (mode) => {
    setAuthMode(mode);
    // Admins go to admin panel, users go to the search dashboard
    navigate(mode === "admin" ? "admin" : "dashboard");
  };

  if (page === "login") {
    return <Login onLogin={handleLogin} />;
  }

  // ── New: standalone SearchDashboard (performance-focused) ────────
  if (page === "dashboard") {
    return (
      <MainLayout mode={authMode} onNavigate={navigate} currentPage="dashboard">
        <SearchDashboard />
      </MainLayout>
    );
  }

  if (page === "search") {
    return (
      <MainLayout mode={authMode} onNavigate={navigate} currentPage="search">
        <Search onNavigate={navigate} />
      </MainLayout>
    );
  }

  if (page === "admin") {
    return (
      <AdminLayout activeSection={adminSection} onSectionChange={setAdminSection} onNavigate={navigate}>
        <AdminDashboard activeSection={adminSection} />
      </AdminLayout>
    );
  }

  return null;
}