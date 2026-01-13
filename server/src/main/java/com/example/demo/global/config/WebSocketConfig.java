package com.example.demo.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.example.demo.handler.ChatHandler;
import com.example.demo.handler.DashboardHandler;
import com.example.demo.handler.UserConnectionHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final DashboardHandler dashboardHandler;
    private final ChatHandler chatHandler;
    private final UserConnectionHandler userConnectionHandler;

    public WebSocketConfig(DashboardHandler dashboardHandler, ChatHandler chatHandler, UserConnectionHandler userConnectionHandler) {
        this.dashboardHandler = dashboardHandler;
        this.chatHandler = chatHandler;
        this.userConnectionHandler = userConnectionHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // ws://localhost:8080/ws/dashboard 로 접속하면 통신 시작
        registry.addHandler(dashboardHandler, "/ws/dashboard")
                .setAllowedOrigins("*"); // 모든 곳에서 접속 허용 (CORS 무시)
        // 채팅용 주소 개설
        registry.addHandler(chatHandler, "/ws/chat")
                .setAllowedOrigins("*"); // 모든 곳에서 접속 허용 (CORS 무시)
        // 유저 연결 상태 관리용 주소 개설
        registry.addHandler(userConnectionHandler, "/ws/connection")
                .setAllowedOrigins("*"); // 모든 곳에서 접속 허용 (CORS 무시)
    }
}