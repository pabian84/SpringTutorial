import Swal from 'sweetalert2';

// 1. 다크 모드용 기본 색상 설정
const commonConfig = {
  background: '#1f2937', // 선생님 대시보드 배경색
  color: '#ffffff',      // 흰색 글씨
  confirmButtonColor: '#e94560', // 선생님 포인트 컬러 (빨강)
  cancelButtonColor: '#4b5563',  // 회색
};

// 2. 일반 알림창 (확인 버튼 하나)
export const showAlert = (title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  return Swal.fire({
    ...commonConfig,
    title,
    text,
    icon,
    confirmButtonText: '확인',
  });
};

// 3. 확인/취소 선택창 (삭제 확인 등)
export const showConfirm = (title: string, text: string) => {
  return Swal.fire({
    ...commonConfig,
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '네, 진행합니다',
    cancelButtonText: '취소',
    reverseButtons: true, // 취소-확인 순서 변경 (취향)
  });
};

// 4. 우측 상단 토스트 알림 (시스템 메시지용 - 자동으로 사라짐)
// 여러 개가 뜨면 알아서 아래로 쌓입니다.
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  background: '#16213e', // 약간 더 어두운 배경
  color: '#fff',
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  }
});

export const showToast = (title: string, icon: 'success' | 'error' | 'info' = 'info') => {
  Toast.fire({
    icon,
    title
  });
};