package com.example.demo.domain.user.service;

import com.example.demo.domain.user.dto.UserLoginReq;
import com.example.demo.domain.user.dto.UserRes;
import com.example.demo.domain.user.entity.AccessLog;
import com.example.demo.domain.user.entity.User;
import com.example.demo.domain.user.mapper.UserMapper;
import lombok.RequiredArgsConstructor;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;

    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public Map<String, Object> login(UserLoginReq req) {
        User user = userMapper.findById(req.getId());
        Map<String, Object> result = new HashMap<>();

        if (user != null && user.getPassword().equals(req.getPassword())) {
            userMapper.saveLog(user.getId(), "LOGIN");
            result.put("status", "ok");
            UserRes userRes = new UserRes(user.getId(), user.getName());
            result.put("user", userRes); // 실제론 여기서 비밀번호 빼고 DTO로 변환해서 줘야 함
        } else {
            result.put("status", "fail");
        }
        return result;
    }

    @CacheEvict(value = "online_users", allEntries = true) // [캐시 무효화] 접속자 목록 캐시 삭제
    public void logout(String userId) {
        userMapper.saveLog(userId, "LOGOUT");
    }

    // [수정됨] 반환 타입이 List<User> -> List<UserRes>로 변경
    @Cacheable(value = "users") // [캐시 적용] 전체 유저 목록은 10분 동안 DB 조회 없이 캐시된 값 반환
    public List<UserRes> getUserList() {
        // 1. 창고에서 원본(User)을 다 꺼내옴
        List<User> userEntities = userMapper.findAll();
        
        // 2. 포장된 박스(UserRes)들을 담을 리스트 준비
        List<UserRes> result = new ArrayList<>();

        // 3. 하나씩 꺼내서 안전한 상자에 옮겨 담기 (비밀번호 제외)
        for (User user : userEntities) {
            result.add(new UserRes(user.getId(), user.getName()));
        }

        // 4. 포장된 것들만 반환
        return result;
    }

    // 접속 중인 유저 리스트 반환
    /// [캐시 적용] 접속자 목록은 1분 동안 DB 조회 없이 캐시된 값 반환
    // 로그인/로그아웃 시 데이터가 변하더라도 1분 정도의 오차는 허용하거나, 
    // login/logout 메서드에 @CacheEvict(value = "online_users", allEntries = true)를 붙여서 즉시 갱신할 수도 있습니다.
    @Cacheable(value = "online_users") // [캐시 적용] 접속자 목록은 1분 동안 DB 조회 없이 캐시된 값 반환
    public List<UserRes> getOnlineUserList() {
        List<User> userEntities = userMapper.findOnlineUsers();
        List<UserRes> result = new ArrayList<>();
        for (User user : userEntities) {
            result.add(new UserRes(user.getId(), user.getName()));
        }
        return result;
    }

    // 상태 업데이트용 메서드 (Controller에서 부를 예정)
    public void updateUserStatus(String id, boolean isOnline) {
        userMapper.updateStatus(id, isOnline);
    }

    public List<AccessLog> getLogs(String userId) {
        return userMapper.findLogs(userId);
    }
}