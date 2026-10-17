# Benchmark evidence

The earlier faster-than claims are withdrawn. Correct responses were recorded, but the short, variable local measurements do not establish that JetRouter beats Hono or native Bun.

- [Audit and all 144 measured samples](audit.md): exact completed counts, durations, request rates, CPU observations, and limitations.
- [Complete audit data](audit.json): all 64 concrete deep paths, 1,004 registered definitions, expected responses, and sample details.
- [Original baseline tables](results.md): exploratory observations, with interpretation correction.
- [Complete baseline data](results.json): original summary plus all raw autocannon results, including latency and throughput histograms.
- verification.json records final-source correctness, portability, documentation, and bounded-memory checks after cleanup.

The HTTP baseline used the pre-cleanup source hash recorded in its summary. It is not a final-source HTTP benchmark. The original harness, runtime tools, and full historical results are retained in the sibling benchmarks project. Run that harness from its own directory; do not install framework dependencies into JetRouter.

No final-source HTTP speed claim is made. A reliable comparison requires the follow-up protocol in the audit.
