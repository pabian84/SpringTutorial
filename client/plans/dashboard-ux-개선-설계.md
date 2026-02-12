# Dashboard UX 개선 설계

## 1. 개요

### 1.1 목표

| 기능 | 설명 |
|------|------|
| 타이틀 새로고침 | "Smart Dashboard" 클릭 시 페이지 새로고침 |
| 새 탭 열기 | 상세 페이지 버튼을 휠클릭/ Ctrl+Click 시 새 탭에서 열기 |

### 1.2 배경

사용자가 일반적인 웹사이트에서 기대하는 UX 패턴 적용

---

## 2. React에서 페이지 새로고침 방식 비교

### 2.1 방식 비교

| 방식 | 동작 | 장점 | 단점 |
|------|------|------|------|
| `window.location.reload()` | 브라우저 전체 새로고침 | 확실한 리로드, 브라우저 기본 동작 | SPA 장점 상실 |
| `navigate(path, { replace: true })` | SPA 라우터 이동 | SPA 흐름 유지 | React가 동일 경로로 인식하면 리렌더링 안 될 수 있음 |
| `window.location.href = path` | 새로운 요청 | 명확한 페이지 전환 | 브라우저 새로고침 느낌 |

### 2.2 권장 방식

**`window.location.reload()`** 사용 이유:

```typescript
// 일반 클릭 시
const handleTitleClick = () => {
  window.location.reload();
};
```

- React Router의 `navigate()`는 **경로가 동일하면** 컴포넌트를 재사용하려 함
- Dashboard의 경우 `/dashboard`로 고정되어 있어 navigate만으로는 **새로고침 효과가 없음**
- `window.location.reload()`는 브라우저 레벨에서 완전한 새로고침을 수행
- 일반적인 웹사이트(Google, YouTube, GitHub 등)도 로고 클릭 시 similar한 방식 사용

### 2.3 참고: 주요 사이트 동작 방식

| 사이트 | 로고 클릭 동작 |
|--------|---------------|
| Google | 현재 페이지 리로드 또는 홈으로 이동 |
| YouTube | `/` 로 이동 (SPA navigate 또는 reload) |
| GitHub | `window.location.href = '/'` 또는 reload |
| Twitter/X | SPA navigate (동일 경로면 리렌더링 강제) |

---

## 3. 새 탭 열기 구현 방식

### 3.1 마우스 이벤트

| 이벤트 | 설명 |
|--------|------|
| `onClick` | 左버튼 클릭 (일반) |
| `onAuxClick` | 中버튼 (휠) 또는 右버튼 클릭 |
| Ctrl+Click | `onClick`과 `e.ctrlKey` 조합으로 감지 |

### 3.2 구현 코드

```typescript
/**
 * 네비게이션 핸들러
 * - 일반 클릭: 현재 탭에서 이동
 * - 휠클릭/ Ctrl+Click: 새 탭에서 열기
 */
const handleNavigation = (
  path: string,
  e: React.MouseEvent | React.MouseEventHandler<HTMLButtonElement>
) => {
  const event = e as React.MouseEvent;
  
  // 새 탭 조건: 휠클릭 或 Ctrl+Click
  if (event.button === 1 || event.ctrlKey) {
    event.preventDefault();
    window.open(path, '_blank', 'noopener,noreferrer');
  } else {
    // 일반 클릭
    navigate(path);
  }
};
```

### 3.3 보안 고려사항

- **`noopener` 옵션 필수**: 새 창에서 `window.opener` 접근을 방지
- **`noreferrer` 옵션**: 레퍼러 정보 누출 방지

---

## 4. 변경 대상 파일

### 4.1 Dashboard.tsx

| 위치 | 현재 | 변경 |
|------|------|------|
| `h1` (타이틀) | 없음 | 클릭 이벤트 추가 |
| `cesiumDetailButton` | `navigate('/cesium')` | 네비게이션 핸들러 적용 |
| `threeDetailButton` | `navigate('/threejs')` | 네비게이션 핸들러 적용 |
| Online → Log 버튼 | `navigate('/user/:id')` | 네비게이션 핸들러 적용 |
| 기기 관리 버튼 | `navigate('/devices')` | 네비게이션 핸들러 적용 |

---

## 5. 구현 상세

### 5.1 Dashboard.tsx 수정

```typescript
// src/pages/Dashboard.tsx

// [1] 네비게이션 핸들러 추가
const handleNavigate = (
  path: string,
  e: React.MouseEvent<HTMLButtonElement>
) => {
  // 휠클릭 或 Ctrl+Click → 새 탭
  if (e.button === 1 || e.ctrlKey) {
    e.preventDefault();
    window.open(path, '_blank', 'noopener,noreferrer');
  } else {
    // 일반 클릭 → 현재 탭
    navigate(path);
  }
};

// [2] 타이틀 클릭 핸들러
const handleTitleClick = () => {
  window.location.reload();
};

// [3] 수정된 버튼들
const cesiumDetailButton = (
  <button
    onClick={(e) => handleNavigate('/cesium', e)}
    title="상세 보기 (휠클릭/ Ctrl+Click: 새 탭)"
    style={{...}}
  >
    <BiDetail size={20} />
  </button>
);

// ... similar for threeDetailButton

// 기기 관리 버튼
<button
  onClick={(e) => handleNavigate('/devices', e)}
  title="기기 관리 (휠클릭/ Ctrl+Click: 새 탭)"
  style={{...}}
>
  <FaDesktop size={16} />
  {!isCompactMode && "기기 관리"}
</button>
```

### 5.2 Online User Log 버튼

```typescript
<button
  onClick={(e) => handleNavigate(`/user/${u.id}`, e)}
  style={{...}}
>
  Log
</button>
```

---

## 6. UX 시나리오

### 6.1 타이틀 클릭

```
사용자: "Smart Dashboard" 클릭
→ 결과: 페이지 전체 새로고침
```

### 6.2 상세 페이지 이동

```
시나리오 1: 일반 클릭
┌─────────────────────────────────┐
│ 사용자가 "상세 보기" 버튼을 左클릭    │
│ → 현재 탭에서 Cesium 페이지로 이동   │
└─────────────────────────────────┘

시나리오 2: 휠클릭
┌─────────────────────────────────┐
│ 사용자가 "상세 보기" 버튼을 中클릭    │
│ → 새 탭에서 Cesium 페이지 열기       │
│ → 뒤로가기 동작 없음 (noopener)      │
└─────────────────────────────────┘

시나리오 3: Ctrl + Click
┌─────────────────────────────────┐
│ 사용자가 "상세 보기" 버튼을 Ctrl+左 │
│ → 새 탭에서 Cesium 페이지 열기       │
└─────────────────────────────────┘
```

---

## 7. 검토 요청 사항

- [ ] 타이틀 새로고침 방식 (`window.location.reload()`) 승인
- [ ] 새 탭 열기 조건 (휠클릭 + Ctrl+Click) 승인
- [ ] 기기 관리 버튼 포함 승인
- [ ] 보안 옵션 (`noopener,noreferrer`) 승인

---

## 8. 예상 소요 시간

| 작업 | 복잡도 |
|------|--------|
| Dashboard.tsx 수정 | 낮음 (1-2 파일) |
| 빌드 및 테스트 | 낮음 |

---

**작성일**: 2026-02-12
