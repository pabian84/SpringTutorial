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

    // --- [신규] 리프레시 토큰 관리 ---
    
    // 토큰 추가 저장 (로그인 시)
    @Insert("INSERT INTO refresh_token (user_id, token_value, ip, browser, os, expiration) " +
            "VALUES (#{userId}, #{value}, #{ip}, #{browser}, #{os}, #{expiration})")
    void saveRefreshToken(@Param("userId") String userId, 
                          @Param("value") String value, 
                          @Param("ip") String ip, 
                          @Param("browser") String browser, 
                          @Param("os") String os, 
                          @Param("expiration") java.sql.Timestamp expiration);

    // 토큰 조회
    // 토큰 값으로 조회 (이제 user_id로 찾으면 여러 개 나와서 안 됨)
    @Select("SELECT token_value FROM refresh_token WHERE token_value = #{tokenValue}")
    String findRefreshToken(@Param("tokenValue") String tokenValue);

    // 3. 특정 사용자의 '모든' 기기 토큰 삭제 (비밀번호 변경 시 전체 로그아웃 등)
    @Delete("DELETE FROM refresh_token WHERE user_id = #{userId}")
    void deleteAllRefreshTokens(@Param("userId") String userId);

    // '특정 기기'만 콕 집어서 삭제 (로그아웃용)
    // 나중에 마이페이지에서 "아이폰 로그아웃" 버튼 누를 때도 이거 씁니다.
    @Delete("DELETE FROM refresh_token WHERE token_value = #{tokenValue}")
    void deleteRefreshToken(@Param("tokenValue") String tokenValue);

    // 내 기기 목록 조회 (마이페이지용 - 미리 준비)
    // 이걸 호출하면 현재 로그인된 모든 기기 정보를 가져옵니다.
    @Select("SELECT * FROM refresh_token WHERE user_id = #{userId}")
    List<Map<String, Object>> findMyDevices(@Param("userId") String userId);

    // 비밀번호 강제 변경 기능
    @Update("UPDATE users SET password = #{password} WHERE id = #{id}")
    void updatePassword(@Param("id") String id, @Param("password") String password);
}
