package com.example.demo.domain.chat.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.example.demo.domain.chat.dto.ChatHistoryRes;

import java.util.List;


@Mapper
public interface ChatMapper {
    // 메시지 저장
    @Insert("INSERT INTO chat_log (sender_id, message) VALUES (#{sender}, #{text})")
    void saveMessage(@Param("sender") String sender, @Param("text") String text);

    // 최근 메시지 50개 가져오기
    @Select("SELECT sender_id as sender, message as text, FORMATDATETIME(created_at, 'yyyy-MM-dd''T''HH:mm:ss') as createdAt FROM chat_log ORDER BY created_at ASC LIMIT 50")
    List<ChatHistoryRes> getRecentMessages();
}