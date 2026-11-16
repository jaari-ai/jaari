# ADR-113: The egress core is Node's `fetch` with an undici `Agent` that resolves, checks, and dials

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-016 point 5 and ADR-080 require every outbound call from Jaari's processes to resolve the
name itself, classify every address, and connect only to an address it checked. Model providers
receive the core through pi-ai's `fetch` option, typed as `typeof globalThis.fetch`
(`refs/pi/packages/ai/src/types.ts`). Node's built-in `fetch` runs on undici; Node v26.13.1 bundles
undici 8.12.4.

## Decision
- **Node's built-in `fetch` with a `dispatcher`.** `createEgress(policy).fetch` calls
  `globalThis.fetch` with an undici `Agent` that the caller cannot replace. Responses are the
  global `Response`, so pi-ai and other callers use it unchanged.
- **The check sits in the connector.** undici calls the `Agent`'s `connect` function for every new
  connection, including redirects and IP-literal URLs. It resolves the name with
  `dns.promises.lookup(host, { all: true })`, checks each address, and calls undici's
  `buildConnector` with the checked address as `hostname` and the original name as `servername`,
  so TLS still verifies the certificate against the name.
- **One dependency, `undici` (MIT), pinned exactly to the version Node bundles.** A test fails
  when the pinned major version differs from `process.versions.undici`.

## Alternatives rejected
- **undici's own `fetch`:** independent of the bundled version, but its `Request`, `Response`, and
  `Headers` are different classes from the globals, so objects built elsewhere can fail
  `instanceof` and type checks.
- **Our own `fetch` on `node:http` and `node:https` with a `lookup` hook:** no dependency, but
  redirects, streaming bodies, abort, and `Response` objects would be reimplemented in
  security-critical code.

## Consequences
- When Node moves to a new undici major version, the guard test fails and the pin moves with it.
- A connection is not retried on the next checked address when the first fails to connect; the
  egress pool (Phase 6) adds that.
