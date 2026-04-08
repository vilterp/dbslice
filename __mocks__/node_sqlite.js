// Shim for node:sqlite in Jest 28, which cannot resolve the `node:` prefix for
// experimental builtins. Module._load bypasses Jest's module resolver and loads
// the actual Node.js built-in directly.
const Module = require('module');
try {
  module.exports = Module._load('node:sqlite', null, false);
} catch {
  module.exports = null;
}
