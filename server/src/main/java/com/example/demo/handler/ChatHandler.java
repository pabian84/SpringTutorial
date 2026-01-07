package com.example.demo.handler;

import com.example.demo.domain.chat.mapper.ChatMapper; // 매퍼 임포트
import com.fasterxml.jackson.databind.ObjectMapper; // JSON 파싱용
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.LocalDateTime; // 시간 처리를 위해
import java.time.format.DateTimeFormatter; // 포맷팅을 위해
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatHandler extends TextWebSocketHandler {

    // 채팅방에 들어온 세션들 저장
    private static final Set<WebSocketSession> chatSessions = ConcurrentHashMap.newKeySet();
    private final ChatMapper chatMapper; // DB 저장용
    private final ObjectMapper objectMapper = new ObjectMapper(); // JSON 변환기

    // 생성자 주입
    public ChatHandler(ChatMapper chatMapper) {
        this.chatMapper = chatMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        chatSessions.add(session);
        System.out.println("채팅 입장: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // [핵심] 클라이언트가 보낸 메시지(JSON string)를 그대로 받아서
        String payload = message.getPayload();
        
        // 1. 들어온 메시지 파싱
        Map<String, String> msgData = objectMapper.readValue(payload, Map.class);
        String sender = msgData.get("sender");
        String text = msgData.get("text");

        // 2. DB에 저장
        chatMapper.saveMessage(sender, text);

        // 3. 전송할 데이터 구성 (보낸 사람, 내용 + "시간")
        // 텔레그램처럼 "오후 3:15" 형식으로 만듭니다.
        String nowTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("a h:mm"));

        Map<String, Object> broadcastMap = new HashMap<>();
        broadcastMap.put("sender", sender);
        broadcastMap.put("text", text);
        broadcastMap.put("createdAt", nowTime); // 시간 추가

        String jsonPayload = objectMapper.writeValueAsString(broadcastMap);

        // 4. 접속해 있는 모든 사람(나 포함)에게 다시 쏴준다!
        for (WebSocketSession s : chatSessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(jsonPayload));
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        chatSessions.remove(session);
        System.out.println("채팅 퇴장: " + session.getId());
    }
}