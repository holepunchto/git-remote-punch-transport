#!/usr/bin/env node

import server from './index.js'

const seed = process.argv.slice()[2]
const key = await server(seed)

console.log('Listening on key:', key.toString('hex'))
