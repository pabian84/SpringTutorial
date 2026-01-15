package com.example.demo.domain.weather.service;
import com.example.demo.domain.weather.dto.WeatherRes;

public interface WeatherProvider {
    WeatherRes getWeather(double lat, double lon);
    WeatherRes getWeather(double lat, double lon, int hourlyLimit, boolean includeWeekly);
}