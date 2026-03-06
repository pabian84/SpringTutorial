package com.example.demo.domain.user.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.user.dto.UserSettingsDTO;
import com.example.demo.domain.user.mapper.UserSettingsMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserSettingsService {

    private final UserSettingsMapper userSettingsMapper;

    public UserSettingsDTO getSettings(String userId) {
        UserSettingsDTO settings = userSettingsMapper.findSettingsByUserId(userId);
        if (settings == null) {
            // 기본값 반환 (아직 설정하지 않은 사용자)
            return UserSettingsDTO.builder()
                    .userId(userId)
                    .defaultAiEngine("google")
                    .build();
        }
        return settings;
    }

    @Transactional
    public UserSettingsDTO saveSettings(String userId, UserSettingsDTO dto) {
        dto.setUserId(userId); // 보안: 토큰의 userId로 강제 설정
        UserSettingsDTO existing = userSettingsMapper.findSettingsByUserId(userId);
        
        if (existing == null) {
            userSettingsMapper.insertSettings(dto);
        } else {
            userSettingsMapper.updateSettings(dto);
        }
        
        return dto;
    }
}
