package com.example.demo.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import com.example.demo.handler.SystemStatusHandler;
import com.example.demo.handler.ChatHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SystemStatusHandler systemStatusHandler;
    private final ChatHandler chatHandler;

    public WebSocketConfig(SystemStatusHandler systemStatusHandler, ChatHandler chatHandler) {
        this.systemStatusHandler = systemStatusHandler;
        this.chatHandler = chatHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // ws://localhost:8080/ws/system 으로 접속하면 통신 시작
        registry.addHandler(systemStatusHandler, "/ws/system")
                .setAllowedOrigins("*"); // 모든 곳에서 접속 허용 (CORS 무시)
        // 채팅용 주소 개설
        registry.addHandler(chatHandler, "/ws/chat")
                .setAllowedOrigins("*"); // 모든 곳에서 접속 허용 (CORS 무시)
    }
}