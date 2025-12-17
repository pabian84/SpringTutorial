package com.example.demo.domain.user.mapper;

import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.entity.User;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface UserMapper {
    @Select("SELECT * FROM users WHERE id = #{id}")
    User findById(String id);

    @Select("SELECT * FROM users")
    List<User> findAll();

    @Select("SELECT * FROM users WHERE is_online = true")
    List<User> findOnlineUsers();

    // [수정됨] 변수가 2개 이상일 때는 @Param으로 이름을 콕 집어줘야 합니다.
    @Insert("INSERT INTO access_log (user_id, type) VALUES (#{userId}, #{type})")
    void saveLog(@Param("userId") String userId, @Param("type") String type);

    @Select("SELECT * FROM access_log WHERE user_id = #{userId} ORDER BY log_time DESC")
    List<AccessLog> findLogs(String userId);

    @Update("UPDATE users SET is_online = #{status} WHERE id = #{id}")
    void updateStatus(@Param("id") String id, @Param("status") boolean status);
}
