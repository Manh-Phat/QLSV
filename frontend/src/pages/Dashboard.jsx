import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';

const emptyStats = { total: 0, active: 0, average: 0, majors: 0 };

function getInitials(fullName) {
  if (!fullName) return 'SV';
  const parts = fullName.trim().split(/\s+/);
  return `${parts[0]?.[0] || ''}${parts[parts.length - 1]?.[0] || ''}`.toUpperCase();
}

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const studentModalRef = useRef(null);
  const flashTimerRef = useRef(null);

  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [majors, setMajors] = useState([]);
  const [filters, setFilters] = useState({ q: '', major: '', status: '' });
  const [flash, setFlash] = useState(null);
  const [loading, setLoading] = useState(true);
  const permissions = new Set(user?.permissions || []);
  const canCreate = permissions.has('STUDENT_CREATE');
  const canDelete = permissions.has('STUDENT_DELETE');
  const isAdmin = user?.role === 'ADMIN';

  function showFlash(text, type = 'info') {
    window.clearTimeout(flashTimerRef.current);
    setFlash({ text, type });
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 3000);
  }

  async function loadStudents(nextFilters = filters) {
    setLoading(true);
    const params = new URLSearchParams(nextFilters);

    try {
      const response = await apiFetch(`/api/students?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        showFlash(data.message || 'Không thể tải dữ liệu.', 'error');
        return;
      }

      setStudents(data.students || []);
      setStats(data.stats || emptyStats);
      setMajors(data.majors || []);
    } catch {
      showFlash('Không thể kết nối đến máy chủ Flask.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();

    return () => window.clearTimeout(flashTimerRef.current);
    // Chỉ tải lần đầu; bộ lọc được tải khi submit form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    loadStudents(filters);
  }

  async function handleCreateStudent(event) {
    event.preventDefault();
    const form = event.currentTarget;

    try {
      const response = await apiFetch('/api/students', {
        method: 'POST',
        body: new FormData(form),
      });
      const data = await response.json();

      if (!response.ok) {
        showFlash(data.message || 'Không thể lưu sinh viên.', 'error');
        return;
      }

      studentModalRef.current?.close();
      form.reset();
      showFlash(data.message || 'Đã lưu sinh viên.', 'success');
      await loadStudents(filters);
    } catch {
      showFlash('Không thể kết nối đến máy chủ Flask.', 'error');
    }
  }

  async function handleDelete(studentId) {
    if (!window.confirm('Xóa hồ sơ này?')) return;

    try {
      const response = await apiFetch(`/api/students/${studentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        showFlash(data.message || 'Không thể xóa sinh viên.', 'error');
        return;
      }

      showFlash(data.message || 'Đã xóa sinh viên.', 'success');
      await loadStudents(filters);
    } catch {
      showFlash('Không thể kết nối đến máy chủ Flask.', 'error');
    }
  }

  const activeRate = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Dữ liệu học tập · {user?.role || '—'}</p>
          <h1>{isAdmin ? 'Danh sách sinh viên' : 'Hồ sơ của tôi'}</h1>
          <p className="subtitle">
            {isAdmin
              ? 'ADMIN có quyền xem, thêm và xóa hồ sơ sinh viên.'
              : 'STUDENT chỉ được xem hồ sơ của chính mình. Quyền được kiểm tra lại ở Flask API.'}
          </p>
        </div>
        {canCreate && (
          <button className="primary-button" type="button" onClick={() => studentModalRef.current?.showModal()}>
            <span>＋</span> Thêm sinh viên
          </button>
        )}
      </section>

      <section className="stats-grid">
        <article className="stat-card orange">
          <div className="stat-top"><span>Tổng sinh viên</span><span className="stat-icon">♙</span></div>
          <strong>{stats.total}</strong>
          <small>Hồ sơ trong hệ thống</small>
        </article>

        <article className="stat-card blue">
          <div className="stat-top"><span>Đang theo học</span><span className="stat-icon">↗</span></div>
          <strong>{stats.active}</strong>
          <small><b>{activeRate}%</b> tổng số sinh viên</small>
        </article>

        <article className="stat-card green">
          <div className="stat-top"><span>DTB trung bình</span><span className="stat-icon">✦</span></div>
          <strong>{Number(stats.average || 0).toFixed(2)}</strong>
          <small>Thang điểm 4.0</small>
        </article>

        <article className="stat-card purple">
          <div className="stat-top"><span>Chuyên ngành</span><span className="stat-icon">⌘</span></div>
          <strong>{stats.majors}</strong>
          <small>Đang được đào tạo</small>
        </article>
      </section>

      <section className="content-panel" id="students">
        <div className="panel-header">
          <div>
            <h2>{isAdmin ? 'Sinh viên gần đây' : 'Thông tin sinh viên'}</h2>
            <p>{isAdmin ? 'Cập nhật và quản lý thông tin hồ sơ.' : 'Tài khoản STUDENT chỉ nhận dữ liệu hồ sơ được gán cho mình.'}</p>
          </div>

          {isAdmin && (
            <form className="filters" onSubmit={handleFilterSubmit}>
              <div className="search-box">
                <span>⌕</span>
                <input
                  name="q"
                  value={filters.q}
                  onChange={handleFilterChange}
                  placeholder="Tìm theo tên, mã SV..."
                  aria-label="Tìm kiếm"
                />
              </div>

              <select name="major" value={filters.major} onChange={handleFilterChange} aria-label="Lọc theo chuyên ngành">
                <option value="">Tất cả chuyên ngành</option>
                {majors.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select name="status" value={filters.status} onChange={handleFilterChange} aria-label="Lọc theo trạng thái">
                <option value="">Trạng thái</option>
                <option value="Đang học">Đang học</option>
                <option value="Bảo lưu">Bảo lưu</option>
                <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
              </select>

              <button className="filter-button" type="submit">Lọc</button>
            </form>
          )}
        </div>

        {flash && <div className={`inline-flash ${flash.type}`}>{flash.text}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SINH VIÊN</th>
                <th>CHUYÊN NGÀNH</th>
                <th>LỚP</th>
                <th>DTB</th>
                <th>TRẠNG THÁI</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="empty-state">Đang tải dữ liệu...</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">Chưa có sinh viên phù hợp.</td></tr>
              ) : students.map((student, index) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-cell">
                      <div className={`student-avatar avatar-${(index % 5) + 1}`}>{getInitials(student.full_name)}</div>
                      <div>
                        <strong>{student.full_name}</strong>
                        <small>{student.student_code} · {student.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{student.major}</td>
                  <td>{student.class_name}</td>
                  <td><strong className="dtb">{Number(student.dtb || 0).toFixed(2)}</strong></td>
                  <td>
                    <span className={`status ${student.status === 'Đang học' ? 'status-active' : 'status-paused'}`}>
                      {student.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-menu"
                      aria-label="Xem chi tiết"
                      title="Xem chi tiết"
                      onClick={() => navigate(`/students/${student.id}`)}
                    >👁</button>
                    {canDelete && (
                      <button
                        type="button"
                        className="row-menu"
                        aria-label="Xóa"
                        title="Xóa"
                        onClick={() => handleDelete(student.id)}
                      >×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>Hiển thị <b>{students.length}</b> sinh viên</span>
          <span className="pagination">
            <button type="button" disabled>‹</button>
            <button type="button" className="current">1</button>
            <button type="button" disabled>›</button>
          </span>
        </div>
      </section>

      {canCreate && (
      <dialog ref={studentModalRef}>
        <form onSubmit={handleCreateStudent}>
          <div className="modal-heading">
            <div>
              <p className="eyebrow">Hồ sơ mới</p>
              <h2>Thêm sinh viên</h2>
            </div>
            <button type="button" className="close-button" onClick={() => studentModalRef.current?.close()}>×</button>
          </div>

          <div className="form-grid">
            <label>Mã sinh viên<input name="student_code" required placeholder="SV2024010" /></label>
            <label>Họ và tên<input name="full_name" required placeholder="Nguyễn Văn An" /></label>
            <label>Email<input type="email" name="email" required placeholder="email@university.edu.vn" /></label>
            <label>Số điện thoại<input name="phone" placeholder="0901 234 567" /></label>
            <label>Ngày sinh<input type="date" name="date_of_birth" /></label>
            <label>Giới tính<select name="gender" defaultValue="Nam"><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>
            <label>Chuyên ngành<input name="major" required placeholder="Công nghệ thông tin" /></label>
            <label>Lớp<input name="class_name" required placeholder="K18A1" /></label>
            <label>DTB<input type="number" name="dtb" min="0" max="4" step="0.01" defaultValue="0" /></label>
            <label>Trạng thái<select name="status" defaultValue="Đang học"><option>Đang học</option><option>Bảo lưu</option><option>Đã tốt nghiệp</option></select></label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => studentModalRef.current?.close()}>Hủy</button>
            <button type="submit" className="primary-button">Lưu hồ sơ</button>
          </div>
        </form>
      </dialog>
      )}
    </>
  );
}
