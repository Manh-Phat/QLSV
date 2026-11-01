
import { Link, NavLink } from "react-router-dom";

export default function Layout({
  children,
  onLogout,
  user,
}) {
  return (
    <>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">QL</span>
          <span>SinhViên</span>
        </Link>

        <p className="nav-label">Không gian làm việc</p>

        <nav>
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>▦</span> Tổng quan
          </NavLink>

          {user?.role === "ADMIN" && (
            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span>♙</span> Quản lý tài khoản
            </NavLink>
          )}

          <NavLink
            to="/account/password"
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
          >
            <span>⚿</span> Đổi mật khẩu
          </NavLink>

          <button
            className="nav-item"
            type="button"
            onClick={onLogout}
          >
            <span>⎆</span> Đăng xuất
          </button>
        </nav>

        <div className="lab-user-card">
          <strong>{user?.username || "—"}</strong>
          <small>
            {user?.role || "—"}
            {user?.student_id
              ? ` · SV #${user.student_id}`
              : ""}
          </small>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </>
  );
}
