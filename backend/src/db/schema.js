const { ObjectId } = require("./objectId");

const Mixed = { _pgMixed: true };

function isConstructorType(value) {
  return (
    value === String ||
    value === Number ||
    value === Boolean ||
    value === Date ||
    value === ObjectId ||
    value === Mixed ||
    value === Object
  );
}

function isFieldDescriptor(spec) {
  if (spec == null) return false;
  if (isConstructorType(spec)) return true;
  if (Array.isArray(spec)) return true;
  if (spec instanceof Schema) return true;
  if (typeof spec !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(spec, "type") && isTypeValue(spec.type)) {
    return true;
  }
  return false;
}

function isTypeValue(type) {
  if (isConstructorType(type)) return true;
  if (Array.isArray(type)) return true;
  if (type instanceof Schema) return true;
  return false;
}

function unwrapType(spec) {
  if (isConstructorType(spec) || Array.isArray(spec) || spec instanceof Schema) {
    return spec;
  }
  return spec.type;
}

function classify(spec) {
  const type = unwrapType(spec);
  if (type === String) return "string";
  if (type === Number) return "number";
  if (type === Boolean) return "boolean";
  if (type === Date) return "date";
  if (type === ObjectId) return "objectId";
  if (type === Mixed || type === Object) return "mixed";
  if (Array.isArray(type) || Array.isArray(spec)) return "array";
  if (type instanceof Schema) return "array";
  return "mixed";
}

function pgTypeFor(name, spec) {
  const kind = classify(spec);
  if (kind === "objectId") return "VARCHAR(24)";
  if (kind === "boolean") return "BOOLEAN";
  if (kind === "date") return "TIMESTAMPTZ";
  if (kind === "string") return "TEXT";
  if (kind === "number") {
    if (/lat|lng|long|accuracy|heading|speed/i.test(name)) return "DOUBLE PRECISION";
    if (/amount|price|fee|emi|due|outstanding|rating/i.test(name)) return "NUMERIC";
    return "INTEGER";
  }
  return "JSONB";
}

function schemaDefault(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec) || isConstructorType(spec)) {
    if (Array.isArray(spec)) return [];
    return undefined;
  }
  if (!Object.prototype.hasOwnProperty.call(spec, "default")) return undefined;
  return spec.default;
}

class Schema {
  constructor(definition = {}, options = {}) {
    this.definition = definition;
    this.options = options;
    this._indexes = [];
    this.paths = {};
    this.objectIdPaths = new Set(["_id"]);
    this.selectFalse = new Set();
    this.jsonbPaths = new Set();
      this.arrayPaths = new Set();
      this.subdocArrayPaths = new Set();
      this.subdocAutoIdPaths = new Set();
    this.stringPaths = new Set();
    this.numberPaths = new Set();
    this.booleanPaths = new Set();
    this.datePaths = new Set();
    this.transforms = {};

    for (const [name, spec] of Object.entries(definition)) {
      this.paths[name] = spec;
      const kind = isFieldDescriptor(spec) ? classify(spec) : "mixed";
      if (kind === "objectId") this.objectIdPaths.add(name);
      if (kind === "string") this.stringPaths.add(name);
      if (kind === "number") this.numberPaths.add(name);
      if (kind === "boolean") this.booleanPaths.add(name);
      if (kind === "date") this.datePaths.add(name);
      if (kind === "array" || kind === "mixed") this.jsonbPaths.add(name);
      if (kind === "array") this.arrayPaths.add(name);
      if (kind === "mixed" && !isFieldDescriptor(spec)) this.jsonbPaths.add(name);

      if (kind === "array") {
        const inner = Array.isArray(spec) ? spec[0] : spec?.type?.[0] || spec?.type;
        if (inner instanceof Schema) {
          this.subdocArrayPaths.add(name);
          if (inner.options && inner.options._id !== false) this.subdocAutoIdPaths.add(name);
        } else if (
          inner &&
          typeof inner === "object" &&
          !isConstructorType(inner) &&
          inner.type !== String
        ) {
          this.subdocArrayPaths.add(name);
          this.subdocAutoIdPaths.add(name);
        }
      }

      if (spec && typeof spec === "object" && spec.select === false) {
        this.selectFalse.add(name);
      }

      if (spec && typeof spec === "object") {
        this.transforms[name] = {
          trim: !!spec.trim,
          lowercase: !!spec.lowercase,
          uppercase: !!spec.uppercase,
          required: !!spec.required,
          enum: spec.enum,
          unique: !!spec.unique,
          sparse: !!spec.sparse,
          ref: spec.ref || null,
          default: spec.default,
        };
      }
    }

    if (options.timestamps) {
      this.datePaths.add("createdAt");
      this.datePaths.add("updatedAt");
    }
  }

  index(fields, options = {}) {
    this._indexes.push({ fields, options });
    return this;
  }
}

Schema.Types = {
  ObjectId,
  Mixed,
  String,
  Number,
  Boolean,
  Date,
};

module.exports = {
  Schema,
  Mixed,
  isFieldDescriptor,
  classify,
  pgTypeFor,
  schemaDefault,
  unwrapType,
};
