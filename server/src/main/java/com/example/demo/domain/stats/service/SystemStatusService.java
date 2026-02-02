package com.example.demo.domain.stats.service;

import java.lang.management.ManagementFactory;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.sun.management.OperatingSystemMXBean;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;

@Slf4j
@Service
@RequiredArgsConstructor
public class SystemStatusService {

    private final OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    private final SystemInfo si = new SystemInfo();
    private final CentralProcessor processor = si.getHardware().getProcessor();
    private final double GB = 1024 * 1024 * 1024;

    /**
     * 현재 시스템 상태(CPU, RAM)를 측정하여 반환
     */
    public Map<String, Object> getCurrentSystemStatus() {
        // 1. CPU 사용량 (0.0 ~ 1.0 -> 0 ~ 100%)
        double cpuLoad = osBean.getCpuLoad() * 100; 
        if (Double.isNaN(cpuLoad)) cpuLoad = 0.0; // NaN 방지
        
        // 최고 클럭 (단위: Hz -> GHz 변환)
        //long maxFreq = processor.getMaxFreq();
        // 현재 클럭
        long[] currentFreqs = processor.getCurrentFreq();
        // 모든 코어의 클럭을 합산하여 평균을 구합니다.
        // OptionalDouble을 반환하므로 orElse(0.0)로 기본값을 설정합니다.
        double averageFreqHz = Arrays.stream(currentFreqs)
                                    .average()
                                    .orElse(0.0);
        // 보기 좋게 GHz 단위로 변환
        double cpu = averageFreqHz / GB;

        // 2. 메모리 사용량 (전체 - 여유 = 사용중)
        long totalMem = osBean.getTotalMemorySize();
        long freeMem = osBean.getFreeMemorySize();
        long usedMem = totalMem - freeMem;
        double memoryPercent = (double) (usedMem * 100) / totalMem;
        // 보기 좋게 GB 단위로 변환
        double usedMemGB = (double) usedMem / GB;

        // 3. 데이터 포장
        Map<String, Object> data = new HashMap<>();
        data.put("type", "SYSTEM_STATUS"); // 타입 명시
        // 프론트엔드와 포맷 맞춤 (문자열로 보내서 소수점 제어)
        data.put("cpu", Double.valueOf(String.format("%.2f", cpu))); 
        data.put("cpuPercent", Double.valueOf(String.format("%.2f", cpuLoad))); 
        data.put("memory", Double.valueOf(String.format("%.2f", usedMemGB)));
        data.put("memoryPercent", Double.valueOf(String.format("%.2f", memoryPercent)));
        // 시간은 프론트엔드에서 현재 시간 기준으로 처리하는 게 더 자연스러울 수 있으나,
        // 싱크를 위해 서버 시간을 보내줍니다. (형식: 시:분:초)
        data.put("time", java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")));

        return data;
    }
}