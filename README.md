# QLSV Pentest OWASP — Đề tài 21

## Giới thiệu

**Tên đề tài:** Pentest CSDL theo chuẩn OWASP Top 10 — Xây dựng, tấn công, vá lỗi và kiểm tra lại.

Dự án xây dựng hệ thống Web quản lý sinh viên sử dụng **React JSX, Python Flask và MySQL**, có tích hợp 5 lỗ hổng bảo mật có chủ đích để thực nghiệm kiểm thử xâm nhập (Penetration Testing).

Các lỗ hổng được tích hợp trực tiếp trong những chức năng thực tế của hệ thống, tương tự mô hình DVWA-like, nhưng toàn bộ ứng dụng được tự xây dựng.

Quy trình thực nghiệm:

**Xây dựng → Tạo lỗ hổng → Pentest → Ghi nhận kết quả → Vá lỗi → Kiểm thử lại.**

> **Lưu ý:** Chỉ thực hiện pentest trên hệ thống do mình sở hữu hoặc được phép kiểm thử. Phiên bản vulnerable chỉ được sử dụng trong môi trường lab cô lập, không triển khai công khai lên Internet.

---

## 1. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React JSX + Vite |
| Backend | Python Flask |
| Database | MySQL |
| ORM | Flask-SQLAlchemy |
| Kết nối MySQL | PyMySQL |
| Authentication | Flask Session |
| Phân quyền | Role-Based Access Control (RBAC) |
| Kiểm thử SQL Injection | SQLMap |
| Kiểm thử HTTP/API | Burp Suite Community |
| Quét bảo mật | OWASP ZAP |
| Môi trường pentest | Windows / Kali Linux VM |

## 2. Các chức năng của hệ thống

### 2.1. Quản trị viên — ADMIN

- Đăng nhập và đăng xuất.
- Xem tổng quan hệ thống.
- Xem danh sách sinh viên.
- Tìm kiếm, lọc sinh viên.
- Thêm sinh viên.
- Xóa sinh viên.
- Xem thông tin chi tiết sinh viên.
- Cập nhật ghi chú sinh viên.

### 2.2. Sinh viên — STUDENT

- Đăng nhập và đăng xuất.
- Xem thông tin hồ sơ cá nhân.
- Xem dữ liệu được phân quyền.
- Cập nhật ghi chú của chính mình.

### 2.3. Phân quyền

| Chức năng | ADMIN | STUDENT |
|---|---|---|
| Xem tất cả sinh viên | Có | Không |
| Xem hồ sơ cá nhân | Có | Có |
| Thêm sinh viên | Có | Không |
| Xóa sinh viên | Có | Không |
| Xem hồ sơ người khác | Có | Không trong bản secure |
| Cập nhật ghi chú của mình | Có | Có |
| Cập nhật ghi chú người khác | Có | Không |

Trong phiên bản vulnerable, chức năng xem chi tiết sinh viên cố ý thiếu kiểm tra quyền sở hữu, phục vụ kiểm thử IDOR.

---

## 3. Cài đặt cơ sở dữ liệu

Sử dụng MySQL Workbench để thực hiện.

**Bước 1:** Khởi động MySQL Server.

**Bước 2:** Mở file:

`database/student_db.sql`

**Bước 3:** Chạy script SQL.

**Bước 4:** Kiểm tra dữ liệu:

```sql
USE student_db;

SHOW TABLES;

DESCRIBE students;
DESCRIBE accounts;

SELECT id, username, role, student_id
FROM accounts;
```

Hệ thống sử dụng hai bảng chính:

- `students`: Thông tin sinh viên, kết quả học tập, ghi chú.
- `accounts`: Tài khoản, mật khẩu đã băm, vai trò, liên kết sinh viên và thông tin khóa đăng nhập.

File SQL sử dụng `CREATE TABLE IF NOT EXISTS` để tránh tạo lại các bảng đã tồn tại. Lệnh này không tự cập nhật cấu trúc bảng cũ.

### Tài khoản thực nghiệm

| Tài khoản | Mật khẩu mẫu | Vai trò |
|---|---|---|
| admin | Admin@123 | ADMIN |
| sv001 | Student@123 | STUDENT |
| sv002 | Student@123 | STUDENT |

Các tài khoản trên cần có trong CSDL. Nếu dùng dữ liệu hiện tại của project, các tài khoản đã được tạo và liên kết với sinh viên tương ứng.

---

## 4. Cài đặt Backend Python Flask

Mở PowerShell tại thư mục backend.

```powershell
cd C:\qlsv_1\backend
```

Tạo môi trường ảo nếu chưa có:

```powershell
python -m venv venv
```

Kích hoạt:

```powershell
.\venv\Scripts\Activate.ps1
```

Cài thư viện:

```powershell
pip install -r requirements.txt
```

### 4.1. Cấu hình MySQL

Mở file:

`backend/.env`

Cấu hình kết nối đến MySQL:

```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@127.0.0.1:3306/student_db
SECRET_KEY=YOUR_RANDOM_SECRET_KEY
```

Thay `YOUR_PASSWORD` bằng mật khẩu MySQL thực tế. `SECRET_KEY` phải là chuỗi ngẫu nhiên đủ mạnh khi chạy secure mode.

Tạo SECRET_KEY bằng Python:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Không commit file `.env` lên GitHub.

### 4.2. Chạy phiên bản Vulnerable — BEFORE

```powershell
python run_vulnerable.py
```

Backend chạy tại:

`http://127.0.0.1:5000`

Phiên bản này cố ý tồn tại 5 lỗ hổng phục vụ pentest.

### 4.3. Chạy phiên bản Secure — AFTER

Dừng backend vulnerable bằng `Ctrl + C`.

Sau đó chạy:

```powershell
python run_secure.py
```

Phiên bản này sử dụng các biện pháp vá lỗi tương ứng.

**Không chạy đồng thời hai phiên bản vì cả hai sử dụng cổng 5000.** Khi chuyển chế độ, cần đăng nhập lại do cấu hình khóa ký session khác nhau.

---

## 5. Cài đặt Frontend React JSX

Mở terminal PowerShell khác:

```powershell
cd C:\qlsv_1\frontend
```

Cài dependencies:

```powershell
npm install
```

Khởi động:

```powershell
npm run dev
```

Truy cập:

`http://localhost:5173`

Frontend sử dụng React JSX để hiển thị giao diện và gọi API từ Flask.

Các chức năng chính:

- Đăng nhập.
- Trang tổng quan.
- Danh sách và tìm kiếm sinh viên.
- Thêm và xóa sinh viên.
- Xem chi tiết sinh viên.
- Ghi chú sinh viên.
- Đăng xuất.

**Không sử dụng trang Pentest Lab riêng.** Các lỗ hổng nằm trực tiếp trong chức năng thực tế của hệ thống.

---

## 6. Danh sách 5 lỗ hổng bảo mật

### VULN-01 — SQL Injection

**Chức năng:** Tìm kiếm sinh viên.

**Endpoint:**

`GET /api/students?q=...`

**Nguyên nhân:**

Trong phiên bản vulnerable, tham số `q` được nối trực tiếp vào câu SQL thay vì được xử lý dưới dạng tham số an toàn.

**Vulnerable:**

- Truy vấn SQL được xây dựng bằng cách ghép chuỗi.
- Dữ liệu nhập có thể làm thay đổi cấu trúc truy vấn.
- Lỗi SQL có thể bị trả về cho người dùng.

**Secure:**

- Sử dụng SQLAlchemy ORM.
- Tham số hóa giá trị đầu vào.
- Không nối dữ liệu người dùng trực tiếp vào cấu trúc SQL.

**Công cụ:** Burp Suite Community, SQLMap.

**Thực nghiệm:**

1. Đăng nhập tài khoản ADMIN.
2. Sử dụng chức năng tìm kiếm.
3. Dùng Burp quan sát request chứa tham số `q`.
4. Kiểm tra SQL Injection bằng SQLMap trong lab.
5. Ghi nhận kết quả trước vá.
6. Chạy `run_secure.py`.
7. Đăng nhập lại và thực hiện cùng phép kiểm thử.

Ví dụ lệnh trên máy chạy backend:

```bash
sqlmap -u "http://127.0.0.1:5000/api/students?q=test" -p q --cookie="session=YOUR_LAB_SESSION_COOKIE"
```

Cookie được lấy từ phiên đăng nhập thực nghiệm hợp lệ. Nếu kiểm thử từ Kali VM, thay `127.0.0.1` bằng địa chỉ IP máy mục tiêu và sử dụng phiên đăng nhập tương ứng.

### VULN-02 — IDOR / Broken Access Control

**Chức năng:** Xem chi tiết sinh viên.

**Endpoint:**

`GET /api/students/{id}`

**Nguyên nhân:**

Phiên bản vulnerable không kiểm tra người đăng nhập có quyền xem hồ sơ được yêu cầu hay không.

**Vulnerable:**

Sinh viên `sv001` có thể yêu cầu hồ sơ sinh viên số 2, mặc dù tài khoản chỉ liên kết với sinh viên số 1.

**Secure:**

Backend kiểm tra `role` và `student_id`.

Khi truy cập hồ sơ không được phép:

`403 Forbidden`

**Công cụ:** Burp Suite Community.

**Thực nghiệm:**

1. Đăng nhập bằng `sv001`.
2. Mở trang hồ sơ cá nhân.
3. Dùng Burp bắt request `GET /api/students/1`.
4. Đổi tham số đường dẫn thành `/api/students/2`.
5. Ghi nhận phản hồi bản vulnerable.
6. Chạy bản secure và đăng nhập lại.
7. Gửi lại request tương đương.
8. Ghi nhận kết quả 403 Forbidden.

### VULN-03 — Authentication Failure

**Chức năng:** Đăng nhập.

**Endpoint:**

`POST /api/login`

**Nguyên nhân:**

Phiên bản vulnerable thiếu cơ chế hạn chế số lần đăng nhập sai và tiết lộ thông tin về sự tồn tại của tài khoản.

**Vulnerable:**

- Không giới hạn số lần thử mật khẩu sai.
- Phân biệt username không tồn tại và password sai.

**Secure:**

- Hiển thị thông báo lỗi chung.
- Theo dõi số lần đăng nhập sai.
- Tạm khóa tài khoản sau 5 lần sai trong 5 phút.

**Công cụ:** Burp Suite Community.

**Thực nghiệm:**

1. Thử đăng nhập sai có kiểm soát bằng tài khoản lab.
2. Quan sát phản hồi.
3. Ghi nhận bản vulnerable không thực hiện khóa tạm.
4. Chuyển sang bản secure.
5. Thử lại với tài khoản lab.
6. Ghi nhận trạng thái khóa tạm và mã HTTP 429.

Reset trạng thái tài khoản lab nếu cần:

```sql
UPDATE accounts
SET failed_login_attempts = 0,
    locked_until = NULL
WHERE username IN ('sv001', 'sv002');
```

### VULN-04 — Stored XSS

**Chức năng:** Ghi chú sinh viên.

**Endpoint:**

`PUT /api/students/{id}/note`

**Nguyên nhân:**

Dữ liệu ghi chú được lưu trong MySQL và phiên bản vulnerable hiển thị lại bằng cơ chế render HTML không an toàn của React.

**Vulnerable:**

React sử dụng `dangerouslySetInnerHTML` đối với dữ liệu ghi chú.

**Secure:**

React hiển thị nội dung dưới dạng văn bản:

```jsx
<div>{student.note}</div>
```

**Công cụ:** Burp Suite Community, OWASP ZAP và trình duyệt.

**Thực nghiệm:**

1. Đăng nhập.
2. Mở chức năng ghi chú sinh viên.
3. Nhập dữ liệu thử nghiệm XSS trong môi trường lab.
4. Lưu ghi chú vào MySQL.
5. Mở lại trang chi tiết.
6. Ghi nhận hành vi thực thi script nếu tồn tại.
7. Chuyển sang bản secure.
8. Mở lại ghi chú và xác nhận nội dung không được thực thi thành JavaScript.

### VULN-05 — Security Misconfiguration

**Chức năng:** Cấu hình Backend Flask.

**Nguyên nhân:**

Ứng dụng sử dụng các cấu hình thiếu an toàn.

**Vulnerable:**

- Flask bật debug.
- SECRET_KEY yếu.
- CORS cho phép origin quá rộng.
- Session cookie không bật HttpOnly.
- Thiếu các HTTP security headers.

**Secure:**

- Tắt debug.
- Dùng SECRET_KEY mạnh từ biến môi trường.
- Giới hạn CORS theo danh sách origin hợp lệ.
- Bật HttpOnly và SameSite phù hợp.
- Thêm CSP, X-Frame-Options, X-Content-Type-Options và Referrer-Policy.

**Công cụ:** OWASP ZAP, Burp Suite Community.

**Thực nghiệm:**

1. Khởi động bản vulnerable.
2. Kiểm tra HTTP headers và cấu hình bằng ZAP/Burp.
3. Ghi nhận những cấu hình thiếu an toàn.
4. Chuyển sang bản secure.
5. Quét lại cùng endpoint.
6. So sánh kết quả trước và sau.

---

## 7. Quy trình Pentest

### Giai đoạn 1 — Xây dựng hệ thống

- Thiết kế CSDL MySQL.
- Xây dựng Backend Flask.
- Xây dựng Frontend React JSX.
- Triển khai xác thực và phân quyền.

### Giai đoạn 2 — Tạo lỗ hổng có chủ đích

Tích hợp 5 lỗ hổng bảo mật vào các chức năng thật trong phiên bản vulnerable.

### Giai đoạn 3 — Vulnerability Assessment

Sử dụng Burp Suite và OWASP ZAP để xác định các vấn đề bảo mật của ứng dụng và API.

### Giai đoạn 4 — Penetration Testing

- SQLMap kiểm tra SQL Injection.
- Burp Suite kiểm tra IDOR và Authentication Failure.
- Burp/ZAP hỗ trợ kiểm tra Stored XSS.
- OWASP ZAP đánh giá Security Misconfiguration.

### Giai đoạn 5 — Remediation

Chạy logic bảo mật trong phiên bản secure và phân tích các thay đổi mã nguồn để loại bỏ nguyên nhân gây lỗ hổng.

### Giai đoạn 6 — Retesting

Thực hiện lại các testcase bằng cùng công cụ và điều kiện kiểm thử tương đương.

Mục tiêu là xác nhận các lỗi đã được khắc phục mà không làm hỏng các chức năng bình thường của hệ thống.

---

## 8. Mô hình Kali Linux VM

Môi trường khuyến nghị:

```text
Kali Linux VM
Attacker
SQLMap / Burp / ZAP
        |
        |
   Host-only Network
        |
        |
Windows Host
Target Server
React JSX :5173
Flask API :5000
MySQL     :3306
```

Máy Kali thực hiện kiểm thử HTTP/API của ứng dụng mục tiêu.

MySQL không cần mở cổng trực tiếp cho Kali, vì thao tác CSDL được thực hiện thông qua Flask API.

Chỉ cho phép truy cập từ mạng lab, không mở bản vulnerable ra Internet.

---



Mỗi lỗ hổng phải có bằng chứng trước và sau khi vá.

Cấu trúc lưu ảnh:

```text
evidence/
├── before/
│   ├── VULN-01-sqli.png
│   ├── VULN-02-idor.png
│   ├── VULN-03-auth.png
│   ├── VULN-04-xss.png
│   └── VULN-05-misconfig.png
│
└── after/
    ├── VULN-01-sqli-fixed.png
    ├── VULN-02-idor-fixed.png
    ├── VULN-03-auth-fixed.png
    ├── VULN-04-xss-fixed.png
    └── VULN-05-misconfig-fixed.png
```

Khi ghi nhận mỗi lỗ hổng, cần mô tả:

- Tên và nhóm OWASP.
- Vị trí lỗ hổng.
- Nguyên nhân.
- Công cụ sử dụng.
- Bước thực nghiệm.
- Kết quả trước vá.
- Biện pháp khắc phục.
- Kết quả kiểm thử lại.
- Hình ảnh minh chứng.

---

