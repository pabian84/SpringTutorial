package com.example.demo;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.TimeZone;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.demo.domain.user.mapper.UserMapper;

import jakarta.annotation.PostConstruct;

@SpringBootApplication
@EnableScheduling // [필수] 이 줄을 꼭 추가해야 1초마다 돌아갑니다!
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }

    /**
     * [핵심] 서버 시작 시 실행되는 설정
     * 1. 타임존을 한국 시간으로 고정 (로그 시간 맞춤)
     * 2. System.out (표준 출력) 인코딩을 강제로 UTF-8로 변경 (디버그 콘솔 한글 깨짐 해결)
     */
    @PostConstruct
    public void init() {
        // 1. 시간대 한국으로 설정
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));

        // 2. [이게 정답입니다] 강제로 System.out의 인코딩을 UTF-8로 못 박습니다.
        // 윈도우 설정이나 launch.json이 뭐라 하든 무시하고 UTF-8로 내뱉게 만듭니다.
        try {
            System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8));
            System.setErr(new PrintStream(new FileOutputStream(FileDescriptor.err), true, StandardCharsets.UTF_8));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}