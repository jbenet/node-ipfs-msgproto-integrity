var test = require('tape')
var map = require('lodash.map')
var bufeq = require('buffer-equal')
var through2 = require('through2')
var multiDgrams = require('multi-dgram-stream')
var msgproto = require('msgproto')
var mpIntegrity = require('./')

function setupStreams(addrs) {
  addrs = map(addrs, function(a) {
    return 'localhost:' + a
  })

  return map(addrs, function (addr) {
    var wire = multiDgrams(addr, addrs)
    var wproto = mpIntegrity.Protocol()
    wire.pipe(wproto.frames).pipe(wire) // wire up.. the wire.
    return wproto
  })
}


test('test send', function(t) {
  var numMessages = 10
  t.plan(numMessages * 4 + 1)

  var sent = {}
  var segments = setupStreams([1234, 2345, 3456])
  map(segments, function(s) {
    s.payloads.on('data', function(msg) {
      t.ok(sent[msg], 'should receive msg: ' + msg)
      sent[msg].push(s)

      if (sent[msg].length == segments.length) { // all got it.
        delete sent[msg]
        t.ok(!sent[msg], 'should be done with msg: ' + msg)
      }

      if (Object.keys(sent).length == 0) { // all done
        map(segments, function(s) {
          s.payloads.write(null)
          s.payloads.end() // why doesn't this work!?
        })
        t.ok(true, 'should be done')
      }
    })
  })

  for (var i = 0; i < numMessages; i++) {
    var msg = new Buffer('hello there #' + i)
    sent[msg] = [] // expect things.
    var sender = segments[(i + 1) % segments.length]
    sender.payloads.write(msg)
    console.log('sent: ' + msg)
  }
})

function setupCorruptStreams(addrs) {
  addrs = map(addrs, function(a) {
    return 'localhost:' + a
  })

  return map(addrs, function (addr) {
    var wire = multiDgrams(addr, addrs)
    var wproto = mpIntegrity.Protocol()
    // wire up... the wire.
    wire.pipe(corrupt(0.5)).pipe(wproto.frames)
        .pipe(corrupt(0.5)).pipe(wire)
    return wproto
  })
}


test('test send with corruption', function(t) {
  var numMessages = 100
  t.plan(numMessages * 3 + 1)

  var count = 0
  var received = function() {
    count++
    if (count != (numMessages * 3))
      return

    map(streams, function(s) {
      s.payloads.write(null)
      s.payloads.end() // why doesn't s.end() work!?
    })
    t.ok(true, 'should be done')
  }

  var streams = setupCorruptStreams([1234, 2345, 3456])
  map(streams, function(s) {
    s.payloads.on('data', function(msg) {
      msg = msg.toString()
      t.ok(msg.indexOf('hello there #') == 0, 'received ok: ' + msg)
      received()
    })

    s.filtered.on('data', function(msg) {
      t.ok(!msg.validChecksum(), 'checksum should not check out: ' + msg.payload)
      received()
    })
  })

  for (var i = 0; i < numMessages; i++) {
    var msg = new Buffer('hello there #' + i)
    var sender = streams[(i + 1) % streams.length]
    sender.payloads.write(msg)
    console.log('sent: ' + msg)
  }
})

function corrupt(probability) {
  return through2.obj(function(data, enc, next) {
    if (Math.random() <= probability)
      data[data.length - 3] = ~data[data.length - 3]
    this.push(data)
    next()
  })
}
