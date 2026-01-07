package com.example.demo.domain.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter              // 모든 필드의 Getter 자동 생성 (getSender, getText...)
@Setter              // 모든 필드의 Setter 자동 생성 (setSender, setText...)
@NoArgsConstructor   // 기본 생성자 생성 (public ChatHistoryRes() {})
@AllArgsConstructor  // 모든 필드를 파라미터로 받는 생성자 생성 (new ChatHistoryRes(sender, text, createdAt))
public class ChatHistoryRes {
    private String sender;
    private String text;
    private String createdAt;

}