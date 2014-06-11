var fs = require('fs')
var bufeq = require('buffer-equal')
var multihash = require('multihashes')
var multihashing = require('multihashing')
var msgproto = require('msgproto')
var Frame = msgproto.Frame

module.exports = IntegrityFrame

function IntegrityFrame(checksumFn, payload, payloadType) {
  if (!(this instanceof IntegrityFrame))
    return new IntegrityFrame(checksumFn, payload, payloadType)

  Frame.call(this, payload, payloadType)
  this.checksumFn = checksumFn && IntegrityFrame.coerceChecksumFn(checksumFn)
}

msgproto.Message.inherits(IntegrityFrame, Frame)

IntegrityFrame.coerceChecksumFn = function(checksumFn) {
  return multihash.coerceCode(checksumFn)
  // will throw if not valid func. programmer error
}

IntegrityFrame.prototype.calculateChecksum = function() {
  if (!this.checksumFn)
    throw new Error('no checksum function.')

  var payload = this.getEncodedPayload()
  return multihashing(payload, this.checksumFn)
}

IntegrityFrame.prototype.validateChecksum = function() {
  if (!this.checksum)
    return new Error("no checksum");

  // fill in checksumFn if we have a checksum.
  if (!this.checksumFn) {
    try {
      this.checksumFn = multihash.decode(this.checksum).code
    } catch (e) {
      return e
    }
  }

  var sum = this.calculateChecksum()
  if (!bufeq(this.checksum, sum))
    return new Error("checksum incorrect. "
      + "expected: " + sum.toString('hex') +
      ", got: " + this.checksum.toString('hex'))
}

IntegrityFrame.prototype.validChecksum = function() {
  return !this.validateChecksum()
}

IntegrityFrame.prototype.validate = function() {
  var err = Frame.prototype.validate.apply(this)
  if (err) return err

  return this.validateChecksum()
}

IntegrityFrame.prototype.getEncodedData = function() {
  var data = Frame.prototype.getEncodedData.apply(this)
  // if no checksum, calculate it. else trust it.
  // (should call validate if you cant trust it.)
  this.checksum = this.checksum || this.calculateChecksum()
  data.checksum = {hash: this.checksum}
  return data
}

IntegrityFrame.prototype.setDecodedData = function(data) {
  Frame.prototype.setDecodedData.apply(this, arguments)
  this.checksum = data.checksum.hash
  // this.checksumFn will be set when we validate.
}

IntegrityFrame.prototype.toString = function() {
  var ok = (this.validateChecksum() == undefined) ? 'ok' : 'fail';
  var hash = (this.checksum || new Buffer(0)).toString('hex').substr(0, 6)
  var fn = this.checksumFn
  return "<IntegrityFrame 0x"+fn+" "+hash+" "+ok+">"
}

var src = fs.readFileSync(__dirname + '/integrity.proto', 'utf-8')
var protos = msgproto.ProtobufCodec.fromProtoSrc(src)
IntegrityFrame.codec = protos.IntegrityFrame
