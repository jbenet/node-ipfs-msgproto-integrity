var transDuplex = require('duplex-transform')
var msgproto = require('msgproto')
var IntegrityFrame = require('./frame')

module.exports = IntegrityProtocol

IntegrityProtocol.Frame = IntegrityFrame

// integrity stream "wraps" (pipes) a duplex packet stream
// with integrity checksums + verification
function IntegrityProtocol(checksumFn, payloadType, stream) {
  return transDuplex.obj(wrap(checksumFn), stream, unwrap())
}

function wrap(checksumFn, payloadType) {
  checksumFn = Pkt.IntegrityFrame.coerceChecksumFn(checksumFn)
  return function(msg, enc, next) {
    this.push(IntegrityFrame(checksumFn, msg, payloadType))
    next()
  }
}

// acceptFns is a list of functions to accept as valid.
// if acceptFns is undefined, all functions in multihash accepted
function unwrap(acceptFns) {
  if (acceptFns)
    throw new Error('accepting specific functions not implemented yet')
  return function(msg, enc, next) {
    var err = msg.validate()
    if (err) {
      this.emit('invalid', { message: msg, error: err })
    } else {
      // ok, it's good. unwrap.
      this.push(integrity.getDecodedPayload())
    }
    next()
  }
}
