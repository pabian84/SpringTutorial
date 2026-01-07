package com.example.demo.domain.weather.service.impl;

import com.example.demo.domain.weather.dto.WeatherRes;
import com.example.demo.domain.weather.service.WeatherProvider;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class OpenMeteoService implements WeatherProvider {

    @Override
    public WeatherRes getWeather(double lat, double lon) {
        // 1. 날씨 데이터 가져오기 (Open-Meteo)
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat
                    + "&longitude=" + lon
                    + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure"
                    + "&hourly=temperature_2m,weather_code,precipitation_probability"
                    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max"
                    + "&timezone=auto&forecast_days=7";
        
        RestTemplate restTemplate = new RestTemplate();
        Map<String, Object> response = restTemplate.getForObject(url, Map.class);
        
        // 데이터 파싱 (복잡한 로직은 Service에 숨김)
        WeatherRes res = new WeatherRes();
        // 2. 좌표를 한글 주소로 변환 (Reverse Geocoding - Nominatim)
        try {
            // zoom=10: 시/군/구 레벨, accept-language=ko: 한글 반환
            String geoUrl = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat 
                            + "&lon=" + lon + "&zoom=10&addressdetails=1&accept-language=ko";
            
            // Nominatim은 User-Agent 헤더가 필수입니다.
            HttpHeaders headers = new HttpHeaders();
            headers.add("User-Agent", "SpringTutorialApp/1.0"); // 앱 이름 임의 지정
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> geoResponse = restTemplate.exchange(geoUrl, HttpMethod.GET, entity, Map.class);
            Map<String, Object> addressMap = (Map<String, Object>) geoResponse.getBody().get("address");
            
            if (addressMap != null) {
                // 시, 도, 구 중 존재하는 값 조합
                String city = (String) addressMap.getOrDefault("city", "");
                String province = (String) addressMap.getOrDefault("province", "");
                String town = (String) addressMap.getOrDefault("town", "");
                String borough = (String) addressMap.getOrDefault("borough", "");
                
                String locationName = "";
                if (!province.isEmpty()) { 
                    locationName += province + " "; 
                }
                if (!city.isEmpty()) { 
                    locationName += city; 
                } else if (!town.isEmpty()) { 
                    locationName += town; 
                } else if (!borough.isEmpty()) {
                    locationName += borough;
                }
                
                res.setLocation(locationName.trim());
            } else {
                res.setLocation("알 수 없는 지역");
            }
        } catch (Exception e) {
            // API 실패 시 기본값
            res.setLocation("위치 확인 불가");
            System.out.println("Geocoding error: " + e.getMessage());
        }

        // 1. 현재 날씨 파싱
        Map<String, Object> current = (Map<String, Object>) response.get("current");
        Map<String, Object> daily = (Map<String, Object>) response.get("daily");

        if (current != null) {
            res.setCurrentTemp(Double.parseDouble(current.get("temperature_2m").toString()));
            res.setFeelsLike(Double.parseDouble(current.get("apparent_temperature").toString()));
            res.setHumidity(Double.parseDouble(current.get("relative_humidity_2m").toString()));
            res.setWindSpeed(Double.parseDouble(current.get("wind_speed_10m").toString()));
            res.setPressure(Double.parseDouble(current.get("surface_pressure").toString())); // 기압
            res.setCurrentSky(convertCode(Integer.parseInt(current.get("weather_code").toString())));
        }

        // [일출/일몰] 데이터 추출을 위한 리스트 초기화
        List<String> sunrises = new ArrayList<>();
        List<String> sunsets = new ArrayList<>();

        // 2. Daily 데이터에서 오늘치 UV, 강수확률, 일출일몰 가져오기
        if (daily != null) {
            List<Double> uvs = (List<Double>) daily.get("uv_index_max");
            List<Integer> rains = (List<Integer>) daily.get("precipitation_probability_max");
            sunrises = (List<String>) daily.get("sunrise");
            sunsets = (List<String>) daily.get("sunset");

            if (!uvs.isEmpty()) {
                res.setUvIndex(uvs.get(0).intValue());
            }
            if (!rains.isEmpty()) {
                res.setRainChance(rains.get(0));
            }
            // 시간 포맷팅 (2024-01-07T07:12 -> 07:12)
            // 초 단위 제외하고 HH:mm 형식으로 저장
            if (!sunrises.isEmpty()) {
                res.setSunrise(sunrises.get(0).substring(11, 16));
            }
            if (!sunsets.isEmpty()) {
                res.setSunset(sunsets.get(0).substring(11, 16));
            }
        }

        // 3. 시간대별 예보 (Hourly) + 일출/일몰
        Map<String, Object> hourly = (Map<String, Object>) response.get("hourly");
        List<Map<String, Object>> combinedList = new ArrayList<>();
        if (hourly != null) {
            List<String> times = (List<String>) hourly.get("time");
            List<Double> temps = (List<Double>) hourly.get("temperature_2m");
            List<Integer> codes = (List<Integer>) hourly.get("weather_code");

            // (1) 일반 시간대별 예보 데이터 추가
            for (int i = 0; i < times.size(); i++) {
                if (times.get(i) == null) {
                    continue; // 데이터가 비어있으면 스킵
                }
                Map<String, Object> item = new HashMap<>();
                item.put("fullTime", times.get(i)); // 정렬을 위한 원본 시간 문자열 (YYYY-MM-DDTHH:mm)
                item.put("time", times.get(i).substring(11, 16)); // 화면 표시용 (HH:mm)
                item.put("temp", temps.get(i));
                item.put("sky", convertCode(codes.get(i)));
                item.put("type", "normal"); // 일반 타입
                combinedList.add(item);
            }

            // (2) 일출 데이터 리스트에 끼워넣기
            if (sunrises != null) {
                for (String s : sunrises) {
                    if (s == null) {
                        continue;
                    }
                    Map<String, Object> item = new HashMap<>();
                    item.put("fullTime", s);
                    item.put("time", s.substring(11, 16));
                    item.put("temp", 0.0); // 일출/일몰은 온도 불필요
                    item.put("sky", "일출");
                    item.put("type", "special"); // 특수 타입
                    combinedList.add(item);
                }
            }
            
            // (3) 일몰 데이터 리스트에 끼워넣기
            if (sunsets != null) {
                for (String s : sunsets) {
                    if (s == null) {
                        continue;
                    }
                    Map<String, Object> item = new HashMap<>();
                    item.put("fullTime", s);
                    item.put("time", s.substring(11, 16));
                    item.put("temp", 0.0);
                    item.put("sky", "일몰");
                    item.put("type", "special");
                    combinedList.add(item);
                }
            }

            // (4) 시간순 정렬 수행 (Null Safe)
            // [중요] 여기서 NPE가 발생했었음. null 체크를 확실히 하여 방지함.
            combinedList.sort((o1, o2) -> {
                String t1 = (String) o1.get("fullTime");
                String t2 = (String) o2.get("fullTime");
                
                // 둘 다 null이면 동등
                if (t1 == null && t2 == null) {
                    return 0;
                }
                // t1만 null이면 뒤로 보냄
                if (t1 == null) {
                    return 1;
                }
                // t2만 null이면 앞으로 보냄 (t1이 더 작음 취급 X, t2가 큼) -> 정렬 규칙상 null safe
                if (t2 == null) {
                    return -1;
                }
                return t1.compareTo(t2);
            });

            // (5) "현재 위치의 시간"을 기준으로 필터링
            // API가 반환한 timezone 정보를 활용 (예: America/New_York)
            String timezoneStr = (String) response.get("timezone"); 
            if (timezoneStr == null) {
                timezoneStr = "UTC"; // 값이 없으면 기본 UTC
            }
            ZoneId zoneId = ZoneId.of(timezoneStr);
            LocalDateTime now = LocalDateTime.now(zoneId); // 해당 지역의 현재 시간 구하기
            String nowStr = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));

            List<Map<String, Object>> finalHourlyList = new ArrayList<>();
            
            // 정렬된 리스트를 순회하며 현재 시간 이후의 데이터만 추출
            for (Map<String, Object> item : combinedList) {
                String itemTime = (String) item.get("fullTime");
                
                // itemTime이 현재 시간(nowStr)보다 미래거나 같으면 추가
                if (itemTime != null && itemTime.compareTo(nowStr) >= 0) {
                    finalHourlyList.add(item);
                }
                
                // 프론트엔드 성능을 위해 너무 많은 데이터는 자름 (26개 정도면 24시간+@ 커버)
                if (finalHourlyList.size() >= 26) {
                    break;
                }
            }
            res.setHourlyForecast(finalHourlyList);
        }

        // 4. 주간 예보 (Daily)
        List<Map<String, Object>> weekly = new ArrayList<>();
        if (daily != null) {
            List<String> times = (List<String>) daily.get("time");
            List<Double> maxTemps = (List<Double>) daily.get("temperature_2m_max");
            List<Double> minTemps = (List<Double>) daily.get("temperature_2m_min");
            List<Integer> codes = (List<Integer>) daily.get("weather_code");
            List<Integer> rainProbs = (List<Integer>) daily.get("precipitation_probability_max"); // 강수확률 추가

            // 최대 7일치 데이터 반복
            for(int i=0; i<Math.min(7, times.size()); i++) {
                Map<String, Object> day = new HashMap<>();
                day.put("date", times.get(i));
                day.put("maxTemp", maxTemps.get(i));
                day.put("minTemp", minTemps.get(i));
                day.put("sky", convertCode(codes.get(i)));
                if (rainProbs != null) {
                     day.put("rainChance", rainProbs.get(i)); // 비 올 확률
                }
                weekly.add(day);
            }
        }
        res.setWeeklyForecast(weekly);
        return res;
    }

    // [유틸] WMO 날씨 코드를 한글 상태로 변환
    private String convertCode(int code) {
        if (code == 0) {
            return "맑음";
        }
        if (code < 4) {
            return "구름조금";
        }
        if (code < 45) {
            return "흐림";
        }
        if (code < 60) {
            return "안개";
        }
        if (code < 80) {
            return "비";
        }
        if (code < 85) {
            return "소나기";
        }
        if (code < 95) {
            return "눈";
        }
        return "폭풍우";
    }
}