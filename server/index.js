const b4a = require('b4a')
const { crypto_generichash } = require('sodium-universal') // eslint-disable-line
const c = require('compact-encoding')
const RPC = require('@hyperswarm/rpc')
const DHT = require('@hyperswarm/dht')
const net = require('net')
const { execSync } = require('child_process')
const { writeFileSync, readFileSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const { refsList, packRequest } = require('../lib/messages.js')
const { pipeline } = require('streamx')
const ReadyResource = require('ready-resource')

const GIT_PROTOCOL_PORT = 9418

module.exports = class GitPunchServer extends ReadyResource {
  constructor (seed, opts = {}) {
    super()
    this.keyPair = seed ? DHT.keyPair(hash(Buffer.from(seed))) : DHT.keyPair()
    this._bypassKeyPair = DHT.keyPair()
    this._server = new RPC({ keyPair: this.keyPair, ...opts }).createServer()
    this._bypass = new DHT(opts).createServer()

    this._bypass.on('connection', (socket) => {
      const gitTcpSocket = net.connect(GIT_PROTOCOL_PORT)
      pipeline(socket, gitTcpSocket, socket)
    })

    this._server.respond('list', (req) => {
      const repository = req.toString()
      const refs = getRefs(repository)
      return c.encode(refsList, { refs })
    })

    this._server.respond('pack-request', async (req) => {
      const { repository, refs } = c.decode(packRequest, req)
      const blob = pack(repository, refs.map(e => e.id))
      return blob
    })

    this._server.respond('push-request', async (req) => {
      return this.bypassKeyPair.publicKey
    })
  }

  async _open () {
    await this._server.listen(this._keyPair)
    await this._bypass.listen(this._bypassKeyPair)
  }

  async _close () {
    await this._server.close()
    await this._bypass.close()
  }
}

function getRefs (repository) {
  try {
    const head = execSync('git rev-parse HEAD', { cwd: repository }).toString().trim()
    const list = execSync('git show-ref', { cwd: repository }).toString().split('\n')
    list.pop() // remove empty line
    return [{ name: 'HEAD', id: head }].concat(list.map(e => ({ name: e.split(' ')[1], id: e.split(' ')[0] })))
  } catch (err) {
    console.log(err)
    return []
  }
}

function pack (repository, oids) {
  const refs = getRefs(repository).filter(e => oids.indexOf(e.id) !== -1).map(e => e.name)
  const objects = execSync(`git rev-list --objects ${refs.join(' ')}`, { cwd: repository }).toString()
    .trim().split('\n').map(e => e.trim().split(' ')[0])

  const objectsToPack = join(tmpdir(), (Math.random() + 1).toString(36).substring(7))
  const pack = join(tmpdir(), (Math.random() + 1).toString(36).substring(7))
  writeFileSync(objectsToPack, objects.join('\n'))
  execSync(`cat ${objectsToPack} | git pack-objects --stdout > ${pack}`, { cwd: repository })
  return readFileSync(pack)
}

function hash (data) {
  const out = b4a.allocUnsafe(32)
  crypto_generichash(out, data) // eslint-disable-line
  return out
}
