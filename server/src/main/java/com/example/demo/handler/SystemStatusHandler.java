package com.example.demo.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SystemStatusHandler extends TextWebSocketHandler {

    // 현재 접속한 사람들의 목록 (동시 접속 처리용 안전한 Set 사용)
    private static final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // 누군가 접속하면 명단에 추가
        sessions.add(session);
        System.out.println("새로운 모니터링 접속자: " + session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        // 나가면 명단에서 제거
        sessions.remove(session);
        System.out.println("접속 해제: " + session.getId());
    }

    // 모든 사람에게 메시지(JSON)를 쏘는 기능
    public void broadcast(String message) {
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException e) {
                    // 전송 실패 시 무시
                }
            }
        }
    }
}