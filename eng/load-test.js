// Load test for L2-046 AC1 (docs/detailed-designs/platform/performance): with 200 concurrent
// users, p95 latency stays under 300 ms for reads and under 600 ms for writes.
//
// Run against a deployed or local stack, never against the e2e fake:
//   k6 run -e BASE_URL=https://localhost:5001 -e ACCESS_TOKEN=<token> eng/load-test.js
//
// ACCESS_TOKEN is an access token for a seeded test member. Raise the API's rate limits for the
// run (RateLimits:AuthPerMinute and the per-user limit), or the limiter answers 429 by design.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://localhost:5001';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN;
// SCENARIO=search runs only global search, for L2-026 AC5: p95 under 500 ms with 100,000 indexed records
// (seed them as docs/detailed-designs/search/global-search describes).
const SEARCH_ONLY = __ENV.SCENARIO === 'search';
const SEARCH_TERMS = ['member', 'city 4', 'builder 99', 'shelter', 'grace'];

export const options = {
  scenarios: {
    members: {
      executor: 'constant-vus',
      vus: 200,
      duration: __ENV.DURATION || '2m',
    },
  },
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<300'],
    'http_req_duration{kind:write}': ['p(95)<600'],
    'http_req_duration{kind:search}': ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
  insecureSkipTLSVerify: true,
};

export function setup() {
  if (!ACCESS_TOKEN) throw new Error('Set ACCESS_TOKEN to an access token for a test member.');
}

export default function () {
  const auth = { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } };

  const term = SEARCH_TERMS[__ITER % SEARCH_TERMS.length];
  const search = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(term)}`, {
    ...auth,
    tags: { kind: 'search' },
  });
  check(search, { 'search is 200': (r) => r.status === 200 });
  if (SEARCH_ONLY) {
    sleep(1);
    return;
  }

  const me = http.get(`${BASE_URL}/api/me`, { ...auth, tags: { kind: 'read' } });
  check(me, { 'me is 200': (r) => r.status === 200 });

  const ready = http.get(`${BASE_URL}/health/ready`, { tags: { kind: 'read' } });
  check(ready, { 'ready is 200': (r) => r.status === 200 });

  // A write that is safe to repeat: the neutral password-reset request queues at most one email.
  const reset = http.post(
    `${BASE_URL}/api/account/forgot-password`,
    JSON.stringify({ email: `load-${__VU}@example.org` }),
    { headers: { 'Content-Type': 'application/json' }, tags: { kind: 'write' } },
  );
  check(reset, { 'reset is 202': (r) => r.status === 202 });

  sleep(1);
}
