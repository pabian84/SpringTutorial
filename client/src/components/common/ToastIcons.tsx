// client/src/components/common/ToastIcons.tsx

// 1. Success (초록색 원 + 체크)
export const AnimatedSuccessIcon = () => (
  <div className="toast-icon-animate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#a5dc86"/>
      <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

// 2. Error (빨간색 원 + X)
export const AnimatedErrorIcon = () => (
  <div className="toast-icon-animate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#f27474"/>
      <path d="M15 9L9 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 9L15 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

// 3. Warning (주황색 원 + 느낌표)
export const AnimatedWarningIcon = () => (
  <div className="toast-icon-animate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#f8bb86"/>
      <path d="M12 7V13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="17" r="1.5" fill="white"/>
    </svg>
  </div>
);

// 4. Info (파란색 원 + i)
export const AnimatedInfoIcon = () => (
  <div className="toast-icon-animate" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#3fc3ee"/>
      <path d="M12 11V17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="7" r="1.5" fill="white"/>
    </svg>
  </div>
);