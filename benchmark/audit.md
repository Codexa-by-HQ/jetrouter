# Benchmark audit

**The previous faster-than conclusions are withdrawn.** The counts are real, but this run does not establish that JetRouter beats Hono or native Bun.

## Executed requests

- Autocannon 7.15.0, 50 concurrent HTTP/1.1 connections, pipelining 1.
- Three rounds; one-second warmup excluded, followed by three-second measurement.
- 12 targets × 4 workloads × 3 rounds = 144 measured samples.
- 5,061,927 completed measured responses, excluding warmup/preflight.
- Transport errors: 0; timeouts: 0; non-2xx: 0; incorrect bodies: 0; incorrect statuses: 0.
- 71 preflight checks per launch × 36 launches = 2,556 preflight checks. These are repeated checks, not 2,556 distinct route patterns.

## Workloads

| Workload | Variants | Example request | Expected response |
| --- | ---: | --- | --- |
| hello | 1 | GET /hello | {"ok":true} |
| user | 1 | GET /users/123 | {"id":"123"} |
| deep | 64 | GET /api/r761/orgs/acme0/repos/router0/commits/commit0 | {"route":761,"org":"acme0","repo":"router0","commit":"commit0"} |
| post | 1 | POST /users | {"id":"bench-user","name":"Ada Lovelace","email":"ada@example.com"} |

The full set of 64 concrete deep paths and all 1,004 definitions are in audit.json. POST /users sends {"name":"Ada Lovelace","email":"ada@example.com"}. Preflight also checks /users/new, malformed JSON, invalid fields, and a missing-route 404; those failures are not timed workloads.

## Every measured sample

The wall-time rate is completed responses divided by actual duration. Autocannon reports the average of its request-rate samples, which can differ slightly at boundaries. Client CPU is relative to one core; it is not server CPU.

| Target | Round | Workload | Completed | Seconds | Autocannon req/s | Wall-time req/s | Client core % | p99 ms |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| New router / Deno | 1 | user | 15430 | 3.04 | 5144.34 | 5075.66 | 64.8 | 44 |
| New router / Deno | 1 | deep | 25249 | 3.19 | 8416.67 | 7915.05 | 63.7 | 28 |
| New router / Deno | 1 | post | 23018 | 3.03 | 7673.34 | 7596.70 | 65.0 | 39 |
| New router / Deno | 1 | hello | 26793 | 3.03 | 8932.00 | 8842.57 | 77.3 | 15 |
| Codexa Core 1.0.10 / Deno | 1 | deep | 16866 | 3.16 | 5622.00 | 5337.34 | 57.4 | 34 |
| Codexa Core 1.0.10 / Deno | 1 | post | 19713 | 3.01 | 6571.34 | 6549.17 | 53.0 | 25 |
| Codexa Core 1.0.10 / Deno | 1 | hello | 24111 | 3.02 | 8037.34 | 7983.77 | 66.2 | 22 |
| Codexa Core 1.0.10 / Deno | 1 | user | 24003 | 3.02 | 8001.34 | 7948.01 | 70.4 | 21 |
| Hono / Deno | 1 | post | 26235 | 3.02 | 8745.34 | 8687.09 | 69.3 | 16 |
| Hono / Deno | 1 | hello | 27589 | 3.03 | 9198.67 | 9105.28 | 72.2 | 14 |
| Hono / Deno | 1 | user | 27510 | 3.03 | 9170.00 | 9079.21 | 79.4 | 14 |
| Hono / Deno | 1 | deep | 26750 | 3.18 | 8916.67 | 8411.95 | 69.3 | 24 |
| Plain Deno.serve + manual matching | 1 | hello | 18571 | 3.04 | 6191.34 | 6108.88 | 57.6 | 52 |
| Plain Deno.serve + manual matching | 1 | user | 38947 | 3.02 | 12982.67 | 12896.36 | 87.4 | 10 |
| Plain Deno.serve + manual matching | 1 | deep | 39822 | 3.12 | 13276.00 | 12763.46 | 86.6 | 11 |
| Plain Deno.serve + manual matching | 1 | post | 40937 | 3.01 | 13646.67 | 13600.33 | 84.6 | 8 |
| Oak / Deno | 1 | user | 19130 | 3.01 | 6376.67 | 6355.48 | 53.0 | 22 |
| Oak / Deno | 1 | deep | 4906 | 3.1 | 1635.34 | 1582.58 | 25.7 | 140 |
| Oak / Deno | 1 | post | 25989 | 3.01 | 8662.67 | 8634.22 | 57.1 | 11 |
| Oak / Deno | 1 | hello | 34208 | 3.01 | 11404.00 | 11364.78 | 56.1 | 10 |
| New router / Bun | 1 | deep | 64678 | 3.07 | 21560.00 | 21067.75 | 93.1 | 4 |
| New router / Bun | 1 | post | 60131 | 3.01 | 20045.34 | 19977.08 | 91.9 | 4 |
| New router / Bun | 1 | hello | 67481 | 3.01 | 22498.67 | 22418.94 | 94.5 | 4 |
| New router / Bun | 1 | user | 54847 | 3.01 | 18281.34 | 18221.59 | 88.8 | 11 |
| Plain Bun.serve native routes | 1 | post | 59525 | 3.01 | 19842.67 | 19775.75 | 91.3 | 5 |
| Plain Bun.serve native routes | 1 | hello | 67452 | 3.01 | 22488.00 | 22409.30 | 92.4 | 4 |
| Plain Bun.serve native routes | 1 | user | 53786 | 3.01 | 17926.67 | 17869.10 | 92.4 | 8 |
| Plain Bun.serve native routes | 1 | deep | 37371 | 3.2 | 12457.34 | 11678.44 | 81.5 | 12 |
| Hono / Bun | 1 | hello | 37737 | 3.02 | 12580.00 | 12495.70 | 82.3 | 11 |
| Hono / Bun | 1 | user | 22284 | 3.01 | 7430.67 | 7403.32 | 64.4 | 31 |
| Hono / Bun | 1 | deep | 28678 | 3.16 | 9558.67 | 9075.32 | 69.7 | 23 |
| Hono / Bun | 1 | post | 44641 | 3.01 | 14877.34 | 14830.90 | 83.1 | 12 |
| Express / Node | 1 | user | 25995 | 3.01 | 8664.67 | 8636.21 | 60.7 | 25 |
| Express / Node | 1 | deep | 9775 | 3.09 | 3259.00 | 3163.43 | 28.3 | 65 |
| Express / Node | 1 | post | 20793 | 3 | 6931.34 | 6931.00 | 48.5 | 19 |
| Express / Node | 1 | hello | 32198 | 3.01 | 10732.00 | 10697.01 | 63.4 | 8 |
| Koa + @koa/router / Node | 1 | deep | 6749 | 3.07 | 2249.67 | 2198.37 | 36.6 | 63 |
| Koa + @koa/router / Node | 1 | post | 5595 | 3.01 | 1865.34 | 1858.80 | 23.9 | 79 |
| Koa + @koa/router / Node | 1 | hello | 8279 | 3.01 | 2759.67 | 2750.50 | 21.8 | 26 |
| Koa + @koa/router / Node | 1 | user | 7803 | 3.02 | 2601.00 | 2583.77 | 27.9 | 44 |
| Fastify / Node | 1 | post | 25435 | 3.01 | 8480.34 | 8450.17 | 57.6 | 38 |
| Fastify / Node | 1 | hello | 37539 | 3 | 12513.34 | 12513.00 | 73.5 | 33 |
| Fastify / Node | 1 | user | 49584 | 3.01 | 16526.67 | 16473.09 | 87.7 | 6 |
| Fastify / Node | 1 | deep | 50494 | 3.06 | 16836.00 | 16501.31 | 88.8 | 6 |
| FastAPI + Uvicorn / Python | 1 | hello | 4782 | 3.01 | 1594.00 | 1588.70 | 18.7 | 91 |
| FastAPI + Uvicorn / Python | 1 | user | 4628 | 3.01 | 1542.67 | 1537.54 | 22.9 | 80 |
| FastAPI + Uvicorn / Python | 1 | deep | 1151 | 3.14 | 383.67 | 366.56 | 11.9 | 367 |
| FastAPI + Uvicorn / Python | 1 | post | 7792 | 3.01 | 2598.34 | 2588.70 | 20.2 | 28 |
| New router / Bun | 2 | deep | 51467 | 3.08 | 17156.00 | 16710.06 | 88.8 | 9 |
| New router / Bun | 2 | post | 39203 | 3.01 | 13068.00 | 13024.25 | 85.1 | 15 |
| New router / Bun | 2 | hello | 39887 | 3.01 | 13294.67 | 13251.50 | 84.1 | 15 |
| New router / Bun | 2 | user | 40524 | 3.02 | 13508.00 | 13418.54 | 86.9 | 9 |
| Plain Bun.serve native routes | 2 | post | 46475 | 3.01 | 15494.67 | 15440.20 | 90.3 | 7 |
| Plain Bun.serve native routes | 2 | hello | 60287 | 3.01 | 20093.34 | 20028.90 | 92.9 | 5 |
| Plain Bun.serve native routes | 2 | user | 54152 | 3.02 | 18052.00 | 17931.13 | 84.9 | 10 |
| Plain Bun.serve native routes | 2 | deep | 60532 | 3.2 | 20184.00 | 18916.25 | 89.3 | 5 |
| Hono / Bun | 2 | hello | 62163 | 3.01 | 20717.34 | 20652.16 | 92.9 | 5 |
| Hono / Bun | 2 | user | 61590 | 3.01 | 20530.67 | 20461.79 | 92.9 | 5 |
| Hono / Bun | 2 | deep | 57001 | 3.17 | 19004.00 | 17981.39 | 93.6 | 8 |
| Hono / Bun | 2 | post | 56748 | 3.01 | 18920.00 | 18853.16 | 90.3 | 6 |
| Express / Node | 2 | user | 27283 | 3.01 | 9094.67 | 9064.12 | 60.7 | 13 |
| Express / Node | 2 | deep | 10439 | 3.09 | 3480.34 | 3378.32 | 40.5 | 53 |
| Express / Node | 2 | post | 21915 | 3.01 | 7306.00 | 7280.73 | 57.1 | 15 |
| Express / Node | 2 | hello | 32297 | 3.01 | 10766.67 | 10729.90 | 68.0 | 8 |
| Koa + @koa/router / Node | 2 | deep | 6847 | 3.07 | 2282.34 | 2230.29 | 33.6 | 45 |
| Koa + @koa/router / Node | 2 | post | 6516 | 3.01 | 2172.00 | 2164.78 | 24.9 | 45 |
| Koa + @koa/router / Node | 2 | hello | 6943 | 3.01 | 2314.67 | 2306.64 | 26.0 | 58 |
| Koa + @koa/router / Node | 2 | user | 4099 | 3.01 | 1366.34 | 1361.79 | 23.4 | 90 |
| Fastify / Node | 2 | post | 12621 | 3.02 | 4207.00 | 4179.14 | 38.3 | 64 |
| Fastify / Node | 2 | hello | 32573 | 3.01 | 10857.34 | 10821.59 | 71.1 | 13 |
| Fastify / Node | 2 | user | 30205 | 3.01 | 10070.67 | 10034.88 | 75.8 | 16 |
| Fastify / Node | 2 | deep | 39861 | 3.1 | 13286.67 | 12858.39 | 80.1 | 10 |
| FastAPI + Uvicorn / Python | 2 | hello | 8825 | 3.01 | 2941.67 | 2931.89 | 29.0 | 31 |
| FastAPI + Uvicorn / Python | 2 | user | 7525 | 3.01 | 2509.00 | 2500.00 | 26.0 | 39 |
| FastAPI + Uvicorn / Python | 2 | deep | 1411 | 3.08 | 470.34 | 458.12 | 10.7 | 199 |
| FastAPI + Uvicorn / Python | 2 | post | 7575 | 3.01 | 2525.67 | 2516.61 | 24.4 | 31 |
| New router / Deno | 2 | user | 59536 | 3.01 | 19848.00 | 19779.40 | 83.0 | 6 |
| New router / Deno | 2 | deep | 56312 | 3.09 | 18770.67 | 18223.95 | 89.5 | 7 |
| New router / Deno | 2 | post | 49184 | 3.01 | 16396.00 | 16340.20 | 83.1 | 13 |
| New router / Deno | 2 | hello | 61251 | 3.01 | 20418.67 | 20349.17 | 93.4 | 5 |
| Codexa Core 1.0.10 / Deno | 2 | deep | 44140 | 3.07 | 14714.67 | 14377.85 | 72.8 | 12 |
| Codexa Core 1.0.10 / Deno | 2 | post | 42408 | 3.01 | 14137.34 | 14089.04 | 73.7 | 15 |
| Codexa Core 1.0.10 / Deno | 2 | hello | 52212 | 3.01 | 17404.00 | 17346.18 | 82.0 | 10 |
| Codexa Core 1.0.10 / Deno | 2 | user | 50346 | 3.01 | 16781.34 | 16726.25 | 80.4 | 10 |
| Hono / Deno | 2 | post | 51922 | 3.01 | 17305.34 | 17249.83 | 83.6 | 20 |
| Hono / Deno | 2 | hello | 49027 | 3.01 | 16341.34 | 16288.04 | 80.0 | 10 |
| Hono / Deno | 2 | user | 60087 | 3.01 | 20029.34 | 19962.46 | 94.0 | 5 |
| Hono / Deno | 2 | deep | 59946 | 3.07 | 19976.00 | 19526.38 | 89.6 | 5 |
| Plain Deno.serve + manual matching | 2 | hello | 66683 | 3.01 | 22232.00 | 22153.82 | 93.4 | 4 |
| Plain Deno.serve + manual matching | 2 | user | 65764 | 3.01 | 21922.67 | 21848.50 | 93.9 | 4 |
| Plain Deno.serve + manual matching | 2 | deep | 65044 | 3.09 | 21688.00 | 21049.84 | 93.0 | 4 |
| Plain Deno.serve + manual matching | 2 | post | 58250 | 3.01 | 19416.00 | 19352.16 | 90.8 | 5 |
| Oak / Deno | 2 | user | 29307 | 3 | 9769.34 | 9769.00 | 59.4 | 12 |
| Oak / Deno | 2 | deep | 10116 | 3.08 | 3372.34 | 3284.42 | 32.4 | 29 |
| Oak / Deno | 2 | post | 26441 | 3.01 | 8814.67 | 8784.39 | 55.0 | 10 |
| Oak / Deno | 2 | hello | 33610 | 3 | 11201.34 | 11203.33 | 65.1 | 9 |
| Fastify / Node | 3 | post | 35965 | 3.01 | 11988.00 | 11948.50 | 69.0 | 9 |
| Fastify / Node | 3 | hello | 51533 | 3.01 | 17177.34 | 17120.60 | 90.8 | 6 |
| Fastify / Node | 3 | user | 50479 | 3 | 16825.34 | 16826.33 | 92.2 | 6 |
| Fastify / Node | 3 | deep | 49174 | 3.07 | 16393.34 | 16017.59 | 90.6 | 6 |
| FastAPI + Uvicorn / Python | 3 | hello | 9231 | 3.01 | 3077.67 | 3066.78 | 28.5 | 26 |
| FastAPI + Uvicorn / Python | 3 | user | 7877 | 3.01 | 2626.34 | 2616.94 | 32.2 | 29 |
| FastAPI + Uvicorn / Python | 3 | deep | 1958 | 3.07 | 652.67 | 637.79 | 14.2 | 339 |
| FastAPI + Uvicorn / Python | 3 | post | 7808 | 3.01 | 2603.00 | 2594.02 | 28.0 | 29 |
| New router / Deno | 3 | user | 62279 | 3.03 | 20754.67 | 20554.13 | 86.7 | 5 |
| New router / Deno | 3 | deep | 58995 | 3.08 | 19666.67 | 19154.22 | 84.2 | 6 |
| New router / Deno | 3 | post | 51238 | 3 | 17076.00 | 17079.33 | 92.7 | 10 |
| New router / Deno | 3 | hello | 61607 | 3.01 | 20536.00 | 20467.44 | 90.9 | 6 |
| Codexa Core 1.0.10 / Deno | 3 | deep | 46543 | 3.06 | 15513.34 | 15210.13 | 74.1 | 11 |
| Codexa Core 1.0.10 / Deno | 3 | post | 45320 | 3.01 | 15108.00 | 15056.48 | 76.8 | 12 |
| Codexa Core 1.0.10 / Deno | 3 | hello | 47890 | 3.01 | 15965.34 | 15910.30 | 73.2 | 11 |
| Codexa Core 1.0.10 / Deno | 3 | user | 52505 | 3.01 | 17502.67 | 17443.52 | 81.5 | 10 |
| Hono / Deno | 3 | post | 53702 | 3.01 | 17900.00 | 17841.20 | 87.7 | 7 |
| Hono / Deno | 3 | hello | 39122 | 3.01 | 13042.67 | 12997.34 | 76.8 | 23 |
| Hono / Deno | 3 | user | 57932 | 3.01 | 19314.67 | 19246.51 | 89.3 | 5 |
| Hono / Deno | 3 | deep | 60164 | 3.06 | 20056.00 | 19661.44 | 91.4 | 6 |
| Plain Deno.serve + manual matching | 3 | hello | 49714 | 3.03 | 16566.67 | 16407.26 | 85.1 | 11 |
| Plain Deno.serve + manual matching | 3 | user | 57497 | 3.01 | 19165.34 | 19101.99 | 88.2 | 7 |
| Plain Deno.serve + manual matching | 3 | deep | 61604 | 3.06 | 20536.00 | 20132.03 | 91.9 | 5 |
| Plain Deno.serve + manual matching | 3 | post | 50912 | 3.01 | 16973.34 | 16914.29 | 83.6 | 9 |
| Oak / Deno | 3 | user | 31548 | 3 | 10516.00 | 10516.00 | 64.1 | 10 |
| Oak / Deno | 3 | deep | 10493 | 3.08 | 3498.34 | 3406.82 | 30.4 | 41 |
| Oak / Deno | 3 | post | 26442 | 3.01 | 8814.67 | 8784.72 | 54.6 | 11 |
| Oak / Deno | 3 | hello | 34047 | 3.01 | 11348.00 | 11311.30 | 61.8 | 9 |
| New router / Bun | 3 | deep | 51381 | 3.07 | 17126.67 | 16736.48 | 78.9 | 20 |
| New router / Bun | 3 | post | 59337 | 3.01 | 19778.67 | 19713.29 | 85.7 | 5 |
| New router / Bun | 3 | hello | 65223 | 3.01 | 21741.34 | 21668.77 | 92.9 | 5 |
| New router / Bun | 3 | user | 60449 | 3.01 | 20152.00 | 20082.72 | 94.5 | 6 |
| Plain Bun.serve native routes | 3 | post | 51590 | 3.01 | 17193.34 | 17139.53 | 83.6 | 7 |
| Plain Bun.serve native routes | 3 | hello | 48834 | 3.01 | 16281.34 | 16223.92 | 77.4 | 15 |
| Plain Bun.serve native routes | 3 | user | 41564 | 3.01 | 13856.00 | 13808.64 | 78.9 | 12 |
| Plain Bun.serve native routes | 3 | deep | 34458 | 3.15 | 11486.67 | 10939.05 | 74.9 | 22 |
| Hono / Bun | 3 | hello | 38318 | 3.03 | 12774.67 | 12646.20 | 78.9 | 14 |
| Hono / Bun | 3 | user | 34456 | 3.01 | 11486.67 | 11447.18 | 80.5 | 17 |
| Hono / Bun | 3 | deep | 18336 | 3.35 | 6112.34 | 5473.43 | 45.7 | 91 |
| Hono / Bun | 3 | post | 26322 | 3.01 | 8774.67 | 8744.85 | 69.0 | 33 |
| Express / Node | 3 | user | 14277 | 3.02 | 4759.67 | 4727.48 | 33.6 | 59 |
| Express / Node | 3 | deep | 6018 | 3.11 | 2006.34 | 1935.05 | 26.1 | 66 |
| Express / Node | 3 | post | 12606 | 3.02 | 4202.34 | 4174.17 | 36.2 | 57 |
| Express / Node | 3 | hello | 24493 | 3.01 | 8164.00 | 8137.21 | 57.1 | 10 |
| Koa + @koa/router / Node | 3 | deep | 4760 | 3.09 | 1586.67 | 1540.45 | 26.8 | 57 |
| Koa + @koa/router / Node | 3 | post | 4291 | 3.01 | 1430.34 | 1425.58 | 22.9 | 58 |
| Koa + @koa/router / Node | 3 | hello | 5482 | 3.01 | 1827.34 | 1821.26 | 24.4 | 44 |
| Koa + @koa/router / Node | 3 | user | 4623 | 3.01 | 1541.00 | 1535.88 | 20.8 | 88 |

## Interpretation limits

- These short local HTTP observations do not establish a reliable speed ranking.
- Only one second of warmup and three seconds of measurement were used per sample. Large variation occurred between repeated runs.
- Autocannon approached one CPU core in fast samples. This suggests a client-side ceiling; saturation was not independently established.
- Client and server shared this laptop. Server CPU, affinity, event-loop delay, power state, and thermal throttling were not recorded.
- Hono used c.json(), JetRouter used Response.json(), and JetRouter had no full framework middleware/context/plugin pipeline.
- Plain Deno used handwritten conditions rather than a generic 1004-route table. Native Bun used a native route table with handler functions.
- Bun used its Windows x64 baseline binary. The result is specific to this build and machine.
- Deep traffic cycled 64 concrete paths across 1000 registrations; it did not time every registered route.
- The raw files contain aggregate request-rate histograms and averages, not a per-second chronological time series.
- Correct response checks establish that the intended requests ran, not that a performance difference is significant.
- The saved baseline source predates the delivered cleanup and optimization. It is not a final-source measurement.

## Required follow-up

Keep isolated matcher comparisons separate from framework HTTP comparisons. Use matched handlers and responses; longer interleaved measurements; repeated identical controls; concurrency sweeps; client/server CPU observations; and exact source hashes. Prefer a separate load host for saturation claims. Save all samples, exact requests, errors, and dispersion. Run the machine otherwise idle, without concurrent installs, builds, tests, or other benchmarks. Until then, report no universal winner.

results.json embeds the complete original summary and every raw autocannon result. The original baseline folder is preserved in the benchmark project.
