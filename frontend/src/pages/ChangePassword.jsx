
import { useState } from "react";
import { apiFetch } from "../api.js";

export default function ChangePassword() {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  async function submit(event) {
    event.preventDefault();

    if (saving) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    const old_password = String(
      fields.get("old_password") || ""
    );

    const new_password = String(
      fields.get("new_password") || ""
    );

    const confirmation = String(
      fields.get("confirm_password") || ""
    );

    if (new_password !== confirmation) {
      setNotice({
        type: "error",
        text: "Mật khẩu mới nhập lại không khớp.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await apiFetch(
        "/api/account/change-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            old_password,
            new_password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Không thể đổi mật khẩu."
        );
      }

      setNotice({
        type: "success",
        text: data.message ||
          "Đổi mật khẩu thành công.",
      });

      form.reset();
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message ||
          "Không thể kết nối Flask.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            Tài khoản cá nhân
          </p>
          <h1>Đổi mật khẩu</h1>
          <p className="subtitle">
            Thay đổi mật khẩu đang sử dụng.
          </p>
        </div>
      </section>

      <section className="content-panel narrow-panel">
        <div className="panel-header">
          <div>
            <h2>Bảo vệ tài khoản</h2>
            <p>
              Nên đổi mật khẩu khởi tạo và không
              chia sẻ mật khẩu.
            </p>
          </div>
        </div>

        {notice && (
          <div
            className={`inline-flash ${notice.type}`}
            role="status"
          >
            {notice.text}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-grid one-column">
            <label>
              Mật khẩu hiện tại
              <input
                name="old_password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>

            <label>
              Mật khẩu mới
              <input
                name="new_password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>

            <label>
              Nhập lại mật khẩu mới
              <input
                name="confirm_password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Đang lưu..."
                : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
