# Benchmark evidence

The current source-only JetRouter 0.2.0 measurements and validation are complete. See [results.md](results.md) for methodology, all HTTP stacks, repeated controls, matcher results, and limitations.

- [results.json](results.json): all 117 measured HTTP samples, exact requests and responses, per-path and per-second counts, latency histograms, and counter audit.
- [matcher.json](matcher.json): 84 matcher cases under Node, Bun, and Deno, with full route/path fixtures and A/A controls.
- [optimization.json](optimization.json): comparison with the actual published jetrouter@0.1.1 package.
- [compatibility.json](compatibility.json): Codexa integration checks and documented Rou3 behavior differences.
- [verification.json](verification.json): source, installed tarball, runtime, security, and memory checks.

Benchmark tools and third-party development dependencies stay in the sibling benchmarks project. This directory is excluded from npm publication. JetRouter publishes source directly and has no build step.
