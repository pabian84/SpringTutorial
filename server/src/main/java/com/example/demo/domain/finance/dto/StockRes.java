package com.example.demo.domain.finance.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class StockRes {
    private String symbol;      // 코드 (USD, JPY)
    private String name;        // 이름 (미국 달러)
    private BigDecimal price;   // 환율 (1320.50)
    private BigDecimal change;  // 등락률 (API 한계로 일단 0)
}