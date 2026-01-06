package com.example.demo.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatHandler extends TextWebSocketHandler {

    // 채팅방에 들어온 세션들 저장
    private static final Set<WebSocketSession> chatSessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        chatSessions.add(session);
        System.out.println("채팅 입장: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // [핵심] 클라이언트가 보낸 메시지(JSON string)를 그대로 받아서
        String payload = message.getPayload();
        
        // 접속해 있는 모든 사람(나 포함)에게 다시 쏴준다!
        for (WebSocketSession s : chatSessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(payload));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        chatSessions.remove(session);
        System.out.println("채팅 퇴장: " + session.getId());
    }
}