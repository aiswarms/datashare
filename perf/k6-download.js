/**
 * k6 load test — GET /api/files/{token}/download
 *
 * Run:
 *   k6 run perf/k6-download.js
 *
 * Prerequisites:
 *   - Stack up: docker compose up -d
 *   - k6 installed: brew install k6
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const downloadDuration = new Trend('download_duration', true)
const errorRate = new Rate('error_rate')

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
    },
  },
  thresholds: {
    download_duration: ['p(95)<500'],
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost'

let sharedToken = null

export function setup() {
  const fileContent = 'k6 download test fixture'
  const formData = {
    file: http.file(fileContent, 'download-fixture.txt', 'text/plain'),
    expires_in_days: '7',
  }

  const res = http.post(`${BASE_URL}/api/files`, formData)
  if (res.status !== 201) {
    throw new Error(`Setup failed: upload returned ${res.status} — ${res.body}`)
  }

  const body = JSON.parse(res.body)
  console.log(`Setup: uploaded file with token ${body.token}`)
  return { token: body.token }
}

export default function (data) {
  const { token } = data

  const start = Date.now()
  const res = http.get(`${BASE_URL}/api/files/${token}/download`)
  downloadDuration.add(Date.now() - start)

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'content-disposition present': (r) =>
      r.headers['Content-Disposition'] !== undefined,
  })

  errorRate.add(!success)
  sleep(0.1)
}
