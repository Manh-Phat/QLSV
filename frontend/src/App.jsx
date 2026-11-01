
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import { apiFetch } from "./api.js";

import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import StudentDetail from "./pages/StudentDetail.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import AccountManagement from "./pages/AccountManagement.jsx";

export default function App() {
  const navigate = useNavigate();

  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [logoutError, setLogoutError] = useState("");

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiFetch("/api/session");
      const data = await response.json();

      const loggedIn =
        response.ok && Boolean(data.logged_in);

      setAuth(loggedIn);
      setUser(loggedIn ? data : null);

      return loggedIn;
    } catch {
      setAuth(false);
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  async function handleLogout() {
    setLogoutError("");

    try {
      const response = await apiFetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          "Máy chủ không xác nhận đăng xuất."
        );
      }

      setAuth(false);
      setUser(null);

      navigate("/login", {
        replace: true,
      });
    } catch {
      setLogoutError(
        "Chưa thể đăng xuất khỏi máy chủ. Vui lòng thử lại."
      );
    }
  }

  if (auth === null) {
    return (
      <div className="loading-screen">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  const shell = page => (
    <Layout
      user={user}
      onLogout={handleLogout}
    >
      {logoutError && (
        <div
          className="inline-flash error"
          role="alert"
        >
          {logoutError}
        </div>
      )}
      {page}
    </Layout>
  );

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth
            ? <Navigate to="/" replace />
            : <Login onLogin={refreshSession} />
        }
      />

      <Route
        path="/"
        element={
          auth
            ? shell(<Dashboard user={user} />)
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/students/:studentId"
        element={
          auth
            ? shell(<StudentDetail user={user} />)
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/accounts"
        element={
          auth
            ? (
              user?.role === "ADMIN"
                ? shell(
                    <AccountManagement user={user} />
                  )
                : <Navigate to="/" replace />
            )
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/account/password"
        element={
          auth
            ? shell(<ChangePassword />)
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to={auth ? "/" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}
