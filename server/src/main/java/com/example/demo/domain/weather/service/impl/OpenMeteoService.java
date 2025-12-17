package com.example.demo.domain.weather.service.impl;

import com.example.demo.domain.weather.dto.WeatherRes;
import com.example.demo.domain.weather.service.WeatherProvider;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@Service
public class OpenMeteoService implements WeatherProvider {

    @Override
    public WeatherRes getWeather(double lat, double lon) {
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat
         + "&longitude=" + lon
         + "&current_weather=true&daily=temperature_2m_max,weathercode&timezone=Asia/Seoul";
        
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> response = restTemplate.getForObject(url, Map.class);
        
        // 데이터 파싱 (복잡한 로직은 Service에 숨김)
        WeatherRes res = new WeatherRes();
        res.setLocation("Yongin-si (Giheung)");

        Map<String, Object> current = (Map<String, Object>) response.get("current_weather");
        if (current != null) {
            res.setCurrentTemp(Double.parseDouble(current.get("temperature").toString()));
            res.setCurrentSky(convertCode(Integer.parseInt(current.get("weathercode").toString())));
        }

        Map<String, Object> daily = (Map<String, Object>) response.get("daily");
        List<Map<String, Object>> weekly = new ArrayList<>();
        if (daily != null) {
            List<String> times = (List<String>) daily.get("time");
            List<Double> temps = (List<Double>) daily.get("temperature_2m_max");
            List<Integer> codes = (List<Integer>) daily.get("weathercode");

            for(int i=0; i<Math.min(5, times.size()); i++) {
                Map<String, Object> day = new HashMap<>();
                day.put("date", times.get(i));
                day.put("temp", temps.get(i));
                day.put("sky", convertCode(codes.get(i)));
                weekly.add(day);
            }
        }
        res.setWeeklyForecast(weekly);
        return res;
    }

    private String convertCode(int code) {
        if (code == 0) return "Sunny";
        if (code < 4) return "Cloudy";
        if (code < 70) return "Rain";
        return "Snow/Storm";
    }
}