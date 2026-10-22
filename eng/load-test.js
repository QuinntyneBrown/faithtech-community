// Load test for L2-046 AC1 (docs/detailed-designs/platform/performance): with 200 concurrent
// members, p95 latency stays under 300 ms for reads and under 600 ms for writes.
//
// Run it only against an ISOLATED performance environment: its own database, its own API, and
// email that goes nowhere. Never against production, a shared environment or the e2e fake.
//
//   1. Seed 200 distinct, verified members (load-001@loadtest.invalid onwards; .invalid can never
//      receive mail):
//        LOADTEST_PASSWORD=<12+ characters> dotnet run --project backend/src/FaithTech.Community.Cli -- seed-load-users 200
//   2. Start the API for that environment with these explicit settings, which nothing else sets:
//        RateLimits__AuthPerMinute=1000   (setup signs 200 members in from one load-generator address)
//        RateLimits__PerMinute=1000       (the same address's anonymous sign-in steps)
//      The production defaults stay 20 and 100. During the measured run each member makes about
//      60 requests a minute under their own identity, inside the default per-member limit.
//   3. Run k6:
//        k6 run -e BASE_URL=https://<api> -e WEB_ORIGIN=https://<web app> \
//               -e LOADTEST_PASSWORD=<same password> -e SUMMARY_PATH=load-test-summary.json eng/load-test.js
//
// Search (L2-026 AC5): also seed 100,000 searchable records before the run, so search runs over them:
//        dotnet run --project backend/src/FaithTech.Community.Cli -- seed-search-records 100000
//
// Reports (L2-104 AC1): the reports scenario reads GET /api/reports and the CSV export for every period, as a System
// Admin, under 1 second at p95 over 10,000 members, 1,000 events and 50,000 RSVPs. Before the run, seed that volume,
// two more load-test members than VUS, and make the last a System Admin (Staff cannot be granted from the Cli):
//        dotnet run --project backend/src/FaithTech.Community.Cli -- seed-report-records 10000
//        LOADTEST_PASSWORD=<same password> dotnet run --project backend/src/FaithTech.Community.Cli -- seed-load-users 202
//        dotnet run --project backend/src/FaithTech.Community.Cli -- grant-admin load-202@loadtest.invalid
// k6 numbers VUs across both scenarios, so the members scenario's VUs can be any VUS of 1 to VUS + 1;
// a member is signed in for each of those ids, and the reports VU signs in as the member after them.
//
// Every request in the measured scenario must answer 2xx: any other status counts as a failure,
// and the thresholds fail the run. Reads are the member's own session, profile and the team list.
// The write is a real, authorized change that persists: each member updates their own profile's
// bio and home city, and every tenth iteration reads the profile back to check that the write was
// stored. Only the seeded load-test profiles are touched. No email is sent.
import http from "k6/http";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://localhost:5001";
// Words the seeded members and search records carry, so searches match a realistic share of the records.
const SEARCH_TERMS = ["shelter", "hackathon builders", "load", "prayer", "students design"];
const WEB_ORIGIN = __ENV.WEB_ORIGIN || "http://localhost:4200";
const PASSWORD = __ENV.LOADTEST_PASSWORD;
const VUS = Number(__ENV.VUS || 200);
const RUN_ID = __ENV.RUN_ID || `${Date.now()}`;
const REDIRECT_URI = `${WEB_ORIGIN}/auth/callback`;
const REPORT_PERIODS = ["last-30-days", "last-90-days", "this-year", "all-time"];
const REPORT_CITIES = ["", "Toronto", "Vancouver"];

export const options = {
  setupTimeout: "10m",
  scenarios: {
    members: {
      executor: "constant-vus",
      vus: VUS,
      duration: __ENV.DURATION || "5m",
    },
    reports: {
      executor: "constant-vus",
      vus: 1,
      duration: __ENV.DURATION || "5m",
      exec: "reports",
    },
  },
  thresholds: {
    "http_req_duration{scenario:members,kind:read}": ["p(95)<300"],
    "http_req_duration{scenario:members,kind:write}": ["p(95)<600"],
    // L2-026 AC5: global search answers under 500 ms at p95 over 100,000 indexed records.
    "http_req_duration{scenario:members,kind:search}": ["p(95)<500"],
    // L2-104 AC1: the report and its export answer under 1 second at p95.
    "http_req_duration{scenario:reports,kind:report}": ["p(95)<1000"],
    "http_req_failed{scenario:members}": ["rate==0"],
    "http_req_failed{scenario:reports}": ["rate==0"],
    "checks{scenario:reports}": ["rate==1"],
    "checks{scenario:members}": ["rate==1"],
  },
  insecureSkipTLSVerify: true,
};

// Only 2xx is a success; a 3xx, 4xx (including 429) or 5xx is a failure.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }));

/** Signs every load-test member in through the real code + PKCE flow and returns their tokens. */
export function setup() {
  if (!PASSWORD)
    fail("Set LOADTEST_PASSWORD to the password given to seed-load-users.");
  const members = [];
  for (let i = 1; i <= VUS + 1; i++) {
    members.push(signIn(`load-${String(i).padStart(3, "0")}@loadtest.invalid`));
  }
  // The System Admin who reads the reports: the member after those (see the Reports steps above).
  const admin = signIn(`load-${String(VUS + 2).padStart(3, "0")}@loadtest.invalid`);
  return { members, admin };
}

/** The reports scenario: one System Admin cycling through every period and a few cities. */
export function reports(data) {
  const auth = { Authorization: `Bearer ${data.admin.token}` };
  const period = REPORT_PERIODS[__ITER % REPORT_PERIODS.length];
  const city = REPORT_CITIES[__ITER % REPORT_CITIES.length];
  const query = `city=${encodeURIComponent(city)}&period=${period}`;
  const tags = { kind: "report" };
  check(http.get(`${BASE_URL}/api/reports?${query}`, { headers: auth, tags }), {
    "report is 200": (r) => r.status === 200,
  });
  check(
    http.get(`${BASE_URL}/api/reports/export.csv?${query}`, { headers: auth, tags }),
    { "report export is 200": (r) => r.status === 200 },
  );
  // About 40 requests a minute, inside the per-member limit.
  sleep(2);
}

export default function (data) {
  const member = data.members[__VU - 1];
  const auth = { Authorization: `Bearer ${member.token}` };
  const read = (url) =>
    http.get(url, { headers: auth, tags: { kind: "read" } });

  check(read(`${BASE_URL}/api/me`), { "me is 200": (r) => r.status === 200 });
  check(read(`${BASE_URL}/api/profiles/me`), {
    "own profile is 200": (r) => r.status === 200,
  });
  check(read(`${BASE_URL}/api/team?pageSize=50`), {
    "team page is 200": (r) => r.status === 200,
  });
  const term = SEARCH_TERMS[__ITER % SEARCH_TERMS.length];
  check(
    http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(term)}`, {
      headers: auth,
      tags: { kind: "search" },
    }),
    { "search is 200": (r) => r.status === 200 },
  );

  const bio = `Load run ${RUN_ID}, iteration ${__ITER}.`;
  const write = http.put(
    `${BASE_URL}/api/profiles/${member.profileId}`,
    JSON.stringify({ name: member.name, homeCity: "Load City", bio }),
    {
      headers: { ...auth, "Content-Type": "application/json" },
      tags: { kind: "write" },
    },
  );
  check(write, { "profile write is 204": (r) => r.status === 204 });

  if (__ITER % 10 === 0) {
    const stored = read(`${BASE_URL}/api/profiles/me`);
    check(stored, {
      "the write was stored": (r) => r.status === 200 && r.json("bio") === bio,
    });
  }

  // About 60 requests a minute per member: busy, but inside the default per-member limit of 100.
  sleep(4);
}

function signIn(email) {
  const jar = new http.CookieJar();
  const setupTags = { kind: "setup" };
  const signedIn = http.post(
    `${BASE_URL}/api/account/sign-in`,
    JSON.stringify({ email, password: PASSWORD }),
    {
      headers: { "Content-Type": "application/json" },
      jar,
      tags: setupTags,
    },
  );
  if (signedIn.status !== 200)
    fail(
      `${email} could not sign in (${signedIn.status}). Seed the members first.`,
    );

  const verifier = encoding.b64encode(crypto.randomBytes(32), "rawurl");
  const challenge = crypto.sha256(verifier, "base64rawurl");
  const query = [
    "client_id=web",
    "response_type=code",
    `scope=${encodeURIComponent("openid profile email roles offline_access")}`,
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
    `code_challenge=${challenge}`,
    "code_challenge_method=S256",
    "state=load-test",
  ].join("&");
  const authorized = http.get(`${BASE_URL}/connect/authorize?${query}`, {
    jar,
    redirects: 0,
    tags: setupTags,
    responseCallback: http.expectedStatuses(302),
  });
  const code = /[?&]code=([^&]+)/.exec(authorized.headers.Location || "");
  if (!code) fail(`${email} got no authorization code (${authorized.status}).`);

  const tokens = http.post(
    `${BASE_URL}/connect/token`,
    {
      grant_type: "authorization_code",
      client_id: "web",
      code: decodeURIComponent(code[1]),
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    },
    { tags: setupTags },
  );
  if (tokens.status !== 200)
    fail(`${email} could not exchange the code (${tokens.status}).`);
  const token = tokens.json("access_token");

  const me = http.get(`${BASE_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: setupTags,
  });
  if (me.status !== 200)
    fail(`${email} could not read /api/me (${me.status}).`);
  return { token, profileId: me.json("profileId"), name: me.json("name") };
}

/** Writes the full k6 summary as JSON, so the p95 figures of a run can be kept as evidence. */
export function handleSummary(data) {
  const path = __ENV.SUMMARY_PATH || "load-test-summary.json";
  const p95 = (metric) => data.metrics[metric]?.values?.["p(95)"];
  const line = [
    `reads p95 ${p95("http_req_duration{scenario:members,kind:read}")} ms (< 300)`,
    `writes p95 ${p95("http_req_duration{scenario:members,kind:write}")} ms (< 600)`,
    `reports p95 ${p95("http_req_duration{scenario:reports,kind:report}")} ms (< 1000)`,
    `failed requests ${data.metrics["http_req_failed{scenario:members}"]?.values?.rate}`,
  ].join(", ");
  return {
    stdout: `\n${line}\nFull summary: ${path}\n`,
    [path]: JSON.stringify(data, null, 2),
  };
}
