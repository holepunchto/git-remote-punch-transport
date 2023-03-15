#!/usr/bin/env node

const RPC = require('@hyperswarm/rpc')
const crypto = require('crypto')
const readline = require('readline')
const c = require('compact-encoding')
const { compile, opt } = require('compact-encoding-struct')

let rl = null

const argv = process.argv.slice(0)
const url = argv[3]
const key = url.split(':')[1].substr(2)
const repository = url.split(':')[2]

const wanted = []

const ref = compile({
  name: opt(c.string),
  id: c.string
})

const refsList = compile({
  refs: c.array(ref)
})

const packRequest = compile({
  repository: c.string,
  refs: c.array(ref)
})

const capabilities = () => {
  process.stdout.write('connect\n\n')
}

const connect = async (line) => {
  const subcommand = line.split(' ')[1]
  if (subcommand === 'git-upload-pack') { // pull or clone
    const rpc = new RPC()
    const client = rpc.connect(Buffer.from(key, 'hex'))
    const response = await client.request('list', Buffer.from(repository))
    const { refs } = c.decode(refsList, response)
    process.stdout.write('\n') // conexcion ready
    refs.forEach(ref => {
      const message = `${ref.id} ${ref.name}\n`
      process.stdout.write(formatMessage(message))
    })
    process.stdout.write('0000') // done
  }
}

async function uploadPack () {
  const rpc = new RPC()
  const client = rpc.connect(Buffer.from(key, 'hex'))
  const refs = wanted.map(e => ({ id: e }))
  const pack = await client.request('pack-request', c.encode(packRequest, { repository, refs }))

  while (wanted.length) {
    const id = wanted.pop()
    const ack = `ACK ${id}${wanted.length ? ' continue\n' : '\n'}`
    process.stdout.write(formatMessage(ack))
  }

  const chunkSize = 32
  for (let i = 0; i < pack.length / chunkSize; i++) {
    process.stdout.write(pack.slice(i * chunkSize, i * chunkSize + chunkSize))
  }

  const checksum = crypto.createHash('sha1').update(pack).digest('hex')
  process.stdout.write(checksum + '\n')
  process.exit()
}

function formatMessage (message) {
  const messageLength = (message.length + 4).toString(16)
  const padding = '0'.repeat(4 - messageLength.length)
  return (padding + messageLength + message)
}

const main = async (args) => {
  const crlfDelay = 30000
  rl = readline.createInterface({ input: process.stdin, crlfDelay })
  for await (const line of rl) {
    const command = line.split(' ')[0]
    switch (command) {
      case 'capabilities':
        capabilities()
        break
      case 'option':
        console.log(' \n')
        break
      case 'connect':
        await connect(line)
        break
      case '0032want':
        wanted.push(line.split(' ')[1])
        break
      case '00000009done':
        uploadPack()
        break
      case '0009done':
        uploadPack()
    }
  }
}

main(argv)
