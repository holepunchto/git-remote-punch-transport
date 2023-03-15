const c = require('compact-encoding')
const { compile, opt } = require('compact-encoding-struct')

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

module.exports = {
  refsList,
  packRequest
}
