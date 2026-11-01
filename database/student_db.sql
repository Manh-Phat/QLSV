CREATE DATABASE student_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE student_db;

CREATE TABLE students (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender ENUM('Nam','Nữ','Khác') NOT NULL DEFAULT 'Khác',
    major VARCHAR(120) NOT NULL,
    class_name VARCHAR(50) NOT NULL,
    dtb DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    status ENUM('Đang học','Bảo lưu','Đã tốt nghiệp')
        NOT NULL DEFAULT 'Đang học',
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_students_major (major),
    INDEX idx_students_status (status),
    CONSTRAINT chk_students_dtb CHECK (dtb >= 0 AND dtb <= 4)
) ENGINE=InnoDB;


CREATE TABLE accounts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    pass VARCHAR(255) NOT NULL,
    role ENUM('ADMIN','STUDENT') NOT NULL DEFAULT 'STUDENT',
    student_id INT UNSIGNED NULL,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,

    UNIQUE KEY uq_accounts_student (student_id),

    CONSTRAINT fk_accounts_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
SELECT COUNT(*) AS total_students FROM students;

SELECT COUNT(*) AS total_accounts FROM accounts;
