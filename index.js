#!/usr/bin/env node

const { readFileSync } = require('fs')
const RPC = require('@hyperswarm/rpc')
const readline = require('readline')
const c = require('compact-encoding')
const { refsList } = require('./lib/messages.js')
const { spawn, execSync } = require('child_process')
const SimpleHyperProxy = require('simple-hyperproxy')
const { dirname } = require('path')
const { join } = require('path')
const Keychain = require('keypear')
const { punchConnection } = require('punch-connection-encoding')

const GIT_PUNCH_SERVER_NAMESPACE = 'git-remote-punch'

const argv = process.argv.slice(0)
const url = argv[3]
const decodeUrl = (url) => c.decode(punchConnection, Buffer.from(url.substring(8, url.indexOf('/', 8)), 'hex'))
const key = decodeUrl(url).publicKey.toString('hex')
const bootstrap = decodeUrl(url).bootstrap.map(e => e.host + ':' + e.port)
const repository = url.substr(url.indexOf('/', 8))

const capabilities = () => {
  process.stdout.write('option\nfetch\npush\nlist\n\n')
}

// Called on fetch (clone, pull), echoes a list of the remote refs

async function list () {
  const rpc = new RPC({ bootstrap })
  const client = rpc.connect(Buffer.from(key, 'hex'))
  const response = await client.request('list', Buffer.from(repository))
  const { refs } = c.decode(refsList, response)
  refs.forEach(ref => process.stdout.write(ref.id + ' ' + ref.name + '\n'))
  process.stdout.write('\n')
  return refs
}

// Called on push, echoes a list of remote-oid to be updated with local ref

async function listForPush () {
  const refs = execSync('git show-ref').toString().trim()
  refs.split('\n').forEach(ref => {
    const oid = ref.split(' ')[0]
    const name = ref.split(' ')[1]

    if (name.startsWith('refs/remote')) {
      const isLocalRef = (ref, branchName) => {
        if (branchName === 'HEAD') {
          const head = readFileSync(join(process.env.GIT_DIR, 'HEAD')).toString()
          return ref.split(' ')[1].indexOf(head) !== -1
        }
        return ref.split(' ')[1].split('/').pop() === branchName && ref.split(' ')[1].startsWith('refs/heads')
      }
      const branchName = name.split('/').pop()
      const branch = refs.split('\n').find(e => isLocalRef(e, branchName))

      if (branchName === 'HEAD') {
        if (branch) process.stdout.write(`${oid} HEAD\n`)
      } else {
        if (branch) process.stdout.write(`${oid} ${branch.split(' ')[1]}\n`)
      }
    }
  })

  process.stdout.write('\n')
}

// Derive bypass git daemon key, sets local proxy and send the pushed refs via send-pack

async function push (refs) {
  const bypassKey = new Keychain(Buffer.from(key, 'hex')).get(GIT_PUNCH_SERVER_NAMESPACE)
  const proxy = new SimpleHyperProxy({ bootstrap })
  const port = await proxy.bind(bypassKey.publicKey)

  const args = ['send-pack', '--stdin', `git://127.0.0.1:${port}${repository}`]
  const force = refs[0][0] === '+'
  if (force) args.splice(1, 0, '--force')

  const cmd = spawn('git', args)
  refs.forEach(ref => cmd.stdin.write(`${ref.split(':')[1]}:${ref.split(':')[1]}\n`))
  cmd.stdin.end()

  // for some reason, send-pack uses stderr for the normal output

  cmd.stderr.on('data', data => {
    process.stderr.write(data.toString())
    if (data.toString().indexOf('fatal') !== -1 || data.toString().indexOf('error') !== -1) {
      process.exit() // kill this process and stop the push operation
    }
  })

  cmd.on('exit', () => {
    refs.forEach(ref => {
      process.stdout.write(`ok ${ref.split(':')[1]}\n`)
    })
    process.stdout.write('\n')
    process.exit()
  })
}

// Derive bypass git daemon key, sets local proxy and fetch wanted refs via fetch-pack

async function fetch (refs) {
  const bypassKey = new Keychain(Buffer.from(key, 'hex')).get(GIT_PUNCH_SERVER_NAMESPACE) // derive key from pk
  const proxy = new SimpleHyperProxy({ bootstrap })
  const port = await proxy.bind(bypassKey.publicKey)

  const cmd = spawn('git', ['fetch-pack', '--stdin', `git://127.0.0.1:${port}${repository}`], { cwd: dirname(process.env.GIT_DIR) })
  refs.map(e => e.id + '\n').forEach(e => cmd.stdin.write(e))
  cmd.stdin.end()

  // for some reason, fetch-pack uses stderr for the normal output

  cmd.stderr.on('data', data => {
    process.stderr.write(data.toString())
    if (data.toString().indexOf('fatal') !== -1 || data.toString().indexOf('error') !== -1) {
      process.exit() // kill this process and stop the fetch operation
    }
  })

  cmd.on('exit', () => {
    process.stdout.write('\n')
    process.exit()
  })
}

// Git communicates with the remote helper using new line based protocol, check https://git-scm.com/docs/gitremote-helpers

const main = async (args) => {
  const crlfDelay = 30000
  let remoteRefs = []
  const wantedRefs = []
  const pushRefs = []
  for await (const line of readline.createInterface({ input: process.stdin, crlfDelay })) {
    const command = line.split(' ')[0]
    switch (command) {
      case 'capabilities':
        capabilities()
        break
      case 'option':
        process.stdout.write('ok\n') // TODO support different options
        break
      case 'list':
        if (line === 'list') remoteRefs = await list()
        else listForPush()
        break
      case 'push':
        pushRefs.push(line.split(' ')[1])
        break
      case 'fetch':
        wantedRefs.push(remoteRefs.find(ref => ref.name === line.split(' ')[2]))
        break
      case '':
        if (wantedRefs.length > 0) fetch(wantedRefs)
        else if (pushRefs.length > 0) push(pushRefs)
        else process.exit()
        break
      default:
        console.error('Unexpected message:', line)
        process.exit()
    }
  }
}

main(argv)
