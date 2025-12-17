package com.example.demo.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import com.example.demo.handler.SystemStatusHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SystemStatusHandler systemStatusHandler;

    public WebSocketConfig(SystemStatusHandler systemStatusHandler) {
        this.systemStatusHandler = systemStatusHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // ws://localhost:8080/ws/system 으로 접속하면 통신 시작
        registry.addHandler(systemStatusHandler, "/ws/system")
                .setAllowedOrigins("*"); // 모든 곳에서 접속 허용 (CORS 무시)
    }
}