#!/usr/bin/env node

const { writeFileSync, readFileSync } = require('fs')
const RPC = require('@hyperswarm/rpc')
const readline = require('readline')
const c = require('compact-encoding')
const { refsList } = require('./lib/messages.js')
const { spawn, execSync } = require('child_process')
const SimpleHyperProxy = require('simple-hyperproxy')
const { dirname } = require('path')
const { join } = require('path')

const argv = process.argv.slice(0)
const url = argv[3]
const key = url.substr(8, 64)
const repository = url.substr(72)

const capabilities = () => {
  process.stdout.write('option\nfetch\npush\nlist\n\n')
}

async function list () {
  const rpc = new RPC()
  const client = rpc.connect(Buffer.from(key, 'hex'))
  const response = await client.request('list', Buffer.from(repository))
  const { refs } = c.decode(refsList, response)
  refs.forEach(ref => process.stdout.write(ref.id + ' ' + ref.name + '\n'))
  process.stdout.write('\n')
  return refs
}

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
        if (branch) process.stdout.write(`${oid} ${branch.split(' ')[1]}\n`) // echoes origin ref oid for local ref name, that means: push local ref to remote branch
      }
    }
  })

  process.stdout.write('\n')
}

async function push (refs) {
  const rpc = new RPC()
  const client = rpc.connect(Buffer.from(key, 'hex'))
  const bypassKey = await client.request('proxy-key-request', Buffer.alloc(0))

  const proxy = new SimpleHyperProxy()
  const port = await proxy.bind(Buffer.from(bypassKey, 'hex'))

  const args = ['send-pack', '--stdin', `git://127.0.0.1:${port}${repository}`]
  const force = refs[0][0] === '+'
  if (force) args.splice(1, 0, '--force')

  const cmd = spawn('git', args)
  refs.forEach(ref => cmd.stdin.write(`${ref.split(':')[1]}:${ref.split(':')[1]}\n`))
  cmd.stdin.end()

  cmd.on('exit', () => {
    refs.forEach(ref => {
      process.stdout.write(`ok ${ref.split(':')[1]}\n`)
    })
    process.stdout.write('\n')
    process.exit()
  })
}

async function fetch (refs) {
  const rpc = new RPC()
  const client = rpc.connect(Buffer.from(key, 'hex'))
  const proxyKey = await client.request('proxy-key-request', Buffer.alloc(0))

  const proxy = new SimpleHyperProxy()
  const port = await proxy.bind(Buffer.from(proxyKey, 'hex'))

  writeFileSync('/tmp/refs', refs.map(e => e.id).join('\n')) // TODO random name

  const cmd = spawn('git', ['fetch-pack', '--stdin', `git://127.0.0.1:${port}${repository}`], { cwd: dirname(process.env.GIT_DIR) })
  cmd.stdin.write(readFileSync('/tmp/refs'))
  cmd.stdin.end()

  cmd.stderr.on('data', async data => { // for some reason, git uses stderr for the normal output
    process.stderr.write(data.toString())
  })

  cmd.on('exit', () => {
    process.stdout.write('\n')
    process.exit()
  })
}

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
        process.stdout.write('ok\n')
        break
      case 'list':
        remoteRefs = line === 'list' ? await list() : listForPush()
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
