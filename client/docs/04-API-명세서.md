# API 명세서

## 1. API 개요

| 도메인 | 경로 | 설명 |
|--------|------|------|
| 인증 | /api/auth | 인증 상태 확인 |
| 사용자 | /api/user | 로그인, 로그아웃, 사용자 로그 |
| 세션 | /api/sessions | 기기 세션 관리 |
| 날씨 | /api/weather | 날씨 정보 |
| 메모 | /api/memo | 메모 CRUD |
| 채팅 | /api/chat | 채팅 기록 |
| 통계 | /api/stats | 코드 통계 |

---

## 2. 인증 API

### 2.1 인증 상태 확인

**엔드포인트:** `GET /api/auth/check`

**설명:** 사용자 인증 상태 확인

**인증 필요:** 쿠키

**요청:**
```http
GET /api/auth/check HTTP/1.1
Cookie: accessToken=<jwt_token>
```

**응답 (성공):**
```json
{
  "authenticated": true,
  "user": {
    "id": "admin",
    "name": "관리자"
  }
}
```

**응답 (실패):**
```json
{
  "authenticated": false
}
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

## 3. 사용자 API

### 3.1 로그인

**엔드포인트:** `POST /api/user/login`

**설명:** 자격 증명으로 로그인

**인증 필요:** 없음

**요청:**
```json
{
  "id": "admin",
  "password": "1234",
  "rememberMe": true
}
```

**요청 본문:**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | string | 예 | 사용자 ID |
| password | string | 예 | 비밀번호 |
| rememberMe | boolean | 아니오 | 로그인 유지 (7일) |

**응답:**
```json
{
  "user": {
    "id": "admin",
    "name": "관리자"
  }
}
```

**Set-Cookie:**
```
accessToken=<jwt_token>; Path=/; HttpOnly; SameSite=Lax; [Secure]
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 로그인 성공 |
| 401 | 잘못된 자격 증명 |
| 500 | 서버 오류 |

---

### 3.2 로그아웃

**엔드포인트:** `POST /api/user/logout`

**설명:** 현재 세션 로그아웃

**인증 필요:** 쿠키 또는 본문

**요청:**
```json
{
  "userId": "admin"
}
```

**요청 본문 (선택):**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userId | string | 아니오 | 사용자 ID (토큰 만료 시 대체) |

**응답:**
```
"로그아웃 되었습니다."
```

**Set-Cookie:**
```
accessToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 로그아웃 성공 |
| 401 | 인증되지 않음 |

---

### 3.3 사용자 로그 조회

**엔드포인트:** `GET /api/user/logs`

**설명:** 현재 사용자의 접속 로그 조회

**인증 필요:** 예

**응답:**
```json
[
  {
    "id": 1,
    "userId": "admin",
    "sessionId": 1,
    "ipAddress": "127.0.0.1",
    "location": "로컬",
    "userAgent": "Chrome on Windows 11",
    "browser": "Chrome",
    "os": "Windows",
    "endpoint": "/api/user/login",
    "type": "LOGIN",
    "logTime": "2024-01-01 12:00:00"
  }
]
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

## 4. 세션 API

### 4.1 내 세션 목록 조회

**엔드포인트:** `GET /api/sessions`

**설명:** 현재 사용자의 모든 세션 조회

**인증 필요:** 예

**응답:**
```json
[
  {
    "id": 1,
    "userId": "admin",
    "deviceType": "Desktop",
    "userAgent": "Chrome on Windows 11",
    "ipAddress": "127.0.0.1",
    "location": "로컬",
    "keepLogin": false,
    "lastAccessedAt": "2024-01-01T12:00:00",
    "createdAt": "2024-01-01T11:00:00",
    "isCurrent": true
  }
]
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

### 4.2 특정 세션 종료

**엔드포인트:** `POST /api/sessions/revoke`

**설명:** 특정 세션 종료 (기기 강퇴)

**인증 필요:** 예

**요청:**
```json
{
  "targetSessionId": 2
}
```

**요청 본문:**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| targetSessionId | number | 예 | 종료할 세션 ID |

**응답:**
```
"선택한 기기를 로그아웃 시켰습니다."
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 세션 ID |
| 403 | 본인 세션이 아님 |
| 401 | 인증되지 않음 |

---

### 4.3 다른 세션 모두 종료

**엔드포인트:** `DELETE /api/sessions/others`

**설명:** 현재 세션 제외 모든 세션 종료

**인증 필요:** 예

**응답:**
```
"다른 모든 기기에서 로그아웃 되었습니다."
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 현재 세션 없음 |
| 401 | 인증되지 않음 |

---

### 4.4 전체 세션 종료

**엔드포인트:** `DELETE /api/sessions/all`

**설명:** 모든 세션 종료 (전체 로그아웃)

**인증 필요:** 예

**응답:**
```
"전체 로그아웃 완료"
```

**Set-Cookie:**
```
accessToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 현재 세션 없음 |
| 401 | 인증되지 않음 |

---

### 4.5 온라인 사용자 조회

**엔드포인트:** `GET /api/sessions/onlineList`

**설명:** 온라인 사용자 목록 조회

**인증 필요:** 예

**응답:**
```json
[
  {
    "id": "admin",
    "name": "관리자",
    "sessionCount": 2
  }
]
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

## 5. 날씨 API

### 5.1 날씨 조회

**엔드포인트:** `GET /api/weather`

**설명:** 날씨 정보 조회

**인증 필요:** 없음

**쿼리 파라미터:**
| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|----------|------|------|--------|------|
| lat | number | 아니오 | 37.241086 | 위도 |
| lon | number | 아니오 | 127.177553 | 경도 |
| hourlyLimit | number | 아니오 | 26 | 시간별 예보 개수 |
| includeWeekly | boolean | 아니오 | true | 주간 예보 포함 |

**응답:**
```json
{
  "current": {
    "temperature": 15.5,
    "humidity": 65,
    "windSpeed": 3.2,
    "weatherCode": 0
  },
  "hourly": [...],
  "weekly": [...]
}
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 500 | 외부 API 오류 |

---

## 6. 메모 API

### 6.1 메모 목록 조회

**엔드포인트:** `GET /api/memo/{userId}`

**설명:** 사용자의 메모 목록 조회

**인증 필요:** 예

**경로 파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| userId | string | 사용자 ID |

**응답:**
```json
[
  {
    "id": 1,
    "userId": "admin",
    "content": "샘플 메모",
    "createdAt": "2024-01-01T12:00:00"
  }
]
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

### 6.2 메모 추가

**엔드포인트:** `POST /api/memo`

**설명:** 새 메모 추가

**인증 필요:** 예

**요청:**
```json
{
  "userId": "admin",
  "content": "새 메모 내용"
}
```

**요청 본문:**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userId | string | 예 | 사용자 ID |
| content | string | 예 | 메모 내용 |

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

### 6.3 메모 삭제

**엔드포인트:** `DELETE /api/memo/{id}`

**설명:** 메모 삭제

**인증 필요:** 예

**경로 파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| id | number | 메모 ID |

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |
| 404 | 메모 없음 |

---

## 7. 채팅 API

### 7.1 채팅 기록 조회

**엔드포인트:** `GET /api/chat/history`

**설명:** 최근 채팅 메시지 조회

**인증 필요:** 예

**응답:**
```json
[
  {
    "id": 1,
    "senderId": "admin",
    "senderName": "관리자",
    "message": "안녕하세요!",
    "createdAt": "2024-01-01T12:00:00"
  }
]
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

## 8. 통계 API

### 8.1 코드 통계 조회

**엔드포인트:** `GET /api/stats/code`

**설명:** 코드 통계 조회

**인증 필요:** 예

**응답:**
```json
{
  "Java": 15000,
  "TypeScript": 8500,
  "CSS": 1200
}
```

**상태 코드:**
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 401 | 인증되지 않음 |

---

## 9. 웹소켓 이벤트

### 9.1 연결

**URL:** `ws://localhost:8080/ws`

**핸드셰이크:** 쿠키의 JWT 토큰 검증

### 9.2 메시지 타입

#### 클라이언트 → 서버

| 타입 | 페이로드 | 설명 |
|------|----------|------|
| CHAT | `{ message: string }` | 채팅 메시지 전송 |

#### 서버 → 클라이언트

| 타입 | 페이로드 | 설명 |
|------|----------|------|
| NEW_DEVICE_LOGIN | `{ message: string, deviceId: string }` | 새 기기 로그인 알림 |
| CHAT | `{ senderId: string, senderName: string, message: string }` | 채팅 메시지 브로드캐스트 |

### 9.3 종료 코드

| 코드 | 설명 |
|------|------|
| 1000 | 정상 종료 |
| 4001 | 강제 로그아웃 (관리자 또는 사용자에 의해 강퇴) |

---

## 10. 에러 응답 형식

### 10.1 표준 에러

```json
{
  "code": "A001",
  "message": "사용자를 찾을 수 없습니다"
}
```

### 10.2 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|-----------|------|
| A001 | 401 | 잘못된 자격 증명 |
| A002 | 401 | 토큰 만료 |
| A003 | 401 | 잘못된 토큰 |
| A004 | 403 | 접근 거부 |
| A005 | 404 | 리소스 없음 |
| A006 | 403 | 새 기기 로그인 (에러 아님) |
| S001 | 400 | 세션 없음 |
| S002 | 403 | 본인 세션이 아님 |

---

## 11. 요청/응답 예시

### 11.1 로그인 흐름

```http
POST /api/user/login HTTP/1.1
Content-Type: application/json

{
  "id": "admin",
  "password": "1234",
  "rememberMe": false
}
```

```http
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; SameSite=Lax
Content-Type: application/json

{
  "user": {
    "id": "admin",
    "name": "관리자"
  }
}
```

### 11.2 인증된 요청

```http
GET /api/sessions HTTP/1.1
Cookie: accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": 1,
    "userId": "admin",
    "deviceType": "Desktop",
    "isCurrent": true
  }
]
```

### 11.3 에러 응답

```http
POST /api/user/login HTTP/1.1
Content-Type: application/json

{
  "id": "admin",
  "password": "wrong"
}
```

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

"잘못된 자격 증명"