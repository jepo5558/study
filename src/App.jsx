import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'study_project_state_v1';
const PARENT_AUTH_KEY = 'study_parent_auth_v1';
const MODE_CHILD = 'child';
const MODE_PARENT = 'parent';
const PARENT_PASSWORD = '159qwert';
const WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

const defaultState = {
  members: [],
  tasks: [],
  cheers: [
    {
      id: 'cheer-1',
      message: '오늘 할 일을 하나씩 끝내보자.',
      createdAt: new Date().toISOString(),
    },
  ],
  rewards: [],
};

function cloneDefaultState() {
  return structuredClone(defaultState);
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function normalizeDateKey(value) {
  const parsed = parseDateValue(value);
  if (Number.isNaN(parsed.getTime())) {
    return todayString();
  }

  return toLocalDateKey(parsed);
}

function todayString() {
  return toLocalDateKey(new Date());
}

function parseModeFromLocation() {
  if (typeof window === 'undefined') {
    return MODE_CHILD;
  }

  const source = `${window.location.pathname}${window.location.hash}`.toLowerCase();
  if (source.includes('/parent') || source.includes('#/parent')) {
    return MODE_PARENT;
  }

  return MODE_CHILD;
}

function writeModeToLocation(mode) {
  if (typeof window === 'undefined') {
    return;
  }

  const nextHash = mode === MODE_PARENT ? '#/parent' : '#/child';
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

function readParentAuth() {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }

  return sessionStorage.getItem(PARENT_AUTH_KEY) === 'true';
}

function writeParentAuth(value) {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  if (value) {
    sessionStorage.setItem(PARENT_AUTH_KEY, 'true');
  } else {
    sessionStorage.removeItem(PARENT_AUTH_KEY);
  }
}

function loadState() {
  if (typeof localStorage === 'undefined') {
    return cloneDefaultState();
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return cloneDefaultState();
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      ...defaultState,
      ...parsed,
      members: Array.isArray(parsed.members) ? parsed.members : [],
      tasks: Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task) => ({
            ...task,
            date: normalizeDateKey(task?.date),
          }))
        : [],
      cheers: Array.isArray(parsed.cheers) && parsed.cheers.length > 0 ? parsed.cheers : defaultState.cheers,
      rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
    };
  } catch {
    return cloneDefaultState();
  }
}

function sanitizeImportedState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const members = Array.isArray(source.members)
    ? source.members
        .filter((member) => member && typeof member === 'object')
        .map((member) => ({
          id: String(member.id ?? crypto.randomUUID()),
          name: String(member.name ?? '').trim(),
          role: member.role === MODE_PARENT ? MODE_PARENT : MODE_CHILD,
        }))
        .filter((member) => member.name)
    : [];

  const memberIds = new Set(members.map((member) => member.id));

  const tasks = Array.isArray(source.tasks)
    ? source.tasks
        .filter((task) => task && typeof task === 'object')
        .map((task) => ({
          id: String(task.id ?? crypto.randomUUID()),
          title: String(task.title ?? '').trim(),
          memberId: String(task.memberId ?? ''),
          date: normalizeDateKey(task.date ?? todayString()),
          points: Number(task.points || 0),
          category: String(task.category ?? '기타').trim() || '기타',
          fixed: Boolean(task.fixed),
          seriesId: String(task.seriesId ?? ''),
          repeatDays: Array.isArray(task.repeatDays) ? task.repeatDays.map((day) => Number(day)).filter((day) => Number.isInteger(day)) : [],
          completed: Boolean(task.completed),
          completedAt: String(task.completedAt ?? ''),
        }))
        .filter((task) => task.title && memberIds.has(task.memberId))
    : [];

  const rewards = Array.isArray(source.rewards)
    ? source.rewards
        .filter((reward) => reward && typeof reward === 'object')
        .map((reward) => ({
          id: String(reward.id ?? crypto.randomUUID()),
          title: String(reward.title ?? '').trim(),
          memberId: String(reward.memberId ?? ''),
          pointsRequired: Number(reward.pointsRequired || 0),
          status: ['available', 'requested', 'used'].includes(reward.status) ? reward.status : 'available',
          updatedAt: String(reward.updatedAt ?? new Date().toISOString()),
        }))
        .filter((reward) => reward.title && memberIds.has(reward.memberId))
    : [];

  const cheers = Array.isArray(source.cheers)
    ? source.cheers
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          id: String(item.id ?? crypto.randomUUID()),
          message: String(item.message ?? '').trim(),
          createdAt: String(item.createdAt ?? new Date().toISOString()),
        }))
        .filter((item) => item.message)
    : [];

  return {
    members,
    tasks,
    cheers: cheers.length > 0 ? cheers : cloneDefaultState().cheers,
    rewards,
  };
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

function startOfMonth(date = new Date()) {
  const current = new Date(date);
  current.setDate(1);
  current.setHours(0, 0, 0, 0);
  return current;
}

function formatDate(value) {
  return parseDateValue(value).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMonthLabel(value = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(value);
}

function getMemberName(members, memberId) {
  return members.find((member) => member.id === memberId)?.name ?? '미지정';
}

function getWeekdayValue(dateString) {
  return parseDateValue(dateString).getDay();
}

function getWeekdayLabel(value) {
  return WEEKDAY_OPTIONS.find((item) => item.value === value)?.label ?? '';
}

function addDays(dateString, days) {
  const current = parseDateValue(dateString);
  current.setDate(current.getDate() + days);
  return toLocalDateKey(current);
}

function normalizeWeekdays(selectedWeekdays, dateString) {
  if (selectedWeekdays.length > 0) {
    return [...selectedWeekdays].sort((left, right) => left - right);
  }

  return [getWeekdayValue(dateString)];
}

function buildRecurringTaskDates(startDate, selectedWeekdays, repeatWeeks) {
  const normalizedWeekdays = normalizeWeekdays(selectedWeekdays, startDate);
  const totalDays = Math.max(1, Number(repeatWeeks || 1)) * 7;
  const dates = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const currentDate = addDays(startDate, offset);
    if (normalizedWeekdays.includes(getWeekdayValue(currentDate))) {
      dates.push(currentDate);
    }
  }

  return dates;
}

function getRepeatWeeksFromTasks(tasks) {
  if (!tasks.length) {
    return 8;
  }

  const sortedDates = [...tasks].map((task) => task.date).sort();
  const firstDate = new Date(sortedDates[0]);
  const lastDate = new Date(sortedDates[sortedDates.length - 1]);
  const diffDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));

  return Math.max(1, Math.ceil((diffDays + 1) / 7));
}

function createEmptyTaskForm(members) {
  return {
    title: '',
    memberId: members.find((member) => member.role === MODE_CHILD)?.id ?? members[0]?.id ?? '',
    date: todayString(),
    points: 20,
    category: '학습',
    fixed: false,
    selectedWeekdays: [],
    repeatWeeks: 8,
  };
}

function createEmptyRewardForm(members) {
  return {
    title: '',
    memberId: members.find((member) => member.role === MODE_CHILD)?.id ?? members[0]?.id ?? '',
    pointsRequired: 100,
  };
}

function computeMemberBalances(state) {
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return state.members.map((member) => {
    const earned = state.tasks
      .filter((task) => task.memberId === member.id && task.completed)
      .reduce((sum, task) => sum + Number(task.points || 0), 0);

    const spent = state.rewards
      .filter((reward) => reward.memberId === member.id && reward.status === 'used')
      .reduce((sum, reward) => sum + Number(reward.pointsRequired || 0), 0);

    const weeklyTasks = state.tasks.filter((task) => {
      if (task.memberId !== member.id) {
        return false;
      }

      const taskDate = parseDateValue(task.date);
      return taskDate >= weekStart && taskDate < weekEnd;
    });

    return {
      ...member,
      balance: earned - spent,
      completedTasks: weeklyTasks.filter((task) => task.completed).length,
      totalTasks: weeklyTasks.length,
    };
  });
}

function buildWeekSeries(tasks) {
  const base = startOfWeek();

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(base);
    current.setDate(base.getDate() + index);
    const dateKey = toLocalDateKey(current);
    const dayTasks = tasks.filter((task) => task.date === dateKey);

    return {
      dateKey,
      label: formatDate(dateKey),
      completedCount: dayTasks.filter((task) => task.completed).length,
      points: dayTasks
        .filter((task) => task.completed)
        .reduce((sum, task) => sum + Number(task.points || 0), 0),
    };
  });
}

function getSuggestedNudge(tasks) {
  const unfinished = tasks.filter((task) => !task.completed);

  if (tasks.length === 0) {
    return '오늘 등록된 과제가 없습니다. 필요한 과제를 먼저 추가하세요.';
  }

  if (unfinished.length === 0) {
    return '오늘 과제는 모두 끝났습니다. 보상도 확인해보세요.';
  }

  if (unfinished.length === 1) {
    return `마지막 1개만 남았습니다. ${unfinished[0].title}부터 마무리하세요.`;
  }

  return `${unfinished.length}개의 과제가 남아 있습니다. 짧은 과제부터 처리하면 좋습니다.`;
}

function buildHistoryGroups(tasks, members) {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const summarize = (items) => ({
    total: items.length,
    completed: items.filter((task) => task.completed).length,
    points: items.filter((task) => task.completed).reduce((sum, task) => sum + Number(task.points || 0), 0),
  });

  const groupByDate = (items) => {
    const map = new Map();

    items.forEach((task) => {
      if (!map.has(task.date)) {
        map.set(task.date, []);
      }
      map.get(task.date).push(task);
    });

    return Array.from(map.entries())
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([date, dayTasks]) => ({
        date,
        label: formatDate(date),
        summary: summarize(dayTasks),
        tasks: dayTasks.map((task) => ({
          ...task,
          memberName: getMemberName(members, task.memberId),
        })),
      }));
  };

  const weekTasks = tasks.filter((task) => parseDateValue(task.date) >= weekStart);
  const monthTasks = tasks.filter((task) => parseDateValue(task.date) >= monthStart);

  return {
    week: {
      label: `${formatDate(weekStart)} 시작`,
      summary: summarize(weekTasks),
      groups: groupByDate(weekTasks),
    },
    month: {
      label: formatMonthLabel(now),
      summary: summarize(monthTasks),
      groups: groupByDate(monthTasks),
    },
  };
}

function createTabs(mode) {
  if (mode === MODE_CHILD) {
    return [
      { id: 'dashboard', label: '이번 주 보기' },
      { id: 'tasks', label: '과제' },
      { id: 'rewards', label: '보상' },
    ];
  }

  return [
    { id: 'dashboard', label: '대시보드' },
    { id: 'tasks', label: '과제' },
    { id: 'history', label: '기록 조회' },
    { id: 'rewards', label: '보상' },
    { id: 'messages', label: '응원' },
    { id: 'members', label: '구성원' },
  ];
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [mode, setMode] = useState(parseModeFromLocation);
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(readParentAuth);
  const [parentPasswordInput, setParentPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [taskForm, setTaskForm] = useState(() => createEmptyTaskForm(loadState().members));
  const [editingTaskId, setEditingTaskId] = useState('');
  const [rewardForm, setRewardForm] = useState(() => createEmptyRewardForm(loadState().members));
  const [cheerText, setCheerText] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState(MODE_CHILD);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    writeModeToLocation(mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncMode = () => {
      setMode(parseModeFromLocation());
    };

    window.addEventListener('hashchange', syncMode);
    return () => window.removeEventListener('hashchange', syncMode);
  }, []);

  useEffect(() => {
    const memberIds = new Set(state.members.map((member) => member.id));

    setTaskForm((current) => ({
      ...current,
      memberId:
        (current.memberId && memberIds.has(current.memberId) && current.memberId) ||
        state.members.find((member) => member.role === MODE_CHILD)?.id ||
        state.members[0]?.id ||
        '',
    }));

    setRewardForm((current) => ({
      ...current,
      memberId:
        (current.memberId && memberIds.has(current.memberId) && current.memberId) ||
        state.members.find((member) => member.role === MODE_CHILD)?.id ||
        state.members[0]?.id ||
        '',
    }));
  }, [state.members]);

  useEffect(() => {
    const allowedTabs = createTabs(mode);
    if (!allowedTabs.some((item) => item.id === tab)) {
      setTab('dashboard');
    }
  }, [mode, tab]);

  const balances = useMemo(() => computeMemberBalances(state), [state]);
  const weekSeries = useMemo(() => buildWeekSeries(state.tasks), [state.tasks]);
  const history = useMemo(() => buildHistoryGroups(state.tasks, state.members), [state.tasks, state.members]);
  const tabs = useMemo(() => createTabs(mode), [mode]);
  const todayTasks = useMemo(() => state.tasks.filter((task) => task.date === todayString()), [state.tasks]);
  const editableWeekTasks = useMemo(() => {
    const weekStart = startOfWeek();
    const today = parseDateValue(todayString());

    return state.tasks
      .filter((task) => {
        const taskDate = parseDateValue(task.date);
        return taskDate >= weekStart && taskDate < today;
      })
      .sort((left, right) => {
        if (left.date !== right.date) {
          return right.date.localeCompare(left.date);
        }

        return left.title.localeCompare(right.title, 'ko-KR');
      });
  }, [state.tasks]);
  const childBalances = useMemo(
    () => balances.filter((member) => member.role === MODE_CHILD),
    [balances],
  );

  const latestCheer = state.cheers[0]?.message ?? '오늘 할 일을 하나씩 끝내보자.';
  const managedTasks = useMemo(() => {
    const seriesMap = new Map();
    const singles = [];

    state.tasks.forEach((task) => {
      if (task.fixed && task.seriesId) {
        const currentSeries = seriesMap.get(task.seriesId) ?? [];
        currentSeries.push(task);
        seriesMap.set(task.seriesId, currentSeries);
      } else {
        singles.push({
          ...task,
          manageType: 'single',
        });
      }
    });

    const seriesItems = Array.from(seriesMap.entries()).map(([seriesId, tasks]) => {
      const sortedTasks = [...tasks].sort((left, right) => left.date.localeCompare(right.date));
      const firstTask = sortedTasks[0];
      const lastTask = sortedTasks[sortedTasks.length - 1];

      return {
        ...firstTask,
        manageType: 'series',
        manageId: seriesId,
        taskCount: sortedTasks.length,
        seriesStartDate: firstTask.date,
        seriesEndDate: lastTask.date,
        repeatWeeks: getRepeatWeeksFromTasks(sortedTasks),
      };
    });

    return [...singles, ...seriesItems].sort((left, right) => {
      const leftDate = left.manageType === 'series' ? left.seriesStartDate : left.date;
      const rightDate = right.manageType === 'series' ? right.seriesStartDate : right.date;

      if (leftDate !== rightDate) {
        return rightDate.localeCompare(leftDate);
      }

      return left.title.localeCompare(right.title, 'ko-KR');
    });
  }, [state.tasks]);

  const completionRate = useMemo(() => {
    if (todayTasks.length === 0) {
      return 0;
    }

    return Math.round((todayTasks.filter((task) => task.completed).length / todayTasks.length) * 100);
  }, [todayTasks]);

  const todayCompletedPoints = todayTasks
    .filter((task) => task.completed)
    .reduce((sum, task) => sum + Number(task.points || 0), 0);

  const totalCompletedTasks = state.tasks.filter((task) => task.completed).length;
  const thisWeekPoints = weekSeries.reduce((sum, item) => sum + item.points, 0);

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
    setMemberRole(MODE_CHILD);
  };

  const deleteMember = (memberId) => {
    const target = state.members.find((member) => member.id === memberId);
    if (!target) {
      return;
    }

    if (state.members.length <= 1) {
      window.alert('구성원은 최소 1명 이상 있어야 합니다.');
      return;
    }

    if (!window.confirm(`${target.name} 구성원을 삭제할까요? 연결된 과제와 보상도 함께 삭제됩니다.`)) {
      return;
    }

    setState((current) => ({
      ...current,
      members: current.members.filter((member) => member.id !== memberId),
      tasks: current.tasks.filter((task) => task.memberId !== memberId),
      rewards: current.rewards.filter((reward) => reward.memberId !== memberId),
    }));
  };

  const addTask = () => {
    if (!taskForm.title.trim() || !taskForm.memberId) {
      return;
    }

    const baseTask = {
      title: taskForm.title.trim(),
      memberId: taskForm.memberId,
      points: Number(taskForm.points || 0),
      category: taskForm.category.trim() || '기타',
      completed: false,
      completedAt: '',
    };

    const nextTasks = taskForm.fixed
      ? (() => {
          const seriesId = crypto.randomUUID();
          const selectedWeekdays = normalizeWeekdays(taskForm.selectedWeekdays, taskForm.date);

          return buildRecurringTaskDates(taskForm.date, selectedWeekdays, taskForm.repeatWeeks).map((date) => ({
            ...baseTask,
            id: crypto.randomUUID(),
            date,
            fixed: true,
            seriesId,
            repeatDays: selectedWeekdays,
          }));
        })()
      : [
          {
            ...baseTask,
            id: crypto.randomUUID(),
            date: taskForm.date,
            fixed: false,
            seriesId: '',
            repeatDays: [],
          },
        ];

    setState((current) => ({
      ...current,
      tasks: [...nextTasks, ...current.tasks],
    }));

    setTaskForm((current) => ({
      ...createEmptyTaskForm(state.members),
      memberId: current.memberId,
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

  const setTaskCompletion = (taskId, completed) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed,
              completedAt: completed ? task.completedAt || new Date().toISOString() : '',
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

  const startEditTask = (task) => {
    setEditingTaskId(task.manageType === 'series' ? task.manageId : task.id);
    setTaskForm({
      title: task.title,
      memberId: task.memberId,
      date: task.manageType === 'series' ? task.seriesStartDate : task.date,
      points: Number(task.points || 0),
      category: task.category || '기타',
      fixed: Boolean(task.fixed),
      selectedWeekdays: Array.isArray(task.repeatDays) ? task.repeatDays : [],
      repeatWeeks: task.manageType === 'series' ? task.repeatWeeks : 8,
    });
  };

  const cancelEditTask = () => {
    setEditingTaskId('');
    setTaskForm(createEmptyTaskForm(state.members));
  };

  const saveTaskEdit = () => {
    if (!editingTaskId || !taskForm.title.trim() || !taskForm.memberId) {
      return;
    }

    setState((current) => {
      const matchedSeriesTasks = current.tasks.filter((task) => task.seriesId === editingTaskId);
      const isSeriesEdit = matchedSeriesTasks.length > 0;
      const nextBaseTask = {
        title: taskForm.title.trim(),
        memberId: taskForm.memberId,
        points: Number(taskForm.points || 0),
        category: taskForm.category.trim() || '기타',
      };

      if (isSeriesEdit) {
        if (!taskForm.fixed) {
          return {
            ...current,
            tasks: [
              ...current.tasks.filter((task) => task.seriesId !== editingTaskId),
              {
                id: crypto.randomUUID(),
                ...nextBaseTask,
                date: taskForm.date,
                fixed: false,
                seriesId: '',
                repeatDays: [],
                completed: false,
                completedAt: '',
              },
            ],
          };
        }

        const selectedWeekdays = normalizeWeekdays(taskForm.selectedWeekdays, taskForm.date);
        const previousByDate = new Map(matchedSeriesTasks.map((task) => [task.date, task]));
        const regeneratedTasks = buildRecurringTaskDates(taskForm.date, selectedWeekdays, taskForm.repeatWeeks).map((date) => {
          const previousTask = previousByDate.get(date);

          return {
            id: previousTask?.id ?? crypto.randomUUID(),
            ...nextBaseTask,
            date,
            fixed: true,
            seriesId: editingTaskId,
            repeatDays: selectedWeekdays,
            completed: previousTask?.completed ?? false,
            completedAt: previousTask?.completedAt ?? '',
          };
        });

        return {
          ...current,
          tasks: [
            ...current.tasks.filter((task) => task.seriesId !== editingTaskId),
            ...regeneratedTasks,
          ],
        };
      }

      if (taskForm.fixed) {
        const selectedWeekdays = normalizeWeekdays(taskForm.selectedWeekdays, taskForm.date);
        const newSeriesId = crypto.randomUUID();
        const regeneratedTasks = buildRecurringTaskDates(taskForm.date, selectedWeekdays, taskForm.repeatWeeks).map((date) => ({
          id: crypto.randomUUID(),
          ...nextBaseTask,
          date,
          fixed: true,
          seriesId: newSeriesId,
          repeatDays: selectedWeekdays,
          completed: false,
          completedAt: '',
        }));

        return {
          ...current,
          tasks: [
            ...current.tasks.filter((task) => task.id !== editingTaskId),
            ...regeneratedTasks,
          ],
        };
      }

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                ...nextBaseTask,
                date: taskForm.date,
                fixed: false,
                seriesId: '',
                repeatDays: [],
              }
            : task,
        ),
      };
    });

    setEditingTaskId('');
    setTaskForm(createEmptyTaskForm(state.members));
  };

  const deleteManagedTask = (task) => {
    if (task.manageType === 'series' && task.manageId) {
      setState((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.seriesId !== task.manageId),
      }));
      return;
    }

    deleteTask(task.id);
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
          pointsRequired: Number(rewardForm.pointsRequired || 0),
          status: 'available',
          updatedAt: new Date().toISOString(),
        },
        ...current.rewards,
      ],
    }));

    setRewardForm((current) => ({
      ...createEmptyRewardForm(state.members),
      memberId: current.memberId,
    }));
  };

  const requestReward = (rewardId) => {
    setState((current) => ({
      ...current,
      rewards: current.rewards.map((reward) =>
        reward.id === rewardId
          ? {
              ...reward,
              status: reward.status === 'available' ? 'requested' : reward.status,
              updatedAt: new Date().toISOString(),
            }
          : reward,
      ),
    }));
  };

  const useReward = (rewardId) => {
    setState((current) => ({
      ...current,
      rewards: current.rewards.map((reward) =>
        reward.id === rewardId
          ? {
              ...reward,
              status: 'used',
              updatedAt: new Date().toISOString(),
            }
          : reward,
      ),
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

  const resetApp = () => {
    if (!window.confirm('저장된 모든 데이터를 초기화할까요?')) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    writeParentAuth(false);
    setIsParentAuthenticated(false);

    const nextState = cloneDefaultState();
    setState(nextState);
    setTaskForm(createEmptyTaskForm(nextState.members));
    setEditingTaskId('');
    setRewardForm(createEmptyRewardForm(nextState.members));
    setCheerText('');
    setMemberName('');
    setMemberRole(MODE_CHILD);
    setImportStatus('');
  };

  const handleParentLogin = () => {
    if (parentPasswordInput === PARENT_PASSWORD) {
      writeParentAuth(true);
      setIsParentAuthenticated(true);
      setParentPasswordInput('');
      setAuthError('');
      return;
    }

    setAuthError('비밀번호가 올바르지 않습니다.');
  };

  const handleParentLogout = () => {
    writeParentAuth(false);
    setIsParentAuthenticated(false);
    setParentPasswordInput('');
    setAuthError('');
    setMode(MODE_CHILD);
  };

  const toggleTaskWeekday = (weekday) => {
    setTaskForm((current) => ({
      ...current,
      selectedWeekdays: current.selectedWeekdays.includes(weekday)
        ? current.selectedWeekdays.filter((item) => item !== weekday)
        : [...current.selectedWeekdays, weekday].sort((left, right) => left - right),
    }));
  };

  const applyWeekdayPreset = (weekdays) => {
    setTaskForm((current) => ({
      ...current,
      selectedWeekdays: weekdays,
      fixed: true,
    }));
  };

  const exportState = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      storageKey: STORAGE_KEY,
      data: state,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `study-backup-${todayString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setImportStatus('현재 데이터를 백업 파일로 저장했습니다.');
  };

  const importStateFromFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const nextState = sanitizeImportedState(parsed?.data ?? parsed);

      if (!window.confirm('가져온 데이터로 현재 데이터를 덮어쓸까요?')) {
        return;
      }

      setState(nextState);
      setTaskForm(createEmptyTaskForm(nextState.members));
      setEditingTaskId('');
      setRewardForm(createEmptyRewardForm(nextState.members));
      setImportStatus(`데이터를 가져왔습니다. 구성원 ${nextState.members.length}명, 과제 ${nextState.tasks.length}건`);
    } catch {
      setImportStatus('가져오기에 실패했습니다. JSON 백업 파일을 확인하세요.');
    }
  };

  const parentLocked = mode === MODE_PARENT && !isParentAuthenticated;

  if (parentLocked) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">study</p>
            <h1>부모 모드 인증</h1>
            <p className="muted">URL: #/parent</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={() => setMode(MODE_CHILD)}>
              아이 모드로 이동
            </button>
          </div>
        </header>

        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>비밀번호 입력</h2>
              <p>부모 모드에 들어가기 전에 인증이 필요합니다.</p>
            </div>
            <div className="form-grid">
              <label className="field full">
                <span>부모 비밀번호</span>
                <input
                  type="password"
                  value={parentPasswordInput}
                  onChange={(e) => setParentPasswordInput(e.target.value)}
                  placeholder="비밀번호 입력"
                />
              </label>
              {authError && <div className="empty-state">{authError}</div>}
              <button type="button" className="primary-button full" onClick={handleParentLogin}>
                부모 모드 열기
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">study</p>
          <h1>{mode === MODE_CHILD ? '아이 모드' : '부모 모드'}</h1>
          <p className="muted">{mode === MODE_CHILD ? 'URL: #/child' : 'URL: #/parent'}</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={mode === MODE_CHILD ? 'tab-button active' : 'tab-button'}
            onClick={() => setMode(MODE_CHILD)}
          >
            아이
          </button>
          <button
            type="button"
            className={mode === MODE_PARENT ? 'tab-button active' : 'tab-button'}
            onClick={() => setMode(MODE_PARENT)}
          >
            부모
          </button>
          {mode === MODE_PARENT && (
            <>
              <button type="button" className="ghost-button" onClick={handleParentLogout}>
                로그아웃
              </button>
              <button type="button" className="ghost-button" onClick={resetApp}>
                초기화
              </button>
            </>
          )}
        </div>
      </header>

      <section className="hero-grid">
        <article className="hero-card">
          <span className="metric-label">오늘 진행률</span>
          <strong className="metric-value">{completionRate}%</strong>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${completionRate}%` }} />
          </div>
          <p className="muted">
            {todayTasks.length}개 중 {todayTasks.filter((task) => task.completed).length}개 완료
          </p>
        </article>

        <article className="hero-card">
          <span className="metric-label">{mode === MODE_CHILD ? '오늘 획득 점수' : '전체 완료 과제'}</span>
          <strong className="metric-value">{mode === MODE_CHILD ? todayCompletedPoints : totalCompletedTasks}</strong>
          <p className="muted">{mode === MODE_CHILD ? '오늘 완료 기준' : '누적 완료 과제 수'}</p>
        </article>

        <article className="hero-card">
          <span className="metric-label">{mode === MODE_CHILD ? '오늘 응원' : '이번 주 획득 점수'}</span>
          <strong className="metric-value">{mode === MODE_CHILD ? '한마디' : thisWeekPoints}</strong>
          <p className="muted">{mode === MODE_CHILD ? latestCheer : '이번 주 완료 과제 기준'}</p>
        </article>
      </section>

      <nav className="tabbar" aria-label="study sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'tab-button active' : 'tab-button'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>{mode === MODE_CHILD ? '이번 주 보기' : '주간 리포트'}</h2>
              <p>
                {mode === MODE_CHILD
                  ? '월요일부터 일요일까지의 과제 흐름을 확인합니다.'
                  : '이번 주 완료 흐름과 누적 점수를 봅니다.'}
              </p>
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
              <h2>한마디</h2>
              <p>오늘 상태를 기준으로 짧은 안내를 보여줍니다.</p>
            </div>
            <div className="nudge-box">
              <strong>{getSuggestedNudge(todayTasks)}</strong>
            </div>
            <div className="mini-list">
              {todayTasks.length === 0 ? (
                <div className="empty-state">오늘 표시할 과제가 없습니다.</div>
              ) : (
                todayTasks.map((task) => (
                  <div key={task.id} className="mini-row">
                    <span>{task.completed ? '완료' : '대기'}</span>
                    <strong>{task.title}</strong>
                    <small>{getMemberName(state.members, task.memberId)}</small>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>{mode === MODE_CHILD ? '내 점수' : '점수 현황'}</h2>
              <p>{mode === MODE_CHILD ? '아이 구성원 기준 점수 현황입니다.' : '구성원별 보유 점수와 완료 과제 수입니다.'}</p>
            </div>
            <div className="table-list">
              {(mode === MODE_CHILD ? childBalances : balances).map((member) => (
                <div key={member.id} className="table-row">
                  <div>
                    <strong>{member.name}</strong>
                    <p>{member.role === MODE_PARENT ? '부모' : '아이'}</p>
                  </div>
                  <div className="row-stats">
                    <span>보유 {member.balance}점</span>
                    <span>
                      완료 {member.completedTasks}/{member.totalTasks}
                    </span>
                  </div>
                </div>
              ))}
              {balances.length === 0 && <div className="empty-state">먼저 구성원을 추가하세요.</div>}
            </div>
          </section>

          {mode === MODE_PARENT && (
            <section className="panel">
              <div className="section-head">
                <h2>데이터 이전</h2>
                <p>localhost 데이터는 직접 읽을 수 없으니 백업 파일로 옮깁니다.</p>
              </div>
              <div className="form-grid">
                <div className="field full">
                  <span>1. 로컬에서 백업</span>
                  <small className="field-hint">
                    예전 localhost 화면을 열어서 같은 기능의 백업 버튼으로 JSON 파일을 저장한 뒤, 여기에서 가져오면 됩니다.
                  </small>
                </div>
                <div className="row-actions full">
                  <button type="button" className="ghost-button" onClick={exportState}>
                    현재 데이터 백업
                  </button>
                  <label className="ghost-button file-button">
                    백업 파일 가져오기
                    <input type="file" accept="application/json" onChange={importStateFromFile} />
                  </label>
                </div>
                {importStatus && <div className="empty-state">{importStatus}</div>}
              </div>
            </section>
          )}
        </main>
      )}

      {tab === 'tasks' && (
        <main className="content-grid">
          {mode === MODE_PARENT && (
            <section className="panel">
              <div className="section-head">
                <h2>과제 추가</h2>
                <p>{editingTaskId ? '선택한 과제 또는 반복 시리즈를 수정합니다.' : '과제를 등록하고 대상과 점수를 설정합니다.'}</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>과제 제목</span>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm((current) => ({ ...current, title: e.target.value }))}
                    placeholder="예: 책 10쪽 읽기"
                  />
                  <small className="field-hint">무엇을 할지 적습니다.</small>
                </label>
                <label className="field">
                  <span>대상 구성원</span>
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
                  <small className="field-hint">이 과제를 수행할 사람을 고릅니다.</small>
                </label>
                <label className="field">
                  <span>날짜</span>
                  <input
                    type="date"
                    value={taskForm.date}
                    onChange={(e) => setTaskForm((current) => ({ ...current, date: e.target.value }))}
                  />
                  <small className="field-hint">과제를 적용할 날짜입니다.</small>
                </label>
                <label className="field">
                  <span>점수</span>
                  <input
                    type="number"
                    min="0"
                    value={taskForm.points}
                    onChange={(e) => setTaskForm((current) => ({ ...current, points: e.target.value }))}
                    placeholder="예: 20"
                  />
                  <small className="field-hint">완료했을 때 얻는 점수입니다.</small>
                </label>
                <label className="field">
                  <span>카테고리</span>
                  <input
                    type="text"
                    value={taskForm.category}
                    onChange={(e) => setTaskForm((current) => ({ ...current, category: e.target.value }))}
                    placeholder="예: 학습, 생활"
                  />
                  <small className="field-hint">분류용 태그입니다.</small>
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={taskForm.fixed}
                    onChange={(e) => setTaskForm((current) => ({ ...current, fixed: e.target.checked }))}
                  />
                  고정 과제
                </label>
                <small className="field-hint field-hint-inline">
                  날짜 입력은 그대로 유지하고, 고정 과제일 때만 반복 요일과 반복 주차를 추가합니다.
                </small>
                {taskForm.fixed && (
                  <>
                    <div className="field full">
                      <span>반복 요일</span>
                      <div className="weekday-chip-row">
                        {WEEKDAY_OPTIONS.map((weekday) => (
                          <button
                            key={weekday.value}
                            type="button"
                            className={taskForm.selectedWeekdays.includes(weekday.value) ? 'chip-button active' : 'chip-button'}
                            onClick={() => toggleTaskWeekday(weekday.value)}
                          >
                            {weekday.label}
                          </button>
                        ))}
                      </div>
                      <div className="preset-row">
                        <button type="button" className="ghost-button" onClick={() => applyWeekdayPreset([1, 3])}>
                          월/수
                        </button>
                        <button type="button" className="ghost-button" onClick={() => applyWeekdayPreset([6, 0])}>
                          토/일
                        </button>
                        <button type="button" className="ghost-button" onClick={() => applyWeekdayPreset([1, 2, 3, 4, 5])}>
                          평일
                        </button>
                        <button type="button" className="ghost-button" onClick={() => applyWeekdayPreset([6, 0])}>
                          주말
                        </button>
                        <button type="button" className="ghost-button" onClick={() => applyWeekdayPreset([])}>
                          선택 해제
                        </button>
                      </div>
                      <small className="field-hint">
                        선택이 비어 있으면 시작 날짜의 요일 하나만 반복합니다.
                      </small>
                    </div>
                    <label className="field">
                      <span>반복 주차</span>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={taskForm.repeatWeeks}
                        onChange={(e) => setTaskForm((current) => ({ ...current, repeatWeeks: Number(e.target.value || 1) }))}
                        placeholder="예: 8"
                      />
                      <small className="field-hint">시작 날짜부터 몇 주치 과제를 한 번에 만들지 정합니다.</small>
                    </label>
                  </>
                )}
                <div className="row-actions full">
                  {editingTaskId ? (
                    <>
                      <button type="button" className="primary-button" onClick={saveTaskEdit}>
                        수정 저장
                      </button>
                      <button type="button" className="ghost-button" onClick={cancelEditTask}>
                        취소
                      </button>
                    </>
                  ) : (
                    <button type="button" className="primary-button" onClick={addTask}>
                      과제 추가
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="section-head">
              <h2>오늘의 과제</h2>
              <p>{mode === MODE_CHILD ? '완료한 과제를 체크하세요.' : '완료를 체크하면 점수가 반영됩니다.'}</p>
            </div>
            <div className="task-list">
              {todayTasks.length === 0 ? (
                <div className="empty-state">오늘 등록된 과제가 없습니다.</div>
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
                    {mode === MODE_PARENT && (
                      <button type="button" className="ghost-button danger" onClick={() => deleteTask(task.id)}>
                        삭제
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {mode === MODE_PARENT && (
            <section className="panel">
              <div className="section-head">
                <h2>이번 주 과제 업데이트</h2>
                <p>이번 주 월요일부터 어제까지의 과제만 여기에서 완료 상태를 수정합니다.</p>
              </div>
              <div className="task-list">
                {editableWeekTasks.length === 0 ? (
                  <div className="empty-state">이번 주의 지난 날짜 과제가 없습니다.</div>
                ) : (
                  editableWeekTasks.map((task) => (
                    <div key={task.id} className={task.completed ? 'task-row done' : 'task-row'}>
                      <div className="task-meta">
                        <strong>{task.title}</strong>
                        <small>
                          {formatDate(task.date)} · {getMemberName(state.members, task.memberId)} · {task.category} · {task.points}점
                        </small>
                      </div>
                      <div className="row-actions">
                        <button
                          type="button"
                          className={task.completed ? 'tab-button active' : 'tab-button'}
                          onClick={() => setTaskCompletion(task.id, true)}
                        >
                          완료
                        </button>
                        <button type="button" className="ghost-button danger" onClick={() => deleteTask(task.id)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {mode === MODE_PARENT && (
            <section className="panel">
              <div className="section-head">
                <h2>등록된 과제 관리</h2>
                <p>입력한 과제를 여기에서 수정하거나 삭제합니다.</p>
              </div>
              <div className="task-list">
                {managedTasks.length === 0 ? (
                  <div className="empty-state">등록된 과제가 없습니다.</div>
                ) : (
                  managedTasks.map((task) => (
                    <div key={task.id} className="task-row">
                      <div className="task-meta">
                        <strong>{task.title}</strong>
                        <small>
                          {(task.manageType === 'series' ? formatDate(task.seriesStartDate) : formatDate(task.date))} · {getMemberName(state.members, task.memberId)} · {task.category} · {task.points}점
                        </small>
                        {task.manageType === 'series' ? (
                          <small>
                            반복 시리즈 · {(task.repeatDays || []).map((day) => getWeekdayLabel(day)).join(', ')} · {task.taskCount}개 일정 · {task.repeatWeeks}주
                          </small>
                        ) : task.fixed ? (
                          <small>
                            반복: {(task.repeatDays || []).map((day) => getWeekdayLabel(day)).join(', ') || getWeekdayLabel(getWeekdayValue(task.date))}
                          </small>
                        ) : null}
                      </div>
                      <div className="row-actions">
                        <button type="button" className="ghost-button" onClick={() => startEditTask(task)}>
                          수정
                        </button>
                        <button type="button" className="ghost-button danger" onClick={() => deleteManagedTask(task)}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </main>
      )}

      {tab === 'history' && mode === MODE_PARENT && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>주간 조회</h2>
              <p>{history.week.label} 이후에 등록된 기록입니다.</p>
            </div>
            <div className="mini-list">
              <div className="table-row">
                <strong>합계</strong>
                <div className="row-stats">
                  <span>과제 {history.week.summary.total}개</span>
                  <span>완료 {history.week.summary.completed}개</span>
                  <span>획득 {history.week.summary.points}점</span>
                </div>
              </div>
              {history.week.groups.length === 0 ? (
                <div className="empty-state">이번 주 기록이 없습니다.</div>
              ) : (
                history.week.groups.map((group) => (
                  <div key={group.date} className="message-row">
                    <strong>{group.label}</strong>
                    <small>
                      과제 {group.summary.total}개 · 완료 {group.summary.completed}개 · {group.summary.points}점
                    </small>
                    {group.tasks.map((task) => (
                      <small key={task.id}>
                        {task.completed ? '완료' : '대기'} · {task.memberName} · {task.title} · {task.category}
                      </small>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>월간 조회</h2>
              <p>{history.month.label} 기준 누적 기록입니다.</p>
            </div>
            <div className="mini-list">
              <div className="table-row">
                <strong>합계</strong>
                <div className="row-stats">
                  <span>과제 {history.month.summary.total}개</span>
                  <span>완료 {history.month.summary.completed}개</span>
                  <span>획득 {history.month.summary.points}점</span>
                </div>
              </div>
              {history.month.groups.length === 0 ? (
                <div className="empty-state">이번 달 기록이 없습니다.</div>
              ) : (
                history.month.groups.map((group) => (
                  <div key={group.date} className="message-row">
                    <strong>{group.label}</strong>
                    <small>
                      과제 {group.summary.total}개 · 완료 {group.summary.completed}개 · {group.summary.points}점
                    </small>
                    {group.tasks.map((task) => (
                      <small key={task.id}>
                        {task.completed ? '완료' : '대기'} · {task.memberName} · {task.title} · {task.category}
                      </small>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      )}

      {tab === 'rewards' && (
        <main className="content-grid">
          {mode === MODE_PARENT && (
            <section className="panel">
              <div className="section-head">
                <h2>보상 추가</h2>
                <p>점수를 사용해 교환할 보상을 등록합니다.</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>보상 이름</span>
                  <input
                    type="text"
                    value={rewardForm.title}
                    onChange={(e) => setRewardForm((current) => ({ ...current, title: e.target.value }))}
                    placeholder="예: 영화 보기"
                  />
                </label>
                <label className="field">
                  <span>대상 구성원</span>
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
                </label>
                <label className="field">
                  <span>필요 점수</span>
                  <input
                    type="number"
                    min="0"
                    value={rewardForm.pointsRequired}
                    onChange={(e) => setRewardForm((current) => ({ ...current, pointsRequired: e.target.value }))}
                    placeholder="예: 100"
                  />
                </label>
                <button type="button" className="primary-button full" onClick={addReward}>
                  보상 추가
                </button>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="section-head">
              <h2>{mode === MODE_CHILD ? '신청 가능한 보상' : '보상 목록'}</h2>
              <p>
                {mode === MODE_CHILD
                  ? '아이 모드에서는 보상 요청만 할 수 있습니다.'
                  : '부모 모드에서는 요청 확인과 사용 처리를 할 수 있습니다.'}
              </p>
            </div>
            <div className="reward-list">
              {(mode === MODE_CHILD ? state.rewards.filter((reward) => reward.status !== 'used') : state.rewards).map(
                (reward) => (
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
                      {mode === MODE_PARENT && (
                        <button type="button" className="ghost-button" onClick={() => useReward(reward.id)}>
                          사용
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}
              {state.rewards.length === 0 && <div className="empty-state">등록된 보상이 없습니다.</div>}
            </div>
          </section>
        </main>
      )}

      {tab === 'messages' && mode === MODE_PARENT && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>응원 메시지</h2>
              <p>짧은 응원 문구를 남깁니다.</p>
            </div>
            <div className="inline-form">
              <input
                type="text"
                value={cheerText}
                onChange={(e) => setCheerText(e.target.value)}
                placeholder="짧은 응원 메시지 입력"
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

      {tab === 'members' && mode === MODE_PARENT && (
        <main className="content-grid">
          <section className="panel">
            <div className="section-head">
              <h2>구성원</h2>
              <p>부모와 아이를 여기에서 추가하고 삭제합니다.</p>
            </div>
            <div className="inline-form">
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="구성원 이름"
              />
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                <option value={MODE_CHILD}>아이</option>
                <option value={MODE_PARENT}>부모</option>
              </select>
              <button type="button" className="primary-button" onClick={addMember}>
                추가
              </button>
            </div>
            <div className="member-list">
              {state.members.map((member) => (
                <div key={member.id} className="member-row">
                  <strong>{member.name}</strong>
                  <small>{member.role === MODE_PARENT ? '부모' : '아이'}</small>
                  <button type="button" className="ghost-button danger" onClick={() => deleteMember(member.id)}>
                    삭제
                  </button>
                </div>
              ))}
              {state.members.length === 0 && <div className="empty-state">등록된 구성원이 없습니다.</div>}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
