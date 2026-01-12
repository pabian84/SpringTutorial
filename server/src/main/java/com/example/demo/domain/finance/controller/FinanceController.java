package com.example.demo.domain.finance.controller;

import com.example.demo.domain.finance.dto.StockRes;
import com.example.demo.domain.finance.service.FinanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/finance")
@RequiredArgsConstructor
public class FinanceController {

    private final FinanceService financeService;

    @GetMapping("/dashboard")
    public List<StockRes> getDashboardData() {
        // 이제 서비스가 알아서 List<StockRes>를 줍니다. 바로 리턴!
        return financeService.getExchangeRates();
    }
}