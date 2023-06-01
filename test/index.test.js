const createTestnet = require('hyperdht/testnet')
const test = require('brittle')
const { tmpdir } = require('os')
const { join } = require('path')
const { execSync, spawn } = require('child_process')
const GitPunchServer = require('../server/index.js')

const bootstrap = [{ host: '127.0.0.1', port: 49736 }]

test('clone', async ({ is, teardown }) => {
  const repoDir = join(__dirname, 'fixtures', 'test-repository')
  const dir = join(tmpdir(), (Math.random() + 1).toString(36).substring(7))
  const server = new GitPunchServer('seed', { bootstrap })

  teardown(async () => {
    server.close()
  })

  await server.ready()

  spawn('git', ['clone', `punch://87705d7a7d9648361e81b8ee5cc22d9cc0f8376b11f87fbb527e58d5de7df526${repoDir}`, dir])
  await new Promise((resolve) => setTimeout(resolve, 3000))
  const status = execSync('git status', { cwd: dir })
  is(status.toString().trim(), 'On branch master\nYour branch is up to date with \'origin/master\'.\n\nnothing to commit, working tree clean')
})
