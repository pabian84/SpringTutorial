package com.example.demo.domain.memo.controller;

import com.example.demo.domain.memo.entity.Memo;
import com.example.demo.domain.memo.service.MemoService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/memo")
@RequiredArgsConstructor // 생성자 자동 주입
public class MemoController {

    private final MemoService memoService; // Mapper 대신 Service 사용

    // [수정] 누구의 메모를 조회할지 파라미터로 받음
    @GetMapping("/{userId}")
    public List<Memo> getMemos(@PathVariable("userId") String userId) {
        return memoService.getMemos(userId);
    }

    // [수정] 저장할 때 userId도 같이 받음
    @PostMapping
    public void addMemo(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        String content = body.get("content");
        memoService.addMemo(userId, content);
    }

    @DeleteMapping("/{id}")
    public void deleteMemo(@PathVariable("id") Long id) {
        memoService.deleteMemo(id);
    }
}