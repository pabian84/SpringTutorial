package com.example.demo.domain.stats.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

@Service
public class CodeStatsService {

    public Map<String, Long> getCodeStatistics() {
        Map<String, Long> stats = new HashMap<>();
        // 초기값 0 설정
        stats.put("Java", 0L);
        stats.put("TypeScript/React", 0L);
        stats.put("CSS/Style", 0L);
        stats.put("Config/Etc", 0L);

        try {
            // 현재 실행 위치(프로젝트 루트 또는 server 폴더)를 기준으로 탐색
            Path startPath = Paths.get(System.getProperty("user.dir"));
            
            // 상위 폴더로 한 번 올라가서 'client'와 'server'를 모두 포함하도록 시도 (통합 통계)
            // 만약 현재가 'server' 폴더 안이라면 상위로 이동
            if (startPath.endsWith("server")) {
                startPath = startPath.getParent();
            }

            try (Stream<Path> stream = Files.walk(startPath)) {
                stream.filter(p -> !Files.isDirectory(p)) // 파일만 대상
                      .filter(this::isSourceCode)         // 소스코드만 대상 (빌드 파일 제외)
                      .forEach(path -> {
                          try {
                              // 파일의 줄 수(Line Count) 계산
                              long lines = Files.lines(path).count();
                              String ext = getExtension(path.toString());
                              
                              if (ext.equals("java")) {
                                  stats.merge("Java", lines, (line1, line2) -> line1 + line2);
                              } else if (ext.equals("ts") || ext.equals("tsx")) {
                                  stats.merge("TypeScript/React", lines, (line1, line2) -> line1 + line2);
                              } else if (ext.equals("css") || ext.equals("scss")) {
                                  stats.merge("CSS/Style", lines, (line1, line2) -> line1 + line2);
                              } else {
                                  stats.merge("Config/Etc", lines, (line1, line2) -> line1 + line2);
                              }
                          } catch (Exception e) {
                              // 읽기 실패한 파일은 무시
                          }
                      });
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

        return stats;
    }

    // 분석할 파일인지, 제외할 파일(node_modules 등)인지 판단
    private boolean isSourceCode(Path path) {
        String p = path.toString();
        // 제외할 폴더들 (이거 안 빼면 node_modules 때문에 수십만 줄 나옴)
        if (p.contains("node_modules") || p.contains(".git") || p.contains("build") || p.contains("dist") || p.contains("bin") || p.contains(".gradle")) {
            return false;
        }
        // 포함할 확장자
        return p.endsWith(".java") || p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".css") || p.endsWith(".gradle");
    }

    private String getExtension(String fileName) {
        int i = fileName.lastIndexOf('.');
        return (i > 0) ? fileName.substring(i + 1) : "";
    }
}