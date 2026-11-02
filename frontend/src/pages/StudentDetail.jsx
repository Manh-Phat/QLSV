
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api.js';

const GENDERS = ['Nam', 'Nữ', 'Khác'];
const STATUSES = [
  'Đang học',
  'Bảo lưu',
  'Đã tốt nghiệp'
];

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN');
}

function editableFields(student) {
  return {
    full_name: student.full_name || '',
    email: student.email || '',
    phone: student.phone || '',
    date_of_birth: student.date_of_birth || '',
    gender: student.gender || 'Khác',
    major: student.major || '',
    class_name: student.class_name || '',
    dtb: String(student.dtb ?? 0),
    status: student.status || 'Đang học',
  };
}

export default function StudentDetail({ user }) {
  const { studentId } = useParams();

  const [student, setStudent] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const canEdit =
    user?.role === 'ADMIN' &&
    (user?.permissions || []).includes('STUDENT_UPDATE');

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      setStudent(null);
      setEditing(false);
      setMessage('');
      setProfileMessage('');

      try {
        const response = await apiFetch(
          `/api/students/${studentId}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || 'Không tìm thấy sinh viên.'
          );
        }

        if (controller.signal.aborted) return;

        setStudent(data.student);
        setNote(data.student.note || '');
        setEditForm(editableFields(data.student));
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || 'Không thể tải hồ sơ.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [studentId]);

  function startEdit() {
    setEditForm(editableFields(student));
    setProfileError('');
    setProfileMessage('');
    setEditing(true);
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditForm(current => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!canEdit || savingProfile) return;

    setSavingProfile(true);
    setProfileError('');
    setProfileMessage('');

    try {
      const response = await apiFetch(
        `/api/students/${studentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editForm),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Không thể sửa hồ sơ.'
        );
      }

      setStudent(data.student);
      setEditForm(editableFields(data.student));

      setProfileMessage(
        data.message || 'Đã cập nhật hồ sơ sinh viên.'
      );

      setEditing(false);
    } catch (err) {
      setProfileError(
        err.message || 'Không thể kết nối Flask.'
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveNote(event) {
    event.preventDefault();

    if (savingNote) return;

    setMessage('');
    setSavingNote(true);

    try {
      const response = await apiFetch(
        `/api/students/${studentId}/note`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ note }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Không thể lưu ghi chú.'
        );
      }

      setStudent(data.student);
      setNote(data.student.note || '');
      setMessage('Đã lưu ghi chú thành công.');
    } catch (err) {
      setMessage(
        err.message || 'Không thể kết nối Flask.'
      );
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        Đang tải hồ sơ sinh viên...
      </div>
    );
  }

  if (error) {
    return (
      <section className="content-panel access-error">
        <h2>Không thể truy cập hồ sơ</h2>
        <p>{error}</p>

        <Link
          className="primary-button link-button"
          to="/"
        >
          ← Quay lại
        </Link>
      </section>
    );
  }

  if (!student) {
    return (
      <div className="empty-state">
        Không tìm thấy sinh viên.
      </div>
    );
  }

  const rows = [
    ['Mã sinh viên', student.student_code],
    ['Họ và tên', student.full_name],
    ['Email', student.email],
    ['Số điện thoại', student.phone || '—'],
    ['Ngày sinh', student.date_of_birth || '—'],
    ['Giới tính', student.gender || '—'],
    ['Chuyên ngành', student.major],
    ['Lớp', student.class_name],
    ['DTB', Number(student.dtb || 0).toFixed(2)],
    ['Trạng thái', student.status],
    ['Ngày tạo', formatDateTime(student.created_at)],
  ];

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            Hồ sơ sinh viên
          </p>

          <h1>{student.full_name}</h1>

          <p className="subtitle">
            {student.student_code} · {student.major}
          </p>
        </div>

        <div className="profile-heading-actions">
          {canEdit && !editing && (
            <button
              type="button"
              className="primary-button"
              onClick={startEdit}
            >
              ✎ Sửa hồ sơ
            </button>
          )}

          <Link className="secondary-link" to="/">
            ← Quay lại
          </Link>
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-header">
          <div>
            <h2>
              {editing
                ? 'Chỉnh sửa thông tin sinh viên'
                : 'Thông tin chi tiết'}
            </h2>

            <p>
              {editing
                ? 'Mã sinh viên không thể đổi sau khi tạo tài khoản.'
                : 'Thông tin hồ sơ và kết quả học tập của sinh viên.'}
            </p>
          </div>
        </div>

        {profileMessage && (
          <div
            className="inline-flash success"
            role="status"
          >
            {profileMessage}
          </div>
        )}

        {editing && editForm ? (
          <form onSubmit={saveProfile}>
            <div className="profile-edit-grid">
              <label>
                Mã sinh viên
                <input
                  value={student.student_code}
                  disabled
                />
              </label>

              <label>
                Họ và tên
                <input
                  name="full_name"
                  value={editForm.full_name}
                  onChange={handleEditChange}
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  maxLength={160}
                  required
                />
              </label>

              <label>
                Số điện thoại
                <input
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  maxLength={20}
                />
              </label>

              <label>
                Ngày sinh
                <input
                  name="date_of_birth"
                  type="date"
                  value={editForm.date_of_birth}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Giới tính
                <select
                  name="gender"
                  value={editForm.gender}
                  onChange={handleEditChange}
                >
                  {GENDERS.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label>
                Chuyên ngành
                <input
                  name="major"
                  value={editForm.major}
                  onChange={handleEditChange}
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Lớp
                <input
                  name="class_name"
                  value={editForm.class_name}
                  onChange={handleEditChange}
                  maxLength={50}
                  required
                />
              </label>

              <label>
                DTB
                <input
                  name="dtb"
                  type="number"
                  min="0"
                  max="4"
                  step="0.01"
                  value={editForm.dtb}
                  onChange={handleEditChange}
                  required
                />
              </label>

              <label>
                Trạng thái
                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                >
                  {STATUSES.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>

            {profileError && (
              <div
                className="inline-flash error"
                role="alert"
              >
                {profileError}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={savingProfile}
                onClick={() => {
                  setEditing(false);
                  setProfileError('');
                }}
              >
                Hủy
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={savingProfile}
              >
                {savingProfile
                  ? 'Đang lưu...'
                  : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        ) : (
          <div className="detail-grid">
            {rows.map(([label, value]) => (
              <div
                className="detail-row"
                key={label}
              >
                <span className="detail-label">
                  {label}
                </span>

                <span className="detail-value">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="content-panel note-panel">
        <div className="panel-header">
          <div>
            <h2>Ghi chú sinh viên</h2>

            <p>
              Lưu các ghi chú liên quan đến
              hồ sơ sinh viên.
            </p>
          </div>
        </div>

        <div className="note-body">
          <form
            className="note-form"
            onSubmit={saveNote}
          >
            <textarea
              value={note}
              onChange={event =>
                setNote(event.target.value)
              }
              rows={5}
              maxLength={5000}
              placeholder="Nhập ghi chú..."
            />

            <button
              className="primary-button"
              type="submit"
              disabled={savingNote}
            >
              {savingNote
                ? 'Đang lưu...'
                : 'Lưu ghi chú'}
            </button>

            {message && (
              <span role="status">{message}</span>
            )}
          </form>

          <div className="note-preview">
            <strong>Ghi chú đã lưu:</strong>

            {/* VULN-04: Stored XSS cố ý trong lab. */}
            <div
              className="raw-note"
              dangerouslySetInnerHTML={{
                __html: student.note || '',
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
