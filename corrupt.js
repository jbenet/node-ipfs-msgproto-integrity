var extend = require('xtend')
var transDuplex = require('duplex-transform')
var shuffle = require('shuffle-buffer')

// returns a stream wrapping an integrity WireProtocol
// that corrupts packets with a certain probability.
module.exports = function CorruptWire(integrityWire, opts) {
  opts = extend({probability: 0.5}, opts || {})
  return transDuplex.obj(corruptChecksum, integrityWire, corruptPayload)

  function corruptChecksum(msg, enc, next) {
    if (Math.random() < (opts.probability / 2.0)) {
      msg.checksum = msg.calculateChecksum()
      msg.checksum = shuffle(msg.checksum)
    }
    this.push(msg)
    next()
  }

  function corruptPayload(msg, enc, next) {
    if (Math.random() < (opts.probability / 2.0))
      msg.payload = shuffle(msg.payload)
    this.push(msg)
    next()
  }
}
