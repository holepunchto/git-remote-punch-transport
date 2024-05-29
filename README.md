# Git-Remote-Punch transport

Git remote helper for hyperswarm git transport.

``` bash
npm install -g https://github.com/holepunchto/git-remote-punch-transport
git clone punch://public-key:repository
```

## Server

The client of this remote helper depends on the repository server running git-punch-server. This server is responsible for packet negotiation and Git daemon forwarding.

To start the server, run:

To start the server run:

``` bash
  git-punch-server start [--seed=<key-pair-seed>] [--bootstrap=<bootstrap-url>] [--basedir=<directory>]
  # Listening on key: 3f9b09e0831b13e755d4b0af079a5b56f38efed122d561af5069e1e35cf2a1c2

```

## Example

``` bash
  npm install -g https://github.com/holepunchto/git-remote-punch-transport
  cd /tmp
  mkdir test-repository
  cd test-repository
  git init --bare
  touch git-daemon-export-ok
  git-punch-server start --basedir=/tmp
  # Listening on key: <public-key>
  git clone punch://<public-key>/test-repository
```

