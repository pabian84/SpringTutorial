package com.example.demo.domain.todo.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TodoDTO {
    private Long id;
    private String userId;
    private String title;
    private String description;
    private LocalDateTime dueDate;
    private Boolean isCompleted;
    private String source;     // 'LOCAL' or 'GOOGLE_CALENDAR'
    private String externalId; // 구글 캘린더 등 외부 일정 ID (추후 연동용)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
