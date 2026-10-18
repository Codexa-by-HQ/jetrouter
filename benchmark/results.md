# Benchmark results

JetRouter 0.2.0 source was tested against HTTP frameworks and runtime baselines with autocannon. These are local Windows measurements, not a universal speed ranking. Some results are limited by the load generator and substantial variation between rounds.

## Test setup

- Source SHA-256: a8f2628cd983ff46de910af2090df3841fd44db7d54f794c4a08de1d8fed2c9f
- Host: Intel(R) Core(TM) i7-7500U CPU @ 2.70GHz. 4 logical CPUs. Windows_NT 10.0.19045 (x64). Balanced power profile.
- Runtimes: Node 24.21.0, Bun 1.4.3 (Windows baseline build), Deno 2.9.7, Python 3.12.14.
- Autocannon 7.15.0, one load-generator worker, 50 connections, pipelining 1. Client and server share the host.
- One server at a time. Three rounds, rotating target and workload order, 5 seconds discarded warmup then 10 seconds measured per workload.
- 17,517,882 measured responses across 117 samples. all statuses and response bodies passed validation. 2,769 preflight checks passed across 39 server launches.
- Requests include static GET, parameterized GET, JSON POST (201), and deeply nested parameterized GET. Missing routes and bad JSON are validated before timing.
- Registered definitions: 1,004. The plain Deno manual baseline matches the same responses using handwritten code. it is not a generic router.
- CPU percentages are process CPU time divided by wall time, expressed relative to one core. They may exceed 100%. 63 of 117 samples crossed the client's 85% warning threshold.

## Requests

| Workload | Concrete request variants | Paths                                                                                                  |
| -------- | ------------------------: | ------------------------------------------------------------------------------------------------------ |
| hello    |                         1 | GET /hello                                                                                             |
| deep     |                        64 | GET /api/rN/orgs/acmeN/repos/routerN/commits/commitN. all 64 actual paths retained in results.json     |
| mixed    |                        19 | GET /hello, GET /users/123, POST /users, and 16 deep GET variants. exact list retained in results.json |

The request manifest records every registered pattern, concrete request, expected body, and preflight request. Each raw sample contains per-path counts and per-second counts, including a separately marked final partial interval.

## HTTP measurements

Rates below are medians of three completed-response counts divided by measured wall time. The raw autocannon interval averages are retained separately. Min/max and CV expose variation. p99 is the median of three per-run p99 values, not a pooled latency percentile.

| HTTP stack                         | Workload | Median req/s | Min–max req/s |    CV | Requests (3 runs) | p99 ms | Client CPU % | Server CPU % | Client warning runs |
| ---------------------------------- | -------- | -----------: | ------------: | ----: | ----------------: | -----: | -----------: | -----------: | ------------------: |
| JetRouter / Deno                   | deep     |       12,417 | 10,490–28,313 | 46.8% |           517,436 |      6 |         97.9 |         95.4 |                 3/3 |
| JetRouter / Deno                   | mixed    |       12,965 | 10,636–25,838 | 40.6% |           496,797 |      6 |         94.9 |         95.2 |                 3/3 |
| JetRouter / Deno                   | hello    |       20,221 | 10,041–24,505 | 33.2% |           549,098 |      6 |         91.9 |         89.6 |                 3/3 |
| Codexa Core 1.0.10 / Deno          | mixed    |       16,093 |  8,046–22,856 | 38.6% |           495,689 |     11 |         85.6 |        103.4 |                 2/3 |
| Codexa Core 1.0.10 / Deno          | hello    |       17,164 | 10,644–23,207 | 30.2% |           511,229 |     10 |         90.4 |         99.7 |                 2/3 |
| Codexa Core 1.0.10 / Deno          | deep     |       14,699 |  7,800–20,990 | 37.2% |           446,041 |     13 |         82.4 |        102.4 |                 1/3 |
| Hono / Deno                        | hello    |       19,910 | 12,415–26,494 | 29.3% |           590,109 |      5 |         92.6 |         91.2 |                 3/3 |
| Hono / Deno                        | deep     |       15,666 | 10,966–26,016 | 35.8% |           556,356 |     13 |         79.5 |         80.4 |                 1/3 |
| Hono / Deno                        | mixed    |       18,955 |  9,240–26,321 | 38.5% |           592,401 |      6 |         87.1 |         88.7 |                 2/3 |
| Plain Deno.serve + manual matching | deep     |       16,235 | 14,598–27,750 | 30.0% |           590,556 |      7 |         93.9 |         86.8 |                 2/3 |
| Plain Deno.serve + manual matching | mixed    |       13,327 |  9,282–27,826 | 47.4% |           507,478 |     10 |         86.9 |         87.8 |                 2/3 |
| Plain Deno.serve + manual matching | hello    |       20,301 |  9,907–28,576 | 39.0% |           589,078 |      6 |         95.0 |         85.1 |                 3/3 |
| Oak / Deno                         | mixed    |        2,210 |   1,762–5,033 | 48.2% |            97,674 |     39 |         41.4 |         95.0 |                 0/3 |
| Oak / Deno                         | hello    |       11,249 |  4,371–14,855 | 42.8% |           335,502 |      9 |         66.3 |         88.0 |                 0/3 |
| Oak / Deno                         | deep     |        2,373 |   2,115–4,846 | 39.6% |            98,725 |     42 |         38.4 |         95.4 |                 0/3 |
| JetRouter / Bun                    | hello    |       27,699 | 19,874–28,221 | 15.1% |           758,925 |      5 |         95.5 |         96.3 |                 3/3 |
| JetRouter / Bun                    | deep     |       18,011 | 16,831–27,894 | 23.7% |           659,938 |      8 |         84.9 |         86.3 |                 1/3 |
| JetRouter / Bun                    | mixed    |       21,080 | 19,257–21,753 |  5.1% |           622,916 |      5 |         92.1 |         92.0 |                 3/3 |
| Plain Bun.serve native routes      | deep     |       18,994 | 13,710–25,913 | 25.6% |           594,797 |      6 |         90.1 |         87.8 |                 2/3 |
| Plain Bun.serve native routes      | mixed    |       17,760 | 17,189–25,493 | 18.8% |           606,932 |      7 |         88.5 |         88.0 |                 2/3 |
| Plain Bun.serve native routes      | hello    |       26,834 | 19,327–28,218 | 15.8% |           745,306 |      5 |         92.7 |         89.9 |                 3/3 |
| Hono / Bun                         | mixed    |       23,207 | 19,137–24,950 | 10.9% |           674,897 |      4 |         94.6 |         95.2 |                 3/3 |
| Hono / Bun                         | hello    |       25,248 | 21,572–28,721 | 11.6% |           756,297 |      4 |         96.9 |         96.3 |                 3/3 |
| Hono / Bun                         | deep     |       24,985 | 18,673–27,484 | 15.6% |           741,046 |      4 |         96.6 |         95.8 |                 3/3 |
| Express / Node                     | hello    |       11,166 | 10,481–13,814 | 12.2% |           365,663 |      8 |         72.7 |         90.5 |                 0/3 |
| Express / Node                     | deep     |        3,692 |   3,367–4,839 | 15.9% |           127,894 |     25 |         34.3 |         93.8 |                 0/3 |
| Express / Node                     | mixed    |        4,691 |   3,588–4,800 | 12.6% |           144,189 |     23 |         34.0 |         96.8 |                 0/3 |
| Koa + @koa/router / Node           | deep     |        2,634 |   2,461–3,959 | 22.2% |           100,412 |     31 |         29.4 |         90.3 |                 0/3 |
| Koa + @koa/router / Node           | mixed    |        2,924 |   2,562–3,996 | 19.3% |           104,516 |     33 |         30.5 |         91.3 |                 0/3 |
| Koa + @koa/router / Node           | hello    |        2,952 |   2,915–4,318 | 19.2% |           109,174 |     23 |         32.1 |         91.3 |                 0/3 |
| Fastify / Node                     | mixed    |       19,001 | 14,340–19,334 | 13.0% |           566,603 |      8 |         88.0 |         93.7 |                 2/3 |
| Fastify / Node                     | hello    |       16,747 |  6,248–24,298 | 47.0% |           515,747 |     10 |         92.0 |         94.5 |                 2/3 |
| Fastify / Node                     | deep     |       17,505 | 14,763–21,579 | 15.6% |           581,030 |      8 |         84.5 |         92.2 |                 1/3 |
| FastAPI + Uvicorn / Python         | hello    |        2,973 |   1,673–4,038 | 33.4% |            90,967 |     41 |         28.3 |         95.3 |                 0/3 |
| FastAPI + Uvicorn / Python         | deep     |          656 |       347–876 | 34.7% |            18,934 |    125 |          6.8 |         94.7 |                 0/3 |
| FastAPI + Uvicorn / Python         | mixed    |          683 |       372–874 | 32.1% |            19,366 |    150 |          7.6 |         96.3 |                 0/3 |
| Native Bun identical control       | deep     |       14,383 | 10,567–19,689 | 25.1% |           451,120 |      7 |         88.0 |         86.8 |                 3/3 |
| Native Bun identical control       | mixed    |       19,696 | 11,062–29,291 | 37.2% |           602,618 |      5 |         95.9 |         91.6 |                 3/3 |
| Native Bun identical control       | hello    |       19,044 | 13,094–26,111 | 27.4% |           584,426 |      7 |         94.4 |         91.5 |                 2/3 |

## Identical native Bun control

Both entries execute the same adapter code under different labels. Differences between them measure local noise and order effects. they are not engine improvements.

| Workload | Native median req/s | Identical control req/s | Control/native | Over 10% apart |
| -------- | ------------------: | ----------------------: | -------------: | -------------- |
| hello    |              26,834 |                  19,044 |          0.71× | yes            |
| deep     |              18,994 |                  14,383 |          0.76× | yes            |
| mixed    |              17,760 |                  19,696 |          1.11× | yes            |

## Matcher measurements

The matcher benchmark covers 84 cases: 14 scenarios, two registration counts (100 and 1,000), and three runtimes. Each candidate is warmed, validated before timing, then measured in 10 rotated batches. The 1,024 prepared path sequence and complete registrations are in matcher.json.

Hono SmartRouter is warmed before timing. Hono with materialized parameter maps and Hono's native result shape are reported separately. JetRouter's identical control detects drift. cases over 10% apart are inconclusive. Unsupported candidate syntax is recorded as unavailable, never counted as a win.

The table reports median nanoseconds per lookup. lower is faster. It includes result consumption and the documented adapter work. It does not measure HTTP throughput or comparative startup time.

| Runtime      | Scenario                | Routes | JetRouter ns | Hono materialized ns | Hono native ns |  Rou3 ns | Jet A/A drift >10% |
| ------------ | ----------------------- | -----: | -----------: | -------------------: | -------------: | -------: | ------------------ |
| node-24.21.0 | static                  |    100 |        64.29 |                87.02 |          47.21 |    39.48 | no                 |
| node-24.21.0 | parameter               |    100 |       694.21 |             1,941.80 |       1,777.07 |   789.14 | no                 |
| node-24.21.0 | shared-parameter-prefix |    100 |       793.78 |             1,418.11 |       1,142.52 |   774.00 | no                 |
| node-24.21.0 | two-parameters          |    100 |       910.69 |             2,542.99 |       2,176.54 | 1,222.03 | no                 |
| node-24.21.0 | constraint              |    100 |       938.17 |             1,960.52 |       1,654.37 | 1,290.86 | no                 |
| node-24.21.0 | wildcard                |    100 |       838.92 |             2,046.65 |       1,679.15 |   966.31 | no                 |
| node-24.21.0 | mixed-overlap           |    100 |       417.18 |             1,415.43 |       1,269.95 |   310.83 | no                 |
| node-24.21.0 | deep-four-parameters    |    100 |     1,355.19 |             4,131.94 |       3,676.56 | 1,969.48 | no                 |
| node-24.21.0 | deep-shared-prefix      |    100 |     2,493.78 |             2,485.71 |       1,845.20 | 1,732.43 | no                 |
| node-24.21.0 | deep-late-miss          |    100 |       490.41 |               698.71 |         697.75 | 1,535.95 | no                 |
| node-24.21.0 | constraint-late-miss    |    100 |     1,175.53 |               642.97 |         890.67 | 2,322.01 | yes                |
| node-24.21.0 | nested-overlap          |    100 |       713.66 |             1,867.33 |       1,628.56 |   658.41 | no                 |
| node-24.21.0 | long-catch-all          |    100 |       841.40 |             2,374.10 |       1,925.14 | 3,786.53 | no                 |
| node-24.21.0 | miss                    |    100 |        84.93 |               554.79 |         545.25 |   698.60 | no                 |
| node-24.21.0 | static                  |   1000 |        81.55 |               141.24 |         109.02 |    82.37 | no                 |
| node-24.21.0 | parameter               |   1000 |       825.11 |            13,232.73 |      12,262.25 | 1,069.96 | no                 |
| node-24.21.0 | shared-parameter-prefix |   1000 |       903.13 |             6,118.29 |       5,820.97 | 1,073.83 | no                 |
| node-24.21.0 | two-parameters          |   1000 |       966.99 |            18,061.00 |      17,602.51 | 1,537.29 | no                 |
| node-24.21.0 | constraint              |   1000 |     1,047.06 |            11,706.04 |      11,188.01 | 1,487.47 | no                 |
| node-24.21.0 | wildcard                |   1000 |       904.81 |            11,521.34 |      11,132.55 | 1,136.71 | no                 |
| node-24.21.0 | mixed-overlap           |   1000 |       439.89 |             1,595.26 |       1,417.47 |   531.97 | no                 |
| node-24.21.0 | deep-four-parameters    |   1000 |     1,383.05 |            30,252.92 |      29,004.42 | 2,348.40 | no                 |
| node-24.21.0 | deep-shared-prefix      |   1000 |     5,910.63 |            13,192.53 |      12,498.47 | 2,279.25 | no                 |
| node-24.21.0 | deep-late-miss          |   1000 |       499.47 |             4,554.96 |       4,443.43 | 2,373.56 | no                 |
| node-24.21.0 | constraint-late-miss    |   1000 |     1,158.76 |             4,786.83 |       5,031.31 | 1,819.38 | no                 |
| node-24.21.0 | nested-overlap          |   1000 |       849.87 |             2,044.10 |       1,770.90 |   862.06 | no                 |
| node-24.21.0 | long-catch-all          |   1000 |       855.73 |            11,535.48 |      11,250.91 | 4,290.78 | no                 |
| node-24.21.0 | miss                    |   1000 |        83.61 |             2,751.14 |       2,750.63 |   807.24 | no                 |
| bun-1.4.3    | static                  |    100 |        44.29 |                43.74 |          21.58 |    22.23 | yes                |
| bun-1.4.3    | parameter               |    100 |       492.71 |               924.08 |         882.72 |   614.21 | yes                |
| bun-1.4.3    | shared-parameter-prefix |    100 |       579.25 |               631.50 |         593.14 |   652.39 | yes                |
| bun-1.4.3    | two-parameters          |    100 |       595.56 |             1,314.34 |       1,280.06 |   901.81 | yes                |
| bun-1.4.3    | constraint              |    100 |       809.01 |               957.90 |         927.00 |   881.96 | yes                |
| bun-1.4.3    | wildcard                |    100 |       630.09 |               946.73 |         910.90 |   800.92 | yes                |
| bun-1.4.3    | mixed-overlap           |    100 |       295.38 |               959.80 |       1,036.87 |   296.02 | yes                |
| bun-1.4.3    | deep-four-parameters    |    100 |       889.59 |             2,515.26 |       2,338.12 | 1,319.94 | no                 |
| bun-1.4.3    | deep-shared-prefix      |    100 |     1,588.63 |             1,219.84 |       1,116.93 | 1,312.97 | yes                |
| bun-1.4.3    | deep-late-miss          |    100 |       463.53 |               353.68 |         365.15 | 1,089.43 | no                 |
| bun-1.4.3    | constraint-late-miss    |    100 |     1,027.83 |               295.57 |         336.00 |   986.24 | no                 |
| bun-1.4.3    | nested-overlap          |    100 |       545.77 |             1,452.39 |       1,525.08 |   494.49 | no                 |
| bun-1.4.3    | long-catch-all          |    100 |       684.24 |             1,211.60 |       1,078.72 | 2,683.64 | no                 |
| bun-1.4.3    | miss                    |    100 |        86.23 |               190.95 |         178.03 |   441.13 | no                 |
| bun-1.4.3    | static                  |   1000 |        82.17 |               102.08 |          68.73 |    73.67 | no                 |
| bun-1.4.3    | parameter               |   1000 |       632.64 |             6,870.05 |       6,913.99 |   908.48 | no                 |
| bun-1.4.3    | shared-parameter-prefix |   1000 |       709.79 |             4,098.42 |       4,124.45 | 1,265.36 | no                 |
| bun-1.4.3    | two-parameters          |   1000 |       907.21 |            10,873.54 |       9,549.93 | 1,710.18 | yes                |
| bun-1.4.3    | constraint              |   1000 |     1,191.98 |             7,053.36 |       6,470.80 | 1,188.54 | no                 |
| bun-1.4.3    | wildcard                |   1000 |       843.18 |             6,579.41 |       6,081.37 | 1,094.29 | no                 |
| bun-1.4.3    | mixed-overlap           |   1000 |       348.56 |             1,189.66 |       1,130.25 |   481.49 | no                 |
| bun-1.4.3    | deep-four-parameters    |   1000 |     1,082.28 |            15,582.29 |      14,338.15 | 2,056.89 | no                 |
| bun-1.4.3    | deep-shared-prefix      |   1000 |     2,583.21 |             6,573.00 |       6,139.88 | 1,864.45 | no                 |
| bun-1.4.3    | deep-late-miss          |   1000 |       567.07 |             2,277.20 |       2,297.10 | 1,439.93 | no                 |
| bun-1.4.3    | constraint-late-miss    |   1000 |     1,719.28 |             1,617.88 |       1,617.81 | 1,283.29 | no                 |
| bun-1.4.3    | nested-overlap          |   1000 |       676.28 |             1,525.31 |       1,431.82 |   749.71 | no                 |
| bun-1.4.3    | long-catch-all          |   1000 |       903.51 |             7,116.74 |       7,345.11 | 3,402.60 | no                 |
| bun-1.4.3    | miss                    |   1000 |        76.30 |               881.45 |         851.99 |   569.70 | no                 |
| deno-2.9.7   | static                  |    100 |        52.07 |                72.90 |          37.25 |    36.97 | no                 |
| deno-2.9.7   | parameter               |    100 |       767.61 |             1,938.28 |       1,760.23 | 1,153.15 | no                 |
| deno-2.9.7   | shared-parameter-prefix |    100 |       904.72 |             1,359.39 |       1,091.87 |   952.78 | no                 |
| deno-2.9.7   | two-parameters          |    100 |       998.15 |             2,450.41 |       2,227.04 | 1,179.33 | no                 |
| deno-2.9.7   | constraint              |    100 |       987.56 |             1,922.42 |       1,545.94 | 1,187.12 | no                 |
| deno-2.9.7   | wildcard                |    100 |       885.13 |             1,884.17 |       1,625.23 |   964.55 | no                 |
| deno-2.9.7   | mixed-overlap           |    100 |       318.77 |             1,347.68 |       1,238.34 |   364.31 | no                 |
| deno-2.9.7   | deep-four-parameters    |    100 |     1,454.28 |             3,995.00 |       3,539.74 | 1,993.08 | no                 |
| deno-2.9.7   | deep-shared-prefix      |    100 |     2,356.17 |             2,455.01 |       1,793.92 | 1,802.00 | no                 |
| deno-2.9.7   | deep-late-miss          |    100 |       458.08 |               716.98 |         728.49 | 1,537.97 | no                 |
| deno-2.9.7   | constraint-late-miss    |    100 |       918.79 |               574.03 |         568.40 | 1,272.81 | no                 |
| deno-2.9.7   | nested-overlap          |    100 |       697.12 |             1,830.58 |       1,630.41 |   722.58 | no                 |
| deno-2.9.7   | long-catch-all          |    100 |       805.24 |             2,045.57 |       1,728.92 | 3,594.75 | yes                |
| deno-2.9.7   | miss                    |    100 |        73.82 |               433.59 |         424.51 |   689.29 | no                 |
| deno-2.9.7   | static                  |   1000 |        62.86 |               128.52 |          95.95 |    53.78 | no                 |
| deno-2.9.7   | parameter               |   1000 |       809.66 |            11,376.06 |      11,239.93 | 1,011.81 | no                 |
| deno-2.9.7   | shared-parameter-prefix |   1000 |       870.45 |             5,964.80 |       5,695.32 | 1,016.89 | no                 |
| deno-2.9.7   | two-parameters          |   1000 |     1,012.86 |            17,577.42 |      17,340.70 | 1,526.51 | no                 |
| deno-2.9.7   | constraint              |   1000 |     1,215.95 |            12,037.88 |      11,257.98 | 1,849.50 | no                 |
| deno-2.9.7   | wildcard                |   1000 |     1,063.23 |            12,056.29 |      12,266.98 | 1,471.39 | no                 |
| deno-2.9.7   | mixed-overlap           |   1000 |       466.49 |             1,791.85 |       1,597.17 |   607.88 | no                 |
| deno-2.9.7   | deep-four-parameters    |   1000 |     1,564.84 |            34,618.06 |      34,177.91 | 2,640.78 | no                 |
| deno-2.9.7   | deep-shared-prefix      |   1000 |     5,728.43 |            12,437.94 |      11,460.87 | 2,205.04 | no                 |
| deno-2.9.7   | deep-late-miss          |   1000 |       504.30 |             4,282.87 |       4,249.76 | 2,211.84 | no                 |
| deno-2.9.7   | constraint-late-miss    |   1000 |     1,025.17 |             3,172.38 |       3,157.56 | 1,693.03 | no                 |
| deno-2.9.7   | nested-overlap          |   1000 |       936.06 |             2,300.57 |       2,144.00 |   904.83 | no                 |
| deno-2.9.7   | long-catch-all          |   1000 |     1,078.43 |            11,776.69 |      11,938.48 | 4,745.42 | no                 |
| deno-2.9.7   | miss                    |   1000 |        76.98 |             1,754.14 |       1,751.26 |   887.23 | no                 |

## Changes relative to published 0.1.1

The optimization benchmark compares the actual published 0.1.1 package with this source and an identical source control. Eight rotated batches are retained for every case. A ratio above 1 below means the updated source took less time. below 1 means a regression. The changes improve some dynamic cases and regress some static cases.

| Runtime      | Case               | 0.1.1 ns | Updated ns | Old/new ratio | Source A/A drift >10% |
| ------------ | ------------------ | -------: | ---------: | ------------: | --------------------- |
| node-24.21.0 | static             |    65.68 |      73.03 |         0.90× | no                    |
| node-24.21.0 | single-small       |   473.65 |     443.98 |         1.07× | no                    |
| node-24.21.0 | single-large       |   813.91 |     871.90 |         0.93× | no                    |
| node-24.21.0 | deep               | 1,185.86 |   1,166.20 |         1.02× | no                    |
| node-24.21.0 | deep-no-params     |   631.03 |     618.34 |         1.02× | no                    |
| node-24.21.0 | late-miss          |   756.92 |     472.05 |         1.60× | no                    |
| node-24.21.0 | shared-prefix      | 4,931.93 |   5,009.76 |         0.98× | no                    |
| node-24.21.0 | constraint         |   959.23 |     972.66 |         0.99× | no                    |
| node-24.21.0 | multi-capture      | 1,327.50 |   1,428.12 |         0.93× | no                    |
| node-24.21.0 | fallback-no-params |   680.39 |     625.06 |         1.09× | no                    |
| bun-1.4.3    | static             |    61.40 |      74.52 |         0.82× | no                    |
| bun-1.4.3    | single-small       |   241.72 |     239.14 |         1.01× | no                    |
| bun-1.4.3    | single-large       |   533.84 |     557.76 |         0.96× | no                    |
| bun-1.4.3    | deep               |   802.19 |     879.64 |         0.91× | no                    |
| bun-1.4.3    | deep-no-params     |   702.51 |     712.52 |         0.99× | no                    |
| bun-1.4.3    | late-miss          |   738.56 |     489.06 |         1.51× | no                    |
| bun-1.4.3    | shared-prefix      | 2,232.10 |   2,065.41 |         1.08× | no                    |
| bun-1.4.3    | constraint         |   832.24 |     879.47 |         0.95× | no                    |
| bun-1.4.3    | multi-capture      | 1,400.35 |   1,587.58 |         0.88× | no                    |
| bun-1.4.3    | fallback-no-params |   853.08 |     734.99 |         1.16× | no                    |
| deno-2.9.7   | static             |    55.52 |      65.19 |         0.85× | no                    |
| deno-2.9.7   | single-small       |   428.63 |     419.88 |         1.02× | no                    |
| deno-2.9.7   | single-large       |   679.38 |     669.98 |         1.01× | no                    |
| deno-2.9.7   | deep               | 1,190.83 |   1,201.84 |         0.99× | no                    |
| deno-2.9.7   | deep-no-params     |   642.00 |     605.02 |         1.06× | no                    |
| deno-2.9.7   | late-miss          |   697.56 |     416.51 |         1.67× | no                    |
| deno-2.9.7   | shared-prefix      | 4,911.69 |   4,897.30 |         1.00× | no                    |
| deno-2.9.7   | constraint         | 1,017.51 |   1,056.90 |         0.96× | no                    |
| deno-2.9.7   | multi-capture      | 1,337.62 |   1,448.31 |         0.92× | no                    |
| deno-2.9.7   | fallback-no-params |   685.99 |     605.59 |         1.13× | no                    |

## Interpretation and limits

Recorded lookup times favor different engines on different fixtures. The HTTP run shows large between-round changes and client saturation. it cannot establish a reliable overall ranking or maximum server capacity.

HTTP timings include URL parsing, framework dispatch, parameter materialization, response construction, serialization, server transport, and load generation. Router-only conclusions must use the matcher measurements. Frameworks retain their own real dispatch costs. these are not feature-equivalent implementations.

A saturated client can conceal server improvements. Repeated native controls and high CV invalidate close rankings. Use a separate load-generator machine and repeat on deployment hardware before making capacity decisions.

## Evidence and reproduction

- results.json: summary, request manifest, aggregates, all 117 raw samples, latency histograms, interval and endpoint counts, and audit.
- matcher.json: all matcher cases, paths, registrations, samples, and controls.
- optimization.json: published-version comparison and raw timing batches.
- compatibility.json: read-only Codexa comparison and explicit semantic differences.
- verification.json: package, portability, security, memory, and integration checks.

From the sibling benchmarks directory, run:

```sh
node controlled/run.mjs --only=router-deno,codexa,hono-deno,deno,oak,router-bun,bun,bun-control,hono-bun,express,koa,fastify,fastapi --workloads=hello,deep,mixed --rounds=3 --warmup=5 --duration=10 --connections=50
node controlled/report.mjs results/controlled-autocannon-YYYY-MM-DDTHH-MM-SS-SSSZ
```

The harness and its pinned development runtimes/frameworks remain in that directory. They are excluded from the npm package. No package was published by this test run.
