const test = require('brittle')
const serverListen = require('../server/index.js')
const { tmpdir } = require('os')
const { join } = require('path')
const { execSync, spawn } = require('child_process')

const bootstrap = [{ host: '127.0.0.1', port: 49736 }]

test('clone', async ({ is }) => {
  const repoDir = join(__dirname, 'fixtures', 'test-repository')
  const dir = join(tmpdir(), (Math.random() + 1).toString(36).substring(7))
  await serverListen('seed', { bootstrap })
  spawn('git', ['clone', `punch://87705d7a7d9648361e81b8ee5cc22d9cc0f8376b11f87fbb527e58d5de7df526${repoDir}`, dir])
  const status = execSync('git status', { cwd: dir })
  is(status.toString().trim(), 'On branch master\nYour branch is up to date with \'origin/master\'.\n\nnothing to commit, working tree clean')
})
