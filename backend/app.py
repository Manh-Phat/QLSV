import os
import re
import hashlib
import hmac
import secrets

from datetime import date, datetime
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, or_
from sqlalchemy.exc import IntegrityError
from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)


load_dotenv()

db = SQLAlchemy()

PAGE_SIZE = 10

ROLE_PERMISSIONS = {
    "ADMIN": {
        "STUDENT_LIST_ALL",
        "STUDENT_CREATE",
        "STUDENT_UPDATE",
        "STUDENT_DELETE",
        "STUDENT_VIEW_ANY",
        "STUDENT_NOTE_UPDATE_ANY",
        "ACCOUNT_VIEW",
        "ACCOUNT_ROLE_ASSIGN",
        "ACCOUNT_RESET_PASSWORD",
    },
    "STUDENT": {
        "STUDENT_VIEW_OWN",
        "STUDENT_NOTE_UPDATE_OWN",
    },
}

GENDERS = {"Nam", "Nữ", "Khác"}

STATUSES = {
    "Đang học",
    "Bảo lưu",
    "Đã tốt nghiệp",
}

EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
CODE = re.compile(r"^[A-Za-z0-9_-]{3,20}$")
PHONE = re.compile(r"^[0-9+() .-]{0,20}$")


# ==================================================
# 1. DATABASE MODELS
# ==================================================

class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    student_code = db.Column(
        db.String(20),
        nullable=False,
        unique=True,
    )

    full_name = db.Column(
        db.String(120),
        nullable=False,
    )

    email = db.Column(
        db.String(160),
        nullable=False,
        unique=True,
    )

    phone = db.Column(db.String(20))

    date_of_birth = db.Column(db.Date)

    gender = db.Column(
        db.String(10),
        nullable=False,
        default="Khác",
    )

    major = db.Column(
        db.String(120),
        nullable=False,
    )

    class_name = db.Column(
        db.String(50),
        nullable=False,
    )

    dtb = db.Column(
        db.Numeric(3, 2),
        nullable=False,
        default=0,
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="Đang học",
    )

    note = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    username = db.Column(
        db.String(50),
        nullable=False,
        unique=True,
    )

    pass_ = db.Column(
        "pass",
        db.String(255),
        nullable=False,
    )

    role = db.Column(
        db.String(20),
        nullable=False,
        default="STUDENT",
    )

    student_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "students.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=True,
    )

    failed_login_attempts = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    locked_until = db.Column(db.DateTime)


# ==================================================
# 2. HAM HO TRO
# ==================================================

def serialize_student(student):
    return {
        "id": student.id,
        "student_code": student.student_code,
        "full_name": student.full_name,
        "email": student.email,
        "phone": student.phone or "",
        "date_of_birth": (
            student.date_of_birth.isoformat()
            if student.date_of_birth else None
        ),
        "gender": student.gender,
        "major": student.major,
        "class_name": student.class_name,
        "dtb": float(student.dtb or 0),
        "status": student.status,
        "note": student.note or "",
        "created_at": (
            student.created_at.isoformat()
            if student.created_at else None
        ),
        "updated_at": (
            student.updated_at.isoformat()
            if student.updated_at else None
        ),
    }


def permissions_for_role(role):
    return sorted(
        ROLE_PERMISSIONS.get(role or "", set())
    )


def api_error(message, status):
    return jsonify({
        "ok": False,
        "message": message,
    }), status


def current_account():
    return getattr(g, "account", None)


def auth_stamp(account):
    """
    Vo hieu hoa session cu khi doi password
    hoac thay doi vai tro.
    """
    raw = f"{account.role}:{account.pass_}"
    return hashlib.sha256(
        raw.encode("utf-8")
    ).hexdigest()


def serialize_account(account, student=None):
    """
    Khong tra password hash ve frontend.

    Neu password hien tai van la ma sinh vien,
    ADMIN co the xem password mac dinh.
    """
    if student is None and account.student_id:
        student = db.session.get(
            Student,
            account.student_id,
        )

    has_default_password = bool(
        student
        and account.role == "STUDENT"
        and check_password_hash(
            account.pass_,
            student.student_code,
        )
    )

    return {
        "id": account.id,
        "username": account.username,
        "role": account.role,
        "student_id": account.student_id,
        "student_code": (
            student.student_code
            if student else None
        ),
        "full_name": (
            student.full_name
            if student else None
        ),
        "password_state": (
            "default"
            if has_default_password
            else "changed_or_private"
        ),
        "default_password": (
            student.student_code
            if has_default_password
            else None
        ),
    }


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_account() is None:
            return api_error(
                "Bạn chưa đăng nhập.",
                401,
            )

        return view(*args, **kwargs)

    return wrapped


def permission_required(permission):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            account = current_account()

            if account is None:
                return api_error(
                    "Bạn chưa đăng nhập.",
                    401,
                )

            permissions = ROLE_PERMISSIONS.get(
                account.role,
                set(),
            )

            if permission not in permissions:
                return api_error(
                    "Bạn không có quyền thực hiện thao tác này.",
                    403,
                )

            return view(*args, **kwargs)

        return wrapped

    return decorator


# ==================================================
# 3. VALIDATION SINH VIEN
# ==================================================

def validated_student_fields(payload, *, creating=False):

    def value(name):
        return str(
            payload.get(name) or ""
        ).strip()

    data = {}

    if creating:
        code = value("student_code")

        if not CODE.fullmatch(code):
            raise ValueError(
                "Mã sinh viên phải dài 3–20 ký tự "
                "chữ, số, _ hoặc -."
            )

        data["student_code"] = code

    required_fields = (
        ("full_name", 120, "Họ tên"),
        ("email", 160, "Email"),
        ("major", 120, "Chuyên ngành"),
        ("class_name", 50, "Lớp"),
    )

    for key, limit, title in required_fields:
        text_value = value(key)

        if not text_value or len(text_value) > limit:
            raise ValueError(
                f"{title} là bắt buộc và "
                f"không được dài quá {limit} ký tự."
            )

        data[key] = text_value

    if not EMAIL.fullmatch(data["email"]):
        raise ValueError(
            "Email không đúng định dạng."
        )

    phone = value("phone")

    if not PHONE.fullmatch(phone):
        raise ValueError(
            "Số điện thoại không hợp lệ."
        )

    data["phone"] = phone

    raw_date = value("date_of_birth")

    if raw_date:
        try:
            birthday = date.fromisoformat(raw_date)
        except ValueError as exc:
            raise ValueError(
                "Ngày sinh không hợp lệ."
            ) from exc

        if birthday > date.today():
            raise ValueError(
                "Ngày sinh không được ở tương lai."
            )

        data["date_of_birth"] = birthday
    else:
        data["date_of_birth"] = None

    gender = value("gender") or "Khác"
    status = value("status") or "Đang học"

    if gender not in GENDERS:
        raise ValueError(
            "Giới tính không hợp lệ."
        )

    if status not in STATUSES:
        raise ValueError(
            "Trạng thái không hợp lệ."
        )

    data["gender"] = gender
    data["status"] = status

    try:
        grade = round(
            float(value("dtb") or "0"),
            2,
        )
    except ValueError as exc:
        raise ValueError(
            "Điểm trung bình phải là số."
        ) from exc

    if grade != grade or not 0 <= grade <= 4:
        raise ValueError(
            "Điểm trung bình phải từ 0 đến 4."
        )

    data["dtb"] = grade

    return data


# ==================================================
# 4. KHOI TAO FLASK
# ==================================================

def create_app():

    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@127.0.0.1:3306/student_db",
    )

    app.config[
        "SQLALCHEMY_TRACK_MODIFICATIONS"
    ] = False

    # VULN-05: Cau hinh yeu co y cho pentest lab.
    app.config["SECRET_KEY"] = "123456"
    app.config["SESSION_COOKIE_HTTPONLY"] = False
    app.config["SESSION_COOKIE_SAMESITE"] = None

    CORS(
        app,
        resources={
            r"/api/*": {"origins": "*"}
        },
        supports_credentials=True,
    )

    db.init_app(app)

    # ==============================================
    # KIEM TRA SESSION
    # ==============================================

    @app.before_request
    def resolve_session_account():

        g.account = None

        account_id = session.get("account_id")

        if not account_id:
            return

        account = db.session.get(
            Account,
            account_id,
        )

        if (
            account is None
            or account.role not in ROLE_PERMISSIONS
        ):
            session.clear()
            return

        expected = auth_stamp(account)

        received = str(
            session.get("auth_stamp") or ""
        )

        if not hmac.compare_digest(
            received,
            expected,
        ):
            session.clear()
            return

        if account.role == "STUDENT":
            student = (
                db.session.get(
                    Student,
                    account.student_id,
                )
                if account.student_id
                else None
            )

            if student is None:
                session.clear()
                return

        g.account = account

        session["username"] = account.username
        session["role"] = account.role
        session["student_id"] = account.student_id

    # ==============================================
    # 5. DANG NHAP
    # ==============================================

    @app.post("/api/login")
    def api_login():

        # VULN-03: Khong gioi han so lan login sai.
        payload = (
            request.get_json(silent=True)
            or request.form
        )

        username = str(
            payload.get("username") or ""
        ).strip()

        password = str(
            payload.get("password") or ""
        )

        account = db.session.scalar(
            db.select(Account).where(
                Account.username == username
            )
        )

        if not account:
            return api_error(
                "Username không tồn tại.",
                401,
            )

        if account.role == "STUDENT":
            student = (
                db.session.get(
                    Student,
                    account.student_id,
                )
                if account.student_id
                else None
            )

            if student is None:
                return api_error(
                    "Tài khoản không liên kết hồ sơ sinh viên.",
                    403,
                )

        if not check_password_hash(
            account.pass_,
            password,
        ):
            return api_error(
                "Password không đúng.",
                401,
            )

        session.clear()

        session["account_id"] = account.id
        session["auth_stamp"] = auth_stamp(account)
        session["username"] = account.username
        session["role"] = account.role
        session["student_id"] = account.student_id

        return jsonify({
            "ok": True,
            "message": "Đăng nhập thành công.",
            "user": {
                "username": account.username,
                "role": account.role,
                "student_id": account.student_id,
                "permissions": permissions_for_role(
                    account.role
                ),
            },
        })

    # ==============================================
    # DANG XUAT
    # ==============================================

    @app.post("/api/logout")
    def api_logout():

        session.clear()

        return jsonify({
            "ok": True,
            "message": "Đăng xuất thành công.",
        })

    # ==============================================
    # KIEM TRA DANG NHAP
    # ==============================================

    @app.get("/api/session")
    def api_session():

        account = current_account()

        if account is None:
            return jsonify({
                "logged_in": False,
            })

        return jsonify({
            "logged_in": True,
            "username": account.username,
            "role": account.role,
            "student_id": account.student_id,
            "permissions": permissions_for_role(
                account.role
            ),
        })

    @app.get("/api/rbac/me")
    @login_required
    def rbac_me():

        account = current_account()

        return jsonify({
            "role": account.role,
            "student_id": account.student_id,
            "permissions": permissions_for_role(
                account.role
            ),
        })

    # ==============================================
    # 6. DOI MAT KHAU CA NHAN
    # ==============================================

    @app.post("/api/account/change-password")
    @login_required
    def change_password():

        payload = request.get_json(
            silent=True
        ) or {}

        old_password = str(
            payload.get("old_password") or ""
        )

        new_password = str(
            payload.get("new_password") or ""
        )

        if not 8 <= len(new_password) <= 128:
            return api_error(
                "Mật khẩu mới phải dài từ 8 đến 128 ký tự.",
                400,
            )

        account = current_account()

        if not check_password_hash(
            account.pass_,
            old_password,
        ):
            return api_error(
                "Mật khẩu hiện tại không đúng.",
                400,
            )

        if old_password == new_password:
            return api_error(
                "Mật khẩu mới phải khác mật khẩu cũ.",
                400,
            )

        try:
            account.pass_ = generate_password_hash(
                new_password
            )

            db.session.commit()

            session["auth_stamp"] = auth_stamp(
                account
            )

        except Exception:
            db.session.rollback()

            return api_error(
                "Không thể đổi mật khẩu.",
                500,
            )

        return jsonify({
            "ok": True,
            "message": "Đổi mật khẩu thành công.",
        })

    # ==============================================
    # 7. KHOI TAO ADMIN DAU TIEN
    # ==============================================

    @app.post("/api/setup/admin")
    def setup_first_admin():
        """
        Chi su dung khi database chua co ADMIN.

        Yeu cau ADMIN_SETUP_TOKEN trong .env.
        Khong phai API dang ky cong khai.
        """

        setup_token = os.getenv(
            "ADMIN_SETUP_TOKEN",
            "",
        )

        if (
            len(setup_token) < 24
            or request.remote_addr
                not in ("127.0.0.1", "::1")
        ):
            return api_error(
                "Không có chức năng thiết lập công khai.",
                404,
            )

        supplied = request.headers.get(
            "X-Setup-Token",
            "",
        )

        if not hmac.compare_digest(
            supplied,
            setup_token,
        ):
            return api_error(
                "Mã thiết lập không hợp lệ.",
                403,
            )

        existing_admin = db.session.scalar(
            db.select(Account.id).where(
                Account.role == "ADMIN"
            )
        )

        if existing_admin is not None:
            return api_error(
                "ADMIN đầu tiên đã được khởi tạo.",
                409,
            )

        payload = request.get_json(
            silent=True
        ) or {}

        username = str(
            payload.get("username") or "admin"
        ).strip()

        password = str(
            payload.get("password") or ""
        )

        if not re.fullmatch(
            r"[A-Za-z0-9_-]{3,50}",
            username,
        ):
            return api_error(
                "Tên ADMIN không hợp lệ.",
                400,
            )

        if not 12 <= len(password) <= 128:
            return api_error(
                "Mật khẩu ADMIN phải dài từ 12 đến 128 ký tự.",
                400,
            )

        existing_username = db.session.scalar(
            db.select(Account.id).where(
                Account.username == username
            )
        )

        if existing_username is not None:
            return api_error(
                "Tên đăng nhập đã tồn tại.",
                409,
            )

        try:
            admin = Account(
                username=username,
                pass_=generate_password_hash(
                    password
                ),
                role="ADMIN",
                student_id=None,
            )

            db.session.add(admin)
            db.session.commit()

        except IntegrityError:
            db.session.rollback()

            return api_error(
                "Không thể khởi tạo ADMIN.",
                409,
            )

        return jsonify({
            "ok": True,
            "message": "Đã tạo ADMIN đầu tiên.",
            "username": username,
            "role": "ADMIN",
        }), 201

    # ==============================================
    # 8. DANH SACH TAI KHOAN
    # ==============================================

    @app.get("/api/accounts")
    @permission_required("ACCOUNT_VIEW")
    def accounts_list():

        try:
            page = int(
                request.args.get("page", 1)
            )

            page_size = int(
                request.args.get("page_size", 10)
            )

        except (TypeError, ValueError):
            return api_error(
                "Thông số phân trang không hợp lệ.",
                400,
            )

        if (
            page < 1
            or page_size < 1
            or page_size > 50
        ):
            return api_error(
                "Thông số phân trang phải hợp lệ.",
                400,
            )

        q = (
            request.args.get("q") or ""
        ).strip()[:100]

        role = (
            request.args.get("role") or ""
        ).strip()

        if role and role not in ROLE_PERMISSIONS:
            return api_error(
                "Vai trò không hợp lệ.",
                400,
            )

        query = (
            db.session.query(Account, Student)
            .outerjoin(
                Student,
                Account.student_id == Student.id,
            )
        )

        if role:
            query = query.filter(
                Account.role == role
            )

        if q:
            pattern = f"%{q}%"

            query = query.filter(
                or_(
                    Account.username.ilike(pattern),
                    Student.student_code.ilike(pattern),
                    Student.full_name.ilike(pattern),
                )
            )

        total = query.count()

        rows = (
            query
            .order_by(Account.id.desc())
            .offset(
                (page - 1) * page_size
            )
            .limit(page_size)
            .all()
        )

        accounts = [
            serialize_account(account, student)
            for account, student in rows
        ]

        return jsonify({
            "ok": True,
            "accounts": accounts,
            "page": page,
            "page_size": page_size,
            "filtered_total": total,
            "total_pages": max(
                1,
                (total + page_size - 1) // page_size,
            ),
        })

    # ==============================================
    # 9. CAP / THU HOI QUYEN ADMIN
    # ==============================================

    @app.patch("/api/accounts/<int:account_id>/role")
    @permission_required("ACCOUNT_ROLE_ASSIGN")
    def accounts_assign_role(account_id):

        payload = request.get_json(
            silent=True
        ) or {}

        new_role = str(
            payload.get("role") or ""
        ).strip().upper()

        if new_role not in ROLE_PERMISSIONS:
            return api_error(
                "Chỉ cho phép ADMIN hoặc STUDENT.",
                400,
            )

        account = db.session.get(
            Account,
            account_id,
        )

        if account is None:
            return api_error(
                "Không tìm thấy tài khoản.",
                404,
            )

        if (
            account.id == current_account().id
            and new_role != account.role
        ):
            return api_error(
                "Không thể tự thay đổi vai trò của mình.",
                403,
            )

        if account.role == new_role:
            return jsonify({
                "ok": True,
                "message": "Vai trò không thay đổi.",
                "account": serialize_account(account),
            })

        if (
            new_role == "STUDENT"
            and account.student_id is None
        ):
            return api_error(
                "Tài khoản không có hồ sơ sinh viên.",
                400,
            )

        temporary_password = None

        # Khi nang STUDENT thanh ADMIN,
        # thay mat khau mac dinh de tranh de doan.
        if (
            new_role == "ADMIN"
            and account.student_id
        ):
            student = db.session.get(
                Student,
                account.student_id,
            )

            if (
                student
                and check_password_hash(
                    account.pass_,
                    student.student_code,
                )
            ):
                temporary_password = (
                    secrets.token_urlsafe(18)
                )

                account.pass_ = (
                    generate_password_hash(
                        temporary_password
                    )
                )

        account.role = new_role

        try:
            db.session.commit()

        except Exception:
            db.session.rollback()

            return api_error(
                "Không thể cập nhật vai trò.",
                500,
            )

        return jsonify({
            "ok": True,
            "message": "Đã cập nhật vai trò.",
            "account": serialize_account(account),
            "temporary_password": temporary_password,
        })

    # ==============================================
    # 10. ADMIN DAT LAI MAT KHAU
    # ==============================================

    @app.post(
        "/api/accounts/<int:account_id>/reset-password"
    )
    @permission_required("ACCOUNT_RESET_PASSWORD")
    def accounts_reset_password(account_id):

        account = db.session.get(
            Account,
            account_id,
        )

        if account is None:
            return api_error(
                "Không tìm thấy tài khoản.",
                404,
            )

        if (
            account.role != "STUDENT"
            or not account.student_id
        ):
            return api_error(
                "Chỉ đặt lại mật khẩu cho STUDENT.",
                400,
            )

        student = db.session.get(
            Student,
            account.student_id,
        )

        if student is None:
            return api_error(
                "Không tìm thấy hồ sơ sinh viên.",
                400,
            )

        if account.username != student.student_code:

            conflict = db.session.scalar(
                db.select(Account).where(
                    Account.username
                    == student.student_code
                )
            )

            if (
                conflict is not None
                and conflict.id != account.id
            ):
                return api_error(
                    "Mã sinh viên đã được sử dụng.",
                    409,
                )

            account.username = student.student_code

        account.pass_ = generate_password_hash(
            student.student_code
        )

        account.failed_login_attempts = 0
        account.locked_until = None

        try:
            db.session.commit()

        except Exception:
            db.session.rollback()

            return api_error(
                "Không thể đặt lại mật khẩu.",
                500,
            )

        return jsonify({
            "ok": True,
            "message": "Đã đặt lại mật khẩu.",
            "username": account.username,
            "initial_password": student.student_code,
        })

    # ==============================================
    # 11. DANH SACH SINH VIEN
    # ==============================================

    @app.get("/api/students")
    @login_required
    def students_list():

        q = (
            request.args.get("q") or ""
        ).strip()

        status = (
            request.args.get("status") or ""
        ).strip()

        major = (
            request.args.get("major") or ""
        ).strip()

        if status and status not in STATUSES:
            return api_error(
                "Trạng thái lọc không hợp lệ.",
                400,
            )

        try:
            page = int(
                request.args.get("page", "1")
            )

            page_size = int(
                request.args.get(
                    "page_size",
                    str(PAGE_SIZE),
                )
            )

        except (TypeError, ValueError):
            return api_error(
                "Thông số phân trang không hợp lệ.",
                400,
            )

        if (
            page < 1
            or page_size < 1
            or page_size > 50
        ):
            return api_error(
                "Thông số phân trang không hợp lệ.",
                400,
            )

        account = current_account()

        scope = Student.query

        if account.role == "STUDENT":
            scope = scope.filter(
                Student.id == account.student_id
            )

        scope_students = scope.all()

        majors = sorted({
            s.major for s in scope_students
        })

        stats = {
            "total": len(scope_students),
            "active": sum(
                s.status == "Đang học"
                for s in scope_students
            ),
            "average": (
                round(
                    sum(
                        float(s.dtb or 0)
                        for s in scope_students
                    ) / len(scope_students),
                    2,
                )
                if scope_students else 0
            ),
            "majors": len(majors),
        }

        if q:
            # VULN-01: SQL INJECTION CO Y.
            # Chi su dung trong lab duoc phep.
            conditions = []

            if account.role == "STUDENT":
                conditions.append(
                    f"id = {int(account.student_id)}"
                )

            conditions.append(
                "(full_name LIKE '%" + q +
                "%' OR student_code LIKE '%" + q +
                "%' OR email LIKE '%" + q + "%')"
            )

            params = {}

            if status:
                conditions.append(
                    "status = :status"
                )
                params["status"] = status

            if major:
                conditions.append(
                    "major = :major"
                )
                params["major"] = major

            sql = (
                "SELECT id FROM students WHERE "
                + " AND ".join(conditions)
                + " ORDER BY id DESC"
            )

            try:
                rows = db.session.execute(
                    text(sql),
                    params,
                ).mappings().all()

            except Exception as exc:
                db.session.rollback()

                # Hien loi SQL co y de minh chung lab.
                return api_error(
                    str(exc),
                    500,
                )

            ids = list(
                dict.fromkeys(
                    row["id"] for row in rows
                )
            )

            total_filtered = len(ids)

            page_ids = ids[
                (page - 1) * page_size:
                page * page_size
            ]

            if page_ids:
                matched = Student.query.filter(
                    Student.id.in_(page_ids)
                ).all()

                by_id = {
                    s.id: s for s in matched
                }

                students = [
                    by_id[i]
                    for i in page_ids
                    if i in by_id
                ]
            else:
                students = []

        else:
            query = scope

            if status:
                query = query.filter_by(
                    status=status
                )

            if major:
                query = query.filter_by(
                    major=major
                )

            total_filtered = query.count()

            students = (
                query
                .order_by(Student.id.desc())
                .offset(
                    (page - 1) * page_size
                )
                .limit(page_size)
                .all()
            )

        return jsonify({
            "students": [
                serialize_student(s)
                for s in students
            ],
            "majors": majors,
            "stats": stats,
            "filtered_total": total_filtered,
            "page": page,
            "page_size": page_size,
            "total_pages": max(
                1,
                (
                    total_filtered + page_size - 1
                ) // page_size,
            ),
        })

    # ==============================================
    # 12. THEM SINH VIEN + TU TAO TAI KHOAN
    # ==============================================

    @app.post("/api/students")
    @permission_required("STUDENT_CREATE")
    def student_create():

        payload = (
            request.get_json(silent=True)
            or request.form
        )

        try:
            fields = validated_student_fields(
                payload,
                creating=True,
            )

            code = fields["student_code"]

            exists = db.session.scalar(
                db.select(Account).where(
                    Account.username == code
                )
            )

            if exists:
                return api_error(
                    "Mã sinh viên đã được dùng làm tài khoản.",
                    409,
                )

            student = Student(**fields)

            db.session.add(student)

            # Lay ID trong transaction.
            db.session.flush()

            account = Account(
                username=code,
                pass_=generate_password_hash(code),
                role="STUDENT",
                student_id=student.id,
                failed_login_attempts=0,
                locked_until=None,
            )

            db.session.add(account)

            # Luu ca hai bang cung luc.
            db.session.commit()

            return jsonify({
                "ok": True,
                "message": (
                    "Đã thêm sinh viên và tạo tài khoản."
                ),
                "student": serialize_student(student),
                "account": {
                    "username": code,
                    "initial_password": code,
                    "role": "STUDENT",
                },
            }), 201

        except ValueError as exc:
            db.session.rollback()

            return api_error(
                str(exc),
                400,
            )

        except IntegrityError:
            db.session.rollback()

            return api_error(
                "Mã sinh viên, email hoặc tài khoản đã tồn tại.",
                409,
            )

        except Exception:
            db.session.rollback()

            app.logger.exception(
                "Failed to create student"
            )

            return api_error(
                "Không thể thêm sinh viên.",
                500,
            )

    # ==============================================
    # 13. CAP NHAT SINH VIEN
    # ==============================================

    @app.put("/api/students/<int:student_id>")
    @permission_required("STUDENT_UPDATE")
    def student_update(student_id):

        student = db.session.get(
            Student,
            student_id,
        )

        if student is None:
            return api_error(
                "Không tìm thấy sinh viên.",
                404,
            )

        payload = (
            request.get_json(silent=True)
            or request.form
        )

        if (
            payload.get("student_code")
            and str(payload.get("student_code"))
                != student.student_code
        ):
            return api_error(
                "Không thể đổi mã sinh viên sau khi tạo tài khoản.",
                400,
            )

        try:
            fields = validated_student_fields(
                payload
            )

            for key, value in fields.items():
                setattr(
                    student,
                    key,
                    value,
                )

            db.session.commit()

            return jsonify({
                "ok": True,
                "message": "Đã cập nhật hồ sơ sinh viên.",
                "student": serialize_student(student),
            })

        except ValueError as exc:
            db.session.rollback()

            return api_error(
                str(exc),
                400,
            )

        except IntegrityError:
            db.session.rollback()

            return api_error(
                "Email đã được sử dụng.",
                409,
            )

        except Exception:
            db.session.rollback()

            app.logger.exception(
                "Failed to update student"
            )

            return api_error(
                "Không thể cập nhật sinh viên.",
                500,
            )

    # ==============================================
    # 14. CAP LAI TAI KHOAN CHO HO SO SINH VIEN
    # ==============================================

    @app.post(
        "/api/students/<int:student_id>/reset-account"
    )
    @permission_required("STUDENT_CREATE")
    def student_reset_account(student_id):

        student = db.session.get(
            Student,
            student_id,
        )

        if student is None:
            return api_error(
                "Không tìm thấy sinh viên.",
                404,
            )

        account = db.session.scalar(
            db.select(Account).where(
                Account.student_id == student.id
            )
        )

        # Khong reset tai khoan da duoc cap ADMIN.
        if (
            account is not None
            and account.role != "STUDENT"
        ):
            return api_error(
                "Không thể đặt lại mật khẩu ADMIN.",
                403,
            )

        try:
            if account is None:

                exists = db.session.scalar(
                    db.select(Account).where(
                        Account.username
                        == student.student_code
                    )
                )

                if exists:
                    return api_error(
                        "Tên tài khoản đã tồn tại.",
                        409,
                    )

                account = Account(
                    username=student.student_code,
                    role="STUDENT",
                    student_id=student.id,
                )

                db.session.add(account)

            if account.username != student.student_code:

                conflict = db.session.scalar(
                    db.select(Account).where(
                        Account.username
                        == student.student_code
                    )
                )

                if (
                    conflict is not None
                    and conflict.id != account.id
                ):
                    return api_error(
                        "Mã sinh viên đã được sử dụng.",
                        409,
                    )

                account.username = student.student_code

            account.pass_ = generate_password_hash(
                student.student_code
            )

            account.failed_login_attempts = 0
            account.locked_until = None

            db.session.commit()

            return jsonify({
                "ok": True,
                "message": "Đã cấp lại tài khoản.",
                "account": {
                    "username": account.username,
                    "initial_password": student.student_code,
                    "role": "STUDENT",
                },
            })

        except IntegrityError:
            db.session.rollback()

            return api_error(
                "Tài khoản đã tồn tại.",
                409,
            )

        except Exception:
            db.session.rollback()

            app.logger.exception(
                "Failed to reset account"
            )

            return api_error(
                "Không thể cấp lại tài khoản.",
                500,
            )

    # ==============================================
    # 15. XOA SINH VIEN
    # ==============================================

    @app.delete("/api/students/<int:student_id>")
    @permission_required("STUDENT_DELETE")
    def student_delete(student_id):

        student = db.session.get(
            Student,
            student_id,
        )

        if student is None:
            return api_error(
                "Không tìm thấy sinh viên.",
                404,
            )

        name = student.full_name

        try:
            # Xoa tai khoan lien ket truoc.
            accounts = Account.query.filter_by(
                student_id=student_id
            ).all()

            for account in accounts:
                db.session.delete(account)

            db.session.delete(student)

            db.session.commit()

            return jsonify({
                "ok": True,
                "message": (
                    f"Đã xóa {name} và tài khoản liên kết."
                ),
            })

        except Exception:
            db.session.rollback()

            app.logger.exception(
                "Failed to delete student"
            )

            return api_error(
                "Không thể xóa sinh viên.",
                500,
            )

    # ==============================================
    # 16. XEM CHI TIET SINH VIEN
    # ==============================================

    @app.get("/api/students/<int:student_id>")
    @login_required
    def student_detail(student_id):

        # VULN-02: IDOR CO Y.
        # Chua kiem tra student_id thuoc ve ai.
        student = db.session.get(
            Student,
            student_id,
        )

        if student is None:
            return api_error(
                "Không tìm thấy sinh viên.",
                404,
            )

        return jsonify({
            "ok": True,
            "student": serialize_student(student),
        })

    # ==============================================
    # 17. CAP NHAT GHI CHU
    # ==============================================

    @app.put(
        "/api/students/<int:student_id>/note"
    )
    @login_required
    def update_note(student_id):

        account = current_account()

        if (
            account.role != "ADMIN"
            and account.student_id != student_id
        ):
            return api_error(
                "Bạn chỉ được sửa ghi chú của mình.",
                403,
            )

        student = db.session.get(
            Student,
            student_id,
        )

        if student is None:
            return api_error(
                "Không tìm thấy sinh viên.",
                404,
            )

        payload = request.get_json(
            silent=True
        ) or {}

        note = str(
            payload.get("note") or ""
        )

        if len(note) > 5000:
            return api_error(
                "Ghi chú không được quá 5000 ký tự.",
                400,
            )

        # VULN-04: Luu HTML chua duoc xu ly.
        # React lab render bang dangerouslySetInnerHTML.
        student.note = note

        try:
            db.session.commit()

            return jsonify({
                "ok": True,
                "message": "Đã lưu ghi chú.",
                "student": serialize_student(student),
            })

        except Exception:
            db.session.rollback()

            return api_error(
                "Không thể lưu ghi chú.",
                500,
            )

    # ==============================================
    # 18. XU LY 404
    # ==============================================

    @app.errorhandler(404)
    def not_found(_):

        return api_error(
            "Không tìm thấy tài nguyên.",
            404,
        )

    return app
