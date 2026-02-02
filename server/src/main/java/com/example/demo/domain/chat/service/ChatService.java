package com.example.demo.domain.chat.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.chat.mapper.ChatMapper;
import com.example.demo.handler.WebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class ChatService {

    private final ChatMapper chatMapper;
    private final WebSocketHandler webSocketHandler; // 방송용
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 생성자 주입 시 @Lazy 적용
    public ChatService(ChatMapper chatMapper, @Lazy WebSocketHandler webSocketHandler) {
        this.chatMapper = chatMapper;
        this.webSocketHandler = webSocketHandler;
    }

    /**
     * 채팅 메시지를 저장하고, 방송할 데이터 맵을 반환합니다.
     */
    @Transactional
    public void processMessage(Map<String, Object> msgData) throws Exception {
        String sender = (String) msgData.get("sender");
        String text = (String) msgData.get("text");

        // 1. DB 저장
        chatMapper.saveMessage(sender, text);

        // 2. 방송용 데이터 구성 (Service는 JSON이 아니라 객체/Map을 리턴해야 함)
        String nowTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("a h:mm"));

        Map<String, Object> broadcastMap = new HashMap<>();
        broadcastMap.put("type", "CHAT");
        broadcastMap.put("sender", sender);
        broadcastMap.put("text", text);
        broadcastMap.put("createdAt", nowTime);

        // 3. 방송 (Handler에게 위임)
        try {
            webSocketHandler.broadcast(objectMapper.writeValueAsString(broadcastMap));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}