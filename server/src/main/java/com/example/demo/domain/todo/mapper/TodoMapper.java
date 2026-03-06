package com.example.demo.domain.todo.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.domain.todo.dto.TodoDTO;

@Mapper
public interface TodoMapper {

    // 1. 특정 사용자의 모든 할 일 조회 (최신 순 + 미완료 우선 정렬)
    @Select("SELECT id, user_id as userId, title, description, due_date as dueDate, " +
            "is_completed as isCompleted, source, external_id as externalId, " +
            "created_at as createdAt, updated_at as updatedAt " +
            "FROM todos WHERE user_id = #{userId} " +
            "ORDER BY is_completed ASC, due_date ASC, created_at DESC")
    List<TodoDTO> findByUserId(String userId);

    // 2. 새 할 일 추가
    @Insert("INSERT INTO todos (user_id, title, description, due_date, is_completed, source, external_id) " +
            "VALUES (#{userId}, #{title}, #{description}, #{dueDate}, #{isCompleted}, #{source}, #{externalId})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(TodoDTO todo);

    // 3. 할 일 수정 (제목, 마감일, 완료 상태 등)
    @Update("UPDATE todos SET title = #{title}, description = #{description}, " +
            "due_date = #{dueDate}, is_completed = #{isCompleted}, " +
            "source = #{source}, external_id = #{externalId} " +
            "WHERE id = #{id} AND user_id = #{userId}")
    void update(TodoDTO todo);

    // 4. 할 일 삭제
    @Delete("DELETE FROM todos WHERE id = #{id} AND user_id = #{userId}")
    void delete(@Param("id") Long id, @Param("userId") String userId);
}
