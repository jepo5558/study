import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEditedRecurringTasks, buildRecurringTaskDates, buildSeriesAsSingleTasks } from '../src/taskLogic.js';

const baseTask = {
  title: '새 과제명',
  memberId: 'yuyu',
  points: 40,
  category: '학습',
};

test('recurring edit preserves scoring for already completed tasks on matching dates', () => {
  const tasks = [
    {
      id: 'sat-completed',
      title: '주말 과제',
      memberId: 'yuyu',
      points: 20,
      category: '기존',
      date: '2026-07-18',
      fixed: true,
      seriesId: 'series-1',
      repeatDays: [0, 6],
      completed: true,
      completedAt: '2026-07-18T10:00:00.000Z',
    },
  ];

  const result = buildEditedRecurringTasks({
    editingTaskId: 'series-1',
    matchedSeriesTasks: tasks,
    taskForm: {
      date: '2026-07-18',
      selectedWeekdays: [0, 1, 2, 3, 4, 5, 6],
      repeatWeeks: 1,
    },
    nextBaseTask: baseTask,
    createId: () => 'new-id',
  });

  const completedTask = result.find((task) => task.id === 'sat-completed');
  assert.equal(completedTask.title, '주말 과제');
  assert.equal(completedTask.memberId, 'yuyu');
  assert.equal(completedTask.points, 20);
  assert.equal(completedTask.category, '기존');
  assert.equal(completedTask.completed, true);
});

test('recurring edit keeps completed tasks that fall outside the new generated date range', () => {
  const tasks = [
    {
      id: 'old-weekend',
      title: '주말 과제',
      memberId: 'yuyu',
      points: 80,
      category: '복구 대상',
      date: '2026-07-12',
      fixed: true,
      seriesId: 'series-1',
      repeatDays: [0, 6],
      completed: true,
      completedAt: '2026-07-12T10:00:00.000Z',
    },
  ];

  const result = buildEditedRecurringTasks({
    editingTaskId: 'series-1',
    matchedSeriesTasks: tasks,
    taskForm: {
      date: '2026-07-20',
      selectedWeekdays: [0, 1, 2, 3, 4, 5, 6],
      repeatWeeks: 1,
    },
    nextBaseTask: baseTask,
    createId: () => 'new-id',
  });

  const preservedTask = result.find((task) => task.id === 'old-weekend');
  assert.ok(preservedTask);
  assert.equal(preservedTask.points, 80);
  assert.equal(preservedTask.completed, true);
  assert.equal(preservedTask.fixed, false);
  assert.equal(preservedTask.seriesId, '');
  assert.deepEqual(preservedTask.repeatDays, []);
});

test('converting a series to a single task preserves completed history instead of deleting it', () => {
  const tasks = [
    {
      id: 'completed-weekend',
      title: '주말 과제',
      memberId: 'yuyu',
      points: 20,
      category: '기존',
      date: '2026-07-19',
      fixed: true,
      seriesId: 'series-1',
      repeatDays: [0, 6],
      completed: true,
      completedAt: '2026-07-19T10:00:00.000Z',
    },
  ];

  const result = buildSeriesAsSingleTasks({
    matchedSeriesTasks: tasks,
    taskForm: { date: '2026-07-20' },
    nextBaseTask: baseTask,
    createId: () => 'new-single',
  });

  assert.ok(result.some((task) => task.id === 'completed-weekend' && task.completed && task.points === 20));
  assert.ok(result.some((task) => task.id === 'new-single' && !task.completed && task.points === 40));
});

test('recurring edit keeps previous tasks in the same series and regenerates future weeks from today', () => {
  let idSequence = 0;
  const tasks = [
    {
      id: 'last-week-task',
      title: '지난주 과제',
      memberId: 'yuyu',
      points: 20,
      category: '기존',
      date: '2026-09-07',
      fixed: true,
      seriesId: 'series-1',
      repeatDays: [1],
      completed: false,
      completedAt: '',
    },
    {
      id: 'this-week-task',
      title: '이번주 과제',
      memberId: 'yuyu',
      points: 20,
      category: '기존',
      date: '2026-09-14',
      fixed: true,
      seriesId: 'series-1',
      repeatDays: [1],
      completed: false,
      completedAt: '',
    },
    {
      id: 'this-week-duplicate-task',
      title: '이번주 과제 중복',
      memberId: 'yuyu',
      points: 20,
      category: '기존',
      date: '2026-09-14',
      fixed: true,
      seriesId: 'series-1',
      repeatDays: [1],
      completed: true,
      completedAt: '2026-09-14T10:00:00.000Z',
    },
  ];

  const result = buildEditedRecurringTasks({
    editingTaskId: 'series-1',
    matchedSeriesTasks: tasks,
    taskForm: {
      date: '2026-09-07',
      selectedWeekdays: [1],
      repeatWeeks: 8,
    },
    nextBaseTask: baseTask,
    createId: () => `new-id-${idSequence++}`,
    preserveBeforeDate: '2026-09-13',
  });

  const previousTask = result.find((task) => task.id === 'last-week-task');
  assert.ok(previousTask);
  assert.equal(previousTask.fixed, true);
  assert.equal(previousTask.seriesId, 'series-1');
  assert.deepEqual(previousTask.repeatDays, [1]);

  const recurringTasks = result.filter((task) => task.seriesId === 'series-1');
  assert.equal(recurringTasks.length, 9);
  assert.equal(recurringTasks[0].date, '2026-09-07');
  assert.equal(recurringTasks[1].date, '2026-09-14');
  assert.equal(recurringTasks.filter((task) => task.date === '2026-09-14').length, 1);
  assert.equal(recurringTasks.find((task) => task.date === '2026-09-14').completed, true);
  assert.equal(recurringTasks.at(-1).date, '2026-11-02');
});

test('recurring date generation clamps repeat weeks to the supported range', () => {
  const result = buildRecurringTaskDates('2026-09-07', [1], 100);

  assert.equal(result.length, 52);
  assert.equal(result[0], '2026-09-07');
  assert.equal(result.at(-1), '2027-08-30');
});

test('empty repeat weeks defaults to ongoing supported range', () => {
  const result = buildRecurringTaskDates('2026-09-07', [1], '');

  assert.equal(result.length, 52);
  assert.equal(result[0], '2026-09-07');
  assert.equal(result.at(-1), '2027-08-30');
});
