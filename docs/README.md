# SpringTutorial 통합 개발 문서 (Documentation)

이 디렉토리는 `client`(React)와 `server`(Spring Boot)를 아우르는 **SpringTutorial 프로젝트 전체의 구조와 아키텍처**를 설명하는 공식 문서 저장소입니다.

## 📂 문서 목차

### 1. [프로젝트 개요 (Overview)](./01_Overview/01-프로젝트-개요.md)
* 애플리케이션의 목적, 주요 기능, 통합 기술 스택 및 실행 방법을 안내합니다.

### 2. [통합 아키텍처 (Architecture)](./02_Architecture/01-통합-아키텍처.md)
* 프론트엔드와 백엔드 간의 데이터 흐름(HTTP/REST 및 WebSocket)과 시스템 구성도를 다룹니다.
* 인증/보안 아키텍처 (이중 쿠키 전략) 및 다중 탭/기기 간 상태 동기화 전략을 설명합니다.

### 3. [데이터베이스 설계 (Database)](./03_Database/01-데이터베이스-스키마.md)
* H2 Database의 ERD(Entity-Relationship Diagram)를 제공합니다.
* 다중 세션 관리의 핵심인 `user_sessions` 테이블과 `access_log`의 역할을 상세히 설명합니다.

### 4. [프론트엔드 구조 (Frontend)](./04_Frontend/01-프론트엔드-구조.md)
* `client` 폴더 하위의 주요 디렉토리 구조(api, components, contexts, utils 등)를 설명합니다.
* 인증 상태 관리 및 레이스 컨디션 방어 로직을 정리합니다.

### 5. [백엔드 구조 (Backend)](./05_Backend/01-백엔드-구조.md)
* `server` 폴더 하위의 주요 패키지 설계(DDD 지향) 및 Spring Security 필터 구성을 다룹니다.
* WebSocket 핸들러 로직 및 `JwtTokenProvider`의 동작 원리를 설명합니다.

---
*참고: 과거의 개별 문제 해결 및 단계별 상세 구현 기록(Troubleshooting)은 각 플랫폼 하위의 `client/docs`, `client/plans`, `server/plans` 폴더에 원본 그대로 보존되어 있습니다.*