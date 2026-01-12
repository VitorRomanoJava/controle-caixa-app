#!/usr/bin/env node

const cli = require('@tauri-apps/cli-win32-x64-msvc')
const path = require('path')

const [bin, script, ...args] = process.argv
const binStem = path.parse(bin).name.toLowerCase()

let binName

if (globalThis.navigator?.userAgent?.includes('Deno')) {
  binName = bin
} else if (binStem.match(/(nodejs|node|bun)\-?([0-9]*)*$/g)) {
  const managerStem = process.env.npm_execpath
    ? path.parse(process.env.npm_execpath).name.toLowerCase()
    : null
  if (managerStem) {
    let manager
    switch (managerStem) {
      case 'npm-cli':
        manager = 'npm'
        break
      default:
        manager = managerStem
        break
    }

    binName = `${manager} run ${process.env.npm_lifecycle_event}`
  } else {
    const scriptNormal = path.normalize(path.relative(process.cwd(), script))
    binName = `${binStem} ${scriptNormal}`
  }
} else {
  args.unshift(bin)
}

cli.run(args, binName, (error) => {
  if (error) {
    cli.logError(error.message ?? String(error))
    process.exit(1)
  }
})
