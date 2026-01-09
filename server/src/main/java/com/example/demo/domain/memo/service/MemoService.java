package com.example.demo.domain.memo.service;

import com.example.demo.domain.memo.entity.Memo;
import com.example.demo.domain.memo.mapper.MemoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MemoService {

    private final MemoMapper memoMapper;

    /**
     * 특정 사용자의 메모 목록 조회
     * <p>
     * 1. "memos" 캐시 저장소에서 userId를 키(Key)로 데이터를 찾습니다.
     * 2. 캐시에 데이터가 있다면? -> DB 조회 없이 바로 반환 (성능 향상).
     * 3. 캐시에 데이터가 없다면? -> DB에서 조회 후 캐시에 저장하고 반환.
     * </p>
     * * @param userId 사용자 ID
     * @return 사용자의 메모 리스트
     */
    @Transactional(readOnly = true) // 조회 전용 트랜잭션 (성능 최적화)
    @Cacheable(value = "memos", key = "#userId")
    public List<Memo> getMemos(String userId) {
        return memoMapper.findAll(userId);
    }

    /**
     * 메모 저장
     * <p>
     * 데이터가 추가되면 기존에 캐싱된 목록은 낡은 데이터가 되므로 삭제(Evict)해야 합니다.
     * key = "#userId"로 해당 사용자의 캐시만 콕 집어서 날려버립니다.
     * 다음 조회 시 DB에서 최신 목록을 다시 가져오게 됩니다.
     * </p>
     *
     * @param userId 사용자 ID
     * @param content 메모 내용
     */
    @Transactional
    @CacheEvict(value = "memos", key = "#userId")
    public void addMemo(String userId, String content) {
        memoMapper.save(userId, content);
    }

    /**
     * 메모 삭제
     * <p>
     * 삭제 시에도 캐시 갱신이 필요합니다.
     * 다만, 삭제 API에는 보통 memoId만 넘어오고 userId는 모르는 경우가 많습니다.
     * userId를 모르면 특정 키를 지정해서 지울 수 없으므로,
     * 안전하게 "memos" 캐시 전체를 비우는(allEntries = true) 방식을 사용합니다.
     * </p>
     *
     * @param id 삭제할 메모의 PK (ID)
     */
    @Transactional
    @CacheEvict(value = "memos", allEntries = true)
    public void deleteMemo(Long id) {
        memoMapper.deleteById(id);
    }
}