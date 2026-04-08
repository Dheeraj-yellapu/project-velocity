import Navbar from "../components/Navbar";

export default function MainLayout({ children, mode, onNavigate, currentPage }) {
  return (
    <div className="layout-main">
      <Navbar mode={mode} onNavigate={onNavigate} currentPage={currentPage} />
      <main className="layout-content">{children}</main>
    </div>
  );
}