> **Interpretation correction:** this exploratory baseline does not establish a reliable speed ranking. See [the audit](audit.md) for every request count, variability, CPU observations, and limitations. The source predates the delivered package.

# Autocannon HTTP benchmark

Generated: 2026-10-16T17:15:01.433Z (UTC). Status: complete.

Machine: Intel(R) Core(TM) i7-7500U CPU @ 2.70GHz, 4 logical CPUs, Windows_NT 10.0.19045 (x64).

Load: 50 connections, HTTP/1.1 pipelining 1, 1s discarded warmup + 3s measured per workload per round, 3 rotated rounds. One server process/worker at a time. Client is a separate Node process from the target server; both share this machine.

Each framework registers 1004 application routes, including 1000 distinct deep patterns. The deep workload cycles 64 request paths and reads every parameter. Plain Deno uses handwritten matching instead of a general-purpose route table.

**These are end-to-end local HTTP measurements, not isolated routing speeds or production capacity guarantees.** The standalone router has no Codexa plugin/context pipeline. FastAPI includes its normal framework routing, uses Uvicorn httptools/asyncio with one worker, and returns explicit JSON Responses. The common POST test parses JSON and performs the same lightweight field checks; it does not use Zod, Pydantic models, databases, UUID generation, middleware, or authentication.

All targets return identical response body bytes/status for measured requests. GET /users/new, invalid POSTs and a 404 are checked before measurement. Status and body are also checked for every autocannon response. A transport error, timeout, non-2xx or body mismatch invalidates a measured sample. Access logging is disabled. Express ETags and X-Powered-By are disabled. Bun native routes use handler functions, not cached static Response objects. Bun uses the local Windows x64 baseline binary.

Tables show the median of independent round averages (req/s) and the median of per-round p99 latency. This is not a pooled p99 histogram. Range is min–max round throughput. Any missing/invalid round makes that cell unavailable. Raw autocannon histograms and errors are embedded under rawResults in results.json.

Router source SHA-256: `796ebbd2b764adefa5cbfced7a50cc0735a3b619920fe3b1443812089547eef5`. Source changes during a run invalidate completion. Versions are returned by the actual child servers. Existing historical benchmark results are preserved separately.

## Versions

| Target | Runtime | Versions |
| --- | --- | --- |
| New router / Deno | Deno 2.9.7 | router 0.1.0-experimental.1 |
| Codexa Core 1.0.10 / Deno | Deno 2.9.7 | codexa 1.0.10 |
| Hono / Deno | Deno 2.9.7 | hono 4.13.13 |
| Plain Deno.serve + manual matching | Deno 2.9.7 | runtime baseline |
| Oak / Deno | Deno 2.9.7 | oak 17.2.0 |
| New router / Bun | Bun 1.4.3 | router 0.1.0-experimental.1 |
| Plain Bun.serve native routes | Bun 1.4.3 | runtime baseline |
| Hono / Bun | Bun 1.4.3 | hono 4.13.13 |
| Express / Node | Node 24.21.0 | express 5.2.1 |
| Koa + @koa/router / Node | Node 24.21.0 | koa 3.2.1, @koa/router 15.7.0 |
| Fastify / Node | Node 24.21.0 | fastify 5.12.7 |
| FastAPI + Uvicorn / Python | Python 3.12.14 | fastapi 0.143.2, uvicorn 0.54.0, starlette 1.8.0, httptools 0.9.0, pydantic 2.14.1 |

## GET /hello

| Target | Median req/s | Range req/s | Median avg latency ms | Median round p99 ms | Valid rounds |
| --- | ---: | ---: | ---: | ---: | ---: |
| New router / Deno | 20419 | 8932–20536 | 1.85 | 6.00 | 3/3 |
| Codexa Core 1.0.10 / Deno | 15965 | 8037–17404 | 2.64 | 11.00 | 3/3 |
| Hono / Deno | 13043 | 9199–16341 | 3.35 | 14.00 | 3/3 |
| Plain Deno.serve + manual matching | 16567 | 6191–22232 | 2.47 | 11.00 | 3/3 |
| Oak / Deno | 11348 | 11201–11404 | 3.90 | 9.00 | 3/3 |
| New router / Bun | 21741 | 13295–22499 | 1.65 | 5.00 | 3/3 |
| Plain Bun.serve native routes | 20093 | 16281–22488 | 1.88 | 5.00 | 3/3 |
| Hono / Bun | 12775 | 12580–20717 | 3.45 | 11.00 | 3/3 |
| Express / Node | 10732 | 8164–10767 | 4.16 | 8.00 | 3/3 |
| Koa + @koa/router / Node | 2315 | 1827–2760 | 20.99 | 44.00 | 3/3 |
| Fastify / Node | 12513 | 10857–17177 | 3.51 | 13.00 | 3/3 |
| FastAPI + Uvicorn / Python | 2942 | 1594–3078 | 16.46 | 31.00 | 3/3 |

## GET /users/:id

| Target | Median req/s | Range req/s | Median avg latency ms | Median round p99 ms | Valid rounds |
| --- | ---: | ---: | ---: | ---: | ---: |
| New router / Deno | 19848 | 5144–20755 | 1.92 | 6.00 | 3/3 |
| Codexa Core 1.0.10 / Deno | 16781 | 8001–17503 | 2.64 | 10.00 | 3/3 |
| Hono / Deno | 19315 | 9170–20029 | 2.01 | 5.00 | 3/3 |
| Plain Deno.serve + manual matching | 19165 | 12983–21923 | 1.99 | 7.00 | 3/3 |
| Oak / Deno | 9769 | 6377–10516 | 4.58 | 12.00 | 3/3 |
| New router / Bun | 18281 | 13508–20152 | 2.13 | 9.00 | 3/3 |
| Plain Bun.serve native routes | 17927 | 13856–18052 | 2.24 | 10.00 | 3/3 |
| Hono / Bun | 11487 | 7431–20531 | 3.89 | 17.00 | 3/3 |
| Express / Node | 8665 | 4760–9095 | 5.26 | 25.00 | 3/3 |
| Koa + @koa/router / Node | 1541 | 1366–2601 | 31.72 | 88.00 | 3/3 |
| Fastify / Node | 16527 | 10071–16825 | 2.58 | 6.00 | 3/3 |
| FastAPI + Uvicorn / Python | 2509 | 1543–2626 | 19.37 | 39.00 | 3/3 |

## GET varied deep routes (1,000 registrations)

| Target | Median req/s | Range req/s | Median avg latency ms | Median round p99 ms | Valid rounds |
| --- | ---: | ---: | ---: | ---: | ---: |
| New router / Deno | 18771 | 8417–19667 | 2.10 | 7.00 | 3/3 |
| Codexa Core 1.0.10 / Deno | 14715 | 5622–15513 | 2.91 | 12.00 | 3/3 |
| Hono / Deno | 19976 | 8917–20056 | 2.01 | 6.00 | 3/3 |
| Plain Deno.serve + manual matching | 20536 | 13276–21688 | 1.83 | 5.00 | 3/3 |
| Oak / Deno | 3372 | 1635–3498 | 14.43 | 41.00 | 3/3 |
| New router / Bun | 17156 | 17127–21560 | 2.34 | 9.00 | 3/3 |
| Plain Bun.serve native routes | 12457 | 11487–20184 | 3.62 | 12.00 | 3/3 |
| Hono / Bun | 9559 | 6112–19004 | 4.86 | 23.00 | 3/3 |
| Express / Node | 3259 | 2006–3480 | 14.98 | 65.00 | 3/3 |
| Koa + @koa/router / Node | 2250 | 1587–2282 | 21.86 | 57.00 | 3/3 |
| Fastify / Node | 16393 | 13287–16836 | 2.55 | 6.00 | 3/3 |
| FastAPI + Uvicorn / Python | 470 | 384–653 | 106.04 | 339.00 | 3/3 |

## POST JSON /users

| Target | Median req/s | Range req/s | Median avg latency ms | Median round p99 ms | Valid rounds |
| --- | ---: | ---: | ---: | ---: | ---: |
| New router / Deno | 16396 | 7673–17076 | 2.54 | 13.00 | 3/3 |
| Codexa Core 1.0.10 / Deno | 14137 | 6571–15108 | 2.98 | 15.00 | 3/3 |
| Hono / Deno | 17305 | 8745–17900 | 2.36 | 16.00 | 3/3 |
| Plain Deno.serve + manual matching | 16973 | 13647–19416 | 2.46 | 8.00 | 3/3 |
| Oak / Deno | 8815 | 8663–8815 | 5.18 | 11.00 | 3/3 |
| New router / Bun | 19779 | 13068–20045 | 1.94 | 5.00 | 3/3 |
| Plain Bun.serve native routes | 17193 | 15495–19843 | 2.40 | 7.00 | 3/3 |
| Hono / Bun | 14877 | 8775–18920 | 2.82 | 12.00 | 3/3 |
| Express / Node | 6931 | 4202–7306 | 6.70 | 19.00 | 3/3 |
| Koa + @koa/router / Node | 1865 | 1430–2172 | 26.17 | 58.00 | 3/3 |
| Fastify / Node | 8480 | 4207–11988 | 5.47 | 38.00 | 3/3 |
| FastAPI + Uvicorn / Python | 2598 | 2526–2603 | 18.72 | 29.00 | 3/3 |

## New router against each target

Ratios compare median HTTP throughput on this machine. Greater than 1 means the new-router server handled more requests per second; this is not a pure matcher speedup. No universal winner is inferred from these workloads.

| Workload | Target | New router / Bun ratio | New router / Deno ratio |
| --- | --- | ---: | ---: |
| hello | Codexa Core 1.0.10 / Deno | 1.36× | 1.28× |
| hello | Hono / Deno | 1.67× | 1.57× |
| hello | Plain Deno.serve + manual matching | 1.31× | 1.23× |
| hello | Oak / Deno | 1.92× | 1.80× |
| hello | Plain Bun.serve native routes | 1.08× | 1.02× |
| hello | Hono / Bun | 1.70× | 1.60× |
| hello | Express / Node | 2.03× | 1.90× |
| hello | Koa + @koa/router / Node | 9.39× | 8.82× |
| hello | Fastify / Node | 1.74× | 1.63× |
| hello | FastAPI + Uvicorn / Python | 7.39× | 6.94× |
| user | Codexa Core 1.0.10 / Deno | 1.09× | 1.18× |
| user | Hono / Deno | 0.95× | 1.03× |
| user | Plain Deno.serve + manual matching | 0.95× | 1.04× |
| user | Oak / Deno | 1.87× | 2.03× |
| user | Plain Bun.serve native routes | 1.02× | 1.11× |
| user | Hono / Bun | 1.59× | 1.73× |
| user | Express / Node | 2.11× | 2.29× |
| user | Koa + @koa/router / Node | 11.86× | 12.88× |
| user | Fastify / Node | 1.11× | 1.20× |
| user | FastAPI + Uvicorn / Python | 7.29× | 7.91× |
| deep | Codexa Core 1.0.10 / Deno | 1.17× | 1.28× |
| deep | Hono / Deno | 0.86× | 0.94× |
| deep | Plain Deno.serve + manual matching | 0.84× | 0.91× |
| deep | Oak / Deno | 5.09× | 5.57× |
| deep | Plain Bun.serve native routes | 1.38× | 1.51× |
| deep | Hono / Bun | 1.79× | 1.96× |
| deep | Express / Node | 5.26× | 5.76× |
| deep | Koa + @koa/router / Node | 7.63× | 8.34× |
| deep | Fastify / Node | 1.05× | 1.15× |
| deep | FastAPI + Uvicorn / Python | 36.48× | 39.91× |
| post | Codexa Core 1.0.10 / Deno | 1.40× | 1.16× |
| post | Hono / Deno | 1.14× | 0.95× |
| post | Plain Deno.serve + manual matching | 1.17× | 0.97× |
| post | Oak / Deno | 2.24× | 1.86× |
| post | Plain Bun.serve native routes | 1.15× | 0.95× |
| post | Hono / Bun | 1.33× | 1.10× |
| post | Express / Node | 2.85× | 2.37× |
| post | Koa + @koa/router / Node | 10.60× | 8.79× |
| post | Fastify / Node | 2.33× | 1.93× |
| post | FastAPI + Uvicorn / Python | 7.61× | 6.31× |

## Reproduce

```powershell
npm ci --ignore-scripts --no-audit --no-fund
.\.tools\python\Scripts\python.exe -m pip install -r requirements.lock.txt
node run.mjs --validate
node run.mjs
```

BUN_BIN and PYTHON_BIN can override local executable locations. See README.md for setup and longer runs. This harness uses the [autocannon API](https://github.com/mcollina/autocannon) and a single [Uvicorn worker](https://www.uvicorn.org/settings/).
