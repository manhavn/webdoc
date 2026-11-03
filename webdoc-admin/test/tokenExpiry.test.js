import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTokenRemaining, getTokenExp } from '../src/lib/tokenExpiry.js';

test('getTokenExp parses exp timestamp from valid JWT', () => {
  const payload = { sub: 'user1', exp: 1800000000 };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const token = `header.${b64}.signature`;
  assert.equal(getTokenExp(token), 1800000000);
});

test('getTokenExp returns null for invalid input', () => {
  assert.equal(getTokenExp(''), null);
  assert.equal(getTokenExp('invalid-token'), null);
  assert.equal(getTokenExp(null), null);
});

test('formatTokenRemaining displays seconds only when under 1 minute', () => {
  const res = formatTokenRemaining(55);
  assert.equal(res.expired, false);
  assert.equal(res.text, '55 giây');
});

test('formatTokenRemaining displays minutes only when under 1 hour', () => {
  const res = formatTokenRemaining(15 * 60 + 20); // 15m 20s
  assert.equal(res.expired, false);
  assert.equal(res.text, '15 phút');
});

test('formatTokenRemaining displays 0 phút 2 giờ when exact 2 hours', () => {
  const res = formatTokenRemaining(2 * 3600);
  assert.equal(res.expired, false);
  assert.equal(res.text, '0 phút 2 giờ');
});

test('formatTokenRemaining displays 15 phút 2 giờ when 2 hours 15 mins', () => {
  const res = formatTokenRemaining(2 * 3600 + 15 * 60 + 10);
  assert.equal(res.expired, false);
  assert.equal(res.text, '15 phút 2 giờ');
});

test('formatTokenRemaining displays 15 phút 0 giờ 364 ngày when 364 days 15 mins', () => {
  const res = formatTokenRemaining(364 * 86400 + 0 * 3600 + 15 * 60 + 40);
  assert.equal(res.expired, false);
  assert.equal(res.text, '15 phút 0 giờ 364 ngày');
});

test('formatTokenRemaining displays đã đăng xuất and warning when <= 0', () => {
  const res0 = formatTokenRemaining(0);
  assert.equal(res0.expired, true);
  assert.equal(res0.text, 'đã đăng xuất');
  assert.equal(
    res0.warning,
    'bạn cần copy những thứ đang làm vào nơi khác và đăng nhập lại'
  );

  const resNegative = formatTokenRemaining(-10);
  assert.equal(resNegative.expired, true);
  assert.equal(resNegative.text, 'đã đăng xuất');
});
