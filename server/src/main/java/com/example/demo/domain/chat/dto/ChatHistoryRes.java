package com.example.demo.domain.chat.dto;

public class ChatHistoryRes {
    private String sender;
    private String text;

    // 기본 생성자
    public ChatHistoryRes() {}

    // Getter & Setter
    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
}