
import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";

const PAGE_SIZE = 10;

export default function AccountManagement({ user }) {
  const [accounts, setAccounts] = useState([]);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revealed, setRevealed] = useState({});
  const [receipt, setReceipt] = useState(null);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (!isAdmin) return undefined;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      q: submittedQuery,
      role,
    });

    async function load() {
      try {
        const response = await apiFetch(
          `/api/accounts?${params}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Không thể tải danh sách tài khoản."
          );
        }

        if (controller.signal.aborted) return;

        setAccounts(data.accounts || []);
        setTotal(Number(data.filtered_total || 0));

        const pages = Math.max(
          1,
          Number(data.total_pages || 1)
        );

        setTotalPages(pages);

        if (page > pages) {
          setPage(pages);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setAccounts([]);
        setError(
          err.message || "Không kết nối được đến máy chủ."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [isAdmin, submittedQuery, role, page, revision]);

  function reload() {
    setRevision(value => value + 1);
  }

  async function changeRole(account) {
    const newRole =
      account.role === "ADMIN" ? "STUDENT" : "ADMIN";

    if (
      !window.confirm(
        `Bạn muốn cấp vai trò ${newRole} cho ${account.username}?`
      )
    ) {
      return;
    }

    setBusyId(account.id);
    setMessage("");
    setError("");

    try {
      const response = await apiFetch(
        `/api/accounts/${account.id}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: newRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Không thể thay đổi vai trò."
        );
      }

      if (data.temporary_password) {
        setReceipt({
          username: account.username,
          password: data.temporary_password,
          reason:
            "Mật khẩu tạm của ADMIN mới (chỉ hiển thị lần này)",
        });
      }

      setMessage(
        data.message || "Đã cập nhật vai trò."
      );

      setRevealed({});
      reload();
    } catch (err) {
      setError(err.message || "Có lỗi kết nối.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(account) {
    const confirmReset = window.confirm(
      `Đặt lại mật khẩu tài khoản ${account.username} ` +
      `về mã sinh viên ${account.student_code}?\n` +
      "Phiên đăng nhập cũ sẽ hết hiệu lực."
    );

    if (!confirmReset) return;

    setBusyId(account.id);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `/api/accounts/${account.id}/reset-password`,
        { method: "POST" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Không thể đặt lại mật khẩu."
        );
      }

      setReceipt({
        username: data.username,
        password: data.initial_password,
        reason:
          "Mật khẩu đã được đặt lại (chỉ hiển thị lần này)",
      });

      setRevealed({});
      setMessage("Đã đặt lại mật khẩu.");
      reload();
    } catch (err) {
      setError(err.message || "Có lỗi kết nối.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <section className="content-panel access-error">
        <h2>Không có quyền truy cập</h2>
        <p>Chỉ ADMIN được xem và quản lý tài khoản.</p>
      </section>
    );
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            Quản trị hệ thống · ADMIN
          </p>
          <h1>Quản lý tài khoản</h1>
          <p className="subtitle">
            Xem tài khoản sinh viên, mật khẩu mặc định
            và cấp hoặc thu hồi vai trò ADMIN.
          </p>
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-header account-panel-header">
          <div>
            <h2>Danh sách tài khoản</h2>
            <p>
              Dữ liệu đọc trực tiếp từ MySQL · {total} tài khoản.
            </p>
          </div>

          <form
            className="filters"
            onSubmit={event => {
              event.preventDefault();
              setPage(1);
              setSubmittedQuery(query.trim());
            }}
          >
            <div className="search-box">
              <span>⌕</span>
              <input
                value={query}
                onChange={event =>
                  setQuery(event.target.value)
                }
                placeholder="Tên, mã SV, họ tên..."
                aria-label="Tìm tài khoản"
              />
            </div>

            <select
              value={role}
              onChange={event => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả vai trò</option>
              <option value="ADMIN">ADMIN</option>
              <option value="STUDENT">STUDENT</option>
            </select>

            <button
              className="filter-button"
              type="submit"
            >
              Tìm
            </button>
          </form>
        </div>

        <div className="account-notice">
          <strong>Lưu ý về mật khẩu: </strong>
          Chỉ hiển thị mã sinh viên nếu đó thực sự là
          mật khẩu hiện tại. Mật khẩu đã đổi không thể
          xem lại; ADMIN chỉ có thể đặt lại.
        </div>

        {message && (
          <div className="inline-flash success" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="inline-flash error" role="alert">
            {error}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>HỌ TÊN / MÃ SINH VIÊN</th>
                <th>TÊN ĐĂNG NHẬP</th>
                <th>MẬT KHẨU</th>
                <th>VAI TRÒ</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    Đang tải tài khoản...
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    Không tìm thấy tài khoản phù hợp.
                  </td>
                </tr>
              ) : (
                accounts.map(account => (
                  <tr key={account.id}>
                    <td>
                      <div className="student-cell">
                        <div className="student-avatar">
                          {account.role === "ADMIN"
                            ? "AD"
                            : "SV"}
                        </div>

                        <div>
                          <strong>
                            {account.full_name ||
                              "Quản trị hệ thống"}
                          </strong>
                          <small>
                            {account.student_code ||
                              "Không liên kết sinh viên"}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <code className="account-code">
                        {account.username}
                      </code>
                    </td>

                    <td>
                      {account.default_password ? (
                        <div className="account-password-cell">
                          <code className="account-code">
                            {revealed[account.id]
                              ? account.default_password
                              : "••••••••"}
                          </code>

                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setRevealed(previous => ({
                                ...previous,
                                [account.id]:
                                  !previous[account.id],
                              }))
                            }
                          >
                            {revealed[account.id]
                              ? "Ẩn"
                              : "Hiện"}
                          </button>
                        </div>
                      ) : (
                        <span className="account-private">
                          {account.role === "ADMIN"
                            ? "Không hiển thị"
                            : "Đã đổi / không thể xem"}
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          `account-role ${
                            account.role === "ADMIN"
                              ? "admin"
                              : "student"
                          }`
                        }
                      >
                        {account.role}
                      </span>
                    </td>

                    <td>
                      <div className="account-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={
                            busyId !== null ||
                            account.username === user.username
                          }
                          onClick={() => changeRole(account)}
                        >
                          {account.role === "ADMIN"
                            ? "Thu hồi ADMIN"
                            : "Cấp ADMIN"}
                        </button>

                        {account.role === "STUDENT" &&
                          account.student_id && (
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={busyId !== null}
                              onClick={() =>
                                resetPassword(account)
                              }
                            >
                              Đặt lại MK
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            {total
              ? (page - 1) * PAGE_SIZE + 1
              : 0}
            –
            {Math.min(page * PAGE_SIZE, total)}
            {" / "}
            <b>{total}</b> tài khoản
          </span>

          <div className="pagination">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() =>
                setPage(value => value - 1)
              }
            >
              ‹
            </button>

            <button
              type="button"
              className="current"
              disabled
            >
              Trang {page}/{totalPages}
            </button>

            <button
              type="button"
              disabled={
                page >= totalPages || loading
              }
              onClick={() =>
                setPage(value => value + 1)
              }
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {receipt && (
        <div
          className="account-receipt-backdrop"
          role="presentation"
        >
          <section
            className="account-receipt-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Thông tin tài khoản mới"
          >
            <h2>Thông tin đăng nhập</h2>
            <p>{receipt.reason}</p>

            <dl>
              <dt>Tên đăng nhập</dt>
              <dd><code>{receipt.username}</code></dd>

              <dt>Mật khẩu tạm</dt>
              <dd><code>{receipt.password}</code></dd>
            </dl>

            <p className="account-private">
              Cung cấp riêng cho người nhận và yêu cầu
              đổi mật khẩu.
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={() => setReceipt(null)}
            >
              Đã lưu thông tin · Đóng
            </button>
          </section>
        </div>
      )}
    </>
  );
}
