package com.example.demo.domain.todo.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.domain.todo.dto.TodoDTO;
import com.example.demo.domain.todo.mapper.TodoMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TodoService {

    private final TodoMapper todoMapper;

    public List<TodoDTO> getTodos(String userId) {
        return todoMapper.findByUserId(userId);
    }

    @Transactional
    public TodoDTO createTodo(String userId, TodoDTO todoDto) {
        // 보안: 컨트롤러에서 넘겨받은 인증된 userId 강제 주입
        todoDto.setUserId(userId);
        
        // 기본값 설정 (명시되지 않았을 경우)
        if (todoDto.getIsCompleted() == null) {
            todoDto.setIsCompleted(false);
        }
        if (todoDto.getSource() == null || todoDto.getSource().isEmpty()) {
            todoDto.setSource("LOCAL");
        }
        
        todoMapper.insert(todoDto);
        return todoDto; // id가 세팅된 상태로 리턴됨
    }

    @Transactional
    public TodoDTO updateTodo(String userId, TodoDTO todoDto) {
        todoDto.setUserId(userId); // 권한 체크 겸 세팅
        todoMapper.update(todoDto);
        return todoDto;
    }

    @Transactional
    public void deleteTodo(String userId, Long todoId) {
        todoMapper.delete(todoId, userId);
    }
}
