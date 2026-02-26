package com.example.demo.domain.user.mapper;

import com.example.demo.domain.user.entity.Session;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface SessionMapper {
    // 1. 세션 정보 저장 (device_id 포함)
    @Insert("INSERT INTO user_sessions " +
            "(user_id, refresh_token, device_type, user_agent, ip_address, location, device_id, keep_login, last_accessed_at, created_at) " +
            "VALUES " +
            "(#{userId}, #{refreshToken}, #{deviceType}, #{userAgent}, #{ipAddress}, #{location}, #{deviceId}, #{keepLogin}, NOW(), NOW())")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insertSession(Session session);

    // 세션 전체 정보 업데이트 (세션 재사용 시 최신 기기 정보 반영용)
    @Update("UPDATE user_sessions SET " +
            "refresh_token = #{refreshToken}, " +
            "device_type = #{deviceType}, " +
            "user_agent = #{userAgent}, " +
            "ip_address = #{ipAddress}, " +
            "location = #{location}, " +
            "keep_login = #{keepLogin}, " +
            "last_accessed_at = NOW() " +
            "WHERE id = #{id}")
    void updateSession(Session session);

    // 2. 세션 ID로 조회
    @Select("SELECT * FROM user_sessions WHERE id = #{id}")
    Session findBySessionId(Long id);

    // 3. 사용자 ID와 기기 식별값(DeviceId)으로 유효한 세션 조회 (세션 재사용 핵심)
    @Select("SELECT * FROM user_sessions WHERE user_id = #{userId} AND device_id = #{deviceId} LIMIT 1")
    Session findByUserIdAndDeviceId(@Param("userId") String userId, @Param("deviceId") String deviceId);

    // 4. 특정 사용자의 모든 세션 조회
    @Select("SELECT * FROM user_sessions WHERE user_id = #{userId} ORDER BY last_accessed_at DESC")
    List<Session> findByUserId(String userId);

    // 5. 리프레시 토큰으로 세션 조회
    @Select("SELECT * FROM user_sessions WHERE refresh_token = #{refreshToken}")
    Session findByRefreshToken(String refreshToken);

    // 6. 다른 기기 로그아웃
    @Delete("DELETE FROM user_sessions WHERE user_id = #{userId} AND id != #{currentSessionId}")
    void terminateOthers(@Param("userId") String userId, @Param("currentSessionId") Long currentSessionId);

    // 7. 세션 ID로 삭제
    @Delete("DELETE FROM user_sessions WHERE id = #{id}")
    void deleteBySessionId(Long id);

    // 8. 사용자 ID로 모든 세션 삭제
    @Delete("DELETE FROM user_sessions WHERE user_id = #{userId}")
    void deleteByUserId(@Param("userId") String userId);

    // 9. 오래된 세션 자동 정리
    @Delete("DELETE FROM user_sessions WHERE last_accessed_at < DATE_SUB(NOW(), INTERVAL #{days} DAY)")
    void deleteExpiredSessions(@Param("days") int days);

    // 10. 리프레시 토큰 및 접속 시간 갱신
    @Update("UPDATE user_sessions SET refresh_token = #{refreshToken}, last_accessed_at = NOW() WHERE id = #{sessionId}")
    void updateRefreshToken(@Param("sessionId") Long sessionId, @Param("refreshToken") String refreshToken);

    // 11. keepLogin 정보 조회
    @Select("SELECT keep_login FROM user_sessions WHERE id = #{sessionId}")
    Boolean getKeepLoginBySessionId(@Param("sessionId") Long sessionId);

    // 12. 마지막 접속 시간 갱신
    @Update("UPDATE user_sessions SET last_accessed_at = NOW() WHERE id = #{sessionId}")
    void updateLastAccessedAt(@Param("sessionId") Long sessionId);
}