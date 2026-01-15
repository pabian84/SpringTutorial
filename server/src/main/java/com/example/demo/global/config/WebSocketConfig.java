package com.example.demo.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.example.demo.handler.ChatHandler;
import com.example.demo.handler.DashboardHandler;
import com.example.demo.handler.UserConnectionHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @NonNull 
    private final DashboardHandler dashboardHandler;
    @NonNull 
    private final ChatHandler chatHandler;
    @NonNull 
    private final UserConnectionHandler userConnectionHandler;

    public WebSocketConfig(@NonNull DashboardHandler dashboardHandler, @NonNull ChatHandler chatHandler, @NonNull UserConnectionHandler userConnectionHandler) {
        this.dashboardHandler = dashboardHandler;
        this.chatHandler = chatHandler;
        this.userConnectionHandler = userConnectionHandler;
    }

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
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