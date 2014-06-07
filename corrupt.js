var transDuplex = require('duplex-transform')
var shuffle = require('shuffle-buffer')

// returns a stream wrapping an integrity WireProtocol
// that corrupts packets with a certain probability.
module.exports = function CorruptWire(probability, integrityWire) {
  return transDuplex.obj(corruptChecksum, integrityWire, corruptPayload)

  function corruptChecksum(msg, enc, next) {
    if (Math.random() < (probability / 2.0)) {
      msg.checksum = msg.calculateChecksum()
      msg.checksum = shuffle(msg.checksum)
    }
    this.push(msg)
    next()
  }

  function corruptPayload(msg, enc, next) {
    if (Math.random() < (probability / 2.0))
      msg.payload = shuffle(msg.payload)
    this.push(msg)
    next()
  }
}
