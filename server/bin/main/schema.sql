-- DROP TABLE IF EXISTS access_log;
-- DROP TABLE IF EXISTS users;

-- 사용자 테이블
CREATE TABLE if not exists users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    password VARCHAR(50) NOT NULL,
    is_online BOOLEAN DEFAULT FALSE
);

-- 접속 로그 테이블
CREATE TABLE if not exists access_log (
    seq INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL,  -- LOGIN or LOGOUT
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