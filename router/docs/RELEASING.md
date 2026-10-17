# Releasing JetRouter

This folder is an independent npm package. Display name: **JetRouter**. npm/import name: **jetrouter**. Tagline: **A fast, zero-dependency HTTP routing engine.**

No package has been published by this preparation. No Git remote is configured or assumed.

## 1. Claim the name with the first working release

A local package name does not reserve npm ownership. Check the registry immediately before releasing:

```sh
npm view jetrouter name version
```

An E404 indicates no visible published package at that moment; it is not a reservation or a guarantee that npm will accept the name. Publish this working package under your account to establish ownership. Avoid publishing an empty placeholder just to hold a name. If someone else has taken it, choose a scope you own before publishing.

Create an npm account, verify its email, and configure two-factor authentication for manual publishing. Then, from this folder:

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm ci
npm run check
npm run test:memory
bun test/run.js
deno run --no-config --no-lock test/run.js
npm pack --dry-run
npm publish --access public --tag next
```

The last command is the **actual public publication**. Run it only after reviewing the package and choosing to release it. It will publish version 0.1.0-experimental.1 on the next tag. The prepublishOnly hook repeats the package checks and retention test during ordinary manual publishing.

Inspect the resulting registry entry:

```sh
npm view jetrouter@0.1.0-experimental.1 name version dist-tags
npm owner ls jetrouter
```

A GitHub repository is not required for this first manual release. It is useful for development and required for the GitHub trusted publishing setup below. See npm's [public package publishing guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/).

## 2. Inspect the exact publication

The package uses an explicit files whitelist. Only src/, README.md, LICENSE, and package metadata should be in the tarball. Tests, benchmark results, docs, workflows, caches, and developer dependencies are excluded.

```sh
npm pack --dry-run --json
```

For a consumer smoke test, create the tarball outside this package:

```sh
npm pack --pack-destination ../release-artifacts
```

Create that destination first. Install the resulting tarball in a temporary consumer project and verify ESM imports and TypeScript usage. Do not publish secrets, test artifacts, or machine-specific tools. Use [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/) when reviewing the final files and registry options.

## 3. Add GitHub when the repository exists

Create an empty repository for this package. Initialize Git in this package directory if it is not already a repository, and commit the package, lockfile, source, tests, docs, and workflows. Add the real remote URL and push the chosen branch.

Update package.json with real repository metadata at that time. For example, substitute your actual owner and repository:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_OWNER/YOUR_REPOSITORY.git"
  },
  "homepage": "https://github.com/YOUR_OWNER/YOUR_REPOSITORY#readme",
  "bugs": {
    "url": "https://github.com/YOUR_OWNER/YOUR_REPOSITORY/issues"
  }
}
```

Refresh the lockfile after changing package metadata if necessary. Do not publish these placeholder URLs.

The included .github/workflows/ci.yml runs correctness, declarations, portability/documentation, formatting, memory checks, and the portable suite under Bun and Deno. GitHub Actions is optional for manual releases; the .github directory is needed only to use the prepared automation.

## 4. Configure trusted publishing for later releases

After the first manual release, open JetRouter's npm package settings and add a GitHub trusted publisher. Supply the actual owner/repository, workflow filename **publish.yml**, and environment **npm**. Use a GitHub-hosted runner, Node 24, and npm CLI 11.5.1 or newer.

The workflow needs contents:read and id-token:write. Repository metadata must match the GitHub repository. No long-lived NPM_TOKEN is needed. Configure the npm GitHub environment with your desired reviewers.

Current npm settings default new trusted publishers to staged publishing. The included workflow calls direct npm publish, so enable direct publishing for that publisher. New publisher configurations expire if not used successfully within two days; configure it when the next release is ready. Public repository/package combinations receive automatic provenance.

These requirements can change. Check [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) before enabling the workflow.

The included publish.yml runs on pushed v\* tags. It validates that the tag equals package.json's version, that the name is jetrouter, and that real repository metadata matches. It then runs checks, inspects the pack list, and publishes. Prereleases go to next; stable versions go to latest. It does not create a GitHub Release automatically.

## 5. Versioning and tags

Use [semantic versioning](https://docs.npmjs.com/about-semantic-versioning/) and document user-visible changes in a changelog or GitHub release notes.

| Change                                                            | Example                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| Experimental iteration                                            | 0.1.0-experimental.1 → 0.1.0-experimental.2           |
| First stable release                                              | 1.0.0, after the public routing contract is validated |
| Compatible bug fix                                                | 1.0.0 → 1.0.1                                         |
| Compatible new capability                                         | 1.0.1 → 1.1.0                                         |
| Changed grammar, precedence, API, or other incompatible semantics | 1.x → 2.0.0                                           |

During 0.x development, communicate breaking changes explicitly. Do not treat routing precedence or decoding changes as harmless internal edits. Keep tests for previously supported behavior.

Before Git exists, update both metadata files without creating a Git tag:

```sh
npm version prerelease --preid=experimental --no-git-tag-version
```

Once the repository exists, a typical next experimental release is:

```sh
npm ci
npm run check
npm run test:memory
npm version prerelease --preid=experimental
git push
git push --tags
```

npm version commits the version change and creates the matching v\* tag by default in a Git repository. Pushing that tag triggers publish.yml, so make the release decision before pushing. Set up npm trusted publishing first.

For manual stable publication, explicitly use:

```sh
npm publish --access public --tag latest
```

The package's default publishConfig.tag remains next to avoid accidentally making an experimental release the default install. Dist-tags are pointers; they do not change an immutable published version.

## 6. Release failures and rollback

A published name/version cannot be reused, even after unpublishing. Fix the code and increment the version. If a defective version was released, publish a corrected version and move the appropriate dist-tag, or deprecate the bad version with a clear message. Review npm's current unpublish policy before considering removal.

Keep previous artifacts and test evidence. Preserve the experimental label until routing semantics, runtime support, adapter integration, and performance claims have sufficient validation.

## First-release review

- Confirm npm account, name availability, package version, MIT license, and author metadata.
- Run the checks and inspect npm pack --dry-run.
- Review API/grammar examples, runtime versions, and measured performance limitations.
- Publish manually under next, verify ownership and installation.
- Add real GitHub metadata and trusted publishing when the repository exists.
