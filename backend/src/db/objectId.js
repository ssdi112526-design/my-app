const crypto = require("crypto");

const HEX24 = /^[a-fA-F0-9]{24}$/;

function generateHex() {
  const time = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, "0");
  return time + crypto.randomBytes(8).toString("hex");
}

class ObjectId {
  constructor(id) {
    if (id instanceof ObjectId) {
      this.id = id.id;
      return;
    }
    if (id == null || id === "") {
      this.id = generateHex();
      return;
    }
    const value = String(id);
    this.id = HEX24.test(value) ? value.toLowerCase() : value;
  }

  toString() {
    return this.id;
  }

  toJSON() {
    return this.id;
  }

  valueOf() {
    return this.id;
  }

  inspect() {
    return `ObjectId("${this.id}")`;
  }

  equals(other) {
    if (other == null) return false;
    return String(this) === String(other);
  }

  static isValid(value) {
    if (value instanceof ObjectId) return HEX24.test(value.id);
    if (value == null) return false;
    return HEX24.test(String(value));
  }

  static createFromHexString(hex) {
    return new ObjectId(hex);
  }
}

module.exports = { ObjectId, generateHex, HEX24 };
