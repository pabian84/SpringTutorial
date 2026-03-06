package com.example.demo.domain.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.user.dto.UserSettingsDTO;
import com.example.demo.domain.user.service.UserSettingsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/user/settings")
@RequiredArgsConstructor
public class UserSettingsController {

    private final UserSettingsService userSettingsService;

    @GetMapping
    public ResponseEntity<UserSettingsDTO> getSettings(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        UserSettingsDTO settings = userSettingsService.getSettings(userDetails.getUsername());
        return ResponseEntity.ok(settings);
    }

    @PutMapping
    public ResponseEntity<UserSettingsDTO> updateSettings(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody UserSettingsDTO settingsDto) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        UserSettingsDTO updated = userSettingsService.saveSettings(userDetails.getUsername(), settingsDto);
        return ResponseEntity.ok(updated);
    }
}
