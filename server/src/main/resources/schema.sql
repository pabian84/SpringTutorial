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

-- 접속 로그 테이블 (브라우저, OS 정보 추가)
CREATE TABLE if not exists access_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    browser VARCHAR(50), -- [신규] Chrome, Safari 등
    os VARCHAR(50),      -- [신규] Windows, Mac 등
    endpoint VARCHAR(100),
    type VARCHAR(50),    -- LOGIN, LOGOUT 등
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 리프레시 토큰 저장소 (로그인 유지 핵심)
CREATE TABLE if not exists refresh_token (
    token_key VARCHAR(100) PRIMARY KEY, -- 사용자 ID (또는 이메일)
    token_value VARCHAR(512) NOT NULL,  -- 리프레시 토큰 값
    ip VARCHAR(50),
    browser VARCHAR(50),
    os VARCHAR(50),
    expiration TIMESTAMP NOT NULL,      -- 만료 시간
    -- [신규] 토큰 주인(User)이 사라지면 토큰도 같이 사라져야 함 (ON DELETE CASCADE)
    FOREIGN KEY (token_key) REFERENCES users(id) ON DELETE CASCADE
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