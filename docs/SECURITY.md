# Security and resource behavior

JetRouter performs synchronous pathname matching and retains registered data by reference. It does not read files, inspect environment variables, start servers, execute handler data, or cache request pathnames.

## Pattern matching

Long or highly ambiguous ordinary capture segments use a backward literal-boundary plan. It preserves greedy semantics without enumerating backtracking alternatives. Case-insensitive plans use fixed, escaped literal tests. Two unconstrained captures may use a native fast path only for segments of at most 64 characters, bounding its work independently of request length.

The compiler bounds combined-regex chunks and optional expansions. These bounds control compilation structure; they do not impose an HTTP request-length limit.

Set `allowCustomRegex: false` to reject explicit regex constraints and raw regex groups at registration, including repeated brace groups that compile to custom regex syntax. The default is true for compatibility.

When permitted, explicit constraints and raw regex groups use native RegExp. A user-defined pathological expression can consume excessive CPU on crafted input. Register patterns from trusted application configuration, review constraints, and enforce appropriate request/path limits in the server adapter. RegExp objects returned by toRegExp also retain native backtracking behavior.

## Data ownership

Capture maps are request-local. Dictionary keys such as `__proto__` are handled as data keys. Route payload objects are owned by the caller; the router does not deep-freeze or copy them.

The live generation is invalidated after mutation. Explicit snapshots intentionally retain old generations until callers release them. Bounds on registrations, pattern lengths, and snapshot lifetimes belong to application configuration.

## Validation

The test suite checks prototype-sensitive names, decoding failures, method boundaries, generated overlap cases, bounded execution on adversarial ordinary captures, and garbage collection of removed payloads and discarded snapshots. Retention tests include distinct-path churn and repeated generation replacement.

These checks cover concrete cases; they are not a proof that every regex, workload, runtime, or integration is free of vulnerabilities or leaks.

Report reproducible issues through the repository's GitHub security reporting options where available, or use an issue without disclosing sensitive information.
