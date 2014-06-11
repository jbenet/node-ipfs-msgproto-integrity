var test = require('tape')
var map = require('lodash.map')
var bufeq = require('buffer-equal')
var multiDgrams = require('multi-dgram-stream')
var msgproto = require('msgproto')
var mpIntegrity = require('./')

function setupStreams(addrs) {
  addrs = map(addrs, function(a) {
    return 'localhost:' + a
  })

  return map(addrs, function (addr) {
    var wire = multiDgrams(addr, addrs)
    wire = msgproto.WireProtocol(mpIntegrity.Frame, wire)
    wire = mpIntegrity.Protocol(wire, {payloadType: Buffer})
    return wire
  })
}


test('test send', function(t) {
  var numMessages = 10
  t.plan(numMessages * 4 + 1)

  var sent = {}
  var streams = setupStreams([1234, 2345, 3456])
  map(streams, function(s) {
    s.on('data', function(msg) {
      t.ok(sent[msg], 'should receive msg: ' + msg)
      sent[msg].push(s)

      if (sent[msg].length == streams.length) { // all got it.
        delete sent[msg]
        t.ok(!sent[msg], 'should be done with msg: ' + msg)
      }

      if (Object.keys(sent).length == 0) { // all done
        map(streams, function(s) {
          s.write(null)
          s.middle.end() // why doesn't s.end() work!?
        })
        t.ok(true, 'should be done')
      }
    })
  })

  for (var i = 0; i < numMessages; i++) {
    var msg = new Buffer('hello there #' + i)
    sent[msg] = [] // expect things.
    var sender = streams[(i + 1) % streams.length]
    sender.write(msg)
    console.log('sent: ' + msg)
  }
})

function setupCorruptStreams(addrs) {
  addrs = map(addrs, function(a) {
    return 'localhost:' + a
  })

  return map(addrs, function (addr) {
    var wire = multiDgrams(addr, addrs)
    wire = msgproto.WireProtocol(mpIntegrity.Frame, wire)
    wire = mpIntegrity.CorruptProtocol(wire, {probability: 0.3})
    wire = mpIntegrity.Protocol(wire, {payloadType: Buffer, unwrap: false})
    return wire
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
      s.write(null)
      s.middle.end() // why doesn't s.end() work!?
    })
    t.ok(true, 'should be done')
  }

  var streams = setupCorruptStreams([1234, 2345, 3456])
  map(streams, function(s) {
    s.on('data', function(msg) {
      t.ok(msg.validChecksum(), 'checksum should check out: ' + msg.payload)
      received()
    })

    s.incoming.on('invalid', function(msg) {
      msg = msg.message
      t.ok(!msg.validChecksum(), 'checksum should not check out: ' + msg.payload)
      received()
    })
  })

  for (var i = 0; i < numMessages; i++) {
    var msg = new Buffer('hello there #' + i)
    var sender = streams[(i + 1) % streams.length]
    sender.write(msg)
    console.log('sent: ' + msg)
  }
})

