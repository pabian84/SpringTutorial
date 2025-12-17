package com.example.demo.domain.memo.mapper;

import com.example.demo.domain.memo.entity.Memo;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface MemoMapper {
    // [수정] 내 메모만 가져오기 (WHERE user_id = #{userId})
    @Select("SELECT * FROM memo WHERE user_id = #{userId} ORDER BY id DESC")
    List<Memo> findAll(@Param("userId") String userId);

    // [수정] 작성자(user_id)도 같이 저장
    @Insert("INSERT INTO memo (user_id, content) VALUES (#{userId}, #{content})")
    void save(@Param("userId") String userId, @Param("content") String content);

    @Delete("DELETE FROM memo WHERE id = #{id}")
    void deleteById(@Param("id") Long id);
}