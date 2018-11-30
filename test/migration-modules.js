/* eslint-env mocha */
'use strict'
const rimraf = require('rimraf')
const path = require('path')
const fs = require('fs')
const assert = require('assert')
const migrate = require('..')
const db = require('./util/db')

const BASE = path.join(__dirname, 'fixtures', 'basic')
const STATE = path.join(BASE, '.migrate')

describe('migration modules', function () {
  var set

  function assertNoPets () {
    assert.equal(db.pets.length, 0)
  }

  function assertPets () {
    assert.equal(db.pets.length, 3)
    assert.equal(db.pets[0].name, 'tobi')
    assert.equal(db.pets[0].email, 'tobi@learnboost.com')
  }

  beforeEach(function (done) {
    fs.readdir(BASE, function (err, files) {
      if (err) throw err

      var migrations = files.map(function (file) {
        // Try to load the migrations file
        var mod = require(path.join(BASE, file))

        return {
          file,
          module: mod
        }
      })

      migrate.load({
        stateStore: STATE,
        migrations
      }, function (err, s) {
        set = s
        done(err)
      })
    })
  })

  it('should handle basic migration', function (done) {
    set.up(function (err) {
      assert.ifError(err)
      assertPets()
      set.up(function (err) {
        assert.ifError(err)
        assertPets()
        set.down(function (err) {
          assert.ifError(err)
          assertNoPets()
          set.down(function (err) {
            assert.ifError(err)
            assertNoPets()
            set.up(function (err) {
              assert.ifError(err)
              assertPets()
              done()
            })
          })
        })
      })
    })
  })

  afterEach(function (done) {
    db.nuke()
    rimraf(STATE, done)
  })
})
