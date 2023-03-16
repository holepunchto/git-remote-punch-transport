#!/usr/bin/env node

import server from './index.js'

const seed = process.argv.slice()[2]
const bootstrap = [{ host: '127.0.0.1', port: 49736 }]
const key = await server(seed, { bootstrap })

console.log('Listening on key:', key.toString('hex'))
