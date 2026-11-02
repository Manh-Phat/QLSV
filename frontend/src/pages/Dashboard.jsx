
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';

const PAGE_SIZE = 10;
const EMPTY_STATS = { total: 0, active: 0, average: 0, majors: 0 };
const EMPTY_FILTERS = { q: '', major: '', status: '' };

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
  const [stats, setStats] = useState(EMPTY_STATS);
  const [majors, setMajors] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [accountReceipt, setAccountReceipt] = useState(null);

  const permissions = new Set(user?.permissions || []);
  const canCreate = permissions.has('STUDENT_CREATE');
  const canDelete = permissions.has('STUDENT_DELETE');
  const isAdmin = user?.role === 'ADMIN';

  function showFlash(text, type = 'info') {
    window.clearTimeout(flashTimerRef.current);
    setFlash({ text, type });
    flashTimerRef.current = window.setTimeout(
      () => setFlash(null),
      5500
    );
  }

  useEffect(
    () => () => window.clearTimeout(flashTimerRef.current),
    []
  );

  // Lay danh sach that tu Flask va MySQL.
  useEffect(() => {
    const controller = new AbortController();

    async function loadStudents() {
      setLoading(true);

      const params = new URLSearchParams({
        ...appliedFilters,
        page: String(page),
        page_size: String(PAGE_SIZE),
      });

      try {
        const response = await apiFetch(
          `/api/students?${params}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Không thể tải sinh viên.'
          );
        }

        if (controller.signal.aborted) return;

        const pages = Math.max(
          1,
          Number(data.total_pages) || 1
        );

        if (page > pages) {
          setPage(pages);
          return;
        }

        setStudents(data.students || []);
        setStats(data.stats || EMPTY_STATS);
        setMajors(data.majors || []);
        setFilteredTotal(
          Number(data.filtered_total) || 0
        );
        setTotalPages(pages);
      } catch (err) {
        if (controller.signal.aborted) return;

        setStudents([]);
        setStats(EMPTY_STATS);
        setMajors([]);
        setFilteredTotal(0);
        setTotalPages(1);

        showFlash(
          err.message || 'Không thể kết nối Flask.',
          'error'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadStudents();

    return () => controller.abort();
  }, [appliedFilters, page, refreshKey]);

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters(current => ({
      ...current,
      [name]: value,
    }));
  }

  function handleFilterSubmit(event) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
    setRefreshKey(value => value + 1);
  }

  function refreshList() {
    setRefreshKey(value => value + 1);
  }

  async function handleCreateStudent(event) {
    event.preventDefault();

    if (createBusy) return;

    const form = event.currentTarget;

    setCreateBusy(true);
    setCreateError('');

    try {
      const response = await apiFetch('/api/students', {
        method: 'POST',
        body: new FormData(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Không thể lưu sinh viên.'
        );
      }

      studentModalRef.current?.close();
      form.reset();

      setPage(1);
      refreshList();

      showFlash(
        data.message || 'Đã lưu sinh viên.',
        'success'
      );

      if (data.account) {
        setAccountReceipt({
          fullName: data.student?.full_name || '',
          username: data.account.username,
          password: data.account.initial_password,
        });
      }
    } catch (err) {
      setCreateError(
        err.message || 'Không thể kết nối Flask.'
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleDelete(student) {
    if (deletingId !== null) return;

    if (!window.confirm(
      `Xóa hồ sơ ${student.full_name} và tài khoản STUDENT liên kết?`
    )) {
      return;
    }

    setDeletingId(student.id);

    try {
      const response = await apiFetch(
        `/api/students/${student.id}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Không thể xóa sinh viên.'
        );
      }

      showFlash(
        data.message || 'Đã xóa sinh viên.',
        'success'
      );

      refreshList();
    } catch (err) {
      showFlash(
        err.message || 'Không thể kết nối Flask.',
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  }

  const activeRate = stats.total
    ? Math.round(100 * stats.active / stats.total)
    : 0;

  const first = filteredTotal
    ? (page - 1) * PAGE_SIZE + 1
    : 0;

  const last = Math.min(
    page * PAGE_SIZE,
    filteredTotal
  );

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            Dữ liệu học tập · {user?.role || '—'}
          </p>

          <h1>
            {isAdmin
              ? 'Danh sách sinh viên'
              : 'Hồ sơ của tôi'}
          </h1>

          <p className="subtitle">
            {isAdmin
              ? 'ADMIN có quyền xem, thêm, sửa và xóa hồ sơ sinh viên.'
              : 'STUDENT xem hồ sơ của mình; quyền truy cập do Flask kiểm tra.'}
          </p>
        </div>

        {canCreate && (
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setCreateError('');
              studentModalRef.current?.showModal();
            }}
          >
            <span>＋</span> Thêm sinh viên
          </button>
        )}
      </section>

      <section className="stats-grid">
        <article className="stat-card orange">
          <div className="stat-top">
            <span>Tổng sinh viên</span>
            <span className="stat-icon">♙</span>
          </div>

          <strong>{stats.total}</strong>
          <small>Hồ sơ trong hệ thống</small>
        </article>

        <article className="stat-card blue">
          <div className="stat-top">
            <span>Đang theo học</span>
            <span className="stat-icon">↗</span>
          </div>

          <strong>{stats.active}</strong>

          <small>
            <b>{activeRate}%</b> tổng số sinh viên
          </small>
        </article>

        <article className="stat-card green">
          <div className="stat-top">
            <span>DTB trung bình</span>
            <span className="stat-icon">✦</span>
          </div>

          <strong>
            {Number(stats.average || 0).toFixed(2)}
          </strong>

          <small>Thang điểm 4.0</small>
        </article>

        <article className="stat-card purple">
          <div className="stat-top">
            <span>Chuyên ngành</span>
            <span className="stat-icon">⌘</span>
          </div>

          <strong>{stats.majors}</strong>
          <small>Đang được đào tạo</small>
        </article>
      </section>

      <section className="content-panel" id="students">
        <div className="panel-header">
          <div>
            <h2>
              {isAdmin
                ? 'Sinh viên gần đây'
                : 'Thông tin sinh viên'}
            </h2>

            <p>
              {isAdmin
                ? 'Cập nhật và quản lý thông tin hồ sơ.'
                : 'Dữ liệu lấy từ MySQL qua Flask API.'}
            </p>
          </div>

          {isAdmin && (
            <form
              className="filters"
              onSubmit={handleFilterSubmit}
            >
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

              <select
                name="major"
                value={filters.major}
                onChange={handleFilterChange}
                aria-label="Lọc chuyên ngành"
              >
                <option value="">
                  Tất cả chuyên ngành
                </option>

                {majors.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                aria-label="Lọc trạng thái"
              >
                <option value="">
                  Tất cả trạng thái
                </option>
                <option value="Đang học">
                  Đang học
                </option>
                <option value="Bảo lưu">
                  Bảo lưu
                </option>
                <option value="Đã tốt nghiệp">
                  Đã tốt nghiệp
                </option>
              </select>

              <button
                className="filter-button"
                type="submit"
                disabled={loading}
              >
                Lọc
              </button>
            </form>
          )}
        </div>

        {flash && (
          <div
            className={`inline-flash ${flash.type}`}
            role="status"
          >
            {flash.text}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SINH VIÊN</th>
                <th>CHUYÊN NGÀNH</th>
                <th>LỚP</th>
                <th>DTB</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Không có sinh viên phù hợp.
                  </td>
                </tr>
              ) : students.map((student, index) => (
                <tr key={student.id}>
                  <td>
                    <div className="student-cell">
                      <div
                        className={`student-avatar avatar-${index % 5 + 1}`}
                      >
                        {getInitials(student.full_name)}
                      </div>

                      <div>
                        <strong>{student.full_name}</strong>
                        <small>
                          {student.student_code} · {student.email}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>{student.major}</td>
                  <td>{student.class_name}</td>

                  <td>
                    <strong className="dtb">
                      {Number(student.dtb || 0).toFixed(2)}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`status ${
                        student.status === 'Đang học'
                          ? 'status-active'
                          : 'status-paused'
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>

                  <td className="student-actions">
                    <button
                      type="button"
                      className="row-menu"
                      title="Xem / sửa chi tiết"
                      aria-label="Xem / sửa chi tiết"
                      onClick={() =>
                        navigate(`/students/${student.id}`)
                      }
                    >
                      👁
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        className="row-menu"
                        title="Xóa"
                        aria-label="Xóa"
                        disabled={deletingId !== null}
                        onClick={() => handleDelete(student)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Hiển thị <b>{first}–{last}</b> /{' '}
            <b>{filteredTotal}</b> sinh viên
          </span>

          <span className="pagination">
            <button
              type="button"
              aria-label="Trang trước"
              disabled={loading || page <= 1}
              onClick={() =>
                setPage(value => Math.max(1, value - 1))
              }
            >
              ‹
            </button>

            <button
              type="button"
              className="current"
              disabled
            >
              {page} / {totalPages}
            </button>

            <button
              type="button"
              aria-label="Trang sau"
              disabled={loading || page >= totalPages}
              onClick={() =>
                setPage(value =>
                  Math.min(totalPages, value + 1)
                )
              }
            >
              ›
            </button>
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

              <button
                type="button"
                className="close-button"
                disabled={createBusy}
                onClick={() =>
                  studentModalRef.current?.close()
                }
              >
                ×
              </button>
            </div>

            <div className="form-grid">
              <label>
                Mã sinh viên
                <input
                  name="student_code"
                  required
                  maxLength={20}
                  placeholder="SV2024010"
                />
              </label>

              <label>
                Họ và tên
                <input
                  name="full_name"
                  required
                  maxLength={120}
                  placeholder="Nguyễn Văn An"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={160}
                  placeholder="email@university.edu.vn"
                />
              </label>

              <label>
                Số điện thoại
                <input
                  name="phone"
                  maxLength={20}
                  placeholder="0901 234 567"
                />
              </label>

              <label>
                Ngày sinh
                <input
                  type="date"
                  name="date_of_birth"
                />
              </label>

              <label>
                Giới tính
                <select
                  name="gender"
                  defaultValue="Nam"
                >
                  <option>Nam</option>
                  <option>Nữ</option>
                  <option>Khác</option>
                </select>
              </label>

              <label>
                Chuyên ngành
                <input
                  name="major"
                  required
                  maxLength={120}
                  placeholder="Công nghệ thông tin"
                />
              </label>

              <label>
                Lớp
                <input
                  name="class_name"
                  required
                  maxLength={50}
                  placeholder="K18A1"
                />
              </label>

              <label>
                DTB
                <input
                  type="number"
                  name="dtb"
                  min="0"
                  max="4"
                  step="0.01"
                  defaultValue="0"
                />
              </label>

              <label>
                Trạng thái
                <select
                  name="status"
                  defaultValue="Đang học"
                >
                  <option>Đang học</option>
                  <option>Bảo lưu</option>
                  <option>Đã tốt nghiệp</option>
                </select>
              </label>
            </div>

            {createError && (
              <p
                className="inline-flash error"
                role="alert"
                style={{ margin: '0 28px 12px' }}
              >
                {createError}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={createBusy}
                onClick={() =>
                  studentModalRef.current?.close()
                }
              >
                Hủy
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={createBusy}
              >
                {createBusy
                  ? 'Đang lưu...'
                  : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
        </dialog>
      )}

      {accountReceipt && (
        <div className="account-receipt-backdrop">
          <section
            className="account-receipt-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Thông tin đăng nhập vừa tạo"
          >
            <h2>Đã tạo tài khoản sinh viên</h2>

            <p>{accountReceipt.fullName}</p>

            <dl>
              <dt>Tên đăng nhập</dt>
              <dd>
                <code>{accountReceipt.username}</code>
              </dd>

              <dt>Mật khẩu ban đầu</dt>
              <dd>
                <code>{accountReceipt.password}</code>
              </dd>
            </dl>

            <p className="account-private">
              Thông tin chỉ hiển thị sau khi thêm.
              Cung cấp riêng cho sinh viên và
              yêu cầu đổi mật khẩu.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() => setAccountReceipt(null)}
            >
              Đã lưu thông tin · Đóng
            </button>
          </section>
        </div>
      )}
    </>
  );
}
