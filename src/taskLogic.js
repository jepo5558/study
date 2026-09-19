function parseDateValue(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const current = parseDateValue(dateString);
  current.setDate(current.getDate() + days);
  return toLocalDateKey(current);
}

function getWeekdayValue(dateString) {
  return parseDateValue(dateString).getDay();
}

const DEFAULT_REPEAT_WEEKS = 52;
const MAX_REPEAT_WEEKS = 52;

function clampRepeatWeeks(repeatWeeks) {
  const parsed = repeatWeeks === '' || repeatWeeks == null ? DEFAULT_REPEAT_WEEKS : Number(repeatWeeks);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REPEAT_WEEKS;
  }

  return Math.min(MAX_REPEAT_WEEKS, Math.max(1, Math.trunc(parsed)));
}

export function normalizeWeekdays(selectedWeekdays, dateString) {
  if (selectedWeekdays.length > 0) {
    return [...selectedWeekdays].sort((left, right) => left - right);
  }

  return [getWeekdayValue(dateString)];
}

export function buildRecurringTaskDates(startDate, selectedWeekdays, repeatWeeks) {
  const normalizedWeekdays = normalizeWeekdays(selectedWeekdays, startDate);
  const totalDays = clampRepeatWeeks(repeatWeeks) * 7;
  const dates = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const currentDate = addDays(startDate, offset);
    if (normalizedWeekdays.includes(getWeekdayValue(currentDate))) {
      dates.push(currentDate);
    }
  }

  return dates;
}

export function preserveCompletedTaskScoring(previousTask) {
  if (!previousTask?.completed) {
    return {};
  }

  return {
    title: previousTask.title,
    memberId: previousTask.memberId,
    points: Number(previousTask.points || 0),
    category: previousTask.category,
  };
}

function detachCompletedTasks(tasks) {
  return tasks
    .filter((task) => task.completed)
    .map((task) => ({
      ...task,
      fixed: false,
      seriesId: '',
      repeatDays: [],
    }));
}

function preserveHistoricalSeriesTasks(tasks, editingTaskId, nextBaseTask, selectedWeekdays) {
  return tasks.map((task) => ({
    id: task.id,
    ...nextBaseTask,
    ...preserveCompletedTaskScoring(task),
    date: task.date,
    fixed: true,
    seriesId: editingTaskId,
    repeatDays: selectedWeekdays,
    completed: task.completed,
    completedAt: task.completedAt || '',
  }));
}

function buildTaskByDate(tasks) {
  const taskByDate = new Map();

  tasks.forEach((task) => {
    const existingTask = taskByDate.get(task.date);
    if (!existingTask || (!existingTask.completed && task.completed)) {
      taskByDate.set(task.date, task);
    }
  });

  return taskByDate;
}

export function buildSeriesAsSingleTasks({ matchedSeriesTasks, taskForm, nextBaseTask, createId }) {
  const preservedCompletedTasks = detachCompletedTasks(matchedSeriesTasks);
  const hasCompletedTaskOnTargetDate = preservedCompletedTasks.some((task) => task.date === taskForm.date);

  return [
    ...preservedCompletedTasks,
    ...(hasCompletedTaskOnTargetDate
      ? []
      : [
          {
            id: createId(),
            ...nextBaseTask,
            date: taskForm.date,
            fixed: false,
            seriesId: '',
            repeatDays: [],
            completed: false,
            completedAt: '',
          },
        ]),
  ];
}

export function buildEditedRecurringTasks({
  editingTaskId,
  matchedSeriesTasks,
  taskForm,
  nextBaseTask,
  createId,
  preserveBeforeDate = '',
}) {
  const selectedWeekdays = normalizeWeekdays(taskForm.selectedWeekdays, taskForm.date);
  const effectiveStartDate =
    preserveBeforeDate && taskForm.date < preserveBeforeDate ? preserveBeforeDate : taskForm.date;
  const editableSeriesTasks = preserveBeforeDate
    ? matchedSeriesTasks.filter((task) => task.date >= preserveBeforeDate)
    : matchedSeriesTasks;
  const historicalTasks = preserveBeforeDate
    ? preserveHistoricalSeriesTasks(
        matchedSeriesTasks.filter((task) => task.date < preserveBeforeDate),
        editingTaskId,
        nextBaseTask,
        selectedWeekdays,
      )
    : [];
  const previousByDate = buildTaskByDate(editableSeriesTasks);
  const regeneratedDates = buildRecurringTaskDates(effectiveStartDate, selectedWeekdays, taskForm.repeatWeeks);
  const regeneratedDateSet = new Set(regeneratedDates);
  const preservedCompletedTasks = detachCompletedTasks(
    editableSeriesTasks.filter((task) => task.completed && !regeneratedDateSet.has(task.date)),
  );

  const regeneratedTasks = regeneratedDates.map((date) => {
    const previousTask = previousByDate.get(date);

    return {
      id: previousTask?.id ?? createId(),
      ...nextBaseTask,
      ...preserveCompletedTaskScoring(previousTask),
      date,
      fixed: true,
      seriesId: editingTaskId,
      repeatDays: selectedWeekdays,
      completed: previousTask?.completed ?? false,
      completedAt: previousTask?.completedAt ?? '',
    };
  });

  return [...historicalTasks, ...preservedCompletedTasks, ...regeneratedTasks];
}
