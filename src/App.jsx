import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'study_project_state_v1';

const defaultState = {
  members: [
    { id: 'parent-1', name: '엄마', role: 'parent' },
    { id: 'child-1', name: '아이', role: 'child' },
  ],
  tasks: [
    {
      id: 'task-1',
      title: '수학 문제집 10문제 풀기',
      memberId: 'child-1',
      date: todayString(),
      points: 50,
      category: '학습',
      fixed: true,
      completed: false,
      completedAt: '',
    },
    {
      id: 'task-2',
      title: '영어 단어 20개 복습',
      memberId: 'child-1',
      date: todayString(),
      points: 30,
      category: '학습',
      fixed: true,
      completed: true,
      completedAt: new Date().toISOString(),
    },
  ],
  cheers: [
    {
      id: 'cheer-1',
      message: '오늘도 시작이 좋다. 하나씩 끝내면 된다.',
      createdAt: new Date().toISOString(),
    },
  ],
  rewards: [
    {
      id: 'reward-1',
      title: '간식 선택권',
      memberId: 'child-1',
      pointsRequired: 100,
      status: 'available',
      updatedAt: new Date().toISOString(),
    },
  ],
};

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function loadState() {
  if (typeof localStorage === 'undefined') {
    return defaultState;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      ...defaultState,
      ...parsed,
      members: Array.isArray(parsed.members) && parsed.members.length > 0 ? parsed.members : defaultState.members,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : defaultState.tasks,
      cheers: Array.isArray(parsed.cheers) ? parsed.cheers : defaultState.cheers,
      rewards: Array.isArray(parsed.rewards) ? parsed.rewards : defaultState.rewards,
    };
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function startOfWeek(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = (day + 6) % 7;
  current.setDate(current.getDate() - diff);
  current.setHours(0, 0, 0, 0);
  return current;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function isSameDay(left, right) {
  return left === right;
}

function getMemberName(members, memberId) {
  return members.find((member) => member.id === memberId)?.name ?? '미지정';
}

function createEmptyTaskForm(members) {
  return {
    title: '',
    memberId: members.find((member) => member.role === 'child')?.id ?? members[0]?.id ?? '',
    date: todayString(),
    points: 20,
    category: '학습',
    fixed: false,
  };
}

function createEmptyRewardForm(members) {
  return {
    title: '',
    memberId: members.find((member) => member.role === 'child')?.id ?? members[0]?.id ?? '',
    pointsRequired: 100,
  };
}

function computeMemberBalances(state) {
  return state.members.map((member) => {
    const earned = state.tasks
      .filter((task) => task.memberId === member.id && task.completed)
      .reduce((sum, task) => sum + Number(task.points || 0), 0);

    const spent = state.rewards
      .filter((reward) => reward.memberId === member.id && reward.status === 'used')
      .reduce((sum, reward) => sum + Number(reward.pointsRequired || 0), 0);

    return {
      ...member,
      earned,
      spent,
      balance: earned - spent,
      completedTasks: state.tasks.filter((task) => task.memberId === member.id && task.completed).length,
      totalTasks: state.tasks.filter((task) => task.memberId === member.id).length,
      availableRewards: state.rewards.filter((reward) => reward.memberId === member.id && reward.status !== 'used').length,
    };
  });
}

function buildWeekSeries(tasks) {
  const base = startOfWeek();
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(base);
    current.setDate(base.getDate() + index);
    const dateKey = current.toISOString().split('T')[0];
    const completedCount = tasks.filter((task) => task.completed && isSameDay(task.date, dateKey)).length;
    const points = tasks
      .filter((task) => task.completed && isSameDay(task.date, dateKey))
      .reduce((sum, task) => sum + Number(task.points || 0), 0);

    return {
      dateKey,
      label: formatDate(dateKey),
      completedCount,
      points,
    };
  });
}

function getSuggestedNudge(state) {
  const today = todayString();
  const todayTasks = state.tasks.filter((task) => task.date === today);
  const unfinished = todayTasks.filter((task) => !task.completed);

  if (todayTasks.length === 0) {
    return '오늘 등록된 과제가 없습니다. 필요한 과제를 먼저 추가하세요.';
  }

  if (unfinished.length === 0) {
    return '오늘 과제는 모두 끝났습니다. 보상 후보를 확인해도 됩니다.';
  }

  if (unfinished.length === 1) {
    return `마지막 1개만 남았습니다. ${unfinished[0].title}을 먼저 마무리하세요.`;
  }

  return `${unfinished.length}개 과제가 남아 있습니다. 짧은 과제부터 처리하면 좋습니다.`;
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('dashboard');
  const [taskForm, setTaskForm] = useState(() => createEmptyTaskForm(loadState().members));
  const [rewardForm, setRewardForm] = useState(() => createEmptyRewardForm(loadState().members));
  const [cheerText, setCheerText] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('child');

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    setTaskForm((current) => ({
      ...current,
      memberId: current.memberId || state.members.find((member) => member.role === 'child')?.id || state.members[0]?.id || '',
    }));
    setRewardForm((current) => ({
      ...current,
      memberId: current.memberId || state.members.find((member) => member.role === 'child')?.id || state.members[0]?.id || '',
    }));
  }, [state.members]);

  const balances = useMemo(() => computeMemberBalances(state), [state]);
  const weekSeries = useMemo(() => buildWeekSeries(state.tasks), [state.tasks]);
  const todayTasks = useMemo(() => state.tasks.filter((task) => task.date === todayString()), [state.tasks]);
  const completionRate = useMemo(() => {
    if (todayTasks.length === 0) {
      return 0;
    }

    return Math.round((todayTasks.filter((task) => task.completed).length / todayTasks.length) * 100);
  }, [todayTasks]);

  const addMember = () => {
    const trimmed = memberName.trim();
    if (!trimmed) {
      return;
    }

    setState((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          id: crypto.randomUUID(),
          name: trimmed,
          role: memberRole,
        },
      ],
    }));
    setMemberName('');
    setMemberRole('child');
  };

  const addTask = () => {
    if (!taskForm.title.trim() || !taskForm.memberId) {
      return;
    }

    setState((current) => ({
      ...current,
      tasks: [
        {
          id: crypto.randomUUID(),
          title: taskForm.title.trim(),
          memberId: taskForm.memberId,
          date: taskForm.date,
          points: Number(taskForm.points) || 0,
          category: taskForm.category.trim() || '기본',
          fixed: taskForm.fixed,
          completed: false,
          completedAt: '',
        },
        ...current.tasks,
      ],
    }));
    setTaskForm((current) => ({
      ...createEmptyTaskForm(state.members),
      date: current.date,
    }));
  };

  const toggleTask = (taskId) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? new Date().toISOString() : '',
            }
          : task,
      ),
    }));
  };

  const deleteTask = (taskId) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  };

  const addCheer = () => {
    const trimmed = cheerText.trim();
    if (!trimmed) {
      return;
    }

    setState((current) => ({
      ...current,
      cheers: [
        {
          id: crypto.randomUUID(),
          message: trimmed,
          createdAt: new Date().toISOString(),
        },
        ...current.cheers,
      ],
    }));
    setCheerText('');
  };

  const addReward = () => {
    if (!rewardForm.title.trim() || !rewardForm.memberId) {
      return;
    }

    setState((current) => ({
      ...current,
      rewards: [
        {
          id: crypto.randomUUID(),
          title: rewardForm.title.trim(),
          memberId: rewardForm.memberId,
          pointsRequired: Number(rewardForm.pointsRequired) || 0,
          status: 'available',
          updatedAt: new Date().toISOString(),
        },
        ...current.rewards,
      ],
    }));
    setRewardForm(createEmptyRewardForm(state.members));
  };

  const requestReward = (rewardId) => {
    setState((current) => ({
      ...current,
      rewards: current.rewards.map((reward) =>
        reward.id === rewardId ? { ...reward, status: 'requested', updatedAt: new Date().toISOString() } : reward,
      ),
    }));
  };

  const useReward = (rewardId) => {
    setState((current) => ({
      ...current,
      rewards: current.rewards.map((reward) =>
        reward.id === rewardId ? { ...reward, status: 'used', updatedAt: new Date().toISOString() } : reward,
      ),
    }));
  };

  const resetApp = () => {
    if (!window.confirm('저장된 모든 study 데이터를 초기화할까요?')) {
      return;
    }
    setState(defaultState);
    setTaskForm(createEmptyTaskForm(defaultState.members));
    setRewardForm(createEmptyRewardForm(defaultState.members));
    setCheerText('');
    setMemberName('');
    setMemberRole('child');
  };

  const todayCompletedPoints = todayTasks
    .filter((task) => task.completed)
    .reduce((sum, task) => sum + Number(task.points || 0), 0);

  const totalCompletedTasks = state.tasks.filter((task) => task.completed).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">study</p>
          <h1>가정용 학습 기록장</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button" onClick={resetApp}>
            초기화
          </button>
        </div>
      </header>

      <section className="hero-grid">
        <article className="hero-card">
          <span className="metric-label">오늘 진행률</span>
          <strong className="metric-value">{completionRate}%</strong>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${completionRate}%` }} />
          </div>
          <p className="muted">{todayTasks.length}개 중 {todayTasks.filter((task) => task.completed).length}개 완료</p>
        </article>

        <article className="hero-card">
          <span className="metric-label">이번 주 완료</span>
          <strong className="metric-value">{totalCompletedTasks}</strong>
          <p className="muted">완료된 과제 수</p>
        </article>

        <article className="hero-card">
          <span className="metric-label">오늘 획득 점수</span>
          <strong className="metric-value">{todayCompletedPoints}</strong>
          <p className="muted">완료한 과제 기준</p>
        </article>
      </section>

      <nav className="tabbar" aria-label="study sections">
        {[
          ['dashboard', '대시보드'],
          ['tasks', '과제'],
          ['rewards', '보상'],
          ['messages', '응원'],
          ['members', '구성원'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'tab-button active' : 'tab-button'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>이번 주 리포트</h2>
              <p>월요일부터 오늘까지 완료 흐름을 확인합니다.</p>
            </div>
            <div className="week-chart">
              {weekSeries.map((item) => (
                <div key={item.dateKey} className="week-column">
                  <div className="week-bar-wrap">
                    <div
                      className="week-bar"
                      style={{
                        height: `${Math.max(12, Math.min(100, item.points))}%`,
                      }}
                    />
                  </div>
                  <span className="week-label">{item.label}</span>
                  <strong>{item.completedCount}개</strong>
                  <small>{item.points}점</small>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>자동 응원</h2>
              <p>지금 상황에 맞는 짧은 메시지를 보여줍니다.</p>
            </div>
            <div className="nudge-box">
              <strong>{getSuggestedNudge(state)}</strong>
            </div>
            <div className="mini-list">
              {todayTasks.map((task) => (
                <div key={task.id} className="mini-row">
                  <span>{task.completed ? '완료' : '대기'}</span>
                  <strong>{task.title}</strong>
                  <small>{getMemberName(state.members, task.memberId)}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>점수 현황</h2>
              <p>구성원별 누적 점수와 사용 점수를 보여줍니다.</p>
            </div>
            <div className="table-list">
              {balances.map((member) => (
                <div key={member.id} className="table-row">
                  <div>
                    <strong>{member.name}</strong>
                    <p>{member.role === 'parent' ? '부모' : '아이'}</p>
                  </div>
                  <div className="row-stats">
                    <span>보유 {member.balance}점</span>
                    <span>완료 {member.completedTasks}/{member.totalTasks}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {tab === 'tasks' && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>과제 추가</h2>
              <p>고정 과제와 임시 과제를 함께 관리합니다.</p>
            </div>
            <div className="form-grid">
              <input
                type="text"
                value={taskForm.title}
                onChange={(e) => setTaskForm((current) => ({ ...current, title: e.target.value }))}
                placeholder="과제 제목"
              />
              <select
                value={taskForm.memberId}
                onChange={(e) => setTaskForm((current) => ({ ...current, memberId: e.target.value }))}
              >
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={taskForm.date}
                onChange={(e) => setTaskForm((current) => ({ ...current, date: e.target.value }))}
              />
              <input
                type="number"
                min="0"
                value={taskForm.points}
                onChange={(e) => setTaskForm((current) => ({ ...current, points: e.target.value }))}
                placeholder="점수"
              />
              <input
                type="text"
                value={taskForm.category}
                onChange={(e) => setTaskForm((current) => ({ ...current, category: e.target.value }))}
                placeholder="카테고리"
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={taskForm.fixed}
                  onChange={(e) => setTaskForm((current) => ({ ...current, fixed: e.target.checked }))}
                />
                고정 과제
              </label>
              <button type="button" className="primary-button full" onClick={addTask}>
                과제 추가
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>오늘의 과제</h2>
              <p>완료 상태를 체크하면 점수가 반영됩니다.</p>
            </div>
            <div className="task-list">
              {todayTasks.length === 0 ? (
                <div className="empty-state">오늘 과제가 없습니다.</div>
              ) : (
                todayTasks.map((task) => (
                  <div key={task.id} className={task.completed ? 'task-row done' : 'task-row'}>
                    <label className="task-check">
                      <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {getMemberName(state.members, task.memberId)} · {task.category} · {task.points}점
                        </small>
                      </span>
                    </label>
                    <button type="button" className="ghost-button danger" onClick={() => deleteTask(task.id)}>
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      )}

      {tab === 'rewards' && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>보상 추가</h2>
              <p>점수로 교환할 보상을 등록합니다.</p>
            </div>
            <div className="form-grid">
              <input
                type="text"
                value={rewardForm.title}
                onChange={(e) => setRewardForm((current) => ({ ...current, title: e.target.value }))}
                placeholder="보상 이름"
              />
              <select
                value={rewardForm.memberId}
                onChange={(e) => setRewardForm((current) => ({ ...current, memberId: e.target.value }))}
              >
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={rewardForm.pointsRequired}
                onChange={(e) => setRewardForm((current) => ({ ...current, pointsRequired: e.target.value }))}
                placeholder="필요 점수"
              />
              <button type="button" className="primary-button full" onClick={addReward}>
                보상 추가
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>보상 목록</h2>
              <p>요청과 사용 상태를 간단히 관리합니다.</p>
            </div>
            <div className="reward-list">
              {state.rewards.map((reward) => (
                <div key={reward.id} className="reward-row">
                  <div>
                    <strong>{reward.title}</strong>
                    <p>
                      {getMemberName(state.members, reward.memberId)} · {reward.pointsRequired}점 · {reward.status}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="ghost-button" onClick={() => requestReward(reward.id)}>
                      요청
                    </button>
                    <button type="button" className="ghost-button" onClick={() => useReward(reward.id)}>
                      사용
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {tab === 'messages' && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>응원 메시지</h2>
              <p>짧은 문장을 남기면 기록에 쌓입니다.</p>
            </div>
            <div className="inline-form">
              <input
                type="text"
                value={cheerText}
                onChange={(e) => setCheerText(e.target.value)}
                placeholder="응원 메시지 입력"
              />
              <button type="button" className="primary-button" onClick={addCheer}>
                추가
              </button>
            </div>
            <div className="message-list">
              {state.cheers.map((item) => (
                <div key={item.id} className="message-row">
                  <strong>{item.message}</strong>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {tab === 'members' && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>구성원 추가</h2>
              <p>부모와 아이를 함께 관리합니다.</p>
            </div>
            <div className="inline-form">
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="이름"
              />
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                <option value="child">아이</option>
                <option value="parent">부모</option>
              </select>
              <button type="button" className="primary-button" onClick={addMember}>
                추가
              </button>
            </div>

            <div className="member-list">
              {state.members.map((member) => (
                <div key={member.id} className="member-row">
                  <strong>{member.name}</strong>
                  <small>{member.role === 'parent' ? '부모' : '아이'}</small>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
