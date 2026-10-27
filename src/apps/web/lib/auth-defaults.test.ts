import { expect, test } from 'vitest';
import {
  SESSION_EXPIRES_IN_SEC,
  SESSION_UPDATE_AGE_SEC,
  userCreateDefaults,
} from './auth-defaults';

test('hook tạo user điền display_name và certificate_name bằng tên Google', () => {
  expect(userCreateDefaults({ name: 'Nguyễn Văn An' })).toEqual({
    displayName: 'Nguyễn Văn An',
    certificateName: 'Nguyễn Văn An',
  });
});

test('phiên 30 ngày, gia hạn mỗi ngày', () => {
  expect(SESSION_EXPIRES_IN_SEC).toBe(30 * 86400);
  expect(SESSION_UPDATE_AGE_SEC).toBe(86400);
});
