package com.example.demo.domain.user.mapper;

import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.entity.User;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface UserMapper {
    // 사용자 아이디로 사용자 정보 조회
    @Select("SELECT * FROM users WHERE id = #{id}")
    User findById(String id);

    // 모든 사용자 정보 조회
    @Select("SELECT * FROM users")
    List<User> findAll();

    // 온라인 사용자 목록 조회
    @Select("SELECT * FROM users WHERE is_online = true")
    List<User> findOnlineUsers();

    // 사용자 접속 상태 업데이트
    @Update("UPDATE users SET is_online = #{status} WHERE id = #{id}")
    void updateStatus(@Param("id") String id, @Param("status") boolean status);

    // 모든 유저의 접속 상태를 강제로 해제(초기화)하는 쿼리
    @Update("UPDATE users SET is_online = false")
    void resetAllUserStatus();

    // [수정] 로그 저장 (브라우저, OS 추가)
    @Insert("INSERT INTO access_log (user_id, ip_address, user_agent, browser, os, endpoint, type) " +
            "VALUES (#{userId}, #{ipAddress}, #{userAgent}, #{browser}, #{os}, #{endpoint}, #{type})")
    void saveLog(AccessLog log);

    // 사용자 접속 로그 조회
    @Select("SELECT * FROM access_log WHERE user_id = #{userId} ORDER BY log_time DESC")
    List<AccessLog> findLogs(@Param("userId") String userId);

    // 내 기기 목록 조회 (마이페이지용 - 미리 준비)
    // 이걸 호출하면 현재 로그인된 모든 기기 정보를 가져옵니다.
    @Select("SELECT * FROM refresh_token WHERE user_id = #{userId}")
    List<Map<String, Object>> findMyDevices(@Param("userId") String userId);

    // 비밀번호 강제 변경 기능
    @Update("UPDATE users SET password = #{password} WHERE id = #{id}")
    void updatePassword(@Param("id") String id, @Param("password") String password);
}
