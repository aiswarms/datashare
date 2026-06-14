/**
 * k6 load test — POST /api/files (anonymous upload)
 *
 * Run:
 *   k6 run perf/k6-upload.js
 *
 * Prerequisites:
 *   - Stack up: docker compose up -d
 *   - k6 installed: brew install k6
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const uploadDuration = new Trend('upload_duration', true)
const errorRate = new Rate('error_rate')

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '60s', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    upload_duration: ['p(95)<3000'],
    error_rate: ['rate<0.05'],
    http_req_failed: ['rate<0.05'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost'

export default function () {
  const fileContent = 'k6 load test payload — ' + 'x'.repeat(1024)

  const formData = {
    file: http.file(fileContent, 'loadtest.txt', 'text/plain'),
    expires_in_days: '7',
  }

  const start = Date.now()
  const res = http.post(`${BASE_URL}/api/files`, formData)
  uploadDuration.add(Date.now() - start)

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'token present': (r) => {
      try {
        const body = JSON.parse(r.body)
        return typeof body.token === 'string' && body.token.length > 0
      } catch {
        return false
      }
    },
  })

  errorRate.add(!success)
  sleep(0.5)
}
