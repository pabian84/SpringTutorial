package com.example.demo.domain.weather.service.impl;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.example.demo.domain.weather.dto.WeatherRes;
import com.example.demo.domain.weather.service.WeatherProvider;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class OpenMeteoService implements WeatherProvider {
    // [수정] RestTemplate을 매번 생성하지 않고 주입받아 사용 (Spring 정석)
    private final RestTemplate restTemplate;

    public OpenMeteoService(RestTemplateBuilder builder) {
        this.restTemplate = builder.build();
    }

    @Override
    // [캐시] "weather"라는 이름의 캐시에 저장. lat, lon이 같으면 캐시된 데이터 반환
    @Cacheable(value = "weather", key = "#lat + '-' + #lon")
    public WeatherRes getWeather(double lat, double lon) {
        // 상세 페이지: 시간별 26개(약 24시간), 주간예보 포함(true)
        return getWeather(lat, lon, 26, true);
    }

    @Override
    // [캐시] "weather"라는 이름의 캐시에 저장. lat, lon이 같으면 캐시된 데이터 반환
    @Cacheable(value = "weather", key = "#lat + '-' + #lon + '-' + #hourlyLimit + '-' + #includeWeekly")
    public WeatherRes getWeather(double lat, double lon, int hourlyLimit, boolean includeWeekly) {
        return getWeatherImp(lat, lon, hourlyLimit, includeWeekly);
    }

    private WeatherRes getWeatherImp(double lat, double lon, int hourlyLimit, boolean includeWeekly) {

        log.info("========== [DB Query] Fetching data! lat: {}, lon: {}, limit: {}, weekly: {} ==========", lat, lon, hourlyLimit, includeWeekly);

        // 1. 날씨 데이터 가져오기 (Open-Meteo)
        String url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat
                + "&longitude=" + lon
                + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure"
                + "&hourly=temperature_2m,weather_code,precipitation_probability"
                + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max"
                + "&timezone=auto&forecast_days=7";

        Map<String, Object> response = safeCast(restTemplate.getForObject(url, Map.class), String.class, Object.class);

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

            //ResponseEntity<Map> geoResponse = restTemplate.exchange(geoUrl, HttpMethod.GET, entity, Map.class);
            // [경고 해결] 명확한 타입 지정 (Raw Type 경고 제거)
            ResponseEntity<Map<String, Object>> geoResponse = restTemplate.exchange(
                geoUrl, 
                Objects.requireNonNull(HttpMethod.GET),
                entity, 
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            // [경고 해결] Null Pointer Access 방지
            Map<String, Object> body = geoResponse.getBody();
            Map<String, Object> addressMap;
            
            if (body != null) {
                addressMap = safeCast(body.get("address"), String.class, Object.class);
            } else {
                addressMap = new HashMap<>();
            }

            if (!addressMap.isEmpty()) {
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
            log.error("Geocoding error: ", e);
        }

        // 1. 현재 날씨 파싱
        Map<String, Object> current = safeCast(response.get("current"), String.class, Object.class);
        Map<String, Object> daily = safeCast(response.get("daily"), String.class, Object.class);
        Map<String, Object> hourly = safeCast(response.get("hourly"), String.class, Object.class);

        // 일출/일몰 리스트를 여기서 딱 한 번만 만듭니다.
        List<String> sunrises = new ArrayList<>();
        List<String> sunsets = new ArrayList<>();
        if (!daily.isEmpty()) {
            sunrises = safeCast(daily.get("sunrise"), String.class);
            sunsets = safeCast(daily.get("sunset"), String.class);
        }
        String todaySunrise = null;
        String todaySunset = null;
        if (!sunrises.isEmpty()) {
            todaySunrise = sunrises.get(0);
        }
        if (!sunsets.isEmpty()) {
            todaySunset = sunsets.get(0);
        }

        // 현재 날씨 상세정보 설정
        if (!current.isEmpty()) {
            res.setCurrentTemp(Double.parseDouble(current.get("temperature_2m").toString()));
            res.setFeelsLike(Double.parseDouble(current.get("apparent_temperature").toString()));
            res.setHumidity(Double.parseDouble(current.get("relative_humidity_2m").toString()));
            res.setWindSpeed(Double.parseDouble(current.get("wind_speed_10m").toString()));
            res.setPressure(Double.parseDouble(current.get("surface_pressure").toString())); // 기압
            // WMO 코드 -> 한글 상태 변환
            String skyStatus = convertCode(Integer.parseInt(current.get("weather_code").toString()));
            // 일출/일몰 구간인지 체크하여 상태 덮어쓰기
            if (todaySunrise != null && todaySunset != null) {
                // Timezone 정보 가져오기 (없으면 UTC)
                String timezoneStr = (String) response.get("timezone");
                if (timezoneStr == null) {
                    timezoneStr = "UTC";
                }
                skyStatus = determineSkyStatus(skyStatus, todaySunrise, todaySunset, timezoneStr);
            }
            res.setCurrentSky(skyStatus);
        }

        // 2. Daily 데이터에서 오늘치 UV, 강수확률, 일출일몰 가져오기
        if (!daily.isEmpty()) {
            List<Double> uvs = safeCast(daily.get("uv_index_max"), Double.class);
            List<Integer> rains = safeCast(daily.get("precipitation_probability_max"), Integer.class);

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
        List<Map<String, Object>> combinedList = new ArrayList<>();
        if (!hourly.isEmpty()) {
            List<String> times = safeCast(hourly.get("time"), String.class);
            List<Double> temps = safeCast(hourly.get("temperature_2m"), Double.class);
            List<Integer> codes = safeCast(hourly.get("weather_code"), Integer.class);

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
            if (!sunrises.isEmpty()) {
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
            if (!sunsets.isEmpty()) {
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

                // 프론트엔드 성능을 위해 너무 많은 데이터는 hourlyLimit 자름 (26개 정도면 24시간+@ 커버)
                if (finalHourlyList.size() >= hourlyLimit) {
                    break;
                }
            }
            res.setHourlyForecast(finalHourlyList);
        }

        // 4. 주간 예보 (Daily)
        List<Map<String, Object>> weekly = new ArrayList<>();
        if (includeWeekly && !daily.isEmpty()) {
            List<String> times = safeCast(daily.get("time"), String.class);
            List<Double> maxTemps = safeCast(daily.get("temperature_2m_max"), Double.class);
            List<Double> minTemps = safeCast(daily.get("temperature_2m_min"), Double.class);
            List<Integer> codes = safeCast(daily.get("weather_code"), Integer.class);
            List<Integer> rainProbs = safeCast(daily.get("precipitation_probability_max"), Integer.class); // 강수확률 추가
            // 최대 7일치 데이터 반복
            for (int i = 0; i < Math.min(7, times.size()); i++) {
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

    // 일출/일몰 상태 결정 로직 (앞뒤 15분)
    private String determineSkyStatus(String originalSky, String sunriseIso, String sunsetIso, String timezone) {
        try {
            // API가 주는 일출/일몰 시간은 해당 지역 Timezone 기준의 ISO 포맷임
            // 현재 서버 시간도 해당 지역 Timezone에 맞춰서 비교해야 함
            ZoneId zoneId = ZoneId.of(timezone);
            LocalDateTime now = LocalDateTime.now(zoneId);

            LocalDateTime sunrise = LocalDateTime.parse(sunriseIso, DateTimeFormatter.ISO_DATE_TIME);
            LocalDateTime sunset = LocalDateTime.parse(sunsetIso, DateTimeFormatter.ISO_DATE_TIME);

            // 1. 일출 구간 (앞뒤 15분)
            if (isWithinRange(now, sunrise, 15)) {
                log.info("일출 구간 감지: " + now + " / " + sunrise);
                return "일출(" + sunrise.toString().substring(11, 16) + ")"; // 일출 상태 반환
            }

            // 2. 일몰 구간 (앞뒤 15분)
            if (isWithinRange(now, sunset, 15)) {
                log.info("일몰 구간 감지: " + now + " / " + sunset);
                return "일몰(" + sunset.toString().substring(11, 16) + ")"; // 일몰 상태 반환
            }

        } catch (Exception e) {
            // 파싱 에러 시 원래 날씨 반환
            return originalSky;
        }

        return originalSky;
    }

    // 시간 범위 체크 헬퍼
    private boolean isWithinRange(LocalDateTime now, LocalDateTime target, int minutes) {
        LocalDateTime start = target.minusMinutes(minutes);
        LocalDateTime end = target.plusMinutes(minutes);
        // now가 start보다 뒤이고(end 포함하지 않음), end보다 앞이어야 함
        // isAfter/isBefore는 경계값을 포함하지 않으므로 정확하게는 >=, <= 처리가 필요할 수 있으나
        // 1분 단위 비교에서는 큰 문제 없음.
        return now.isAfter(start) && now.isBefore(end);
    }

    /**
     * List 안전 변환 (Safe Cast)
     * 사용법: List<String> list = safeCast(rawData, String.class);
     */
    private <T> List<T> safeCast(Object obj, Class<T> clazz) {
        if (obj instanceof List<?> list) {
            return list.stream()
                    .filter(clazz::isInstance) // 타입 안 맞으면 버림 (안전성 확보)
                    .map(clazz::cast)
                    .toList(); // Java 16+
        }
        return Collections.emptyList();
    }

    /**
     * Map 안전 변환 (Safe Cast)
     * 사용법: Map<String, Object> map = safeCast(rawData, String.class, Object.class);
     */
    private <K, V> Map<K, V> safeCast(Object obj, Class<K> keyClass, Class<V> valueClass) {
        Map<K, V> result = new HashMap<>();
        if (obj instanceof Map<?, ?> map) {
            map.forEach((k, v) -> {
                // Key와 Value가 모두 내가 원하는 타입일 때만 담는다.
                if (keyClass.isInstance(k) && valueClass.isInstance(v)) {
                    result.put(keyClass.cast(k), valueClass.cast(v));
                }
            });
        }
        return result;
    }
}