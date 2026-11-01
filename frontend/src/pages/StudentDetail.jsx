
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api.js";

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN");
}

export default function StudentDetail() {
  const { studentId } = useParams();

  const [student, setStudent] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // =====================================
  // LẤY THÔNG TIN SINH VIÊN
  // =====================================

  useEffect(() => {
    let active = true;

    async function loadStudent() {
      setLoading(true);
      setError("");
      setMessage("");
      setStudent(null);

      try {
        const response = await apiFetch(
          `/api/students/${studentId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Không tìm thấy sinh viên."
          );
        }

        if (active) {
          setStudent(data.student);
          setNote(data.student.note || "");
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "Không thể tải hồ sơ."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStudent();

    return () => {
      active = false;
    };
  }, [studentId]);

  // =====================================
  // LƯU GHI CHÚ SINH VIÊN
  // =====================================

  async function saveNote(event) {
    event.preventDefault();

    setMessage("");
    setSaving(true);

    try {
      const response = await apiFetch(
        `/api/students/${studentId}/note`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Không thể lưu ghi chú."
        );
      }

      setStudent(data.student);
      setNote(data.student.note || "");
      setMessage("Đã lưu ghi chú thành công.");
    } catch (err) {
      setMessage(
        err.message || "Không thể kết nối Flask."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================
  // HIỂN THỊ TRẠNG THÁI
  // =====================================

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

  // =====================================
  // THÔNG TIN SINH VIÊN
  // =====================================

  const rows = [
    ["Mã sinh viên", student.student_code],
    ["Họ và tên", student.full_name],
    ["Email", student.email],
    ["Số điện thoại", student.phone || "—"],
    ["Ngày sinh", student.date_of_birth || "—"],
    ["Giới tính", student.gender || "—"],
    ["Chuyên ngành", student.major],
    ["Lớp", student.class_name],
    ["DTB", Number(student.dtb || 0).toFixed(2)],
  ];

  return (
    <>
      {/* TIÊU ĐỀ */}

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

        <Link
          className="primary-button link-button"
          to="/"
        >
          ← Quay lại
        </Link>
      </section>

      {/* THÔNG TIN CHI TIẾT */}

      <section className="content-panel">
        <div className="panel-header">
          <div>
            <h2>Thông tin chi tiết</h2>

            <p>
              Thông tin hồ sơ và kết quả học tập
              của sinh viên.
            </p>
          </div>
        </div>

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

          <div className="detail-row">
            <span className="detail-label">
              Trạng thái
            </span>

            <span className="detail-value">
              {student.status}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              Ngày tạo
            </span>

            <span className="detail-value">
              {formatDateTime(student.created_at)}
            </span>
          </div>
        </div>
      </section>

      {/* CHỨC NĂNG GHI CHÚ */}

      <section className="content-panel note-panel">
        <div className="panel-header">
          <div>
            <h2>Ghi chú sinh viên</h2>

            <p>
              Lưu các ghi chú liên quan đến hồ sơ
              sinh viên.
            </p>
          </div>
        </div>

        <div className="note-body">
          <form
            onSubmit={saveNote}
            className="note-form"
          >
            <textarea
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              rows={5}
              placeholder="Nhập ghi chú..."
            />

            <button
              className="primary-button"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Đang lưu..."
                : "Lưu ghi chú"}
            </button>

            {message && (
              <span>{message}</span>
            )}
          </form>

          {/* VULN-04: STORED XSS
              Cố ý render HTML không an toàn.
              Chỉ sử dụng trên môi trường lab.
          */}

          <div className="note-preview">
            <strong>Ghi chú đã lưu:</strong>

            <div
              className="raw-note"
              dangerouslySetInnerHTML={{
                __html: student.note || "",
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
