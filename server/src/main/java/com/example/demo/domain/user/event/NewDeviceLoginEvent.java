package com.example.demo.domain.user.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 새 기기 로그인 이벤트
 * UserService에서 발행 -> SessionService에서 수신
 */
@Getter
public class NewDeviceLoginEvent extends ApplicationEvent {
    private final String userId;
    private final Long newSessionId;
    private final String deviceType;
    private final String ipAddress;

    public NewDeviceLoginEvent(Object source, String userId, Long newSessionId, String deviceType, String ipAddress) {
        super(source);
        this.userId = userId;
        this.newSessionId = newSessionId;
        this.deviceType = deviceType;
        this.ipAddress = ipAddress;
    }
}
