import Navbar from "../components/Navbar";

export default function MainLayout({ children, mode, currentPage }) {
  return (
    <div className="layout-main">
      <Navbar mode={mode} currentPage={currentPage} />
      <main className="layout-content">{children}</main>
    </div>
  );
}