'use strict'

var path = require('path')
var fs = require('fs')
var Migration = require('./migration')

module.exports = loadMigrationsIntoSet

function loadMigrationsIntoSet (options, fn) {
  // Process options, set and store are required, rest optional
  var opts = options || {}
  if (!opts.set || !opts.store) {
    throw new TypeError((opts.set ? 'store' : 'set') + ' is required for loading migrations')
  }
  var set = opts.set
  var store = opts.store
  var migrationsDirectory = path.resolve(opts.migrationsDirectory || 'migrations')
  var filterFn = opts.filterFunction || (() => true)

  // Load from migrations store first up
  store.load(function (err, state) {
    if (err) return fn(err)

    // Set last run date on the set
    set.lastRun = state.lastRun || null

    if (opts.migrations) {
      processMigrations(opts.migrations, state, opts, fn)
    } else {
      // Read migrations directory
      fs.readdir(migrationsDirectory, function (err, files) {
        if (err) return fn(err)

        // Filter out non-matching files
        files = files.filter(filterFn)

        var migrations = files.map(function (file) {
          // Try to load the migrations file
          var mod
          try {
            mod = require(path.join(migrationsDirectory, file))
          } catch (e) {
            return fn(e)
          }

          return {
            file,
            module: mod
          }
        })

        processMigrations(migrations, state, opts, fn)
      })
    }
  })
}

function processMigrations (migrations, state, opts, fn) {
  var set = opts.set
  var ignoreMissing = !!opts.ignoreMissing
  var sortFn = opts.sortFunction || function (m1, m2) {
    return m1.title > m2.title ? 1 : (m1.title < m2.title ? -1 : 0)
  }

  // Create migrations, keep a lookup map for the next step
  var migMap = {}
  migrations = migrations.map(function (migration) {
    var file = migration.file
    var mod = migration.module
    var mig = new Migration(file, mod.up, mod.down, mod.description)
    migMap[file] = mig
    return mig
  })

  // Fill in timestamp from state, or error if missing
  state.migrations && state.migrations.forEach(function (m) {
    if (m.timestamp !== null && !migMap[m.title]) {
      return ignoreMissing ? null : fn(new Error('Missing mig file: ' + m.title))
    } else if (!migMap[m.title]) {
      // Migration existed in state file, but was not run and not loadable
      return
    }
    migMap[m.title].timestamp = m.timestamp
  })

  // Sort the migrations by their title
  migrations = migrations.sort(sortFn)

  // Add the migrations to the set
  migrations.forEach(set.addMigration.bind(set))

  // Successfully loaded
  fn()
}
