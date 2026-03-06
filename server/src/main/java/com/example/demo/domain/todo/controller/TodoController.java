package com.example.demo.domain.todo.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.domain.todo.dto.TodoDTO;
import com.example.demo.domain.todo.service.TodoService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/todos")
@RequiredArgsConstructor
public class TodoController {

    private final TodoService todoService;

    // 내 할 일 목록 조회
    @GetMapping
    public ResponseEntity<List<TodoDTO>> getTodos(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        List<TodoDTO> todos = todoService.getTodos(userDetails.getUsername());
        return ResponseEntity.ok(todos);
    }

    // 할 일 추가
    @PostMapping
    public ResponseEntity<TodoDTO> createTodo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody TodoDTO todoDto) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        TodoDTO created = todoService.createTodo(userDetails.getUsername(), todoDto);
        return ResponseEntity.ok(created);
    }

    // 할 일 수정 (체크박스 토글 등)
    @PutMapping("/{id}")
    public ResponseEntity<TodoDTO> updateTodo(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody TodoDTO todoDto) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        todoDto.setId(id);
        TodoDTO updated = todoService.updateTodo(userDetails.getUsername(), todoDto);
        return ResponseEntity.ok(updated);
    }

    // 할 일 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTodo(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        todoService.deleteTodo(userDetails.getUsername(), id);
        return ResponseEntity.ok().build();
    }
}
