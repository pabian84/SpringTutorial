package com.example.demo.domain.finance.service;

import com.example.demo.domain.finance.dto.StockRes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FinanceService {

    // [수정] 404 에러를 유발하던 잘못된 전체 URL(CURRENT_URL) 삭제함.

    public List<StockRes> getExchangeRates() {
        List<StockRes> result = new ArrayList<>();

        // 하나씩 정확한 URL로 요청합니다.
        result.add(fetchRate("USD", "미국 달러"));
        result.add(fetchRate("JPY", "일본 엔화 (100엔)")); // 100엔 기준으로 변환 필요
        result.add(fetchRate("EUR", "유럽 유로"));

        return result;
    }

    private StockRes fetchRate(String code, String name) {
        RestTemplate restTemplate = new RestTemplate();
        // [핵심] 한 번에 하나의 통화만 기준(from)으로 잡아야 합니다.
        String url = "https://api.frankfurter.app/latest?from=" + code + "&to=KRW";
        
        try {
            FrankfurterRes res = restTemplate.getForObject(url, FrankfurterRes.class);
            
            if (res != null && res.rates != null && res.rates.containsKey("KRW")) {
                double rate = res.rates.get("KRW");
                
                // [보정] 일본 엔화는 보통 100엔 단위로 표시하므로 100을 곱해줍니다.
                // API는 1엔당 환율(예: 9.xx원)을 줍니다.
                if (code.equals("JPY")) {
                    rate = rate * 100; 
                }

                return new StockRes(code, name, BigDecimal.valueOf(rate), BigDecimal.ZERO);
            }
        } catch (Exception e) {
            // 실패 시 로그만 남기고 0원으로 처리 (서버 다운 방지)
            log.warn("{} 환율 조회 실패: {}", code, e.getMessage());
        }
        
        // 에러 나면 0원으로 반환 (화면에는 0으로 표시됨)
        return new StockRes(code, name, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    // 내부 DTO
    static class FrankfurterRes {
        public double amount;
        public String base;
        public String date;
        public Map<String, Double> rates;
    }
}