-- DROP TABLE IF EXISTS access_log;
-- DROP TABLE IF EXISTS refresh_token;
-- DROP TABLE IF EXISTS users;

-- 사용자 테이블
CREATE TABLE if not exists users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL, -- hashed password
    role VARCHAR(20) DEFAULT 'USER', -- 권한 (USER, ADMIN)
    is_online BOOLEAN DEFAULT FALSE
);

-- 기기 관리용 세션 테이블
CREATE TABLE if not exists user_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    refresh_token VARCHAR(512) NOT NULL, -- 토큰으로 기기 식별
    device_type VARCHAR(50),             -- desktop, mobile 등
    user_agent VARCHAR(255),             -- 브라우저 정보
    ip_address VARCHAR(50),
    location VARCHAR(100),
    keep_login BOOLEAN DEFAULT FALSE,     -- 로그인 유지 여부
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 접속 로그 테이블 (브라우저, OS 정보 추가)
CREATE TABLE if not exists access_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    session_id BIGINT,   -- 어떤 세션과 관련된 로그인지 추적 (UserSession의 ID)
    ip_address VARCHAR(50),
    location VARCHAR(100), -- 접속 국가/도시 정보 (보안 감사용)
    user_agent VARCHAR(255),
    browser VARCHAR(50), -- Chrome, Safari 등
    os VARCHAR(50),      -- Windows, Mac 등
    endpoint VARCHAR(100),
    type VARCHAR(50),    -- LOGIN, LOGOUT 등
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 메모 테이블
CREATE TABLE if not exists memo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 채팅 로그 테이블
CREATE TABLE if not exists chat_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- [초기 데이터] 관리자 계정 (비밀번호: 1234 -> BCrypt로 암호화된 값)
-- $2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e
-- INSERT INTO users (id, name, password, role) VALUES ('admin', '관리자', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'ADMIN');
-- INSERT INTO users (id, name, password, role) VALUES ('admin1', '관리자1', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'ADMIN');
-- INSERT INTO users (id, name, password, role) VALUES ('admin2', '관리자2', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'ADMIN');
-- INSERT INTO users (id, name, password, role) VALUES ('admin3', '관리자3', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'ADMIN');
-- INSERT INTO users (id, name, password, role) VALUES ('admin4', '관리자4', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'ADMIN');
-- INSERT INTO users (id, name, password, role) VALUES ('admin5', '관리자5', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'ADMIN');
-- INSERT INTO users (id, name, password, role) VALUES ('user1', '사용자1', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'USER');
-- INSERT INTO users (id, name, password, role) VALUES ('user2', '사용자2', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'USER');
-- INSERT INTO users (id, name, password, role) VALUES ('user3', '사용자3', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'USER');
-- INSERT INTO users (id, name, password, role) VALUES ('user4', '사용자4', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'USER');
-- INSERT INTO users (id, name, password, role) VALUES ('user5', '사용자5', '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e', 'USER');
-- UPDATE users SET password = '$2a$10$hjBO1B8SB4uKJpnSBk9vluUsMAxe44n7CAwQ4ijHOrAdWAwqMxo.e'