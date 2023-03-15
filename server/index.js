const b4a = require('b4a')
const { crypto_generichash } = require('sodium-universal')
const c = require('compact-encoding')
const { compile, opt } = require('compact-encoding-struct')
const RPC = require('@hyperswarm/rpc')
const DHT = require('@hyperswarm/dht')
const { execSync } = require('child_process')
const { writeFileSync, readFileSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

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

module.exports = async (seed) => {
  const keyPair = DHT.keyPair(hash(Buffer.from(seed)))
  const rpc = new RPC({ keyPair })
  const server = rpc.createServer()

  server.respond('list', (req) => {
    const repository = req.toString()
    const refs = getRefs(repository)
    return c.encode(refsList, { refs })
  })

  server.respond('pack-request', async (req) => {
    const { repository, refs } = c.decode(packRequest, req)
    const blob = pack(repository, refs.map(e => e.id))
    return blob
  })

  await server.listen(keyPair)
  return keyPair.publicKey
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

  const objectsToPack = join(tmpdir(),(Math.random() + 1).toString(36).substring(7))
  const pack = join(tmpdir(),(Math.random() + 1).toString(36).substring(7))
  writeFileSync(objectsToPack, objects.join('\n'))
  execSync(`cat ${objectsToPack} | git pack-objects --stdout > ${pack}`, { cwd: repository })
  return readFileSync(pack)
}

function hash (data) {
  const out = b4a.allocUnsafe(32)
  crypto_generichash(out, data) // eslint-disable-line
  return out
}
