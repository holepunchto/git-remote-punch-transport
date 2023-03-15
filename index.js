#!/usr/bin/env node

const RPC = require('@hyperswarm/rpc')
const crypto = require('crypto')
const readline = require('readline')
const c = require('compact-encoding')
const { refsList, packRequest } = require('./lib/messages.js')

const argv = process.argv.slice(0)
const url = argv[3]
const key = url.substr(8, 64)
const repository = url.substr(72)

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

async function uploadPack (wantedRefs) {
  const rpc = new RPC()
  const client = rpc.connect(Buffer.from(key, 'hex'))
  const refs = wantedRefs.map(e => ({ id: e }))
  const pack = await client.request('pack-request', c.encode(packRequest, { repository, refs }))

  while (wantedRefs.length) {
    const id = wantedRefs.pop()
    const ack = `ACK ${id}${wantedRefs.length ? ' continue\n' : '\n'}`
    process.stdout.write(formatMessage(ack))
  }

  const chunkSize = 2
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
  const wantedRefs = []
  for await (const line of readline.createInterface({ input: process.stdin, crlfDelay })) {
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
        wantedRefs.push(line.split(' ')[1])
        break
      case '00000009done':
        uploadPack(wantedRefs)
        break
      case '0009done':
        uploadPack(wantedRefs)
      break
    case '00000032have':
        uploadPack(wantedRefs)
      break
    case '0000':
      process.exit()
    }
  }
}

main(argv)
