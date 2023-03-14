#!/usr/bin/env node

const crypto = require('crypto')
const readline = require('readline')
const SimpleHyperProxy = require('simple-hyperproxy')
const { execSync, spawn, exec } = require('child_process')
const { mkdirSync, renameSync, readFileSync } = require('fs')
const { dirname, basename } = require('path')
const { EOL } = require('os')

let rl = null
const print = console.error

const argv = process.argv.slice(0)
const url = argv[3]
const key = url.split(':')[1].substr(2)
const repository = url.split(':')[2]

const capabilities = () => {
    console.log('connect\n')
}

const connect = async (line) => {
    const subcommand = line.split(' ')[1]
    if(subcommand === 'git-receive-pack') { // push
        const proxy = new SimpleHyperProxy()
        const port = await proxy.bind(Buffer.from(key, 'hex'))
        print(`git send-pack --all git://127.0.0.1:${port}${repository}`)
        const cmd = spawn('git', [ 'send-pack', '--all', `git://127.0.0.1:${port}${repository}` ])
        cmd.stdout.on('data', async data => {
            print(data.toString())
            if (data.toString()[data.toString().length - 1] === EOL) {
                process.exit()
            }
        })
        cmd.stderr.on('data', async data => {
            print(data.toString())
            if (data.toString()[data.toString().length - 1] === EOL) {
                process.exit()
            }
        })
    }
    if(subcommand === 'git-upload-pack') { // clone
        let commit = null
        const proxy = new SimpleHyperProxy()
        const port = await proxy.bind(Buffer.from(key, 'hex'))
        print(port)
        process.stdout.write('\n')

        const messageA = "5e5f20d6250b88aa986c53a194af6cd161c46166 HEAD symref-target:refs/heads/master\x00 refs-delta\n"
        process.stdout.write(formatMessage(messageA))

        const messageB = "5e5f20d6250b88aa986c53a194af6cd161c46166 refs/heads/master\n"
        process.stdout.write(formatMessage(messageB))

        const done = '0000'
        process.stdout.write(done)
    }
}

function formatMessage (message) {
    const messageLength = (message.length + 4).toString(16)
    const padding = "0".repeat(4 - messageLength.length)
    return (padding + messageLength + message)
}

function next() {
    process.stdout.write(formatMessage('ACK 5e5f20d6250b88aa986c53a194af6cd161c46166\n'))
    process.stdout.write(readFileSync('/home/rpaezbas/Desktop/obj.pack'))
    const checksum = crypto.createHash('sha1').update(readFileSync('/home/rpaezbas/Desktop/obj.pack')).digest('hex')
    process.stdout.write(checksum + '\n')
    process.exit()
}

const crlfDelay = 30000

const main = async (args) => {
    rl = readline.createInterface({ input: process.stdin, crlfDelay })
    for await (const line of rl) {
        print("LINE", line)
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
        default:
            if (line.includes("done")) next(line)
            //process.exit()
        }
    }
}

print(argv)
main(argv)
