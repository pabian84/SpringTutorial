import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaCircle, FaTrash, FaPlus, FaCalendarAlt, FaGoogle } from 'react-icons/fa';
import { todoApi } from '../api/todoApi';
import type { TodoDTO } from '../types/dtos';
import { showToast } from '../utils/Alert';

export default function TodoWidget() {
  const [todos, setTodos] = useState<TodoDTO[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  async function fetchTodos() {
    try {
      const data = await todoApi.getTodos();
      setTodos(data);
    } catch (err) {
      console.error('Todo fetch error:', err);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTodos();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      let isoDate = undefined;
      if (newDueDate) {
        const d = new Date(newDueDate);
        d.setHours(23, 59, 59, 999);
        isoDate = d.toISOString();
      }

      await todoApi.createTodo({
        title: newTitle,
        dueDate: isoDate,
        isCompleted: false
      });
      
      setNewTitle('');
      setNewDueDate('');
      fetchTodos();
    } catch {
      showToast('할 일 추가에 실패했습니다.', 'error');
    }
  };

  const handleToggle = async (todo: TodoDTO) => {
    try {
      await todoApi.updateTodo(todo.id, {
        ...todo,
        isCompleted: !todo.isCompleted
      });
      setTodos(todos.map(t => t.id === todo.id ? { ...t, isCompleted: !t.isCompleted } : t));
    } catch {
      showToast('상태 변경 실패', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await todoApi.deleteTodo(id);
      setTodos(todos.filter(t => t.id !== id));
    } catch {
      showToast('삭제 실패', 'error');
    }
  };

  const getDDayBadge = (dueDateString?: string, isCompleted?: boolean) => {
    if (!dueDateString || isCompleted) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    const dueDate = new Date(dueDateString); dueDate.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(dueDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const isPast = dueDate < today;

    let badgeText = ''; let badgeColor = '';
    if (dueDate.getTime() === today.getTime()) { badgeText = 'D-Day'; badgeColor = '#ef4444'; }
    else if (isPast) { badgeText = `D+${diffDays}`; badgeColor = '#9ca3af'; }
    else { badgeText = `D-${diffDays}`; badgeColor = diffDays <= 3 ? '#f59e0b' : '#3b82f6'; }

    return (
      <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 6px', borderRadius: '4px', backgroundColor: `${badgeColor}25`, color: badgeColor, whiteSpace: 'nowrap' }}>
        {badgeText}
      </span>
    );
  };

  return (
    <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column', color: '#eaeaea', boxSizing: 'border-box' }}>
      
      {/* 1. 입력 폼: 완벽한 Flexbox 적용 (min-width: 0 필수) */}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', flexShrink: 0 }}>
        
        {/* 입력창 + 버튼 */}
        <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새로운 할 일 입력..."
            style={{
              flex: 1, minWidth: 0, // [핵심] minWidth: 0 이 있어야 flex 아이템이 영역을 탈출하지 않음
              height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid #444',
              backgroundColor: '#2d2d2d', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '14px'
            }}
          />
          <button type="submit" style={{
            flexShrink: 0, width: '42px', height: '38px', borderRadius: '6px', border: 'none', backgroundColor: '#a855f7',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FaPlus />
          </button>
        </div>

        {/* 날짜 선택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaCalendarAlt color="#888" size={14} />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            style={{
              background: '#2d2d2d', border: '1px solid #444',
              color: newDueDate ? '#fff' : '#888', // 날짜 미선택시 글자 흐리게
              outline: 'none', fontFamily: 'inherit', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer'
            }}
          />
        </div>
      </form>

      {/* 2. 할 일 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
        {todos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '20px', fontSize: '13px' }}>
            할 일이 없습니다. 일정을 추가해보세요!
          </div>
        ) : (
          // ul 대신 block 요소 사용
          <div style={{ display: 'block' }}>
            {todos.map(todo => (
              <div key={todo.id} style={{
                display: 'flex', alignItems: 'center', padding: '12px', marginBottom: '8px',
                backgroundColor: todo.isCompleted ? '#1f293780' : '#2d2d2d',
                borderRadius: '8px', border: '1px solid #333',
                opacity: todo.isCompleted ? 0.6 : 1, width: '100%', boxSizing: 'border-box'
              }}>
                
                {/* 체크박스 */}
                <button
                  onClick={() => handleToggle(todo)}
                  style={{
                    background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
                    color: todo.isCompleted ? '#a855f7' : '#888',
                    display: 'flex', alignItems: 'center', flexShrink: 0, width: '28px' // 고정 영역 부여
                  }}
                >
                  {todo.isCompleted ? <FaCheckCircle size={20} /> : <FaCircle size={20} />}
                </button>

                {/* 텍스트 영역 */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
                  <div style={{
                    fontSize: '14px', wordBreak: 'break-word', color: '#eaeaea',
                    textDecoration: todo.isCompleted ? 'line-through' : 'none', lineHeight: '1.4'
                  }}>
                    {todo.title}
                  </div>
                  {todo.source === 'GOOGLE_CALENDAR' && (
                    <span style={{ fontSize: '10px', color: '#4285F4', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                      <FaGoogle style={{ marginRight: '4px' }}/> Google Calendar
                    </span>
                  )}
                </div>

                {/* D-Day & 삭제 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {getDDayBadge(todo.dueDate, todo.isCompleted)}
                  <button
                    onClick={() => handleDelete(todo.id)}
                    style={{ 
                      background: '#ef444420', border: 'none', color: '#ef4444', 
                      cursor: 'pointer', width: '28px', height: '28px', borderRadius: '6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title="삭제"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
