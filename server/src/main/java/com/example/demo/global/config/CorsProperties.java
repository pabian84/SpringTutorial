package com.example.demo.global.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.cors") // yml의 app.cors 밑에 있는 걸 가져옴
public class CorsProperties {
    
    private List<String> hosts = new ArrayList<>(); // localhost, 10.10.10.183
    private List<Integer> ports = new ArrayList<>(); // 5173, 5174

    /**
     * 입력받은 host와 port를 조합하여 모든 경우의 수(Origin 목록)를 생성하여 반환
     */
    public List<String> getAllowedOrigins() {
        List<String> origins = new ArrayList<>();
        
        // http, https 프로토콜 각각에 대해
        for (String protocol : List.of("http", "https")) {
            for (String host : hosts) {
                for (Integer port : ports) {
                    // 예: http://localhost:5173, https://10.10.10.183:5174 ...
                    origins.add(String.format("%s://%s:%d", protocol, host, port).trim());
                }
            }
        }
        return origins;
    }
}