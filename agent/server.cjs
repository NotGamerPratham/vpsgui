/**
 * VPSGUI Agent Server Daemon (.cjs CommonJS entry point)
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * This entry point exists for hosts where the agent directory is dropped next to an ESM
 * package.json ("type": "module"), which would otherwise refuse to load server.js as CommonJS.
 *
 * It deliberately contains no logic of its own — the previous copy was a full duplicate of
 * server.js and the two had already drifted apart. Keep all behaviour in server.js.
 */

'use strict';

module.exports = require('./server.js');
