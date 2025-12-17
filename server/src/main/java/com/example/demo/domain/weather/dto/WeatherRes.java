package com.example.demo.domain.weather.dto;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class WeatherRes {
    private String location;
    private Double currentTemp;
    private String currentSky;
    private List<Map<String, Object>> weeklyForecast;
}