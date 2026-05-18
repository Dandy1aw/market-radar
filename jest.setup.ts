import '@testing-library/jest-dom';

// Ensure Web Fetch API globals are available in the jsdom test environment.
// Node 18+ exposes these on the global object; jsdom does not, so we copy them over.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeGlobal: any = global;
if (typeof globalThis.Request === 'undefined' && typeof nodeGlobal.Request !== 'undefined') {
  globalThis.Request = nodeGlobal.Request;
  globalThis.Response = nodeGlobal.Response;
  globalThis.Headers = nodeGlobal.Headers;
  globalThis.fetch = nodeGlobal.fetch;
}
