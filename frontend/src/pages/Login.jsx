import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await apiFetch('/api/login', { method: 'POST', body: formData });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.message || 'Đăng nhập thất bại.' });
        return;
      }

      await onLogin();
      navigate('/', { replace: true });
    } catch {
      setMessage({ type: 'error', text: 'Không thể kết nối đến máy chủ Flask.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-header">
          <h1>Quản lý sinh viên</h1>
          <p>Hệ thống quản lý hồ sơ sinh viên</p>
        </div>

        {message && <div className={`flash ${message.type}`}>{message.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <input id="username" name="username" placeholder="Tên đăng nhập" required autoFocus />
          </div>
          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input id="password" type="password" name="password" placeholder="Mật khẩu" required />
          </div>
          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="demo-credentials">
          <strong>Tài khoản kiểm thử</strong>
          <code>admin / Admin@123</code>
          <code>sv001 / Student@123</code>
          <code>sv002 / Student@123</code>
        </div>
      </div>
    </div>
  );
}
