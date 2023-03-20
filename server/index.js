const b4a = require('b4a')
const { crypto_generichash } = require('sodium-universal') // eslint-disable-line
const c = require('compact-encoding')
const RPC = require('@hyperswarm/rpc')
const DHT = require('@hyperswarm/dht')
const { execSync } = require('child_process')
const { join } = require('path')
const { refsList } = require('../lib/messages.js')
const ReadyResource = require('ready-resource')
const SimpleHyperProxy = require('simple-hyperproxy')

const GIT_PROTOCOL_PORT = 9418

module.exports = class GitPunchServer extends ReadyResource {
  constructor (seed, opts = {}) {
    super()
    this.keyPair = seed ? DHT.keyPair(hash(Buffer.from(seed))) : DHT.keyPair()
    this._proxyPublicKey = null
    this._server = new RPC({ keyPair: this.keyPair }).createServer()
    this._proxy = new SimpleHyperProxy()
    this.basedir = opts.basedir || '/'

    this._server.respond('list', (req) => {
      const repository = req.toString()
      const refs = this.getRefs(repository)
      return c.encode(refsList, { refs })
    })

    this._server.respond('proxy-key-request', async (req) => {
      return this._proxyPublicKey
    })
  }

  getRefs (repository) {
    try {
      const cwd = join(this.basedir, repository)
      const head = execSync('git rev-parse HEAD', { cwd }).toString().trim()
      const list = execSync('git show-ref', { cwd }).toString().split('\n')
      list.pop() // remove empty line
      return [{ name: 'HEAD', id: head }].concat(list.map(e => ({ name: e.split(' ')[1], id: e.split(' ')[0] })))
    } catch (err) {
      console.log(err)
      return []
    }
  }

  async _open () {
    await this._server.listen(this._keyPair)
    this._proxyPublicKey = await this._proxy.expose(GIT_PROTOCOL_PORT)
  }

  async _close () {
    await this._server.close()
    await this._proxy.destroy()
  }
}

function hash (data) {
  const out = b4a.allocUnsafe(32)
  crypto_generichash(out, data) // eslint-disable-line
  return out
}
