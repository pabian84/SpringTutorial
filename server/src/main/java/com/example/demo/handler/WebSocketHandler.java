package com.example.demo.handler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.example.demo.domain.chat.service.ChatService;
import com.example.demo.domain.stats.service.SystemStatusService;
import com.example.demo.domain.user.service.SessionService;
import com.example.demo.global.util.CookieUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketHandler extends TextWebSocketHandler {

    // [세션 관리] 모든 접속자 (채팅, 관제 등 통합)
    private static final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    // [모듈 주입] 각 기능별 전문가(컴포넌트)들을 데려옵니다.
    private final ChatService chatService;       // 채팅 로직 담당
    private final SystemStatusService systemStatusService; // 시스템 상태 로직 담당
    private final SessionService sessionService;
    // JSON 변환기
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        
        // 유저 ID 파싱 및 온라인 처리 (UserConnectionHandler 로직)
        String userId = getUserIdFromSession(session);
        log.info("userId 연결 시도: " + userId);
        if (userId == null) {
            // ID 없으면 끊기 (보안)
            session.close(CloseStatus.BAD_DATA);
            log.debug("userId is null");
            return;
        }

        // 세션 등록
        sessions.add(session);
        // 유저 세션 관리
        sessionService.addSession(userId, session);
        // 시스템 상태 초기값 전송
        Map<String, Object> data = systemStatusService.getCurrentSystemStatus();
        TextMessage message = new TextMessage(objectMapper.writeValueAsString(data));
        broadcastToTarget(session, message);

        log.info("통합 소켓 연결: {} (User: {})", session.getId(), userId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        // 메시지 타입 파싱 (type: "CHAT" | "MEMO" ...)
        Map<String, Object> msgData = objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {});
        String type = (String) msgData.get("type");

        if (type == null) {
            log.error("메시지 타입이 null 입니다.");
            return;
        }
        log.debug("메시지 수신, type: " + type);

        // [라우팅] 타입에 따라 담당자에게 위임
        switch (type) {
            case "CHAT":
                // 채팅 담당자에게 "처리해서 방송할 메시지 만들어줘" 라고 시킴
                chatService.processMessage(msgData);
                break;
                
            case "MEMO":
                // 메모는 단순 방송 (필요하다면 MemoHandler 추가 가능)
                broadcast(msgData);
                break;

            case "USER_UPDATE":
                broadcast(msgData);
                break;
                
            default:
                log.warn("알 수 없는 메시지 타입: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        // 사용자 세션 관리
        sessionService.removeWebSocket(session);
        log.info("통합 소켓 종료: {}", session.getId());
    }

    // === 공통 방송 메서드 (메모 등 외부 호출용) ===
    public void broadcast(Map<String, Object> messageMap) throws JsonProcessingException {
        String jsonMessage = objectMapper.writeValueAsString(messageMap);
        broadcast(jsonMessage);
    }

    public void broadcast(String jsonMessage) {
        if (jsonMessage == null) {
            log.error("메시지 변환 실패: null jsonMessage");
            return;
        }
        TextMessage message = new TextMessage(jsonMessage);
        for (WebSocketSession session : sessions) {
            broadcastToTarget(session, message);
        }
    }

    public void broadcastToTarget(WebSocketSession session, TextMessage message) {
        // [수정] 세션 상태 체크를 synchronized 블록 내부로 이동 (레이스 컨디션 방지)
        synchronized (session) {
            // 세션이 열려있는지 확인 (동기화 블록 내에서 다시 확인)
            if (!session.isOpen()) {
                return;
            }
            try {
                session.sendMessage(message);
            } catch (IllegalStateException e) {
                // 세션이 전송 중에关闭된 경우 - 정상적인 상황으로 간주
                log.debug("메시지 전송 중 세션关闭 (정상): {}", session.getId());
            } catch (IOException e) {
                log.debug("메시지 전송 실패 (클라이언트 연결 종료됨): {}", session.getId());
            }
        }
    }

    // 유틸: ID 파싱 (공용 CookieUtil.getUserIdFromSession 사용)
    private String getUserIdFromSession(WebSocketSession session) {
        return CookieUtil.getUserIdFromSession(session);
    }
}