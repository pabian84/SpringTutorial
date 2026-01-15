package com.example.demo.global.config;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// [중요] 이 Import들이 없으면 오류가 납니다.
import com.github.benmanes.caffeine.cache.Caffeine;

@Configuration
@EnableCaching // 캐시 기능 활성화
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        // 1. 동적 캐시 생성을 지원하는 매니저 생성
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();

        Caffeine<Object, Object> defaultCaffeine = Caffeine.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES) // 기본 5분
                .maximumSize(50);  // 기본 50개
        // 2. [Default 설정] Enum에 정의되지 않은 이름이 들어오면 이 설정을 따름 (switch의 default 역할)
        // Objects.requireNonNull을 사용하여 @NonNull 타입으로 변환
        cacheManager.setCaffeine(Objects.requireNonNull(defaultCaffeine));

        // 3. [Specific 설정] Enum 반복
        for (CacheType type : CacheType.values()) {
            
            // 빌더 생성 (공통 설정)
            Caffeine<Object, Object> builder = Caffeine.newBuilder()
                    .recordStats()
                    .maximumSize(type.getMaximumSize()); // 최대 개수 제한은 메모리 보호를 위해 유지

            // 만료 시간이 0보다 클 때만 시간 설정을 적용합니다.
            // 즉, -1이나 0을 넣으면 시간 제한 코드가 실행되지 않아 '무제한'이 됩니다.
            if (type.getExpireAfterWrite() > 0) {
                builder.expireAfterWrite(type.getExpireAfterWrite(), TimeUnit.MINUTES);
            }

            // 캐시 등록
            //캐시 이름과 빌드된 캐시 객체에 대해 Null 체크 명시
            cacheManager.registerCustomCache(
                Objects.requireNonNull(type.getCacheName()), 
                Objects.requireNonNull(builder.build())
            );
        }

        return cacheManager;
    }

    /**
     * [관리 포인트] 여기서 캐시 이름과 만료 시간을 관리합니다.
     * 나중에 다른 캐시가 필요하면 여기에 한 줄만 추가하면 됩니다.
     */
    public enum CacheType {
        // (캐시이름, 만료시간(분), 최대저장개수)
        WEATHER("weather", 15, 100),   // 날씨: 10분 뒤 만료, 최대 100개 저장
        USERS("users", 10, 100),           // [추천 1] 전체 유저 목록 (10분)
        MEMOS("memos", 10, 500),           // [추천 2] 사용자별 메모 (10분)
        ONLINE_USERS("online_users", 1, 50), // [추천 3] 접속자 목록 (1분 - 짧게!)

        // [신규] 무제한 캐시 예시 (시간에 -1 설정)
        // 국가 코드나 카테고리 같은 데이터용
        COMMON_CODE("common_code", -1, 1000);

        private final String cacheName;
        private final int expireAfterWrite;
        private final int maximumSize;

        CacheType(String cacheName, int expireAfterWrite, int maximumSize) {
            this.cacheName = cacheName;
            this.expireAfterWrite = expireAfterWrite;
            this.maximumSize = maximumSize;
        }

        public String getCacheName() { return cacheName; }
        public int getExpireAfterWrite() { return expireAfterWrite; }
        public int getMaximumSize() { return maximumSize; }
    }
}