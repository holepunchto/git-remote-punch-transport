#!/usr/bin/env node

import GitPunchServer from './index.js'

const seed = process.argv.slice()[2]
const bootstrap = [{ host: '127.0.0.1', port: 49736 }]
const server = new GitPunchServer(seed, { bootstrap })
await server.ready()

console.log('Listening on key:', server.keyPair.publicKey.toString('hex'))
