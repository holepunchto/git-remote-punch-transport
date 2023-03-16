#!/usr/bin/env node

import subcommand from 'subcommand'
import GitPunchServer from './index.js'
import { ansi } from '../lib/ansi.js'

const commands = [
  {
    name: 'start',
    command: async (args) => {
      if (args.help) {
        printHelp()
        process.exit(0)
      } else {
        const seed = process.argv.slice()[2]
        const bootstrap = [{ host: '127.0.0.1', port: 49736 }]
        const server = new GitPunchServer(seed, { bootstrap })
        await server.ready()
        console.log(`Listening on key: ${ansi.bold(server.keyPair.publicKey.toString('hex'))}`)
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
${ansi.bold('Git Punch Server')}
Version: 0.1.0

  Usage:

  git-punch-server start [--seed=<key-pair-seed>] [--bootstrap=<bootstrap-url>]

`)
  process.exit()
}
