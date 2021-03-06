#!/usr/bin/env node
'use strict'

var readFile = require('fs').readFileSync

var abbrev = require('abbrev')
var minimist = require('minimist')

var efh = require('../lib/error').standard

var argv = minimist(process.argv.slice(2), {
  alias: {
    d: 'debug',
    dry: 'debug',
    t: 'token',
    g: 'github-url'
  },
  booleans: ['debug'],
  default: {
    debug: !process.env.CI,
    token: process.env.GH_TOKEN || process.env.TOKEN || process.env.GITHUB_TOKEN,
    'github-url': process.env.GH_URL
  }
})

var plugins = JSON.parse(readFile('./package.json')).release || {}

var npmArgv = process.env.npm_config_argv ?
  minimist(JSON.parse(process.env.npm_config_argv).cooked) :
  {_: []}

if (~argv._.indexOf('pre')) {
  // see src/restart.js
  if (npmArgv['semantic-release-rerun']) {
    if (!/semantically-released/.test(process.env.npm_package_version)) process.exit(0)

    console.log('There is something wrong with your setup, as a placeholder version is about to be released.')
    console.log('Please verify that your setup is correct.')
    console.log('If you think this is a problem with semantic-release please open an issue.')
    process.exit(1)
  }
  // the `prepublish` hook is also executed when the package is installed
  // in this case we abort the command and do nothing.
  if (
    isAbbrev(npmArgv, 'install') ||
    isAbbrev(npmArgv, 'link') ||
    isAbbrev(npmArgv, 'pack')
  ) process.exit(0)

  if (argv.debug) console.log('This is a dry run')

  console.log('Determining new version')

  var publish = false
  if (isAbbrev(npmArgv, 'publish')) publish = true

  // require a correct setup during publish
  if (publish && !argv.debug && !require('../src/verify')(argv)) process.exit(1)

  require('../src/pre')(argv, plugins, efh(function (result) {
    if (!result) {
      console.log('Nothing changed. Not publishing.')
      process.exit(1)
    }

    console.log('Publishing v' + result)
    if (!publish) process.exit(0)

    if (argv.debug) process.exit(1)

    require('../src/restart')(efh(function () {
      process.exit(1)
    }))
  }))
}

if (~argv._.indexOf('post')) {
  require('../src/post')(argv, plugins, efh(function () {
    // see src/restart.js
    if (npmArgv['semantic-release-rerun']) {
      console.log('Everything is alright :) npm will now print an error message that you can safely ignore.')
    }
  }))
}

if (~argv._.indexOf('setup')) {
  require('../src/setup')()
  console.log('"package.json" is set up properly. Now configure your CI server.')
  console.log('https://github.com/boennemann/semantic-release#ci-server')
}

function isAbbrev (argv, command) {
  return argv._.some(Object.prototype.hasOwnProperty.bind(abbrev(command)))
}
