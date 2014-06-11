var extend = require('xtend')
var transDuplex = require('duplex-transform')
var msgproto = require('msgproto')
var IntegrityFrame = require('./frame')

module.exports = IntegrityProtocol

// integrity stream "wraps" (pipes) a duplex packet stream
// with integrity checksums + verification
function IntegrityProtocol(stream, opts) {
  // default opts
  opts = extend(IntegrityProtocol.defaults, (opts || {}))

  if (!opts.payloadType)
    throw new Error('requires opts.payloadType')

  // coerce might throw:
  opts.checksumFn = IntegrityFrame.coerceChecksumFn(opts.checksumFn)

  return transDuplex.obj(wrap, stream, unwrap)

  function wrap(msg, enc, next) {
    if (opts.wrap) {
      msg = IntegrityFrame(opts.checksumFn, msg, opts.payloadType)
    }
    else if (!(msg instanceof IntegrityFrame)) {
      var err = new Error('wrote non-integrity message with wrap = false')
      this.emit('error', err)
      return next()
    }

    this.push(msg)
    next()
  }

  // acceptFns is a list of functions to accept as valid.
  // if acceptFns is undefined, all functions in multihash accepted
  function unwrap(msg, enc, next) {
    msg.payloadType = msg.payloadType || opts.payloadType

    err = msg.validate()
    if (err) {
      this.emit('invalid', { message: msg, error: err })
      return next()
    }

    if (opts.unwrap) {
      msg = msg.getDecodedPayload()
    }

    this.push(msg)
    next()
  }
}

IntegrityProtocol.defaults = {
  checksumFn: 'sha1',
  unwrap: true,
  wrap: true,
}
