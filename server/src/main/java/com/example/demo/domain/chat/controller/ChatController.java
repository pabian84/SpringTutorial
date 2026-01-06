package com.example.demo.domain.chat.controller;

import com.example.demo.domain.chat.mapper.ChatMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;

@RestController
public class ChatController {
    private final ChatMapper chatMapper;

    public ChatController(ChatMapper chatMapper) {
        this.chatMapper = chatMapper;
    }

    @GetMapping("/api/chat/history")
    public List<Map<String, Object>> getChatHistory() {
        return chatMapper.getRecentMessages();
    }
}