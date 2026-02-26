# 📊 프로젝트 개발 업무일지 (Daily Work Log)

**일자**: 2026-02-25 (수)
**작성자**: Gemini CLI

---

### **2026-02-25 (수)**
*   **기기 식별 쿠키(Device ID) 도입 및 세션 재사용 로직 구현**
    - **문제 정의**: 브라우저 종료 시 `accessToken`은 삭제되지만, 서버 세션은 유지되어 재로그인 시마다 새로운 기기로 인식되는 '유령 기기' 증상 해결 필요.
    - **이중 쿠키 전략(Dual-Cookie Strategy) 적용**:
        - `accessToken`: 단기 세션 인증용 (Session).
        - `deviceId`: 장기 기기 식별용 (Max-Age: 1년, HttpOnly).
    - **백엔드(Spring Boot) 고도화**:
        - `user_sessions` 및 `access_log` 테이블에 `device_id` 컬럼 추가 (SQL 스키마 업데이트).
        - `SessionMapper` 내 `findByUserIdAndDeviceId` 쿼리 추가로 기존 세션 검색 및 재사용 로직 구현.
        - `UserService.login` 로직 수정: 동일 기기 접근 시 세션 신규 생성이 아닌 기존 레코드의 `refreshToken` 및 활동 시각 업데이트.
        - `UserController`에서 `deviceId` 쿠키 발급 및 추출 로직 연동.
    - **프론트엔드(React) UI 안정화**:
        - `SweetAlert2` 호출 시 발생하는 배경 스크롤바 바운스 및 `body` 높이 변경(Flickering) 문제 해결을 위해 `Alert.tsx` 설정 최적화.
    - **문서화**:
        - `11-기기-식별-쿠키를-이용한-세션-재사용-전략.md` 설계 문서 작성 및 배포.

---
