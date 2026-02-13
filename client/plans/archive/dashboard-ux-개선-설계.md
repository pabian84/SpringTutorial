# Dashboard UX 개선 설계

## 1. 개요

### 1.1 목표

| 기능 | 설명 |
|------|------|
| 타이틀 새로고침 | "Smart Dashboard" 클릭 시 페이지 새로고침 |
| 새 탭 열기 | 상세 페이지 버튼을 휠클릭/ Ctrl+Click 시 새 탭에서 열기 |

---

## 2. 문제 해결: 휠클릭이 동작하지 않는 현상

### 2.1 원인

`onAuxClick`만으로는 휠클릭을 막을 수 없습니다. 브라우저의 휠클릭 기본 동작(자동 스크롤 활성화)이 먼저 실행되어 `preventDefault하지 않습니다.

###()`가 작동 2.2 해결책

`onMouseDown` 이벤트에서 `button === 1`(휠클릭)을 감지하고 `preventDefault()`를 호출합니다.

```typescript
/**
 * [휠클릭 방지 핸들러]
 * onMouseDown에서 button === 1(휠클릭)을 감지하고 preventDefault() 호출
 */
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button === 1) {
    e.preventDefault();
  }
};
```

### 2.3 이벤트 실행 순서

```
마우스 버튼 누름 (onMouseDown)
    ↓
마우스 버튼 뗌 (onMouseUp)
    ↓
클릭 (onClick)
```

- `onMouseDown`에서 `preventDefault()`를 호출하면 브라우저의 기본 휠클릭 동작을 막을 수 있습니다.

---

## 3. 구현 상세

### 3.1 Dashboard.tsx 수정

```typescript
// src/pages/Dashboard.tsx

// [1] 휠클릭 방지 핸들러 추가
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.button === 1) {
    e.preventDefault();
  }
};

// [2] 모든 버튼과 h1에 onMouseDown={handleMouseDown} 추가
<h1
  onClick={handleTitleClick}
  onAuxClick={handleTitleClick}
  onMouseDown={handleMouseDown}
  ...
>
```

---

## 4. 검토 요청 사항

- [ ] onMouseDown 방식 승인

---

**작성일**: 2026-02-12
**수정일**: 2026-02-12 (휠클릭 문제 해결 추가)
