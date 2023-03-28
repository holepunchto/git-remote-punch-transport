#!/usr/bin/env node

import subcommand from 'subcommand'
import GitPunchServer from './index.js'
import { ansi } from '../lib/ansi.js'
import cenc from 'compact-encoding'
import { punchConnection } from 'punch-connection-encoding'

const commands = [
  {
    name: 'start',
    command: async (args) => {
      if (args.help) {
        printHelp()
        process.exit(0)
      } else {
        const seed = args.seed
        const bootstrap = args.bootstrap ? args.bootstrap.split(',').map(e => ({ host: e.split(':')[0], port: parseInt(e.split(':')[1]) })) : []
        const basedir = args.basedir
        const server = new GitPunchServer(seed, { bootstrap, basedir })
        await server.ready()
        const key = cenc.encode(punchConnection, { publicKey: server.keyPair.publicKey, bootstrap }).toString('hex')
        console.log(`Listening on key: ${key}`)
      }
    },
    options: [
      {
        name: 'seed',
        abbr: 's'
      },
      {
        name: 'bootstrap',
        abbr: 'b'
      },
      {
        name: 'basedir',
        abbr: 'd'
      },
      {
        name: 'help',
        abbr: 'h'
      }
    ]
  }
]

let args = process.argv.slice(2)
if (args.length === 1) args = args[0].split(',') // path for spawn testing
const match = subcommand(commands)
const matched = match(args)
if (!matched) {
  printHelp()
  process.exit(0)
}

function printHelp () {
  console.log(`
  ${ansi.bold('Git-Punch Server')}
  Version: 0.1.0

  ${ansi.italic('git-punch-server start [--seed <key-pair-seed>] [--bootstrap <bootstrap-url>] [--basedir <directory>]')}

  ${ansi.bold('seed')}: Sets dht server key pair seed.
  ${ansi.bold('bootstrap')}: Sets dht bootstrap server.
  ${ansi.bold('basedir')}: Remaps path requests as relative to given path, example: ${ansi.dim('--basedir /tmp')} converts /tmp/repo into /repo

`)
  process.exit()
}
