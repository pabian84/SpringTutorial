// 서버의 Java DTO와 1:1로 매칭되는 타입들입니다.

// 1. UserRes.java 대응
export interface UserDTO {
  id: string;
  name: string;
  role: string;
}

export interface LoginResDTO {
  accessToken: string;
  user: UserDTO;
}

export interface RefreshSessionResDTO {
  accessToken: string;
  refreshToken?: string;  // 새 Refresh Token (Rotation 적용 시)
}

// 기기 세션 정보 (Backend: SessionController.getMySessions)
export interface DeviceSessionDTO {
  id: number;
  deviceType: string;
  userAgent: string;
  ipAddress: string;
  location: string;
  lastActive: string; // LocalDateTime string
  isCurrent: boolean; // 내가 이 기기인지 여부
}

export interface AccessLogDTO {
  id: number;           // Long -> number
  userId: string;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  endPoint: string;
  type: string;
  logTime: string;   // LocalDateTime -> string
}

// 2. ChatHistoryRes.java 대응
export interface ChatHistoryDTO {
  sender: string;
  text: string; // 서버는 message, 프론트는 text로 쓸 수 있으니 확인 필요 (여기선 서버 기준)
  createdAt?: string; // LocalDateTime은 문자열로 넘어옴
}

// 3. StockRes.java 대응 (ExchangeWidget용)
export interface StockDTO {
  symbol: string;
  name: string;
  price: number;
  change: number;
}

// 4. WeatherRes.java 대응 (WeatherWidget용)
export interface WeatherDTO {
  location: string;

  maxTemp: number;
  minTemp: number;
  currentTemp: number;
  currentSky: string;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  
  uvIndex: number;      // 자외선 지수
  rainChance: number;   // 강수 확률 (%)
  pressure: number;     // 기압 (hPa)
  
  sunrise: string;      // 일출 시간 (07:12)
  sunset: string;       // 일몰 시간 (18:30)

  hourlyForecast: HourlyData[];
  weeklyForecast: DailyData[];
}

export interface HourlyData {
  time: string;
  temp: number;
  sky: string;
  type?: string; 
  isNight?: boolean;
}

export interface DailyData {
  date: string;
  maxTemp: number;
  minTemp: number;
  sky: string;
  rainChance: number;
}

// 5. [Memo.java] 메모 (서버가 Entity를 그대로 리턴함)
// 주의: 클라이언트는 text를 썼으나, 서버 Entity는 content입니다.
export interface MemoDTO {
  id: number;          // Long -> number
  userId: string;
  content: string;     // Client 'text' -> Server 'content'
  createdAt?: string;  // LocalDateTime -> string
}

// 6. [CodeStatsService.java] 코드 통계 (Map<String, Object> 반환)
// 서버가 { "Java": 10, "TypeScript": 5 ... } 형태로 준다고 가정
export interface CodeStatsDTO {
  [language: string]: number; 
}

// 코드 통계 차트용 데이터 타입
export interface CodeData {
  name: string;
  value: number;
  [key: string]: string | number; // 동적 속성 허용 (필수)
}

// 5. 서버 모니터링 시스템 메시지 대응
export interface SystemStatusDTO {
  type: 'SYSTEM_STATUS' | 'USER_UPDATE';
  time?: string;
  cpu: number;
  cpuPercent: number;
  memory: number;
  memoryPercent: number;
}

export type ErrorCode = 
  | 'A001' // 비밀번호 불일치
  | 'A002' // 유효하지 않은 토큰
  | 'A003' // 만료된 토큰
  | 'A004' // 세션 만료/로그아웃
  | 'A005' // 권한 없음
  | 'A006' // 내 기기 아님
  | 'S001' // 세션 찾을 수 없음
  | 'C001'; // 잘못된 입력



// 1. 시스템 상태 (SystemStatusService.java)
export interface SystemStatusMessage {
  type: 'SYSTEM_STATUS';
  time: string;
  cpu: number;
  cpuPercent: number;
  memory: number;
  memoryPercent: number;
}

// 2. 채팅 메시지 (ChatService.java)
export interface ChatMessage {
  type: 'CHAT';
  sender: string;
  text: string;
  createdAt: string;
}

// 3. 접속자 수 업데이트 (SessionService.java)
export interface UserUpdateMessage {
  type: 'USER_UPDATE';
  onlineUserCount: number;
}

// 4. 메모 업데이트 알림 (MemoController.java)
export interface MemoUpdateMessage {
  type: 'MEMO_UPDATE';
  userId?: string;
}

// 5. 강제 로그아웃 (SessionService.java - forceDisconnect)
export interface ForceLogoutMessage {
  type: 'FORCE_LOGOUT'; // 프론트에서 처리할 타입 명시 (에러코드 4001 등)
  reason?: string;
}

// [핵심] 모든 소켓 메시지의 합집합 (Discriminated Union)
export type WebSocketMessage = 
  | SystemStatusMessage 
  | ChatMessage 
  | UserUpdateMessage 
  | MemoUpdateMessage
  | ForceLogoutMessage;

// [클라이언트 발신용] 채팅 보낼 때 사용
export interface SendChatMessage {
  type: 'CHAT';
  sender: string;
  text: string;
}

export type WebSocketSendMessage = SendChatMessage; // 추후 발신 타입 추가 가능