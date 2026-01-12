package com.example.demo.domain.stats.controller;

import com.example.demo.domain.stats.service.CodeStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final CodeStatsService codeStatsService;

    @GetMapping("/code")
    public Map<String, Long> getCodeStats() {
        return codeStatsService.getCodeStatistics();
    }
}