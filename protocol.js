var extend = require('xtend')
var segment = require('pipe-segment')
var through2 = require('through2')
var msgproto = require('msgproto')
var duplexer2 = require('duplexer2.jbenet')
var filterSegment = require('pipe-segment-filter')
var IntegrityFrame = require('./frame')

module.exports = IntegrityProtocol

//  raw   ----------- wrap -------wire--->  cksum
//  side  <--- unwrap --- check --wire--->  side
function IntegrityProtocol(opts) {

  // default opts
  opts = extend(IntegrityProtocol.defaults, (opts || {}))

  // if (!opts.payloadType)
  //   throw new Error('requires opts.payloadType')

  // coerce might throw:
  opts.checksumFn = IntegrityFrame.coerceChecksumFn(opts.checksumFn)

  var wire = msgproto.WireProtocol(IntegrityFrame)
  var wrap = integrityWrap(opts)
  var unwrap = integrityUnwrap()
  var check = checkSegment()

  // wire up the pipes
  wrap.pipe(wire.messages).pipe(check.input)
  check.output.pipe(unwrap)

  // expose interfaces
  return segment({
    wire: wire, // expose wire, for packing errors
    frames: wire.buffers,
    filtered: check.filtered,
    payloads: duplexer2({objectMode: true}, wrap, unwrap),
  })
}

IntegrityProtocol.defaults = {
  checksumFn: 'sha1',
}

function integrityWrap(opts) {
  return through2.obj(wrap)

  function wrap(buf, enc, next) {
    msg = IntegrityFrame(opts.checksumFn, buf, opts.payloadType)
    this.push(msg)
    next()
  }
}

function integrityUnwrap() {
  return through2.obj(unwrap)

  function unwrap(msg, enc, next) {
    this.push(msg.getEncodedPayload())
    next()
  }
}

function checkSegment() {
  return filterSegment(cksumCheck)

  function cksumCheck(msg) {
    console.log('checking ' + msg)
    return !msg.validate()
  }
}
