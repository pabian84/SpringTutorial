package com.example.demo.domain.user.mapper;

import com.example.demo.domain.user.entity.Session;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SessionMapper {
    // 1. 세션 저장 (로그인 시)
    // DB 컬럼명(snake_case)과 객체 필드명(camelCase) 매핑은 application.yml 설정에 따름
    @Insert("INSERT INTO user_sessions " +
            "(user_id, refresh_token, device_type, user_agent, ip_address, location, last_accessed_at, created_at) " +
            "VALUES " +
            "(#{userId}, #{refreshToken}, #{deviceType}, #{userAgent}, #{ipAddress}, #{location}, NOW(), NOW())")
    @Options(useGeneratedKeys = true, keyProperty = "id") // AI 키값 받아오기
    void insertSession(Session session);

    // 필터에서 세션 생존 확인용
    @Select("SELECT * FROM user_sessions WHERE id = #{id}")
    Session findBySessionId(Long id);

    // 2. 내 기기 목록 조회
    @Select("SELECT * FROM user_sessions WHERE user_id = #{userId} ORDER BY last_accessed_at DESC")
    List<Session> findByUserId(String userId);

    // 3. 리프레시 토큰으로 세션 조회 (토큰 갱신용)
    @Select("SELECT * FROM user_sessions WHERE refresh_token = #{refreshToken}")
    Session findByRefreshToken(String refreshToken);

    // 4. 특정 기기(ID) 강제 추방 (로그아웃)
    @Delete("DELETE FROM user_sessions WHERE id = #{id}")
    void deleteBySessionId(Long id);

    // 5. 현재 기기 제외하고 모두 로그아웃 (핵심 기능)
    @Delete("DELETE FROM user_sessions WHERE user_id = #{userId} AND id != #{currentSessionId}")
    void terminateOthers(@Param("userId") String userId, @Param("currentSessionId") Long currentSessionId);

    // 6. 모든 기기 로그아웃 (비번 변경, 탈퇴 등)
    @Delete("DELETE FROM user_sessions WHERE user_id = #{userId}")
    void deleteByUserId(@Param("userId") String userId);
    
    // 마지막 접속 시간이 특정 기간(예: 30일)보다 오래된 세션 삭제
    @Delete("DELETE FROM user_sessions WHERE last_accessed_at < DATE_SUB(NOW(), INTERVAL #{days} DAY)")
    void deleteExpiredSessions(@Param("days") int days);
}