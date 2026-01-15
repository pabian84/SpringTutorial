package com.example.demo.domain.weather.controller;

import com.example.demo.domain.weather.dto.WeatherRes;
import com.example.demo.domain.weather.service.WeatherProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

// 추가
import org.springframework.web.bind.annotation.*;

@Tag(name = "Weather API", description = "날씨 정보 API")
@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {
    
    private final WeatherProvider weatherProvider;

    @Operation(summary = "현재 용인시 날씨 조회")
    @GetMapping
    public WeatherRes getWeather(
        @RequestParam(value = "lat", required = false) Double lat,
        @RequestParam(value = "lon", required = false) Double lon,
        @RequestParam(value = "hourlyLimit", required = false, defaultValue = "26") Integer hourlyLimit,
        @RequestParam(value = "includeWeekly", required = false, defaultValue = "true") Boolean includeWeekly
    ) {
        // 값이 안 넘어오면 기본값(용인) 사용
        double targetLat = (lat != null) ? lat : 37.241086;
        double targetLon = (lon != null) ? lon : 127.177553;

        return weatherProvider.getWeather(targetLat, targetLon, hourlyLimit, includeWeekly);
    }
}