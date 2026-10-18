# Releasing JetRouter

JetRouter publishes ESM files and TypeScript declarations directly from `src/`. There is no build step, bundler, or install-time script.

## Check the package

```sh
npm ci
npm run check
npm run test:memory
npm run test:package
npm pack --dry-run
```

The package test creates a temporary tarball, installs it offline in a temporary consumer, and checks the installed routing API and TypeScript declarations. Temporary files are removed afterward.

With Bun and Deno installed, also run:

```sh
npm run test:package -- --runtime=bun --runtime=deno
```

The npm package contains only `src/`, `README.md`, `LICENSE`, and `package.json`. Tests, documentation guides, benchmark data, and development dependencies stay in the repository.

## Choose a version

Published versions cannot be overwritten. The working tree currently prepares `0.2.0`; use an unused version for each release.

```sh
npm version patch --no-git-tag-version
```

This updates metadata without making a Git commit or tag. Use a patch for compatible fixes and a minor version for compatible features. Document breaking API or matching changes explicitly during 0.x; after 1.0, they require a major version. Use a prerelease such as `0.2.0-beta.1` for previews.

## Publish manually

After checking the chosen version:

```sh
npm whoami
npm view jetrouter version dist-tags
npm publish --access public --tag latest
```

`npm publish` is the public release action. It publishes source files directly. There are no automatic build or release hooks; run the checks above first. For a prerelease, use `--tag next` instead of `latest`.

Verify the published version and install it in another project:

```sh
npm view jetrouter@0.2.0 version dist.integrity
npm install jetrouter@0.2.0
```

Replace the example version with the version you released. See the [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## GitHub Actions

`.github/workflows/ci.yml` checks the package on Linux and Windows and runs the installed package under Node, Bun, and Deno. `.github/workflows/publish.yml` publishes when you push a `v*` tag whose version matches `package.json`. It runs checks before publishing; it does not create commits or tags.

To use the publishing workflow, configure an npm trusted publisher with these values:

| Setting            | Value        |
| ------------------ | ------------ |
| GitHub owner       | Codexa-by-HQ |
| Repository         | jetrouter    |
| Workflow filename  | publish.yml  |
| GitHub environment | npm          |

The workflow uses GitHub-hosted runners, npm 11, and `id-token: write` for OIDC authentication. Configure the GitHub `npm` environment and its protection rules before releasing. Enable direct publishing in npm's trusted-publisher settings for this workflow. Current npm settings require a new publisher's first successful use within two days; review the [trusted publisher instructions](https://docs.npmjs.com/trusted-publishers/) when setting it up. YAML alone cannot configure your npm account.

Create and push a release tag only when you intend to publish. Creating local package files or running tests does not publish anything.

## README and download counts

The npm README ships with a published version. Editing GitHub alone does not update the README already on npm.

Download counts are calculated by npm. The [download-count API](https://github.com/npm/registry/blob/main/docs/download-counts.md) aggregates the previous day's logs daily. A missing counter does not establish zero downloads.
