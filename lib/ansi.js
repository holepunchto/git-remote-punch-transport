const isWin = process.platform === 'win32'
const rich = isWin === false && process.stdout.isTTY
const pt = (arg) => arg
const ansi = rich
  ? {

      bold: (s) => `\x1B[1m${s}\x1B[22m`,
      dim: (s) => `\x1B[2m${s}\x1B[22m`,
      italic: (s) => `\x1B[3m${s}\x1B[23m`,
      underline: (s) => `\x1B[4m${s}\x1B[24m`,
      inverse: (s) => `\x1B[7m${s}\x1B[27m`,
      red: (s) => `\x1B[31m${s}\x1B[39m`,
      green: (s) => `\x1B[32m${s}\x1B[39m`,
      yellow: (s) => `\x1B[33m${s}\x1B[39m`,
      gray: (s) => `\x1B[90m${s}\x1B[39m`,
      link: (url, text = url) => `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`
    }
  : { bold: pt, dim: pt, italic: pt, inverse: pt, red: pt, green: pt, yellow: pt, gray: pt, link: pt }

module.exports = {
  ansi
}
