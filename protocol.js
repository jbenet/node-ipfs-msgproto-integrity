var transDuplex = require('duplex-transform')
var msgproto = require('msgproto')
var IntegrityFrame = require('./frame')

module.exports = IntegrityProtocol

IntegrityProtocol.Frame = IntegrityFrame
IntegrityProtocol.Corrupt = require('./corrupt')

// integrity stream "wraps" (pipes) a duplex packet stream
// with integrity checksums + verification
function IntegrityProtocol(checksumFn, payloadType, stream) {
  checksumFn = IntegrityFrame.coerceChecksumFn(checksumFn)
  return transDuplex.obj(wrap, stream, unwrap)

  function wrap(msg, enc, next) {
    this.push(IntegrityFrame(checksumFn, msg, payloadType))
    next()
  }

  // acceptFns is a list of functions to accept as valid.
  // if acceptFns is undefined, all functions in multihash accepted
  function unwrap(msg, enc, next) {
    msg.payloadType = msg.payloadType || payloadType

    var err = undefined
    try {
      err = msg.validate()
    } catch (e) {
      err = e
    }

    if (err) {
      this.emit('invalid', { message: msg, error: err })
    } else {
      // ok, it's good. unwrap.
      this.push(msg.getDecodedPayload())
    }
    next()
  }
}
