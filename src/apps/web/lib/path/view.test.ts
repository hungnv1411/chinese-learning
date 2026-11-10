import { describe, expect, test } from 'vitest';
import { currentLesson, defaultStage, nodeOffset, type PathStage } from './view';

const stage = (id: string, status: string, lessons: [string, string][] = []) =>
  ({
    id, status,
    units: [{ id: id + '-u', status: 'available', lessons: lessons.map(([i, s]) => ({ id: i, status: s })) }],
  }) as unknown as PathStage;

describe('view', () => {
  test('nodeOffset lặp theo chu kỳ 5', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(nodeOffset)).toEqual([28, 0, -28, -8, 12, 28, 0]);
  });
  test('defaultStage: đang học > xong cuối cùng > đầu tiên', () => {
    expect(defaultStage([stage('a', 'completed'), stage('b', 'available'), stage('c', 'locked')])?.id).toBe('b');
    expect(defaultStage([stage('a', 'completed'), stage('b', 'completed'), stage('c', 'locked')])?.id).toBe('b');
    expect(defaultStage([stage('a', 'locked')])?.id).toBe('a');
    expect(defaultStage([])).toBeUndefined();
  });
  test('currentLesson: đang làm dở được ưu tiên trước bài mở đầu tiên', () => {
    expect(currentLesson(stage('s', 'available', [['1', 'completed'], ['2', 'available'], ['3', 'locked']]))?.id).toBe('2');
    expect(currentLesson(stage('s', 'available', [['1', 'available'], ['2', 'in_progress']]))?.id).toBe('2');
    expect(currentLesson(stage('s', 'available', [['1', 'completed']]))).toBeUndefined();
  });
});
