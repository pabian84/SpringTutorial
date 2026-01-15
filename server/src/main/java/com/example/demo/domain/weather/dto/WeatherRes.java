package com.example.demo.domain.weather.dto;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class WeatherRes {
    private String location;

    private Double maxTemp;
    private Double minTemp;
    private Double currentTemp;
    private String currentSky;
    private double feelsLike;
    private double humidity;
    private double windSpeed;
    private int uvIndex;          // 자외선 지수
    private int rainChance;       // 강수 확률 (%)
    private double pressure;      // 기압 (hPa)
    private String sunrise;       // 일출 시간 (07:12)
    private String sunset;        // 일몰 시간 (18:30)

    private List<Map<String, Object>> hourlyForecast;
    private List<Map<String, Object>> weeklyForecast;
}