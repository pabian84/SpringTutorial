import React, { useState } from 'react';
import { FaGoogle, FaSearch, FaRobot, FaGithub, FaYoutube, FaEnvelope } from 'react-icons/fa';
import { SiNaver } from 'react-icons/si';

type SearchEngine = 'google' | 'naver' | 'chatgpt' | 'perplexity' | 'gemini';

interface EngineConfig {
  id: SearchEngine;
  name: string;
  icon: React.ReactNode;
  url: string;
  placeholder: string;
}

const ENGINES: Record<SearchEngine, EngineConfig> = {
  google: { id: 'google', name: 'Google', icon: <FaGoogle color="#4285F4" />, url: 'https://www.google.com/search?q=', placeholder: '구글에서 검색...' },
  naver: { id: 'naver', name: 'Naver', icon: <SiNaver color="#03C75A" />, url: 'https://search.naver.com/search.naver?query=', placeholder: '네이버에서 검색...' },
  chatgpt: { id: 'chatgpt', name: 'ChatGPT', icon: <FaRobot color="#10A37F" />, url: 'https://chatgpt.com/?q=', placeholder: 'ChatGPT에게 질문...' },
  perplexity: { id: 'perplexity', name: 'Perplexity', icon: <FaRobot color="#22B8CD" />, url: 'https://www.perplexity.ai/search?q=', placeholder: 'Perplexity AI 검색...' },
  gemini: { id: 'gemini', name: 'Gemini', icon: <FaRobot color="#8E44AD" />, url: 'https://gemini.google.com/app?q=', placeholder: 'Gemini에게 물어보기...' },
};

const QUICK_LINKS = [
  { name: 'GitHub', url: 'https://github.com', icon: <FaGithub size={20} color="#f0f6fc" /> },
  { name: 'YouTube', url: 'https://youtube.com', icon: <FaYoutube size={20} color="#ff0000" /> },
  { name: 'Gmail', url: 'https://mail.google.com', icon: <FaEnvelope size={20} color="#ea4335" /> },
];

export default function SearchWidget() {
  const [engine, setEngine] = useState<SearchEngine>('google');
  const [query, setQuery] = useState('');

  const currentEngine = ENGINES[engine];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    window.open(`${currentEngine.url}${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
    setQuery('');
  };

  return (
    // [수정] 스크롤바 제거, 패딩과 갭을 줄여서 작은 위젯 카드에서도 안 짤리도록 압축
    <div style={{ padding: '12px', height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#1e1e1e', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      {/* 1. 검색 엔진 선택 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>검색 엔진:</span>
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value as SearchEngine)}
          style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#2d2d2d', color: '#fff', border: '1px solid #444', fontSize: '12px', outline: 'none' }}
        >
          {Object.values(ENGINES).map((eng) => (
            <option key={eng.id} value={eng.id}>{eng.name}</option>
          ))}
        </select>
      </div>

      {/* 2. 검색 입력 폼 (절대적인 Flex 비율 보장) */}
      <form onSubmit={handleSearch} style={{ display: 'flex', width: '100%', gap: '8px', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
            {currentEngine.icon}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={currentEngine.placeholder}
            style={{
              width: '100%', height: '38px', padding: '0 10px 0 34px', borderRadius: '6px', border: '1px solid #444',
              backgroundColor: '#2d2d2d', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            flexShrink: 0, width: '70px', height: '38px', borderRadius: '6px', backgroundColor: '#00c6ff', color: '#000',
            border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '13px'
          }}
        >
          <FaSearch size={12} /> 검색
        </button>
      </form>

      {/* 3. 자주 가는 링크 (크기를 대폭 줄이고 공간이 없으면 유연하게 배치) */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>자주 가는 사이트</span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {QUICK_LINKS.map((link) => (
            <a
              key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                textDecoration: 'none', color: '#eaeaea', padding: '6px', borderRadius: '6px', backgroundColor: '#2d2d2d',
                width: '55px', height: '55px', boxSizing: 'border-box', border: '1px solid #333'
              }}
            >
              {link.icon}
              <span style={{ fontSize: '10px' }}>{link.name}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
