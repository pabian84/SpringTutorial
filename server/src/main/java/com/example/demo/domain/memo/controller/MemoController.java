package com.example.demo.domain.memo.controller;

import com.example.demo.domain.memo.entity.Memo;
import com.example.demo.domain.memo.mapper.MemoMapper;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/memo")
public class MemoController {

    private final MemoMapper memoMapper;

    public MemoController(MemoMapper memoMapper) {
        this.memoMapper = memoMapper;
    }

    // [수정] 누구의 메모를 조회할지 파라미터로 받음
    @GetMapping("/{userId}")
    public List<Memo> getMemos(@PathVariable("userId") String userId) {
        return memoMapper.findAll(userId);
    }

    // [수정] 저장할 때 userId도 같이 받음
    @PostMapping
    public void addMemo(@RequestBody Map<String, String> body) {
        String userId = body.get("userId");
        String content = body.get("content");
        memoMapper.save(userId, content);
    }

    @DeleteMapping("/{id}")
    public void deleteMemo(@PathVariable("id") Long id) {
        memoMapper.deleteById(id);
    }
}