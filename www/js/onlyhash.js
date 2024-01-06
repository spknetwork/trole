(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }
    g.Hash = f();
  }
})(function () {
  var define, module, exports;
  return (function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = "function" == typeof require && require;
            if (!f && c) return c(i, !0);
            if (u) return u(i, !0);
            var a = new Error("Cannot find module '" + i + "'");
            throw ((a.code = "MODULE_NOT_FOUND"), a);
          }
          var p = (n[i] = { exports: {} });
          e[i][0].call(
            p.exports,
            function (r) {
              var n = e[i][1][r];
              return o(n || r);
            },
            p,
            p.exports,
            r,
            e,
            n,
            t
          );
        }
        return n[i].exports;
      }
      for (
        var u = "function" == typeof require && require, i = 0;
        i < t.length;
        i++
      )
        o(t[i]);
      return o;
    }
    return r;
  })()(
    {
      1: [
        function (require, module, exports) {
          const Hash = require("ipfs-only-hash");
          module.exports = Hash;
        },
        { "ipfs-only-hash": 34 },
      ],
      2: [
        function (require, module, exports) {
          "use strict";

          // Runtime header offsets
          const ID_OFFSET = -8;
          const SIZE_OFFSET = -4;

          // Runtime ids
          const ARRAYBUFFER_ID = 0;
          const STRING_ID = 1;
          const ARRAYBUFFERVIEW_ID = 2;

          // Runtime type information
          const ARRAYBUFFERVIEW = 1 << 0;
          const ARRAY = 1 << 1;
          const SET = 1 << 2;
          const MAP = 1 << 3;
          const VAL_ALIGN_OFFSET = 5;
          const VAL_ALIGN = 1 << VAL_ALIGN_OFFSET;
          const VAL_SIGNED = 1 << 10;
          const VAL_FLOAT = 1 << 11;
          const VAL_NULLABLE = 1 << 12;
          const VAL_MANAGED = 1 << 13;
          const KEY_ALIGN_OFFSET = 14;
          const KEY_ALIGN = 1 << KEY_ALIGN_OFFSET;
          const KEY_SIGNED = 1 << 19;
          const KEY_FLOAT = 1 << 20;
          const KEY_NULLABLE = 1 << 21;
          const KEY_MANAGED = 1 << 22;

          // Array(BufferView) layout
          const ARRAYBUFFERVIEW_BUFFER_OFFSET = 0;
          const ARRAYBUFFERVIEW_DATASTART_OFFSET = 4;
          const ARRAYBUFFERVIEW_DATALENGTH_OFFSET = 8;
          const ARRAYBUFFERVIEW_SIZE = 12;
          const ARRAY_LENGTH_OFFSET = 12;
          const ARRAY_SIZE = 16;

          const BIGINT = typeof BigUint64Array !== "undefined";
          const THIS = Symbol();
          const CHUNKSIZE = 1024;

          /** Gets a string from an U32 and an U16 view on a memory. */
          function getStringImpl(buffer, ptr) {
            const U32 = new Uint32Array(buffer);
            const U16 = new Uint16Array(buffer);
            var length = U32[(ptr + SIZE_OFFSET) >>> 2] >>> 1;
            var offset = ptr >>> 1;
            if (length <= CHUNKSIZE)
              return String.fromCharCode.apply(
                String,
                U16.subarray(offset, offset + length)
              );
            const parts = [];
            do {
              const last = U16[offset + CHUNKSIZE - 1];
              const size =
                last >= 0xd800 && last < 0xdc00 ? CHUNKSIZE - 1 : CHUNKSIZE;
              parts.push(
                String.fromCharCode.apply(
                  String,
                  U16.subarray(offset, (offset += size))
                )
              );
              length -= size;
            } while (length > CHUNKSIZE);
            return (
              parts.join("") +
              String.fromCharCode.apply(
                String,
                U16.subarray(offset, offset + length)
              )
            );
          }

          /** Prepares the base module prior to instantiation. */
          function preInstantiate(imports) {
            const baseModule = {};

            function getString(memory, ptr) {
              if (!memory) return "<yet unknown>";
              return getStringImpl(memory.buffer, ptr);
            }

            // add common imports used by stdlib for convenience
            const env = (imports.env = imports.env || {});
            env.abort =
              env.abort ||
              function abort(mesg, file, line, colm) {
                const memory = baseModule.memory || env.memory; // prefer exported, otherwise try imported
                throw Error(
                  "abort: " +
                    getString(memory, mesg) +
                    " at " +
                    getString(memory, file) +
                    ":" +
                    line +
                    ":" +
                    colm
                );
              };
            env.trace =
              env.trace ||
              function trace(mesg, n) {
                const memory = baseModule.memory || env.memory;
                console.log(
                  "trace: " +
                    getString(memory, mesg) +
                    (n ? " " : "") +
                    Array.prototype.slice.call(arguments, 2, 2 + n).join(", ")
                );
              };
            imports.Math = imports.Math || Math;
            imports.Date = imports.Date || Date;

            return baseModule;
          }

          /** Prepares the final module once instantiation is complete. */
          function postInstantiate(baseModule, instance) {
            const rawExports = instance.exports;
            const memory = rawExports.memory;
            const table = rawExports.table;
            const alloc = rawExports["__alloc"];
            const retain = rawExports["__retain"];
            const rttiBase = rawExports["__rtti_base"] || ~0; // oob if not present

            /** Gets the runtime type info for the given id. */
            function getInfo(id) {
              const U32 = new Uint32Array(memory.buffer);
              const count = U32[rttiBase >>> 2];
              if ((id >>>= 0) >= count) throw Error("invalid id: " + id);
              return U32[((rttiBase + 4) >>> 2) + id * 2];
            }

            /** Gets the runtime base id for the given id. */
            function getBase(id) {
              const U32 = new Uint32Array(memory.buffer);
              const count = U32[rttiBase >>> 2];
              if ((id >>>= 0) >= count) throw Error("invalid id: " + id);
              return U32[((rttiBase + 4) >>> 2) + id * 2 + 1];
            }

            /** Gets the runtime alignment of a collection's values. */
            function getValueAlign(info) {
              return 31 - Math.clz32((info >>> VAL_ALIGN_OFFSET) & 31); // -1 if none
            }

            /** Gets the runtime alignment of a collection's keys. */
            function getKeyAlign(info) {
              return 31 - Math.clz32((info >>> KEY_ALIGN_OFFSET) & 31); // -1 if none
            }

            /** Allocates a new string in the module's memory and returns its retained pointer. */
            function __allocString(str) {
              const length = str.length;
              const ptr = alloc(length << 1, STRING_ID);
              const U16 = new Uint16Array(memory.buffer);
              for (var i = 0, p = ptr >>> 1; i < length; ++i)
                U16[p + i] = str.charCodeAt(i);
              return ptr;
            }

            baseModule.__allocString = __allocString;

            /** Reads a string from the module's memory by its pointer. */
            function __getString(ptr) {
              const buffer = memory.buffer;
              const id = new Uint32Array(buffer)[(ptr + ID_OFFSET) >>> 2];
              if (id !== STRING_ID) throw Error("not a string: " + ptr);
              return getStringImpl(buffer, ptr);
            }

            baseModule.__getString = __getString;

            /** Gets the view matching the specified alignment, signedness and floatness. */
            function getView(alignLog2, signed, float) {
              const buffer = memory.buffer;
              if (float) {
                switch (alignLog2) {
                  case 2:
                    return new Float32Array(buffer);
                  case 3:
                    return new Float64Array(buffer);
                }
              } else {
                switch (alignLog2) {
                  case 0:
                    return new (signed ? Int8Array : Uint8Array)(buffer);
                  case 1:
                    return new (signed ? Int16Array : Uint16Array)(buffer);
                  case 2:
                    return new (signed ? Int32Array : Uint32Array)(buffer);
                  case 3:
                    return new (signed ? BigInt64Array : BigUint64Array)(
                      buffer
                    );
                }
              }
              throw Error("unsupported align: " + alignLog2);
            }

            /** Allocates a new array in the module's memory and returns its retained pointer. */
            function __allocArray(id, values) {
              const info = getInfo(id);
              if (!(info & (ARRAYBUFFERVIEW | ARRAY)))
                throw Error("not an array: " + id + " @ " + info);
              const align = getValueAlign(info);
              const length = values.length;
              const buf = alloc(length << align, ARRAYBUFFER_ID);
              const arr = alloc(
                info & ARRAY ? ARRAY_SIZE : ARRAYBUFFERVIEW_SIZE,
                id
              );
              const U32 = new Uint32Array(memory.buffer);
              U32[(arr + ARRAYBUFFERVIEW_BUFFER_OFFSET) >>> 2] = retain(buf);
              U32[(arr + ARRAYBUFFERVIEW_DATASTART_OFFSET) >>> 2] = buf;
              U32[(arr + ARRAYBUFFERVIEW_DATALENGTH_OFFSET) >>> 2] =
                length << align;
              if (info & ARRAY) U32[(arr + ARRAY_LENGTH_OFFSET) >>> 2] = length;
              const view = getView(align, info & VAL_SIGNED, info & VAL_FLOAT);
              if (info & VAL_MANAGED) {
                for (let i = 0; i < length; ++i)
                  view[(buf >>> align) + i] = retain(values[i]);
              } else {
                view.set(values, buf >>> align);
              }
              return arr;
            }

            baseModule.__allocArray = __allocArray;

            /** Gets a live view on an array's values in the module's memory. Infers the array type from RTTI. */
            function __getArrayView(arr) {
              const U32 = new Uint32Array(memory.buffer);
              const id = U32[(arr + ID_OFFSET) >>> 2];
              const info = getInfo(id);
              if (!(info & ARRAYBUFFERVIEW)) throw Error("not an array: " + id);
              const align = getValueAlign(info);
              var buf = U32[(arr + ARRAYBUFFERVIEW_DATASTART_OFFSET) >>> 2];
              const length =
                info & ARRAY
                  ? U32[(arr + ARRAY_LENGTH_OFFSET) >>> 2]
                  : U32[(buf + SIZE_OFFSET) >>> 2] >>> align;
              return getView(
                align,
                info & VAL_SIGNED,
                info & VAL_FLOAT
              ).subarray((buf >>>= align), buf + length);
            }

            baseModule.__getArrayView = __getArrayView;

            /** Copies an array's values from the module's memory. Infers the array type from RTTI. */
            function __getArray(arr) {
              const input = __getArrayView(arr);
              const len = input.length;
              const out = new Array(len);
              for (let i = 0; i < len; i++) out[i] = input[i];
              return out;
            }

            baseModule.__getArray = __getArray;

            /** Copies an ArrayBuffer's value from the module's memory. */
            function __getArrayBuffer(ptr) {
              const buffer = memory.buffer;
              const length = new Uint32Array(buffer)[(ptr + SIZE_OFFSET) >>> 2];
              return buffer.slice(ptr, ptr + length);
            }

            baseModule.__getArrayBuffer = __getArrayBuffer;

            /** Copies a typed array's values from the module's memory. */
            function getTypedArray(Type, alignLog2, ptr) {
              return new Type(getTypedArrayView(Type, alignLog2, ptr));
            }

            /** Gets a live view on a typed array's values in the module's memory. */
            function getTypedArrayView(Type, alignLog2, ptr) {
              const buffer = memory.buffer;
              const U32 = new Uint32Array(buffer);
              const bufPtr =
                U32[(ptr + ARRAYBUFFERVIEW_DATASTART_OFFSET) >>> 2];
              return new Type(
                buffer,
                bufPtr,
                U32[(bufPtr + SIZE_OFFSET) >>> 2] >>> alignLog2
              );
            }

            baseModule.__getInt8Array = getTypedArray.bind(null, Int8Array, 0);
            baseModule.__getInt8ArrayView = getTypedArrayView.bind(
              null,
              Int8Array,
              0
            );
            baseModule.__getUint8Array = getTypedArray.bind(
              null,
              Uint8Array,
              0
            );
            baseModule.__getUint8ArrayView = getTypedArrayView.bind(
              null,
              Uint8Array,
              0
            );
            baseModule.__getUint8ClampedArray = getTypedArray.bind(
              null,
              Uint8ClampedArray,
              0
            );
            baseModule.__getUint8ClampedArrayView = getTypedArrayView.bind(
              null,
              Uint8ClampedArray,
              0
            );
            baseModule.__getInt16Array = getTypedArray.bind(
              null,
              Int16Array,
              1
            );
            baseModule.__getInt16ArrayView = getTypedArrayView.bind(
              null,
              Int16Array,
              1
            );
            baseModule.__getUint16Array = getTypedArray.bind(
              null,
              Uint16Array,
              1
            );
            baseModule.__getUint16ArrayView = getTypedArrayView.bind(
              null,
              Uint16Array,
              1
            );
            baseModule.__getInt32Array = getTypedArray.bind(
              null,
              Int32Array,
              2
            );
            baseModule.__getInt32ArrayView = getTypedArrayView.bind(
              null,
              Int32Array,
              2
            );
            baseModule.__getUint32Array = getTypedArray.bind(
              null,
              Uint32Array,
              2
            );
            baseModule.__getUint32ArrayView = getTypedArrayView.bind(
              null,
              Uint32Array,
              2
            );
            if (BIGINT) {
              baseModule.__getInt64Array = getTypedArray.bind(
                null,
                BigInt64Array,
                3
              );
              baseModule.__getInt64ArrayView = getTypedArrayView.bind(
                null,
                BigInt64Array,
                3
              );
              baseModule.__getUint64Array = getTypedArray.bind(
                null,
                BigUint64Array,
                3
              );
              baseModule.__getUint64ArrayView = getTypedArrayView.bind(
                null,
                BigUint64Array,
                3
              );
            }
            baseModule.__getFloat32Array = getTypedArray.bind(
              null,
              Float32Array,
              2
            );
            baseModule.__getFloat32ArrayView = getTypedArrayView.bind(
              null,
              Float32Array,
              2
            );
            baseModule.__getFloat64Array = getTypedArray.bind(
              null,
              Float64Array,
              3
            );
            baseModule.__getFloat64ArrayView = getTypedArrayView.bind(
              null,
              Float64Array,
              3
            );

            /** Tests whether an object is an instance of the class represented by the specified base id. */
            function __instanceof(ptr, baseId) {
              const U32 = new Uint32Array(memory.buffer);
              var id = U32[(ptr + ID_OFFSET) >>> 2];
              if (id <= U32[rttiBase >>> 2]) {
                do if (id == baseId) return true;
                while ((id = getBase(id)));
              }
              return false;
            }

            baseModule.__instanceof = __instanceof;

            // Pull basic exports to baseModule so code in preInstantiate can use them
            baseModule.memory = baseModule.memory || memory;
            baseModule.table = baseModule.table || table;

            // Demangle exports and provide the usual utility on the prototype
            return demangle(rawExports, baseModule);
          }

          function isResponse(o) {
            return typeof Response !== "undefined" && o instanceof Response;
          }

          /** Asynchronously instantiates an AssemblyScript module from anything that can be instantiated. */
          async function instantiate(source, imports) {
            if (isResponse((source = await source)))
              return instantiateStreaming(source, imports);
            return postInstantiate(
              preInstantiate(imports || (imports = {})),
              await WebAssembly.instantiate(
                source instanceof WebAssembly.Module
                  ? source
                  : await WebAssembly.compile(source),
                imports
              )
            );
          }

          exports.instantiate = instantiate;

          /** Synchronously instantiates an AssemblyScript module from a WebAssembly.Module or binary buffer. */
          function instantiateSync(source, imports) {
            return postInstantiate(
              preInstantiate(imports || (imports = {})),
              new WebAssembly.Instance(
                source instanceof WebAssembly.Module
                  ? source
                  : new WebAssembly.Module(source),
                imports
              )
            );
          }

          exports.instantiateSync = instantiateSync;

          /** Asynchronously instantiates an AssemblyScript module from a response, i.e. as obtained by `fetch`. */
          async function instantiateStreaming(source, imports) {
            if (!WebAssembly.instantiateStreaming) {
              return instantiate(
                isResponse((source = await source))
                  ? source.arrayBuffer()
                  : source,
                imports
              );
            }
            return postInstantiate(
              preInstantiate(imports || (imports = {})),
              (await WebAssembly.instantiateStreaming(source, imports)).instance
            );
          }

          exports.instantiateStreaming = instantiateStreaming;

          /** Demangles an AssemblyScript module's exports to a friendly object structure. */
          function demangle(exports, baseModule) {
            var module = baseModule ? Object.create(baseModule) : {};
            var setArgumentsLength = exports["__argumentsLength"]
              ? function (length) {
                  exports["__argumentsLength"].value = length;
                }
              : exports["__setArgumentsLength"] ||
                exports["__setargc"] ||
                function () {};
            for (let internalName in exports) {
              if (!Object.prototype.hasOwnProperty.call(exports, internalName))
                continue;
              const elem = exports[internalName];
              let parts = internalName.split(".");
              let curr = module;
              while (parts.length > 1) {
                let part = parts.shift();
                if (!Object.prototype.hasOwnProperty.call(curr, part))
                  curr[part] = {};
                curr = curr[part];
              }
              let name = parts[0];
              let hash = name.indexOf("#");
              if (hash >= 0) {
                let className = name.substring(0, hash);
                let classElem = curr[className];
                if (typeof classElem === "undefined" || !classElem.prototype) {
                  let ctor = function (...args) {
                    return ctor.wrap(ctor.prototype.constructor(0, ...args));
                  };
                  ctor.prototype = {
                    valueOf: function valueOf() {
                      return this[THIS];
                    },
                  };
                  ctor.wrap = function (thisValue) {
                    return Object.create(ctor.prototype, {
                      [THIS]: { value: thisValue, writable: false },
                    });
                  };
                  if (classElem)
                    Object.getOwnPropertyNames(classElem).forEach((name) =>
                      Object.defineProperty(
                        ctor,
                        name,
                        Object.getOwnPropertyDescriptor(classElem, name)
                      )
                    );
                  curr[className] = ctor;
                }
                name = name.substring(hash + 1);
                curr = curr[className].prototype;
                if (/^(get|set):/.test(name)) {
                  if (
                    !Object.prototype.hasOwnProperty.call(
                      curr,
                      (name = name.substring(4))
                    )
                  ) {
                    let getter = exports[internalName.replace("set:", "get:")];
                    let setter = exports[internalName.replace("get:", "set:")];
                    Object.defineProperty(curr, name, {
                      get: function () {
                        return getter(this[THIS]);
                      },
                      set: function (value) {
                        setter(this[THIS], value);
                      },
                      enumerable: true,
                    });
                  }
                } else {
                  if (name === "constructor") {
                    (curr[name] = (...args) => {
                      setArgumentsLength(args.length);
                      return elem(...args);
                    }).original = elem;
                  } else {
                    // instance method
                    (curr[name] = function (...args) {
                      // !
                      setArgumentsLength(args.length);
                      return elem(this[THIS], ...args);
                    }).original = elem;
                  }
                }
              } else {
                if (/^(get|set):/.test(name)) {
                  if (
                    !Object.prototype.hasOwnProperty.call(
                      curr,
                      (name = name.substring(4))
                    )
                  ) {
                    Object.defineProperty(curr, name, {
                      get: exports[internalName.replace("set:", "get:")],
                      set: exports[internalName.replace("get:", "set:")],
                      enumerable: true,
                    });
                  }
                } else if (
                  typeof elem === "function" &&
                  elem !== setArgumentsLength
                ) {
                  (curr[name] = (...args) => {
                    setArgumentsLength(args.length);
                    return elem(...args);
                  }).original = elem;
                } else {
                  curr[name] = elem;
                }
              }
            }
            return module;
          }

          exports.demangle = demangle;
        },
        {},
      ],
      3: [
        function (require, module, exports) {
          "use strict";
          // base-x encoding / decoding
          // Copyright (c) 2018 base-x contributors
          // Copyright (c) 2014-2018 The Bitcoin Core developers (base58.cpp)
          // Distributed under the MIT software license, see the accompanying
          // file LICENSE or http://www.opensource.org/licenses/mit-license.php.
          function base(ALPHABET) {
            if (ALPHABET.length >= 255) {
              throw new TypeError("Alphabet too long");
            }
            var BASE_MAP = new Uint8Array(256);
            for (var j = 0; j < BASE_MAP.length; j++) {
              BASE_MAP[j] = 255;
            }
            for (var i = 0; i < ALPHABET.length; i++) {
              var x = ALPHABET.charAt(i);
              var xc = x.charCodeAt(0);
              if (BASE_MAP[xc] !== 255) {
                throw new TypeError(x + " is ambiguous");
              }
              BASE_MAP[xc] = i;
            }
            var BASE = ALPHABET.length;
            var LEADER = ALPHABET.charAt(0);
            var FACTOR = Math.log(BASE) / Math.log(256); // log(BASE) / log(256), rounded up
            var iFACTOR = Math.log(256) / Math.log(BASE); // log(256) / log(BASE), rounded up
            function encode(source) {
              if (source instanceof Uint8Array) {
              } else if (ArrayBuffer.isView(source)) {
                source = new Uint8Array(
                  source.buffer,
                  source.byteOffset,
                  source.byteLength
                );
              } else if (Array.isArray(source)) {
                source = Uint8Array.from(source);
              }
              if (!(source instanceof Uint8Array)) {
                throw new TypeError("Expected Uint8Array");
              }
              if (source.length === 0) {
                return "";
              }
              // Skip & count leading zeroes.
              var zeroes = 0;
              var length = 0;
              var pbegin = 0;
              var pend = source.length;
              while (pbegin !== pend && source[pbegin] === 0) {
                pbegin++;
                zeroes++;
              }
              // Allocate enough space in big-endian base58 representation.
              var size = ((pend - pbegin) * iFACTOR + 1) >>> 0;
              var b58 = new Uint8Array(size);
              // Process the bytes.
              while (pbegin !== pend) {
                var carry = source[pbegin];
                // Apply "b58 = b58 * 256 + ch".
                var i = 0;
                for (
                  var it1 = size - 1;
                  (carry !== 0 || i < length) && it1 !== -1;
                  it1--, i++
                ) {
                  carry += (256 * b58[it1]) >>> 0;
                  b58[it1] = carry % BASE >>> 0;
                  carry = (carry / BASE) >>> 0;
                }
                if (carry !== 0) {
                  throw new Error("Non-zero carry");
                }
                length = i;
                pbegin++;
              }
              // Skip leading zeroes in base58 result.
              var it2 = size - length;
              while (it2 !== size && b58[it2] === 0) {
                it2++;
              }
              // Translate the result into a string.
              var str = LEADER.repeat(zeroes);
              for (; it2 < size; ++it2) {
                str += ALPHABET.charAt(b58[it2]);
              }
              return str;
            }
            function decodeUnsafe(source) {
              if (typeof source !== "string") {
                throw new TypeError("Expected String");
              }
              if (source.length === 0) {
                return new Uint8Array();
              }
              var psz = 0;
              // Skip leading spaces.
              if (source[psz] === " ") {
                return;
              }
              // Skip and count leading '1's.
              var zeroes = 0;
              var length = 0;
              while (source[psz] === LEADER) {
                zeroes++;
                psz++;
              }
              // Allocate enough space in big-endian base256 representation.
              var size = ((source.length - psz) * FACTOR + 1) >>> 0; // log(58) / log(256), rounded up.
              var b256 = new Uint8Array(size);
              // Process the characters.
              while (source[psz]) {
                // Decode character
                var carry = BASE_MAP[source.charCodeAt(psz)];
                // Invalid character
                if (carry === 255) {
                  return;
                }
                var i = 0;
                for (
                  var it3 = size - 1;
                  (carry !== 0 || i < length) && it3 !== -1;
                  it3--, i++
                ) {
                  carry += (BASE * b256[it3]) >>> 0;
                  b256[it3] = carry % 256 >>> 0;
                  carry = (carry / 256) >>> 0;
                }
                if (carry !== 0) {
                  throw new Error("Non-zero carry");
                }
                length = i;
                psz++;
              }
              // Skip trailing spaces.
              if (source[psz] === " ") {
                return;
              }
              // Skip leading zeroes in b256.
              var it4 = size - length;
              while (it4 !== size && b256[it4] === 0) {
                it4++;
              }
              var vch = new Uint8Array(zeroes + (size - it4));
              var j = zeroes;
              while (it4 !== size) {
                vch[j++] = b256[it4++];
              }
              return vch;
            }
            function decode(string) {
              var buffer = decodeUnsafe(string);
              if (buffer) {
                return buffer;
              }
              throw new Error("Non-base" + BASE + " character");
            }
            return {
              encode: encode,
              decodeUnsafe: decodeUnsafe,
              decode: decode,
            };
          }
          module.exports = base;
        },
        {},
      ],
      4: [
        function (require, module, exports) {
          "use strict";
          module.exports = asPromise;

          /**
           * Callback as used by {@link util.asPromise}.
           * @typedef asPromiseCallback
           * @type {function}
           * @param {Error|null} error Error, if any
           * @param {...*} params Additional arguments
           * @returns {undefined}
           */

          /**
           * Returns a promise from a node-style callback function.
           * @memberof util
           * @param {asPromiseCallback} fn Function to call
           * @param {*} ctx Function context
           * @param {...*} params Function arguments
           * @returns {Promise<*>} Promisified function
           */
          function asPromise(fn, ctx /*, varargs */) {
            var params = new Array(arguments.length - 1),
              offset = 0,
              index = 2,
              pending = true;
            while (index < arguments.length)
              params[offset++] = arguments[index++];
            return new Promise(function executor(resolve, reject) {
              params[offset] = function callback(err /*, varargs */) {
                if (pending) {
                  pending = false;
                  if (err) reject(err);
                  else {
                    var params = new Array(arguments.length - 1),
                      offset = 0;
                    while (offset < params.length)
                      params[offset++] = arguments[offset];
                    resolve.apply(null, params);
                  }
                }
              };
              try {
                fn.apply(ctx || null, params);
              } catch (err) {
                if (pending) {
                  pending = false;
                  reject(err);
                }
              }
            });
          }
        },
        {},
      ],
      5: [
        function (require, module, exports) {
          "use strict";

          /**
           * A minimal base64 implementation for number arrays.
           * @memberof util
           * @namespace
           */
          var base64 = exports;

          /**
           * Calculates the byte length of a base64 encoded string.
           * @param {string} string Base64 encoded string
           * @returns {number} Byte length
           */
          base64.length = function length(string) {
            var p = string.length;
            if (!p) return 0;
            var n = 0;
            while (--p % 4 > 1 && string.charAt(p) === "=") ++n;
            return Math.ceil(string.length * 3) / 4 - n;
          };

          // Base64 encoding table
          var b64 = new Array(64);

          // Base64 decoding table
          var s64 = new Array(123);

          // 65..90, 97..122, 48..57, 43, 47
          for (var i = 0; i < 64; )
            s64[
              (b64[i] =
                i < 26
                  ? i + 65
                  : i < 52
                  ? i + 71
                  : i < 62
                  ? i - 4
                  : (i - 59) | 43)
            ] = i++;

          /**
           * Encodes a buffer to a base64 encoded string.
           * @param {Uint8Array} buffer Source buffer
           * @param {number} start Source start
           * @param {number} end Source end
           * @returns {string} Base64 encoded string
           */
          base64.encode = function encode(buffer, start, end) {
            var parts = null,
              chunk = [];
            var i = 0, // output index
              j = 0, // goto index
              t; // temporary
            while (start < end) {
              var b = buffer[start++];
              switch (j) {
                case 0:
                  chunk[i++] = b64[b >> 2];
                  t = (b & 3) << 4;
                  j = 1;
                  break;
                case 1:
                  chunk[i++] = b64[t | (b >> 4)];
                  t = (b & 15) << 2;
                  j = 2;
                  break;
                case 2:
                  chunk[i++] = b64[t | (b >> 6)];
                  chunk[i++] = b64[b & 63];
                  j = 0;
                  break;
              }
              if (i > 8191) {
                (parts || (parts = [])).push(
                  String.fromCharCode.apply(String, chunk)
                );
                i = 0;
              }
            }
            if (j) {
              chunk[i++] = b64[t];
              chunk[i++] = 61;
              if (j === 1) chunk[i++] = 61;
            }
            if (parts) {
              if (i)
                parts.push(
                  String.fromCharCode.apply(String, chunk.slice(0, i))
                );
              return parts.join("");
            }
            return String.fromCharCode.apply(String, chunk.slice(0, i));
          };

          var invalidEncoding = "invalid encoding";

          /**
           * Decodes a base64 encoded string to a buffer.
           * @param {string} string Source string
           * @param {Uint8Array} buffer Destination buffer
           * @param {number} offset Destination offset
           * @returns {number} Number of bytes written
           * @throws {Error} If encoding is invalid
           */
          base64.decode = function decode(string, buffer, offset) {
            var start = offset;
            var j = 0, // goto index
              t; // temporary
            for (var i = 0; i < string.length; ) {
              var c = string.charCodeAt(i++);
              if (c === 61 && j > 1) break;
              if ((c = s64[c]) === undefined) throw Error(invalidEncoding);
              switch (j) {
                case 0:
                  t = c;
                  j = 1;
                  break;
                case 1:
                  buffer[offset++] = (t << 2) | ((c & 48) >> 4);
                  t = c;
                  j = 2;
                  break;
                case 2:
                  buffer[offset++] = ((t & 15) << 4) | ((c & 60) >> 2);
                  t = c;
                  j = 3;
                  break;
                case 3:
                  buffer[offset++] = ((t & 3) << 6) | c;
                  j = 0;
                  break;
              }
            }
            if (j === 1) throw Error(invalidEncoding);
            return offset - start;
          };

          /**
           * Tests if the specified string appears to be base64 encoded.
           * @param {string} string String to test
           * @returns {boolean} `true` if probably base64 encoded, otherwise false
           */
          base64.test = function test(string) {
            return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              string
            );
          };
        },
        {},
      ],
      6: [
        function (require, module, exports) {
          "use strict";
          module.exports = EventEmitter;

          /**
           * Constructs a new event emitter instance.
           * @classdesc A minimal event emitter.
           * @memberof util
           * @constructor
           */
          function EventEmitter() {
            /**
             * Registered listeners.
             * @type {Object.<string,*>}
             * @private
             */
            this._listeners = {};
          }

          /**
           * Registers an event listener.
           * @param {string} evt Event name
           * @param {function} fn Listener
           * @param {*} [ctx] Listener context
           * @returns {util.EventEmitter} `this`
           */
          EventEmitter.prototype.on = function on(evt, fn, ctx) {
            (this._listeners[evt] || (this._listeners[evt] = [])).push({
              fn: fn,
              ctx: ctx || this,
            });
            return this;
          };

          /**
           * Removes an event listener or any matching listeners if arguments are omitted.
           * @param {string} [evt] Event name. Removes all listeners if omitted.
           * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
           * @returns {util.EventEmitter} `this`
           */
          EventEmitter.prototype.off = function off(evt, fn) {
            if (evt === undefined) this._listeners = {};
            else {
              if (fn === undefined) this._listeners[evt] = [];
              else {
                var listeners = this._listeners[evt];
                for (var i = 0; i < listeners.length; )
                  if (listeners[i].fn === fn) listeners.splice(i, 1);
                  else ++i;
              }
            }
            return this;
          };

          /**
           * Emits an event by calling its listeners with the specified arguments.
           * @param {string} evt Event name
           * @param {...*} args Arguments
           * @returns {util.EventEmitter} `this`
           */
          EventEmitter.prototype.emit = function emit(evt) {
            var listeners = this._listeners[evt];
            if (listeners) {
              var args = [],
                i = 1;
              for (; i < arguments.length; ) args.push(arguments[i++]);
              for (i = 0; i < listeners.length; )
                listeners[i].fn.apply(listeners[i++].ctx, args);
            }
            return this;
          };
        },
        {},
      ],
      7: [
        function (require, module, exports) {
          "use strict";

          module.exports = factory(factory);

          /**
           * Reads / writes floats / doubles from / to buffers.
           * @name util.float
           * @namespace
           */

          /**
           * Writes a 32 bit float to a buffer using little endian byte order.
           * @name util.float.writeFloatLE
           * @function
           * @param {number} val Value to write
           * @param {Uint8Array} buf Target buffer
           * @param {number} pos Target buffer offset
           * @returns {undefined}
           */

          /**
           * Writes a 32 bit float to a buffer using big endian byte order.
           * @name util.float.writeFloatBE
           * @function
           * @param {number} val Value to write
           * @param {Uint8Array} buf Target buffer
           * @param {number} pos Target buffer offset
           * @returns {undefined}
           */

          /**
           * Reads a 32 bit float from a buffer using little endian byte order.
           * @name util.float.readFloatLE
           * @function
           * @param {Uint8Array} buf Source buffer
           * @param {number} pos Source buffer offset
           * @returns {number} Value read
           */

          /**
           * Reads a 32 bit float from a buffer using big endian byte order.
           * @name util.float.readFloatBE
           * @function
           * @param {Uint8Array} buf Source buffer
           * @param {number} pos Source buffer offset
           * @returns {number} Value read
           */

          /**
           * Writes a 64 bit double to a buffer using little endian byte order.
           * @name util.float.writeDoubleLE
           * @function
           * @param {number} val Value to write
           * @param {Uint8Array} buf Target buffer
           * @param {number} pos Target buffer offset
           * @returns {undefined}
           */

          /**
           * Writes a 64 bit double to a buffer using big endian byte order.
           * @name util.float.writeDoubleBE
           * @function
           * @param {number} val Value to write
           * @param {Uint8Array} buf Target buffer
           * @param {number} pos Target buffer offset
           * @returns {undefined}
           */

          /**
           * Reads a 64 bit double from a buffer using little endian byte order.
           * @name util.float.readDoubleLE
           * @function
           * @param {Uint8Array} buf Source buffer
           * @param {number} pos Source buffer offset
           * @returns {number} Value read
           */

          /**
           * Reads a 64 bit double from a buffer using big endian byte order.
           * @name util.float.readDoubleBE
           * @function
           * @param {Uint8Array} buf Source buffer
           * @param {number} pos Source buffer offset
           * @returns {number} Value read
           */

          // Factory function for the purpose of node-based testing in modified global environments
          function factory(exports) {
            // float: typed array
            if (typeof Float32Array !== "undefined")
              (function () {
                var f32 = new Float32Array([-0]),
                  f8b = new Uint8Array(f32.buffer),
                  le = f8b[3] === 128;

                function writeFloat_f32_cpy(val, buf, pos) {
                  f32[0] = val;
                  buf[pos] = f8b[0];
                  buf[pos + 1] = f8b[1];
                  buf[pos + 2] = f8b[2];
                  buf[pos + 3] = f8b[3];
                }

                function writeFloat_f32_rev(val, buf, pos) {
                  f32[0] = val;
                  buf[pos] = f8b[3];
                  buf[pos + 1] = f8b[2];
                  buf[pos + 2] = f8b[1];
                  buf[pos + 3] = f8b[0];
                }

                /* istanbul ignore next */
                exports.writeFloatLE = le
                  ? writeFloat_f32_cpy
                  : writeFloat_f32_rev;
                /* istanbul ignore next */
                exports.writeFloatBE = le
                  ? writeFloat_f32_rev
                  : writeFloat_f32_cpy;

                function readFloat_f32_cpy(buf, pos) {
                  f8b[0] = buf[pos];
                  f8b[1] = buf[pos + 1];
                  f8b[2] = buf[pos + 2];
                  f8b[3] = buf[pos + 3];
                  return f32[0];
                }

                function readFloat_f32_rev(buf, pos) {
                  f8b[3] = buf[pos];
                  f8b[2] = buf[pos + 1];
                  f8b[1] = buf[pos + 2];
                  f8b[0] = buf[pos + 3];
                  return f32[0];
                }

                /* istanbul ignore next */
                exports.readFloatLE = le
                  ? readFloat_f32_cpy
                  : readFloat_f32_rev;
                /* istanbul ignore next */
                exports.readFloatBE = le
                  ? readFloat_f32_rev
                  : readFloat_f32_cpy;

                // float: ieee754
              })();
            else
              (function () {
                function writeFloat_ieee754(writeUint, val, buf, pos) {
                  var sign = val < 0 ? 1 : 0;
                  if (sign) val = -val;
                  if (val === 0)
                    writeUint(
                      1 / val > 0
                        ? /* positive */ 0
                        : /* negative 0 */ 2147483648,
                      buf,
                      pos
                    );
                  else if (isNaN(val)) writeUint(2143289344, buf, pos);
                  else if (val > 3.4028234663852886e38)
                    // +-Infinity
                    writeUint(((sign << 31) | 2139095040) >>> 0, buf, pos);
                  else if (val < 1.1754943508222875e-38)
                    // denormal
                    writeUint(
                      ((sign << 31) |
                        Math.round(val / 1.401298464324817e-45)) >>>
                        0,
                      buf,
                      pos
                    );
                  else {
                    var exponent = Math.floor(Math.log(val) / Math.LN2),
                      mantissa =
                        Math.round(val * Math.pow(2, -exponent) * 8388608) &
                        8388607;
                    writeUint(
                      ((sign << 31) | ((exponent + 127) << 23) | mantissa) >>>
                        0,
                      buf,
                      pos
                    );
                  }
                }

                exports.writeFloatLE = writeFloat_ieee754.bind(
                  null,
                  writeUintLE
                );
                exports.writeFloatBE = writeFloat_ieee754.bind(
                  null,
                  writeUintBE
                );

                function readFloat_ieee754(readUint, buf, pos) {
                  var uint = readUint(buf, pos),
                    sign = (uint >> 31) * 2 + 1,
                    exponent = (uint >>> 23) & 255,
                    mantissa = uint & 8388607;
                  return exponent === 255
                    ? mantissa
                      ? NaN
                      : sign * Infinity
                    : exponent === 0 // denormal
                    ? sign * 1.401298464324817e-45 * mantissa
                    : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
                }

                exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE);
                exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE);
              })();

            // double: typed array
            if (typeof Float64Array !== "undefined")
              (function () {
                var f64 = new Float64Array([-0]),
                  f8b = new Uint8Array(f64.buffer),
                  le = f8b[7] === 128;

                function writeDouble_f64_cpy(val, buf, pos) {
                  f64[0] = val;
                  buf[pos] = f8b[0];
                  buf[pos + 1] = f8b[1];
                  buf[pos + 2] = f8b[2];
                  buf[pos + 3] = f8b[3];
                  buf[pos + 4] = f8b[4];
                  buf[pos + 5] = f8b[5];
                  buf[pos + 6] = f8b[6];
                  buf[pos + 7] = f8b[7];
                }

                function writeDouble_f64_rev(val, buf, pos) {
                  f64[0] = val;
                  buf[pos] = f8b[7];
                  buf[pos + 1] = f8b[6];
                  buf[pos + 2] = f8b[5];
                  buf[pos + 3] = f8b[4];
                  buf[pos + 4] = f8b[3];
                  buf[pos + 5] = f8b[2];
                  buf[pos + 6] = f8b[1];
                  buf[pos + 7] = f8b[0];
                }

                /* istanbul ignore next */
                exports.writeDoubleLE = le
                  ? writeDouble_f64_cpy
                  : writeDouble_f64_rev;
                /* istanbul ignore next */
                exports.writeDoubleBE = le
                  ? writeDouble_f64_rev
                  : writeDouble_f64_cpy;

                function readDouble_f64_cpy(buf, pos) {
                  f8b[0] = buf[pos];
                  f8b[1] = buf[pos + 1];
                  f8b[2] = buf[pos + 2];
                  f8b[3] = buf[pos + 3];
                  f8b[4] = buf[pos + 4];
                  f8b[5] = buf[pos + 5];
                  f8b[6] = buf[pos + 6];
                  f8b[7] = buf[pos + 7];
                  return f64[0];
                }

                function readDouble_f64_rev(buf, pos) {
                  f8b[7] = buf[pos];
                  f8b[6] = buf[pos + 1];
                  f8b[5] = buf[pos + 2];
                  f8b[4] = buf[pos + 3];
                  f8b[3] = buf[pos + 4];
                  f8b[2] = buf[pos + 5];
                  f8b[1] = buf[pos + 6];
                  f8b[0] = buf[pos + 7];
                  return f64[0];
                }

                /* istanbul ignore next */
                exports.readDoubleLE = le
                  ? readDouble_f64_cpy
                  : readDouble_f64_rev;
                /* istanbul ignore next */
                exports.readDoubleBE = le
                  ? readDouble_f64_rev
                  : readDouble_f64_cpy;

                // double: ieee754
              })();
            else
              (function () {
                function writeDouble_ieee754(
                  writeUint,
                  off0,
                  off1,
                  val,
                  buf,
                  pos
                ) {
                  var sign = val < 0 ? 1 : 0;
                  if (sign) val = -val;
                  if (val === 0) {
                    writeUint(0, buf, pos + off0);
                    writeUint(
                      1 / val > 0
                        ? /* positive */ 0
                        : /* negative 0 */ 2147483648,
                      buf,
                      pos + off1
                    );
                  } else if (isNaN(val)) {
                    writeUint(0, buf, pos + off0);
                    writeUint(2146959360, buf, pos + off1);
                  } else if (val > 1.7976931348623157e308) {
                    // +-Infinity
                    writeUint(0, buf, pos + off0);
                    writeUint(
                      ((sign << 31) | 2146435072) >>> 0,
                      buf,
                      pos + off1
                    );
                  } else {
                    var mantissa;
                    if (val < 2.2250738585072014e-308) {
                      // denormal
                      mantissa = val / 5e-324;
                      writeUint(mantissa >>> 0, buf, pos + off0);
                      writeUint(
                        ((sign << 31) | (mantissa / 4294967296)) >>> 0,
                        buf,
                        pos + off1
                      );
                    } else {
                      var exponent = Math.floor(Math.log(val) / Math.LN2);
                      if (exponent === 1024) exponent = 1023;
                      mantissa = val * Math.pow(2, -exponent);
                      writeUint(
                        (mantissa * 4503599627370496) >>> 0,
                        buf,
                        pos + off0
                      );
                      writeUint(
                        ((sign << 31) |
                          ((exponent + 1023) << 20) |
                          ((mantissa * 1048576) & 1048575)) >>>
                          0,
                        buf,
                        pos + off1
                      );
                    }
                  }
                }

                exports.writeDoubleLE = writeDouble_ieee754.bind(
                  null,
                  writeUintLE,
                  0,
                  4
                );
                exports.writeDoubleBE = writeDouble_ieee754.bind(
                  null,
                  writeUintBE,
                  4,
                  0
                );

                function readDouble_ieee754(readUint, off0, off1, buf, pos) {
                  var lo = readUint(buf, pos + off0),
                    hi = readUint(buf, pos + off1);
                  var sign = (hi >> 31) * 2 + 1,
                    exponent = (hi >>> 20) & 2047,
                    mantissa = 4294967296 * (hi & 1048575) + lo;
                  return exponent === 2047
                    ? mantissa
                      ? NaN
                      : sign * Infinity
                    : exponent === 0 // denormal
                    ? sign * 5e-324 * mantissa
                    : sign *
                      Math.pow(2, exponent - 1075) *
                      (mantissa + 4503599627370496);
                }

                exports.readDoubleLE = readDouble_ieee754.bind(
                  null,
                  readUintLE,
                  0,
                  4
                );
                exports.readDoubleBE = readDouble_ieee754.bind(
                  null,
                  readUintBE,
                  4,
                  0
                );
              })();

            return exports;
          }

          // uint helpers

          function writeUintLE(val, buf, pos) {
            buf[pos] = val & 255;
            buf[pos + 1] = (val >>> 8) & 255;
            buf[pos + 2] = (val >>> 16) & 255;
            buf[pos + 3] = val >>> 24;
          }

          function writeUintBE(val, buf, pos) {
            buf[pos] = val >>> 24;
            buf[pos + 1] = (val >>> 16) & 255;
            buf[pos + 2] = (val >>> 8) & 255;
            buf[pos + 3] = val & 255;
          }

          function readUintLE(buf, pos) {
            return (
              (buf[pos] |
                (buf[pos + 1] << 8) |
                (buf[pos + 2] << 16) |
                (buf[pos + 3] << 24)) >>>
              0
            );
          }

          function readUintBE(buf, pos) {
            return (
              ((buf[pos] << 24) |
                (buf[pos + 1] << 16) |
                (buf[pos + 2] << 8) |
                buf[pos + 3]) >>>
              0
            );
          }
        },
        {},
      ],
      8: [
        function (require, module, exports) {
          "use strict";
          module.exports = inquire;

          /**
           * Requires a module only if available.
           * @memberof util
           * @param {string} moduleName Module to require
           * @returns {?Object} Required module if available and not empty, otherwise `null`
           */
          function inquire(moduleName) {
            try {
              var mod = eval("quire".replace(/^/, "re"))(moduleName); // eslint-disable-line no-eval
              if (mod && (mod.length || Object.keys(mod).length)) return mod;
            } catch (e) {} // eslint-disable-line no-empty
            return null;
          }
        },
        {},
      ],
      9: [
        function (require, module, exports) {
          "use strict";
          module.exports = pool;

          /**
           * An allocator as used by {@link util.pool}.
           * @typedef PoolAllocator
           * @type {function}
           * @param {number} size Buffer size
           * @returns {Uint8Array} Buffer
           */

          /**
           * A slicer as used by {@link util.pool}.
           * @typedef PoolSlicer
           * @type {function}
           * @param {number} start Start offset
           * @param {number} end End offset
           * @returns {Uint8Array} Buffer slice
           * @this {Uint8Array}
           */

          /**
           * A general purpose buffer pool.
           * @memberof util
           * @function
           * @param {PoolAllocator} alloc Allocator
           * @param {PoolSlicer} slice Slicer
           * @param {number} [size=8192] Slab size
           * @returns {PoolAllocator} Pooled allocator
           */
          function pool(alloc, slice, size) {
            var SIZE = size || 8192;
            var MAX = SIZE >>> 1;
            var slab = null;
            var offset = SIZE;
            return function pool_alloc(size) {
              if (size < 1 || size > MAX) return alloc(size);
              if (offset + size > SIZE) {
                slab = alloc(SIZE);
                offset = 0;
              }
              var buf = slice.call(slab, offset, (offset += size));
              if (offset & 7)
                // align to 32 bit
                offset = (offset | 7) + 1;
              return buf;
            };
          }
        },
        {},
      ],
      10: [
        function (require, module, exports) {
          "use strict";

          /**
           * A minimal UTF8 implementation for number arrays.
           * @memberof util
           * @namespace
           */
          var utf8 = exports;

          /**
           * Calculates the UTF8 byte length of a string.
           * @param {string} string String
           * @returns {number} Byte length
           */
          utf8.length = function utf8_length(string) {
            var len = 0,
              c = 0;
            for (var i = 0; i < string.length; ++i) {
              c = string.charCodeAt(i);
              if (c < 128) len += 1;
              else if (c < 2048) len += 2;
              else if (
                (c & 0xfc00) === 0xd800 &&
                (string.charCodeAt(i + 1) & 0xfc00) === 0xdc00
              ) {
                ++i;
                len += 4;
              } else len += 3;
            }
            return len;
          };

          /**
           * Reads UTF8 bytes as a string.
           * @param {Uint8Array} buffer Source buffer
           * @param {number} start Source start
           * @param {number} end Source end
           * @returns {string} String read
           */
          utf8.read = function utf8_read(buffer, start, end) {
            var len = end - start;
            if (len < 1) return "";
            var parts = null,
              chunk = [],
              i = 0, // char offset
              t; // temporary
            while (start < end) {
              t = buffer[start++];
              if (t < 128) chunk[i++] = t;
              else if (t > 191 && t < 224)
                chunk[i++] = ((t & 31) << 6) | (buffer[start++] & 63);
              else if (t > 239 && t < 365) {
                t =
                  (((t & 7) << 18) |
                    ((buffer[start++] & 63) << 12) |
                    ((buffer[start++] & 63) << 6) |
                    (buffer[start++] & 63)) -
                  0x10000;
                chunk[i++] = 0xd800 + (t >> 10);
                chunk[i++] = 0xdc00 + (t & 1023);
              } else
                chunk[i++] =
                  ((t & 15) << 12) |
                  ((buffer[start++] & 63) << 6) |
                  (buffer[start++] & 63);
              if (i > 8191) {
                (parts || (parts = [])).push(
                  String.fromCharCode.apply(String, chunk)
                );
                i = 0;
              }
            }
            if (parts) {
              if (i)
                parts.push(
                  String.fromCharCode.apply(String, chunk.slice(0, i))
                );
              return parts.join("");
            }
            return String.fromCharCode.apply(String, chunk.slice(0, i));
          };

          /**
           * Writes a string as UTF8 bytes.
           * @param {string} string Source string
           * @param {Uint8Array} buffer Destination buffer
           * @param {number} offset Destination offset
           * @returns {number} Bytes written
           */
          utf8.write = function utf8_write(string, buffer, offset) {
            var start = offset,
              c1, // character 1
              c2; // character 2
            for (var i = 0; i < string.length; ++i) {
              c1 = string.charCodeAt(i);
              if (c1 < 128) {
                buffer[offset++] = c1;
              } else if (c1 < 2048) {
                buffer[offset++] = (c1 >> 6) | 192;
                buffer[offset++] = (c1 & 63) | 128;
              } else if (
                (c1 & 0xfc00) === 0xd800 &&
                ((c2 = string.charCodeAt(i + 1)) & 0xfc00) === 0xdc00
              ) {
                c1 = 0x10000 + ((c1 & 0x03ff) << 10) + (c2 & 0x03ff);
                ++i;
                buffer[offset++] = (c1 >> 18) | 240;
                buffer[offset++] = ((c1 >> 12) & 63) | 128;
                buffer[offset++] = ((c1 >> 6) & 63) | 128;
                buffer[offset++] = (c1 & 63) | 128;
              } else {
                buffer[offset++] = (c1 >> 12) | 224;
                buffer[offset++] = ((c1 >> 6) & 63) | 128;
                buffer[offset++] = (c1 & 63) | 128;
              }
            }
            return offset - start;
          };
        },
        {},
      ],
      11: [
        function (require, module, exports) {
          "use strict";

          const { Buffer } = require("buffer");
          const symbol = Symbol.for("BufferList");

          function BufferList(buf) {
            if (!(this instanceof BufferList)) {
              return new BufferList(buf);
            }

            BufferList._init.call(this, buf);
          }

          BufferList._init = function _init(buf) {
            Object.defineProperty(this, symbol, { value: true });

            this._bufs = [];
            this.length = 0;

            if (buf) {
              this.append(buf);
            }
          };

          BufferList.prototype._new = function _new(buf) {
            return new BufferList(buf);
          };

          BufferList.prototype._offset = function _offset(offset) {
            if (offset === 0) {
              return [0, 0];
            }

            let tot = 0;

            for (let i = 0; i < this._bufs.length; i++) {
              const _t = tot + this._bufs[i].length;
              if (offset < _t || i === this._bufs.length - 1) {
                return [i, offset - tot];
              }
              tot = _t;
            }
          };

          BufferList.prototype._reverseOffset = function (blOffset) {
            const bufferId = blOffset[0];
            let offset = blOffset[1];

            for (let i = 0; i < bufferId; i++) {
              offset += this._bufs[i].length;
            }

            return offset;
          };

          BufferList.prototype.get = function get(index) {
            if (index > this.length || index < 0) {
              return undefined;
            }

            const offset = this._offset(index);

            return this._bufs[offset[0]][offset[1]];
          };

          BufferList.prototype.slice = function slice(start, end) {
            if (typeof start === "number" && start < 0) {
              start += this.length;
            }

            if (typeof end === "number" && end < 0) {
              end += this.length;
            }

            return this.copy(null, 0, start, end);
          };

          BufferList.prototype.copy = function copy(
            dst,
            dstStart,
            srcStart,
            srcEnd
          ) {
            if (typeof srcStart !== "number" || srcStart < 0) {
              srcStart = 0;
            }

            if (typeof srcEnd !== "number" || srcEnd > this.length) {
              srcEnd = this.length;
            }

            if (srcStart >= this.length) {
              return dst || Buffer.alloc(0);
            }

            if (srcEnd <= 0) {
              return dst || Buffer.alloc(0);
            }

            const copy = !!dst;
            const off = this._offset(srcStart);
            const len = srcEnd - srcStart;
            let bytes = len;
            let bufoff = (copy && dstStart) || 0;
            let start = off[1];

            // copy/slice everything
            if (srcStart === 0 && srcEnd === this.length) {
              if (!copy) {
                // slice, but full concat if multiple buffers
                return this._bufs.length === 1
                  ? this._bufs[0]
                  : Buffer.concat(this._bufs, this.length);
              }

              // copy, need to copy individual buffers
              for (let i = 0; i < this._bufs.length; i++) {
                this._bufs[i].copy(dst, bufoff);
                bufoff += this._bufs[i].length;
              }

              return dst;
            }

            // easy, cheap case where it's a subset of one of the buffers
            if (bytes <= this._bufs[off[0]].length - start) {
              return copy
                ? this._bufs[off[0]].copy(dst, dstStart, start, start + bytes)
                : this._bufs[off[0]].slice(start, start + bytes);
            }

            if (!copy) {
              // a slice, we need something to copy in to
              dst = Buffer.allocUnsafe(len);
            }

            for (let i = off[0]; i < this._bufs.length; i++) {
              const l = this._bufs[i].length - start;

              if (bytes > l) {
                this._bufs[i].copy(dst, bufoff, start);
                bufoff += l;
              } else {
                this._bufs[i].copy(dst, bufoff, start, start + bytes);
                bufoff += l;
                break;
              }

              bytes -= l;

              if (start) {
                start = 0;
              }
            }

            // safeguard so that we don't return uninitialized memory
            if (dst.length > bufoff) return dst.slice(0, bufoff);

            return dst;
          };

          BufferList.prototype.shallowSlice = function shallowSlice(
            start,
            end
          ) {
            start = start || 0;
            end = typeof end !== "number" ? this.length : end;

            if (start < 0) {
              start += this.length;
            }

            if (end < 0) {
              end += this.length;
            }

            if (start === end) {
              return this._new();
            }

            const startOffset = this._offset(start);
            const endOffset = this._offset(end);
            const buffers = this._bufs.slice(startOffset[0], endOffset[0] + 1);

            if (endOffset[1] === 0) {
              buffers.pop();
            } else {
              buffers[buffers.length - 1] = buffers[buffers.length - 1].slice(
                0,
                endOffset[1]
              );
            }

            if (startOffset[1] !== 0) {
              buffers[0] = buffers[0].slice(startOffset[1]);
            }

            return this._new(buffers);
          };

          BufferList.prototype.toString = function toString(
            encoding,
            start,
            end
          ) {
            return this.slice(start, end).toString(encoding);
          };

          BufferList.prototype.consume = function consume(bytes) {
            // first, normalize the argument, in accordance with how Buffer does it
            bytes = Math.trunc(bytes);
            // do nothing if not a positive number
            if (Number.isNaN(bytes) || bytes <= 0) return this;

            while (this._bufs.length) {
              if (bytes >= this._bufs[0].length) {
                bytes -= this._bufs[0].length;
                this.length -= this._bufs[0].length;
                this._bufs.shift();
              } else {
                this._bufs[0] = this._bufs[0].slice(bytes);
                this.length -= bytes;
                break;
              }
            }

            return this;
          };

          BufferList.prototype.duplicate = function duplicate() {
            const copy = this._new();

            for (let i = 0; i < this._bufs.length; i++) {
              copy.append(this._bufs[i]);
            }

            return copy;
          };

          BufferList.prototype.append = function append(buf) {
            if (buf == null) {
              return this;
            }

            if (buf.buffer) {
              // append a view of the underlying ArrayBuffer
              this._appendBuffer(
                Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)
              );
            } else if (Array.isArray(buf)) {
              for (let i = 0; i < buf.length; i++) {
                this.append(buf[i]);
              }
            } else if (this._isBufferList(buf)) {
              // unwrap argument into individual BufferLists
              for (let i = 0; i < buf._bufs.length; i++) {
                this.append(buf._bufs[i]);
              }
            } else {
              // coerce number arguments to strings, since Buffer(number) does
              // uninitialized memory allocation
              if (typeof buf === "number") {
                buf = buf.toString();
              }

              this._appendBuffer(Buffer.from(buf));
            }

            return this;
          };

          BufferList.prototype._appendBuffer = function appendBuffer(buf) {
            this._bufs.push(buf);
            this.length += buf.length;
          };

          BufferList.prototype.indexOf = function (search, offset, encoding) {
            if (encoding === undefined && typeof offset === "string") {
              encoding = offset;
              offset = undefined;
            }

            if (typeof search === "function" || Array.isArray(search)) {
              throw new TypeError(
                'The "value" argument must be one of type string, Buffer, BufferList, or Uint8Array.'
              );
            } else if (typeof search === "number") {
              search = Buffer.from([search]);
            } else if (typeof search === "string") {
              search = Buffer.from(search, encoding);
            } else if (this._isBufferList(search)) {
              search = search.slice();
            } else if (Array.isArray(search.buffer)) {
              search = Buffer.from(
                search.buffer,
                search.byteOffset,
                search.byteLength
              );
            } else if (!Buffer.isBuffer(search)) {
              search = Buffer.from(search);
            }

            offset = Number(offset || 0);

            if (isNaN(offset)) {
              offset = 0;
            }

            if (offset < 0) {
              offset = this.length + offset;
            }

            if (offset < 0) {
              offset = 0;
            }

            if (search.length === 0) {
              return offset > this.length ? this.length : offset;
            }

            const blOffset = this._offset(offset);
            let blIndex = blOffset[0]; // index of which internal buffer we're working on
            let buffOffset = blOffset[1]; // offset of the internal buffer we're working on

            // scan over each buffer
            for (; blIndex < this._bufs.length; blIndex++) {
              const buff = this._bufs[blIndex];

              while (buffOffset < buff.length) {
                const availableWindow = buff.length - buffOffset;

                if (availableWindow >= search.length) {
                  const nativeSearchResult = buff.indexOf(search, buffOffset);

                  if (nativeSearchResult !== -1) {
                    return this._reverseOffset([blIndex, nativeSearchResult]);
                  }

                  buffOffset = buff.length - search.length + 1; // end of native search window
                } else {
                  const revOffset = this._reverseOffset([blIndex, buffOffset]);

                  if (this._match(revOffset, search)) {
                    return revOffset;
                  }

                  buffOffset++;
                }
              }

              buffOffset = 0;
            }

            return -1;
          };

          BufferList.prototype._match = function (offset, search) {
            if (this.length - offset < search.length) {
              return false;
            }

            for (
              let searchOffset = 0;
              searchOffset < search.length;
              searchOffset++
            ) {
              if (this.get(offset + searchOffset) !== search[searchOffset]) {
                return false;
              }
            }
            return true;
          };
          (function () {
            const methods = {
              readDoubleBE: 8,
              readDoubleLE: 8,
              readFloatBE: 4,
              readFloatLE: 4,
              readInt32BE: 4,
              readInt32LE: 4,
              readUInt32BE: 4,
              readUInt32LE: 4,
              readInt16BE: 2,
              readInt16LE: 2,
              readUInt16BE: 2,
              readUInt16LE: 2,
              readInt8: 1,
              readUInt8: 1,
              readIntBE: null,
              readIntLE: null,
              readUIntBE: null,
              readUIntLE: null,
            };

            for (const m in methods) {
              (function (m) {
                if (methods[m] === null) {
                  BufferList.prototype[m] = function (offset, byteLength) {
                    return this.slice(offset, offset + byteLength)[m](
                      0,
                      byteLength
                    );
                  };
                } else {
                  BufferList.prototype[m] = function (offset = 0) {
                    return this.slice(offset, offset + methods[m])[m](0);
                  };
                }
              })(m);
            }
          })();

          // Used internally by the class and also as an indicator of this object being
          // a `BufferList`. It's not possible to use `instanceof BufferList` in a browser
          // environment because there could be multiple different copies of the
          // BufferList class and some `BufferList`s might be `BufferList`s.
          BufferList.prototype._isBufferList = function _isBufferList(b) {
            return b instanceof BufferList || BufferList.isBufferList(b);
          };

          BufferList.isBufferList = function isBufferList(b) {
            return b != null && b[symbol];
          };

          module.exports = BufferList;
        },
        { buffer: 164 },
      ],
      12: [
        function (require, module, exports) {
          // Blake2B in pure Javascript
          // Adapted from the reference implementation in RFC7693
          // Ported to Javascript by DC - https://github.com/dcposch

          const util = require("./util");

          // 64-bit unsigned addition
          // Sets v[a,a+1] += v[b,b+1]
          // v should be a Uint32Array
          function ADD64AA(v, a, b) {
            const o0 = v[a] + v[b];
            let o1 = v[a + 1] + v[b + 1];
            if (o0 >= 0x100000000) {
              o1++;
            }
            v[a] = o0;
            v[a + 1] = o1;
          }

          // 64-bit unsigned addition
          // Sets v[a,a+1] += b
          // b0 is the low 32 bits of b, b1 represents the high 32 bits
          function ADD64AC(v, a, b0, b1) {
            let o0 = v[a] + b0;
            if (b0 < 0) {
              o0 += 0x100000000;
            }
            let o1 = v[a + 1] + b1;
            if (o0 >= 0x100000000) {
              o1++;
            }
            v[a] = o0;
            v[a + 1] = o1;
          }

          // Little-endian byte access
          function B2B_GET32(arr, i) {
            return (
              arr[i] ^
              (arr[i + 1] << 8) ^
              (arr[i + 2] << 16) ^
              (arr[i + 3] << 24)
            );
          }

          // G Mixing function
          // The ROTRs are inlined for speed
          function B2B_G(a, b, c, d, ix, iy) {
            const x0 = m[ix];
            const x1 = m[ix + 1];
            const y0 = m[iy];
            const y1 = m[iy + 1];

            ADD64AA(v, a, b); // v[a,a+1] += v[b,b+1] ... in JS we must store a uint64 as two uint32s
            ADD64AC(v, a, x0, x1); // v[a, a+1] += x ... x0 is the low 32 bits of x, x1 is the high 32 bits

            // v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotated to the right by 32 bits
            let xor0 = v[d] ^ v[a];
            let xor1 = v[d + 1] ^ v[a + 1];
            v[d] = xor1;
            v[d + 1] = xor0;

            ADD64AA(v, c, d);

            // v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotated right by 24 bits
            xor0 = v[b] ^ v[c];
            xor1 = v[b + 1] ^ v[c + 1];
            v[b] = (xor0 >>> 24) ^ (xor1 << 8);
            v[b + 1] = (xor1 >>> 24) ^ (xor0 << 8);

            ADD64AA(v, a, b);
            ADD64AC(v, a, y0, y1);

            // v[d,d+1] = (v[d,d+1] xor v[a,a+1]) rotated right by 16 bits
            xor0 = v[d] ^ v[a];
            xor1 = v[d + 1] ^ v[a + 1];
            v[d] = (xor0 >>> 16) ^ (xor1 << 16);
            v[d + 1] = (xor1 >>> 16) ^ (xor0 << 16);

            ADD64AA(v, c, d);

            // v[b,b+1] = (v[b,b+1] xor v[c,c+1]) rotated right by 63 bits
            xor0 = v[b] ^ v[c];
            xor1 = v[b + 1] ^ v[c + 1];
            v[b] = (xor1 >>> 31) ^ (xor0 << 1);
            v[b + 1] = (xor0 >>> 31) ^ (xor1 << 1);
          }

          // Initialization Vector
          const BLAKE2B_IV32 = new Uint32Array([
            0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b,
            0x3c6ef372, 0x5f1d36f1, 0xa54ff53a, 0xade682d1, 0x510e527f,
            0x2b3e6c1f, 0x9b05688c, 0xfb41bd6b, 0x1f83d9ab, 0x137e2179,
            0x5be0cd19,
          ]);

          const SIGMA8 = [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8,
            9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13,
            10, 14, 3, 6, 7, 1, 9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10,
            4, 0, 15, 8, 9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
            2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9, 12, 5, 1, 15,
            14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11, 13, 11, 7, 14, 12, 1, 3, 9,
            5, 0, 15, 4, 8, 6, 2, 10, 6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7,
            1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8,
            9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3,
          ];

          // These are offsets into a uint64 buffer.
          // Multiply them all by 2 to make them offsets into a uint32 buffer,
          // because this is Javascript and we don't have uint64s
          const SIGMA82 = new Uint8Array(
            SIGMA8.map(function (x) {
              return x * 2;
            })
          );

          // Compression function. 'last' flag indicates last block.
          // Note we're representing 16 uint64s as 32 uint32s
          const v = new Uint32Array(32);
          const m = new Uint32Array(32);
          function blake2bCompress(ctx, last) {
            let i = 0;

            // init work variables
            for (i = 0; i < 16; i++) {
              v[i] = ctx.h[i];
              v[i + 16] = BLAKE2B_IV32[i];
            }

            // low 64 bits of offset
            v[24] = v[24] ^ ctx.t;
            v[25] = v[25] ^ (ctx.t / 0x100000000);
            // high 64 bits not supported, offset may not be higher than 2**53-1

            // last block flag set ?
            if (last) {
              v[28] = ~v[28];
              v[29] = ~v[29];
            }

            // get little-endian words
            for (i = 0; i < 32; i++) {
              m[i] = B2B_GET32(ctx.b, 4 * i);
            }

            // twelve rounds of mixing
            // uncomment the DebugPrint calls to log the computation
            // and match the RFC sample documentation
            // util.debugPrint('          m[16]', m, 64)
            for (i = 0; i < 12; i++) {
              // util.debugPrint('   (i=' + (i < 10 ? ' ' : '') + i + ') v[16]', v, 64)
              B2B_G(0, 8, 16, 24, SIGMA82[i * 16 + 0], SIGMA82[i * 16 + 1]);
              B2B_G(2, 10, 18, 26, SIGMA82[i * 16 + 2], SIGMA82[i * 16 + 3]);
              B2B_G(4, 12, 20, 28, SIGMA82[i * 16 + 4], SIGMA82[i * 16 + 5]);
              B2B_G(6, 14, 22, 30, SIGMA82[i * 16 + 6], SIGMA82[i * 16 + 7]);
              B2B_G(0, 10, 20, 30, SIGMA82[i * 16 + 8], SIGMA82[i * 16 + 9]);
              B2B_G(2, 12, 22, 24, SIGMA82[i * 16 + 10], SIGMA82[i * 16 + 11]);
              B2B_G(4, 14, 16, 26, SIGMA82[i * 16 + 12], SIGMA82[i * 16 + 13]);
              B2B_G(6, 8, 18, 28, SIGMA82[i * 16 + 14], SIGMA82[i * 16 + 15]);
            }
            // util.debugPrint('   (i=12) v[16]', v, 64)

            for (i = 0; i < 16; i++) {
              ctx.h[i] = ctx.h[i] ^ v[i] ^ v[i + 16];
            }
            // util.debugPrint('h[8]', ctx.h, 64)
          }

          // reusable parameterBlock
          const parameterBlock = new Uint8Array([
            0,
            0,
            0,
            0, //  0: outlen, keylen, fanout, depth
            0,
            0,
            0,
            0, //  4: leaf length, sequential mode
            0,
            0,
            0,
            0, //  8: node offset
            0,
            0,
            0,
            0, // 12: node offset
            0,
            0,
            0,
            0, // 16: node depth, inner length, rfu
            0,
            0,
            0,
            0, // 20: rfu
            0,
            0,
            0,
            0, // 24: rfu
            0,
            0,
            0,
            0, // 28: rfu
            0,
            0,
            0,
            0, // 32: salt
            0,
            0,
            0,
            0, // 36: salt
            0,
            0,
            0,
            0, // 40: salt
            0,
            0,
            0,
            0, // 44: salt
            0,
            0,
            0,
            0, // 48: personal
            0,
            0,
            0,
            0, // 52: personal
            0,
            0,
            0,
            0, // 56: personal
            0,
            0,
            0,
            0, // 60: personal
          ]);

          // Creates a BLAKE2b hashing context
          // Requires an output length between 1 and 64 bytes
          // Takes an optional Uint8Array key
          // Takes an optinal Uint8Array salt
          // Takes an optinal Uint8Array personal
          function blake2bInit(outlen, key, salt, personal) {
            if (outlen === 0 || outlen > 64) {
              throw new Error(
                "Illegal output length, expected 0 < length <= 64"
              );
            }
            if (key && key.length > 64) {
              throw new Error(
                "Illegal key, expected Uint8Array with 0 < length <= 64"
              );
            }
            if (salt && salt.length !== 16) {
              throw new Error(
                "Illegal salt, expected Uint8Array with length is 16"
              );
            }
            if (personal && personal.length !== 16) {
              throw new Error(
                "Illegal personal, expected Uint8Array with length is 16"
              );
            }

            // state, 'param block'
            const ctx = {
              b: new Uint8Array(128),
              h: new Uint32Array(16),
              t: 0, // input count
              c: 0, // pointer within buffer
              outlen: outlen, // output length in bytes
            };

            // initialize parameterBlock before usage
            parameterBlock.fill(0);
            parameterBlock[0] = outlen;
            if (key) parameterBlock[1] = key.length;
            parameterBlock[2] = 1; // fanout
            parameterBlock[3] = 1; // depth
            if (salt) parameterBlock.set(salt, 32);
            if (personal) parameterBlock.set(personal, 48);

            // initialize hash state
            for (let i = 0; i < 16; i++) {
              ctx.h[i] = BLAKE2B_IV32[i] ^ B2B_GET32(parameterBlock, i * 4);
            }

            // key the hash, if applicable
            if (key) {
              blake2bUpdate(ctx, key);
              // at the end
              ctx.c = 128;
            }

            return ctx;
          }

          // Updates a BLAKE2b streaming hash
          // Requires hash context and Uint8Array (byte array)
          function blake2bUpdate(ctx, input) {
            for (let i = 0; i < input.length; i++) {
              if (ctx.c === 128) {
                // buffer full ?
                ctx.t += ctx.c; // add counters
                blake2bCompress(ctx, false); // compress (not last)
                ctx.c = 0; // counter to zero
              }
              ctx.b[ctx.c++] = input[i];
            }
          }

          // Completes a BLAKE2b streaming hash
          // Returns a Uint8Array containing the message digest
          function blake2bFinal(ctx) {
            ctx.t += ctx.c; // mark last block offset

            while (ctx.c < 128) {
              // fill up with zeros
              ctx.b[ctx.c++] = 0;
            }
            blake2bCompress(ctx, true); // final block flag = 1

            // little endian convert and store
            const out = new Uint8Array(ctx.outlen);
            for (let i = 0; i < ctx.outlen; i++) {
              out[i] = ctx.h[i >> 2] >> (8 * (i & 3));
            }
            return out;
          }

          // Computes the BLAKE2B hash of a string or byte array, and returns a Uint8Array
          //
          // Returns a n-byte Uint8Array
          //
          // Parameters:
          // - input - the input bytes, as a string, Buffer or Uint8Array
          // - key - optional key Uint8Array, up to 64 bytes
          // - outlen - optional output length in bytes, default 64
          // - salt - optional salt bytes, string, Buffer or Uint8Array
          // - personal - optional personal bytes, string, Buffer or Uint8Array
          function blake2b(input, key, outlen, salt, personal) {
            // preprocess inputs
            outlen = outlen || 64;
            input = util.normalizeInput(input);
            if (salt) {
              salt = util.normalizeInput(salt);
            }
            if (personal) {
              personal = util.normalizeInput(personal);
            }

            // do the math
            const ctx = blake2bInit(outlen, key, salt, personal);
            blake2bUpdate(ctx, input);
            return blake2bFinal(ctx);
          }

          // Computes the BLAKE2B hash of a string or byte array
          //
          // Returns an n-byte hash in hex, all lowercase
          //
          // Parameters:
          // - input - the input bytes, as a string, Buffer, or Uint8Array
          // - key - optional key Uint8Array, up to 64 bytes
          // - outlen - optional output length in bytes, default 64
          // - salt - optional salt bytes, string, Buffer or Uint8Array
          // - personal - optional personal bytes, string, Buffer or Uint8Array
          function blake2bHex(input, key, outlen, salt, personal) {
            const output = blake2b(input, key, outlen, salt, personal);
            return util.toHex(output);
          }

          module.exports = {
            blake2b: blake2b,
            blake2bHex: blake2bHex,
            blake2bInit: blake2bInit,
            blake2bUpdate: blake2bUpdate,
            blake2bFinal: blake2bFinal,
          };
        },
        { "./util": 15 },
      ],
      13: [
        function (require, module, exports) {
          // BLAKE2s hash function in pure Javascript
          // Adapted from the reference implementation in RFC7693
          // Ported to Javascript by DC - https://github.com/dcposch

          const util = require("./util");

          // Little-endian byte access.
          // Expects a Uint8Array and an index
          // Returns the little-endian uint32 at v[i..i+3]
          function B2S_GET32(v, i) {
            return v[i] ^ (v[i + 1] << 8) ^ (v[i + 2] << 16) ^ (v[i + 3] << 24);
          }

          // Mixing function G.
          function B2S_G(a, b, c, d, x, y) {
            v[a] = v[a] + v[b] + x;
            v[d] = ROTR32(v[d] ^ v[a], 16);
            v[c] = v[c] + v[d];
            v[b] = ROTR32(v[b] ^ v[c], 12);
            v[a] = v[a] + v[b] + y;
            v[d] = ROTR32(v[d] ^ v[a], 8);
            v[c] = v[c] + v[d];
            v[b] = ROTR32(v[b] ^ v[c], 7);
          }

          // 32-bit right rotation
          // x should be a uint32
          // y must be between 1 and 31, inclusive
          function ROTR32(x, y) {
            return (x >>> y) ^ (x << (32 - y));
          }

          // Initialization Vector.
          const BLAKE2S_IV = new Uint32Array([
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f,
            0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
          ]);

          const SIGMA = new Uint8Array([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8,
            9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13,
            10, 14, 3, 6, 7, 1, 9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10,
            4, 0, 15, 8, 9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13,
            2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9, 12, 5, 1, 15,
            14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11, 13, 11, 7, 14, 12, 1, 3, 9,
            5, 0, 15, 4, 8, 6, 2, 10, 6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7,
            1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0,
          ]);

          // Compression function. "last" flag indicates last block
          const v = new Uint32Array(16);
          const m = new Uint32Array(16);
          function blake2sCompress(ctx, last) {
            let i = 0;
            for (i = 0; i < 8; i++) {
              // init work variables
              v[i] = ctx.h[i];
              v[i + 8] = BLAKE2S_IV[i];
            }

            v[12] ^= ctx.t; // low 32 bits of offset
            v[13] ^= ctx.t / 0x100000000; // high 32 bits
            if (last) {
              // last block flag set ?
              v[14] = ~v[14];
            }

            for (i = 0; i < 16; i++) {
              // get little-endian words
              m[i] = B2S_GET32(ctx.b, 4 * i);
            }

            // ten rounds of mixing
            // uncomment the DebugPrint calls to log the computation
            // and match the RFC sample documentation
            // util.debugPrint('          m[16]', m, 32)
            for (i = 0; i < 10; i++) {
              // util.debugPrint('   (i=' + i + ')  v[16]', v, 32)
              B2S_G(0, 4, 8, 12, m[SIGMA[i * 16 + 0]], m[SIGMA[i * 16 + 1]]);
              B2S_G(1, 5, 9, 13, m[SIGMA[i * 16 + 2]], m[SIGMA[i * 16 + 3]]);
              B2S_G(2, 6, 10, 14, m[SIGMA[i * 16 + 4]], m[SIGMA[i * 16 + 5]]);
              B2S_G(3, 7, 11, 15, m[SIGMA[i * 16 + 6]], m[SIGMA[i * 16 + 7]]);
              B2S_G(0, 5, 10, 15, m[SIGMA[i * 16 + 8]], m[SIGMA[i * 16 + 9]]);
              B2S_G(1, 6, 11, 12, m[SIGMA[i * 16 + 10]], m[SIGMA[i * 16 + 11]]);
              B2S_G(2, 7, 8, 13, m[SIGMA[i * 16 + 12]], m[SIGMA[i * 16 + 13]]);
              B2S_G(3, 4, 9, 14, m[SIGMA[i * 16 + 14]], m[SIGMA[i * 16 + 15]]);
            }
            // util.debugPrint('   (i=10) v[16]', v, 32)

            for (i = 0; i < 8; i++) {
              ctx.h[i] ^= v[i] ^ v[i + 8];
            }
            // util.debugPrint('h[8]', ctx.h, 32)
          }

          // Creates a BLAKE2s hashing context
          // Requires an output length between 1 and 32 bytes
          // Takes an optional Uint8Array key
          function blake2sInit(outlen, key) {
            if (!(outlen > 0 && outlen <= 32)) {
              throw new Error("Incorrect output length, should be in [1, 32]");
            }
            const keylen = key ? key.length : 0;
            if (key && !(keylen > 0 && keylen <= 32)) {
              throw new Error("Incorrect key length, should be in [1, 32]");
            }

            const ctx = {
              h: new Uint32Array(BLAKE2S_IV), // hash state
              b: new Uint8Array(64), // input block
              c: 0, // pointer within block
              t: 0, // input count
              outlen: outlen, // output length in bytes
            };
            ctx.h[0] ^= 0x01010000 ^ (keylen << 8) ^ outlen;

            if (keylen > 0) {
              blake2sUpdate(ctx, key);
              ctx.c = 64; // at the end
            }

            return ctx;
          }

          // Updates a BLAKE2s streaming hash
          // Requires hash context and Uint8Array (byte array)
          function blake2sUpdate(ctx, input) {
            for (let i = 0; i < input.length; i++) {
              if (ctx.c === 64) {
                // buffer full ?
                ctx.t += ctx.c; // add counters
                blake2sCompress(ctx, false); // compress (not last)
                ctx.c = 0; // counter to zero
              }
              ctx.b[ctx.c++] = input[i];
            }
          }

          // Completes a BLAKE2s streaming hash
          // Returns a Uint8Array containing the message digest
          function blake2sFinal(ctx) {
            ctx.t += ctx.c; // mark last block offset
            while (ctx.c < 64) {
              // fill up with zeros
              ctx.b[ctx.c++] = 0;
            }
            blake2sCompress(ctx, true); // final block flag = 1

            // little endian convert and store
            const out = new Uint8Array(ctx.outlen);
            for (let i = 0; i < ctx.outlen; i++) {
              out[i] = (ctx.h[i >> 2] >> (8 * (i & 3))) & 0xff;
            }
            return out;
          }

          // Computes the BLAKE2S hash of a string or byte array, and returns a Uint8Array
          //
          // Returns a n-byte Uint8Array
          //
          // Parameters:
          // - input - the input bytes, as a string, Buffer, or Uint8Array
          // - key - optional key Uint8Array, up to 32 bytes
          // - outlen - optional output length in bytes, default 64
          function blake2s(input, key, outlen) {
            // preprocess inputs
            outlen = outlen || 32;
            input = util.normalizeInput(input);

            // do the math
            const ctx = blake2sInit(outlen, key);
            blake2sUpdate(ctx, input);
            return blake2sFinal(ctx);
          }

          // Computes the BLAKE2S hash of a string or byte array
          //
          // Returns an n-byte hash in hex, all lowercase
          //
          // Parameters:
          // - input - the input bytes, as a string, Buffer, or Uint8Array
          // - key - optional key Uint8Array, up to 32 bytes
          // - outlen - optional output length in bytes, default 64
          function blake2sHex(input, key, outlen) {
            const output = blake2s(input, key, outlen);
            return util.toHex(output);
          }

          module.exports = {
            blake2s: blake2s,
            blake2sHex: blake2sHex,
            blake2sInit: blake2sInit,
            blake2sUpdate: blake2sUpdate,
            blake2sFinal: blake2sFinal,
          };
        },
        { "./util": 15 },
      ],
      14: [
        function (require, module, exports) {
          const b2b = require("./blake2b");
          const b2s = require("./blake2s");

          module.exports = {
            blake2b: b2b.blake2b,
            blake2bHex: b2b.blake2bHex,
            blake2bInit: b2b.blake2bInit,
            blake2bUpdate: b2b.blake2bUpdate,
            blake2bFinal: b2b.blake2bFinal,
            blake2s: b2s.blake2s,
            blake2sHex: b2s.blake2sHex,
            blake2sInit: b2s.blake2sInit,
            blake2sUpdate: b2s.blake2sUpdate,
            blake2sFinal: b2s.blake2sFinal,
          };
        },
        { "./blake2b": 12, "./blake2s": 13 },
      ],
      15: [
        function (require, module, exports) {
          const ERROR_MSG_INPUT =
            "Input must be an string, Buffer or Uint8Array";

          // For convenience, let people hash a string, not just a Uint8Array
          function normalizeInput(input) {
            let ret;
            if (input instanceof Uint8Array) {
              ret = input;
            } else if (typeof input === "string") {
              const encoder = new TextEncoder();
              ret = encoder.encode(input);
            } else {
              throw new Error(ERROR_MSG_INPUT);
            }
            return ret;
          }

          // Converts a Uint8Array to a hexadecimal string
          // For example, toHex([255, 0, 255]) returns "ff00ff"
          function toHex(bytes) {
            return Array.prototype.map
              .call(bytes, function (n) {
                return (n < 16 ? "0" : "") + n.toString(16);
              })
              .join("");
          }

          // Converts any value in [0...2^32-1] to an 8-character hex string
          function uint32ToHex(val) {
            return (0x100000000 + val).toString(16).substring(1);
          }

          // For debugging: prints out hash state in the same format as the RFC
          // sample computation exactly, so that you can diff
          function debugPrint(label, arr, size) {
            let msg = "\n" + label + " = ";
            for (let i = 0; i < arr.length; i += 2) {
              if (size === 32) {
                msg += uint32ToHex(arr[i]).toUpperCase();
                msg += " ";
                msg += uint32ToHex(arr[i + 1]).toUpperCase();
              } else if (size === 64) {
                msg += uint32ToHex(arr[i + 1]).toUpperCase();
                msg += uint32ToHex(arr[i]).toUpperCase();
              } else throw new Error("Invalid size " + size);
              if (i % 6 === 4) {
                msg += "\n" + new Array(label.length + 4).join(" ");
              } else if (i < arr.length - 2) {
                msg += " ";
              }
            }
            console.log(msg);
          }

          // For performance testing: generates N bytes of input, hashes M times
          // Measures and prints MB/second hash performance each time
          function testSpeed(hashFn, N, M) {
            let startMs = new Date().getTime();

            const input = new Uint8Array(N);
            for (let i = 0; i < N; i++) {
              input[i] = i % 256;
            }
            const genMs = new Date().getTime();
            console.log(
              "Generated random input in " + (genMs - startMs) + "ms"
            );
            startMs = genMs;

            for (let i = 0; i < M; i++) {
              const hashHex = hashFn(input);
              const hashMs = new Date().getTime();
              const ms = hashMs - startMs;
              startMs = hashMs;
              console.log(
                "Hashed in " + ms + "ms: " + hashHex.substring(0, 20) + "..."
              );
              console.log(
                Math.round((N / (1 << 20) / (ms / 1000)) * 100) / 100 +
                  " MB PER SECOND"
              );
            }
          }

          module.exports = {
            normalizeInput: normalizeInput,
            toHex: toHex,
            debugPrint: debugPrint,
            testSpeed: testSpeed,
          };
        },
        {},
      ],
      16: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var asUint8array = require("./util/as-uint8array.js");

          function alloc(size = 0) {
            if (globalThis.Buffer != null && globalThis.Buffer.alloc != null) {
              return asUint8array.asUint8Array(globalThis.Buffer.alloc(size));
            }
            return new Uint8Array(size);
          }
          function allocUnsafe(size = 0) {
            if (
              globalThis.Buffer != null &&
              globalThis.Buffer.allocUnsafe != null
            ) {
              return asUint8array.asUint8Array(
                globalThis.Buffer.allocUnsafe(size)
              );
            }
            return new Uint8Array(size);
          }

          exports.alloc = alloc;
          exports.allocUnsafe = allocUnsafe;
        },
        { "./util/as-uint8array.js": 20 },
      ],
      17: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var alloc = require("./alloc.js");
          var asUint8array = require("./util/as-uint8array.js");

          function concat(arrays, length) {
            if (!length) {
              length = arrays.reduce((acc, curr) => acc + curr.length, 0);
            }
            const output = alloc.allocUnsafe(length);
            let offset = 0;
            for (const arr of arrays) {
              output.set(arr, offset);
              offset += arr.length;
            }
            return asUint8array.asUint8Array(output);
          }

          exports.concat = concat;
        },
        { "./alloc.js": 16, "./util/as-uint8array.js": 20 },
      ],
      18: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          function equals(a, b) {
            if (a === b) {
              return true;
            }
            if (a.byteLength !== b.byteLength) {
              return false;
            }
            for (let i = 0; i < a.byteLength; i++) {
              if (a[i] !== b[i]) {
                return false;
              }
            }
            return true;
          }

          exports.equals = equals;
        },
        {},
      ],
      19: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var bases = require("./util/bases.js");

          function toString(array, encoding = "utf8") {
            const base = bases[encoding];
            if (!base) {
              throw new Error(`Unsupported encoding "${encoding}"`);
            }
            if (
              (encoding === "utf8" || encoding === "utf-8") &&
              globalThis.Buffer != null &&
              globalThis.Buffer.from != null
            ) {
              return globalThis.Buffer.from(
                array.buffer,
                array.byteOffset,
                array.byteLength
              ).toString("utf8");
            }
            return base.encoder.encode(array).substring(1);
          }

          exports.toString = toString;
        },
        { "./util/bases.js": 21 },
      ],
      20: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          function asUint8Array(buf) {
            if (globalThis.Buffer != null) {
              return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
            }
            return buf;
          }

          exports.asUint8Array = asUint8Array;
        },
        {},
      ],
      21: [
        function (require, module, exports) {
          "use strict";

          var basics = require("multiformats/basics");
          var alloc = require("../alloc.js");

          function createCodec(name, prefix, encode, decode) {
            return {
              name,
              prefix,
              encoder: {
                name,
                prefix,
                encode,
              },
              decoder: { decode },
            };
          }
          const string = createCodec(
            "utf8",
            "u",
            (buf) => {
              const decoder = new TextDecoder("utf8");
              return "u" + decoder.decode(buf);
            },
            (str) => {
              const encoder = new TextEncoder();
              return encoder.encode(str.substring(1));
            }
          );
          const ascii = createCodec(
            "ascii",
            "a",
            (buf) => {
              let string = "a";
              for (let i = 0; i < buf.length; i++) {
                string += String.fromCharCode(buf[i]);
              }
              return string;
            },
            (str) => {
              str = str.substring(1);
              const buf = alloc.allocUnsafe(str.length);
              for (let i = 0; i < str.length; i++) {
                buf[i] = str.charCodeAt(i);
              }
              return buf;
            }
          );
          const BASES = {
            utf8: string,
            "utf-8": string,
            hex: basics.bases.base16,
            latin1: ascii,
            ascii: ascii,
            binary: ascii,
            ...basics.bases,
          };

          module.exports = BASES;
        },
        { "../alloc.js": 16, "multiformats/basics": 101 },
      ],
      22: [
        function (require, module, exports) {
          "use strict";

          const mh = require("multihashes");

          const CIDUtil = {
            /**
             * Test if the given input is a valid CID object.
             * Returns an error message if it is not.
             * Returns undefined if it is a valid CID.
             *
             * @param {any} other
             * @returns {string|undefined}
             */
            checkCIDComponents: function (other) {
              if (other == null) {
                return "null values are not valid CIDs";
              }

              if (!(other.version === 0 || other.version === 1)) {
                return "Invalid version, must be a number equal to 1 or 0";
              }

              if (typeof other.codec !== "string") {
                return "codec must be string";
              }

              if (other.version === 0) {
                if (other.codec !== "dag-pb") {
                  return "codec must be 'dag-pb' for CIDv0";
                }
                if (other.multibaseName !== "base58btc") {
                  return "multibaseName must be 'base58btc' for CIDv0";
                }
              }

              if (!(other.multihash instanceof Uint8Array)) {
                return "multihash must be a Uint8Array";
              }

              try {
                mh.validate(other.multihash);
              } catch (err) {
                let errorMsg = err.message;
                if (!errorMsg) {
                  // Just in case mh.validate() throws an error with empty error message
                  errorMsg = "Multihash validation failed";
                }
                return errorMsg;
              }
            },
          };

          module.exports = CIDUtil;
        },
        { multihashes: 125 },
      ],
      23: [
        function (require, module, exports) {
          "use strict";

          const mh = require("multihashes");
          const multibase = require("multibase");
          const multicodec = require("multicodec");
          const CIDUtil = require("./cid-util");
          const { concat: uint8ArrayConcat } = require("uint8arrays/concat");
          const {
            toString: uint8ArrayToString,
          } = require("uint8arrays/to-string");
          const { equals: uint8ArrayEquals } = require("uint8arrays/equals");

          const codecs = multicodec.nameToCode;
          const codecInts = /** @type {CodecName[]} */ (
            Object.keys(codecs)
          ).reduce((p, name) => {
            p[codecs[name]] = name;
            return p;
          }, /** @type {Record<CodecCode, CodecName>} */ ({}));

          const symbol = Symbol.for("@ipld/js-cid/CID");

          /**
           * @typedef {Object} SerializedCID
           * @property {string} codec
           * @property {number} version
           * @property {Uint8Array} hash
           */
          /**
           * @typedef {0|1} CIDVersion
           * @typedef {import('multibase').BaseNameOrCode} BaseNameOrCode
           * @typedef {import('multicodec').CodecName} CodecName
           * @typedef {import('multicodec').CodecCode} CodecCode
           */

          /**
           * Class representing a CID `<mbase><version><mcodec><mhash>`
           * , as defined in [ipld/cid](https://github.com/multiformats/cid).
           *
           * @class CID
           */
          class CID {
            /**
             * Create a new CID.
             *
             * The algorithm for argument input is roughly:
             * ```
             * if (cid)
             *   -> create a copy
             * else if (str)
             *   if (1st char is on multibase table) -> CID String
             *   else -> bs58 encoded multihash
             * else if (Uint8Array)
             *   if (1st byte is 0 or 1) -> CID
             *   else -> multihash
             * else if (Number)
             *   -> construct CID by parts
             * ```
             *
             * @param {CIDVersion | string | Uint8Array | CID} version
             * @param {string|number} [codec]
             * @param {Uint8Array} [multihash]
             * @param {string} [multibaseName]
             *
             * @example
             * new CID(<version>, <codec>, <multihash>, <multibaseName>)
             * new CID(<cidStr>)
             * new CID(<cid.bytes>)
             * new CID(<multihash>)
             * new CID(<bs58 encoded multihash>)
             * new CID(<cid>)
             */
            constructor(version, codec, multihash, multibaseName) {
              // We have below three blank field accessors only because
              // otherwise TS will not pick them up if done after assignemnts

              /**
               * The version of the CID.
               *
               * @type {CIDVersion}
               */
              // eslint-disable-next-line no-unused-expressions
              this.version;

              /**
               * The codec of the CID.
               *
               * @deprecated
               * @type {CodecName}
               */
              // eslint-disable-next-line no-unused-expressions
              this.codec;

              /**
               * The multihash of the CID.
               *
               * @type {Uint8Array}
               */
              // eslint-disable-next-line no-unused-expressions
              this.multihash;

              Object.defineProperty(this, symbol, { value: true });
              if (CID.isCID(version)) {
                // version is an exising CID instance
                const cid = /** @type {CID} */ (version);
                this.version = cid.version;
                this.codec = cid.codec;
                this.multihash = cid.multihash;
                // Default guard for when a CID < 0.7 is passed with no multibaseName
                // @ts-ignore
                this.multibaseName =
                  cid.multibaseName ||
                  (cid.version === 0 ? "base58btc" : "base32");
                return;
              }

              if (typeof version === "string") {
                // e.g. 'base32' or false
                const baseName = multibase.isEncoded(version);
                if (baseName) {
                  // version is a CID String encoded with multibase, so v1
                  const cid = multibase.decode(version);
                  this.version = /** @type {CIDVersion} */ (
                    parseInt(cid[0].toString(), 16)
                  );
                  this.codec = multicodec.getCodec(cid.slice(1));
                  this.multihash = multicodec.rmPrefix(cid.slice(1));
                  this.multibaseName = baseName;
                } else {
                  // version is a base58btc string multihash, so v0
                  this.version = 0;
                  this.codec = "dag-pb";
                  this.multihash = mh.fromB58String(version);
                  this.multibaseName = "base58btc";
                }
                CID.validateCID(this);
                Object.defineProperty(this, "string", { value: version });
                return;
              }

              if (version instanceof Uint8Array) {
                const v = parseInt(version[0].toString(), 16);
                if (v === 1) {
                  // version is a CID Uint8Array
                  const cid = version;
                  this.version = v;
                  this.codec = multicodec.getCodec(cid.slice(1));
                  this.multihash = multicodec.rmPrefix(cid.slice(1));
                  this.multibaseName = "base32";
                } else {
                  // version is a raw multihash Uint8Array, so v0
                  this.version = 0;
                  this.codec = "dag-pb";
                  this.multihash = version;
                  this.multibaseName = "base58btc";
                }
                CID.validateCID(this);
                return;
              }

              // otherwise, assemble the CID from the parameters

              this.version = version;

              if (typeof codec === "number") {
                // @ts-ignore
                codec = codecInts[codec];
              }

              this.codec = /** @type {CodecName} */ (codec);

              this.multihash = /** @type {Uint8Array} */ (multihash);

              /**
               * Multibase name as string.
               *
               * @deprecated
               * @type {string}
               */
              this.multibaseName =
                multibaseName || (version === 0 ? "base58btc" : "base32");

              CID.validateCID(this);
            }

            /**
             * The CID as a `Uint8Array`
             *
             * @returns {Uint8Array}
             *
             */
            get bytes() {
              // @ts-ignore
              let bytes = this._bytes;

              if (!bytes) {
                if (this.version === 0) {
                  bytes = this.multihash;
                } else if (this.version === 1) {
                  const codec = multicodec.getCodeVarint(this.codec);
                  bytes = uint8ArrayConcat(
                    [[1], codec, this.multihash],
                    1 + codec.byteLength + this.multihash.byteLength
                  );
                } else {
                  throw new Error("unsupported version");
                }

                // Cache this Uint8Array so it doesn't have to be recreated
                Object.defineProperty(this, "_bytes", { value: bytes });
              }

              return bytes;
            }

            /**
             * The prefix of the CID.
             *
             * @returns {Uint8Array}
             */
            get prefix() {
              const codec = multicodec.getCodeVarint(this.codec);
              const multihash = mh.prefix(this.multihash);
              const prefix = uint8ArrayConcat(
                [[this.version], codec, multihash],
                1 + codec.byteLength + multihash.byteLength
              );

              return prefix;
            }

            /**
             * The codec of the CID in its number form.
             *
             * @returns {CodecCode}
             */
            get code() {
              return codecs[this.codec];
            }

            /**
             * Convert to a CID of version `0`.
             *
             * @returns {CID}
             */
            toV0() {
              if (this.codec !== "dag-pb") {
                throw new Error("Cannot convert a non dag-pb CID to CIDv0");
              }

              const { name, length } = mh.decode(this.multihash);

              if (name !== "sha2-256") {
                throw new Error(
                  "Cannot convert non sha2-256 multihash CID to CIDv0"
                );
              }

              if (length !== 32) {
                throw new Error(
                  "Cannot convert non 32 byte multihash CID to CIDv0"
                );
              }

              return new CID(0, this.codec, this.multihash);
            }

            /**
             * Convert to a CID of version `1`.
             *
             * @returns {CID}
             */
            toV1() {
              return new CID(1, this.codec, this.multihash, this.multibaseName);
            }

            /**
             * Encode the CID into a string.
             *
             * @param {BaseNameOrCode} [base=this.multibaseName] - Base encoding to use.
             * @returns {string}
             */
            toBaseEncodedString(base = this.multibaseName) {
              // @ts-ignore non enumerable cache property
              if (
                this.string &&
                this.string.length !== 0 &&
                base === this.multibaseName
              ) {
                // @ts-ignore non enumerable cache property
                return this.string;
              }
              let str;
              if (this.version === 0) {
                if (base !== "base58btc") {
                  throw new Error(
                    "not supported with CIDv0, to support different bases, please migrate the instance do CIDv1, you can do that through cid.toV1()"
                  );
                }
                str = mh.toB58String(this.multihash);
              } else if (this.version === 1) {
                str = uint8ArrayToString(multibase.encode(base, this.bytes));
              } else {
                throw new Error("unsupported version");
              }
              if (base === this.multibaseName) {
                // cache the string value
                Object.defineProperty(this, "string", { value: str });
              }
              return str;
            }

            /**
             * CID(QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n)
             *
             * @returns {string}
             */
            [Symbol.for("nodejs.util.inspect.custom")]() {
              return "CID(" + this.toString() + ")";
            }

            /**
             * Encode the CID into a string.
             *
             * @param {BaseNameOrCode} [base=this.multibaseName] - Base encoding to use.
             * @returns {string}
             */
            toString(base) {
              return this.toBaseEncodedString(base);
            }

            /**
             * Serialize to a plain object.
             *
             * @returns {SerializedCID}
             */
            toJSON() {
              return {
                codec: this.codec,
                version: this.version,
                hash: this.multihash,
              };
            }

            /**
             * Compare equality with another CID.
             *
             * @param {CID} other
             * @returns {boolean}
             */
            equals(other) {
              return (
                this.codec === other.codec &&
                this.version === other.version &&
                uint8ArrayEquals(this.multihash, other.multihash)
              );
            }

            /**
             * Test if the given input is a valid CID object.
             * Throws if it is not.
             *
             * @param {any} other - The other CID.
             * @returns {void}
             */
            static validateCID(other) {
              const errorMsg = CIDUtil.checkCIDComponents(other);
              if (errorMsg) {
                throw new Error(errorMsg);
              }
            }

            /**
             * Check if object is a CID instance
             *
             * @param {any} value
             * @returns {value is CID}
             */
            static isCID(value) {
              return value instanceof CID || Boolean(value && value[symbol]);
            }
          }

          CID.codecs = codecs;

          module.exports = CID;
        },
        {
          "./cid-util": 22,
          multibase: 77,
          multicodec: 87,
          multihashes: 125,
          "uint8arrays/concat": 17,
          "uint8arrays/equals": 18,
          "uint8arrays/to-string": 19,
        },
      ],
      24: [
        function (require, module, exports) {
          "use strict";

          /**
           * @typedef {{ [key: string]: any }} Extensions
           * @typedef {Error} Err
           * @property {string} message
           */

          /**
           *
           * @param {Error} obj
           * @param {Extensions} props
           * @returns {Error & Extensions}
           */
          function assign(obj, props) {
            for (const key in props) {
              Object.defineProperty(obj, key, {
                value: props[key],
                enumerable: true,
                configurable: true,
              });
            }

            return obj;
          }

          /**
           *
           * @param {any} err - An Error
           * @param {string|Extensions} code - A string code or props to set on the error
           * @param {Extensions} [props] - Props to set on the error
           * @returns {Error & Extensions}
           */
          function createError(err, code, props) {
            if (!err || typeof err === "string") {
              throw new TypeError("Please pass an Error to err-code");
            }

            if (!props) {
              props = {};
            }

            if (typeof code === "object") {
              props = code;
              code = "";
            }

            if (code) {
              props.code = code;
            }

            try {
              return assign(err, props);
            } catch (_) {
              props.message = err.message;
              props.stack = err.stack;

              const ErrClass = function () {};

              ErrClass.prototype = Object.create(Object.getPrototypeOf(err));

              // @ts-ignore
              const output = assign(new ErrClass(), props);

              return output;
            }
          }

          module.exports = createError;
        },
        {},
      ],
      25: [
        function (require, module, exports) {
          arguments[4][16][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 28, dup: 16 },
      ],
      26: [
        function (require, module, exports) {
          arguments[4][17][0].apply(exports, arguments);
        },
        { "./alloc.js": 25, "./util/as-uint8array.js": 28, dup: 17 },
      ],
      27: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var bases = require("./util/bases.js");
          var asUint8array = require("./util/as-uint8array.js");

          function fromString(string, encoding = "utf8") {
            const base = bases[encoding];
            if (!base) {
              throw new Error(`Unsupported encoding "${encoding}"`);
            }
            if (
              (encoding === "utf8" || encoding === "utf-8") &&
              globalThis.Buffer != null &&
              globalThis.Buffer.from != null
            ) {
              return asUint8array.asUint8Array(
                globalThis.Buffer.from(string, "utf-8")
              );
            }
            return base.decoder.decode(`${base.prefix}${string}`);
          }

          exports.fromString = fromString;
        },
        { "./util/as-uint8array.js": 28, "./util/bases.js": 29 },
      ],
      28: [
        function (require, module, exports) {
          arguments[4][20][0].apply(exports, arguments);
        },
        { dup: 20 },
      ],
      29: [
        function (require, module, exports) {
          arguments[4][21][0].apply(exports, arguments);
        },
        { "../alloc.js": 25, dup: 21, "multiformats/basics": 101 },
      ],
      30: [
        function (require, module, exports) {
          "use strict";

          // @ts-ignore
          const SparseArray = require("sparse-array");
          const {
            fromString: uint8ArrayFromString,
          } = require("uint8arrays/from-string");

          /**
           * @typedef {import('./consumable-hash').InfiniteHash} InfiniteHash
           * @typedef {import('../').UserBucketOptions} UserBucketOptions
           */

          /**
           * @template V
           * @typedef {object} BucketChild<V>
           * @property {string} key
           * @property {V} value
           * @property {InfiniteHash} hash
           */

          /**
           * @template B
           *
           * @typedef {object} SA<B>
           * @property {number} length
           * @property {() => B[]} compactArray
           * @property {(i: number) => B} get
           * @property {(i: number, value: B) => void} set
           * @property {<A> (fn: (acc: A, curr: B, index: number) => A, initial: A) => B} reduce
           * @property {(fn: (item: B) => boolean) => B | undefined} find
           * @property {() => number[]} bitField
           * @property {(i: number) => void} unset
           */

          /**
           * @template T
           *
           * @typedef {object} BucketPosition<T>
           * @property {Bucket<T>} bucket
           * @property {number} pos
           * @property {InfiniteHash} hash
           * @property {BucketChild<T>} [existingChild]
           */

          /**
           * @typedef {object} BucketOptions
           * @property {number} bits
           * @property {(value: Uint8Array | InfiniteHash) => InfiniteHash} hash
           */

          /**
           * @template T
           */
          class Bucket {
            /**
             * @param {BucketOptions} options
             * @param {Bucket<T>} [parent]
             * @param {number} [posAtParent=0]
             */
            constructor(options, parent, posAtParent = 0) {
              this._options = options;
              this._popCount = 0;
              this._parent = parent;
              this._posAtParent = posAtParent;

              /** @type {SA<Bucket<T> | BucketChild<T>>} */
              this._children = new SparseArray();

              /** @type {string | null} */
              this.key = null;
            }

            /**
             * @param {string} key
             * @param {T} value
             */
            async put(key, value) {
              const place = await this._findNewBucketAndPos(key);

              await place.bucket._putAt(place, key, value);
            }

            /**
             * @param {string} key
             */
            async get(key) {
              const child = await this._findChild(key);

              if (child) {
                return child.value;
              }
            }

            /**
             * @param {string} key
             */
            async del(key) {
              const place = await this._findPlace(key);
              const child = place.bucket._at(place.pos);

              if (child && child.key === key) {
                place.bucket._delAt(place.pos);
              }
            }

            /**
             * @returns {number}
             */
            leafCount() {
              const children = this._children.compactArray();

              return children.reduce((acc, child) => {
                if (child instanceof Bucket) {
                  return acc + child.leafCount();
                }

                return acc + 1;
              }, 0);
            }

            childrenCount() {
              return this._children.length;
            }

            onlyChild() {
              return this._children.get(0);
            }

            /**
             * @returns {Iterable<BucketChild<T>>}
             */
            *eachLeafSeries() {
              const children = this._children.compactArray();

              for (const child of children) {
                if (child instanceof Bucket) {
                  yield* child.eachLeafSeries();
                } else {
                  yield child;
                }
              }

              // this is necessary because tsc requires a @return annotation as it
              // can't derive a return type due to the recursion, and eslint requires
              // a return statement when there is a @return annotation
              return [];
            }

            /**
             * @param {(value: BucketChild<T>, index: number) => T} map
             * @param {(reduced: any) => any} reduce
             */
            serialize(map, reduce) {
              /** @type {T[]} */
              const acc = [];
              // serialize to a custom non-sparse representation
              return reduce(
                this._children.reduce((acc, child, index) => {
                  if (child) {
                    if (child instanceof Bucket) {
                      acc.push(child.serialize(map, reduce));
                    } else {
                      acc.push(map(child, index));
                    }
                  }
                  return acc;
                }, acc)
              );
            }

            /**
             * @param {(value: BucketChild<T>) => Promise<T[]>} asyncMap
             * @param {(reduced: any) => Promise<any>} asyncReduce
             */
            asyncTransform(asyncMap, asyncReduce) {
              return asyncTransformBucket(this, asyncMap, asyncReduce);
            }

            toJSON() {
              return this.serialize(mapNode, reduceNodes);
            }

            prettyPrint() {
              return JSON.stringify(this.toJSON(), null, "  ");
            }

            tableSize() {
              return Math.pow(2, this._options.bits);
            }

            /**
             * @param {string} key
             * @returns {Promise<BucketChild<T> | undefined>}
             */
            async _findChild(key) {
              const result = await this._findPlace(key);
              const child = result.bucket._at(result.pos);

              if (child instanceof Bucket) {
                // should not be possible, this._findPlace should always
                // return a location for a child, not a bucket
                return undefined;
              }

              if (child && child.key === key) {
                return child;
              }
            }

            /**
             * @param {string | InfiniteHash} key
             * @returns {Promise<BucketPosition<T>>}
             */
            async _findPlace(key) {
              const hashValue = this._options.hash(
                typeof key === "string" ? uint8ArrayFromString(key) : key
              );
              const index = await hashValue.take(this._options.bits);

              const child = this._children.get(index);

              if (child instanceof Bucket) {
                return child._findPlace(hashValue);
              }

              return {
                bucket: this,
                pos: index,
                hash: hashValue,
                existingChild: child,
              };
            }

            /**
             * @param {string | InfiniteHash} key
             * @returns {Promise<BucketPosition<T>>}
             */
            async _findNewBucketAndPos(key) {
              const place = await this._findPlace(key);

              if (place.existingChild && place.existingChild.key !== key) {
                // conflict
                const bucket = new Bucket(
                  this._options,
                  place.bucket,
                  place.pos
                );
                place.bucket._putObjectAt(place.pos, bucket);

                // put the previous value
                const newPlace = await bucket._findPlace(
                  place.existingChild.hash
                );
                newPlace.bucket._putAt(
                  newPlace,
                  place.existingChild.key,
                  place.existingChild.value
                );

                return bucket._findNewBucketAndPos(place.hash);
              }

              // no conflict, we found the place
              return place;
            }

            /**
             * @param {BucketPosition<T>} place
             * @param {string} key
             * @param {T} value
             */
            _putAt(place, key, value) {
              this._putObjectAt(place.pos, {
                key: key,
                value: value,
                hash: place.hash,
              });
            }

            /**
             * @param {number} pos
             * @param {Bucket<T> | BucketChild<T>} object
             */
            _putObjectAt(pos, object) {
              if (!this._children.get(pos)) {
                this._popCount++;
              }
              this._children.set(pos, object);
            }

            /**
             * @param {number} pos
             */
            _delAt(pos) {
              if (pos === -1) {
                throw new Error("Invalid position");
              }

              if (this._children.get(pos)) {
                this._popCount--;
              }
              this._children.unset(pos);
              this._level();
            }

            _level() {
              if (this._parent && this._popCount <= 1) {
                if (this._popCount === 1) {
                  // remove myself from parent, replacing me with my only child
                  const onlyChild = this._children.find(exists);

                  if (onlyChild && !(onlyChild instanceof Bucket)) {
                    const hash = onlyChild.hash;
                    hash.untake(this._options.bits);
                    const place = {
                      pos: this._posAtParent,
                      hash: hash,
                      bucket: this._parent,
                    };
                    this._parent._putAt(place, onlyChild.key, onlyChild.value);
                  }
                } else {
                  this._parent._delAt(this._posAtParent);
                }
              }
            }

            /**
             * @param {number} index
             * @returns {BucketChild<T> | Bucket<T> | undefined}
             */
            _at(index) {
              return this._children.get(index);
            }
          }

          /**
           * @param {any} o
           */
          function exists(o) {
            return Boolean(o);
          }

          /**
           *
           * @param {*} node
           * @param {number} index
           */
          function mapNode(node, index) {
            return node.key;
          }

          /**
           * @param {*} nodes
           */
          function reduceNodes(nodes) {
            return nodes;
          }

          /**
           * @template T
           *
           * @param {Bucket<T>} bucket
           * @param {(value: BucketChild<T>) => Promise<T[]>} asyncMap
           * @param {(reduced: any) => Promise<any>} asyncReduce
           */
          async function asyncTransformBucket(bucket, asyncMap, asyncReduce) {
            const output = [];

            for (const child of bucket._children.compactArray()) {
              if (child instanceof Bucket) {
                await asyncTransformBucket(child, asyncMap, asyncReduce);
              } else {
                const mappedChildren = await asyncMap(child);

                output.push({
                  bitField: bucket._children.bitField(),
                  children: mappedChildren,
                });
              }
            }

            return asyncReduce(output);
          }

          module.exports = Bucket;
        },
        { "sparse-array": 152, "uint8arrays/from-string": 27 },
      ],
      31: [
        function (require, module, exports) {
          "use strict";

          const START_MASKS = [
            0b11111111, 0b11111110, 0b11111100, 0b11111000, 0b11110000,
            0b11100000, 0b11000000, 0b10000000,
          ];

          const STOP_MASKS = [
            0b00000001, 0b00000011, 0b00000111, 0b00001111, 0b00011111,
            0b00111111, 0b01111111, 0b11111111,
          ];

          module.exports = class ConsumableBuffer {
            /**
             * @param {Uint8Array} value
             */
            constructor(value) {
              this._value = value;
              this._currentBytePos = value.length - 1;
              this._currentBitPos = 7;
            }

            availableBits() {
              return this._currentBitPos + 1 + this._currentBytePos * 8;
            }

            totalBits() {
              return this._value.length * 8;
            }

            /**
             * @param {number} bits
             */
            take(bits) {
              let pendingBits = bits;
              let result = 0;
              while (pendingBits && this._haveBits()) {
                const byte = this._value[this._currentBytePos];
                const availableBits = this._currentBitPos + 1;
                const taking = Math.min(availableBits, pendingBits);
                const value = byteBitsToInt(
                  byte,
                  availableBits - taking,
                  taking
                );
                result = (result << taking) + value;

                pendingBits -= taking;

                this._currentBitPos -= taking;
                if (this._currentBitPos < 0) {
                  this._currentBitPos = 7;
                  this._currentBytePos--;
                }
              }

              return result;
            }

            /**
             * @param {number} bits
             */
            untake(bits) {
              this._currentBitPos += bits;
              while (this._currentBitPos > 7) {
                this._currentBitPos -= 8;
                this._currentBytePos += 1;
              }
            }

            _haveBits() {
              return this._currentBytePos >= 0;
            }
          };

          /**
           * @param {number} byte
           * @param {number} start
           * @param {number} length
           */
          function byteBitsToInt(byte, start, length) {
            const mask = maskFor(start, length);
            return (byte & mask) >>> start;
          }

          /**
           * @param {number} start
           * @param {number} length
           */
          function maskFor(start, length) {
            return (
              START_MASKS[start] & STOP_MASKS[Math.min(length + start - 1, 7)]
            );
          }
        },
        {},
      ],
      32: [
        function (require, module, exports) {
          "use strict";

          const ConsumableBuffer = require("./consumable-buffer");
          const { concat: uint8ArrayConcat } = require("uint8arrays/concat");

          /**
           * @param {(value: Uint8Array) => Promise<Uint8Array>} hashFn
           */
          function wrapHash(hashFn) {
            /**
             * @param {InfiniteHash | Uint8Array} value
             */
            function hashing(value) {
              if (value instanceof InfiniteHash) {
                // already a hash. return it
                return value;
              } else {
                return new InfiniteHash(value, hashFn);
              }
            }

            return hashing;
          }

          class InfiniteHash {
            /**
             *
             * @param {Uint8Array} value
             * @param {(value: Uint8Array) => Promise<Uint8Array>} hashFn
             */
            constructor(value, hashFn) {
              if (!(value instanceof Uint8Array)) {
                throw new Error("can only hash Uint8Arrays");
              }

              this._value = value;
              this._hashFn = hashFn;
              this._depth = -1;
              this._availableBits = 0;
              this._currentBufferIndex = 0;

              /** @type {ConsumableBuffer[]} */
              this._buffers = [];
            }

            /**
             * @param {number} bits
             */
            async take(bits) {
              let pendingBits = bits;

              while (this._availableBits < pendingBits) {
                await this._produceMoreBits();
              }

              let result = 0;

              while (pendingBits > 0) {
                const hash = this._buffers[this._currentBufferIndex];
                const available = Math.min(hash.availableBits(), pendingBits);
                const took = hash.take(available);
                result = (result << available) + took;
                pendingBits -= available;
                this._availableBits -= available;

                if (hash.availableBits() === 0) {
                  this._currentBufferIndex++;
                }
              }

              return result;
            }

            /**
             * @param {number} bits
             */
            untake(bits) {
              let pendingBits = bits;

              while (pendingBits > 0) {
                const hash = this._buffers[this._currentBufferIndex];
                const availableForUntake = Math.min(
                  hash.totalBits() - hash.availableBits(),
                  pendingBits
                );
                hash.untake(availableForUntake);
                pendingBits -= availableForUntake;
                this._availableBits += availableForUntake;

                if (
                  this._currentBufferIndex > 0 &&
                  hash.totalBits() === hash.availableBits()
                ) {
                  this._depth--;
                  this._currentBufferIndex--;
                }
              }
            }

            async _produceMoreBits() {
              this._depth++;

              const value = this._depth
                ? uint8ArrayConcat([
                    this._value,
                    Uint8Array.from([this._depth]),
                  ])
                : this._value;
              const hashValue = await this._hashFn(value);
              const buffer = new ConsumableBuffer(hashValue);

              this._buffers.push(buffer);
              this._availableBits += buffer.availableBits();
            }
          }

          module.exports = wrapHash;
          module.exports.InfiniteHash = InfiniteHash;
        },
        { "./consumable-buffer": 31, "uint8arrays/concat": 26 },
      ],
      33: [
        function (require, module, exports) {
          "use strict";

          const Bucket = require("./bucket");
          const wrapHash = require("./consumable-hash");

          /**
           * @typedef {object} UserBucketOptions
           * @property {(value: Uint8Array) => Promise<Uint8Array>} hashFn
           * @property {number} [bits=8]
           */

          /**
           * @param {UserBucketOptions} options
           */
          function createHAMT(options) {
            if (!options || !options.hashFn) {
              throw new Error("please define an options.hashFn");
            }

            const bucketOptions = {
              bits: options.bits || 8,
              hash: wrapHash(options.hashFn),
            };

            return new Bucket(bucketOptions);
          }

          module.exports = {
            createHAMT,
            Bucket,
          };
        },
        { "./bucket": 30, "./consumable-hash": 32 },
      ],
      34: [
        function (require, module, exports) {
          const { importer } = require("ipfs-unixfs-importer");

          const block = {
            get: async (cid) => {
              throw new Error(`unexpected block API get for ${cid}`);
            },
            put: async () => {
              throw new Error("unexpected block API put");
            },
          };

          exports.of = async (content, options) => {
            options = options || {};
            options.onlyHash = true;

            if (typeof content === "string") {
              content = new TextEncoder().encode(content);
            }

            let lastCid;
            for await (const { cid } of importer(
              [{ content }],
              block,
              options
            )) {
              lastCid = cid;
            }

            return `${lastCid}`;
          };
        },
        { "ipfs-unixfs-importer": 49 },
      ],
      35: [
        function (require, module, exports) {
          "use strict";

          // @ts-ignore
          const BufferList = require("bl/BufferList");

          /**
           * @type {import('../types').Chunker}
           */
          module.exports = async function* fixedSizeChunker(source, options) {
            let bl = new BufferList();
            let currentLength = 0;
            let emitted = false;
            const maxChunkSize = options.maxChunkSize;

            for await (const buffer of source) {
              bl.append(buffer);

              currentLength += buffer.length;

              while (currentLength >= maxChunkSize) {
                yield bl.slice(0, maxChunkSize);
                emitted = true;

                // throw away consumed bytes
                if (maxChunkSize === bl.length) {
                  bl = new BufferList();
                  currentLength = 0;
                } else {
                  const newBl = new BufferList();
                  newBl.append(bl.shallowSlice(maxChunkSize));
                  bl = newBl;

                  // update our offset
                  currentLength -= maxChunkSize;
                }
              }
            }

            if (!emitted || currentLength) {
              // return any remaining bytes or an empty buffer
              yield bl.slice(0, currentLength);
            }
          };
        },
        { "bl/BufferList": 11 },
      ],
      36: [
        function (require, module, exports) {
          "use strict";

          // @ts-ignore
          const BufferList = require("bl/BufferList");
          // @ts-ignore
          const { create } = require("rabin-wasm");
          const errcode = require("err-code");

          /**
           * @typedef {object} RabinOptions
           * @property {number} min
           * @property {number} max
           * @property {number} bits
           * @property {number} window
           * @property {number} polynomial
           */

          /**
           * @type {import('../types').Chunker}
           */
          module.exports = async function* rabinChunker(source, options) {
            let min, max, avg;

            if (
              options.minChunkSize &&
              options.maxChunkSize &&
              options.avgChunkSize
            ) {
              avg = options.avgChunkSize;
              min = options.minChunkSize;
              max = options.maxChunkSize;
            } else if (!options.avgChunkSize) {
              throw errcode(
                new Error("please specify an average chunk size"),
                "ERR_INVALID_AVG_CHUNK_SIZE"
              );
            } else {
              avg = options.avgChunkSize;
              min = avg / 3;
              max = avg + avg / 2;
            }

            // validate min/max/avg in the same way as go
            if (min < 16) {
              throw errcode(
                new Error("rabin min must be greater than 16"),
                "ERR_INVALID_MIN_CHUNK_SIZE"
              );
            }

            if (max < min) {
              max = min;
            }

            if (avg < min) {
              avg = min;
            }

            const sizepow = Math.floor(Math.log2(avg));

            for await (const chunk of rabin(source, {
              min: min,
              max: max,
              bits: sizepow,
              window: options.window,
              polynomial: options.polynomial,
            })) {
              yield chunk;
            }
          };

          /**
           * @param {AsyncIterable<Uint8Array>} source
           * @param {RabinOptions} options
           */
          async function* rabin(source, options) {
            const r = await create(
              options.bits,
              options.min,
              options.max,
              options.window
            );
            const buffers = new BufferList();

            for await (const chunk of source) {
              buffers.append(chunk);

              const sizes = r.fingerprint(chunk);

              for (let i = 0; i < sizes.length; i++) {
                const size = sizes[i];
                const buf = buffers.slice(0, size);
                buffers.consume(size);

                yield buf;
              }
            }

            if (buffers.length) {
              yield buffers.slice(0);
            }
          }
        },
        { "bl/BufferList": 11, "err-code": 24, "rabin-wasm": 150 },
      ],
      37: [
        function (require, module, exports) {
          "use strict";

          const { UnixFS } = require("ipfs-unixfs");
          const persist = require("../utils/persist");
          const { DAGNode } = require("ipld-dag-pb");

          /**
           * @typedef {import('../types').Directory} Directory
           */

          /**
           * @type {import('../types').UnixFSV1DagBuilder<Directory>}
           */
          const dirBuilder = async (item, block, options) => {
            const unixfs = new UnixFS({
              type: "directory",
              mtime: item.mtime,
              mode: item.mode,
            });

            const buffer = new DAGNode(unixfs.marshal()).serialize();
            const cid = await persist(buffer, block, options);
            const path = item.path;

            return {
              cid,
              path,
              unixfs,
              size: buffer.length,
            };
          };

          module.exports = dirBuilder;
        },
        { "../utils/persist": 52, "ipfs-unixfs": 54, "ipld-dag-pb": 65 },
      ],
      38: [
        function (require, module, exports) {
          "use strict";

          const batch = require("it-batch");

          /**
           * @typedef {import('../../types').FileDAGBuilder} FileDAGBuilder
           */

          /**
           * @type {FileDAGBuilder}
           */
          function balanced(source, reduce, options) {
            return reduceToParents(source, reduce, options);
          }

          /**
           * @type {FileDAGBuilder}
           */
          async function reduceToParents(source, reduce, options) {
            const roots = [];

            for await (const chunked of batch(
              source,
              options.maxChildrenPerNode
            )) {
              roots.push(await reduce(chunked));
            }

            if (roots.length > 1) {
              return reduceToParents(roots, reduce, options);
            }

            return roots[0];
          }

          module.exports = balanced;
        },
        { "it-batch": 71 },
      ],
      39: [
        function (require, module, exports) {
          "use strict";

          const { UnixFS } = require("ipfs-unixfs");
          const persist = require("../../utils/persist");
          const { DAGNode } = require("ipld-dag-pb");

          /**
           * @typedef {import('../../types').BufferImporter} BufferImporter
           */

          /**
           * @type {BufferImporter}
           */
          async function* bufferImporter(file, block, options) {
            for await (let buffer of file.content) {
              yield async () => {
                options.progress(buffer.length, file.path);
                let unixfs;

                /** @type {import('../../types').PersistOptions} */
                const opts = {
                  codec: "dag-pb",
                  cidVersion: options.cidVersion,
                  hashAlg: options.hashAlg,
                  onlyHash: options.onlyHash,
                };

                if (options.rawLeaves) {
                  opts.codec = "raw";
                  opts.cidVersion = 1;
                } else {
                  unixfs = new UnixFS({
                    type: options.leafType,
                    data: buffer,
                    mtime: file.mtime,
                    mode: file.mode,
                  });

                  buffer = new DAGNode(unixfs.marshal()).serialize();
                }

                return {
                  cid: await persist(buffer, block, opts),
                  unixfs,
                  size: buffer.length,
                };
              };
            }
          }

          module.exports = bufferImporter;
        },
        { "../../utils/persist": 52, "ipfs-unixfs": 54, "ipld-dag-pb": 65 },
      ],
      40: [
        function (require, module, exports) {
          "use strict";

          const all = require("it-all");

          /**
           * @type {import('../../types').FileDAGBuilder}
           */
          module.exports = async function (source, reduce) {
            return reduce(await all(source));
          };
        },
        { "it-all": 70 },
      ],
      41: [
        function (require, module, exports) {
          "use strict";

          const errCode = require("err-code");
          const { UnixFS } = require("ipfs-unixfs");
          const persist = require("../../utils/persist");
          const { DAGNode, DAGLink } = require("ipld-dag-pb");
          const parallelBatch = require("it-parallel-batch");
          const mh = require("multihashing-async").multihash;

          /**
           * @typedef {import('../../types').BlockAPI} BlockAPI
           * @typedef {import('../../types').File} File
           * @typedef {import('../../types').ImporterOptions} ImporterOptions
           * @typedef {import('../../types').Reducer} Reducer
           * @typedef {import('../../types').DAGBuilder} DAGBuilder
           * @typedef {import('../../types').FileDAGBuilder} FileDAGBuilder
           */

          /**
           * @type {{ [key: string]: FileDAGBuilder}}
           */
          const dagBuilders = {
            flat: require("./flat"),
            balanced: require("./balanced"),
            trickle: require("./trickle"),
          };

          /**
           * @param {File} file
           * @param {BlockAPI} block
           * @param {ImporterOptions} options
           */
          async function* buildFileBatch(file, block, options) {
            let count = -1;
            let previous;
            let bufferImporter;

            if (typeof options.bufferImporter === "function") {
              bufferImporter = options.bufferImporter;
            } else {
              bufferImporter = require("./buffer-importer");
            }

            for await (const entry of parallelBatch(
              bufferImporter(file, block, options),
              options.blockWriteConcurrency
            )) {
              count++;

              if (count === 0) {
                previous = entry;
                continue;
              } else if (count === 1 && previous) {
                yield previous;
                previous = null;
              }

              yield entry;
            }

            if (previous) {
              previous.single = true;
              yield previous;
            }
          }

          /**
           * @param {File} file
           * @param {BlockAPI} block
           * @param {ImporterOptions} options
           */
          const reduce = (file, block, options) => {
            /**
             * @type {Reducer}
             */
            async function reducer(leaves) {
              if (
                leaves.length === 1 &&
                leaves[0].single &&
                options.reduceSingleLeafToSelf
              ) {
                const leaf = leaves[0];

                if (
                  leaf.cid.codec === "raw" &&
                  (file.mtime !== undefined || file.mode !== undefined)
                ) {
                  // only one leaf node which is a buffer - we have metadata so convert it into a
                  // UnixFS entry otherwise we'll have nowhere to store the metadata
                  let { data: buffer } = await block.get(leaf.cid, options);

                  leaf.unixfs = new UnixFS({
                    type: "file",
                    mtime: file.mtime,
                    mode: file.mode,
                    data: buffer,
                  });

                  const multihash = mh.decode(leaf.cid.multihash);
                  buffer = new DAGNode(leaf.unixfs.marshal()).serialize();

                  leaf.cid = await persist(buffer, block, {
                    ...options,
                    codec: "dag-pb",
                    hashAlg: multihash.name,
                    cidVersion: options.cidVersion,
                  });
                  leaf.size = buffer.length;
                }

                return {
                  cid: leaf.cid,
                  path: file.path,
                  unixfs: leaf.unixfs,
                  size: leaf.size,
                };
              }

              // create a parent node and add all the leaves
              const f = new UnixFS({
                type: "file",
                mtime: file.mtime,
                mode: file.mode,
              });

              const links = leaves
                .filter((leaf) => {
                  if (leaf.cid.codec === "raw" && leaf.size) {
                    return true;
                  }

                  if (
                    leaf.unixfs &&
                    !leaf.unixfs.data &&
                    leaf.unixfs.fileSize()
                  ) {
                    return true;
                  }

                  return Boolean(
                    leaf.unixfs && leaf.unixfs.data && leaf.unixfs.data.length
                  );
                })
                .map((leaf) => {
                  if (leaf.cid.codec === "raw") {
                    // node is a leaf buffer
                    f.addBlockSize(leaf.size);

                    return new DAGLink("", leaf.size, leaf.cid);
                  }

                  if (!leaf.unixfs || !leaf.unixfs.data) {
                    // node is an intermediate node
                    f.addBlockSize(
                      (leaf.unixfs && leaf.unixfs.fileSize()) || 0
                    );
                  } else {
                    // node is a unixfs 'file' leaf node
                    f.addBlockSize(leaf.unixfs.data.length);
                  }

                  return new DAGLink("", leaf.size, leaf.cid);
                });

              const node = new DAGNode(f.marshal(), links);
              const buffer = node.serialize();
              const cid = await persist(buffer, block, options);

              return {
                cid,
                path: file.path,
                unixfs: f,
                size:
                  buffer.length +
                  node.Links.reduce((acc, curr) => acc + curr.Tsize, 0),
              };
            }

            return reducer;
          };

          /**
           * @type {import('../../types').UnixFSV1DagBuilder<File>}
           */
          function fileBuilder(file, block, options) {
            const dagBuilder = dagBuilders[options.strategy];

            if (!dagBuilder) {
              throw errCode(
                new Error(
                  `Unknown importer build strategy name: ${options.strategy}`
                ),
                "ERR_BAD_STRATEGY"
              );
            }

            return dagBuilder(
              buildFileBatch(file, block, options),
              reduce(file, block, options),
              options
            );
          }

          module.exports = fileBuilder;
        },
        {
          "../../utils/persist": 52,
          "./balanced": 38,
          "./buffer-importer": 39,
          "./flat": 40,
          "./trickle": 42,
          "err-code": 24,
          "ipfs-unixfs": 54,
          "ipld-dag-pb": 65,
          "it-parallel-batch": 72,
          "multihashing-async": 133,
        },
      ],
      42: [
        function (require, module, exports) {
          "use strict";

          const batch = require("it-batch");

          /**
           * @typedef {import('cids')} CID
           * @typedef {import('ipfs-unixfs').UnixFS} UnixFS
           * @typedef {import('../../types').ImporterOptions} ImporterOptions
           * @typedef {import('../../types').InProgressImportResult} InProgressImportResult
           * @typedef {import('../../types').TrickleDagNode} TrickleDagNode
           * @typedef {import('../../types').Reducer} Reducer
           * @typedef {import('../../types').FileDAGBuilder} FileDAGBuilder
           */

          /**
           * @type {FileDAGBuilder}
           */
          module.exports = async function trickleStream(
            source,
            reduce,
            options
          ) {
            const root = new Root(options.layerRepeat);
            let iteration = 0;
            let maxDepth = 1;

            /** @type {SubTree} */
            let subTree = root;

            for await (const layer of batch(
              source,
              options.maxChildrenPerNode
            )) {
              if (subTree.isFull()) {
                if (subTree !== root) {
                  root.addChild(await subTree.reduce(reduce));
                }

                if (iteration && iteration % options.layerRepeat === 0) {
                  maxDepth++;
                }

                subTree = new SubTree(maxDepth, options.layerRepeat, iteration);

                iteration++;
              }

              subTree.append(layer);
            }

            if (subTree && subTree !== root) {
              root.addChild(await subTree.reduce(reduce));
            }

            return root.reduce(reduce);
          };

          class SubTree {
            /**
             * @param {number} maxDepth
             * @param {number} layerRepeat
             * @param {number} [iteration=0]
             */
            constructor(maxDepth, layerRepeat, iteration = 0) {
              this.maxDepth = maxDepth;
              this.layerRepeat = layerRepeat;
              this.currentDepth = 1;
              this.iteration = iteration;

              /** @type {TrickleDagNode} */
              this.root =
                this.node =
                this.parent =
                  {
                    children: [],
                    depth: this.currentDepth,
                    maxDepth,
                    maxChildren:
                      (this.maxDepth - this.currentDepth) * this.layerRepeat,
                  };
            }

            isFull() {
              if (!this.root.data) {
                return false;
              }

              if (this.currentDepth < this.maxDepth && this.node.maxChildren) {
                // can descend
                this._addNextNodeToParent(this.node);

                return false;
              }

              // try to find new node from node.parent
              const distantRelative = this._findParent(
                this.node,
                this.currentDepth
              );

              if (distantRelative) {
                this._addNextNodeToParent(distantRelative);

                return false;
              }

              return true;
            }

            /**
             * @param {TrickleDagNode} parent
             */
            _addNextNodeToParent(parent) {
              this.parent = parent;

              // find site for new node
              const nextNode = {
                children: [],
                depth: parent.depth + 1,
                parent,
                maxDepth: this.maxDepth,
                maxChildren:
                  Math.floor(parent.children.length / this.layerRepeat) *
                  this.layerRepeat,
              };

              // @ts-ignore
              parent.children.push(nextNode);

              this.currentDepth = nextNode.depth;
              this.node = nextNode;
            }

            /**
             *
             * @param {InProgressImportResult[]} layer
             */
            append(layer) {
              this.node.data = layer;
            }

            /**
             * @param {Reducer} reduce
             */
            reduce(reduce) {
              return this._reduce(this.root, reduce);
            }

            /**
             * @param {TrickleDagNode} node
             * @param {Reducer} reduce
             * @returns {Promise<InProgressImportResult>}
             */
            async _reduce(node, reduce) {
              /** @type {InProgressImportResult[]} */
              let children = [];

              if (node.children.length) {
                children = await Promise.all(
                  node.children
                    // @ts-ignore
                    .filter((child) => child.data)
                    // @ts-ignore
                    .map((child) => this._reduce(child, reduce))
                );
              }

              return reduce((node.data || []).concat(children));
            }

            /**
             * @param {TrickleDagNode} node
             * @param {number} depth
             * @returns {TrickleDagNode | undefined}
             */
            _findParent(node, depth) {
              const parent = node.parent;

              if (!parent || parent.depth === 0) {
                return;
              }

              if (
                parent.children.length === parent.maxChildren ||
                !parent.maxChildren
              ) {
                // this layer is full, may be able to traverse to a different branch
                return this._findParent(parent, depth);
              }

              return parent;
            }
          }

          class Root extends SubTree {
            /**
             * @param {number} layerRepeat
             */
            constructor(layerRepeat) {
              super(0, layerRepeat);

              this.root.depth = 0;
              this.currentDepth = 1;
            }

            /**
             * @param {InProgressImportResult} child
             */
            addChild(child) {
              this.root.children.push(child);
            }

            /**
             * @param {Reducer} reduce
             */
            reduce(reduce) {
              return reduce((this.root.data || []).concat(this.root.children));
            }
          }
        },
        { "it-batch": 71 },
      ],
      43: [
        function (require, module, exports) {
          "use strict";

          const dirBuilder = require("./dir");
          const fileBuilder = require("./file");
          const errCode = require("err-code");

          /**
           * @typedef {import('../types').File} File
           * @typedef {import('../types').Directory} Directory
           * @typedef {import('../types').DAGBuilder} DAGBuilder
           * @typedef {import('../types').Chunker} Chunker
           * @typedef {import('../types').ChunkValidator} ChunkValidator
           */

          /**
           * @param {any} thing
           * @returns {thing is Iterable<any>}
           */
          function isIterable(thing) {
            return Symbol.iterator in thing;
          }

          /**
           * @param {any} thing
           * @returns {thing is AsyncIterable<any>}
           */
          function isAsyncIterable(thing) {
            return Symbol.asyncIterator in thing;
          }

          /**
           * @param {Uint8Array | AsyncIterable<Uint8Array> | Iterable<Uint8Array>} content
           * @returns {AsyncIterable<Uint8Array>}
           */
          function contentAsAsyncIterable(content) {
            try {
              if (content instanceof Uint8Array) {
                return (async function* () {
                  yield content;
                })();
              } else if (isIterable(content)) {
                return (async function* () {
                  yield* content;
                })();
              } else if (isAsyncIterable(content)) {
                return content;
              }
            } catch {
              throw errCode(
                new Error("Content was invalid"),
                "ERR_INVALID_CONTENT"
              );
            }

            throw errCode(
              new Error("Content was invalid"),
              "ERR_INVALID_CONTENT"
            );
          }

          /**
           * @type {DAGBuilder}
           */
          async function* dagBuilder(source, block, options) {
            for await (const entry of source) {
              if (entry.path) {
                if (entry.path.substring(0, 2) === "./") {
                  options.wrapWithDirectory = true;
                }

                entry.path = entry.path
                  .split("/")
                  .filter((path) => path && path !== ".")
                  .join("/");
              }

              if (entry.content) {
                /**
                 * @type {Chunker}
                 */
                let chunker;

                if (typeof options.chunker === "function") {
                  chunker = options.chunker;
                } else if (options.chunker === "rabin") {
                  chunker = require("../chunker/rabin");
                } else {
                  chunker = require("../chunker/fixed-size");
                }

                /**
                 * @type {ChunkValidator}
                 */
                let chunkValidator;

                if (typeof options.chunkValidator === "function") {
                  chunkValidator = options.chunkValidator;
                } else {
                  chunkValidator = require("./validate-chunks");
                }

                /** @type {File} */
                const file = {
                  path: entry.path,
                  mtime: entry.mtime,
                  mode: entry.mode,
                  content: chunker(
                    chunkValidator(
                      contentAsAsyncIterable(entry.content),
                      options
                    ),
                    options
                  ),
                };

                yield () => fileBuilder(file, block, options);
              } else if (entry.path) {
                /** @type {Directory} */
                const dir = {
                  path: entry.path,
                  mtime: entry.mtime,
                  mode: entry.mode,
                };

                yield () => dirBuilder(dir, block, options);
              } else {
                throw new Error(
                  "Import candidate must have content or path or both"
                );
              }
            }
          }

          module.exports = dagBuilder;
        },
        {
          "../chunker/fixed-size": 35,
          "../chunker/rabin": 36,
          "./dir": 37,
          "./file": 41,
          "./validate-chunks": 44,
          "err-code": 24,
        },
      ],
      44: [
        function (require, module, exports) {
          "use strict";

          const errCode = require("err-code");
          const uint8ArrayFromString = require("uint8arrays/from-string");

          /**
           * @typedef {import('../types').ChunkValidator} ChunkValidator
           */

          /**
           * @type {ChunkValidator}
           */
          async function* validateChunks(source) {
            for await (const content of source) {
              if (content.length === undefined) {
                throw errCode(
                  new Error("Content was invalid"),
                  "ERR_INVALID_CONTENT"
                );
              }

              if (typeof content === "string" || content instanceof String) {
                yield uint8ArrayFromString(content.toString());
              } else if (Array.isArray(content)) {
                yield Uint8Array.from(content);
              } else if (content instanceof Uint8Array) {
                yield content;
              } else {
                throw errCode(
                  new Error("Content was invalid"),
                  "ERR_INVALID_CONTENT"
                );
              }
            }
          }

          module.exports = validateChunks;
        },
        { "err-code": 24, "uint8arrays/from-string": 156 },
      ],
      45: [
        function (require, module, exports) {
          "use strict";

          const { DAGLink, DAGNode } = require("ipld-dag-pb");
          const { UnixFS } = require("ipfs-unixfs");
          const Dir = require("./dir");
          const persist = require("./utils/persist");

          /**
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           * @typedef {import('./types').ImportResult} ImportResult
           * @typedef {import('./types').InProgressImportResult} InProgressImportResult
           * @typedef {import('./types').BlockAPI} BlockAPI
           * @typedef {import('./dir').DirProps} DirProps
           * @typedef {import('cids')} CID
           */

          class DirFlat extends Dir {
            /**
             * @param {DirProps} props
             * @param {ImporterOptions} options
             */
            constructor(props, options) {
              super(props, options);

              /** @type {{ [key: string]: InProgressImportResult | Dir }} */
              this._children = {};
            }

            /**
             * @param {string} name
             * @param {InProgressImportResult | Dir} value
             */
            async put(name, value) {
              this.cid = undefined;
              this.size = undefined;

              this._children[name] = value;
            }

            /**
             * @param {string} name
             */
            get(name) {
              return Promise.resolve(this._children[name]);
            }

            childCount() {
              return Object.keys(this._children).length;
            }

            directChildrenCount() {
              return this.childCount();
            }

            onlyChild() {
              return this._children[Object.keys(this._children)[0]];
            }

            async *eachChildSeries() {
              const keys = Object.keys(this._children);

              for (let i = 0; i < keys.length; i++) {
                const key = keys[i];

                yield {
                  key: key,
                  child: this._children[key],
                };
              }
            }

            /**
             * @param {BlockAPI} block
             * @returns {AsyncIterable<ImportResult>}
             */
            async *flush(block) {
              const children = Object.keys(this._children);
              const links = [];

              for (let i = 0; i < children.length; i++) {
                let child = this._children[children[i]];

                if (child instanceof Dir) {
                  for await (const entry of child.flush(block)) {
                    child = entry;

                    yield child;
                  }
                }

                if (child.size != null && child.cid) {
                  links.push(new DAGLink(children[i], child.size, child.cid));
                }
              }

              const unixfs = new UnixFS({
                type: "directory",
                mtime: this.mtime,
                mode: this.mode,
              });

              const node = new DAGNode(unixfs.marshal(), links);
              const buffer = node.serialize();
              const cid = await persist(buffer, block, this.options);
              const size =
                buffer.length +
                node.Links.reduce(
                  /**
                   * @param {number} acc
                   * @param {DAGLink} curr
                   */
                  (acc, curr) => acc + curr.Tsize,
                  0
                );

              this.cid = cid;
              this.size = size;

              yield {
                cid,
                unixfs,
                path: this.path,
                size,
              };
            }
          }

          module.exports = DirFlat;
        },
        {
          "./dir": 47,
          "./utils/persist": 52,
          "ipfs-unixfs": 54,
          "ipld-dag-pb": 65,
        },
      ],
      46: [
        function (require, module, exports) {
          "use strict";

          const { DAGLink, DAGNode } = require("ipld-dag-pb");
          const { UnixFS } = require("ipfs-unixfs");
          const Dir = require("./dir");
          const persist = require("./utils/persist");
          const { createHAMT, Bucket } = require("hamt-sharding");

          /**
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           * @typedef {import('./types').ImportResult} ImportResult
           * @typedef {import('./types').InProgressImportResult} InProgressImportResult
           * @typedef {import('./types').BlockAPI} BlockAPI
           */

          /**
           * @typedef {import('./dir').DirProps} DirProps
           */

          class DirSharded extends Dir {
            /**
             * @param {DirProps} props
             * @param {ImporterOptions} options
             */
            constructor(props, options) {
              super(props, options);

              /** @type {Bucket<InProgressImportResult | Dir>} */
              this._bucket = createHAMT({
                hashFn: options.hamtHashFn,
                bits: options.hamtBucketBits,
              });
            }

            /**
             * @param {string} name
             * @param {InProgressImportResult | Dir} value
             */
            async put(name, value) {
              await this._bucket.put(name, value);
            }

            /**
             * @param {string} name
             */
            get(name) {
              return this._bucket.get(name);
            }

            childCount() {
              return this._bucket.leafCount();
            }

            directChildrenCount() {
              return this._bucket.childrenCount();
            }

            onlyChild() {
              return this._bucket.onlyChild();
            }

            async *eachChildSeries() {
              for await (const {
                key,
                value,
              } of this._bucket.eachLeafSeries()) {
                yield {
                  key,
                  child: value,
                };
              }
            }

            /**
             * @param {BlockAPI} block
             * @returns {AsyncIterable<ImportResult>}
             */
            async *flush(block) {
              for await (const entry of flush(
                this._bucket,
                block,
                this,
                this.options
              )) {
                yield {
                  ...entry,
                  path: this.path,
                };
              }
            }
          }

          module.exports = DirSharded;

          /**
           * @param {Bucket<?>} bucket
           * @param {BlockAPI} block
           * @param {*} shardRoot
           * @param {ImporterOptions} options
           * @returns {AsyncIterable<ImportResult>}
           */
          async function* flush(bucket, block, shardRoot, options) {
            const children = bucket._children;
            const links = [];
            let childrenSize = 0;

            for (let i = 0; i < children.length; i++) {
              const child = children.get(i);

              if (!child) {
                continue;
              }

              const labelPrefix = i.toString(16).toUpperCase().padStart(2, "0");

              if (child instanceof Bucket) {
                let shard;

                for await (const subShard of await flush(
                  child,
                  block,
                  null,
                  options
                )) {
                  shard = subShard;
                }

                if (!shard) {
                  throw new Error(
                    "Could not flush sharded directory, no subshard found"
                  );
                }

                links.push(new DAGLink(labelPrefix, shard.size, shard.cid));
                childrenSize += shard.size;
              } else if (typeof child.value.flush === "function") {
                const dir = child.value;
                let flushedDir;

                for await (const entry of dir.flush(block)) {
                  flushedDir = entry;

                  yield flushedDir;
                }

                const label = labelPrefix + child.key;
                links.push(new DAGLink(label, flushedDir.size, flushedDir.cid));

                childrenSize += flushedDir.size;
              } else {
                const value = child.value;

                if (!value.cid) {
                  continue;
                }

                const label = labelPrefix + child.key;
                const size = value.size;

                links.push(new DAGLink(label, size, value.cid));
                childrenSize += size;
              }
            }

            // go-ipfs uses little endian, that's why we have to
            // reverse the bit field before storing it
            const data = Uint8Array.from(children.bitField().reverse());
            const dir = new UnixFS({
              type: "hamt-sharded-directory",
              data,
              fanout: bucket.tableSize(),
              hashType: options.hamtHashCode,
              mtime: shardRoot && shardRoot.mtime,
              mode: shardRoot && shardRoot.mode,
            });

            const node = new DAGNode(dir.marshal(), links);
            const buffer = node.serialize();
            const cid = await persist(buffer, block, options);
            const size = buffer.length + childrenSize;

            yield {
              cid,
              unixfs: dir,
              size,
            };
          }
        },
        {
          "./dir": 47,
          "./utils/persist": 52,
          "hamt-sharding": 33,
          "ipfs-unixfs": 54,
          "ipld-dag-pb": 65,
        },
      ],
      47: [
        function (require, module, exports) {
          "use strict";

          /**
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           * @typedef {import('./types').ImportResult} ImportResult
           * @typedef {import('./types').InProgressImportResult} InProgressImportResult
           * @typedef {import('./types').BlockAPI} BlockAPI
           * @typedef {import('cids')} CID
           * @typedef {object} DirProps
           * @property {boolean} root
           * @property {boolean} dir
           * @property {string} path
           * @property {boolean} dirty
           * @property {boolean} flat
           * @property {Dir} [parent]
           * @property {string} [parentKey]
           * @property {import('ipfs-unixfs').UnixFS} [unixfs]
           * @property {number} [mode]
           * @property {import('ipfs-unixfs').Mtime} [mtime]
           */
          class Dir {
            /**
             *
             * @param {DirProps} props
             * @param {ImporterOptions} options
             */
            constructor(props, options) {
              this.options = options || {};

              this.root = props.root;
              this.dir = props.dir;
              this.path = props.path;
              this.dirty = props.dirty;
              this.flat = props.flat;
              this.parent = props.parent;
              this.parentKey = props.parentKey;
              this.unixfs = props.unixfs;
              this.mode = props.mode;
              this.mtime = props.mtime;

              /** @type {CID | undefined} */
              this.cid = undefined;
              /** @type {number | undefined} */
              this.size = undefined;
            }

            /**
             * @param {string} name
             * @param {InProgressImportResult | Dir} value
             */
            async put(name, value) {}

            /**
             * @param {string} name
             * @returns {Promise<InProgressImportResult | Dir | undefined>}
             */
            get(name) {
              return Promise.resolve(this);
            }

            /**
             * @returns {AsyncIterable<{ key: string, child: InProgressImportResult | Dir}>}
             */
            async *eachChildSeries() {}

            /**
             * @param {BlockAPI} block
             * @returns {AsyncIterable<ImportResult>}
             */
            async *flush(block) {}
          }

          module.exports = Dir;
        },
        {},
      ],
      48: [
        function (require, module, exports) {
          "use strict";

          const DirSharded = require("./dir-sharded");
          const DirFlat = require("./dir-flat");

          /**
           * @typedef {import('./dir')} Dir
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           */

          /**
           * @param {Dir | null} child
           * @param {Dir} dir
           * @param {number} threshold
           * @param {ImporterOptions} options
           * @returns {Promise<DirSharded>}
           */
          module.exports = async function flatToShard(
            child,
            dir,
            threshold,
            options
          ) {
            let newDir = dir;

            if (
              dir instanceof DirFlat &&
              dir.directChildrenCount() >= threshold
            ) {
              newDir = await convertToShard(dir, options);
            }

            const parent = newDir.parent;

            if (parent) {
              if (newDir !== dir) {
                if (child) {
                  child.parent = newDir;
                }

                if (!newDir.parentKey) {
                  throw new Error("No parent key found");
                }

                await parent.put(newDir.parentKey, newDir);
              }

              return flatToShard(newDir, parent, threshold, options);
            }

            // @ts-ignore
            return newDir;
          };

          /**
           * @param {DirFlat} oldDir
           * @param {ImporterOptions} options
           */
          async function convertToShard(oldDir, options) {
            const newDir = new DirSharded(
              {
                root: oldDir.root,
                dir: true,
                parent: oldDir.parent,
                parentKey: oldDir.parentKey,
                path: oldDir.path,
                dirty: oldDir.dirty,
                flat: false,
                mtime: oldDir.mtime,
                mode: oldDir.mode,
              },
              options
            );

            for await (const { key, child } of oldDir.eachChildSeries()) {
              await newDir.put(key, child);
            }

            return newDir;
          }
        },
        { "./dir-flat": 45, "./dir-sharded": 46 },
      ],
      49: [
        function (require, module, exports) {
          "use strict";

          const parallelBatch = require("it-parallel-batch");
          const defaultOptions = require("./options");

          /**
           * @typedef {import('./types').BlockAPI} BlockAPI
           * @typedef {import('./types').ImportCandidate} ImportCandidate
           * @typedef {import('./types').UserImporterOptions} UserImporterOptions
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           * @typedef {import('./types').Directory} Directory
           * @typedef {import('./types').File} File
           * @typedef {import('./types').ImportResult} ImportResult
           *
           * @typedef {import('./types').Chunker} Chunker
           * @typedef {import('./types').DAGBuilder} DAGBuilder
           * @typedef {import('./types').TreeBuilder} TreeBuilder
           * @typedef {import('./types').BufferImporter} BufferImporter
           * @typedef {import('./types').ChunkValidator} ChunkValidator
           * @typedef {import('./types').Reducer} Reducer
           * @typedef {import('./types').ProgressHandler} ProgressHandler
           */

          /**
           * @param {AsyncIterable<ImportCandidate> | Iterable<ImportCandidate> | ImportCandidate} source
           * @param {BlockAPI} block
           * @param {UserImporterOptions} options
           */
          async function* importer(source, block, options = {}) {
            const opts = defaultOptions(options);

            let dagBuilder;

            if (typeof options.dagBuilder === "function") {
              dagBuilder = options.dagBuilder;
            } else {
              dagBuilder = require("./dag-builder");
            }

            let treeBuilder;

            if (typeof options.treeBuilder === "function") {
              treeBuilder = options.treeBuilder;
            } else {
              treeBuilder = require("./tree-builder");
            }

            /** @type {AsyncIterable<ImportCandidate> | Iterable<ImportCandidate>} */
            let candidates;

            if (Symbol.asyncIterator in source || Symbol.iterator in source) {
              // @ts-ignore
              candidates = source;
            } else {
              // @ts-ignore
              candidates = [source];
            }

            for await (const entry of treeBuilder(
              parallelBatch(
                dagBuilder(candidates, block, opts),
                opts.fileImportConcurrency
              ),
              block,
              opts
            )) {
              yield {
                cid: entry.cid,
                path: entry.path,
                unixfs: entry.unixfs,
                size: entry.size,
              };
            }
          }

          module.exports = {
            importer,
          };
        },
        {
          "./dag-builder": 43,
          "./options": 50,
          "./tree-builder": 51,
          "it-parallel-batch": 72,
        },
      ],
      50: [
        function (require, module, exports) {
          "use strict";

          const mergeOptions = require("merge-options").bind({
            ignoreUndefined: true,
          });
          const multihashing = require("multihashing-async");

          /**
           * @param {Uint8Array} buf
           */
          async function hamtHashFn(buf) {
            const hash = await multihashing(buf, "murmur3-128");

            // Multihashing inserts preamble of 2 bytes. Remove it.
            // Also, murmur3 outputs 128 bit but, accidentally, IPFS Go's
            // implementation only uses the first 64, so we must do the same
            // for parity..
            const justHash = hash.slice(2, 10);
            const length = justHash.length;
            const result = new Uint8Array(length);
            // TODO: invert buffer because that's how Go impl does it
            for (let i = 0; i < length; i++) {
              result[length - i - 1] = justHash[i];
            }

            return result;
          }

          /**
           * @typedef {import('./types').UserImporterOptions} UserImporterOptions
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           */

          /**
           * @type {ImporterOptions}
           */
          const defaultOptions = {
            chunker: "fixed",
            strategy: "balanced", // 'flat', 'trickle'
            rawLeaves: false,
            onlyHash: false,
            reduceSingleLeafToSelf: true,
            hashAlg: "sha2-256",
            leafType: "file", // 'raw'
            cidVersion: 0,
            progress: () => () => {},
            shardSplitThreshold: 1000,
            fileImportConcurrency: 50,
            blockWriteConcurrency: 10,
            minChunkSize: 262144,
            maxChunkSize: 262144,
            avgChunkSize: 262144,
            window: 16,
            // FIXME: This number is too big for JavaScript
            // https://github.com/ipfs/go-ipfs-chunker/blob/d0125832512163708c0804a3cda060e21acddae4/rabin.go#L11
            polynomial: 17437180132763653, // eslint-disable-line no-loss-of-precision
            maxChildrenPerNode: 174,
            layerRepeat: 4,
            wrapWithDirectory: false,
            pin: false,
            recursive: false,
            hidden: false,
            preload: false,
            timeout: undefined,
            hamtHashFn,
            hamtHashCode: 0x22,
            hamtBucketBits: 8,
          };

          /**
           * @param {UserImporterOptions} options
           * @returns {ImporterOptions}
           */
          module.exports = function (options = {}) {
            return mergeOptions(defaultOptions, options);
          };
        },
        { "merge-options": 74, "multihashing-async": 133 },
      ],
      51: [
        function (require, module, exports) {
          "use strict";

          const DirFlat = require("./dir-flat");
          const flatToShard = require("./flat-to-shard");
          const Dir = require("./dir");
          const toPathComponents = require("./utils/to-path-components");

          /**
           * @typedef {import('./types').ImportResult} ImportResult
           * @typedef {import('./types').InProgressImportResult} InProgressImportResult
           * @typedef {import('./types').ImporterOptions} ImporterOptions
           * @typedef {import('./types').BlockAPI} BlockAPI
           * @typedef {(source: AsyncIterable<InProgressImportResult>, block: BlockAPI, options: ImporterOptions) => AsyncIterable<ImportResult>} TreeBuilder
           */

          /**
           * @param {InProgressImportResult} elem
           * @param {Dir} tree
           * @param {ImporterOptions} options
           */
          async function addToTree(elem, tree, options) {
            const pathElems = toPathComponents(elem.path || "");
            const lastIndex = pathElems.length - 1;
            let parent = tree;
            let currentPath = "";

            for (let i = 0; i < pathElems.length; i++) {
              const pathElem = pathElems[i];

              currentPath += `${currentPath ? "/" : ""}${pathElem}`;

              const last = i === lastIndex;
              parent.dirty = true;
              parent.cid = undefined;
              parent.size = undefined;

              if (last) {
                await parent.put(pathElem, elem);
                tree = await flatToShard(
                  null,
                  parent,
                  options.shardSplitThreshold,
                  options
                );
              } else {
                let dir = await parent.get(pathElem);

                if (!dir || !(dir instanceof Dir)) {
                  dir = new DirFlat(
                    {
                      root: false,
                      dir: true,
                      parent: parent,
                      parentKey: pathElem,
                      path: currentPath,
                      dirty: true,
                      flat: true,
                      mtime: dir && dir.unixfs && dir.unixfs.mtime,
                      mode: dir && dir.unixfs && dir.unixfs.mode,
                    },
                    options
                  );
                }

                await parent.put(pathElem, dir);

                parent = dir;
              }
            }

            return tree;
          }

          /**
           * @param {Dir | InProgressImportResult} tree
           * @param {BlockAPI} block
           */
          async function* flushAndYield(tree, block) {
            if (!(tree instanceof Dir)) {
              if (tree && tree.unixfs && tree.unixfs.isDirectory()) {
                yield tree;
              }

              return;
            }

            yield* tree.flush(block);
          }

          /**
           * @type {TreeBuilder}
           */
          async function* treeBuilder(source, block, options) {
            /** @type {Dir} */
            let tree = new DirFlat(
              {
                root: true,
                dir: true,
                path: "",
                dirty: true,
                flat: true,
              },
              options
            );

            for await (const entry of source) {
              if (!entry) {
                continue;
              }

              tree = await addToTree(entry, tree, options);

              if (!entry.unixfs || !entry.unixfs.isDirectory()) {
                yield entry;
              }
            }

            if (options.wrapWithDirectory) {
              yield* flushAndYield(tree, block);
            } else {
              for await (const unwrapped of tree.eachChildSeries()) {
                if (!unwrapped) {
                  continue;
                }

                yield* flushAndYield(unwrapped.child, block);
              }
            }
          }

          module.exports = treeBuilder;
        },
        {
          "./dir": 47,
          "./dir-flat": 45,
          "./flat-to-shard": 48,
          "./utils/to-path-components": 53,
        },
      ],
      52: [
        function (require, module, exports) {
          "use strict";

          const mh = require("multihashing-async");
          const CID = require("cids");

          /**
           * @param {Uint8Array} buffer
           * @param {import('../types').BlockAPI} block
           * @param {import('../types').PersistOptions} options
           */
          const persist = async (buffer, block, options) => {
            if (!options.codec) {
              options.codec = "dag-pb";
            }

            if (!options.cidVersion) {
              options.cidVersion = 0;
            }

            if (!options.hashAlg) {
              options.hashAlg = "sha2-256";
            }

            if (options.hashAlg !== "sha2-256") {
              options.cidVersion = 1;
            }

            const multihash = await mh(buffer, options.hashAlg);
            const cid = new CID(options.cidVersion, options.codec, multihash);

            if (!options.onlyHash) {
              // @ts-ignore block api takes uint8arrays or blocks but is missing from typedefs
              await block.put(buffer, {
                // @ts-ignore pin option is missing from block api typedefs
                pin: options.pin,
                preload: options.preload,
                timeout: options.timeout,
                cid,
              });
            }

            return cid;
          };

          module.exports = persist;
        },
        { cids: 23, "multihashing-async": 133 },
      ],
      53: [
        function (require, module, exports) {
          "use strict";

          const toPathComponents = (path = "") => {
            // split on / unless escaped with \
            return (path.trim().match(/([^\\^/]|\\\/)+/g) || []).filter(
              Boolean
            );
          };

          module.exports = toPathComponents;
        },
        {},
      ],
      54: [
        function (require, module, exports) {
          "use strict";

          const { Data: PBData } = require("./unixfs");
          const errcode = require("err-code");

          /**
           * @typedef {import('./types').Mtime} Mtime
           * @typedef {import('./types').MtimeLike} MtimeLike
           */

          const types = [
            "raw",
            "directory",
            "file",
            "metadata",
            "symlink",
            "hamt-sharded-directory",
          ];

          const dirTypes = ["directory", "hamt-sharded-directory"];

          const DEFAULT_FILE_MODE = parseInt("0644", 8);
          const DEFAULT_DIRECTORY_MODE = parseInt("0755", 8);

          /**
           * @param {string | number | undefined} [mode]
           */
          function parseMode(mode) {
            if (mode == null) {
              return undefined;
            }

            if (typeof mode === "number") {
              return mode & 0xfff;
            }

            mode = mode.toString();

            if (mode.substring(0, 1) === "0") {
              // octal string
              return parseInt(mode, 8) & 0xfff;
            }

            // decimal string
            return parseInt(mode, 10) & 0xfff;
          }

          /**
           * @param {any} input
           */
          function parseMtime(input) {
            if (input == null) {
              return undefined;
            }

            /** @type {Mtime | undefined} */
            let mtime;

            // { secs, nsecs }
            if (input.secs != null) {
              mtime = {
                secs: input.secs,
                nsecs: input.nsecs,
              };
            }

            // UnixFS TimeSpec
            if (input.Seconds != null) {
              mtime = {
                secs: input.Seconds,
                nsecs: input.FractionalNanoseconds,
              };
            }

            // process.hrtime()
            if (Array.isArray(input)) {
              mtime = {
                secs: input[0],
                nsecs: input[1],
              };
            }

            // Javascript Date
            if (input instanceof Date) {
              const ms = input.getTime();
              const secs = Math.floor(ms / 1000);

              mtime = {
                secs: secs,
                nsecs: (ms - secs * 1000) * 1000,
              };
            }

            /*
  TODO: https://github.com/ipfs/aegir/issues/487

  // process.hrtime.bigint()
  if (input instanceof BigInt) {
    const secs = input / BigInt(1e9)
    const nsecs = input - (secs * BigInt(1e9))

    mtime = {
      secs: parseInt(secs.toString()),
      nsecs: parseInt(nsecs.toString())
    }
  }
  */

            if (!Object.prototype.hasOwnProperty.call(mtime, "secs")) {
              return undefined;
            }

            if (
              mtime != null &&
              mtime.nsecs != null &&
              (mtime.nsecs < 0 || mtime.nsecs > 999999999)
            ) {
              throw errcode(
                new Error("mtime-nsecs must be within the range [0,999999999]"),
                "ERR_INVALID_MTIME_NSECS"
              );
            }

            return mtime;
          }

          class Data {
            /**
             * Decode from protobuf https://github.com/ipfs/specs/blob/master/UNIXFS.md
             *
             * @param {Uint8Array} marshaled
             */
            static unmarshal(marshaled) {
              const message = PBData.decode(marshaled);
              const decoded = PBData.toObject(message, {
                defaults: false,
                arrays: true,
                longs: Number,
                objects: false,
              });

              const data = new Data({
                type: types[decoded.Type],
                data: decoded.Data,
                blockSizes: decoded.blocksizes,
                mode: decoded.mode,
                mtime: decoded.mtime
                  ? {
                      secs: decoded.mtime.Seconds,
                      nsecs: decoded.mtime.FractionalNanoseconds,
                    }
                  : undefined,
              });

              // make sure we honour the original mode
              data._originalMode = decoded.mode || 0;

              return data;
            }

            /**
             * @param {object} [options]
             * @param {string} [options.type='file']
             * @param {Uint8Array} [options.data]
             * @param {number[]} [options.blockSizes]
             * @param {number} [options.hashType]
             * @param {number} [options.fanout]
             * @param {MtimeLike | null} [options.mtime]
             * @param {number | string} [options.mode]
             */
            constructor(
              options = {
                type: "file",
              }
            ) {
              const { type, data, blockSizes, hashType, fanout, mtime, mode } =
                options;

              if (type && !types.includes(type)) {
                throw errcode(
                  new Error("Type: " + type + " is not valid"),
                  "ERR_INVALID_TYPE"
                );
              }

              this.type = type || "file";
              this.data = data;
              this.hashType = hashType;
              this.fanout = fanout;

              /** @type {number[]} */
              this.blockSizes = blockSizes || [];
              this._originalMode = 0;
              this.mode = parseMode(mode);

              if (mtime) {
                this.mtime = parseMtime(mtime);

                if (this.mtime && !this.mtime.nsecs) {
                  this.mtime.nsecs = 0;
                }
              }
            }

            /**
             * @param {number | undefined} mode
             */
            set mode(mode) {
              this._mode = this.isDirectory()
                ? DEFAULT_DIRECTORY_MODE
                : DEFAULT_FILE_MODE;

              const parsedMode = parseMode(mode);

              if (parsedMode !== undefined) {
                this._mode = parsedMode;
              }
            }

            /**
             * @returns {number | undefined}
             */
            get mode() {
              return this._mode;
            }

            isDirectory() {
              return Boolean(this.type && dirTypes.includes(this.type));
            }

            /**
             * @param {number} size
             */
            addBlockSize(size) {
              this.blockSizes.push(size);
            }

            /**
             * @param {number} index
             */
            removeBlockSize(index) {
              this.blockSizes.splice(index, 1);
            }

            /**
             * Returns `0` for directories or `data.length + sum(blockSizes)` for everything else
             */
            fileSize() {
              if (this.isDirectory()) {
                // dirs don't have file size
                return 0;
              }

              let sum = 0;
              this.blockSizes.forEach((size) => {
                sum += size;
              });

              if (this.data) {
                sum += this.data.length;
              }

              return sum;
            }

            /**
             * encode to protobuf Uint8Array
             */
            marshal() {
              let type;

              switch (this.type) {
                case "raw":
                  type = PBData.DataType.Raw;
                  break;
                case "directory":
                  type = PBData.DataType.Directory;
                  break;
                case "file":
                  type = PBData.DataType.File;
                  break;
                case "metadata":
                  type = PBData.DataType.Metadata;
                  break;
                case "symlink":
                  type = PBData.DataType.Symlink;
                  break;
                case "hamt-sharded-directory":
                  type = PBData.DataType.HAMTShard;
                  break;
                default:
                  throw errcode(
                    new Error("Type: " + type + " is not valid"),
                    "ERR_INVALID_TYPE"
                  );
              }

              let data = this.data;

              if (!this.data || !this.data.length) {
                data = undefined;
              }

              let mode;

              if (this.mode != null) {
                mode =
                  (this._originalMode & 0xfffff000) |
                  (parseMode(this.mode) || 0);

                if (mode === DEFAULT_FILE_MODE && !this.isDirectory()) {
                  mode = undefined;
                }

                if (mode === DEFAULT_DIRECTORY_MODE && this.isDirectory()) {
                  mode = undefined;
                }
              }

              let mtime;

              if (this.mtime != null) {
                const parsed = parseMtime(this.mtime);

                if (parsed) {
                  mtime = {
                    Seconds: parsed.secs,
                    FractionalNanoseconds: parsed.nsecs,
                  };

                  if (mtime.FractionalNanoseconds === 0) {
                    delete mtime.FractionalNanoseconds;
                  }
                }
              }

              const pbData = {
                Type: type,
                Data: data,
                filesize: this.isDirectory() ? undefined : this.fileSize(),
                blocksizes: this.blockSizes,
                hashType: this.hashType,
                fanout: this.fanout,
                mode,
                mtime,
              };

              return PBData.encode(pbData).finish();
            }
          }

          module.exports = {
            UnixFS: Data,
            parseMode,
            parseMtime,
          };
        },
        { "./unixfs": 55, "err-code": 24 },
      ],
      55: [
        function (require, module, exports) {
          /*eslint-disable*/
          "use strict";

          var $protobuf = require("protobufjs/minimal");

          // Common aliases
          var $Reader = $protobuf.Reader,
            $Writer = $protobuf.Writer,
            $util = $protobuf.util;

          // Exported root namespace
          var $root =
            $protobuf.roots["ipfs-unixfs"] ||
            ($protobuf.roots["ipfs-unixfs"] = {});

          $root.Data = (function () {
            /**
             * Properties of a Data.
             * @exports IData
             * @interface IData
             * @property {Data.DataType} Type Data Type
             * @property {Uint8Array|null} [Data] Data Data
             * @property {number|null} [filesize] Data filesize
             * @property {Array.<number>|null} [blocksizes] Data blocksizes
             * @property {number|null} [hashType] Data hashType
             * @property {number|null} [fanout] Data fanout
             * @property {number|null} [mode] Data mode
             * @property {IUnixTime|null} [mtime] Data mtime
             */

            /**
             * Constructs a new Data.
             * @exports Data
             * @classdesc Represents a Data.
             * @implements IData
             * @constructor
             * @param {IData=} [p] Properties to set
             */
            function Data(p) {
              this.blocksizes = [];
              if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                  if (p[ks[i]] != null) this[ks[i]] = p[ks[i]];
            }

            /**
             * Data Type.
             * @member {Data.DataType} Type
             * @memberof Data
             * @instance
             */
            Data.prototype.Type = 0;

            /**
             * Data Data.
             * @member {Uint8Array} Data
             * @memberof Data
             * @instance
             */
            Data.prototype.Data = $util.newBuffer([]);

            /**
             * Data filesize.
             * @member {number} filesize
             * @memberof Data
             * @instance
             */
            Data.prototype.filesize = $util.Long
              ? $util.Long.fromBits(0, 0, true)
              : 0;

            /**
             * Data blocksizes.
             * @member {Array.<number>} blocksizes
             * @memberof Data
             * @instance
             */
            Data.prototype.blocksizes = $util.emptyArray;

            /**
             * Data hashType.
             * @member {number} hashType
             * @memberof Data
             * @instance
             */
            Data.prototype.hashType = $util.Long
              ? $util.Long.fromBits(0, 0, true)
              : 0;

            /**
             * Data fanout.
             * @member {number} fanout
             * @memberof Data
             * @instance
             */
            Data.prototype.fanout = $util.Long
              ? $util.Long.fromBits(0, 0, true)
              : 0;

            /**
             * Data mode.
             * @member {number} mode
             * @memberof Data
             * @instance
             */
            Data.prototype.mode = 0;

            /**
             * Data mtime.
             * @member {IUnixTime|null|undefined} mtime
             * @memberof Data
             * @instance
             */
            Data.prototype.mtime = null;

            /**
             * Encodes the specified Data message. Does not implicitly {@link Data.verify|verify} messages.
             * @function encode
             * @memberof Data
             * @static
             * @param {IData} m Data message or plain object to encode
             * @param {$protobuf.Writer} [w] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Data.encode = function encode(m, w) {
              if (!w) w = $Writer.create();
              w.uint32(8).int32(m.Type);
              if (m.Data != null && Object.hasOwnProperty.call(m, "Data"))
                w.uint32(18).bytes(m.Data);
              if (
                m.filesize != null &&
                Object.hasOwnProperty.call(m, "filesize")
              )
                w.uint32(24).uint64(m.filesize);
              if (m.blocksizes != null && m.blocksizes.length) {
                for (var i = 0; i < m.blocksizes.length; ++i)
                  w.uint32(32).uint64(m.blocksizes[i]);
              }
              if (
                m.hashType != null &&
                Object.hasOwnProperty.call(m, "hashType")
              )
                w.uint32(40).uint64(m.hashType);
              if (m.fanout != null && Object.hasOwnProperty.call(m, "fanout"))
                w.uint32(48).uint64(m.fanout);
              if (m.mode != null && Object.hasOwnProperty.call(m, "mode"))
                w.uint32(56).uint32(m.mode);
              if (m.mtime != null && Object.hasOwnProperty.call(m, "mtime"))
                $root.UnixTime.encode(m.mtime, w.uint32(66).fork()).ldelim();
              return w;
            };

            /**
             * Decodes a Data message from the specified reader or buffer.
             * @function decode
             * @memberof Data
             * @static
             * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
             * @param {number} [l] Message length if known beforehand
             * @returns {Data} Data
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Data.decode = function decode(r, l) {
              if (!(r instanceof $Reader)) r = $Reader.create(r);
              var c = l === undefined ? r.len : r.pos + l,
                m = new $root.Data();
              while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                  case 1:
                    m.Type = r.int32();
                    break;
                  case 2:
                    m.Data = r.bytes();
                    break;
                  case 3:
                    m.filesize = r.uint64();
                    break;
                  case 4:
                    if (!(m.blocksizes && m.blocksizes.length))
                      m.blocksizes = [];
                    if ((t & 7) === 2) {
                      var c2 = r.uint32() + r.pos;
                      while (r.pos < c2) m.blocksizes.push(r.uint64());
                    } else m.blocksizes.push(r.uint64());
                    break;
                  case 5:
                    m.hashType = r.uint64();
                    break;
                  case 6:
                    m.fanout = r.uint64();
                    break;
                  case 7:
                    m.mode = r.uint32();
                    break;
                  case 8:
                    m.mtime = $root.UnixTime.decode(r, r.uint32());
                    break;
                  default:
                    r.skipType(t & 7);
                    break;
                }
              }
              if (!m.hasOwnProperty("Type"))
                throw $util.ProtocolError("missing required 'Type'", {
                  instance: m,
                });
              return m;
            };

            /**
             * Creates a Data message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof Data
             * @static
             * @param {Object.<string,*>} d Plain object
             * @returns {Data} Data
             */
            Data.fromObject = function fromObject(d) {
              if (d instanceof $root.Data) return d;
              var m = new $root.Data();
              switch (d.Type) {
                case "Raw":
                case 0:
                  m.Type = 0;
                  break;
                case "Directory":
                case 1:
                  m.Type = 1;
                  break;
                case "File":
                case 2:
                  m.Type = 2;
                  break;
                case "Metadata":
                case 3:
                  m.Type = 3;
                  break;
                case "Symlink":
                case 4:
                  m.Type = 4;
                  break;
                case "HAMTShard":
                case 5:
                  m.Type = 5;
                  break;
              }
              if (d.Data != null) {
                if (typeof d.Data === "string")
                  $util.base64.decode(
                    d.Data,
                    (m.Data = $util.newBuffer($util.base64.length(d.Data))),
                    0
                  );
                else if (d.Data.length) m.Data = d.Data;
              }
              if (d.filesize != null) {
                if ($util.Long)
                  (m.filesize = $util.Long.fromValue(
                    d.filesize
                  )).unsigned = true;
                else if (typeof d.filesize === "string")
                  m.filesize = parseInt(d.filesize, 10);
                else if (typeof d.filesize === "number")
                  m.filesize = d.filesize;
                else if (typeof d.filesize === "object")
                  m.filesize = new $util.LongBits(
                    d.filesize.low >>> 0,
                    d.filesize.high >>> 0
                  ).toNumber(true);
              }
              if (d.blocksizes) {
                if (!Array.isArray(d.blocksizes))
                  throw TypeError(".Data.blocksizes: array expected");
                m.blocksizes = [];
                for (var i = 0; i < d.blocksizes.length; ++i) {
                  if ($util.Long)
                    (m.blocksizes[i] = $util.Long.fromValue(
                      d.blocksizes[i]
                    )).unsigned = true;
                  else if (typeof d.blocksizes[i] === "string")
                    m.blocksizes[i] = parseInt(d.blocksizes[i], 10);
                  else if (typeof d.blocksizes[i] === "number")
                    m.blocksizes[i] = d.blocksizes[i];
                  else if (typeof d.blocksizes[i] === "object")
                    m.blocksizes[i] = new $util.LongBits(
                      d.blocksizes[i].low >>> 0,
                      d.blocksizes[i].high >>> 0
                    ).toNumber(true);
                }
              }
              if (d.hashType != null) {
                if ($util.Long)
                  (m.hashType = $util.Long.fromValue(
                    d.hashType
                  )).unsigned = true;
                else if (typeof d.hashType === "string")
                  m.hashType = parseInt(d.hashType, 10);
                else if (typeof d.hashType === "number")
                  m.hashType = d.hashType;
                else if (typeof d.hashType === "object")
                  m.hashType = new $util.LongBits(
                    d.hashType.low >>> 0,
                    d.hashType.high >>> 0
                  ).toNumber(true);
              }
              if (d.fanout != null) {
                if ($util.Long)
                  (m.fanout = $util.Long.fromValue(d.fanout)).unsigned = true;
                else if (typeof d.fanout === "string")
                  m.fanout = parseInt(d.fanout, 10);
                else if (typeof d.fanout === "number") m.fanout = d.fanout;
                else if (typeof d.fanout === "object")
                  m.fanout = new $util.LongBits(
                    d.fanout.low >>> 0,
                    d.fanout.high >>> 0
                  ).toNumber(true);
              }
              if (d.mode != null) {
                m.mode = d.mode >>> 0;
              }
              if (d.mtime != null) {
                if (typeof d.mtime !== "object")
                  throw TypeError(".Data.mtime: object expected");
                m.mtime = $root.UnixTime.fromObject(d.mtime);
              }
              return m;
            };

            /**
             * Creates a plain object from a Data message. Also converts values to other types if specified.
             * @function toObject
             * @memberof Data
             * @static
             * @param {Data} m Data
             * @param {$protobuf.IConversionOptions} [o] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Data.toObject = function toObject(m, o) {
              if (!o) o = {};
              var d = {};
              if (o.arrays || o.defaults) {
                d.blocksizes = [];
              }
              if (o.defaults) {
                d.Type = o.enums === String ? "Raw" : 0;
                if (o.bytes === String) d.Data = "";
                else {
                  d.Data = [];
                  if (o.bytes !== Array) d.Data = $util.newBuffer(d.Data);
                }
                if ($util.Long) {
                  var n = new $util.Long(0, 0, true);
                  d.filesize =
                    o.longs === String
                      ? n.toString()
                      : o.longs === Number
                      ? n.toNumber()
                      : n;
                } else d.filesize = o.longs === String ? "0" : 0;
                if ($util.Long) {
                  var n = new $util.Long(0, 0, true);
                  d.hashType =
                    o.longs === String
                      ? n.toString()
                      : o.longs === Number
                      ? n.toNumber()
                      : n;
                } else d.hashType = o.longs === String ? "0" : 0;
                if ($util.Long) {
                  var n = new $util.Long(0, 0, true);
                  d.fanout =
                    o.longs === String
                      ? n.toString()
                      : o.longs === Number
                      ? n.toNumber()
                      : n;
                } else d.fanout = o.longs === String ? "0" : 0;
                d.mode = 0;
                d.mtime = null;
              }
              if (m.Type != null && m.hasOwnProperty("Type")) {
                d.Type =
                  o.enums === String ? $root.Data.DataType[m.Type] : m.Type;
              }
              if (m.Data != null && m.hasOwnProperty("Data")) {
                d.Data =
                  o.bytes === String
                    ? $util.base64.encode(m.Data, 0, m.Data.length)
                    : o.bytes === Array
                    ? Array.prototype.slice.call(m.Data)
                    : m.Data;
              }
              if (m.filesize != null && m.hasOwnProperty("filesize")) {
                if (typeof m.filesize === "number")
                  d.filesize =
                    o.longs === String ? String(m.filesize) : m.filesize;
                else
                  d.filesize =
                    o.longs === String
                      ? $util.Long.prototype.toString.call(m.filesize)
                      : o.longs === Number
                      ? new $util.LongBits(
                          m.filesize.low >>> 0,
                          m.filesize.high >>> 0
                        ).toNumber(true)
                      : m.filesize;
              }
              if (m.blocksizes && m.blocksizes.length) {
                d.blocksizes = [];
                for (var j = 0; j < m.blocksizes.length; ++j) {
                  if (typeof m.blocksizes[j] === "number")
                    d.blocksizes[j] =
                      o.longs === String
                        ? String(m.blocksizes[j])
                        : m.blocksizes[j];
                  else
                    d.blocksizes[j] =
                      o.longs === String
                        ? $util.Long.prototype.toString.call(m.blocksizes[j])
                        : o.longs === Number
                        ? new $util.LongBits(
                            m.blocksizes[j].low >>> 0,
                            m.blocksizes[j].high >>> 0
                          ).toNumber(true)
                        : m.blocksizes[j];
                }
              }
              if (m.hashType != null && m.hasOwnProperty("hashType")) {
                if (typeof m.hashType === "number")
                  d.hashType =
                    o.longs === String ? String(m.hashType) : m.hashType;
                else
                  d.hashType =
                    o.longs === String
                      ? $util.Long.prototype.toString.call(m.hashType)
                      : o.longs === Number
                      ? new $util.LongBits(
                          m.hashType.low >>> 0,
                          m.hashType.high >>> 0
                        ).toNumber(true)
                      : m.hashType;
              }
              if (m.fanout != null && m.hasOwnProperty("fanout")) {
                if (typeof m.fanout === "number")
                  d.fanout = o.longs === String ? String(m.fanout) : m.fanout;
                else
                  d.fanout =
                    o.longs === String
                      ? $util.Long.prototype.toString.call(m.fanout)
                      : o.longs === Number
                      ? new $util.LongBits(
                          m.fanout.low >>> 0,
                          m.fanout.high >>> 0
                        ).toNumber(true)
                      : m.fanout;
              }
              if (m.mode != null && m.hasOwnProperty("mode")) {
                d.mode = m.mode;
              }
              if (m.mtime != null && m.hasOwnProperty("mtime")) {
                d.mtime = $root.UnixTime.toObject(m.mtime, o);
              }
              return d;
            };

            /**
             * Converts this Data to JSON.
             * @function toJSON
             * @memberof Data
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Data.prototype.toJSON = function toJSON() {
              return this.constructor.toObject(
                this,
                $protobuf.util.toJSONOptions
              );
            };

            /**
             * DataType enum.
             * @name Data.DataType
             * @enum {number}
             * @property {number} Raw=0 Raw value
             * @property {number} Directory=1 Directory value
             * @property {number} File=2 File value
             * @property {number} Metadata=3 Metadata value
             * @property {number} Symlink=4 Symlink value
             * @property {number} HAMTShard=5 HAMTShard value
             */
            Data.DataType = (function () {
              var valuesById = {},
                values = Object.create(valuesById);
              values[(valuesById[0] = "Raw")] = 0;
              values[(valuesById[1] = "Directory")] = 1;
              values[(valuesById[2] = "File")] = 2;
              values[(valuesById[3] = "Metadata")] = 3;
              values[(valuesById[4] = "Symlink")] = 4;
              values[(valuesById[5] = "HAMTShard")] = 5;
              return values;
            })();

            return Data;
          })();

          $root.UnixTime = (function () {
            /**
             * Properties of an UnixTime.
             * @exports IUnixTime
             * @interface IUnixTime
             * @property {number} Seconds UnixTime Seconds
             * @property {number|null} [FractionalNanoseconds] UnixTime FractionalNanoseconds
             */

            /**
             * Constructs a new UnixTime.
             * @exports UnixTime
             * @classdesc Represents an UnixTime.
             * @implements IUnixTime
             * @constructor
             * @param {IUnixTime=} [p] Properties to set
             */
            function UnixTime(p) {
              if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                  if (p[ks[i]] != null) this[ks[i]] = p[ks[i]];
            }

            /**
             * UnixTime Seconds.
             * @member {number} Seconds
             * @memberof UnixTime
             * @instance
             */
            UnixTime.prototype.Seconds = $util.Long
              ? $util.Long.fromBits(0, 0, false)
              : 0;

            /**
             * UnixTime FractionalNanoseconds.
             * @member {number} FractionalNanoseconds
             * @memberof UnixTime
             * @instance
             */
            UnixTime.prototype.FractionalNanoseconds = 0;

            /**
             * Encodes the specified UnixTime message. Does not implicitly {@link UnixTime.verify|verify} messages.
             * @function encode
             * @memberof UnixTime
             * @static
             * @param {IUnixTime} m UnixTime message or plain object to encode
             * @param {$protobuf.Writer} [w] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            UnixTime.encode = function encode(m, w) {
              if (!w) w = $Writer.create();
              w.uint32(8).int64(m.Seconds);
              if (
                m.FractionalNanoseconds != null &&
                Object.hasOwnProperty.call(m, "FractionalNanoseconds")
              )
                w.uint32(21).fixed32(m.FractionalNanoseconds);
              return w;
            };

            /**
             * Decodes an UnixTime message from the specified reader or buffer.
             * @function decode
             * @memberof UnixTime
             * @static
             * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
             * @param {number} [l] Message length if known beforehand
             * @returns {UnixTime} UnixTime
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            UnixTime.decode = function decode(r, l) {
              if (!(r instanceof $Reader)) r = $Reader.create(r);
              var c = l === undefined ? r.len : r.pos + l,
                m = new $root.UnixTime();
              while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                  case 1:
                    m.Seconds = r.int64();
                    break;
                  case 2:
                    m.FractionalNanoseconds = r.fixed32();
                    break;
                  default:
                    r.skipType(t & 7);
                    break;
                }
              }
              if (!m.hasOwnProperty("Seconds"))
                throw $util.ProtocolError("missing required 'Seconds'", {
                  instance: m,
                });
              return m;
            };

            /**
             * Creates an UnixTime message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof UnixTime
             * @static
             * @param {Object.<string,*>} d Plain object
             * @returns {UnixTime} UnixTime
             */
            UnixTime.fromObject = function fromObject(d) {
              if (d instanceof $root.UnixTime) return d;
              var m = new $root.UnixTime();
              if (d.Seconds != null) {
                if ($util.Long)
                  (m.Seconds = $util.Long.fromValue(
                    d.Seconds
                  )).unsigned = false;
                else if (typeof d.Seconds === "string")
                  m.Seconds = parseInt(d.Seconds, 10);
                else if (typeof d.Seconds === "number") m.Seconds = d.Seconds;
                else if (typeof d.Seconds === "object")
                  m.Seconds = new $util.LongBits(
                    d.Seconds.low >>> 0,
                    d.Seconds.high >>> 0
                  ).toNumber();
              }
              if (d.FractionalNanoseconds != null) {
                m.FractionalNanoseconds = d.FractionalNanoseconds >>> 0;
              }
              return m;
            };

            /**
             * Creates a plain object from an UnixTime message. Also converts values to other types if specified.
             * @function toObject
             * @memberof UnixTime
             * @static
             * @param {UnixTime} m UnixTime
             * @param {$protobuf.IConversionOptions} [o] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            UnixTime.toObject = function toObject(m, o) {
              if (!o) o = {};
              var d = {};
              if (o.defaults) {
                if ($util.Long) {
                  var n = new $util.Long(0, 0, false);
                  d.Seconds =
                    o.longs === String
                      ? n.toString()
                      : o.longs === Number
                      ? n.toNumber()
                      : n;
                } else d.Seconds = o.longs === String ? "0" : 0;
                d.FractionalNanoseconds = 0;
              }
              if (m.Seconds != null && m.hasOwnProperty("Seconds")) {
                if (typeof m.Seconds === "number")
                  d.Seconds =
                    o.longs === String ? String(m.Seconds) : m.Seconds;
                else
                  d.Seconds =
                    o.longs === String
                      ? $util.Long.prototype.toString.call(m.Seconds)
                      : o.longs === Number
                      ? new $util.LongBits(
                          m.Seconds.low >>> 0,
                          m.Seconds.high >>> 0
                        ).toNumber()
                      : m.Seconds;
              }
              if (
                m.FractionalNanoseconds != null &&
                m.hasOwnProperty("FractionalNanoseconds")
              ) {
                d.FractionalNanoseconds = m.FractionalNanoseconds;
              }
              return d;
            };

            /**
             * Converts this UnixTime to JSON.
             * @function toJSON
             * @memberof UnixTime
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            UnixTime.prototype.toJSON = function toJSON() {
              return this.constructor.toObject(
                this,
                $protobuf.util.toJSONOptions
              );
            };

            return UnixTime;
          })();

          $root.Metadata = (function () {
            /**
             * Properties of a Metadata.
             * @exports IMetadata
             * @interface IMetadata
             * @property {string|null} [MimeType] Metadata MimeType
             */

            /**
             * Constructs a new Metadata.
             * @exports Metadata
             * @classdesc Represents a Metadata.
             * @implements IMetadata
             * @constructor
             * @param {IMetadata=} [p] Properties to set
             */
            function Metadata(p) {
              if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                  if (p[ks[i]] != null) this[ks[i]] = p[ks[i]];
            }

            /**
             * Metadata MimeType.
             * @member {string} MimeType
             * @memberof Metadata
             * @instance
             */
            Metadata.prototype.MimeType = "";

            /**
             * Encodes the specified Metadata message. Does not implicitly {@link Metadata.verify|verify} messages.
             * @function encode
             * @memberof Metadata
             * @static
             * @param {IMetadata} m Metadata message or plain object to encode
             * @param {$protobuf.Writer} [w] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Metadata.encode = function encode(m, w) {
              if (!w) w = $Writer.create();
              if (
                m.MimeType != null &&
                Object.hasOwnProperty.call(m, "MimeType")
              )
                w.uint32(10).string(m.MimeType);
              return w;
            };

            /**
             * Decodes a Metadata message from the specified reader or buffer.
             * @function decode
             * @memberof Metadata
             * @static
             * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
             * @param {number} [l] Message length if known beforehand
             * @returns {Metadata} Metadata
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Metadata.decode = function decode(r, l) {
              if (!(r instanceof $Reader)) r = $Reader.create(r);
              var c = l === undefined ? r.len : r.pos + l,
                m = new $root.Metadata();
              while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                  case 1:
                    m.MimeType = r.string();
                    break;
                  default:
                    r.skipType(t & 7);
                    break;
                }
              }
              return m;
            };

            /**
             * Creates a Metadata message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof Metadata
             * @static
             * @param {Object.<string,*>} d Plain object
             * @returns {Metadata} Metadata
             */
            Metadata.fromObject = function fromObject(d) {
              if (d instanceof $root.Metadata) return d;
              var m = new $root.Metadata();
              if (d.MimeType != null) {
                m.MimeType = String(d.MimeType);
              }
              return m;
            };

            /**
             * Creates a plain object from a Metadata message. Also converts values to other types if specified.
             * @function toObject
             * @memberof Metadata
             * @static
             * @param {Metadata} m Metadata
             * @param {$protobuf.IConversionOptions} [o] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Metadata.toObject = function toObject(m, o) {
              if (!o) o = {};
              var d = {};
              if (o.defaults) {
                d.MimeType = "";
              }
              if (m.MimeType != null && m.hasOwnProperty("MimeType")) {
                d.MimeType = m.MimeType;
              }
              return d;
            };

            /**
             * Converts this Metadata to JSON.
             * @function toJSON
             * @memberof Metadata
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Metadata.prototype.toJSON = function toJSON() {
              return this.constructor.toObject(
                this,
                $protobuf.util.toJSONOptions
              );
            };

            return Metadata;
          })();

          module.exports = $root;
        },
        { "protobufjs/minimal": 138 },
      ],
      56: [
        function (require, module, exports) {
          "use strict";

          const CID = require("cids");
          const uint8ArrayFromString = require("uint8arrays/from-string");

          /**
           * Link represents an IPFS Merkle DAG Link between Nodes.
           */
          class DAGLink {
            /**
             * @param {string | undefined | null} name
             * @param {number} size
             * @param {CID | string | Uint8Array} cid
             */
            constructor(name, size, cid) {
              if (!cid) {
                throw new Error("A link requires a cid to point to");
              }

              // assert(size, 'A link requires a size')
              //  note - links should include size, but this assert is disabled
              //  for now to maintain consistency with go-ipfs pinset
              this.Name = name || "";
              this.Tsize = size;
              this.Hash = new CID(cid);

              Object.defineProperties(this, {
                _nameBuf: { value: null, writable: true, enumerable: false },
              });
            }

            toString() {
              return `DAGLink <${this.Hash.toBaseEncodedString()} - name: "${
                this.Name
              }", size: ${this.Tsize}>`;
            }

            toJSON() {
              if (!this._json) {
                this._json = Object.freeze({
                  name: this.Name,
                  size: this.Tsize,
                  cid: this.Hash.toBaseEncodedString(),
                });
              }

              return Object.assign({}, this._json);
            }

            // Memoize the Uint8Array representation of name
            // We need this to sort the links, otherwise
            // we will reallocate new Uint8Arrays every time
            get nameAsBuffer() {
              if (this._nameBuf != null) {
                return this._nameBuf;
              }

              this._nameBuf = uint8ArrayFromString(this.Name);
              return this._nameBuf;
            }
          }

          module.exports = DAGLink;
        },
        { cids: 23, "uint8arrays/from-string": 156 },
      ],
      57: [
        function (require, module, exports) {
          "use strict";

          const DAGLink = require("./dagLink");

          /**
           * @param {*} link
           */
          function createDagLinkFromB58EncodedHash(link) {
            return new DAGLink(
              link.Name || link.name || "",
              link.Tsize || link.Size || link.size || 0,
              link.Hash || link.hash || link.multihash || link.cid
            );
          }

          module.exports = {
            createDagLinkFromB58EncodedHash,
          };
        },
        { "./dagLink": 56 },
      ],
      58: [
        function (require, module, exports) {
          "use strict";

          const sortLinks = require("./sortLinks");
          const DAGLink = require("../dag-link/dagLink");

          /**
           * @typedef {import('./dagNode')} DAGNode
           * @typedef {import('../types')} DAGLinkLike
           */

          /**
           * @param {*} link
           * @returns {DAGLink}
           */
          const asDAGLink = (link) => {
            if (link instanceof DAGLink) {
              // It's a DAGLink instance
              // no need to do anything
              return link;
            }

            // DAGNode.isDagNode() would be more appropriate here, but it can't be used
            // as it would lead to circular dependencies as `addLink` is called from
            // within the DAGNode object.
            if (
              !(
                "cid" in link ||
                "hash" in link ||
                "Hash" in link ||
                "multihash" in link
              )
            ) {
              throw new Error(
                "Link must be a DAGLink or DAGLink-like. Convert the DAGNode into a DAGLink via `node.toDAGLink()`."
              );
            }

            // It's a Object with name, multihash/hash/cid and size
            // @ts-ignore
            return new DAGLink(
              link.Name || link.name,
              link.Tsize || link.size,
              link.Hash || link.multihash || link.hash || link.cid
            );
          };

          /**
           * @param {DAGNode} node
           * @param {DAGLink | DAGLinkLike} link
           */
          const addLink = (node, link) => {
            const dagLink = asDAGLink(link);
            node.Links.push(dagLink);
            sortLinks(node.Links);
          };

          module.exports = addLink;
        },
        { "../dag-link/dagLink": 56, "./sortLinks": 61 },
      ],
      59: [
        function (require, module, exports) {
          "use strict";

          const sortLinks = require("./sortLinks");
          const DAGLink = require("../dag-link/dagLink");
          const {
            createDagLinkFromB58EncodedHash,
          } = require("../dag-link/util");
          const { serializeDAGNode } = require("../serialize");
          const toDAGLink = require("./toDagLink");
          const addLink = require("./addLink");
          const rmLink = require("./rmLink");
          const uint8ArrayFromString = require("uint8arrays/from-string");
          const uint8ArrayToString = require("uint8arrays/to-string");

          /**
           * @typedef {import('cids')} CID
           * @typedef {import('../types').DAGLinkLike} DAGLinkLike
           */

          class DAGNode {
            /**
             *@param {Uint8Array | string} [data]
             * @param {(DAGLink | DAGLinkLike)[]} links
             * @param {number | null} [serializedSize]
             */
            constructor(data, links = [], serializedSize = null) {
              if (!data) {
                data = new Uint8Array(0);
              }
              if (typeof data === "string") {
                data = uint8ArrayFromString(data);
              }

              if (!(data instanceof Uint8Array)) {
                throw new Error(
                  "Passed 'data' is not a Uint8Array or a String!"
                );
              }

              if (
                serializedSize !== null &&
                typeof serializedSize !== "number"
              ) {
                throw new Error("Passed 'serializedSize' must be a number!");
              }

              const sortedLinks = links.map((link) => {
                return link instanceof DAGLink
                  ? link
                  : createDagLinkFromB58EncodedHash(link);
              });
              sortLinks(sortedLinks);

              this.Data = data;
              this.Links = sortedLinks;

              Object.defineProperties(this, {
                _serializedSize: {
                  value: serializedSize,
                  writable: true,
                  enumerable: false,
                },
                _size: { value: null, writable: true, enumerable: false },
              });
            }

            toJSON() {
              if (!this._json) {
                this._json = Object.freeze({
                  data: this.Data,
                  links: this.Links.map((l) => l.toJSON()),
                  size: this.size,
                });
              }

              return Object.assign({}, this._json);
            }

            toString() {
              return `DAGNode <data: "${uint8ArrayToString(
                this.Data,
                "base64urlpad"
              )}", links: ${this.Links.length}, size: ${this.size}>`;
            }

            _invalidateCached() {
              this._serializedSize = null;
              this._size = null;
            }

            /**
             * @param {DAGLink | import('../types').DAGLinkLike} link
             */
            addLink(link) {
              this._invalidateCached();
              return addLink(this, link);
            }

            /**
             * @param {DAGLink | string | CID} link
             */
            rmLink(link) {
              this._invalidateCached();
              return rmLink(this, link);
            }

            /**
             * @param {import('./toDagLink').ToDagLinkOptions} [options]
             */
            toDAGLink(options) {
              return toDAGLink(this, options);
            }

            serialize() {
              const buf = serializeDAGNode(this);

              this._serializedSize = buf.length;

              return buf;
            }

            get size() {
              if (this._size == null) {
                let serializedSize;

                if (serializedSize == null) {
                  this._serializedSize = this.serialize().length;
                  serializedSize = this._serializedSize;
                }

                this._size = this.Links.reduce(
                  (sum, l) => sum + l.Tsize,
                  serializedSize
                );
              }

              return this._size;
            }

            set size(size) {
              throw new Error("Can't set property: 'size' is immutable");
            }
          }

          module.exports = DAGNode;
        },
        {
          "../dag-link/dagLink": 56,
          "../dag-link/util": 57,
          "../serialize": 67,
          "./addLink": 58,
          "./rmLink": 60,
          "./sortLinks": 61,
          "./toDagLink": 62,
          "uint8arrays/from-string": 156,
          "uint8arrays/to-string": 157,
        },
      ],
      60: [
        function (require, module, exports) {
          "use strict";

          const CID = require("cids");
          const uint8ArrayEquals = require("uint8arrays/equals");

          /**
           * @typedef {import('../dag-link/dagLink')} DAGLink
           */

          /**
           *
           * @param {import('./dagNode')} dagNode
           * @param {string | CID | Uint8Array | DAGLink} nameOrCid
           */
          const rmLink = (dagNode, nameOrCid) => {
            let predicate = null;

            // It's a name
            if (typeof nameOrCid === "string") {
              predicate = (/** @type {DAGLink} */ link) =>
                link.Name === nameOrCid;
            } else if (nameOrCid instanceof Uint8Array) {
              predicate = (/** @type {DAGLink} */ link) =>
                uint8ArrayEquals(link.Hash.bytes, nameOrCid);
            } else if (CID.isCID(nameOrCid)) {
              predicate = (/** @type {DAGLink} */ link) =>
                uint8ArrayEquals(link.Hash.bytes, nameOrCid.bytes);
            }

            if (predicate) {
              const links = dagNode.Links;
              let index = 0;
              while (index < links.length) {
                const link = links[index];
                if (predicate(link)) {
                  links.splice(index, 1);
                } else {
                  index++;
                }
              }
            } else {
              throw new Error("second arg needs to be a name or CID");
            }
          };

          module.exports = rmLink;
        },
        { cids: 23, "uint8arrays/equals": 155 },
      ],
      61: [
        function (require, module, exports) {
          "use strict";

          const sort = require("stable");
          const uint8ArrayCompare = require("uint8arrays/compare");

          /**
           * @typedef {import('../dag-link/dagLink')} DAGLink
           */

          /**
           *
           * @param {DAGLink} a
           * @param {DAGLink} b
           */
          const linkSort = (a, b) => {
            const buf1 = a.nameAsBuffer;
            const buf2 = b.nameAsBuffer;

            return uint8ArrayCompare(buf1, buf2);
          };

          /**
           * Sorts links in place (mutating given array)
           *
           * @param {DAGLink[]} links
           * @returns {void}
           */
          const sortLinks = (links) => {
            sort.inplace(links, linkSort);
          };

          module.exports = sortLinks;
        },
        { stable: 153, "uint8arrays/compare": 154 },
      ],
      62: [
        function (require, module, exports) {
          "use strict";

          const DAGLink = require("../dag-link/dagLink");
          const genCid = require("../genCid");

          /**
           * toDAGLink converts a DAGNode to a DAGLink
           *
           * @typedef {import('../genCid').GenCIDOptions} GenCIDOptions
           *
           * @typedef {object} ToDagLinkExtraOptions
           * @property {string} [name]
           *
           * @typedef {GenCIDOptions & ToDagLinkExtraOptions} ToDagLinkOptions
           *
           * @param {import('./dagNode')} node
           * @param {ToDagLinkOptions} options
           */
          const toDAGLink = async (node, options = {}) => {
            const buf = node.serialize();
            const nodeCid = await genCid.cid(buf, options);
            return new DAGLink(options.name || "", node.size, nodeCid);
          };

          module.exports = toDAGLink;
        },
        { "../dag-link/dagLink": 56, "../genCid": 64 },
      ],
      63: [
        function (require, module, exports) {
          /*eslint-disable*/
          "use strict";

          var $protobuf = require("protobufjs/minimal");

          // Common aliases
          var $Reader = $protobuf.Reader,
            $Writer = $protobuf.Writer,
            $util = $protobuf.util;

          // Exported root namespace
          var $root =
            $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

          $root.PBLink = (function () {
            /**
             * Properties of a PBLink.
             * @exports IPBLink
             * @interface IPBLink
             * @property {Uint8Array|null} [Hash] PBLink Hash
             * @property {string|null} [Name] PBLink Name
             * @property {number|null} [Tsize] PBLink Tsize
             */

            /**
             * Constructs a new PBLink.
             * @exports PBLink
             * @classdesc Represents a PBLink.
             * @implements IPBLink
             * @constructor
             * @param {IPBLink=} [p] Properties to set
             */
            function PBLink(p) {
              if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                  if (p[ks[i]] != null) this[ks[i]] = p[ks[i]];
            }

            /**
             * PBLink Hash.
             * @member {Uint8Array} Hash
             * @memberof PBLink
             * @instance
             */
            PBLink.prototype.Hash = $util.newBuffer([]);

            /**
             * PBLink Name.
             * @member {string} Name
             * @memberof PBLink
             * @instance
             */
            PBLink.prototype.Name = "";

            /**
             * PBLink Tsize.
             * @member {number} Tsize
             * @memberof PBLink
             * @instance
             */
            PBLink.prototype.Tsize = $util.Long
              ? $util.Long.fromBits(0, 0, true)
              : 0;

            /**
             * Encodes the specified PBLink message. Does not implicitly {@link PBLink.verify|verify} messages.
             * @function encode
             * @memberof PBLink
             * @static
             * @param {IPBLink} m PBLink message or plain object to encode
             * @param {$protobuf.Writer} [w] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            PBLink.encode = function encode(m, w) {
              if (!w) w = $Writer.create();
              if (m.Hash != null && Object.hasOwnProperty.call(m, "Hash"))
                w.uint32(10).bytes(m.Hash);
              if (m.Name != null && Object.hasOwnProperty.call(m, "Name"))
                w.uint32(18).string(m.Name);
              if (m.Tsize != null && Object.hasOwnProperty.call(m, "Tsize"))
                w.uint32(24).uint64(m.Tsize);
              return w;
            };

            /**
             * Decodes a PBLink message from the specified reader or buffer.
             * @function decode
             * @memberof PBLink
             * @static
             * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
             * @param {number} [l] Message length if known beforehand
             * @returns {PBLink} PBLink
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            PBLink.decode = function decode(r, l) {
              if (!(r instanceof $Reader)) r = $Reader.create(r);
              var c = l === undefined ? r.len : r.pos + l,
                m = new $root.PBLink();
              while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                  case 1:
                    m.Hash = r.bytes();
                    break;
                  case 2:
                    m.Name = r.string();
                    break;
                  case 3:
                    m.Tsize = r.uint64();
                    break;
                  default:
                    r.skipType(t & 7);
                    break;
                }
              }
              return m;
            };

            /**
             * Creates a PBLink message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof PBLink
             * @static
             * @param {Object.<string,*>} d Plain object
             * @returns {PBLink} PBLink
             */
            PBLink.fromObject = function fromObject(d) {
              if (d instanceof $root.PBLink) return d;
              var m = new $root.PBLink();
              if (d.Hash != null) {
                if (typeof d.Hash === "string")
                  $util.base64.decode(
                    d.Hash,
                    (m.Hash = $util.newBuffer($util.base64.length(d.Hash))),
                    0
                  );
                else if (d.Hash.length) m.Hash = d.Hash;
              }
              if (d.Name != null) {
                m.Name = String(d.Name);
              }
              if (d.Tsize != null) {
                if ($util.Long)
                  (m.Tsize = $util.Long.fromValue(d.Tsize)).unsigned = true;
                else if (typeof d.Tsize === "string")
                  m.Tsize = parseInt(d.Tsize, 10);
                else if (typeof d.Tsize === "number") m.Tsize = d.Tsize;
                else if (typeof d.Tsize === "object")
                  m.Tsize = new $util.LongBits(
                    d.Tsize.low >>> 0,
                    d.Tsize.high >>> 0
                  ).toNumber(true);
              }
              return m;
            };

            /**
             * Creates a plain object from a PBLink message. Also converts values to other types if specified.
             * @function toObject
             * @memberof PBLink
             * @static
             * @param {PBLink} m PBLink
             * @param {$protobuf.IConversionOptions} [o] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            PBLink.toObject = function toObject(m, o) {
              if (!o) o = {};
              var d = {};
              if (o.defaults) {
                if (o.bytes === String) d.Hash = "";
                else {
                  d.Hash = [];
                  if (o.bytes !== Array) d.Hash = $util.newBuffer(d.Hash);
                }
                d.Name = "";
                if ($util.Long) {
                  var n = new $util.Long(0, 0, true);
                  d.Tsize =
                    o.longs === String
                      ? n.toString()
                      : o.longs === Number
                      ? n.toNumber()
                      : n;
                } else d.Tsize = o.longs === String ? "0" : 0;
              }
              if (m.Hash != null && m.hasOwnProperty("Hash")) {
                d.Hash =
                  o.bytes === String
                    ? $util.base64.encode(m.Hash, 0, m.Hash.length)
                    : o.bytes === Array
                    ? Array.prototype.slice.call(m.Hash)
                    : m.Hash;
              }
              if (m.Name != null && m.hasOwnProperty("Name")) {
                d.Name = m.Name;
              }
              if (m.Tsize != null && m.hasOwnProperty("Tsize")) {
                if (typeof m.Tsize === "number")
                  d.Tsize = o.longs === String ? String(m.Tsize) : m.Tsize;
                else
                  d.Tsize =
                    o.longs === String
                      ? $util.Long.prototype.toString.call(m.Tsize)
                      : o.longs === Number
                      ? new $util.LongBits(
                          m.Tsize.low >>> 0,
                          m.Tsize.high >>> 0
                        ).toNumber(true)
                      : m.Tsize;
              }
              return d;
            };

            /**
             * Converts this PBLink to JSON.
             * @function toJSON
             * @memberof PBLink
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            PBLink.prototype.toJSON = function toJSON() {
              return this.constructor.toObject(
                this,
                $protobuf.util.toJSONOptions
              );
            };

            return PBLink;
          })();

          $root.PBNode = (function () {
            /**
             * Properties of a PBNode.
             * @exports IPBNode
             * @interface IPBNode
             * @property {Array.<IPBLink>|null} [Links] PBNode Links
             * @property {Uint8Array|null} [Data] PBNode Data
             */

            /**
             * Constructs a new PBNode.
             * @exports PBNode
             * @classdesc Represents a PBNode.
             * @implements IPBNode
             * @constructor
             * @param {IPBNode=} [p] Properties to set
             */
            function PBNode(p) {
              this.Links = [];
              if (p)
                for (var ks = Object.keys(p), i = 0; i < ks.length; ++i)
                  if (p[ks[i]] != null) this[ks[i]] = p[ks[i]];
            }

            /**
             * PBNode Links.
             * @member {Array.<IPBLink>} Links
             * @memberof PBNode
             * @instance
             */
            PBNode.prototype.Links = $util.emptyArray;

            /**
             * PBNode Data.
             * @member {Uint8Array} Data
             * @memberof PBNode
             * @instance
             */
            PBNode.prototype.Data = $util.newBuffer([]);

            /**
             * Encodes the specified PBNode message. Does not implicitly {@link PBNode.verify|verify} messages.
             * @function encode
             * @memberof PBNode
             * @static
             * @param {IPBNode} m PBNode message or plain object to encode
             * @param {$protobuf.Writer} [w] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            PBNode.encode = function encode(m, w) {
              if (!w) w = $Writer.create();
              if (m.Data != null && Object.hasOwnProperty.call(m, "Data"))
                w.uint32(10).bytes(m.Data);
              if (m.Links != null && m.Links.length) {
                for (var i = 0; i < m.Links.length; ++i)
                  $root.PBLink.encode(m.Links[i], w.uint32(18).fork()).ldelim();
              }
              return w;
            };

            /**
             * Decodes a PBNode message from the specified reader or buffer.
             * @function decode
             * @memberof PBNode
             * @static
             * @param {$protobuf.Reader|Uint8Array} r Reader or buffer to decode from
             * @param {number} [l] Message length if known beforehand
             * @returns {PBNode} PBNode
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            PBNode.decode = function decode(r, l) {
              if (!(r instanceof $Reader)) r = $Reader.create(r);
              var c = l === undefined ? r.len : r.pos + l,
                m = new $root.PBNode();
              while (r.pos < c) {
                var t = r.uint32();
                switch (t >>> 3) {
                  case 2:
                    if (!(m.Links && m.Links.length)) m.Links = [];
                    m.Links.push($root.PBLink.decode(r, r.uint32()));
                    break;
                  case 1:
                    m.Data = r.bytes();
                    break;
                  default:
                    r.skipType(t & 7);
                    break;
                }
              }
              return m;
            };

            /**
             * Creates a PBNode message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof PBNode
             * @static
             * @param {Object.<string,*>} d Plain object
             * @returns {PBNode} PBNode
             */
            PBNode.fromObject = function fromObject(d) {
              if (d instanceof $root.PBNode) return d;
              var m = new $root.PBNode();
              if (d.Links) {
                if (!Array.isArray(d.Links))
                  throw TypeError(".PBNode.Links: array expected");
                m.Links = [];
                for (var i = 0; i < d.Links.length; ++i) {
                  if (typeof d.Links[i] !== "object")
                    throw TypeError(".PBNode.Links: object expected");
                  m.Links[i] = $root.PBLink.fromObject(d.Links[i]);
                }
              }
              if (d.Data != null) {
                if (typeof d.Data === "string")
                  $util.base64.decode(
                    d.Data,
                    (m.Data = $util.newBuffer($util.base64.length(d.Data))),
                    0
                  );
                else if (d.Data.length) m.Data = d.Data;
              }
              return m;
            };

            /**
             * Creates a plain object from a PBNode message. Also converts values to other types if specified.
             * @function toObject
             * @memberof PBNode
             * @static
             * @param {PBNode} m PBNode
             * @param {$protobuf.IConversionOptions} [o] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            PBNode.toObject = function toObject(m, o) {
              if (!o) o = {};
              var d = {};
              if (o.arrays || o.defaults) {
                d.Links = [];
              }
              if (o.defaults) {
                if (o.bytes === String) d.Data = "";
                else {
                  d.Data = [];
                  if (o.bytes !== Array) d.Data = $util.newBuffer(d.Data);
                }
              }
              if (m.Data != null && m.hasOwnProperty("Data")) {
                d.Data =
                  o.bytes === String
                    ? $util.base64.encode(m.Data, 0, m.Data.length)
                    : o.bytes === Array
                    ? Array.prototype.slice.call(m.Data)
                    : m.Data;
              }
              if (m.Links && m.Links.length) {
                d.Links = [];
                for (var j = 0; j < m.Links.length; ++j) {
                  d.Links[j] = $root.PBLink.toObject(m.Links[j], o);
                }
              }
              return d;
            };

            /**
             * Converts this PBNode to JSON.
             * @function toJSON
             * @memberof PBNode
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            PBNode.prototype.toJSON = function toJSON() {
              return this.constructor.toObject(
                this,
                $protobuf.util.toJSONOptions
              );
            };

            return PBNode;
          })();

          module.exports = $root;
        },
        { "protobufjs/minimal": 138 },
      ],
      64: [
        function (require, module, exports) {
          "use strict";

          const CID = require("cids");
          const multicodec = require("multicodec");
          const multihashing = require("multihashing-async");
          const { multihash } = multihashing;

          const codec = multicodec.DAG_PB;
          const defaultHashAlg = multihash.names["sha2-256"];

          /**
           * @typedef {object} GenCIDOptions - Options to create the CID
           * @property {CID.CIDVersion} [cidVersion=1] - CID version number
           * @property {multihashing.multihash.HashCode} [hashAlg=multihash.names['sha2-256']] - Defaults to the defaultHashAlg of the format
           */

          /**
           * Calculate the CID of the binary blob.
           *
           * @param {Uint8Array} binaryBlob - Encoded IPLD Node
           * @param {GenCIDOptions} [userOptions] - Options to create the CID
           */
          const cid = async (binaryBlob, userOptions = {}) => {
            const options = {
              cidVersion:
                userOptions.cidVersion == null ? 1 : userOptions.cidVersion,
              hashAlg:
                userOptions.hashAlg == null
                  ? defaultHashAlg
                  : userOptions.hashAlg,
            };

            const hashName = multihash.codes[options.hashAlg];
            const hash = await multihashing(binaryBlob, hashName);
            const codecName = multicodec.getNameFromCode(codec);
            const cid = new CID(options.cidVersion, codecName, hash);

            return cid;
          };

          module.exports = {
            codec,
            defaultHashAlg,
            cid,
          };
        },
        { cids: 23, multicodec: 87, "multihashing-async": 133 },
      ],
      65: [
        function (require, module, exports) {
          "use strict";

          const resolver = require("./resolver");
          const util = require("./util");
          const DAGNodeClass = require("./dag-node/dagNode");
          const DAGLinkClass = require("./dag-link/dagLink");

          /**
           * @typedef {import('./types').DAGLinkLike} DAGLinkLike
           * @typedef {import('./types').DAGNodeLike} DAGNodeLike
           * @typedef {import('./dag-node/dagNode')} DAGNode
           * @typedef {import('./dag-link/dagLink')} DAGLink
           */

          /**
           * @type {import('./types').DAGNodeFormat}
           */
          const format = {
            DAGNode: DAGNodeClass,
            DAGLink: DAGLinkClass,

            /**
             * Functions to fulfil IPLD Format interface
             * https://github.com/ipld/interface-ipld-format
             */
            resolver,
            util,
            codec: util.codec,
            defaultHashAlg: util.defaultHashAlg,
          };

          module.exports = format;
        },
        {
          "./dag-link/dagLink": 56,
          "./dag-node/dagNode": 59,
          "./resolver": 66,
          "./util": 68,
        },
      ],
      66: [
        function (require, module, exports) {
          "use strict";

          const CID = require("cids");

          const util = require("./util");

          /**
           * Resolves a path within a PB block.
           *
           * If the path resolves half-way to a link, then the `remainderPath` is the part
           * after the link that can be used for further resolving
           *
           * Returns the value or a link and the partial missing path. This way the
           * IPLD Resolver can fetch the link and continue to resolve.
           *
           * @param {Uint8Array} binaryBlob - Binary representation of a PB block
           * @param {string} [path='/'] - Path that should be resolved
           */
          exports.resolve = (binaryBlob, path = "/") => {
            let node = util.deserialize(binaryBlob);

            const parts = path.split("/").filter(Boolean);
            while (parts.length) {
              const key = parts.shift();
              // @ts-ignore
              if (node[key] === undefined) {
                // There might be a matching named link
                for (const link of node.Links) {
                  if (link.Name === key) {
                    return {
                      value: link.Hash,
                      remainderPath: parts.join("/"),
                    };
                  }
                }

                // There wasn't even a matching named link
                throw new Error(`Object has no property '${key}'`);
              }

              // @ts-ignore
              node = node[key];
              if (CID.isCID(node)) {
                return {
                  value: node,
                  remainderPath: parts.join("/"),
                };
              }
            }

            return {
              value: node,
              remainderPath: "",
            };
          };

          /**
           * Return all available paths of a block.
           *
           * @generator
           * @param {Uint8Array} binaryBlob - Binary representation of a PB block
           * @yields {string} - A single path
           */
          exports.tree = function* (binaryBlob) {
            const node = util.deserialize(binaryBlob);

            // There is always a `Data` and `Links` property
            yield "Data";
            yield "Links";
            for (let ii = 0; ii < node.Links.length; ii++) {
              yield `Links/${ii}`;
              yield `Links/${ii}/Name`;
              yield `Links/${ii}/Tsize`;
              yield `Links/${ii}/Hash`;
            }
          };
        },
        { "./util": 68, cids: 23 },
      ],
      67: [
        function (require, module, exports) {
          "use strict";

          const protobuf = require("protobufjs/minimal");
          const { PBLink } = require("./dag");

          const {
            createDagLinkFromB58EncodedHash,
          } = require("./dag-link/util");

          /**
           * @typedef {import('./dag-link/dagLink')} DAGLink
           * @typedef {import('./types').DAGLinkLike} DAGLinkLike
           * @typedef {import('./types').SerializableDAGNode} SerializableDAGNode
           * @typedef {import('cids')} CID
           */

          /**
           * @param { { Data?: Uint8Array, Links: (DAGLink | DAGLinkLike)[] }} node
           * @returns {SerializableDAGNode}
           */
          const toProtoBuf = (node) => {
            const pbn = {};

            if (node.Data && node.Data.byteLength > 0) {
              pbn.Data = node.Data;
            } else {
              // NOTE: this has to be null in order to match go-ipfs serialization
              // `null !== new Uint8Array(0)`
              pbn.Data = null;
            }

            if (node.Links && node.Links.length > 0) {
              pbn.Links = node.Links.map((link) => ({
                Hash: link.Hash.bytes,
                Name: link.Name,
                Tsize: link.Tsize,
              }));
            } else {
              pbn.Links = null;
            }

            return pbn;
          };

          /**
           * Serialize internal representation into a binary PB block.
           *
           * @param {import('./dag-node/dagNode')} node - Internal representation of a PB block
           */
          const serializeDAGNode = (node) => {
            return encode(toProtoBuf(node));
          };

          /**
           * Serialize an object where the `Links` might not be a `DAGLink` instance yet
           *
           * @param {Uint8Array} [data]
           * @param {(DAGLink | string | DAGLinkLike)[]} [links]
           */
          const serializeDAGNodeLike = (data, links = []) => {
            const node = {
              Data: data,
              Links: links.map((link) => {
                return createDagLinkFromB58EncodedHash(link);
              }),
            };

            return encode(toProtoBuf(node));
          };

          module.exports = {
            serializeDAGNode,
            serializeDAGNodeLike,
          };

          /**
           * The fields in PBNode are the wrong way round - `id: 2` comes before
           * `id: 1`. protobufjs writes them out in id order but go-IPFS does not so
           * we have to use the protobuf.Writer interface directly to get the same
           * serialized form as go-IPFS
           *
           * @param {SerializableDAGNode} pbf
           */
          function encode(pbf) {
            const writer = protobuf.Writer.create();

            if (pbf.Links != null) {
              for (let i = 0; i < pbf.Links.length; i++) {
                PBLink.encode(pbf.Links[i], writer.uint32(18).fork()).ldelim();
              }
            }

            if (pbf.Data != null) {
              writer.uint32(10).bytes(pbf.Data);
            }

            return writer.finish();
          }
        },
        { "./dag": 63, "./dag-link/util": 57, "protobufjs/minimal": 138 },
      ],
      68: [
        function (require, module, exports) {
          "use strict";

          const { PBNode } = require("./dag");
          const DAGLink = require("./dag-link/dagLink");
          const DAGNode = require("./dag-node/dagNode");
          const {
            serializeDAGNode,
            serializeDAGNodeLike,
          } = require("./serialize");
          const genCid = require("./genCid");

          /**
           * @typedef {import('./types').DAGLinkLike} DAGLinkLike
           */

          /**
           * Calculate the CID of the binary blob
           *
           * @param {Uint8Array} binaryBlob - Encoded IPLD Node
           * @param {import('./genCid').GenCIDOptions} [userOptions] - Options to create the CID
           */
          const cid = (binaryBlob, userOptions) => {
            return genCid.cid(binaryBlob, userOptions);
          };

          /**
           * Serialize internal representation into a binary PB block
           *
           * @param {DAGNode | { Data?: Uint8Array, Links?: (DAGLink | DAGLinkLike)[]}} node
           */
          const serialize = (node) => {
            if (node instanceof DAGNode) {
              return serializeDAGNode(node);
            } else {
              return serializeDAGNodeLike(node.Data, node.Links);
            }
          };

          /**
           * Deserialize PB block into the internal representation.
           *
           * @param {Uint8Array} buffer - Binary representation of a PB block
           */
          const deserialize = (buffer) => {
            const message = PBNode.decode(buffer);
            const pbn = PBNode.toObject(message, {
              defaults: false,
              arrays: true,
              longs: Number,
              objects: false,
            });

            /** @type {DAGLink[]} */
            const links = pbn.Links.map((/** @type {DAGLinkLike} */ link) => {
              // @ts-ignore
              return new DAGLink(link.Name, link.Tsize, link.Hash);
            });

            const data = pbn.Data == null ? new Uint8Array(0) : pbn.Data;

            return new DAGNode(data, links, buffer.byteLength);
          };

          module.exports = {
            codec: genCid.codec,
            defaultHashAlg: genCid.defaultHashAlg,
            serialize,
            deserialize,
            cid,
          };
        },
        {
          "./dag": 63,
          "./dag-link/dagLink": 56,
          "./dag-node/dagNode": 59,
          "./genCid": 64,
          "./serialize": 67,
        },
      ],
      69: [
        function (require, module, exports) {
          "use strict";

          module.exports = (value) => {
            if (Object.prototype.toString.call(value) !== "[object Object]") {
              return false;
            }

            const prototype = Object.getPrototypeOf(value);
            return prototype === null || prototype === Object.prototype;
          };
        },
        {},
      ],
      70: [
        function (require, module, exports) {
          "use strict";

          /**
           * Collects all values from an (async) iterable into an array and returns it.
           *
           * @template T
           * @param {AsyncIterable<T>|Iterable<T>} source
           */
          const all = async (source) => {
            const arr = [];

            for await (const entry of source) {
              arr.push(entry);
            }

            return arr;
          };

          module.exports = all;
        },
        {},
      ],
      71: [
        function (require, module, exports) {
          "use strict";

          /**
           * Takes an (async) iterable that emits things and returns an async iterable that
           * emits those things in fixed-sized batches.
           *
           * @template T
           * @param {AsyncIterable<T>|Iterable<T>} source
           * @param {number} [size=1]
           * @returns {AsyncIterable<T[]>}
           */
          async function* batch(source, size = 1) {
            /** @type {T[]} */
            let things = [];

            if (size < 1) {
              size = 1;
            }

            for await (const thing of source) {
              things.push(thing);

              while (things.length >= size) {
                yield things.slice(0, size);

                things = things.slice(size);
              }
            }

            while (things.length) {
              yield things.slice(0, size);

              things = things.slice(size);
            }
          }

          module.exports = batch;
        },
        {},
      ],
      72: [
        function (require, module, exports) {
          "use strict";

          const batch = require("it-batch");

          /**
           * @template T
           * @typedef {{ok:true, value:T}} Success
           */

          /**
           * @typedef {{ok:false, err:Error}} Failure
           */

          /**
           * Takes an (async) iterator that emits promise-returning functions,
           * invokes them in parallel and emits the results as they become available but
           * in the same order as the input
           *
           * @template T
           * @param {AsyncIterable<() => Promise<T>>|Iterable<() => Promise<T>>} source
           * @param {number} [size=1]
           * @returns {AsyncIterable<T>}
           */
          async function* parallelBatch(source, size = 1) {
            for await (const tasks of batch(source, size)) {
              /** @type {Promise<Success<T>|Failure>[]} */
              const things = tasks.map(
                /**
                 * @param {() => Promise<T>} p
                 */
                (p) => {
                  return p().then(
                    (value) => ({ ok: true, value }),
                    (err) => ({ ok: false, err })
                  );
                }
              );

              for (let i = 0; i < things.length; i++) {
                const result = await things[i];

                if (result.ok) {
                  yield result.value;
                } else {
                  throw result.err;
                }
              }
            }
          }

          module.exports = parallelBatch;
        },
        { "it-batch": 71 },
      ],
      73: [
        function (require, module, exports) {
          (function (process, global) {
            (function () {
              /**
               * [js-sha3]{@link https://github.com/emn178/js-sha3}
               *
               * @version 0.8.0
               * @author Chen, Yi-Cyuan [emn178@gmail.com]
               * @copyright Chen, Yi-Cyuan 2015-2018
               * @license MIT
               */
              /*jslint bitwise: true */
              (function () {
                "use strict";

                var INPUT_ERROR = "input is invalid type";
                var FINALIZE_ERROR = "finalize already called";
                var WINDOW = typeof window === "object";
                var root = WINDOW ? window : {};
                if (root.JS_SHA3_NO_WINDOW) {
                  WINDOW = false;
                }
                var WEB_WORKER = !WINDOW && typeof self === "object";
                var NODE_JS =
                  !root.JS_SHA3_NO_NODE_JS &&
                  typeof process === "object" &&
                  process.versions &&
                  process.versions.node;
                if (NODE_JS) {
                  root = global;
                } else if (WEB_WORKER) {
                  root = self;
                }
                var COMMON_JS =
                  !root.JS_SHA3_NO_COMMON_JS &&
                  typeof module === "object" &&
                  module.exports;
                var AMD = typeof define === "function" && define.amd;
                var ARRAY_BUFFER =
                  !root.JS_SHA3_NO_ARRAY_BUFFER &&
                  typeof ArrayBuffer !== "undefined";
                var HEX_CHARS = "0123456789abcdef".split("");
                var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
                var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
                var KECCAK_PADDING = [1, 256, 65536, 16777216];
                var PADDING = [6, 1536, 393216, 100663296];
                var SHIFT = [0, 8, 16, 24];
                var RC = [
                  1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648,
                  32907, 0, 2147483649, 0, 2147516545, 2147483648, 32777,
                  2147483648, 138, 0, 136, 0, 2147516425, 0, 2147483658, 0,
                  2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771,
                  2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0,
                  2147483658, 2147483648, 2147516545, 2147483648, 32896,
                  2147483648, 2147483649, 0, 2147516424, 2147483648,
                ];
                var BITS = [224, 256, 384, 512];
                var SHAKE_BITS = [128, 256];
                var OUTPUT_TYPES = [
                  "hex",
                  "buffer",
                  "arrayBuffer",
                  "array",
                  "digest",
                ];
                var CSHAKE_BYTEPAD = {
                  128: 168,
                  256: 136,
                };

                if (root.JS_SHA3_NO_NODE_JS || !Array.isArray) {
                  Array.isArray = function (obj) {
                    return (
                      Object.prototype.toString.call(obj) === "[object Array]"
                    );
                  };
                }

                if (
                  ARRAY_BUFFER &&
                  (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)
                ) {
                  ArrayBuffer.isView = function (obj) {
                    return (
                      typeof obj === "object" &&
                      obj.buffer &&
                      obj.buffer.constructor === ArrayBuffer
                    );
                  };
                }

                var createOutputMethod = function (bits, padding, outputType) {
                  return function (message) {
                    return new Keccak(bits, padding, bits)
                      .update(message)
                      [outputType]();
                  };
                };

                var createShakeOutputMethod = function (
                  bits,
                  padding,
                  outputType
                ) {
                  return function (message, outputBits) {
                    return new Keccak(bits, padding, outputBits)
                      .update(message)
                      [outputType]();
                  };
                };

                var createCshakeOutputMethod = function (
                  bits,
                  padding,
                  outputType
                ) {
                  return function (message, outputBits, n, s) {
                    return methods["cshake" + bits]
                      .update(message, outputBits, n, s)
                      [outputType]();
                  };
                };

                var createKmacOutputMethod = function (
                  bits,
                  padding,
                  outputType
                ) {
                  return function (key, message, outputBits, s) {
                    return methods["kmac" + bits]
                      .update(key, message, outputBits, s)
                      [outputType]();
                  };
                };

                var createOutputMethods = function (
                  method,
                  createMethod,
                  bits,
                  padding
                ) {
                  for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
                    var type = OUTPUT_TYPES[i];
                    method[type] = createMethod(bits, padding, type);
                  }
                  return method;
                };

                var createMethod = function (bits, padding) {
                  var method = createOutputMethod(bits, padding, "hex");
                  method.create = function () {
                    return new Keccak(bits, padding, bits);
                  };
                  method.update = function (message) {
                    return method.create().update(message);
                  };
                  return createOutputMethods(
                    method,
                    createOutputMethod,
                    bits,
                    padding
                  );
                };

                var createShakeMethod = function (bits, padding) {
                  var method = createShakeOutputMethod(bits, padding, "hex");
                  method.create = function (outputBits) {
                    return new Keccak(bits, padding, outputBits);
                  };
                  method.update = function (message, outputBits) {
                    return method.create(outputBits).update(message);
                  };
                  return createOutputMethods(
                    method,
                    createShakeOutputMethod,
                    bits,
                    padding
                  );
                };

                var createCshakeMethod = function (bits, padding) {
                  var w = CSHAKE_BYTEPAD[bits];
                  var method = createCshakeOutputMethod(bits, padding, "hex");
                  method.create = function (outputBits, n, s) {
                    if (!n && !s) {
                      return methods["shake" + bits].create(outputBits);
                    } else {
                      return new Keccak(bits, padding, outputBits).bytepad(
                        [n, s],
                        w
                      );
                    }
                  };
                  method.update = function (message, outputBits, n, s) {
                    return method.create(outputBits, n, s).update(message);
                  };
                  return createOutputMethods(
                    method,
                    createCshakeOutputMethod,
                    bits,
                    padding
                  );
                };

                var createKmacMethod = function (bits, padding) {
                  var w = CSHAKE_BYTEPAD[bits];
                  var method = createKmacOutputMethod(bits, padding, "hex");
                  method.create = function (key, outputBits, s) {
                    return new Kmac(bits, padding, outputBits)
                      .bytepad(["KMAC", s], w)
                      .bytepad([key], w);
                  };
                  method.update = function (key, message, outputBits, s) {
                    return method.create(key, outputBits, s).update(message);
                  };
                  return createOutputMethods(
                    method,
                    createKmacOutputMethod,
                    bits,
                    padding
                  );
                };

                var algorithms = [
                  {
                    name: "keccak",
                    padding: KECCAK_PADDING,
                    bits: BITS,
                    createMethod: createMethod,
                  },
                  {
                    name: "sha3",
                    padding: PADDING,
                    bits: BITS,
                    createMethod: createMethod,
                  },
                  {
                    name: "shake",
                    padding: SHAKE_PADDING,
                    bits: SHAKE_BITS,
                    createMethod: createShakeMethod,
                  },
                  {
                    name: "cshake",
                    padding: CSHAKE_PADDING,
                    bits: SHAKE_BITS,
                    createMethod: createCshakeMethod,
                  },
                  {
                    name: "kmac",
                    padding: CSHAKE_PADDING,
                    bits: SHAKE_BITS,
                    createMethod: createKmacMethod,
                  },
                ];

                var methods = {},
                  methodNames = [];

                for (var i = 0; i < algorithms.length; ++i) {
                  var algorithm = algorithms[i];
                  var bits = algorithm.bits;
                  for (var j = 0; j < bits.length; ++j) {
                    var methodName = algorithm.name + "_" + bits[j];
                    methodNames.push(methodName);
                    methods[methodName] = algorithm.createMethod(
                      bits[j],
                      algorithm.padding
                    );
                    if (algorithm.name !== "sha3") {
                      var newMethodName = algorithm.name + bits[j];
                      methodNames.push(newMethodName);
                      methods[newMethodName] = methods[methodName];
                    }
                  }
                }

                function Keccak(bits, padding, outputBits) {
                  this.blocks = [];
                  this.s = [];
                  this.padding = padding;
                  this.outputBits = outputBits;
                  this.reset = true;
                  this.finalized = false;
                  this.block = 0;
                  this.start = 0;
                  this.blockCount = (1600 - (bits << 1)) >> 5;
                  this.byteCount = this.blockCount << 2;
                  this.outputBlocks = outputBits >> 5;
                  this.extraBytes = (outputBits & 31) >> 3;

                  for (var i = 0; i < 50; ++i) {
                    this.s[i] = 0;
                  }
                }

                Keccak.prototype.update = function (message) {
                  if (this.finalized) {
                    throw new Error(FINALIZE_ERROR);
                  }
                  var notString,
                    type = typeof message;
                  if (type !== "string") {
                    if (type === "object") {
                      if (message === null) {
                        throw new Error(INPUT_ERROR);
                      } else if (
                        ARRAY_BUFFER &&
                        message.constructor === ArrayBuffer
                      ) {
                        message = new Uint8Array(message);
                      } else if (!Array.isArray(message)) {
                        if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
                          throw new Error(INPUT_ERROR);
                        }
                      }
                    } else {
                      throw new Error(INPUT_ERROR);
                    }
                    notString = true;
                  }
                  var blocks = this.blocks,
                    byteCount = this.byteCount,
                    length = message.length,
                    blockCount = this.blockCount,
                    index = 0,
                    s = this.s,
                    i,
                    code;

                  while (index < length) {
                    if (this.reset) {
                      this.reset = false;
                      blocks[0] = this.block;
                      for (i = 1; i < blockCount + 1; ++i) {
                        blocks[i] = 0;
                      }
                    }
                    if (notString) {
                      for (
                        i = this.start;
                        index < length && i < byteCount;
                        ++index
                      ) {
                        blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
                      }
                    } else {
                      for (
                        i = this.start;
                        index < length && i < byteCount;
                        ++index
                      ) {
                        code = message.charCodeAt(index);
                        if (code < 0x80) {
                          blocks[i >> 2] |= code << SHIFT[i++ & 3];
                        } else if (code < 0x800) {
                          blocks[i >> 2] |=
                            (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
                          blocks[i >> 2] |=
                            (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
                        } else if (code < 0xd800 || code >= 0xe000) {
                          blocks[i >> 2] |=
                            (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
                          blocks[i >> 2] |=
                            (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
                          blocks[i >> 2] |=
                            (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
                        } else {
                          code =
                            0x10000 +
                            (((code & 0x3ff) << 10) |
                              (message.charCodeAt(++index) & 0x3ff));
                          blocks[i >> 2] |=
                            (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
                          blocks[i >> 2] |=
                            (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
                          blocks[i >> 2] |=
                            (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
                          blocks[i >> 2] |=
                            (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
                        }
                      }
                    }
                    this.lastByteIndex = i;
                    if (i >= byteCount) {
                      this.start = i - byteCount;
                      this.block = blocks[blockCount];
                      for (i = 0; i < blockCount; ++i) {
                        s[i] ^= blocks[i];
                      }
                      f(s);
                      this.reset = true;
                    } else {
                      this.start = i;
                    }
                  }
                  return this;
                };

                Keccak.prototype.encode = function (x, right) {
                  var o = x & 255,
                    n = 1;
                  var bytes = [o];
                  x = x >> 8;
                  o = x & 255;
                  while (o > 0) {
                    bytes.unshift(o);
                    x = x >> 8;
                    o = x & 255;
                    ++n;
                  }
                  if (right) {
                    bytes.push(n);
                  } else {
                    bytes.unshift(n);
                  }
                  this.update(bytes);
                  return bytes.length;
                };

                Keccak.prototype.encodeString = function (str) {
                  var notString,
                    type = typeof str;
                  if (type !== "string") {
                    if (type === "object") {
                      if (str === null) {
                        throw new Error(INPUT_ERROR);
                      } else if (
                        ARRAY_BUFFER &&
                        str.constructor === ArrayBuffer
                      ) {
                        str = new Uint8Array(str);
                      } else if (!Array.isArray(str)) {
                        if (!ARRAY_BUFFER || !ArrayBuffer.isView(str)) {
                          throw new Error(INPUT_ERROR);
                        }
                      }
                    } else {
                      throw new Error(INPUT_ERROR);
                    }
                    notString = true;
                  }
                  var bytes = 0,
                    length = str.length;
                  if (notString) {
                    bytes = length;
                  } else {
                    for (var i = 0; i < str.length; ++i) {
                      var code = str.charCodeAt(i);
                      if (code < 0x80) {
                        bytes += 1;
                      } else if (code < 0x800) {
                        bytes += 2;
                      } else if (code < 0xd800 || code >= 0xe000) {
                        bytes += 3;
                      } else {
                        code =
                          0x10000 +
                          (((code & 0x3ff) << 10) |
                            (str.charCodeAt(++i) & 0x3ff));
                        bytes += 4;
                      }
                    }
                  }
                  bytes += this.encode(bytes * 8);
                  this.update(str);
                  return bytes;
                };

                Keccak.prototype.bytepad = function (strs, w) {
                  var bytes = this.encode(w);
                  for (var i = 0; i < strs.length; ++i) {
                    bytes += this.encodeString(strs[i]);
                  }
                  var paddingBytes = w - (bytes % w);
                  var zeros = [];
                  zeros.length = paddingBytes;
                  this.update(zeros);
                  return this;
                };

                Keccak.prototype.finalize = function () {
                  if (this.finalized) {
                    return;
                  }
                  this.finalized = true;
                  var blocks = this.blocks,
                    i = this.lastByteIndex,
                    blockCount = this.blockCount,
                    s = this.s;
                  blocks[i >> 2] |= this.padding[i & 3];
                  if (this.lastByteIndex === this.byteCount) {
                    blocks[0] = blocks[blockCount];
                    for (i = 1; i < blockCount + 1; ++i) {
                      blocks[i] = 0;
                    }
                  }
                  blocks[blockCount - 1] |= 0x80000000;
                  for (i = 0; i < blockCount; ++i) {
                    s[i] ^= blocks[i];
                  }
                  f(s);
                };

                Keccak.prototype.toString = Keccak.prototype.hex = function () {
                  this.finalize();

                  var blockCount = this.blockCount,
                    s = this.s,
                    outputBlocks = this.outputBlocks,
                    extraBytes = this.extraBytes,
                    i = 0,
                    j = 0;
                  var hex = "",
                    block;
                  while (j < outputBlocks) {
                    for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
                      block = s[i];
                      hex +=
                        HEX_CHARS[(block >> 4) & 0x0f] +
                        HEX_CHARS[block & 0x0f] +
                        HEX_CHARS[(block >> 12) & 0x0f] +
                        HEX_CHARS[(block >> 8) & 0x0f] +
                        HEX_CHARS[(block >> 20) & 0x0f] +
                        HEX_CHARS[(block >> 16) & 0x0f] +
                        HEX_CHARS[(block >> 28) & 0x0f] +
                        HEX_CHARS[(block >> 24) & 0x0f];
                    }
                    if (j % blockCount === 0) {
                      f(s);
                      i = 0;
                    }
                  }
                  if (extraBytes) {
                    block = s[i];
                    hex +=
                      HEX_CHARS[(block >> 4) & 0x0f] + HEX_CHARS[block & 0x0f];
                    if (extraBytes > 1) {
                      hex +=
                        HEX_CHARS[(block >> 12) & 0x0f] +
                        HEX_CHARS[(block >> 8) & 0x0f];
                    }
                    if (extraBytes > 2) {
                      hex +=
                        HEX_CHARS[(block >> 20) & 0x0f] +
                        HEX_CHARS[(block >> 16) & 0x0f];
                    }
                  }
                  return hex;
                };

                Keccak.prototype.arrayBuffer = function () {
                  this.finalize();

                  var blockCount = this.blockCount,
                    s = this.s,
                    outputBlocks = this.outputBlocks,
                    extraBytes = this.extraBytes,
                    i = 0,
                    j = 0;
                  var bytes = this.outputBits >> 3;
                  var buffer;
                  if (extraBytes) {
                    buffer = new ArrayBuffer((outputBlocks + 1) << 2);
                  } else {
                    buffer = new ArrayBuffer(bytes);
                  }
                  var array = new Uint32Array(buffer);
                  while (j < outputBlocks) {
                    for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
                      array[j] = s[i];
                    }
                    if (j % blockCount === 0) {
                      f(s);
                    }
                  }
                  if (extraBytes) {
                    array[i] = s[i];
                    buffer = buffer.slice(0, bytes);
                  }
                  return buffer;
                };

                Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;

                Keccak.prototype.digest = Keccak.prototype.array = function () {
                  this.finalize();

                  var blockCount = this.blockCount,
                    s = this.s,
                    outputBlocks = this.outputBlocks,
                    extraBytes = this.extraBytes,
                    i = 0,
                    j = 0;
                  var array = [],
                    offset,
                    block;
                  while (j < outputBlocks) {
                    for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
                      offset = j << 2;
                      block = s[i];
                      array[offset] = block & 0xff;
                      array[offset + 1] = (block >> 8) & 0xff;
                      array[offset + 2] = (block >> 16) & 0xff;
                      array[offset + 3] = (block >> 24) & 0xff;
                    }
                    if (j % blockCount === 0) {
                      f(s);
                    }
                  }
                  if (extraBytes) {
                    offset = j << 2;
                    block = s[i];
                    array[offset] = block & 0xff;
                    if (extraBytes > 1) {
                      array[offset + 1] = (block >> 8) & 0xff;
                    }
                    if (extraBytes > 2) {
                      array[offset + 2] = (block >> 16) & 0xff;
                    }
                  }
                  return array;
                };

                function Kmac(bits, padding, outputBits) {
                  Keccak.call(this, bits, padding, outputBits);
                }

                Kmac.prototype = new Keccak();

                Kmac.prototype.finalize = function () {
                  this.encode(this.outputBits, true);
                  return Keccak.prototype.finalize.call(this);
                };

                var f = function (s) {
                  var h,
                    l,
                    n,
                    c0,
                    c1,
                    c2,
                    c3,
                    c4,
                    c5,
                    c6,
                    c7,
                    c8,
                    c9,
                    b0,
                    b1,
                    b2,
                    b3,
                    b4,
                    b5,
                    b6,
                    b7,
                    b8,
                    b9,
                    b10,
                    b11,
                    b12,
                    b13,
                    b14,
                    b15,
                    b16,
                    b17,
                    b18,
                    b19,
                    b20,
                    b21,
                    b22,
                    b23,
                    b24,
                    b25,
                    b26,
                    b27,
                    b28,
                    b29,
                    b30,
                    b31,
                    b32,
                    b33,
                    b34,
                    b35,
                    b36,
                    b37,
                    b38,
                    b39,
                    b40,
                    b41,
                    b42,
                    b43,
                    b44,
                    b45,
                    b46,
                    b47,
                    b48,
                    b49;
                  for (n = 0; n < 48; n += 2) {
                    c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
                    c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
                    c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
                    c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
                    c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
                    c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
                    c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
                    c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
                    c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
                    c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

                    h = c8 ^ ((c2 << 1) | (c3 >>> 31));
                    l = c9 ^ ((c3 << 1) | (c2 >>> 31));
                    s[0] ^= h;
                    s[1] ^= l;
                    s[10] ^= h;
                    s[11] ^= l;
                    s[20] ^= h;
                    s[21] ^= l;
                    s[30] ^= h;
                    s[31] ^= l;
                    s[40] ^= h;
                    s[41] ^= l;
                    h = c0 ^ ((c4 << 1) | (c5 >>> 31));
                    l = c1 ^ ((c5 << 1) | (c4 >>> 31));
                    s[2] ^= h;
                    s[3] ^= l;
                    s[12] ^= h;
                    s[13] ^= l;
                    s[22] ^= h;
                    s[23] ^= l;
                    s[32] ^= h;
                    s[33] ^= l;
                    s[42] ^= h;
                    s[43] ^= l;
                    h = c2 ^ ((c6 << 1) | (c7 >>> 31));
                    l = c3 ^ ((c7 << 1) | (c6 >>> 31));
                    s[4] ^= h;
                    s[5] ^= l;
                    s[14] ^= h;
                    s[15] ^= l;
                    s[24] ^= h;
                    s[25] ^= l;
                    s[34] ^= h;
                    s[35] ^= l;
                    s[44] ^= h;
                    s[45] ^= l;
                    h = c4 ^ ((c8 << 1) | (c9 >>> 31));
                    l = c5 ^ ((c9 << 1) | (c8 >>> 31));
                    s[6] ^= h;
                    s[7] ^= l;
                    s[16] ^= h;
                    s[17] ^= l;
                    s[26] ^= h;
                    s[27] ^= l;
                    s[36] ^= h;
                    s[37] ^= l;
                    s[46] ^= h;
                    s[47] ^= l;
                    h = c6 ^ ((c0 << 1) | (c1 >>> 31));
                    l = c7 ^ ((c1 << 1) | (c0 >>> 31));
                    s[8] ^= h;
                    s[9] ^= l;
                    s[18] ^= h;
                    s[19] ^= l;
                    s[28] ^= h;
                    s[29] ^= l;
                    s[38] ^= h;
                    s[39] ^= l;
                    s[48] ^= h;
                    s[49] ^= l;

                    b0 = s[0];
                    b1 = s[1];
                    b32 = (s[11] << 4) | (s[10] >>> 28);
                    b33 = (s[10] << 4) | (s[11] >>> 28);
                    b14 = (s[20] << 3) | (s[21] >>> 29);
                    b15 = (s[21] << 3) | (s[20] >>> 29);
                    b46 = (s[31] << 9) | (s[30] >>> 23);
                    b47 = (s[30] << 9) | (s[31] >>> 23);
                    b28 = (s[40] << 18) | (s[41] >>> 14);
                    b29 = (s[41] << 18) | (s[40] >>> 14);
                    b20 = (s[2] << 1) | (s[3] >>> 31);
                    b21 = (s[3] << 1) | (s[2] >>> 31);
                    b2 = (s[13] << 12) | (s[12] >>> 20);
                    b3 = (s[12] << 12) | (s[13] >>> 20);
                    b34 = (s[22] << 10) | (s[23] >>> 22);
                    b35 = (s[23] << 10) | (s[22] >>> 22);
                    b16 = (s[33] << 13) | (s[32] >>> 19);
                    b17 = (s[32] << 13) | (s[33] >>> 19);
                    b48 = (s[42] << 2) | (s[43] >>> 30);
                    b49 = (s[43] << 2) | (s[42] >>> 30);
                    b40 = (s[5] << 30) | (s[4] >>> 2);
                    b41 = (s[4] << 30) | (s[5] >>> 2);
                    b22 = (s[14] << 6) | (s[15] >>> 26);
                    b23 = (s[15] << 6) | (s[14] >>> 26);
                    b4 = (s[25] << 11) | (s[24] >>> 21);
                    b5 = (s[24] << 11) | (s[25] >>> 21);
                    b36 = (s[34] << 15) | (s[35] >>> 17);
                    b37 = (s[35] << 15) | (s[34] >>> 17);
                    b18 = (s[45] << 29) | (s[44] >>> 3);
                    b19 = (s[44] << 29) | (s[45] >>> 3);
                    b10 = (s[6] << 28) | (s[7] >>> 4);
                    b11 = (s[7] << 28) | (s[6] >>> 4);
                    b42 = (s[17] << 23) | (s[16] >>> 9);
                    b43 = (s[16] << 23) | (s[17] >>> 9);
                    b24 = (s[26] << 25) | (s[27] >>> 7);
                    b25 = (s[27] << 25) | (s[26] >>> 7);
                    b6 = (s[36] << 21) | (s[37] >>> 11);
                    b7 = (s[37] << 21) | (s[36] >>> 11);
                    b38 = (s[47] << 24) | (s[46] >>> 8);
                    b39 = (s[46] << 24) | (s[47] >>> 8);
                    b30 = (s[8] << 27) | (s[9] >>> 5);
                    b31 = (s[9] << 27) | (s[8] >>> 5);
                    b12 = (s[18] << 20) | (s[19] >>> 12);
                    b13 = (s[19] << 20) | (s[18] >>> 12);
                    b44 = (s[29] << 7) | (s[28] >>> 25);
                    b45 = (s[28] << 7) | (s[29] >>> 25);
                    b26 = (s[38] << 8) | (s[39] >>> 24);
                    b27 = (s[39] << 8) | (s[38] >>> 24);
                    b8 = (s[48] << 14) | (s[49] >>> 18);
                    b9 = (s[49] << 14) | (s[48] >>> 18);

                    s[0] = b0 ^ (~b2 & b4);
                    s[1] = b1 ^ (~b3 & b5);
                    s[10] = b10 ^ (~b12 & b14);
                    s[11] = b11 ^ (~b13 & b15);
                    s[20] = b20 ^ (~b22 & b24);
                    s[21] = b21 ^ (~b23 & b25);
                    s[30] = b30 ^ (~b32 & b34);
                    s[31] = b31 ^ (~b33 & b35);
                    s[40] = b40 ^ (~b42 & b44);
                    s[41] = b41 ^ (~b43 & b45);
                    s[2] = b2 ^ (~b4 & b6);
                    s[3] = b3 ^ (~b5 & b7);
                    s[12] = b12 ^ (~b14 & b16);
                    s[13] = b13 ^ (~b15 & b17);
                    s[22] = b22 ^ (~b24 & b26);
                    s[23] = b23 ^ (~b25 & b27);
                    s[32] = b32 ^ (~b34 & b36);
                    s[33] = b33 ^ (~b35 & b37);
                    s[42] = b42 ^ (~b44 & b46);
                    s[43] = b43 ^ (~b45 & b47);
                    s[4] = b4 ^ (~b6 & b8);
                    s[5] = b5 ^ (~b7 & b9);
                    s[14] = b14 ^ (~b16 & b18);
                    s[15] = b15 ^ (~b17 & b19);
                    s[24] = b24 ^ (~b26 & b28);
                    s[25] = b25 ^ (~b27 & b29);
                    s[34] = b34 ^ (~b36 & b38);
                    s[35] = b35 ^ (~b37 & b39);
                    s[44] = b44 ^ (~b46 & b48);
                    s[45] = b45 ^ (~b47 & b49);
                    s[6] = b6 ^ (~b8 & b0);
                    s[7] = b7 ^ (~b9 & b1);
                    s[16] = b16 ^ (~b18 & b10);
                    s[17] = b17 ^ (~b19 & b11);
                    s[26] = b26 ^ (~b28 & b20);
                    s[27] = b27 ^ (~b29 & b21);
                    s[36] = b36 ^ (~b38 & b30);
                    s[37] = b37 ^ (~b39 & b31);
                    s[46] = b46 ^ (~b48 & b40);
                    s[47] = b47 ^ (~b49 & b41);
                    s[8] = b8 ^ (~b0 & b2);
                    s[9] = b9 ^ (~b1 & b3);
                    s[18] = b18 ^ (~b10 & b12);
                    s[19] = b19 ^ (~b11 & b13);
                    s[28] = b28 ^ (~b20 & b22);
                    s[29] = b29 ^ (~b21 & b23);
                    s[38] = b38 ^ (~b30 & b32);
                    s[39] = b39 ^ (~b31 & b33);
                    s[48] = b48 ^ (~b40 & b42);
                    s[49] = b49 ^ (~b41 & b43);

                    s[0] ^= RC[n];
                    s[1] ^= RC[n + 1];
                  }
                };

                if (COMMON_JS) {
                  module.exports = methods;
                } else {
                  for (i = 0; i < methodNames.length; ++i) {
                    root[methodNames[i]] = methods[methodNames[i]];
                  }
                  if (AMD) {
                    define(function () {
                      return methods;
                    });
                  }
                }
              })();
            }.call(this));
          }.call(
            this,
            require("_process"),
            typeof global !== "undefined"
              ? global
              : typeof self !== "undefined"
              ? self
              : typeof window !== "undefined"
              ? window
              : {}
          ));
        },
        { _process: 166 },
      ],
      74: [
        function (require, module, exports) {
          "use strict";
          const isOptionObject = require("is-plain-obj");

          const { hasOwnProperty } = Object.prototype;
          const { propertyIsEnumerable } = Object;
          const defineProperty = (object, name, value) =>
            Object.defineProperty(object, name, {
              value,
              writable: true,
              enumerable: true,
              configurable: true,
            });

          const globalThis = this;
          const defaultMergeOptions = {
            concatArrays: false,
            ignoreUndefined: false,
          };

          const getEnumerableOwnPropertyKeys = (value) => {
            const keys = [];

            for (const key in value) {
              if (hasOwnProperty.call(value, key)) {
                keys.push(key);
              }
            }

            /* istanbul ignore else  */
            if (Object.getOwnPropertySymbols) {
              const symbols = Object.getOwnPropertySymbols(value);

              for (const symbol of symbols) {
                if (propertyIsEnumerable.call(value, symbol)) {
                  keys.push(symbol);
                }
              }
            }

            return keys;
          };

          function clone(value) {
            if (Array.isArray(value)) {
              return cloneArray(value);
            }

            if (isOptionObject(value)) {
              return cloneOptionObject(value);
            }

            return value;
          }

          function cloneArray(array) {
            const result = array.slice(0, 0);

            getEnumerableOwnPropertyKeys(array).forEach((key) => {
              defineProperty(result, key, clone(array[key]));
            });

            return result;
          }

          function cloneOptionObject(object) {
            const result =
              Object.getPrototypeOf(object) === null ? Object.create(null) : {};

            getEnumerableOwnPropertyKeys(object).forEach((key) => {
              defineProperty(result, key, clone(object[key]));
            });

            return result;
          }

          /**
           * @param {*} merged already cloned
           * @param {*} source something to merge
           * @param {string[]} keys keys to merge
           * @param {Object} config Config Object
           * @returns {*} cloned Object
           */
          const mergeKeys = (merged, source, keys, config) => {
            keys.forEach((key) => {
              if (
                typeof source[key] === "undefined" &&
                config.ignoreUndefined
              ) {
                return;
              }

              // Do not recurse into prototype chain of merged
              if (
                key in merged &&
                merged[key] !== Object.getPrototypeOf(merged)
              ) {
                defineProperty(
                  merged,
                  key,
                  merge(merged[key], source[key], config)
                );
              } else {
                defineProperty(merged, key, clone(source[key]));
              }
            });

            return merged;
          };

          /**
           * @param {*} merged already cloned
           * @param {*} source something to merge
           * @param {Object} config Config Object
           * @returns {*} cloned Object
           *
           * see [Array.prototype.concat ( ...arguments )](http://www.ecma-international.org/ecma-262/6.0/#sec-array.prototype.concat)
           */
          const concatArrays = (merged, source, config) => {
            let result = merged.slice(0, 0);
            let resultIndex = 0;

            [merged, source].forEach((array) => {
              const indices = [];

              // `result.concat(array)` with cloning
              for (let k = 0; k < array.length; k++) {
                if (!hasOwnProperty.call(array, k)) {
                  continue;
                }

                indices.push(String(k));

                if (array === merged) {
                  // Already cloned
                  defineProperty(result, resultIndex++, array[k]);
                } else {
                  defineProperty(result, resultIndex++, clone(array[k]));
                }
              }

              // Merge non-index keys
              result = mergeKeys(
                result,
                array,
                getEnumerableOwnPropertyKeys(array).filter(
                  (key) => !indices.includes(key)
                ),
                config
              );
            });

            return result;
          };

          /**
           * @param {*} merged already cloned
           * @param {*} source something to merge
           * @param {Object} config Config Object
           * @returns {*} cloned Object
           */
          function merge(merged, source, config) {
            if (
              config.concatArrays &&
              Array.isArray(merged) &&
              Array.isArray(source)
            ) {
              return concatArrays(merged, source, config);
            }

            if (!isOptionObject(source) || !isOptionObject(merged)) {
              return clone(source);
            }

            return mergeKeys(
              merged,
              source,
              getEnumerableOwnPropertyKeys(source),
              config
            );
          }

          module.exports = function (...options) {
            const config = merge(
              clone(defaultMergeOptions),
              (this !== globalThis && this) || {},
              defaultMergeOptions
            );
            let merged = { _: {} };

            for (const option of options) {
              if (option === undefined) {
                continue;
              }

              if (!isOptionObject(option)) {
                throw new TypeError("`" + option + "` is not an Option Object");
              }

              merged = merge(merged, { _: option }, config);
            }

            return merged._;
          };
        },
        { "is-plain-obj": 69 },
      ],
      75: [
        function (require, module, exports) {
          "use strict";

          const { encodeText } = require("./util");

          /** @typedef {import('./types').CodecFactory} CodecFactory */
          /** @typedef {import("./types").BaseName} BaseName */
          /** @typedef {import("./types").BaseCode} BaseCode */

          /**
           * Class to encode/decode in the supported Bases
           *
           */
          class Base {
            /**
             * @param {BaseName} name
             * @param {BaseCode} code
             * @param {CodecFactory} factory
             * @param {string} alphabet
             */
            constructor(name, code, factory, alphabet) {
              this.name = name;
              this.code = code;
              this.codeBuf = encodeText(this.code);
              this.alphabet = alphabet;
              this.codec = factory(alphabet);
            }

            /**
             * @param {Uint8Array} buf
             * @returns {string}
             */
            encode(buf) {
              return this.codec.encode(buf);
            }

            /**
             * @param {string} string
             * @returns {Uint8Array}
             */
            decode(string) {
              for (const char of string) {
                if (this.alphabet && this.alphabet.indexOf(char) < 0) {
                  throw new Error(`invalid character '${char}' in '${string}'`);
                }
              }
              return this.codec.decode(string);
            }
          }

          module.exports = Base;
        },
        { "./util": 79 },
      ],
      76: [
        function (require, module, exports) {
          "use strict";

          const baseX = require("@multiformats/base-x");
          const Base = require("./base.js");
          const { rfc4648 } = require("./rfc4648");
          const { decodeText, encodeText } = require("./util");

          /** @typedef {import('./types').CodecFactory} CodecFactory */
          /** @typedef {import('./types').Codec} Codec */
          /** @typedef {import('./types').BaseName} BaseName */
          /** @typedef {import('./types').BaseCode} BaseCode */

          /** @type {CodecFactory} */
          const identity = () => {
            return {
              encode: decodeText,
              decode: encodeText,
            };
          };

          /**
           *
           * name, code, implementation, alphabet
           *
           * @type {Array<[BaseName, BaseCode, CodecFactory, string]>}
           */
          const constants = [
            ["identity", "\x00", identity, ""],
            ["base2", "0", rfc4648(1), "01"],
            ["base8", "7", rfc4648(3), "01234567"],
            ["base10", "9", baseX, "0123456789"],
            ["base16", "f", rfc4648(4), "0123456789abcdef"],
            ["base16upper", "F", rfc4648(4), "0123456789ABCDEF"],
            ["base32hex", "v", rfc4648(5), "0123456789abcdefghijklmnopqrstuv"],
            [
              "base32hexupper",
              "V",
              rfc4648(5),
              "0123456789ABCDEFGHIJKLMNOPQRSTUV",
            ],
            [
              "base32hexpad",
              "t",
              rfc4648(5),
              "0123456789abcdefghijklmnopqrstuv=",
            ],
            [
              "base32hexpadupper",
              "T",
              rfc4648(5),
              "0123456789ABCDEFGHIJKLMNOPQRSTUV=",
            ],
            ["base32", "b", rfc4648(5), "abcdefghijklmnopqrstuvwxyz234567"],
            [
              "base32upper",
              "B",
              rfc4648(5),
              "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
            ],
            ["base32pad", "c", rfc4648(5), "abcdefghijklmnopqrstuvwxyz234567="],
            [
              "base32padupper",
              "C",
              rfc4648(5),
              "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=",
            ],
            ["base32z", "h", rfc4648(5), "ybndrfg8ejkmcpqxot1uwisza345h769"],
            ["base36", "k", baseX, "0123456789abcdefghijklmnopqrstuvwxyz"],
            ["base36upper", "K", baseX, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"],
            [
              "base58btc",
              "z",
              baseX,
              "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
            ],
            [
              "base58flickr",
              "Z",
              baseX,
              "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
            ],
            [
              "base64",
              "m",
              rfc4648(6),
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
            ],
            [
              "base64pad",
              "M",
              rfc4648(6),
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
            ],
            [
              "base64url",
              "u",
              rfc4648(6),
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
            ],
            [
              "base64urlpad",
              "U",
              rfc4648(6),
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=",
            ],
          ];

          /** @type {Record<BaseName,Base>} */
          const names = constants.reduce((prev, tupple) => {
            prev[tupple[0]] = new Base(
              tupple[0],
              tupple[1],
              tupple[2],
              tupple[3]
            );
            return prev;
          }, /** @type {Record<BaseName,Base>} */ ({}));

          /** @type {Record<BaseCode,Base>} */
          const codes = constants.reduce((prev, tupple) => {
            prev[tupple[1]] = names[tupple[0]];
            return prev;
          }, /** @type {Record<BaseCode,Base>} */ ({}));

          module.exports = {
            names,
            codes,
          };
        },
        {
          "./base.js": 75,
          "./rfc4648": 78,
          "./util": 79,
          "@multiformats/base-x": 3,
        },
      ],
      77: [
        function (require, module, exports) {
          /**
           * Implementation of the [multibase](https://github.com/multiformats/multibase) specification.
           *
           */
          "use strict";

          const constants = require("./constants");
          const { encodeText, decodeText, concat } = require("./util");

          /** @typedef {import('./base')} Base */
          /** @typedef {import("./types").BaseNameOrCode} BaseNameOrCode */
          /** @typedef {import("./types").BaseCode} BaseCode */
          /** @typedef {import("./types").BaseName} BaseName */

          /**
           * Create a new Uint8Array with the multibase varint+code.
           *
           * @param {BaseNameOrCode} nameOrCode - The multibase name or code number.
           * @param {Uint8Array} buf - The data to be prefixed with multibase.
           * @returns {Uint8Array}
           * @throws {Error} Will throw if the encoding is not supported
           */
          function multibase(nameOrCode, buf) {
            if (!buf) {
              throw new Error("requires an encoded Uint8Array");
            }
            const { name, codeBuf } = encoding(nameOrCode);
            validEncode(name, buf);

            return concat([codeBuf, buf], codeBuf.length + buf.length);
          }

          /**
           * Encode data with the specified base and add the multibase prefix.
           *
           * @param {BaseNameOrCode} nameOrCode - The multibase name or code number.
           * @param {Uint8Array} buf - The data to be encoded.
           * @returns {Uint8Array}
           * @throws {Error} Will throw if the encoding is not supported
           *
           */
          function encode(nameOrCode, buf) {
            const enc = encoding(nameOrCode);
            const data = encodeText(enc.encode(buf));

            return concat(
              [enc.codeBuf, data],
              enc.codeBuf.length + data.length
            );
          }

          /**
           * Takes a Uint8Array or string encoded with multibase header, decodes it and
           * returns the decoded buffer
           *
           * @param {Uint8Array|string} data
           * @returns {Uint8Array}
           * @throws {Error} Will throw if the encoding is not supported
           *
           */
          function decode(data) {
            if (data instanceof Uint8Array) {
              data = decodeText(data);
            }
            const prefix = data[0];

            // Make all encodings case-insensitive except the ones that include upper and lower chars in the alphabet
            if (
              [
                "f",
                "F",
                "v",
                "V",
                "t",
                "T",
                "b",
                "B",
                "c",
                "C",
                "h",
                "k",
                "K",
              ].includes(prefix)
            ) {
              data = data.toLowerCase();
            }
            const enc = encoding(/** @type {BaseCode} */ (data[0]));
            return enc.decode(data.substring(1));
          }

          /**
           * Is the given data multibase encoded?
           *
           * @param {Uint8Array|string} data
           */
          function isEncoded(data) {
            if (data instanceof Uint8Array) {
              data = decodeText(data);
            }

            // Ensure bufOrString is a string
            if (Object.prototype.toString.call(data) !== "[object String]") {
              return false;
            }

            try {
              const enc = encoding(/** @type {BaseCode} */ (data[0]));
              return enc.name;
            } catch (err) {
              return false;
            }
          }

          /**
           * Validate encoded data
           *
           * @param {BaseNameOrCode} name
           * @param {Uint8Array} buf
           * @returns {void}
           * @throws {Error} Will throw if the encoding is not supported
           */
          function validEncode(name, buf) {
            const enc = encoding(name);
            enc.decode(decodeText(buf));
          }

          /**
           * Get the encoding by name or code
           *
           * @param {BaseNameOrCode} nameOrCode
           * @returns {Base}
           * @throws {Error} Will throw if the encoding is not supported
           */
          function encoding(nameOrCode) {
            if (
              Object.prototype.hasOwnProperty.call(
                constants.names,
                /** @type {BaseName} */ (nameOrCode)
              )
            ) {
              return constants.names[/** @type {BaseName} */ (nameOrCode)];
            } else if (
              Object.prototype.hasOwnProperty.call(
                constants.codes,
                /** @type {BaseCode} */ (nameOrCode)
              )
            ) {
              return constants.codes[/** @type {BaseCode} */ (nameOrCode)];
            } else {
              throw new Error(`Unsupported encoding: ${nameOrCode}`);
            }
          }

          /**
           * Get encoding from data
           *
           * @param {string|Uint8Array} data
           * @returns {Base}
           * @throws {Error} Will throw if the encoding is not supported
           */
          function encodingFromData(data) {
            if (data instanceof Uint8Array) {
              data = decodeText(data);
            }

            return encoding(/** @type {BaseCode} */ (data[0]));
          }

          exports = module.exports = multibase;
          exports.encode = encode;
          exports.decode = decode;
          exports.isEncoded = isEncoded;
          exports.encoding = encoding;
          exports.encodingFromData = encodingFromData;
          const names = Object.freeze(constants.names);
          const codes = Object.freeze(constants.codes);
          exports.names = names;
          exports.codes = codes;
        },
        { "./constants": 76, "./util": 79 },
      ],
      78: [
        function (require, module, exports) {
          "use strict";

          /** @typedef {import('./types').CodecFactory} CodecFactory */

          /**
           * @param {string} string
           * @param {string} alphabet
           * @param {number} bitsPerChar
           * @returns {Uint8Array}
           */
          const decode = (string, alphabet, bitsPerChar) => {
            // Build the character lookup table:
            /** @type {Record<string, number>} */
            const codes = {};
            for (let i = 0; i < alphabet.length; ++i) {
              codes[alphabet[i]] = i;
            }

            // Count the padding bytes:
            let end = string.length;
            while (string[end - 1] === "=") {
              --end;
            }

            // Allocate the output:
            const out = new Uint8Array(((end * bitsPerChar) / 8) | 0);

            // Parse the data:
            let bits = 0; // Number of bits currently in the buffer
            let buffer = 0; // Bits waiting to be written out, MSB first
            let written = 0; // Next byte to write
            for (let i = 0; i < end; ++i) {
              // Read one character from the string:
              const value = codes[string[i]];
              if (value === undefined) {
                throw new SyntaxError("Invalid character " + string[i]);
              }

              // Append the bits to the buffer:
              buffer = (buffer << bitsPerChar) | value;
              bits += bitsPerChar;

              // Write out some bits if the buffer has a byte's worth:
              if (bits >= 8) {
                bits -= 8;
                out[written++] = 0xff & (buffer >> bits);
              }
            }

            // Verify that we have received just enough bits:
            if (bits >= bitsPerChar || 0xff & (buffer << (8 - bits))) {
              throw new SyntaxError("Unexpected end of data");
            }

            return out;
          };

          /**
           * @param {Uint8Array} data
           * @param {string} alphabet
           * @param {number} bitsPerChar
           * @returns {string}
           */
          const encode = (data, alphabet, bitsPerChar) => {
            const pad = alphabet[alphabet.length - 1] === "=";
            const mask = (1 << bitsPerChar) - 1;
            let out = "";

            let bits = 0; // Number of bits currently in the buffer
            let buffer = 0; // Bits waiting to be written out, MSB first
            for (let i = 0; i < data.length; ++i) {
              // Slurp data into the buffer:
              buffer = (buffer << 8) | data[i];
              bits += 8;

              // Write out as much as we can:
              while (bits > bitsPerChar) {
                bits -= bitsPerChar;
                out += alphabet[mask & (buffer >> bits)];
              }
            }

            // Partial character:
            if (bits) {
              out += alphabet[mask & (buffer << (bitsPerChar - bits))];
            }

            // Add padding characters until we hit a byte boundary:
            if (pad) {
              while ((out.length * bitsPerChar) & 7) {
                out += "=";
              }
            }

            return out;
          };

          /**
           * RFC4648 Factory
           *
           * @param {number} bitsPerChar
           * @returns {CodecFactory}
           */
          const rfc4648 = (bitsPerChar) => (alphabet) => {
            return {
              /**
               * @param {Uint8Array} input
               * @returns {string}
               */
              encode(input) {
                return encode(input, alphabet, bitsPerChar);
              },
              /**
               * @param {string} input
               * @returns {Uint8Array}
               */
              decode(input) {
                return decode(input, alphabet, bitsPerChar);
              },
            };
          };

          module.exports = { rfc4648 };
        },
        {},
      ],
      79: [
        function (require, module, exports) {
          "use strict";

          const textDecoder = new TextDecoder();
          /**
           * @param {ArrayBufferView|ArrayBuffer} bytes
           * @returns {string}
           */
          const decodeText = (bytes) => textDecoder.decode(bytes);

          const textEncoder = new TextEncoder();
          /**
           * @param {string} text
           * @returns {Uint8Array}
           */
          const encodeText = (text) => textEncoder.encode(text);

          /**
           * Returns a new Uint8Array created by concatenating the passed Arrays
           *
           * @param {Array<ArrayLike<number>>} arrs
           * @param {number} length
           * @returns {Uint8Array}
           */
          function concat(arrs, length) {
            const output = new Uint8Array(length);
            let offset = 0;

            for (const arr of arrs) {
              output.set(arr, offset);
              offset += arr.length;
            }

            return output;
          }

          module.exports = { decodeText, encodeText, concat };
        },
        {},
      ],
      80: [
        function (require, module, exports) {
          arguments[4][16][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 84, dup: 16 },
      ],
      81: [
        function (require, module, exports) {
          arguments[4][17][0].apply(exports, arguments);
        },
        { "./alloc.js": 80, "./util/as-uint8array.js": 84, dup: 17 },
      ],
      82: [
        function (require, module, exports) {
          arguments[4][27][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 84, "./util/bases.js": 85, dup: 27 },
      ],
      83: [
        function (require, module, exports) {
          arguments[4][19][0].apply(exports, arguments);
        },
        { "./util/bases.js": 85, dup: 19 },
      ],
      84: [
        function (require, module, exports) {
          arguments[4][20][0].apply(exports, arguments);
        },
        { dup: 20 },
      ],
      85: [
        function (require, module, exports) {
          arguments[4][21][0].apply(exports, arguments);
        },
        { "../alloc.js": 80, dup: 21, "multiformats/basics": 101 },
      ],
      86: [
        function (require, module, exports) {
          // DO NOT CHANGE THIS FILE. IT IS GENERATED BY tools/update-table.js
          /* eslint quote-props: off */
          "use strict";

          /**
           * @type {import('./generated-types').NameCodeMap}
           */
          const baseTable = Object.freeze({
            identity: 0x00,
            cidv1: 0x01,
            cidv2: 0x02,
            cidv3: 0x03,
            ip4: 0x04,
            tcp: 0x06,
            sha1: 0x11,
            "sha2-256": 0x12,
            "sha2-512": 0x13,
            "sha3-512": 0x14,
            "sha3-384": 0x15,
            "sha3-256": 0x16,
            "sha3-224": 0x17,
            "shake-128": 0x18,
            "shake-256": 0x19,
            "keccak-224": 0x1a,
            "keccak-256": 0x1b,
            "keccak-384": 0x1c,
            "keccak-512": 0x1d,
            blake3: 0x1e,
            dccp: 0x21,
            "murmur3-128": 0x22,
            "murmur3-32": 0x23,
            ip6: 0x29,
            ip6zone: 0x2a,
            path: 0x2f,
            multicodec: 0x30,
            multihash: 0x31,
            multiaddr: 0x32,
            multibase: 0x33,
            dns: 0x35,
            dns4: 0x36,
            dns6: 0x37,
            dnsaddr: 0x38,
            protobuf: 0x50,
            cbor: 0x51,
            raw: 0x55,
            "dbl-sha2-256": 0x56,
            rlp: 0x60,
            bencode: 0x63,
            "dag-pb": 0x70,
            "dag-cbor": 0x71,
            "libp2p-key": 0x72,
            "git-raw": 0x78,
            "torrent-info": 0x7b,
            "torrent-file": 0x7c,
            "leofcoin-block": 0x81,
            "leofcoin-tx": 0x82,
            "leofcoin-pr": 0x83,
            sctp: 0x84,
            "dag-jose": 0x85,
            "dag-cose": 0x86,
            "eth-block": 0x90,
            "eth-block-list": 0x91,
            "eth-tx-trie": 0x92,
            "eth-tx": 0x93,
            "eth-tx-receipt-trie": 0x94,
            "eth-tx-receipt": 0x95,
            "eth-state-trie": 0x96,
            "eth-account-snapshot": 0x97,
            "eth-storage-trie": 0x98,
            "eth-receipt-log-trie": 0x99,
            "eth-reciept-log": 0x9a,
            "bitcoin-block": 0xb0,
            "bitcoin-tx": 0xb1,
            "bitcoin-witness-commitment": 0xb2,
            "zcash-block": 0xc0,
            "zcash-tx": 0xc1,
            "caip-50": 0xca,
            streamid: 0xce,
            "stellar-block": 0xd0,
            "stellar-tx": 0xd1,
            md4: 0xd4,
            md5: 0xd5,
            bmt: 0xd6,
            "decred-block": 0xe0,
            "decred-tx": 0xe1,
            "ipld-ns": 0xe2,
            "ipfs-ns": 0xe3,
            "swarm-ns": 0xe4,
            "ipns-ns": 0xe5,
            zeronet: 0xe6,
            "secp256k1-pub": 0xe7,
            "bls12_381-g1-pub": 0xea,
            "bls12_381-g2-pub": 0xeb,
            "x25519-pub": 0xec,
            "ed25519-pub": 0xed,
            "bls12_381-g1g2-pub": 0xee,
            "dash-block": 0xf0,
            "dash-tx": 0xf1,
            "swarm-manifest": 0xfa,
            "swarm-feed": 0xfb,
            udp: 0x0111,
            "p2p-webrtc-star": 0x0113,
            "p2p-webrtc-direct": 0x0114,
            "p2p-stardust": 0x0115,
            "p2p-circuit": 0x0122,
            "dag-json": 0x0129,
            udt: 0x012d,
            utp: 0x012e,
            unix: 0x0190,
            thread: 0x0196,
            p2p: 0x01a5,
            ipfs: 0x01a5,
            https: 0x01bb,
            onion: 0x01bc,
            onion3: 0x01bd,
            garlic64: 0x01be,
            garlic32: 0x01bf,
            tls: 0x01c0,
            noise: 0x01c6,
            quic: 0x01cc,
            ws: 0x01dd,
            wss: 0x01de,
            "p2p-websocket-star": 0x01df,
            http: 0x01e0,
            "swhid-1-snp": 0x01f0,
            json: 0x0200,
            messagepack: 0x0201,
            "libp2p-peer-record": 0x0301,
            "libp2p-relay-rsvp": 0x0302,
            "car-index-sorted": 0x0400,
            "sha2-256-trunc254-padded": 0x1012,
            "ripemd-128": 0x1052,
            "ripemd-160": 0x1053,
            "ripemd-256": 0x1054,
            "ripemd-320": 0x1055,
            x11: 0x1100,
            "p256-pub": 0x1200,
            "p384-pub": 0x1201,
            "p521-pub": 0x1202,
            "ed448-pub": 0x1203,
            "x448-pub": 0x1204,
            "ed25519-priv": 0x1300,
            "secp256k1-priv": 0x1301,
            "x25519-priv": 0x1302,
            kangarootwelve: 0x1d01,
            "sm3-256": 0x534d,
            "blake2b-8": 0xb201,
            "blake2b-16": 0xb202,
            "blake2b-24": 0xb203,
            "blake2b-32": 0xb204,
            "blake2b-40": 0xb205,
            "blake2b-48": 0xb206,
            "blake2b-56": 0xb207,
            "blake2b-64": 0xb208,
            "blake2b-72": 0xb209,
            "blake2b-80": 0xb20a,
            "blake2b-88": 0xb20b,
            "blake2b-96": 0xb20c,
            "blake2b-104": 0xb20d,
            "blake2b-112": 0xb20e,
            "blake2b-120": 0xb20f,
            "blake2b-128": 0xb210,
            "blake2b-136": 0xb211,
            "blake2b-144": 0xb212,
            "blake2b-152": 0xb213,
            "blake2b-160": 0xb214,
            "blake2b-168": 0xb215,
            "blake2b-176": 0xb216,
            "blake2b-184": 0xb217,
            "blake2b-192": 0xb218,
            "blake2b-200": 0xb219,
            "blake2b-208": 0xb21a,
            "blake2b-216": 0xb21b,
            "blake2b-224": 0xb21c,
            "blake2b-232": 0xb21d,
            "blake2b-240": 0xb21e,
            "blake2b-248": 0xb21f,
            "blake2b-256": 0xb220,
            "blake2b-264": 0xb221,
            "blake2b-272": 0xb222,
            "blake2b-280": 0xb223,
            "blake2b-288": 0xb224,
            "blake2b-296": 0xb225,
            "blake2b-304": 0xb226,
            "blake2b-312": 0xb227,
            "blake2b-320": 0xb228,
            "blake2b-328": 0xb229,
            "blake2b-336": 0xb22a,
            "blake2b-344": 0xb22b,
            "blake2b-352": 0xb22c,
            "blake2b-360": 0xb22d,
            "blake2b-368": 0xb22e,
            "blake2b-376": 0xb22f,
            "blake2b-384": 0xb230,
            "blake2b-392": 0xb231,
            "blake2b-400": 0xb232,
            "blake2b-408": 0xb233,
            "blake2b-416": 0xb234,
            "blake2b-424": 0xb235,
            "blake2b-432": 0xb236,
            "blake2b-440": 0xb237,
            "blake2b-448": 0xb238,
            "blake2b-456": 0xb239,
            "blake2b-464": 0xb23a,
            "blake2b-472": 0xb23b,
            "blake2b-480": 0xb23c,
            "blake2b-488": 0xb23d,
            "blake2b-496": 0xb23e,
            "blake2b-504": 0xb23f,
            "blake2b-512": 0xb240,
            "blake2s-8": 0xb241,
            "blake2s-16": 0xb242,
            "blake2s-24": 0xb243,
            "blake2s-32": 0xb244,
            "blake2s-40": 0xb245,
            "blake2s-48": 0xb246,
            "blake2s-56": 0xb247,
            "blake2s-64": 0xb248,
            "blake2s-72": 0xb249,
            "blake2s-80": 0xb24a,
            "blake2s-88": 0xb24b,
            "blake2s-96": 0xb24c,
            "blake2s-104": 0xb24d,
            "blake2s-112": 0xb24e,
            "blake2s-120": 0xb24f,
            "blake2s-128": 0xb250,
            "blake2s-136": 0xb251,
            "blake2s-144": 0xb252,
            "blake2s-152": 0xb253,
            "blake2s-160": 0xb254,
            "blake2s-168": 0xb255,
            "blake2s-176": 0xb256,
            "blake2s-184": 0xb257,
            "blake2s-192": 0xb258,
            "blake2s-200": 0xb259,
            "blake2s-208": 0xb25a,
            "blake2s-216": 0xb25b,
            "blake2s-224": 0xb25c,
            "blake2s-232": 0xb25d,
            "blake2s-240": 0xb25e,
            "blake2s-248": 0xb25f,
            "blake2s-256": 0xb260,
            "skein256-8": 0xb301,
            "skein256-16": 0xb302,
            "skein256-24": 0xb303,
            "skein256-32": 0xb304,
            "skein256-40": 0xb305,
            "skein256-48": 0xb306,
            "skein256-56": 0xb307,
            "skein256-64": 0xb308,
            "skein256-72": 0xb309,
            "skein256-80": 0xb30a,
            "skein256-88": 0xb30b,
            "skein256-96": 0xb30c,
            "skein256-104": 0xb30d,
            "skein256-112": 0xb30e,
            "skein256-120": 0xb30f,
            "skein256-128": 0xb310,
            "skein256-136": 0xb311,
            "skein256-144": 0xb312,
            "skein256-152": 0xb313,
            "skein256-160": 0xb314,
            "skein256-168": 0xb315,
            "skein256-176": 0xb316,
            "skein256-184": 0xb317,
            "skein256-192": 0xb318,
            "skein256-200": 0xb319,
            "skein256-208": 0xb31a,
            "skein256-216": 0xb31b,
            "skein256-224": 0xb31c,
            "skein256-232": 0xb31d,
            "skein256-240": 0xb31e,
            "skein256-248": 0xb31f,
            "skein256-256": 0xb320,
            "skein512-8": 0xb321,
            "skein512-16": 0xb322,
            "skein512-24": 0xb323,
            "skein512-32": 0xb324,
            "skein512-40": 0xb325,
            "skein512-48": 0xb326,
            "skein512-56": 0xb327,
            "skein512-64": 0xb328,
            "skein512-72": 0xb329,
            "skein512-80": 0xb32a,
            "skein512-88": 0xb32b,
            "skein512-96": 0xb32c,
            "skein512-104": 0xb32d,
            "skein512-112": 0xb32e,
            "skein512-120": 0xb32f,
            "skein512-128": 0xb330,
            "skein512-136": 0xb331,
            "skein512-144": 0xb332,
            "skein512-152": 0xb333,
            "skein512-160": 0xb334,
            "skein512-168": 0xb335,
            "skein512-176": 0xb336,
            "skein512-184": 0xb337,
            "skein512-192": 0xb338,
            "skein512-200": 0xb339,
            "skein512-208": 0xb33a,
            "skein512-216": 0xb33b,
            "skein512-224": 0xb33c,
            "skein512-232": 0xb33d,
            "skein512-240": 0xb33e,
            "skein512-248": 0xb33f,
            "skein512-256": 0xb340,
            "skein512-264": 0xb341,
            "skein512-272": 0xb342,
            "skein512-280": 0xb343,
            "skein512-288": 0xb344,
            "skein512-296": 0xb345,
            "skein512-304": 0xb346,
            "skein512-312": 0xb347,
            "skein512-320": 0xb348,
            "skein512-328": 0xb349,
            "skein512-336": 0xb34a,
            "skein512-344": 0xb34b,
            "skein512-352": 0xb34c,
            "skein512-360": 0xb34d,
            "skein512-368": 0xb34e,
            "skein512-376": 0xb34f,
            "skein512-384": 0xb350,
            "skein512-392": 0xb351,
            "skein512-400": 0xb352,
            "skein512-408": 0xb353,
            "skein512-416": 0xb354,
            "skein512-424": 0xb355,
            "skein512-432": 0xb356,
            "skein512-440": 0xb357,
            "skein512-448": 0xb358,
            "skein512-456": 0xb359,
            "skein512-464": 0xb35a,
            "skein512-472": 0xb35b,
            "skein512-480": 0xb35c,
            "skein512-488": 0xb35d,
            "skein512-496": 0xb35e,
            "skein512-504": 0xb35f,
            "skein512-512": 0xb360,
            "skein1024-8": 0xb361,
            "skein1024-16": 0xb362,
            "skein1024-24": 0xb363,
            "skein1024-32": 0xb364,
            "skein1024-40": 0xb365,
            "skein1024-48": 0xb366,
            "skein1024-56": 0xb367,
            "skein1024-64": 0xb368,
            "skein1024-72": 0xb369,
            "skein1024-80": 0xb36a,
            "skein1024-88": 0xb36b,
            "skein1024-96": 0xb36c,
            "skein1024-104": 0xb36d,
            "skein1024-112": 0xb36e,
            "skein1024-120": 0xb36f,
            "skein1024-128": 0xb370,
            "skein1024-136": 0xb371,
            "skein1024-144": 0xb372,
            "skein1024-152": 0xb373,
            "skein1024-160": 0xb374,
            "skein1024-168": 0xb375,
            "skein1024-176": 0xb376,
            "skein1024-184": 0xb377,
            "skein1024-192": 0xb378,
            "skein1024-200": 0xb379,
            "skein1024-208": 0xb37a,
            "skein1024-216": 0xb37b,
            "skein1024-224": 0xb37c,
            "skein1024-232": 0xb37d,
            "skein1024-240": 0xb37e,
            "skein1024-248": 0xb37f,
            "skein1024-256": 0xb380,
            "skein1024-264": 0xb381,
            "skein1024-272": 0xb382,
            "skein1024-280": 0xb383,
            "skein1024-288": 0xb384,
            "skein1024-296": 0xb385,
            "skein1024-304": 0xb386,
            "skein1024-312": 0xb387,
            "skein1024-320": 0xb388,
            "skein1024-328": 0xb389,
            "skein1024-336": 0xb38a,
            "skein1024-344": 0xb38b,
            "skein1024-352": 0xb38c,
            "skein1024-360": 0xb38d,
            "skein1024-368": 0xb38e,
            "skein1024-376": 0xb38f,
            "skein1024-384": 0xb390,
            "skein1024-392": 0xb391,
            "skein1024-400": 0xb392,
            "skein1024-408": 0xb393,
            "skein1024-416": 0xb394,
            "skein1024-424": 0xb395,
            "skein1024-432": 0xb396,
            "skein1024-440": 0xb397,
            "skein1024-448": 0xb398,
            "skein1024-456": 0xb399,
            "skein1024-464": 0xb39a,
            "skein1024-472": 0xb39b,
            "skein1024-480": 0xb39c,
            "skein1024-488": 0xb39d,
            "skein1024-496": 0xb39e,
            "skein1024-504": 0xb39f,
            "skein1024-512": 0xb3a0,
            "skein1024-520": 0xb3a1,
            "skein1024-528": 0xb3a2,
            "skein1024-536": 0xb3a3,
            "skein1024-544": 0xb3a4,
            "skein1024-552": 0xb3a5,
            "skein1024-560": 0xb3a6,
            "skein1024-568": 0xb3a7,
            "skein1024-576": 0xb3a8,
            "skein1024-584": 0xb3a9,
            "skein1024-592": 0xb3aa,
            "skein1024-600": 0xb3ab,
            "skein1024-608": 0xb3ac,
            "skein1024-616": 0xb3ad,
            "skein1024-624": 0xb3ae,
            "skein1024-632": 0xb3af,
            "skein1024-640": 0xb3b0,
            "skein1024-648": 0xb3b1,
            "skein1024-656": 0xb3b2,
            "skein1024-664": 0xb3b3,
            "skein1024-672": 0xb3b4,
            "skein1024-680": 0xb3b5,
            "skein1024-688": 0xb3b6,
            "skein1024-696": 0xb3b7,
            "skein1024-704": 0xb3b8,
            "skein1024-712": 0xb3b9,
            "skein1024-720": 0xb3ba,
            "skein1024-728": 0xb3bb,
            "skein1024-736": 0xb3bc,
            "skein1024-744": 0xb3bd,
            "skein1024-752": 0xb3be,
            "skein1024-760": 0xb3bf,
            "skein1024-768": 0xb3c0,
            "skein1024-776": 0xb3c1,
            "skein1024-784": 0xb3c2,
            "skein1024-792": 0xb3c3,
            "skein1024-800": 0xb3c4,
            "skein1024-808": 0xb3c5,
            "skein1024-816": 0xb3c6,
            "skein1024-824": 0xb3c7,
            "skein1024-832": 0xb3c8,
            "skein1024-840": 0xb3c9,
            "skein1024-848": 0xb3ca,
            "skein1024-856": 0xb3cb,
            "skein1024-864": 0xb3cc,
            "skein1024-872": 0xb3cd,
            "skein1024-880": 0xb3ce,
            "skein1024-888": 0xb3cf,
            "skein1024-896": 0xb3d0,
            "skein1024-904": 0xb3d1,
            "skein1024-912": 0xb3d2,
            "skein1024-920": 0xb3d3,
            "skein1024-928": 0xb3d4,
            "skein1024-936": 0xb3d5,
            "skein1024-944": 0xb3d6,
            "skein1024-952": 0xb3d7,
            "skein1024-960": 0xb3d8,
            "skein1024-968": 0xb3d9,
            "skein1024-976": 0xb3da,
            "skein1024-984": 0xb3db,
            "skein1024-992": 0xb3dc,
            "skein1024-1000": 0xb3dd,
            "skein1024-1008": 0xb3de,
            "skein1024-1016": 0xb3df,
            "skein1024-1024": 0xb3e0,
            "poseidon-bls12_381-a2-fc1": 0xb401,
            "poseidon-bls12_381-a2-fc1-sc": 0xb402,
            "zeroxcert-imprint-256": 0xce11,
            "fil-commitment-unsealed": 0xf101,
            "fil-commitment-sealed": 0xf102,
            "holochain-adr-v0": 0x807124,
            "holochain-adr-v1": 0x817124,
            "holochain-key-v0": 0x947124,
            "holochain-key-v1": 0x957124,
            "holochain-sig-v0": 0xa27124,
            "holochain-sig-v1": 0xa37124,
            "skynet-ns": 0xb19910,
            "arweave-ns": 0xb29910,
          });

          module.exports = { baseTable };
        },
        {},
      ],
      87: [
        function (require, module, exports) {
          /**
           * Implementation of the multicodec specification.
           *
           * @module multicodec
           * @example
           * const multicodec = require('multicodec')
           *
           * const prefixedProtobuf = multicodec.addPrefix('protobuf', protobufBuffer)
           * // prefixedProtobuf 0x50...
           *
           */
          "use strict";

          /** @typedef {import('./generated-types').CodecName} CodecName */
          /** @typedef {import('./generated-types').CodecCode} CodecCode */

          const varint = require("varint");
          const { concat: uint8ArrayConcat } = require("uint8arrays/concat");
          const util = require("./util");
          const {
            nameToVarint,
            constantToCode,
            nameToCode,
            codeToName,
          } = require("./maps");

          /**
           * Prefix a buffer with a multicodec-packed.
           *
           * @param {CodecName|Uint8Array} multicodecStrOrCode
           * @param {Uint8Array} data
           * @returns {Uint8Array}
           */
          function addPrefix(multicodecStrOrCode, data) {
            let prefix;

            if (multicodecStrOrCode instanceof Uint8Array) {
              prefix = util.varintUint8ArrayEncode(multicodecStrOrCode);
            } else {
              if (nameToVarint[multicodecStrOrCode]) {
                prefix = nameToVarint[multicodecStrOrCode];
              } else {
                throw new Error("multicodec not recognized");
              }
            }

            return uint8ArrayConcat(
              [prefix, data],
              prefix.length + data.length
            );
          }

          /**
           * Decapsulate the multicodec-packed prefix from the data.
           *
           * @param {Uint8Array} data
           * @returns {Uint8Array}
           */
          function rmPrefix(data) {
            varint.decode(/** @type {Buffer} */ (data));
            return data.slice(varint.decode.bytes);
          }

          /**
           * Get the codec name of the prefixed data.
           *
           * @param {Uint8Array} prefixedData
           * @returns {CodecName}
           */
          function getNameFromData(prefixedData) {
            const code = /** @type {CodecCode} */ (
              varint.decode(/** @type {Buffer} */ (prefixedData))
            );
            const name = codeToName[code];
            if (name === undefined) {
              throw new Error(`Code "${code}" not found`);
            }
            return name;
          }

          /**
           * Get the codec name from a code.
           *
           * @param {CodecCode} codec
           * @returns {CodecName}
           */
          function getNameFromCode(codec) {
            return codeToName[codec];
          }

          /**
           * Get the code of the codec
           *
           * @param {CodecName} name
           * @returns {CodecCode}
           */
          function getCodeFromName(name) {
            const code = nameToCode[name];
            if (code === undefined) {
              throw new Error(`Codec "${name}" not found`);
            }
            return code;
          }

          /**
           * Get the code of the prefixed data.
           *
           * @param {Uint8Array} prefixedData
           * @returns {CodecCode}
           */
          function getCodeFromData(prefixedData) {
            return /** @type {CodecCode} */ (
              varint.decode(/** @type {Buffer} */ (prefixedData))
            );
          }

          /**
           * Get the code as varint of a codec name.
           *
           * @param {CodecName} name
           * @returns {Uint8Array}
           */
          function getVarintFromName(name) {
            const code = nameToVarint[name];
            if (code === undefined) {
              throw new Error(`Codec "${name}" not found`);
            }
            return code;
          }

          /**
           * Get the varint of a code.
           *
           * @param {CodecCode} code
           * @returns {Uint8Array}
           */
          function getVarintFromCode(code) {
            return util.varintEncode(code);
          }

          /**
           * Get the codec name of the prefixed data.
           *
           * @deprecated use getNameFromData instead.
           * @param {Uint8Array} prefixedData
           * @returns {CodecName}
           */
          function getCodec(prefixedData) {
            return getNameFromData(prefixedData);
          }

          /**
           * Get the codec name from a code.
           *
           * @deprecated use getNameFromCode instead.
           * @param {CodecCode} codec
           * @returns {CodecName}
           */
          function getName(codec) {
            return getNameFromCode(codec);
          }

          /**
           * Get the code of the codec
           *
           * @deprecated use getCodeFromName instead.
           * @param {CodecName} name
           * @returns {CodecCode}
           */
          function getNumber(name) {
            return getCodeFromName(name);
          }

          /**
           * Get the code of the prefixed data.
           *
           * @deprecated use getCodeFromData instead.
           * @param {Uint8Array} prefixedData
           * @returns {CodecCode}
           */
          function getCode(prefixedData) {
            return getCodeFromData(prefixedData);
          }

          /**
           * Get the code as varint of a codec name.
           *
           * @deprecated use getVarintFromName instead.
           * @param {CodecName} name
           * @returns {Uint8Array}
           */
          function getCodeVarint(name) {
            return getVarintFromName(name);
          }

          /**
           * Get the varint of a code.
           *
           * @deprecated use getVarintFromCode instead.
           * @param {CodecCode} code
           * @returns {Array.<number>}
           */
          function getVarint(code) {
            return Array.from(getVarintFromCode(code));
          }

          module.exports = {
            addPrefix,
            rmPrefix,
            getNameFromData,
            getNameFromCode,
            getCodeFromName,
            getCodeFromData,
            getVarintFromName,
            getVarintFromCode,
            // Deprecated
            getCodec,
            getName,
            getNumber,
            getCode,
            getCodeVarint,
            getVarint,
            // Make the constants top-level constants
            ...constantToCode,
            // Export the maps
            nameToVarint,
            nameToCode,
            codeToName,
          };
        },
        { "./maps": 88, "./util": 89, "uint8arrays/concat": 81, varint: 161 },
      ],
      88: [
        function (require, module, exports) {
          "use strict";

          /** @typedef {import('./generated-types').ConstantCodeMap} ConstantCodeMap */
          /** @typedef {import('./generated-types').NameUint8ArrayMap} NameUint8ArrayMap */
          /** @typedef {import('./generated-types').CodeNameMap} CodeNameMap */
          /** @typedef {import('./generated-types').CodecName} CodecName */
          /** @typedef {import('./generated-types').CodecConstant} CodecConstant */

          const { baseTable } = require("./generated-table");
          const varintEncode = require("./util").varintEncode;

          const nameToVarint = /** @type {NameUint8ArrayMap} */ ({});
          const constantToCode = /** @type {ConstantCodeMap} */ ({});
          const codeToName = /** @type {CodeNameMap} */ ({});

          // eslint-disable-next-line guard-for-in
          for (const name in baseTable) {
            const codecName = /** @type {CodecName} */ (name);
            const code = baseTable[codecName];
            nameToVarint[codecName] = varintEncode(code);

            const constant = /** @type {CodecConstant} */ (
              codecName.toUpperCase().replace(/-/g, "_")
            );
            constantToCode[constant] = code;

            if (!codeToName[code]) {
              codeToName[code] = codecName;
            }
          }

          Object.freeze(nameToVarint);
          Object.freeze(constantToCode);
          Object.freeze(codeToName);
          const nameToCode = Object.freeze(baseTable);
          module.exports = {
            nameToVarint,
            constantToCode,
            nameToCode,
            codeToName,
          };
        },
        { "./generated-table": 86, "./util": 89 },
      ],
      89: [
        function (require, module, exports) {
          "use strict";

          const varint = require("varint");
          const {
            toString: uint8ArrayToString,
          } = require("uint8arrays/to-string");
          const {
            fromString: uint8ArrayFromString,
          } = require("uint8arrays/from-string");

          module.exports = {
            numberToUint8Array,
            uint8ArrayToNumber,
            varintUint8ArrayEncode,
            varintEncode,
          };

          /**
           * @param {Uint8Array} buf
           */
          function uint8ArrayToNumber(buf) {
            return parseInt(uint8ArrayToString(buf, "base16"), 16);
          }

          /**
           * @param {number} num
           */
          function numberToUint8Array(num) {
            let hexString = num.toString(16);
            if (hexString.length % 2 === 1) {
              hexString = "0" + hexString;
            }
            return uint8ArrayFromString(hexString, "base16");
          }

          /**
           * @param {Uint8Array} input
           */
          function varintUint8ArrayEncode(input) {
            return Uint8Array.from(varint.encode(uint8ArrayToNumber(input)));
          }

          /**
           * @param {number} num
           */
          function varintEncode(num) {
            return Uint8Array.from(varint.encode(num));
          }
        },
        {
          "uint8arrays/from-string": 82,
          "uint8arrays/to-string": 83,
          varint: 161,
        },
      ],
      90: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var baseX$1 = require("../../vendor/base-x.js");
          var bytes = require("../bytes.js");

          class Encoder {
            constructor(name, prefix, baseEncode) {
              this.name = name;
              this.prefix = prefix;
              this.baseEncode = baseEncode;
            }
            encode(bytes) {
              if (bytes instanceof Uint8Array) {
                return `${this.prefix}${this.baseEncode(bytes)}`;
              } else {
                throw Error("Unknown type, must be binary type");
              }
            }
          }
          class Decoder {
            constructor(name, prefix, baseDecode) {
              this.name = name;
              this.prefix = prefix;
              if (prefix.codePointAt(0) === undefined) {
                throw new Error("Invalid prefix character");
              }
              this.prefixCodePoint = prefix.codePointAt(0);
              this.baseDecode = baseDecode;
            }
            decode(text) {
              if (typeof text === "string") {
                if (text.codePointAt(0) !== this.prefixCodePoint) {
                  throw Error(
                    `Unable to decode multibase string ${JSON.stringify(
                      text
                    )}, ${
                      this.name
                    } decoder only supports inputs prefixed with ${this.prefix}`
                  );
                }
                return this.baseDecode(text.slice(this.prefix.length));
              } else {
                throw Error("Can only multibase decode strings");
              }
            }
            or(decoder) {
              return or(this, decoder);
            }
          }
          class ComposedDecoder {
            constructor(decoders) {
              this.decoders = decoders;
            }
            or(decoder) {
              return or(this, decoder);
            }
            decode(input) {
              const prefix = input[0];
              const decoder = this.decoders[prefix];
              if (decoder) {
                return decoder.decode(input);
              } else {
                throw RangeError(
                  `Unable to decode multibase string ${JSON.stringify(
                    input
                  )}, only inputs prefixed with ${Object.keys(
                    this.decoders
                  )} are supported`
                );
              }
            }
          }
          const or = (left, right) =>
            new ComposedDecoder({
              ...(left.decoders || { [left.prefix]: left }),
              ...(right.decoders || { [right.prefix]: right }),
            });
          class Codec {
            constructor(name, prefix, baseEncode, baseDecode) {
              this.name = name;
              this.prefix = prefix;
              this.baseEncode = baseEncode;
              this.baseDecode = baseDecode;
              this.encoder = new Encoder(name, prefix, baseEncode);
              this.decoder = new Decoder(name, prefix, baseDecode);
            }
            encode(input) {
              return this.encoder.encode(input);
            }
            decode(input) {
              return this.decoder.decode(input);
            }
          }
          const from = ({ name, prefix, encode, decode }) =>
            new Codec(name, prefix, encode, decode);
          const baseX = ({ prefix, name, alphabet }) => {
            const { encode, decode } = baseX$1(alphabet, name);
            return from({
              prefix,
              name,
              encode,
              decode: (text) => bytes.coerce(decode(text)),
            });
          };
          const decode = (string, alphabet, bitsPerChar, name) => {
            const codes = {};
            for (let i = 0; i < alphabet.length; ++i) {
              codes[alphabet[i]] = i;
            }
            let end = string.length;
            while (string[end - 1] === "=") {
              --end;
            }
            const out = new Uint8Array(((end * bitsPerChar) / 8) | 0);
            let bits = 0;
            let buffer = 0;
            let written = 0;
            for (let i = 0; i < end; ++i) {
              const value = codes[string[i]];
              if (value === undefined) {
                throw new SyntaxError(`Non-${name} character`);
              }
              buffer = (buffer << bitsPerChar) | value;
              bits += bitsPerChar;
              if (bits >= 8) {
                bits -= 8;
                out[written++] = 255 & (buffer >> bits);
              }
            }
            if (bits >= bitsPerChar || 255 & (buffer << (8 - bits))) {
              throw new SyntaxError("Unexpected end of data");
            }
            return out;
          };
          const encode = (data, alphabet, bitsPerChar) => {
            const pad = alphabet[alphabet.length - 1] === "=";
            const mask = (1 << bitsPerChar) - 1;
            let out = "";
            let bits = 0;
            let buffer = 0;
            for (let i = 0; i < data.length; ++i) {
              buffer = (buffer << 8) | data[i];
              bits += 8;
              while (bits > bitsPerChar) {
                bits -= bitsPerChar;
                out += alphabet[mask & (buffer >> bits)];
              }
            }
            if (bits) {
              out += alphabet[mask & (buffer << (bitsPerChar - bits))];
            }
            if (pad) {
              while ((out.length * bitsPerChar) & 7) {
                out += "=";
              }
            }
            return out;
          };
          const rfc4648 = ({ name, prefix, bitsPerChar, alphabet }) => {
            return from({
              prefix,
              name,
              encode(input) {
                return encode(input, alphabet, bitsPerChar);
              },
              decode(input) {
                return decode(input, alphabet, bitsPerChar, name);
              },
            });
          };

          exports.Codec = Codec;
          exports.baseX = baseX;
          exports.from = from;
          exports.or = or;
          exports.rfc4648 = rfc4648;
        },
        { "../../vendor/base-x.js": 112, "../bytes.js": 102 },
      ],
      91: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base10 = base.baseX({
            prefix: "9",
            name: "base10",
            alphabet: "0123456789",
          });

          exports.base10 = base10;
        },
        { "./base.js": 90 },
      ],
      92: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base16 = base.rfc4648({
            prefix: "f",
            name: "base16",
            alphabet: "0123456789abcdef",
            bitsPerChar: 4,
          });
          const base16upper = base.rfc4648({
            prefix: "F",
            name: "base16upper",
            alphabet: "0123456789ABCDEF",
            bitsPerChar: 4,
          });

          exports.base16 = base16;
          exports.base16upper = base16upper;
        },
        { "./base.js": 90 },
      ],
      93: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base2 = base.rfc4648({
            prefix: "0",
            name: "base2",
            alphabet: "01",
            bitsPerChar: 1,
          });

          exports.base2 = base2;
        },
        { "./base.js": 90 },
      ],
      94: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const alphabet = Array.from(
            "\uD83D\uDE80\uD83E\uDE90\u2604\uD83D\uDEF0\uD83C\uDF0C\uD83C\uDF11\uD83C\uDF12\uD83C\uDF13\uD83C\uDF14\uD83C\uDF15\uD83C\uDF16\uD83C\uDF17\uD83C\uDF18\uD83C\uDF0D\uD83C\uDF0F\uD83C\uDF0E\uD83D\uDC09\u2600\uD83D\uDCBB\uD83D\uDDA5\uD83D\uDCBE\uD83D\uDCBF\uD83D\uDE02\u2764\uD83D\uDE0D\uD83E\uDD23\uD83D\uDE0A\uD83D\uDE4F\uD83D\uDC95\uD83D\uDE2D\uD83D\uDE18\uD83D\uDC4D\uD83D\uDE05\uD83D\uDC4F\uD83D\uDE01\uD83D\uDD25\uD83E\uDD70\uD83D\uDC94\uD83D\uDC96\uD83D\uDC99\uD83D\uDE22\uD83E\uDD14\uD83D\uDE06\uD83D\uDE44\uD83D\uDCAA\uD83D\uDE09\u263A\uD83D\uDC4C\uD83E\uDD17\uD83D\uDC9C\uD83D\uDE14\uD83D\uDE0E\uD83D\uDE07\uD83C\uDF39\uD83E\uDD26\uD83C\uDF89\uD83D\uDC9E\u270C\u2728\uD83E\uDD37\uD83D\uDE31\uD83D\uDE0C\uD83C\uDF38\uD83D\uDE4C\uD83D\uDE0B\uD83D\uDC97\uD83D\uDC9A\uD83D\uDE0F\uD83D\uDC9B\uD83D\uDE42\uD83D\uDC93\uD83E\uDD29\uD83D\uDE04\uD83D\uDE00\uD83D\uDDA4\uD83D\uDE03\uD83D\uDCAF\uD83D\uDE48\uD83D\uDC47\uD83C\uDFB6\uD83D\uDE12\uD83E\uDD2D\u2763\uD83D\uDE1C\uD83D\uDC8B\uD83D\uDC40\uD83D\uDE2A\uD83D\uDE11\uD83D\uDCA5\uD83D\uDE4B\uD83D\uDE1E\uD83D\uDE29\uD83D\uDE21\uD83E\uDD2A\uD83D\uDC4A\uD83E\uDD73\uD83D\uDE25\uD83E\uDD24\uD83D\uDC49\uD83D\uDC83\uD83D\uDE33\u270B\uD83D\uDE1A\uD83D\uDE1D\uD83D\uDE34\uD83C\uDF1F\uD83D\uDE2C\uD83D\uDE43\uD83C\uDF40\uD83C\uDF37\uD83D\uDE3B\uD83D\uDE13\u2B50\u2705\uD83E\uDD7A\uD83C\uDF08\uD83D\uDE08\uD83E\uDD18\uD83D\uDCA6\u2714\uD83D\uDE23\uD83C\uDFC3\uD83D\uDC90\u2639\uD83C\uDF8A\uD83D\uDC98\uD83D\uDE20\u261D\uD83D\uDE15\uD83C\uDF3A\uD83C\uDF82\uD83C\uDF3B\uD83D\uDE10\uD83D\uDD95\uD83D\uDC9D\uD83D\uDE4A\uD83D\uDE39\uD83D\uDDE3\uD83D\uDCAB\uD83D\uDC80\uD83D\uDC51\uD83C\uDFB5\uD83E\uDD1E\uD83D\uDE1B\uD83D\uDD34\uD83D\uDE24\uD83C\uDF3C\uD83D\uDE2B\u26BD\uD83E\uDD19\u2615\uD83C\uDFC6\uD83E\uDD2B\uD83D\uDC48\uD83D\uDE2E\uD83D\uDE46\uD83C\uDF7B\uD83C\uDF43\uD83D\uDC36\uD83D\uDC81\uD83D\uDE32\uD83C\uDF3F\uD83E\uDDE1\uD83C\uDF81\u26A1\uD83C\uDF1E\uD83C\uDF88\u274C\u270A\uD83D\uDC4B\uD83D\uDE30\uD83E\uDD28\uD83D\uDE36\uD83E\uDD1D\uD83D\uDEB6\uD83D\uDCB0\uD83C\uDF53\uD83D\uDCA2\uD83E\uDD1F\uD83D\uDE41\uD83D\uDEA8\uD83D\uDCA8\uD83E\uDD2C\u2708\uD83C\uDF80\uD83C\uDF7A\uD83E\uDD13\uD83D\uDE19\uD83D\uDC9F\uD83C\uDF31\uD83D\uDE16\uD83D\uDC76\uD83E\uDD74\u25B6\u27A1\u2753\uD83D\uDC8E\uD83D\uDCB8\u2B07\uD83D\uDE28\uD83C\uDF1A\uD83E\uDD8B\uD83D\uDE37\uD83D\uDD7A\u26A0\uD83D\uDE45\uD83D\uDE1F\uD83D\uDE35\uD83D\uDC4E\uD83E\uDD32\uD83E\uDD20\uD83E\uDD27\uD83D\uDCCC\uD83D\uDD35\uD83D\uDC85\uD83E\uDDD0\uD83D\uDC3E\uD83C\uDF52\uD83D\uDE17\uD83E\uDD11\uD83C\uDF0A\uD83E\uDD2F\uD83D\uDC37\u260E\uD83D\uDCA7\uD83D\uDE2F\uD83D\uDC86\uD83D\uDC46\uD83C\uDFA4\uD83D\uDE47\uD83C\uDF51\u2744\uD83C\uDF34\uD83D\uDCA3\uD83D\uDC38\uD83D\uDC8C\uD83D\uDCCD\uD83E\uDD40\uD83E\uDD22\uD83D\uDC45\uD83D\uDCA1\uD83D\uDCA9\uD83D\uDC50\uD83D\uDCF8\uD83D\uDC7B\uD83E\uDD10\uD83E\uDD2E\uD83C\uDFBC\uD83E\uDD75\uD83D\uDEA9\uD83C\uDF4E\uD83C\uDF4A\uD83D\uDC7C\uD83D\uDC8D\uD83D\uDCE3\uD83E\uDD42"
          );
          const alphabetBytesToChars = alphabet.reduce((p, c, i) => {
            p[i] = c;
            return p;
          }, []);
          const alphabetCharsToBytes = alphabet.reduce((p, c, i) => {
            p[c.codePointAt(0)] = i;
            return p;
          }, []);
          function encode(data) {
            return data.reduce((p, c) => {
              p += alphabetBytesToChars[c];
              return p;
            }, "");
          }
          function decode(str) {
            const byts = [];
            for (const char of str) {
              const byt = alphabetCharsToBytes[char.codePointAt(0)];
              if (byt === undefined) {
                throw new Error(`Non-base256emoji character: ${char}`);
              }
              byts.push(byt);
            }
            return new Uint8Array(byts);
          }
          const base256emoji = base.from({
            prefix: "\uD83D\uDE80",
            name: "base256emoji",
            encode,
            decode,
          });

          exports.base256emoji = base256emoji;
        },
        { "./base.js": 90 },
      ],
      95: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base32 = base.rfc4648({
            prefix: "b",
            name: "base32",
            alphabet: "abcdefghijklmnopqrstuvwxyz234567",
            bitsPerChar: 5,
          });
          const base32upper = base.rfc4648({
            prefix: "B",
            name: "base32upper",
            alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
            bitsPerChar: 5,
          });
          const base32pad = base.rfc4648({
            prefix: "c",
            name: "base32pad",
            alphabet: "abcdefghijklmnopqrstuvwxyz234567=",
            bitsPerChar: 5,
          });
          const base32padupper = base.rfc4648({
            prefix: "C",
            name: "base32padupper",
            alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567=",
            bitsPerChar: 5,
          });
          const base32hex = base.rfc4648({
            prefix: "v",
            name: "base32hex",
            alphabet: "0123456789abcdefghijklmnopqrstuv",
            bitsPerChar: 5,
          });
          const base32hexupper = base.rfc4648({
            prefix: "V",
            name: "base32hexupper",
            alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV",
            bitsPerChar: 5,
          });
          const base32hexpad = base.rfc4648({
            prefix: "t",
            name: "base32hexpad",
            alphabet: "0123456789abcdefghijklmnopqrstuv=",
            bitsPerChar: 5,
          });
          const base32hexpadupper = base.rfc4648({
            prefix: "T",
            name: "base32hexpadupper",
            alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV=",
            bitsPerChar: 5,
          });
          const base32z = base.rfc4648({
            prefix: "h",
            name: "base32z",
            alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769",
            bitsPerChar: 5,
          });

          exports.base32 = base32;
          exports.base32hex = base32hex;
          exports.base32hexpad = base32hexpad;
          exports.base32hexpadupper = base32hexpadupper;
          exports.base32hexupper = base32hexupper;
          exports.base32pad = base32pad;
          exports.base32padupper = base32padupper;
          exports.base32upper = base32upper;
          exports.base32z = base32z;
        },
        { "./base.js": 90 },
      ],
      96: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base36 = base.baseX({
            prefix: "k",
            name: "base36",
            alphabet: "0123456789abcdefghijklmnopqrstuvwxyz",
          });
          const base36upper = base.baseX({
            prefix: "K",
            name: "base36upper",
            alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          });

          exports.base36 = base36;
          exports.base36upper = base36upper;
        },
        { "./base.js": 90 },
      ],
      97: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base58btc = base.baseX({
            name: "base58btc",
            prefix: "z",
            alphabet:
              "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
          });
          const base58flickr = base.baseX({
            name: "base58flickr",
            prefix: "Z",
            alphabet:
              "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
          });

          exports.base58btc = base58btc;
          exports.base58flickr = base58flickr;
        },
        { "./base.js": 90 },
      ],
      98: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base64 = base.rfc4648({
            prefix: "m",
            name: "base64",
            alphabet:
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
            bitsPerChar: 6,
          });
          const base64pad = base.rfc4648({
            prefix: "M",
            name: "base64pad",
            alphabet:
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
            bitsPerChar: 6,
          });
          const base64url = base.rfc4648({
            prefix: "u",
            name: "base64url",
            alphabet:
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
            bitsPerChar: 6,
          });
          const base64urlpad = base.rfc4648({
            prefix: "U",
            name: "base64urlpad",
            alphabet:
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=",
            bitsPerChar: 6,
          });

          exports.base64 = base64;
          exports.base64pad = base64pad;
          exports.base64url = base64url;
          exports.base64urlpad = base64urlpad;
        },
        { "./base.js": 90 },
      ],
      99: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");

          const base8 = base.rfc4648({
            prefix: "7",
            name: "base8",
            alphabet: "01234567",
            bitsPerChar: 3,
          });

          exports.base8 = base8;
        },
        { "./base.js": 90 },
      ],
      100: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var base = require("./base.js");
          var bytes = require("../bytes.js");

          const identity = base.from({
            prefix: "\0",
            name: "identity",
            encode: (buf) => bytes.toString(buf),
            decode: (str) => bytes.fromString(str),
          });

          exports.identity = identity;
        },
        { "../bytes.js": 102, "./base.js": 90 },
      ],
      101: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var identity = require("./bases/identity.js");
          var base2 = require("./bases/base2.js");
          var base8 = require("./bases/base8.js");
          var base10 = require("./bases/base10.js");
          var base16 = require("./bases/base16.js");
          var base32 = require("./bases/base32.js");
          var base36 = require("./bases/base36.js");
          var base58 = require("./bases/base58.js");
          var base64 = require("./bases/base64.js");
          var base256emoji = require("./bases/base256emoji.js");
          var sha2 = require("./hashes/sha2.js");
          var identity$1 = require("./hashes/identity.js");
          var raw = require("./codecs/raw.js");
          var json = require("./codecs/json.js");
          require("./index.js");
          var cid = require("./cid.js");
          var hasher = require("./hashes/hasher.js");
          var digest = require("./hashes/digest.js");
          var varint = require("./varint.js");
          var bytes = require("./bytes.js");

          const bases = {
            ...identity,
            ...base2,
            ...base8,
            ...base10,
            ...base16,
            ...base32,
            ...base36,
            ...base58,
            ...base64,
            ...base256emoji,
          };
          const hashes = {
            ...sha2,
            ...identity$1,
          };
          const codecs = {
            raw,
            json,
          };

          exports.CID = cid.CID;
          exports.hasher = hasher;
          exports.digest = digest;
          exports.varint = varint;
          exports.bytes = bytes;
          exports.bases = bases;
          exports.codecs = codecs;
          exports.hashes = hashes;
        },
        {
          "./bases/base10.js": 91,
          "./bases/base16.js": 92,
          "./bases/base2.js": 93,
          "./bases/base256emoji.js": 94,
          "./bases/base32.js": 95,
          "./bases/base36.js": 96,
          "./bases/base58.js": 97,
          "./bases/base64.js": 98,
          "./bases/base8.js": 99,
          "./bases/identity.js": 100,
          "./bytes.js": 102,
          "./cid.js": 103,
          "./codecs/json.js": 104,
          "./codecs/raw.js": 105,
          "./hashes/digest.js": 106,
          "./hashes/hasher.js": 107,
          "./hashes/identity.js": 108,
          "./hashes/sha2.js": 109,
          "./index.js": 110,
          "./varint.js": 111,
        },
      ],
      102: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          const empty = new Uint8Array(0);
          const toHex = (d) =>
            d.reduce(
              (hex, byte) => hex + byte.toString(16).padStart(2, "0"),
              ""
            );
          const fromHex = (hex) => {
            const hexes = hex.match(/../g);
            return hexes
              ? new Uint8Array(hexes.map((b) => parseInt(b, 16)))
              : empty;
          };
          const equals = (aa, bb) => {
            if (aa === bb) return true;
            if (aa.byteLength !== bb.byteLength) {
              return false;
            }
            for (let ii = 0; ii < aa.byteLength; ii++) {
              if (aa[ii] !== bb[ii]) {
                return false;
              }
            }
            return true;
          };
          const coerce = (o) => {
            if (o instanceof Uint8Array && o.constructor.name === "Uint8Array")
              return o;
            if (o instanceof ArrayBuffer) return new Uint8Array(o);
            if (ArrayBuffer.isView(o)) {
              return new Uint8Array(o.buffer, o.byteOffset, o.byteLength);
            }
            throw new Error("Unknown type, must be binary type");
          };
          const isBinary = (o) =>
            o instanceof ArrayBuffer || ArrayBuffer.isView(o);
          const fromString = (str) => new TextEncoder().encode(str);
          const toString = (b) => new TextDecoder().decode(b);

          exports.coerce = coerce;
          exports.empty = empty;
          exports.equals = equals;
          exports.fromHex = fromHex;
          exports.fromString = fromString;
          exports.isBinary = isBinary;
          exports.toHex = toHex;
          exports.toString = toString;
        },
        {},
      ],
      103: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var varint = require("./varint.js");
          var digest = require("./hashes/digest.js");
          var base58 = require("./bases/base58.js");
          var base32 = require("./bases/base32.js");
          var bytes = require("./bytes.js");

          class CID {
            constructor(version, code, multihash, bytes) {
              this.code = code;
              this.version = version;
              this.multihash = multihash;
              this.bytes = bytes;
              this.byteOffset = bytes.byteOffset;
              this.byteLength = bytes.byteLength;
              this.asCID = this;
              this._baseCache = new Map();
              Object.defineProperties(this, {
                byteOffset: hidden,
                byteLength: hidden,
                code: readonly,
                version: readonly,
                multihash: readonly,
                bytes: readonly,
                _baseCache: hidden,
                asCID: hidden,
              });
            }
            toV0() {
              switch (this.version) {
                case 0: {
                  return this;
                }
                default: {
                  const { code, multihash } = this;
                  if (code !== DAG_PB_CODE) {
                    throw new Error("Cannot convert a non dag-pb CID to CIDv0");
                  }
                  if (multihash.code !== SHA_256_CODE) {
                    throw new Error(
                      "Cannot convert non sha2-256 multihash CID to CIDv0"
                    );
                  }
                  return CID.createV0(multihash);
                }
              }
            }
            toV1() {
              switch (this.version) {
                case 0: {
                  const { code, digest: digest$1 } = this.multihash;
                  const multihash = digest.create(code, digest$1);
                  return CID.createV1(this.code, multihash);
                }
                case 1: {
                  return this;
                }
                default: {
                  throw Error(
                    `Can not convert CID version ${this.version} to version 0. This is a bug please report`
                  );
                }
              }
            }
            equals(other) {
              return (
                other &&
                this.code === other.code &&
                this.version === other.version &&
                digest.equals(this.multihash, other.multihash)
              );
            }
            toString(base) {
              const { bytes, version, _baseCache } = this;
              switch (version) {
                case 0:
                  return toStringV0(
                    bytes,
                    _baseCache,
                    base || base58.base58btc.encoder
                  );
                default:
                  return toStringV1(
                    bytes,
                    _baseCache,
                    base || base32.base32.encoder
                  );
              }
            }
            toJSON() {
              return {
                code: this.code,
                version: this.version,
                hash: this.multihash.bytes,
              };
            }
            get [Symbol.toStringTag]() {
              return "CID";
            }
            [Symbol.for("nodejs.util.inspect.custom")]() {
              return "CID(" + this.toString() + ")";
            }
            static isCID(value) {
              deprecate(/^0\.0/, IS_CID_DEPRECATION);
              return !!(value && (value[cidSymbol] || value.asCID === value));
            }
            get toBaseEncodedString() {
              throw new Error("Deprecated, use .toString()");
            }
            get codec() {
              throw new Error(
                '"codec" property is deprecated, use integer "code" property instead'
              );
            }
            get buffer() {
              throw new Error(
                "Deprecated .buffer property, use .bytes to get Uint8Array instead"
              );
            }
            get multibaseName() {
              throw new Error('"multibaseName" property is deprecated');
            }
            get prefix() {
              throw new Error('"prefix" property is deprecated');
            }
            static asCID(value) {
              if (value instanceof CID) {
                return value;
              } else if (value != null && value.asCID === value) {
                const { version, code, multihash, bytes } = value;
                return new CID(
                  version,
                  code,
                  multihash,
                  bytes || encodeCID(version, code, multihash.bytes)
                );
              } else if (value != null && value[cidSymbol] === true) {
                const { version, multihash, code } = value;
                const digest$1 = digest.decode(multihash);
                return CID.create(version, code, digest$1);
              } else {
                return null;
              }
            }
            static create(version, code, digest) {
              if (typeof code !== "number") {
                throw new Error("String codecs are no longer supported");
              }
              switch (version) {
                case 0: {
                  if (code !== DAG_PB_CODE) {
                    throw new Error(
                      `Version 0 CID must use dag-pb (code: ${DAG_PB_CODE}) block encoding`
                    );
                  } else {
                    return new CID(version, code, digest, digest.bytes);
                  }
                }
                case 1: {
                  const bytes = encodeCID(version, code, digest.bytes);
                  return new CID(version, code, digest, bytes);
                }
                default: {
                  throw new Error("Invalid version");
                }
              }
            }
            static createV0(digest) {
              return CID.create(0, DAG_PB_CODE, digest);
            }
            static createV1(code, digest) {
              return CID.create(1, code, digest);
            }
            static decode(bytes) {
              const [cid, remainder] = CID.decodeFirst(bytes);
              if (remainder.length) {
                throw new Error("Incorrect length");
              }
              return cid;
            }
            static decodeFirst(bytes$1) {
              const specs = CID.inspectBytes(bytes$1);
              const prefixSize = specs.size - specs.multihashSize;
              const multihashBytes = bytes.coerce(
                bytes$1.subarray(prefixSize, prefixSize + specs.multihashSize)
              );
              if (multihashBytes.byteLength !== specs.multihashSize) {
                throw new Error("Incorrect length");
              }
              const digestBytes = multihashBytes.subarray(
                specs.multihashSize - specs.digestSize
              );
              const digest$1 = new digest.Digest(
                specs.multihashCode,
                specs.digestSize,
                digestBytes,
                multihashBytes
              );
              const cid =
                specs.version === 0
                  ? CID.createV0(digest$1)
                  : CID.createV1(specs.codec, digest$1);
              return [cid, bytes$1.subarray(specs.size)];
            }
            static inspectBytes(initialBytes) {
              let offset = 0;
              const next = () => {
                const [i, length] = varint.decode(
                  initialBytes.subarray(offset)
                );
                offset += length;
                return i;
              };
              let version = next();
              let codec = DAG_PB_CODE;
              if (version === 18) {
                version = 0;
                offset = 0;
              } else if (version === 1) {
                codec = next();
              }
              if (version !== 0 && version !== 1) {
                throw new RangeError(`Invalid CID version ${version}`);
              }
              const prefixSize = offset;
              const multihashCode = next();
              const digestSize = next();
              const size = offset + digestSize;
              const multihashSize = size - prefixSize;
              return {
                version,
                codec,
                multihashCode,
                digestSize,
                multihashSize,
                size,
              };
            }
            static parse(source, base) {
              const [prefix, bytes] = parseCIDtoBytes(source, base);
              const cid = CID.decode(bytes);
              cid._baseCache.set(prefix, source);
              return cid;
            }
          }
          const parseCIDtoBytes = (source, base) => {
            switch (source[0]) {
              case "Q": {
                const decoder = base || base58.base58btc;
                return [
                  base58.base58btc.prefix,
                  decoder.decode(`${base58.base58btc.prefix}${source}`),
                ];
              }
              case base58.base58btc.prefix: {
                const decoder = base || base58.base58btc;
                return [base58.base58btc.prefix, decoder.decode(source)];
              }
              case base32.base32.prefix: {
                const decoder = base || base32.base32;
                return [base32.base32.prefix, decoder.decode(source)];
              }
              default: {
                if (base == null) {
                  throw Error(
                    "To parse non base32 or base58btc encoded CID multibase decoder must be provided"
                  );
                }
                return [source[0], base.decode(source)];
              }
            }
          };
          const toStringV0 = (bytes, cache, base) => {
            const { prefix } = base;
            if (prefix !== base58.base58btc.prefix) {
              throw Error(`Cannot string encode V0 in ${base.name} encoding`);
            }
            const cid = cache.get(prefix);
            if (cid == null) {
              const cid = base.encode(bytes).slice(1);
              cache.set(prefix, cid);
              return cid;
            } else {
              return cid;
            }
          };
          const toStringV1 = (bytes, cache, base) => {
            const { prefix } = base;
            const cid = cache.get(prefix);
            if (cid == null) {
              const cid = base.encode(bytes);
              cache.set(prefix, cid);
              return cid;
            } else {
              return cid;
            }
          };
          const DAG_PB_CODE = 112;
          const SHA_256_CODE = 18;
          const encodeCID = (version, code, multihash) => {
            const codeOffset = varint.encodingLength(version);
            const hashOffset = codeOffset + varint.encodingLength(code);
            const bytes = new Uint8Array(hashOffset + multihash.byteLength);
            varint.encodeTo(version, bytes, 0);
            varint.encodeTo(code, bytes, codeOffset);
            bytes.set(multihash, hashOffset);
            return bytes;
          };
          const cidSymbol = Symbol.for("@ipld/js-cid/CID");
          const readonly = {
            writable: false,
            configurable: false,
            enumerable: true,
          };
          const hidden = {
            writable: false,
            enumerable: false,
            configurable: false,
          };
          const version = "0.0.0-dev";
          const deprecate = (range, message) => {
            if (range.test(version)) {
              console.warn(message);
            } else {
              throw new Error(message);
            }
          };
          const IS_CID_DEPRECATION = `CID.isCID(v) is deprecated and will be removed in the next major release.
Following code pattern:

if (CID.isCID(value)) {
  doSomethingWithCID(value)
}

Is replaced with:

const cid = CID.asCID(value)
if (cid) {
  // Make sure to use cid instead of value
  doSomethingWithCID(cid)
}
`;

          exports.CID = CID;
        },
        {
          "./bases/base32.js": 95,
          "./bases/base58.js": 97,
          "./bytes.js": 102,
          "./hashes/digest.js": 106,
          "./varint.js": 111,
        },
      ],
      104: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          const textEncoder = new TextEncoder();
          const textDecoder = new TextDecoder();
          const name = "json";
          const code = 512;
          const encode = (node) => textEncoder.encode(JSON.stringify(node));
          const decode = (data) => JSON.parse(textDecoder.decode(data));

          exports.code = code;
          exports.decode = decode;
          exports.encode = encode;
          exports.name = name;
        },
        {},
      ],
      105: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var bytes = require("../bytes.js");

          const name = "raw";
          const code = 85;
          const encode = (node) => bytes.coerce(node);
          const decode = (data) => bytes.coerce(data);

          exports.code = code;
          exports.decode = decode;
          exports.encode = encode;
          exports.name = name;
        },
        { "../bytes.js": 102 },
      ],
      106: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var bytes = require("../bytes.js");
          var varint = require("../varint.js");

          const create = (code, digest) => {
            const size = digest.byteLength;
            const sizeOffset = varint.encodingLength(code);
            const digestOffset = sizeOffset + varint.encodingLength(size);
            const bytes = new Uint8Array(digestOffset + size);
            varint.encodeTo(code, bytes, 0);
            varint.encodeTo(size, bytes, sizeOffset);
            bytes.set(digest, digestOffset);
            return new Digest(code, size, digest, bytes);
          };
          const decode = (multihash) => {
            const bytes$1 = bytes.coerce(multihash);
            const [code, sizeOffset] = varint.decode(bytes$1);
            const [size, digestOffset] = varint.decode(
              bytes$1.subarray(sizeOffset)
            );
            const digest = bytes$1.subarray(sizeOffset + digestOffset);
            if (digest.byteLength !== size) {
              throw new Error("Incorrect length");
            }
            return new Digest(code, size, digest, bytes$1);
          };
          const equals = (a, b) => {
            if (a === b) {
              return true;
            } else {
              return (
                a.code === b.code &&
                a.size === b.size &&
                bytes.equals(a.bytes, b.bytes)
              );
            }
          };
          class Digest {
            constructor(code, size, digest, bytes) {
              this.code = code;
              this.size = size;
              this.digest = digest;
              this.bytes = bytes;
            }
          }

          exports.Digest = Digest;
          exports.create = create;
          exports.decode = decode;
          exports.equals = equals;
        },
        { "../bytes.js": 102, "../varint.js": 111 },
      ],
      107: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var digest = require("./digest.js");

          const from = ({ name, code, encode }) =>
            new Hasher(name, code, encode);
          class Hasher {
            constructor(name, code, encode) {
              this.name = name;
              this.code = code;
              this.encode = encode;
            }
            digest(input) {
              if (input instanceof Uint8Array) {
                const result = this.encode(input);
                return result instanceof Uint8Array
                  ? digest.create(this.code, result)
                  : result.then((digest$1) =>
                      digest.create(this.code, digest$1)
                    );
              } else {
                throw Error("Unknown type, must be binary type");
              }
            }
          }

          exports.Hasher = Hasher;
          exports.from = from;
        },
        { "./digest.js": 106 },
      ],
      108: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var bytes = require("../bytes.js");
          var digest$1 = require("./digest.js");

          const code = 0;
          const name = "identity";
          const encode = bytes.coerce;
          const digest = (input) => digest$1.create(code, encode(input));
          const identity = {
            code,
            name,
            encode,
            digest,
          };

          exports.identity = identity;
        },
        { "../bytes.js": 102, "./digest.js": 106 },
      ],
      109: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var hasher = require("./hasher.js");

          const sha = (name) => async (data) =>
            new Uint8Array(await crypto.subtle.digest(name, data));
          const sha256 = hasher.from({
            name: "sha2-256",
            code: 18,
            encode: sha("SHA-256"),
          });
          const sha512 = hasher.from({
            name: "sha2-512",
            code: 19,
            encode: sha("SHA-512"),
          });

          exports.sha256 = sha256;
          exports.sha512 = sha512;
        },
        { "./hasher.js": 107 },
      ],
      110: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var cid = require("./cid.js");
          var varint = require("./varint.js");
          var bytes = require("./bytes.js");
          var hasher = require("./hashes/hasher.js");
          var digest = require("./hashes/digest.js");

          exports.CID = cid.CID;
          exports.varint = varint;
          exports.bytes = bytes;
          exports.hasher = hasher;
          exports.digest = digest;
        },
        {
          "./bytes.js": 102,
          "./cid.js": 103,
          "./hashes/digest.js": 106,
          "./hashes/hasher.js": 107,
          "./varint.js": 111,
        },
      ],
      111: [
        function (require, module, exports) {
          "use strict";

          Object.defineProperty(exports, "__esModule", { value: true });

          var varint$1 = require("../vendor/varint.js");

          const decode = (data, offset = 0) => {
            const code = varint$1.decode(data, offset);
            return [code, varint$1.decode.bytes];
          };
          const encodeTo = (int, target, offset = 0) => {
            varint$1.encode(int, target, offset);
            return target;
          };
          const encodingLength = (int) => {
            return varint$1.encodingLength(int);
          };

          exports.decode = decode;
          exports.encodeTo = encodeTo;
          exports.encodingLength = encodingLength;
        },
        { "../vendor/varint.js": 113 },
      ],
      112: [
        function (require, module, exports) {
          "use strict";

          function base(ALPHABET, name) {
            if (ALPHABET.length >= 255) {
              throw new TypeError("Alphabet too long");
            }
            var BASE_MAP = new Uint8Array(256);
            for (var j = 0; j < BASE_MAP.length; j++) {
              BASE_MAP[j] = 255;
            }
            for (var i = 0; i < ALPHABET.length; i++) {
              var x = ALPHABET.charAt(i);
              var xc = x.charCodeAt(0);
              if (BASE_MAP[xc] !== 255) {
                throw new TypeError(x + " is ambiguous");
              }
              BASE_MAP[xc] = i;
            }
            var BASE = ALPHABET.length;
            var LEADER = ALPHABET.charAt(0);
            var FACTOR = Math.log(BASE) / Math.log(256);
            var iFACTOR = Math.log(256) / Math.log(BASE);
            function encode(source) {
              if (source instanceof Uint8Array);
              else if (ArrayBuffer.isView(source)) {
                source = new Uint8Array(
                  source.buffer,
                  source.byteOffset,
                  source.byteLength
                );
              } else if (Array.isArray(source)) {
                source = Uint8Array.from(source);
              }
              if (!(source instanceof Uint8Array)) {
                throw new TypeError("Expected Uint8Array");
              }
              if (source.length === 0) {
                return "";
              }
              var zeroes = 0;
              var length = 0;
              var pbegin = 0;
              var pend = source.length;
              while (pbegin !== pend && source[pbegin] === 0) {
                pbegin++;
                zeroes++;
              }
              var size = ((pend - pbegin) * iFACTOR + 1) >>> 0;
              var b58 = new Uint8Array(size);
              while (pbegin !== pend) {
                var carry = source[pbegin];
                var i = 0;
                for (
                  var it1 = size - 1;
                  (carry !== 0 || i < length) && it1 !== -1;
                  it1--, i++
                ) {
                  carry += (256 * b58[it1]) >>> 0;
                  b58[it1] = carry % BASE >>> 0;
                  carry = (carry / BASE) >>> 0;
                }
                if (carry !== 0) {
                  throw new Error("Non-zero carry");
                }
                length = i;
                pbegin++;
              }
              var it2 = size - length;
              while (it2 !== size && b58[it2] === 0) {
                it2++;
              }
              var str = LEADER.repeat(zeroes);
              for (; it2 < size; ++it2) {
                str += ALPHABET.charAt(b58[it2]);
              }
              return str;
            }
            function decodeUnsafe(source) {
              if (typeof source !== "string") {
                throw new TypeError("Expected String");
              }
              if (source.length === 0) {
                return new Uint8Array();
              }
              var psz = 0;
              if (source[psz] === " ") {
                return;
              }
              var zeroes = 0;
              var length = 0;
              while (source[psz] === LEADER) {
                zeroes++;
                psz++;
              }
              var size = ((source.length - psz) * FACTOR + 1) >>> 0;
              var b256 = new Uint8Array(size);
              while (source[psz]) {
                var carry = BASE_MAP[source.charCodeAt(psz)];
                if (carry === 255) {
                  return;
                }
                var i = 0;
                for (
                  var it3 = size - 1;
                  (carry !== 0 || i < length) && it3 !== -1;
                  it3--, i++
                ) {
                  carry += (BASE * b256[it3]) >>> 0;
                  b256[it3] = carry % 256 >>> 0;
                  carry = (carry / 256) >>> 0;
                }
                if (carry !== 0) {
                  throw new Error("Non-zero carry");
                }
                length = i;
                psz++;
              }
              if (source[psz] === " ") {
                return;
              }
              var it4 = size - length;
              while (it4 !== size && b256[it4] === 0) {
                it4++;
              }
              var vch = new Uint8Array(zeroes + (size - it4));
              var j = zeroes;
              while (it4 !== size) {
                vch[j++] = b256[it4++];
              }
              return vch;
            }
            function decode(string) {
              var buffer = decodeUnsafe(string);
              if (buffer) {
                return buffer;
              }
              throw new Error(`Non-${name} character`);
            }
            return {
              encode: encode,
              decodeUnsafe: decodeUnsafe,
              decode: decode,
            };
          }
          var src = base;
          var _brrp__multiformats_scope_baseX = src;

          module.exports = _brrp__multiformats_scope_baseX;
        },
        {},
      ],
      113: [
        function (require, module, exports) {
          "use strict";

          var encode_1 = encode;
          var MSB = 128,
            REST = 127,
            MSBALL = ~REST,
            INT = Math.pow(2, 31);
          function encode(num, out, offset) {
            out = out || [];
            offset = offset || 0;
            var oldOffset = offset;
            while (num >= INT) {
              out[offset++] = (num & 255) | MSB;
              num /= 128;
            }
            while (num & MSBALL) {
              out[offset++] = (num & 255) | MSB;
              num >>>= 7;
            }
            out[offset] = num | 0;
            encode.bytes = offset - oldOffset + 1;
            return out;
          }
          var decode = read;
          var MSB$1 = 128,
            REST$1 = 127;
          function read(buf, offset) {
            var res = 0,
              offset = offset || 0,
              shift = 0,
              counter = offset,
              b,
              l = buf.length;
            do {
              if (counter >= l) {
                read.bytes = 0;
                throw new RangeError("Could not decode varint");
              }
              b = buf[counter++];
              res +=
                shift < 28
                  ? (b & REST$1) << shift
                  : (b & REST$1) * Math.pow(2, shift);
              shift += 7;
            } while (b >= MSB$1);
            read.bytes = counter - offset;
            return res;
          }
          var N1 = Math.pow(2, 7);
          var N2 = Math.pow(2, 14);
          var N3 = Math.pow(2, 21);
          var N4 = Math.pow(2, 28);
          var N5 = Math.pow(2, 35);
          var N6 = Math.pow(2, 42);
          var N7 = Math.pow(2, 49);
          var N8 = Math.pow(2, 56);
          var N9 = Math.pow(2, 63);
          var length = function (value) {
            return value < N1
              ? 1
              : value < N2
              ? 2
              : value < N3
              ? 3
              : value < N4
              ? 4
              : value < N5
              ? 5
              : value < N6
              ? 6
              : value < N7
              ? 7
              : value < N8
              ? 8
              : value < N9
              ? 9
              : 10;
          };
          var varint = {
            encode: encode_1,
            decode: decode,
            encodingLength: length,
          };
          var _brrp_varint = varint;
          var varint$1 = _brrp_varint;

          module.exports = varint$1;
        },
        {},
      ],
      114: [
        function (require, module, exports) {
          arguments[4][16][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 118, dup: 16 },
      ],
      115: [
        function (require, module, exports) {
          arguments[4][17][0].apply(exports, arguments);
        },
        { "./alloc.js": 114, "./util/as-uint8array.js": 118, dup: 17 },
      ],
      116: [
        function (require, module, exports) {
          arguments[4][27][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 118, "./util/bases.js": 119, dup: 27 },
      ],
      117: [
        function (require, module, exports) {
          arguments[4][19][0].apply(exports, arguments);
        },
        { "./util/bases.js": 119, dup: 19 },
      ],
      118: [
        function (require, module, exports) {
          arguments[4][20][0].apply(exports, arguments);
        },
        { dup: 20 },
      ],
      119: [
        function (require, module, exports) {
          arguments[4][21][0].apply(exports, arguments);
        },
        { "../alloc.js": 114, dup: 21, "multiformats/basics": 101 },
      ],
      120: [
        function (require, module, exports) {
          module.exports = read;

          var MSB = 0x80,
            REST = 0x7f;

          function read(buf, offset) {
            var res = 0,
              offset = offset || 0,
              shift = 0,
              counter = offset,
              b,
              l = buf.length;

            do {
              if (counter >= l) {
                read.bytes = 0;
                throw new RangeError("Could not decode varint");
              }
              b = buf[counter++];
              res +=
                shift < 28
                  ? (b & REST) << shift
                  : (b & REST) * Math.pow(2, shift);
              shift += 7;
            } while (b >= MSB);

            read.bytes = counter - offset;

            return res;
          }
        },
        {},
      ],
      121: [
        function (require, module, exports) {
          module.exports = encode;

          var MSB = 0x80,
            REST = 0x7f,
            MSBALL = ~REST,
            INT = Math.pow(2, 31);

          function encode(num, out, offset) {
            out = out || [];
            offset = offset || 0;
            var oldOffset = offset;

            while (num >= INT) {
              out[offset++] = (num & 0xff) | MSB;
              num /= 128;
            }
            while (num & MSBALL) {
              out[offset++] = (num & 0xff) | MSB;
              num >>>= 7;
            }
            out[offset] = num | 0;

            encode.bytes = offset - oldOffset + 1;

            return out;
          }
        },
        {},
      ],
      122: [
        function (require, module, exports) {
          module.exports = {
            encode: require("./encode.js"),
            decode: require("./decode.js"),
            encodingLength: require("./length.js"),
          };
        },
        { "./decode.js": 120, "./encode.js": 121, "./length.js": 123 },
      ],
      123: [
        function (require, module, exports) {
          var N1 = Math.pow(2, 7);
          var N2 = Math.pow(2, 14);
          var N3 = Math.pow(2, 21);
          var N4 = Math.pow(2, 28);
          var N5 = Math.pow(2, 35);
          var N6 = Math.pow(2, 42);
          var N7 = Math.pow(2, 49);
          var N8 = Math.pow(2, 56);
          var N9 = Math.pow(2, 63);

          module.exports = function (value) {
            return value < N1
              ? 1
              : value < N2
              ? 2
              : value < N3
              ? 3
              : value < N4
              ? 4
              : value < N5
              ? 5
              : value < N6
              ? 6
              : value < N7
              ? 7
              : value < N8
              ? 8
              : value < N9
              ? 9
              : 10;
          };
        },
        {},
      ],
      124: [
        function (require, module, exports) {
          /* eslint quote-props: off */
          "use strict";

          /**
           * Names for all available hashes
           *
           * @typedef { "identity" | "sha1" | "sha2-256" | "sha2-512" | "sha3-512" | "sha3-384" | "sha3-256" | "sha3-224" | "shake-128" | "shake-256" | "keccak-224" | "keccak-256" | "keccak-384" | "keccak-512" | "blake3" | "murmur3-128" | "murmur3-32" | "dbl-sha2-256" | "md4" | "md5" | "bmt" | "sha2-256-trunc254-padded" | "ripemd-128" | "ripemd-160" | "ripemd-256" | "ripemd-320" | "x11" | "kangarootwelve" | "sm3-256" | "blake2b-8" | "blake2b-16" | "blake2b-24" | "blake2b-32" | "blake2b-40" | "blake2b-48" | "blake2b-56" | "blake2b-64" | "blake2b-72" | "blake2b-80" | "blake2b-88" | "blake2b-96" | "blake2b-104" | "blake2b-112" | "blake2b-120" | "blake2b-128" | "blake2b-136" | "blake2b-144" | "blake2b-152" | "blake2b-160" | "blake2b-168" | "blake2b-176" | "blake2b-184" | "blake2b-192" | "blake2b-200" | "blake2b-208" | "blake2b-216" | "blake2b-224" | "blake2b-232" | "blake2b-240" | "blake2b-248" | "blake2b-256" | "blake2b-264" | "blake2b-272" | "blake2b-280" | "blake2b-288" | "blake2b-296" | "blake2b-304" | "blake2b-312" | "blake2b-320" | "blake2b-328" | "blake2b-336" | "blake2b-344" | "blake2b-352" | "blake2b-360" | "blake2b-368" | "blake2b-376" | "blake2b-384" | "blake2b-392" | "blake2b-400" | "blake2b-408" | "blake2b-416" | "blake2b-424" | "blake2b-432" | "blake2b-440" | "blake2b-448" | "blake2b-456" | "blake2b-464" | "blake2b-472" | "blake2b-480" | "blake2b-488" | "blake2b-496" | "blake2b-504" | "blake2b-512" | "blake2s-8" | "blake2s-16" | "blake2s-24" | "blake2s-32" | "blake2s-40" | "blake2s-48" | "blake2s-56" | "blake2s-64" | "blake2s-72" | "blake2s-80" | "blake2s-88" | "blake2s-96" | "blake2s-104" | "blake2s-112" | "blake2s-120" | "blake2s-128" | "blake2s-136" | "blake2s-144" | "blake2s-152" | "blake2s-160" | "blake2s-168" | "blake2s-176" | "blake2s-184" | "blake2s-192" | "blake2s-200" | "blake2s-208" | "blake2s-216" | "blake2s-224" | "blake2s-232" | "blake2s-240" | "blake2s-248" | "blake2s-256" | "skein256-8" | "skein256-16" | "skein256-24" | "skein256-32" | "skein256-40" | "skein256-48" | "skein256-56" | "skein256-64" | "skein256-72" | "skein256-80" | "skein256-88" | "skein256-96" | "skein256-104" | "skein256-112" | "skein256-120" | "skein256-128" | "skein256-136" | "skein256-144" | "skein256-152" | "skein256-160" | "skein256-168" | "skein256-176" | "skein256-184" | "skein256-192" | "skein256-200" | "skein256-208" | "skein256-216" | "skein256-224" | "skein256-232" | "skein256-240" | "skein256-248" | "skein256-256" | "skein512-8" | "skein512-16" | "skein512-24" | "skein512-32" | "skein512-40" | "skein512-48" | "skein512-56" | "skein512-64" | "skein512-72" | "skein512-80" | "skein512-88" | "skein512-96" | "skein512-104" | "skein512-112" | "skein512-120" | "skein512-128" | "skein512-136" | "skein512-144" | "skein512-152" | "skein512-160" | "skein512-168" | "skein512-176" | "skein512-184" | "skein512-192" | "skein512-200" | "skein512-208" | "skein512-216" | "skein512-224" | "skein512-232" | "skein512-240" | "skein512-248" | "skein512-256" | "skein512-264" | "skein512-272" | "skein512-280" | "skein512-288" | "skein512-296" | "skein512-304" | "skein512-312" | "skein512-320" | "skein512-328" | "skein512-336" | "skein512-344" | "skein512-352" | "skein512-360" | "skein512-368" | "skein512-376" | "skein512-384" | "skein512-392" | "skein512-400" | "skein512-408" | "skein512-416" | "skein512-424" | "skein512-432" | "skein512-440" | "skein512-448" | "skein512-456" | "skein512-464" | "skein512-472" | "skein512-480" | "skein512-488" | "skein512-496" | "skein512-504" | "skein512-512" | "skein1024-8" | "skein1024-16" | "skein1024-24" | "skein1024-32" | "skein1024-40" | "skein1024-48" | "skein1024-56" | "skein1024-64" | "skein1024-72" | "skein1024-80" | "skein1024-88" | "skein1024-96" | "skein1024-104" | "skein1024-112" | "skein1024-120" | "skein1024-128" | "skein1024-136" | "skein1024-144" | "skein1024-152" | "skein1024-160" | "skein1024-168" | "skein1024-176" | "skein1024-184" | "skein1024-192" | "skein1024-200" | "skein1024-208" | "skein1024-216" | "skein1024-224" | "skein1024-232" | "skein1024-240" | "skein1024-248" | "skein1024-256" | "skein1024-264" | "skein1024-272" | "skein1024-280" | "skein1024-288" | "skein1024-296" | "skein1024-304" | "skein1024-312" | "skein1024-320" | "skein1024-328" | "skein1024-336" | "skein1024-344" | "skein1024-352" | "skein1024-360" | "skein1024-368" | "skein1024-376" | "skein1024-384" | "skein1024-392" | "skein1024-400" | "skein1024-408" | "skein1024-416" | "skein1024-424" | "skein1024-432" | "skein1024-440" | "skein1024-448" | "skein1024-456" | "skein1024-464" | "skein1024-472" | "skein1024-480" | "skein1024-488" | "skein1024-496" | "skein1024-504" | "skein1024-512" | "skein1024-520" | "skein1024-528" | "skein1024-536" | "skein1024-544" | "skein1024-552" | "skein1024-560" | "skein1024-568" | "skein1024-576" | "skein1024-584" | "skein1024-592" | "skein1024-600" | "skein1024-608" | "skein1024-616" | "skein1024-624" | "skein1024-632" | "skein1024-640" | "skein1024-648" | "skein1024-656" | "skein1024-664" | "skein1024-672" | "skein1024-680" | "skein1024-688" | "skein1024-696" | "skein1024-704" | "skein1024-712" | "skein1024-720" | "skein1024-728" | "skein1024-736" | "skein1024-744" | "skein1024-752" | "skein1024-760" | "skein1024-768" | "skein1024-776" | "skein1024-784" | "skein1024-792" | "skein1024-800" | "skein1024-808" | "skein1024-816" | "skein1024-824" | "skein1024-832" | "skein1024-840" | "skein1024-848" | "skein1024-856" | "skein1024-864" | "skein1024-872" | "skein1024-880" | "skein1024-888" | "skein1024-896" | "skein1024-904" | "skein1024-912" | "skein1024-920" | "skein1024-928" | "skein1024-936" | "skein1024-944" | "skein1024-952" | "skein1024-960" | "skein1024-968" | "skein1024-976" | "skein1024-984" | "skein1024-992" | "skein1024-1000" | "skein1024-1008" | "skein1024-1016" | "skein1024-1024" | "poseidon-bls12_381-a2-fc1" | "poseidon-bls12_381-a2-fc1-sc" } HashName
           */
          /**
           * Codes for all available hashes
           *
           * @typedef { 0x00 | 0x11 | 0x12 | 0x13 | 0x14 | 0x15 | 0x16 | 0x17 | 0x18 | 0x19 | 0x1a | 0x1b | 0x1c | 0x1d | 0x1e | 0x22 | 0x23 | 0x56 | 0xd4 | 0xd5 | 0xd6 | 0x1012 | 0x1052 | 0x1053 | 0x1054 | 0x1055 | 0x1100 | 0x1d01 | 0x534d | 0xb201 | 0xb202 | 0xb203 | 0xb204 | 0xb205 | 0xb206 | 0xb207 | 0xb208 | 0xb209 | 0xb20a | 0xb20b | 0xb20c | 0xb20d | 0xb20e | 0xb20f | 0xb210 | 0xb211 | 0xb212 | 0xb213 | 0xb214 | 0xb215 | 0xb216 | 0xb217 | 0xb218 | 0xb219 | 0xb21a | 0xb21b | 0xb21c | 0xb21d | 0xb21e | 0xb21f | 0xb220 | 0xb221 | 0xb222 | 0xb223 | 0xb224 | 0xb225 | 0xb226 | 0xb227 | 0xb228 | 0xb229 | 0xb22a | 0xb22b | 0xb22c | 0xb22d | 0xb22e | 0xb22f | 0xb230 | 0xb231 | 0xb232 | 0xb233 | 0xb234 | 0xb235 | 0xb236 | 0xb237 | 0xb238 | 0xb239 | 0xb23a | 0xb23b | 0xb23c | 0xb23d | 0xb23e | 0xb23f | 0xb240 | 0xb241 | 0xb242 | 0xb243 | 0xb244 | 0xb245 | 0xb246 | 0xb247 | 0xb248 | 0xb249 | 0xb24a | 0xb24b | 0xb24c | 0xb24d | 0xb24e | 0xb24f | 0xb250 | 0xb251 | 0xb252 | 0xb253 | 0xb254 | 0xb255 | 0xb256 | 0xb257 | 0xb258 | 0xb259 | 0xb25a | 0xb25b | 0xb25c | 0xb25d | 0xb25e | 0xb25f | 0xb260 | 0xb301 | 0xb302 | 0xb303 | 0xb304 | 0xb305 | 0xb306 | 0xb307 | 0xb308 | 0xb309 | 0xb30a | 0xb30b | 0xb30c | 0xb30d | 0xb30e | 0xb30f | 0xb310 | 0xb311 | 0xb312 | 0xb313 | 0xb314 | 0xb315 | 0xb316 | 0xb317 | 0xb318 | 0xb319 | 0xb31a | 0xb31b | 0xb31c | 0xb31d | 0xb31e | 0xb31f | 0xb320 | 0xb321 | 0xb322 | 0xb323 | 0xb324 | 0xb325 | 0xb326 | 0xb327 | 0xb328 | 0xb329 | 0xb32a | 0xb32b | 0xb32c | 0xb32d | 0xb32e | 0xb32f | 0xb330 | 0xb331 | 0xb332 | 0xb333 | 0xb334 | 0xb335 | 0xb336 | 0xb337 | 0xb338 | 0xb339 | 0xb33a | 0xb33b | 0xb33c | 0xb33d | 0xb33e | 0xb33f | 0xb340 | 0xb341 | 0xb342 | 0xb343 | 0xb344 | 0xb345 | 0xb346 | 0xb347 | 0xb348 | 0xb349 | 0xb34a | 0xb34b | 0xb34c | 0xb34d | 0xb34e | 0xb34f | 0xb350 | 0xb351 | 0xb352 | 0xb353 | 0xb354 | 0xb355 | 0xb356 | 0xb357 | 0xb358 | 0xb359 | 0xb35a | 0xb35b | 0xb35c | 0xb35d | 0xb35e | 0xb35f | 0xb360 | 0xb361 | 0xb362 | 0xb363 | 0xb364 | 0xb365 | 0xb366 | 0xb367 | 0xb368 | 0xb369 | 0xb36a | 0xb36b | 0xb36c | 0xb36d | 0xb36e | 0xb36f | 0xb370 | 0xb371 | 0xb372 | 0xb373 | 0xb374 | 0xb375 | 0xb376 | 0xb377 | 0xb378 | 0xb379 | 0xb37a | 0xb37b | 0xb37c | 0xb37d | 0xb37e | 0xb37f | 0xb380 | 0xb381 | 0xb382 | 0xb383 | 0xb384 | 0xb385 | 0xb386 | 0xb387 | 0xb388 | 0xb389 | 0xb38a | 0xb38b | 0xb38c | 0xb38d | 0xb38e | 0xb38f | 0xb390 | 0xb391 | 0xb392 | 0xb393 | 0xb394 | 0xb395 | 0xb396 | 0xb397 | 0xb398 | 0xb399 | 0xb39a | 0xb39b | 0xb39c | 0xb39d | 0xb39e | 0xb39f | 0xb3a0 | 0xb3a1 | 0xb3a2 | 0xb3a3 | 0xb3a4 | 0xb3a5 | 0xb3a6 | 0xb3a7 | 0xb3a8 | 0xb3a9 | 0xb3aa | 0xb3ab | 0xb3ac | 0xb3ad | 0xb3ae | 0xb3af | 0xb3b0 | 0xb3b1 | 0xb3b2 | 0xb3b3 | 0xb3b4 | 0xb3b5 | 0xb3b6 | 0xb3b7 | 0xb3b8 | 0xb3b9 | 0xb3ba | 0xb3bb | 0xb3bc | 0xb3bd | 0xb3be | 0xb3bf | 0xb3c0 | 0xb3c1 | 0xb3c2 | 0xb3c3 | 0xb3c4 | 0xb3c5 | 0xb3c6 | 0xb3c7 | 0xb3c8 | 0xb3c9 | 0xb3ca | 0xb3cb | 0xb3cc | 0xb3cd | 0xb3ce | 0xb3cf | 0xb3d0 | 0xb3d1 | 0xb3d2 | 0xb3d3 | 0xb3d4 | 0xb3d5 | 0xb3d6 | 0xb3d7 | 0xb3d8 | 0xb3d9 | 0xb3da | 0xb3db | 0xb3dc | 0xb3dd | 0xb3de | 0xb3df | 0xb3e0 | 0xb401 | 0xb402 } HashCode
           */

          /**
           * @type { Record<HashName,HashCode> }
           */
          const names = Object.freeze({
            identity: 0x00,
            sha1: 0x11,
            "sha2-256": 0x12,
            "sha2-512": 0x13,
            "sha3-512": 0x14,
            "sha3-384": 0x15,
            "sha3-256": 0x16,
            "sha3-224": 0x17,
            "shake-128": 0x18,
            "shake-256": 0x19,
            "keccak-224": 0x1a,
            "keccak-256": 0x1b,
            "keccak-384": 0x1c,
            "keccak-512": 0x1d,
            blake3: 0x1e,
            "murmur3-128": 0x22,
            "murmur3-32": 0x23,
            "dbl-sha2-256": 0x56,
            md4: 0xd4,
            md5: 0xd5,
            bmt: 0xd6,
            "sha2-256-trunc254-padded": 0x1012,
            "ripemd-128": 0x1052,
            "ripemd-160": 0x1053,
            "ripemd-256": 0x1054,
            "ripemd-320": 0x1055,
            x11: 0x1100,
            kangarootwelve: 0x1d01,
            "sm3-256": 0x534d,
            "blake2b-8": 0xb201,
            "blake2b-16": 0xb202,
            "blake2b-24": 0xb203,
            "blake2b-32": 0xb204,
            "blake2b-40": 0xb205,
            "blake2b-48": 0xb206,
            "blake2b-56": 0xb207,
            "blake2b-64": 0xb208,
            "blake2b-72": 0xb209,
            "blake2b-80": 0xb20a,
            "blake2b-88": 0xb20b,
            "blake2b-96": 0xb20c,
            "blake2b-104": 0xb20d,
            "blake2b-112": 0xb20e,
            "blake2b-120": 0xb20f,
            "blake2b-128": 0xb210,
            "blake2b-136": 0xb211,
            "blake2b-144": 0xb212,
            "blake2b-152": 0xb213,
            "blake2b-160": 0xb214,
            "blake2b-168": 0xb215,
            "blake2b-176": 0xb216,
            "blake2b-184": 0xb217,
            "blake2b-192": 0xb218,
            "blake2b-200": 0xb219,
            "blake2b-208": 0xb21a,
            "blake2b-216": 0xb21b,
            "blake2b-224": 0xb21c,
            "blake2b-232": 0xb21d,
            "blake2b-240": 0xb21e,
            "blake2b-248": 0xb21f,
            "blake2b-256": 0xb220,
            "blake2b-264": 0xb221,
            "blake2b-272": 0xb222,
            "blake2b-280": 0xb223,
            "blake2b-288": 0xb224,
            "blake2b-296": 0xb225,
            "blake2b-304": 0xb226,
            "blake2b-312": 0xb227,
            "blake2b-320": 0xb228,
            "blake2b-328": 0xb229,
            "blake2b-336": 0xb22a,
            "blake2b-344": 0xb22b,
            "blake2b-352": 0xb22c,
            "blake2b-360": 0xb22d,
            "blake2b-368": 0xb22e,
            "blake2b-376": 0xb22f,
            "blake2b-384": 0xb230,
            "blake2b-392": 0xb231,
            "blake2b-400": 0xb232,
            "blake2b-408": 0xb233,
            "blake2b-416": 0xb234,
            "blake2b-424": 0xb235,
            "blake2b-432": 0xb236,
            "blake2b-440": 0xb237,
            "blake2b-448": 0xb238,
            "blake2b-456": 0xb239,
            "blake2b-464": 0xb23a,
            "blake2b-472": 0xb23b,
            "blake2b-480": 0xb23c,
            "blake2b-488": 0xb23d,
            "blake2b-496": 0xb23e,
            "blake2b-504": 0xb23f,
            "blake2b-512": 0xb240,
            "blake2s-8": 0xb241,
            "blake2s-16": 0xb242,
            "blake2s-24": 0xb243,
            "blake2s-32": 0xb244,
            "blake2s-40": 0xb245,
            "blake2s-48": 0xb246,
            "blake2s-56": 0xb247,
            "blake2s-64": 0xb248,
            "blake2s-72": 0xb249,
            "blake2s-80": 0xb24a,
            "blake2s-88": 0xb24b,
            "blake2s-96": 0xb24c,
            "blake2s-104": 0xb24d,
            "blake2s-112": 0xb24e,
            "blake2s-120": 0xb24f,
            "blake2s-128": 0xb250,
            "blake2s-136": 0xb251,
            "blake2s-144": 0xb252,
            "blake2s-152": 0xb253,
            "blake2s-160": 0xb254,
            "blake2s-168": 0xb255,
            "blake2s-176": 0xb256,
            "blake2s-184": 0xb257,
            "blake2s-192": 0xb258,
            "blake2s-200": 0xb259,
            "blake2s-208": 0xb25a,
            "blake2s-216": 0xb25b,
            "blake2s-224": 0xb25c,
            "blake2s-232": 0xb25d,
            "blake2s-240": 0xb25e,
            "blake2s-248": 0xb25f,
            "blake2s-256": 0xb260,
            "skein256-8": 0xb301,
            "skein256-16": 0xb302,
            "skein256-24": 0xb303,
            "skein256-32": 0xb304,
            "skein256-40": 0xb305,
            "skein256-48": 0xb306,
            "skein256-56": 0xb307,
            "skein256-64": 0xb308,
            "skein256-72": 0xb309,
            "skein256-80": 0xb30a,
            "skein256-88": 0xb30b,
            "skein256-96": 0xb30c,
            "skein256-104": 0xb30d,
            "skein256-112": 0xb30e,
            "skein256-120": 0xb30f,
            "skein256-128": 0xb310,
            "skein256-136": 0xb311,
            "skein256-144": 0xb312,
            "skein256-152": 0xb313,
            "skein256-160": 0xb314,
            "skein256-168": 0xb315,
            "skein256-176": 0xb316,
            "skein256-184": 0xb317,
            "skein256-192": 0xb318,
            "skein256-200": 0xb319,
            "skein256-208": 0xb31a,
            "skein256-216": 0xb31b,
            "skein256-224": 0xb31c,
            "skein256-232": 0xb31d,
            "skein256-240": 0xb31e,
            "skein256-248": 0xb31f,
            "skein256-256": 0xb320,
            "skein512-8": 0xb321,
            "skein512-16": 0xb322,
            "skein512-24": 0xb323,
            "skein512-32": 0xb324,
            "skein512-40": 0xb325,
            "skein512-48": 0xb326,
            "skein512-56": 0xb327,
            "skein512-64": 0xb328,
            "skein512-72": 0xb329,
            "skein512-80": 0xb32a,
            "skein512-88": 0xb32b,
            "skein512-96": 0xb32c,
            "skein512-104": 0xb32d,
            "skein512-112": 0xb32e,
            "skein512-120": 0xb32f,
            "skein512-128": 0xb330,
            "skein512-136": 0xb331,
            "skein512-144": 0xb332,
            "skein512-152": 0xb333,
            "skein512-160": 0xb334,
            "skein512-168": 0xb335,
            "skein512-176": 0xb336,
            "skein512-184": 0xb337,
            "skein512-192": 0xb338,
            "skein512-200": 0xb339,
            "skein512-208": 0xb33a,
            "skein512-216": 0xb33b,
            "skein512-224": 0xb33c,
            "skein512-232": 0xb33d,
            "skein512-240": 0xb33e,
            "skein512-248": 0xb33f,
            "skein512-256": 0xb340,
            "skein512-264": 0xb341,
            "skein512-272": 0xb342,
            "skein512-280": 0xb343,
            "skein512-288": 0xb344,
            "skein512-296": 0xb345,
            "skein512-304": 0xb346,
            "skein512-312": 0xb347,
            "skein512-320": 0xb348,
            "skein512-328": 0xb349,
            "skein512-336": 0xb34a,
            "skein512-344": 0xb34b,
            "skein512-352": 0xb34c,
            "skein512-360": 0xb34d,
            "skein512-368": 0xb34e,
            "skein512-376": 0xb34f,
            "skein512-384": 0xb350,
            "skein512-392": 0xb351,
            "skein512-400": 0xb352,
            "skein512-408": 0xb353,
            "skein512-416": 0xb354,
            "skein512-424": 0xb355,
            "skein512-432": 0xb356,
            "skein512-440": 0xb357,
            "skein512-448": 0xb358,
            "skein512-456": 0xb359,
            "skein512-464": 0xb35a,
            "skein512-472": 0xb35b,
            "skein512-480": 0xb35c,
            "skein512-488": 0xb35d,
            "skein512-496": 0xb35e,
            "skein512-504": 0xb35f,
            "skein512-512": 0xb360,
            "skein1024-8": 0xb361,
            "skein1024-16": 0xb362,
            "skein1024-24": 0xb363,
            "skein1024-32": 0xb364,
            "skein1024-40": 0xb365,
            "skein1024-48": 0xb366,
            "skein1024-56": 0xb367,
            "skein1024-64": 0xb368,
            "skein1024-72": 0xb369,
            "skein1024-80": 0xb36a,
            "skein1024-88": 0xb36b,
            "skein1024-96": 0xb36c,
            "skein1024-104": 0xb36d,
            "skein1024-112": 0xb36e,
            "skein1024-120": 0xb36f,
            "skein1024-128": 0xb370,
            "skein1024-136": 0xb371,
            "skein1024-144": 0xb372,
            "skein1024-152": 0xb373,
            "skein1024-160": 0xb374,
            "skein1024-168": 0xb375,
            "skein1024-176": 0xb376,
            "skein1024-184": 0xb377,
            "skein1024-192": 0xb378,
            "skein1024-200": 0xb379,
            "skein1024-208": 0xb37a,
            "skein1024-216": 0xb37b,
            "skein1024-224": 0xb37c,
            "skein1024-232": 0xb37d,
            "skein1024-240": 0xb37e,
            "skein1024-248": 0xb37f,
            "skein1024-256": 0xb380,
            "skein1024-264": 0xb381,
            "skein1024-272": 0xb382,
            "skein1024-280": 0xb383,
            "skein1024-288": 0xb384,
            "skein1024-296": 0xb385,
            "skein1024-304": 0xb386,
            "skein1024-312": 0xb387,
            "skein1024-320": 0xb388,
            "skein1024-328": 0xb389,
            "skein1024-336": 0xb38a,
            "skein1024-344": 0xb38b,
            "skein1024-352": 0xb38c,
            "skein1024-360": 0xb38d,
            "skein1024-368": 0xb38e,
            "skein1024-376": 0xb38f,
            "skein1024-384": 0xb390,
            "skein1024-392": 0xb391,
            "skein1024-400": 0xb392,
            "skein1024-408": 0xb393,
            "skein1024-416": 0xb394,
            "skein1024-424": 0xb395,
            "skein1024-432": 0xb396,
            "skein1024-440": 0xb397,
            "skein1024-448": 0xb398,
            "skein1024-456": 0xb399,
            "skein1024-464": 0xb39a,
            "skein1024-472": 0xb39b,
            "skein1024-480": 0xb39c,
            "skein1024-488": 0xb39d,
            "skein1024-496": 0xb39e,
            "skein1024-504": 0xb39f,
            "skein1024-512": 0xb3a0,
            "skein1024-520": 0xb3a1,
            "skein1024-528": 0xb3a2,
            "skein1024-536": 0xb3a3,
            "skein1024-544": 0xb3a4,
            "skein1024-552": 0xb3a5,
            "skein1024-560": 0xb3a6,
            "skein1024-568": 0xb3a7,
            "skein1024-576": 0xb3a8,
            "skein1024-584": 0xb3a9,
            "skein1024-592": 0xb3aa,
            "skein1024-600": 0xb3ab,
            "skein1024-608": 0xb3ac,
            "skein1024-616": 0xb3ad,
            "skein1024-624": 0xb3ae,
            "skein1024-632": 0xb3af,
            "skein1024-640": 0xb3b0,
            "skein1024-648": 0xb3b1,
            "skein1024-656": 0xb3b2,
            "skein1024-664": 0xb3b3,
            "skein1024-672": 0xb3b4,
            "skein1024-680": 0xb3b5,
            "skein1024-688": 0xb3b6,
            "skein1024-696": 0xb3b7,
            "skein1024-704": 0xb3b8,
            "skein1024-712": 0xb3b9,
            "skein1024-720": 0xb3ba,
            "skein1024-728": 0xb3bb,
            "skein1024-736": 0xb3bc,
            "skein1024-744": 0xb3bd,
            "skein1024-752": 0xb3be,
            "skein1024-760": 0xb3bf,
            "skein1024-768": 0xb3c0,
            "skein1024-776": 0xb3c1,
            "skein1024-784": 0xb3c2,
            "skein1024-792": 0xb3c3,
            "skein1024-800": 0xb3c4,
            "skein1024-808": 0xb3c5,
            "skein1024-816": 0xb3c6,
            "skein1024-824": 0xb3c7,
            "skein1024-832": 0xb3c8,
            "skein1024-840": 0xb3c9,
            "skein1024-848": 0xb3ca,
            "skein1024-856": 0xb3cb,
            "skein1024-864": 0xb3cc,
            "skein1024-872": 0xb3cd,
            "skein1024-880": 0xb3ce,
            "skein1024-888": 0xb3cf,
            "skein1024-896": 0xb3d0,
            "skein1024-904": 0xb3d1,
            "skein1024-912": 0xb3d2,
            "skein1024-920": 0xb3d3,
            "skein1024-928": 0xb3d4,
            "skein1024-936": 0xb3d5,
            "skein1024-944": 0xb3d6,
            "skein1024-952": 0xb3d7,
            "skein1024-960": 0xb3d8,
            "skein1024-968": 0xb3d9,
            "skein1024-976": 0xb3da,
            "skein1024-984": 0xb3db,
            "skein1024-992": 0xb3dc,
            "skein1024-1000": 0xb3dd,
            "skein1024-1008": 0xb3de,
            "skein1024-1016": 0xb3df,
            "skein1024-1024": 0xb3e0,
            "poseidon-bls12_381-a2-fc1": 0xb401,
            "poseidon-bls12_381-a2-fc1-sc": 0xb402,
          });

          module.exports = { names };
        },
        {},
      ],
      125: [
        function (require, module, exports) {
          /**
           * Multihash implementation in JavaScript.
           */
          "use strict";

          const multibase = require("multibase");
          const varint = require("varint");
          const { names } = require("./constants");
          const {
            toString: uint8ArrayToString,
          } = require("uint8arrays/to-string");
          const {
            fromString: uint8ArrayFromString,
          } = require("uint8arrays/from-string");
          const { concat: uint8ArrayConcat } = require("uint8arrays/concat");

          const codes = /** @type {import('./types').CodeNameMap} */ ({});

          // eslint-disable-next-line guard-for-in
          for (const key in names) {
            const name = /** @type {HashName} */ (key);
            codes[names[name]] = name;
          }
          Object.freeze(codes);

          /**
           * Convert the given multihash to a hex encoded string.
           *
           * @param {Uint8Array} hash
           * @returns {string}
           */
          function toHexString(hash) {
            if (!(hash instanceof Uint8Array)) {
              throw new Error("must be passed a Uint8Array");
            }

            return uint8ArrayToString(hash, "base16");
          }

          /**
           * Convert the given hex encoded string to a multihash.
           *
           * @param {string} hash
           * @returns {Uint8Array}
           */
          function fromHexString(hash) {
            return uint8ArrayFromString(hash, "base16");
          }

          /**
           * Convert the given multihash to a base58 encoded string.
           *
           * @param {Uint8Array} hash
           * @returns {string}
           */
          function toB58String(hash) {
            if (!(hash instanceof Uint8Array)) {
              throw new Error("must be passed a Uint8Array");
            }

            return uint8ArrayToString(
              multibase.encode("base58btc", hash)
            ).slice(1);
          }

          /**
           * Convert the given base58 encoded string to a multihash.
           *
           * @param {string|Uint8Array} hash
           * @returns {Uint8Array}
           */
          function fromB58String(hash) {
            const encoded =
              hash instanceof Uint8Array ? uint8ArrayToString(hash) : hash;

            return multibase.decode("z" + encoded);
          }

          /**
           * Decode a hash from the given multihash.
           *
           * @param {Uint8Array} bytes
           * @returns {{code: HashCode, name: HashName, length: number, digest: Uint8Array}} result
           */
          function decode(bytes) {
            if (!(bytes instanceof Uint8Array)) {
              throw new Error("multihash must be a Uint8Array");
            }

            if (bytes.length < 2) {
              throw new Error("multihash too short. must be > 2 bytes.");
            }

            const code = /** @type {HashCode} */ (varint.decode(bytes));
            if (!isValidCode(code)) {
              throw new Error(
                `multihash unknown function code: 0x${code.toString(16)}`
              );
            }
            bytes = bytes.slice(varint.decode.bytes);

            const len = varint.decode(bytes);
            if (len < 0) {
              throw new Error(`multihash invalid length: ${len}`);
            }
            bytes = bytes.slice(varint.decode.bytes);

            if (bytes.length !== len) {
              throw new Error(
                `multihash length inconsistent: 0x${uint8ArrayToString(
                  bytes,
                  "base16"
                )}`
              );
            }

            return {
              code,
              name: codes[code],
              length: len,
              digest: bytes,
            };
          }

          /**
           * Encode a hash digest along with the specified function code.
           *
           * > **Note:** the length is derived from the length of the digest itself.
           *
           * @param {Uint8Array} digest
           * @param {HashName | HashCode} code
           * @param {number} [length]
           * @returns {Uint8Array}
           */
          function encode(digest, code, length) {
            if (!digest || code === undefined) {
              throw new Error(
                "multihash encode requires at least two args: digest, code"
              );
            }

            // ensure it's a hashfunction code.
            const hashfn = coerceCode(code);

            if (!(digest instanceof Uint8Array)) {
              throw new Error("digest should be a Uint8Array");
            }

            if (length == null) {
              length = digest.length;
            }

            if (length && digest.length !== length) {
              throw new Error(
                "digest length should be equal to specified length."
              );
            }

            const hash = varint.encode(hashfn);
            const len = varint.encode(length);
            return uint8ArrayConcat(
              [hash, len, digest],
              hash.length + len.length + digest.length
            );
          }

          /**
           * Converts a hash function name into the matching code.
           * If passed a number it will return the number if it's a valid code.
           *
           * @param {HashName | number} name
           * @returns {number}
           */
          function coerceCode(name) {
            let code = name;

            if (typeof name === "string") {
              if (names[name] === undefined) {
                throw new Error(`Unrecognized hash function named: ${name}`);
              }
              code = names[name];
            }

            if (typeof code !== "number") {
              throw new Error(
                `Hash function code should be a number. Got: ${code}`
              );
            }

            // @ts-ignore
            if (codes[code] === undefined && !isAppCode(code)) {
              throw new Error(`Unrecognized function code: ${code}`);
            }

            return code;
          }

          /**
           * Checks if a code is part of the app range
           *
           * @param {number} code
           * @returns {boolean}
           */
          function isAppCode(code) {
            return code > 0 && code < 0x10;
          }

          /**
           * Checks whether a multihash code is valid.
           *
           * @param {HashCode} code
           * @returns {boolean}
           */
          function isValidCode(code) {
            if (isAppCode(code)) {
              return true;
            }

            if (codes[code]) {
              return true;
            }

            return false;
          }

          /**
           * Check if the given buffer is a valid multihash. Throws an error if it is not valid.
           *
           * @param {Uint8Array} multihash
           * @returns {void}
           * @throws {Error}
           */
          function validate(multihash) {
            decode(multihash); // throws if bad.
          }

          /**
           * Returns a prefix from a valid multihash. Throws an error if it is not valid.
           *
           * @param {Uint8Array} multihash
           * @returns {Uint8Array}
           * @throws {Error}
           */
          function prefix(multihash) {
            validate(multihash);

            return multihash.subarray(0, 2);
          }

          module.exports = {
            names,
            codes,
            toHexString,
            fromHexString,
            toB58String,
            fromB58String,
            decode,
            encode,
            coerceCode,
            isAppCode,
            validate,
            prefix,
            isValidCode,
          };

          /**
           * @typedef { import("./constants").HashCode } HashCode
           * @typedef { import("./constants").HashName } HashName
           */
        },
        {
          "./constants": 124,
          multibase: 77,
          "uint8arrays/concat": 115,
          "uint8arrays/from-string": 116,
          "uint8arrays/to-string": 117,
          varint: 122,
        },
      ],
      126: [
        function (require, module, exports) {
          arguments[4][16][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 129, dup: 16 },
      ],
      127: [
        function (require, module, exports) {
          arguments[4][18][0].apply(exports, arguments);
        },
        { dup: 18 },
      ],
      128: [
        function (require, module, exports) {
          arguments[4][27][0].apply(exports, arguments);
        },
        { "./util/as-uint8array.js": 129, "./util/bases.js": 130, dup: 27 },
      ],
      129: [
        function (require, module, exports) {
          arguments[4][20][0].apply(exports, arguments);
        },
        { dup: 20 },
      ],
      130: [
        function (require, module, exports) {
          arguments[4][21][0].apply(exports, arguments);
        },
        { "../alloc.js": 126, dup: 21, "multiformats/basics": 101 },
      ],
      131: [
        function (require, module, exports) {
          "use strict";

          // @ts-ignore - no types available
          const blake = require("blakejs");

          const minB = 0xb201;
          const minS = 0xb241;

          const blake2b = {
            init: blake.blake2bInit,
            update: blake.blake2bUpdate,
            digest: blake.blake2bFinal,
          };

          const blake2s = {
            init: blake.blake2sInit,
            update: blake.blake2sUpdate,
            digest: blake.blake2sFinal,
          };

          // Note that although this function doesn't do any asynchronous work, we mark
          // the function as async because it must return a Promise to match the API
          // for other functions that do perform asynchronous work (see sha.browser.js)
          // eslint-disable-next-line

          /**
           * @param {number} size
           * @param {any} hf
           * @returns {import('./types').Digest}
           */
          const makeB2Hash = (size, hf) => async (data) => {
            const ctx = hf.init(size, null);
            hf.update(ctx, data);
            return hf.digest(ctx);
          };

          /**
           * @param {Record<number, import('./types').Digest>} table
           */
          module.exports = (table) => {
            for (let i = 0; i < 64; i++) {
              table[minB + i] = makeB2Hash(i + 1, blake2b);
            }
            for (let i = 0; i < 32; i++) {
              table[minS + i] = makeB2Hash(i + 1, blake2s);
            }
          };
        },
        { blakejs: 14 },
      ],
      132: [
        function (require, module, exports) {
          "use strict";

          const sha3 = require("js-sha3");
          // @ts-ignore - no types available
          const mur = require("murmurhash3js-revisited");
          const { factory: sha } = require("./sha");
          const { fromNumberTo32BitBuf } = require("./utils");
          const {
            fromString: uint8ArrayFromString,
          } = require("uint8arrays/from-string");

          // Note that although this function doesn't do any asynchronous work, we mark
          // the function as async because it must return a Promise to match the API
          // for other functions that do perform asynchronous work (see sha.browser.js)
          // eslint-disable-next-line
          /**
           * @param {string} algorithm
           * @returns {import('./types').Digest}
           */
          const hash = (algorithm) => async (data) => {
            switch (algorithm) {
              case "sha3-224":
                return new Uint8Array(sha3.sha3_224.arrayBuffer(data));
              case "sha3-256":
                return new Uint8Array(sha3.sha3_256.arrayBuffer(data));
              case "sha3-384":
                return new Uint8Array(sha3.sha3_384.arrayBuffer(data));
              case "sha3-512":
                return new Uint8Array(sha3.sha3_512.arrayBuffer(data));
              case "shake-128":
                return new Uint8Array(
                  sha3.shake128.create(128).update(data).arrayBuffer()
                );
              case "shake-256":
                return new Uint8Array(
                  sha3.shake256.create(256).update(data).arrayBuffer()
                );
              case "keccak-224":
                return new Uint8Array(sha3.keccak224.arrayBuffer(data));
              case "keccak-256":
                return new Uint8Array(sha3.keccak256.arrayBuffer(data));
              case "keccak-384":
                return new Uint8Array(sha3.keccak384.arrayBuffer(data));
              case "keccak-512":
                return new Uint8Array(sha3.keccak512.arrayBuffer(data));
              case "murmur3-128":
                return uint8ArrayFromString(mur.x64.hash128(data), "base16");
              case "murmur3-32":
                return fromNumberTo32BitBuf(mur.x86.hash32(data));

              default:
                throw new TypeError(
                  `${algorithm} is not a supported algorithm`
                );
            }
          };

          /** @type {import('./types').Digest} */
          const identity = (data) => data;

          module.exports = {
            identity,
            sha1: sha("sha1"),
            sha2256: sha("sha2-256"),
            sha2512: sha("sha2-512"),
            dblSha2256: sha("dbl-sha2-256"),
            sha3224: hash("sha3-224"),
            sha3256: hash("sha3-256"),
            sha3384: hash("sha3-384"),
            sha3512: hash("sha3-512"),
            shake128: hash("shake-128"),
            shake256: hash("shake-256"),
            keccak224: hash("keccak-224"),
            keccak256: hash("keccak-256"),
            keccak384: hash("keccak-384"),
            keccak512: hash("keccak-512"),
            murmur3128: hash("murmur3-128"),
            murmur332: hash("murmur3-32"),
            addBlake: require("./blake"),
          };
        },
        {
          "./blake": 131,
          "./sha": 134,
          "./utils": 135,
          "js-sha3": 73,
          "murmurhash3js-revisited": 136,
          "uint8arrays/from-string": 128,
        },
      ],
      133: [
        function (require, module, exports) {
          "use strict";

          const errcode = require("err-code");
          const multihash = require("multihashes");
          const crypto = require("./crypto");
          const { equals } = require("uint8arrays/equals");

          /**
           * @typedef {import("./types").Digest} Digest
           * @typedef {import("multihashes").HashName} HashName
           */

          /**
           * Hash the given `bytes` using the algorithm specified by `alg`.
           *
           * @param {Uint8Array} bytes - The value to hash.
           * @param {HashName} alg - The algorithm to use eg 'sha1'
           * @param {number} [length] - Optionally trim the result to this length.
           * @returns {Promise<Uint8Array>}
           */
          async function Multihashing(bytes, alg, length) {
            const digest = await Multihashing.digest(bytes, alg, length);
            return multihash.encode(digest, alg, length);
          }

          /**
           * Expose multihash itself, to avoid silly double requires.
           */
          Multihashing.multihash = multihash;

          /**
           * @param {Uint8Array} bytes - The value to hash.
           * @param {HashName} alg - The algorithm to use eg 'sha1'
           * @param {number} [length] - Optionally trim the result to this length.
           * @returns {Promise<Uint8Array>}
           */
          Multihashing.digest = async (bytes, alg, length) => {
            const hash = Multihashing.createHash(alg);
            const digest = await hash(bytes);
            return length ? digest.slice(0, length) : digest;
          };

          /**
           * Creates a function that hashes with the given algorithm
           *
           * @param {HashName} alg - The algorithm to use eg 'sha1'
           * @returns {Digest} - The hash function corresponding to `alg`
           */
          Multihashing.createHash = function (alg) {
            if (!alg) {
              const e = errcode(
                new Error("hash algorithm must be specified"),
                "ERR_HASH_ALGORITHM_NOT_SPECIFIED"
              );
              throw e;
            }

            const code = multihash.coerceCode(alg);
            if (!Multihashing.functions[code]) {
              throw errcode(
                new Error(`multihash function '${alg}' not yet supported`),
                "ERR_HASH_ALGORITHM_NOT_SUPPORTED"
              );
            }

            return Multihashing.functions[code];
          };

          /**
           * Mapping of multihash codes to their hashing functions.
           *
           * @type {Record<number, Digest>}
           */
          // @ts-ignore - most of those functions aren't typed
          Multihashing.functions = {
            // identity
            0x00: crypto.identity,
            // sha1
            0x11: crypto.sha1,
            // sha2-256
            0x12: crypto.sha2256,
            // sha2-512
            0x13: crypto.sha2512,
            // sha3-512
            0x14: crypto.sha3512,
            // sha3-384
            0x15: crypto.sha3384,
            // sha3-256
            0x16: crypto.sha3256,
            // sha3-224
            0x17: crypto.sha3224,
            // shake-128
            0x18: crypto.shake128,
            // shake-256
            0x19: crypto.shake256,
            // keccak-224
            0x1a: crypto.keccak224,
            // keccak-256
            0x1b: crypto.keccak256,
            // keccak-384
            0x1c: crypto.keccak384,
            // keccak-512
            0x1d: crypto.keccak512,
            // murmur3-128
            0x22: crypto.murmur3128,
            // murmur3-32
            0x23: crypto.murmur332,
            // dbl-sha2-256
            0x56: crypto.dblSha2256,
          };

          // add blake functions
          crypto.addBlake(Multihashing.functions);

          /**
           * @param {Uint8Array} bytes
           * @param {Uint8Array} hash
           * @returns {Promise<boolean>}
           */
          Multihashing.validate = async (bytes, hash) => {
            const newHash = await Multihashing(
              bytes,
              multihash.decode(hash).name
            );

            return equals(hash, newHash);
          };

          module.exports = Multihashing;
        },
        {
          "./crypto": 132,
          "err-code": 24,
          multihashes: 125,
          "uint8arrays/equals": 127,
        },
      ],
      134: [
        function (require, module, exports) {
          /* eslint-disable require-await */
          "use strict";

          const multihash = require("multihashes");
          /**
           * @typedef {import('multihashes').HashName} HashName
           * @typedef {import('./types').Digest} Digest
           */

          /**
           * @type {Crypto}
           */
          const crypto =
            self.crypto ||
            /** @type {typeof window.crypto} */
            // @ts-ignore - unknown property
            (self.msCrypto);

          /**
           *
           * @param {Uint8Array} data
           * @param {HashName} alg
           * @returns {Promise<Uint8Array>}
           */
          const digest = async (data, alg) => {
            if (typeof self === "undefined" || !crypto) {
              throw new Error(
                "Please use a browser with webcrypto support and ensure the code has been delivered securely via HTTPS/TLS and run within a Secure Context"
              );
            }
            switch (alg) {
              case "sha1":
                return new Uint8Array(
                  await crypto.subtle.digest({ name: "SHA-1" }, data)
                );
              case "sha2-256":
                return new Uint8Array(
                  await crypto.subtle.digest({ name: "SHA-256" }, data)
                );
              case "sha2-512":
                return new Uint8Array(
                  await crypto.subtle.digest({ name: "SHA-512" }, data)
                );
              case "dbl-sha2-256": {
                const d = await crypto.subtle.digest({ name: "SHA-256" }, data);
                return new Uint8Array(
                  await crypto.subtle.digest({ name: "SHA-256" }, d)
                );
              }
              default:
                throw new Error(`${alg} is not a supported algorithm`);
            }
          };

          module.exports = {
            /**
             * @param {HashName} alg
             * @returns {Digest}
             */
            factory: (alg) => async (data) => {
              return digest(data, alg);
            },
            digest,
            /**
             * @param {Uint8Array} buf
             * @param {HashName} alg
             * @param {number} [length]
             */
            multihashing: async (buf, alg, length) => {
              const h = await digest(buf, alg);
              return multihash.encode(h, alg, length);
            },
          };
        },
        { multihashes: 125 },
      ],
      135: [
        function (require, module, exports) {
          "use strict";

          /**
           * @param {number} number
           * @returns {Uint8Array}
           */
          const fromNumberTo32BitBuf = (number) => {
            const bytes = new Uint8Array(4);

            for (let i = 0; i < 4; i++) {
              bytes[i] = number & 0xff;
              number = number >> 8;
            }

            return bytes;
          };

          module.exports = {
            fromNumberTo32BitBuf,
          };
        },
        {},
      ],
      136: [
        function (require, module, exports) {
          module.exports = require("./lib/murmurHash3js");
        },
        { "./lib/murmurHash3js": 137 },
      ],
      137: [
        function (require, module, exports) {
          /* jshint -W086: true */
          // +----------------------------------------------------------------------+
          // | murmurHash3js.js v3.0.1 // https://github.com/pid/murmurHash3js
          // | A javascript implementation of MurmurHash3's x86 hashing algorithms. |
          // |----------------------------------------------------------------------|
          // | Copyright (c) 2012-2015 Karan Lyons                                       |
          // | https://github.com/karanlyons/murmurHash3.js/blob/c1778f75792abef7bdd74bc85d2d4e1a3d25cfe9/murmurHash3.js |
          // | Freely distributable under the MIT license.                          |
          // +----------------------------------------------------------------------+

          (function (root, undefined) {
            "use strict";

            // Create a local object that'll be exported or referenced globally.
            var library = {
              version: "3.0.0",
              x86: {},
              x64: {},
              inputValidation: true,
            };

            // PRIVATE FUNCTIONS
            // -----------------

            function _validBytes(bytes) {
              // check the input is an array or a typed array
              if (!Array.isArray(bytes) && !ArrayBuffer.isView(bytes)) {
                return false;
              }

              // check all bytes are actually bytes
              for (var i = 0; i < bytes.length; i++) {
                if (
                  !Number.isInteger(bytes[i]) ||
                  bytes[i] < 0 ||
                  bytes[i] > 255
                ) {
                  return false;
                }
              }
              return true;
            }

            function _x86Multiply(m, n) {
              //
              // Given two 32bit ints, returns the two multiplied together as a
              // 32bit int.
              //

              return (m & 0xffff) * n + ((((m >>> 16) * n) & 0xffff) << 16);
            }

            function _x86Rotl(m, n) {
              //
              // Given a 32bit int and an int representing a number of bit positions,
              // returns the 32bit int rotated left by that number of positions.
              //

              return (m << n) | (m >>> (32 - n));
            }

            function _x86Fmix(h) {
              //
              // Given a block, returns murmurHash3's final x86 mix of that block.
              //

              h ^= h >>> 16;
              h = _x86Multiply(h, 0x85ebca6b);
              h ^= h >>> 13;
              h = _x86Multiply(h, 0xc2b2ae35);
              h ^= h >>> 16;

              return h;
            }

            function _x64Add(m, n) {
              //
              // Given two 64bit ints (as an array of two 32bit ints) returns the two
              // added together as a 64bit int (as an array of two 32bit ints).
              //

              m = [m[0] >>> 16, m[0] & 0xffff, m[1] >>> 16, m[1] & 0xffff];
              n = [n[0] >>> 16, n[0] & 0xffff, n[1] >>> 16, n[1] & 0xffff];
              var o = [0, 0, 0, 0];

              o[3] += m[3] + n[3];
              o[2] += o[3] >>> 16;
              o[3] &= 0xffff;

              o[2] += m[2] + n[2];
              o[1] += o[2] >>> 16;
              o[2] &= 0xffff;

              o[1] += m[1] + n[1];
              o[0] += o[1] >>> 16;
              o[1] &= 0xffff;

              o[0] += m[0] + n[0];
              o[0] &= 0xffff;

              return [(o[0] << 16) | o[1], (o[2] << 16) | o[3]];
            }

            function _x64Multiply(m, n) {
              //
              // Given two 64bit ints (as an array of two 32bit ints) returns the two
              // multiplied together as a 64bit int (as an array of two 32bit ints).
              //

              m = [m[0] >>> 16, m[0] & 0xffff, m[1] >>> 16, m[1] & 0xffff];
              n = [n[0] >>> 16, n[0] & 0xffff, n[1] >>> 16, n[1] & 0xffff];
              var o = [0, 0, 0, 0];

              o[3] += m[3] * n[3];
              o[2] += o[3] >>> 16;
              o[3] &= 0xffff;

              o[2] += m[2] * n[3];
              o[1] += o[2] >>> 16;
              o[2] &= 0xffff;

              o[2] += m[3] * n[2];
              o[1] += o[2] >>> 16;
              o[2] &= 0xffff;

              o[1] += m[1] * n[3];
              o[0] += o[1] >>> 16;
              o[1] &= 0xffff;

              o[1] += m[2] * n[2];
              o[0] += o[1] >>> 16;
              o[1] &= 0xffff;

              o[1] += m[3] * n[1];
              o[0] += o[1] >>> 16;
              o[1] &= 0xffff;

              o[0] += m[0] * n[3] + m[1] * n[2] + m[2] * n[1] + m[3] * n[0];
              o[0] &= 0xffff;

              return [(o[0] << 16) | o[1], (o[2] << 16) | o[3]];
            }

            function _x64Rotl(m, n) {
              //
              // Given a 64bit int (as an array of two 32bit ints) and an int
              // representing a number of bit positions, returns the 64bit int (as an
              // array of two 32bit ints) rotated left by that number of positions.
              //

              n %= 64;

              if (n === 32) {
                return [m[1], m[0]];
              } else if (n < 32) {
                return [
                  (m[0] << n) | (m[1] >>> (32 - n)),
                  (m[1] << n) | (m[0] >>> (32 - n)),
                ];
              } else {
                n -= 32;
                return [
                  (m[1] << n) | (m[0] >>> (32 - n)),
                  (m[0] << n) | (m[1] >>> (32 - n)),
                ];
              }
            }

            function _x64LeftShift(m, n) {
              //
              // Given a 64bit int (as an array of two 32bit ints) and an int
              // representing a number of bit positions, returns the 64bit int (as an
              // array of two 32bit ints) shifted left by that number of positions.
              //

              n %= 64;

              if (n === 0) {
                return m;
              } else if (n < 32) {
                return [(m[0] << n) | (m[1] >>> (32 - n)), m[1] << n];
              } else {
                return [m[1] << (n - 32), 0];
              }
            }

            function _x64Xor(m, n) {
              //
              // Given two 64bit ints (as an array of two 32bit ints) returns the two
              // xored together as a 64bit int (as an array of two 32bit ints).
              //

              return [m[0] ^ n[0], m[1] ^ n[1]];
            }

            function _x64Fmix(h) {
              //
              // Given a block, returns murmurHash3's final x64 mix of that block.
              // (`[0, h[0] >>> 1]` is a 33 bit unsigned right shift. This is the
              // only place where we need to right shift 64bit ints.)
              //

              h = _x64Xor(h, [0, h[0] >>> 1]);
              h = _x64Multiply(h, [0xff51afd7, 0xed558ccd]);
              h = _x64Xor(h, [0, h[0] >>> 1]);
              h = _x64Multiply(h, [0xc4ceb9fe, 0x1a85ec53]);
              h = _x64Xor(h, [0, h[0] >>> 1]);

              return h;
            }

            // PUBLIC FUNCTIONS
            // ----------------

            library.x86.hash32 = function (bytes, seed) {
              //
              // Given a string and an optional seed as an int, returns a 32 bit hash
              // using the x86 flavor of MurmurHash3, as an unsigned int.
              //
              if (library.inputValidation && !_validBytes(bytes)) {
                return undefined;
              }
              seed = seed || 0;

              var remainder = bytes.length % 4;
              var blocks = bytes.length - remainder;

              var h1 = seed;

              var k1 = 0;

              var c1 = 0xcc9e2d51;
              var c2 = 0x1b873593;

              for (var i = 0; i < blocks; i = i + 4) {
                k1 =
                  bytes[i] |
                  (bytes[i + 1] << 8) |
                  (bytes[i + 2] << 16) |
                  (bytes[i + 3] << 24);

                k1 = _x86Multiply(k1, c1);
                k1 = _x86Rotl(k1, 15);
                k1 = _x86Multiply(k1, c2);

                h1 ^= k1;
                h1 = _x86Rotl(h1, 13);
                h1 = _x86Multiply(h1, 5) + 0xe6546b64;
              }

              k1 = 0;

              switch (remainder) {
                case 3:
                  k1 ^= bytes[i + 2] << 16;

                case 2:
                  k1 ^= bytes[i + 1] << 8;

                case 1:
                  k1 ^= bytes[i];
                  k1 = _x86Multiply(k1, c1);
                  k1 = _x86Rotl(k1, 15);
                  k1 = _x86Multiply(k1, c2);
                  h1 ^= k1;
              }

              h1 ^= bytes.length;
              h1 = _x86Fmix(h1);

              return h1 >>> 0;
            };

            library.x86.hash128 = function (bytes, seed) {
              //
              // Given a string and an optional seed as an int, returns a 128 bit
              // hash using the x86 flavor of MurmurHash3, as an unsigned hex.
              //
              if (library.inputValidation && !_validBytes(bytes)) {
                return undefined;
              }

              seed = seed || 0;
              var remainder = bytes.length % 16;
              var blocks = bytes.length - remainder;

              var h1 = seed;
              var h2 = seed;
              var h3 = seed;
              var h4 = seed;

              var k1 = 0;
              var k2 = 0;
              var k3 = 0;
              var k4 = 0;

              var c1 = 0x239b961b;
              var c2 = 0xab0e9789;
              var c3 = 0x38b34ae5;
              var c4 = 0xa1e38b93;

              for (var i = 0; i < blocks; i = i + 16) {
                k1 =
                  bytes[i] |
                  (bytes[i + 1] << 8) |
                  (bytes[i + 2] << 16) |
                  (bytes[i + 3] << 24);
                k2 =
                  bytes[i + 4] |
                  (bytes[i + 5] << 8) |
                  (bytes[i + 6] << 16) |
                  (bytes[i + 7] << 24);
                k3 =
                  bytes[i + 8] |
                  (bytes[i + 9] << 8) |
                  (bytes[i + 10] << 16) |
                  (bytes[i + 11] << 24);
                k4 =
                  bytes[i + 12] |
                  (bytes[i + 13] << 8) |
                  (bytes[i + 14] << 16) |
                  (bytes[i + 15] << 24);

                k1 = _x86Multiply(k1, c1);
                k1 = _x86Rotl(k1, 15);
                k1 = _x86Multiply(k1, c2);
                h1 ^= k1;

                h1 = _x86Rotl(h1, 19);
                h1 += h2;
                h1 = _x86Multiply(h1, 5) + 0x561ccd1b;

                k2 = _x86Multiply(k2, c2);
                k2 = _x86Rotl(k2, 16);
                k2 = _x86Multiply(k2, c3);
                h2 ^= k2;

                h2 = _x86Rotl(h2, 17);
                h2 += h3;
                h2 = _x86Multiply(h2, 5) + 0x0bcaa747;

                k3 = _x86Multiply(k3, c3);
                k3 = _x86Rotl(k3, 17);
                k3 = _x86Multiply(k3, c4);
                h3 ^= k3;

                h3 = _x86Rotl(h3, 15);
                h3 += h4;
                h3 = _x86Multiply(h3, 5) + 0x96cd1c35;

                k4 = _x86Multiply(k4, c4);
                k4 = _x86Rotl(k4, 18);
                k4 = _x86Multiply(k4, c1);
                h4 ^= k4;

                h4 = _x86Rotl(h4, 13);
                h4 += h1;
                h4 = _x86Multiply(h4, 5) + 0x32ac3b17;
              }

              k1 = 0;
              k2 = 0;
              k3 = 0;
              k4 = 0;

              switch (remainder) {
                case 15:
                  k4 ^= bytes[i + 14] << 16;

                case 14:
                  k4 ^= bytes[i + 13] << 8;

                case 13:
                  k4 ^= bytes[i + 12];
                  k4 = _x86Multiply(k4, c4);
                  k4 = _x86Rotl(k4, 18);
                  k4 = _x86Multiply(k4, c1);
                  h4 ^= k4;

                case 12:
                  k3 ^= bytes[i + 11] << 24;

                case 11:
                  k3 ^= bytes[i + 10] << 16;

                case 10:
                  k3 ^= bytes[i + 9] << 8;

                case 9:
                  k3 ^= bytes[i + 8];
                  k3 = _x86Multiply(k3, c3);
                  k3 = _x86Rotl(k3, 17);
                  k3 = _x86Multiply(k3, c4);
                  h3 ^= k3;

                case 8:
                  k2 ^= bytes[i + 7] << 24;

                case 7:
                  k2 ^= bytes[i + 6] << 16;

                case 6:
                  k2 ^= bytes[i + 5] << 8;

                case 5:
                  k2 ^= bytes[i + 4];
                  k2 = _x86Multiply(k2, c2);
                  k2 = _x86Rotl(k2, 16);
                  k2 = _x86Multiply(k2, c3);
                  h2 ^= k2;

                case 4:
                  k1 ^= bytes[i + 3] << 24;

                case 3:
                  k1 ^= bytes[i + 2] << 16;

                case 2:
                  k1 ^= bytes[i + 1] << 8;

                case 1:
                  k1 ^= bytes[i];
                  k1 = _x86Multiply(k1, c1);
                  k1 = _x86Rotl(k1, 15);
                  k1 = _x86Multiply(k1, c2);
                  h1 ^= k1;
              }

              h1 ^= bytes.length;
              h2 ^= bytes.length;
              h3 ^= bytes.length;
              h4 ^= bytes.length;

              h1 += h2;
              h1 += h3;
              h1 += h4;
              h2 += h1;
              h3 += h1;
              h4 += h1;

              h1 = _x86Fmix(h1);
              h2 = _x86Fmix(h2);
              h3 = _x86Fmix(h3);
              h4 = _x86Fmix(h4);

              h1 += h2;
              h1 += h3;
              h1 += h4;
              h2 += h1;
              h3 += h1;
              h4 += h1;

              return (
                ("00000000" + (h1 >>> 0).toString(16)).slice(-8) +
                ("00000000" + (h2 >>> 0).toString(16)).slice(-8) +
                ("00000000" + (h3 >>> 0).toString(16)).slice(-8) +
                ("00000000" + (h4 >>> 0).toString(16)).slice(-8)
              );
            };

            library.x64.hash128 = function (bytes, seed) {
              //
              // Given a string and an optional seed as an int, returns a 128 bit
              // hash using the x64 flavor of MurmurHash3, as an unsigned hex.
              //
              if (library.inputValidation && !_validBytes(bytes)) {
                return undefined;
              }
              seed = seed || 0;

              var remainder = bytes.length % 16;
              var blocks = bytes.length - remainder;

              var h1 = [0, seed];
              var h2 = [0, seed];

              var k1 = [0, 0];
              var k2 = [0, 0];

              var c1 = [0x87c37b91, 0x114253d5];
              var c2 = [0x4cf5ad43, 0x2745937f];

              for (var i = 0; i < blocks; i = i + 16) {
                k1 = [
                  bytes[i + 4] |
                    (bytes[i + 5] << 8) |
                    (bytes[i + 6] << 16) |
                    (bytes[i + 7] << 24),
                  bytes[i] |
                    (bytes[i + 1] << 8) |
                    (bytes[i + 2] << 16) |
                    (bytes[i + 3] << 24),
                ];
                k2 = [
                  bytes[i + 12] |
                    (bytes[i + 13] << 8) |
                    (bytes[i + 14] << 16) |
                    (bytes[i + 15] << 24),
                  bytes[i + 8] |
                    (bytes[i + 9] << 8) |
                    (bytes[i + 10] << 16) |
                    (bytes[i + 11] << 24),
                ];

                k1 = _x64Multiply(k1, c1);
                k1 = _x64Rotl(k1, 31);
                k1 = _x64Multiply(k1, c2);
                h1 = _x64Xor(h1, k1);

                h1 = _x64Rotl(h1, 27);
                h1 = _x64Add(h1, h2);
                h1 = _x64Add(_x64Multiply(h1, [0, 5]), [0, 0x52dce729]);

                k2 = _x64Multiply(k2, c2);
                k2 = _x64Rotl(k2, 33);
                k2 = _x64Multiply(k2, c1);
                h2 = _x64Xor(h2, k2);

                h2 = _x64Rotl(h2, 31);
                h2 = _x64Add(h2, h1);
                h2 = _x64Add(_x64Multiply(h2, [0, 5]), [0, 0x38495ab5]);
              }

              k1 = [0, 0];
              k2 = [0, 0];

              switch (remainder) {
                case 15:
                  k2 = _x64Xor(k2, _x64LeftShift([0, bytes[i + 14]], 48));

                case 14:
                  k2 = _x64Xor(k2, _x64LeftShift([0, bytes[i + 13]], 40));

                case 13:
                  k2 = _x64Xor(k2, _x64LeftShift([0, bytes[i + 12]], 32));

                case 12:
                  k2 = _x64Xor(k2, _x64LeftShift([0, bytes[i + 11]], 24));

                case 11:
                  k2 = _x64Xor(k2, _x64LeftShift([0, bytes[i + 10]], 16));

                case 10:
                  k2 = _x64Xor(k2, _x64LeftShift([0, bytes[i + 9]], 8));

                case 9:
                  k2 = _x64Xor(k2, [0, bytes[i + 8]]);
                  k2 = _x64Multiply(k2, c2);
                  k2 = _x64Rotl(k2, 33);
                  k2 = _x64Multiply(k2, c1);
                  h2 = _x64Xor(h2, k2);

                case 8:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 7]], 56));

                case 7:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 6]], 48));

                case 6:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 5]], 40));

                case 5:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 4]], 32));

                case 4:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 3]], 24));

                case 3:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 2]], 16));

                case 2:
                  k1 = _x64Xor(k1, _x64LeftShift([0, bytes[i + 1]], 8));

                case 1:
                  k1 = _x64Xor(k1, [0, bytes[i]]);
                  k1 = _x64Multiply(k1, c1);
                  k1 = _x64Rotl(k1, 31);
                  k1 = _x64Multiply(k1, c2);
                  h1 = _x64Xor(h1, k1);
              }

              h1 = _x64Xor(h1, [0, bytes.length]);
              h2 = _x64Xor(h2, [0, bytes.length]);

              h1 = _x64Add(h1, h2);
              h2 = _x64Add(h2, h1);

              h1 = _x64Fmix(h1);
              h2 = _x64Fmix(h2);

              h1 = _x64Add(h1, h2);
              h2 = _x64Add(h2, h1);

              return (
                ("00000000" + (h1[0] >>> 0).toString(16)).slice(-8) +
                ("00000000" + (h1[1] >>> 0).toString(16)).slice(-8) +
                ("00000000" + (h2[0] >>> 0).toString(16)).slice(-8) +
                ("00000000" + (h2[1] >>> 0).toString(16)).slice(-8)
              );
            };

            // INITIALIZATION
            // --------------

            // Export murmurHash3 for CommonJS, either as an AMD module or just as part
            // of the global object.
            if (typeof exports !== "undefined") {
              if (typeof module !== "undefined" && module.exports) {
                exports = module.exports = library;
              }

              exports.murmurHash3 = library;
            } else if (typeof define === "function" && define.amd) {
              define([], function () {
                return library;
              });
            } else {
              // Use murmurHash3.noConflict to restore `murmurHash3` back to its
              // original value. Returns a reference to the library object, to allow
              // it to be used under a different name.
              library._murmurHash3 = root.murmurHash3;

              library.noConflict = function () {
                root.murmurHash3 = library._murmurHash3;
                library._murmurHash3 = undefined;
                library.noConflict = undefined;

                return library;
              };

              root.murmurHash3 = library;
            }
          })(this);
        },
        {},
      ],
      138: [
        function (require, module, exports) {
          // minimal library entry point.

          "use strict";
          module.exports = require("./src/index-minimal");
        },
        { "./src/index-minimal": 139 },
      ],
      139: [
        function (require, module, exports) {
          "use strict";
          var protobuf = exports;

          /**
           * Build type, one of `"full"`, `"light"` or `"minimal"`.
           * @name build
           * @type {string}
           * @const
           */
          protobuf.build = "minimal";

          // Serialization
          protobuf.Writer = require("./writer");
          protobuf.BufferWriter = require("./writer_buffer");
          protobuf.Reader = require("./reader");
          protobuf.BufferReader = require("./reader_buffer");

          // Utility
          protobuf.util = require("./util/minimal");
          protobuf.rpc = require("./rpc");
          protobuf.roots = require("./roots");
          protobuf.configure = configure;

          /* istanbul ignore next */
          /**
           * Reconfigures the library according to the environment.
           * @returns {undefined}
           */
          function configure() {
            protobuf.util._configure();
            protobuf.Writer._configure(protobuf.BufferWriter);
            protobuf.Reader._configure(protobuf.BufferReader);
          }

          // Set up buffer utility according to the environment
          configure();
        },
        {
          "./reader": 140,
          "./reader_buffer": 141,
          "./roots": 142,
          "./rpc": 143,
          "./util/minimal": 146,
          "./writer": 147,
          "./writer_buffer": 148,
        },
      ],
      140: [
        function (require, module, exports) {
          "use strict";
          module.exports = Reader;

          var util = require("./util/minimal");

          var BufferReader; // cyclic

          var LongBits = util.LongBits,
            utf8 = util.utf8;

          /* istanbul ignore next */
          function indexOutOfRange(reader, writeLength) {
            return RangeError(
              "index out of range: " +
                reader.pos +
                " + " +
                (writeLength || 1) +
                " > " +
                reader.len
            );
          }

          /**
           * Constructs a new reader instance using the specified buffer.
           * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
           * @constructor
           * @param {Uint8Array} buffer Buffer to read from
           */
          function Reader(buffer) {
            /**
             * Read buffer.
             * @type {Uint8Array}
             */
            this.buf = buffer;

            /**
             * Read buffer position.
             * @type {number}
             */
            this.pos = 0;

            /**
             * Read buffer length.
             * @type {number}
             */
            this.len = buffer.length;
          }

          var create_array =
            typeof Uint8Array !== "undefined"
              ? function create_typed_array(buffer) {
                  if (buffer instanceof Uint8Array || Array.isArray(buffer))
                    return new Reader(buffer);
                  throw Error("illegal buffer");
                }
              : /* istanbul ignore next */
                function create_array(buffer) {
                  if (Array.isArray(buffer)) return new Reader(buffer);
                  throw Error("illegal buffer");
                };

          var create = function create() {
            return util.Buffer
              ? function create_buffer_setup(buffer) {
                  return (Reader.create = function create_buffer(buffer) {
                    return util.Buffer.isBuffer(buffer)
                      ? new BufferReader(buffer)
                      : /* istanbul ignore next */
                        create_array(buffer);
                  })(buffer);
                }
              : /* istanbul ignore next */
                create_array;
          };

          /**
           * Creates a new reader using the specified buffer.
           * @function
           * @param {Uint8Array|Buffer} buffer Buffer to read from
           * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
           * @throws {Error} If `buffer` is not a valid buffer
           */
          Reader.create = create();

          Reader.prototype._slice =
            util.Array.prototype.subarray ||
            /* istanbul ignore next */ util.Array.prototype.slice;

          /**
           * Reads a varint as an unsigned 32 bit value.
           * @function
           * @returns {number} Value read
           */
          Reader.prototype.uint32 = (function read_uint32_setup() {
            var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
            return function read_uint32() {
              value = (this.buf[this.pos] & 127) >>> 0;
              if (this.buf[this.pos++] < 128) return value;
              value = (value | ((this.buf[this.pos] & 127) << 7)) >>> 0;
              if (this.buf[this.pos++] < 128) return value;
              value = (value | ((this.buf[this.pos] & 127) << 14)) >>> 0;
              if (this.buf[this.pos++] < 128) return value;
              value = (value | ((this.buf[this.pos] & 127) << 21)) >>> 0;
              if (this.buf[this.pos++] < 128) return value;
              value = (value | ((this.buf[this.pos] & 15) << 28)) >>> 0;
              if (this.buf[this.pos++] < 128) return value;

              /* istanbul ignore if */
              if ((this.pos += 5) > this.len) {
                this.pos = this.len;
                throw indexOutOfRange(this, 10);
              }
              return value;
            };
          })();

          /**
           * Reads a varint as a signed 32 bit value.
           * @returns {number} Value read
           */
          Reader.prototype.int32 = function read_int32() {
            return this.uint32() | 0;
          };

          /**
           * Reads a zig-zag encoded varint as a signed 32 bit value.
           * @returns {number} Value read
           */
          Reader.prototype.sint32 = function read_sint32() {
            var value = this.uint32();
            return ((value >>> 1) ^ -(value & 1)) | 0;
          };

          /* eslint-disable no-invalid-this */

          function readLongVarint() {
            // tends to deopt with local vars for octet etc.
            var bits = new LongBits(0, 0);
            var i = 0;
            if (this.len - this.pos > 4) {
              // fast route (lo)
              for (; i < 4; ++i) {
                // 1st..4th
                bits.lo =
                  (bits.lo | ((this.buf[this.pos] & 127) << (i * 7))) >>> 0;
                if (this.buf[this.pos++] < 128) return bits;
              }
              // 5th
              bits.lo = (bits.lo | ((this.buf[this.pos] & 127) << 28)) >>> 0;
              bits.hi = (bits.hi | ((this.buf[this.pos] & 127) >> 4)) >>> 0;
              if (this.buf[this.pos++] < 128) return bits;
              i = 0;
            } else {
              for (; i < 3; ++i) {
                /* istanbul ignore if */
                if (this.pos >= this.len) throw indexOutOfRange(this);
                // 1st..3th
                bits.lo =
                  (bits.lo | ((this.buf[this.pos] & 127) << (i * 7))) >>> 0;
                if (this.buf[this.pos++] < 128) return bits;
              }
              // 4th
              bits.lo =
                (bits.lo | ((this.buf[this.pos++] & 127) << (i * 7))) >>> 0;
              return bits;
            }
            if (this.len - this.pos > 4) {
              // fast route (hi)
              for (; i < 5; ++i) {
                // 6th..10th
                bits.hi =
                  (bits.hi | ((this.buf[this.pos] & 127) << (i * 7 + 3))) >>> 0;
                if (this.buf[this.pos++] < 128) return bits;
              }
            } else {
              for (; i < 5; ++i) {
                /* istanbul ignore if */
                if (this.pos >= this.len) throw indexOutOfRange(this);
                // 6th..10th
                bits.hi =
                  (bits.hi | ((this.buf[this.pos] & 127) << (i * 7 + 3))) >>> 0;
                if (this.buf[this.pos++] < 128) return bits;
              }
            }
            /* istanbul ignore next */
            throw Error("invalid varint encoding");
          }

          /* eslint-enable no-invalid-this */

          /**
           * Reads a varint as a signed 64 bit value.
           * @name Reader#int64
           * @function
           * @returns {Long} Value read
           */

          /**
           * Reads a varint as an unsigned 64 bit value.
           * @name Reader#uint64
           * @function
           * @returns {Long} Value read
           */

          /**
           * Reads a zig-zag encoded varint as a signed 64 bit value.
           * @name Reader#sint64
           * @function
           * @returns {Long} Value read
           */

          /**
           * Reads a varint as a boolean.
           * @returns {boolean} Value read
           */
          Reader.prototype.bool = function read_bool() {
            return this.uint32() !== 0;
          };

          function readFixed32_end(buf, end) {
            // note that this uses `end`, not `pos`
            return (
              (buf[end - 4] |
                (buf[end - 3] << 8) |
                (buf[end - 2] << 16) |
                (buf[end - 1] << 24)) >>>
              0
            );
          }

          /**
           * Reads fixed 32 bits as an unsigned 32 bit integer.
           * @returns {number} Value read
           */
          Reader.prototype.fixed32 = function read_fixed32() {
            /* istanbul ignore if */
            if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);

            return readFixed32_end(this.buf, (this.pos += 4));
          };

          /**
           * Reads fixed 32 bits as a signed 32 bit integer.
           * @returns {number} Value read
           */
          Reader.prototype.sfixed32 = function read_sfixed32() {
            /* istanbul ignore if */
            if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);

            return readFixed32_end(this.buf, (this.pos += 4)) | 0;
          };

          /* eslint-disable no-invalid-this */

          function readFixed64(/* this: Reader */) {
            /* istanbul ignore if */
            if (this.pos + 8 > this.len) throw indexOutOfRange(this, 8);

            return new LongBits(
              readFixed32_end(this.buf, (this.pos += 4)),
              readFixed32_end(this.buf, (this.pos += 4))
            );
          }

          /* eslint-enable no-invalid-this */

          /**
           * Reads fixed 64 bits.
           * @name Reader#fixed64
           * @function
           * @returns {Long} Value read
           */

          /**
           * Reads zig-zag encoded fixed 64 bits.
           * @name Reader#sfixed64
           * @function
           * @returns {Long} Value read
           */

          /**
           * Reads a float (32 bit) as a number.
           * @function
           * @returns {number} Value read
           */
          Reader.prototype.float = function read_float() {
            /* istanbul ignore if */
            if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);

            var value = util.float.readFloatLE(this.buf, this.pos);
            this.pos += 4;
            return value;
          };

          /**
           * Reads a double (64 bit float) as a number.
           * @function
           * @returns {number} Value read
           */
          Reader.prototype.double = function read_double() {
            /* istanbul ignore if */
            if (this.pos + 8 > this.len) throw indexOutOfRange(this, 4);

            var value = util.float.readDoubleLE(this.buf, this.pos);
            this.pos += 8;
            return value;
          };

          /**
           * Reads a sequence of bytes preceeded by its length as a varint.
           * @returns {Uint8Array} Value read
           */
          Reader.prototype.bytes = function read_bytes() {
            var length = this.uint32(),
              start = this.pos,
              end = this.pos + length;

            /* istanbul ignore if */
            if (end > this.len) throw indexOutOfRange(this, length);

            this.pos += length;
            if (Array.isArray(this.buf))
              // plain array
              return this.buf.slice(start, end);
            return start === end // fix for IE 10/Win8 and others' subarray returning array of size 1
              ? new this.buf.constructor(0)
              : this._slice.call(this.buf, start, end);
          };

          /**
           * Reads a string preceeded by its byte length as a varint.
           * @returns {string} Value read
           */
          Reader.prototype.string = function read_string() {
            var bytes = this.bytes();
            return utf8.read(bytes, 0, bytes.length);
          };

          /**
           * Skips the specified number of bytes if specified, otherwise skips a varint.
           * @param {number} [length] Length if known, otherwise a varint is assumed
           * @returns {Reader} `this`
           */
          Reader.prototype.skip = function skip(length) {
            if (typeof length === "number") {
              /* istanbul ignore if */
              if (this.pos + length > this.len)
                throw indexOutOfRange(this, length);
              this.pos += length;
            } else {
              do {
                /* istanbul ignore if */
                if (this.pos >= this.len) throw indexOutOfRange(this);
              } while (this.buf[this.pos++] & 128);
            }
            return this;
          };

          /**
           * Skips the next element of the specified wire type.
           * @param {number} wireType Wire type received
           * @returns {Reader} `this`
           */
          Reader.prototype.skipType = function (wireType) {
            switch (wireType) {
              case 0:
                this.skip();
                break;
              case 1:
                this.skip(8);
                break;
              case 2:
                this.skip(this.uint32());
                break;
              case 3:
                while ((wireType = this.uint32() & 7) !== 4) {
                  this.skipType(wireType);
                }
                break;
              case 5:
                this.skip(4);
                break;

              /* istanbul ignore next */
              default:
                throw Error(
                  "invalid wire type " + wireType + " at offset " + this.pos
                );
            }
            return this;
          };

          Reader._configure = function (BufferReader_) {
            BufferReader = BufferReader_;
            Reader.create = create();
            BufferReader._configure();

            var fn = util.Long
              ? "toLong"
              : /* istanbul ignore next */ "toNumber";
            util.merge(Reader.prototype, {
              int64: function read_int64() {
                return readLongVarint.call(this)[fn](false);
              },

              uint64: function read_uint64() {
                return readLongVarint.call(this)[fn](true);
              },

              sint64: function read_sint64() {
                return readLongVarint.call(this).zzDecode()[fn](false);
              },

              fixed64: function read_fixed64() {
                return readFixed64.call(this)[fn](true);
              },

              sfixed64: function read_sfixed64() {
                return readFixed64.call(this)[fn](false);
              },
            });
          };
        },
        { "./util/minimal": 146 },
      ],
      141: [
        function (require, module, exports) {
          "use strict";
          module.exports = BufferReader;

          // extends Reader
          var Reader = require("./reader");
          (BufferReader.prototype = Object.create(
            Reader.prototype
          )).constructor = BufferReader;

          var util = require("./util/minimal");

          /**
           * Constructs a new buffer reader instance.
           * @classdesc Wire format reader using node buffers.
           * @extends Reader
           * @constructor
           * @param {Buffer} buffer Buffer to read from
           */
          function BufferReader(buffer) {
            Reader.call(this, buffer);

            /**
             * Read buffer.
             * @name BufferReader#buf
             * @type {Buffer}
             */
          }

          BufferReader._configure = function () {
            /* istanbul ignore else */
            if (util.Buffer)
              BufferReader.prototype._slice = util.Buffer.prototype.slice;
          };

          /**
           * @override
           */
          BufferReader.prototype.string = function read_string_buffer() {
            var len = this.uint32(); // modifies pos
            return this.buf.utf8Slice
              ? this.buf.utf8Slice(
                  this.pos,
                  (this.pos = Math.min(this.pos + len, this.len))
                )
              : this.buf.toString(
                  "utf-8",
                  this.pos,
                  (this.pos = Math.min(this.pos + len, this.len))
                );
          };

          /**
           * Reads a sequence of bytes preceeded by its length as a varint.
           * @name BufferReader#bytes
           * @function
           * @returns {Buffer} Value read
           */

          BufferReader._configure();
        },
        { "./reader": 140, "./util/minimal": 146 },
      ],
      142: [
        function (require, module, exports) {
          "use strict";
          module.exports = {};

          /**
           * Named roots.
           * This is where pbjs stores generated structures (the option `-r, --root` specifies a name).
           * Can also be used manually to make roots available accross modules.
           * @name roots
           * @type {Object.<string,Root>}
           * @example
           * // pbjs -r myroot -o compiled.js ...
           *
           * // in another module:
           * require("./compiled.js");
           *
           * // in any subsequent module:
           * var root = protobuf.roots["myroot"];
           */
        },
        {},
      ],
      143: [
        function (require, module, exports) {
          "use strict";

          /**
           * Streaming RPC helpers.
           * @namespace
           */
          var rpc = exports;

          /**
           * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
           * @typedef RPCImpl
           * @type {function}
           * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
           * @param {Uint8Array} requestData Request data
           * @param {RPCImplCallback} callback Callback function
           * @returns {undefined}
           * @example
           * function rpcImpl(method, requestData, callback) {
           *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
           *         throw Error("no such method");
           *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
           *         callback(err, responseData);
           *     });
           * }
           */

          /**
           * Node-style callback as used by {@link RPCImpl}.
           * @typedef RPCImplCallback
           * @type {function}
           * @param {Error|null} error Error, if any, otherwise `null`
           * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
           * @returns {undefined}
           */

          rpc.Service = require("./rpc/service");
        },
        { "./rpc/service": 144 },
      ],
      144: [
        function (require, module, exports) {
          "use strict";
          module.exports = Service;

          var util = require("../util/minimal");

          // Extends EventEmitter
          (Service.prototype = Object.create(
            util.EventEmitter.prototype
          )).constructor = Service;

          /**
           * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
           *
           * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
           * @typedef rpc.ServiceMethodCallback
           * @template TRes extends Message<TRes>
           * @type {function}
           * @param {Error|null} error Error, if any
           * @param {TRes} [response] Response message
           * @returns {undefined}
           */

          /**
           * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
           * @typedef rpc.ServiceMethod
           * @template TReq extends Message<TReq>
           * @template TRes extends Message<TRes>
           * @type {function}
           * @param {TReq|Properties<TReq>} request Request message or plain object
           * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
           * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
           */

          /**
           * Constructs a new RPC service instance.
           * @classdesc An RPC service as returned by {@link Service#create}.
           * @exports rpc.Service
           * @extends util.EventEmitter
           * @constructor
           * @param {RPCImpl} rpcImpl RPC implementation
           * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
           * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
           */
          function Service(rpcImpl, requestDelimited, responseDelimited) {
            if (typeof rpcImpl !== "function")
              throw TypeError("rpcImpl must be a function");

            util.EventEmitter.call(this);

            /**
             * RPC implementation. Becomes `null` once the service is ended.
             * @type {RPCImpl|null}
             */
            this.rpcImpl = rpcImpl;

            /**
             * Whether requests are length-delimited.
             * @type {boolean}
             */
            this.requestDelimited = Boolean(requestDelimited);

            /**
             * Whether responses are length-delimited.
             * @type {boolean}
             */
            this.responseDelimited = Boolean(responseDelimited);
          }

          /**
           * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
           * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
           * @param {Constructor<TReq>} requestCtor Request constructor
           * @param {Constructor<TRes>} responseCtor Response constructor
           * @param {TReq|Properties<TReq>} request Request message or plain object
           * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
           * @returns {undefined}
           * @template TReq extends Message<TReq>
           * @template TRes extends Message<TRes>
           */
          Service.prototype.rpcCall = function rpcCall(
            method,
            requestCtor,
            responseCtor,
            request,
            callback
          ) {
            if (!request) throw TypeError("request must be specified");

            var self = this;
            if (!callback)
              return util.asPromise(
                rpcCall,
                self,
                method,
                requestCtor,
                responseCtor,
                request
              );

            if (!self.rpcImpl) {
              setTimeout(function () {
                callback(Error("already ended"));
              }, 0);
              return undefined;
            }

            try {
              return self.rpcImpl(
                method,
                requestCtor[
                  self.requestDelimited ? "encodeDelimited" : "encode"
                ](request).finish(),
                function rpcCallback(err, response) {
                  if (err) {
                    self.emit("error", err, method);
                    return callback(err);
                  }

                  if (response === null) {
                    self.end(/* endedByRPC */ true);
                    return undefined;
                  }

                  if (!(response instanceof responseCtor)) {
                    try {
                      response =
                        responseCtor[
                          self.responseDelimited ? "decodeDelimited" : "decode"
                        ](response);
                    } catch (err) {
                      self.emit("error", err, method);
                      return callback(err);
                    }
                  }

                  self.emit("data", response, method);
                  return callback(null, response);
                }
              );
            } catch (err) {
              self.emit("error", err, method);
              setTimeout(function () {
                callback(err);
              }, 0);
              return undefined;
            }
          };

          /**
           * Ends this service and emits the `end` event.
           * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
           * @returns {rpc.Service} `this`
           */
          Service.prototype.end = function end(endedByRPC) {
            if (this.rpcImpl) {
              if (!endedByRPC)
                // signal end to rpcImpl
                this.rpcImpl(null, null, null);
              this.rpcImpl = null;
              this.emit("end").off();
            }
            return this;
          };
        },
        { "../util/minimal": 146 },
      ],
      145: [
        function (require, module, exports) {
          "use strict";
          module.exports = LongBits;

          var util = require("../util/minimal");

          /**
           * Constructs new long bits.
           * @classdesc Helper class for working with the low and high bits of a 64 bit value.
           * @memberof util
           * @constructor
           * @param {number} lo Low 32 bits, unsigned
           * @param {number} hi High 32 bits, unsigned
           */
          function LongBits(lo, hi) {
            // note that the casts below are theoretically unnecessary as of today, but older statically
            // generated converter code might still call the ctor with signed 32bits. kept for compat.

            /**
             * Low bits.
             * @type {number}
             */
            this.lo = lo >>> 0;

            /**
             * High bits.
             * @type {number}
             */
            this.hi = hi >>> 0;
          }

          /**
           * Zero bits.
           * @memberof util.LongBits
           * @type {util.LongBits}
           */
          var zero = (LongBits.zero = new LongBits(0, 0));

          zero.toNumber = function () {
            return 0;
          };
          zero.zzEncode = zero.zzDecode = function () {
            return this;
          };
          zero.length = function () {
            return 1;
          };

          /**
           * Zero hash.
           * @memberof util.LongBits
           * @type {string}
           */
          var zeroHash = (LongBits.zeroHash = "\0\0\0\0\0\0\0\0");

          /**
           * Constructs new long bits from the specified number.
           * @param {number} value Value
           * @returns {util.LongBits} Instance
           */
          LongBits.fromNumber = function fromNumber(value) {
            if (value === 0) return zero;
            var sign = value < 0;
            if (sign) value = -value;
            var lo = value >>> 0,
              hi = ((value - lo) / 4294967296) >>> 0;
            if (sign) {
              hi = ~hi >>> 0;
              lo = ~lo >>> 0;
              if (++lo > 4294967295) {
                lo = 0;
                if (++hi > 4294967295) hi = 0;
              }
            }
            return new LongBits(lo, hi);
          };

          /**
           * Constructs new long bits from a number, long or string.
           * @param {Long|number|string} value Value
           * @returns {util.LongBits} Instance
           */
          LongBits.from = function from(value) {
            if (typeof value === "number") return LongBits.fromNumber(value);
            if (util.isString(value)) {
              /* istanbul ignore else */
              if (util.Long) value = util.Long.fromString(value);
              else return LongBits.fromNumber(parseInt(value, 10));
            }
            return value.low || value.high
              ? new LongBits(value.low >>> 0, value.high >>> 0)
              : zero;
          };

          /**
           * Converts this long bits to a possibly unsafe JavaScript number.
           * @param {boolean} [unsigned=false] Whether unsigned or not
           * @returns {number} Possibly unsafe number
           */
          LongBits.prototype.toNumber = function toNumber(unsigned) {
            if (!unsigned && this.hi >>> 31) {
              var lo = (~this.lo + 1) >>> 0,
                hi = ~this.hi >>> 0;
              if (!lo) hi = (hi + 1) >>> 0;
              return -(lo + hi * 4294967296);
            }
            return this.lo + this.hi * 4294967296;
          };

          /**
           * Converts this long bits to a long.
           * @param {boolean} [unsigned=false] Whether unsigned or not
           * @returns {Long} Long
           */
          LongBits.prototype.toLong = function toLong(unsigned) {
            return util.Long
              ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
              : /* istanbul ignore next */
                {
                  low: this.lo | 0,
                  high: this.hi | 0,
                  unsigned: Boolean(unsigned),
                };
          };

          var charCodeAt = String.prototype.charCodeAt;

          /**
           * Constructs new long bits from the specified 8 characters long hash.
           * @param {string} hash Hash
           * @returns {util.LongBits} Bits
           */
          LongBits.fromHash = function fromHash(hash) {
            if (hash === zeroHash) return zero;
            return new LongBits(
              (charCodeAt.call(hash, 0) |
                (charCodeAt.call(hash, 1) << 8) |
                (charCodeAt.call(hash, 2) << 16) |
                (charCodeAt.call(hash, 3) << 24)) >>>
                0,
              (charCodeAt.call(hash, 4) |
                (charCodeAt.call(hash, 5) << 8) |
                (charCodeAt.call(hash, 6) << 16) |
                (charCodeAt.call(hash, 7) << 24)) >>>
                0
            );
          };

          /**
           * Converts this long bits to a 8 characters long hash.
           * @returns {string} Hash
           */
          LongBits.prototype.toHash = function toHash() {
            return String.fromCharCode(
              this.lo & 255,
              (this.lo >>> 8) & 255,
              (this.lo >>> 16) & 255,
              this.lo >>> 24,
              this.hi & 255,
              (this.hi >>> 8) & 255,
              (this.hi >>> 16) & 255,
              this.hi >>> 24
            );
          };

          /**
           * Zig-zag encodes this long bits.
           * @returns {util.LongBits} `this`
           */
          LongBits.prototype.zzEncode = function zzEncode() {
            var mask = this.hi >> 31;
            this.hi = (((this.hi << 1) | (this.lo >>> 31)) ^ mask) >>> 0;
            this.lo = ((this.lo << 1) ^ mask) >>> 0;
            return this;
          };

          /**
           * Zig-zag decodes this long bits.
           * @returns {util.LongBits} `this`
           */
          LongBits.prototype.zzDecode = function zzDecode() {
            var mask = -(this.lo & 1);
            this.lo = (((this.lo >>> 1) | (this.hi << 31)) ^ mask) >>> 0;
            this.hi = ((this.hi >>> 1) ^ mask) >>> 0;
            return this;
          };

          /**
           * Calculates the length of this longbits when encoded as a varint.
           * @returns {number} Length
           */
          LongBits.prototype.length = function length() {
            var part0 = this.lo,
              part1 = ((this.lo >>> 28) | (this.hi << 4)) >>> 0,
              part2 = this.hi >>> 24;
            return part2 === 0
              ? part1 === 0
                ? part0 < 16384
                  ? part0 < 128
                    ? 1
                    : 2
                  : part0 < 2097152
                  ? 3
                  : 4
                : part1 < 16384
                ? part1 < 128
                  ? 5
                  : 6
                : part1 < 2097152
                ? 7
                : 8
              : part2 < 128
              ? 9
              : 10;
          };
        },
        { "../util/minimal": 146 },
      ],
      146: [
        function (require, module, exports) {
          (function (global) {
            (function () {
              "use strict";
              var util = exports;

              // used to return a Promise where callback is omitted
              util.asPromise = require("@protobufjs/aspromise");

              // converts to / from base64 encoded strings
              util.base64 = require("@protobufjs/base64");

              // base class of rpc.Service
              util.EventEmitter = require("@protobufjs/eventemitter");

              // float handling accross browsers
              util.float = require("@protobufjs/float");

              // requires modules optionally and hides the call from bundlers
              util.inquire = require("@protobufjs/inquire");

              // converts to / from utf8 encoded strings
              util.utf8 = require("@protobufjs/utf8");

              // provides a node-like buffer pool in the browser
              util.pool = require("@protobufjs/pool");

              // utility to work with the low and high bits of a 64 bit value
              util.LongBits = require("./longbits");

              /**
               * Whether running within node or not.
               * @memberof util
               * @type {boolean}
               */
              util.isNode = Boolean(
                typeof global !== "undefined" &&
                  global &&
                  global.process &&
                  global.process.versions &&
                  global.process.versions.node
              );

              /**
               * Global object reference.
               * @memberof util
               * @type {Object}
               */
              util.global =
                (util.isNode && global) ||
                (typeof window !== "undefined" && window) ||
                (typeof self !== "undefined" && self) ||
                this; // eslint-disable-line no-invalid-this

              /**
               * An immuable empty array.
               * @memberof util
               * @type {Array.<*>}
               * @const
               */
              util.emptyArray = Object.freeze
                ? Object.freeze([])
                : /* istanbul ignore next */ []; // used on prototypes

              /**
               * An immutable empty object.
               * @type {Object}
               * @const
               */
              util.emptyObject = Object.freeze
                ? Object.freeze({})
                : /* istanbul ignore next */ {}; // used on prototypes

              /**
               * Tests if the specified value is an integer.
               * @function
               * @param {*} value Value to test
               * @returns {boolean} `true` if the value is an integer
               */
              util.isInteger =
                Number.isInteger ||
                /* istanbul ignore next */ function isInteger(value) {
                  return (
                    typeof value === "number" &&
                    isFinite(value) &&
                    Math.floor(value) === value
                  );
                };

              /**
               * Tests if the specified value is a string.
               * @param {*} value Value to test
               * @returns {boolean} `true` if the value is a string
               */
              util.isString = function isString(value) {
                return typeof value === "string" || value instanceof String;
              };

              /**
               * Tests if the specified value is a non-null object.
               * @param {*} value Value to test
               * @returns {boolean} `true` if the value is a non-null object
               */
              util.isObject = function isObject(value) {
                return value && typeof value === "object";
              };

              /**
               * Checks if a property on a message is considered to be present.
               * This is an alias of {@link util.isSet}.
               * @function
               * @param {Object} obj Plain object or message instance
               * @param {string} prop Property name
               * @returns {boolean} `true` if considered to be present, otherwise `false`
               */
              util.isset =
                /**
                 * Checks if a property on a message is considered to be present.
                 * @param {Object} obj Plain object or message instance
                 * @param {string} prop Property name
                 * @returns {boolean} `true` if considered to be present, otherwise `false`
                 */
                util.isSet = function isSet(obj, prop) {
                  var value = obj[prop];
                  if (value != null && obj.hasOwnProperty(prop))
                    // eslint-disable-line eqeqeq, no-prototype-builtins
                    return (
                      typeof value !== "object" ||
                      (Array.isArray(value)
                        ? value.length
                        : Object.keys(value).length) > 0
                    );
                  return false;
                };

              /**
               * Any compatible Buffer instance.
               * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
               * @interface Buffer
               * @extends Uint8Array
               */

              /**
               * Node's Buffer class if available.
               * @type {Constructor<Buffer>}
               */
              util.Buffer = (function () {
                try {
                  var Buffer = util.inquire("buffer").Buffer;
                  // refuse to use non-node buffers if not explicitly assigned (perf reasons):
                  return Buffer.prototype.utf8Write
                    ? Buffer
                    : /* istanbul ignore next */ null;
                } catch (e) {
                  /* istanbul ignore next */
                  return null;
                }
              })();

              // Internal alias of or polyfull for Buffer.from.
              util._Buffer_from = null;

              // Internal alias of or polyfill for Buffer.allocUnsafe.
              util._Buffer_allocUnsafe = null;

              /**
               * Creates a new buffer of whatever type supported by the environment.
               * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
               * @returns {Uint8Array|Buffer} Buffer
               */
              util.newBuffer = function newBuffer(sizeOrArray) {
                /* istanbul ignore next */
                return typeof sizeOrArray === "number"
                  ? util.Buffer
                    ? util._Buffer_allocUnsafe(sizeOrArray)
                    : new util.Array(sizeOrArray)
                  : util.Buffer
                  ? util._Buffer_from(sizeOrArray)
                  : typeof Uint8Array === "undefined"
                  ? sizeOrArray
                  : new Uint8Array(sizeOrArray);
              };

              /**
               * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
               * @type {Constructor<Uint8Array>}
               */
              util.Array =
                typeof Uint8Array !== "undefined"
                  ? Uint8Array /* istanbul ignore next */
                  : Array;

              /**
               * Any compatible Long instance.
               * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
               * @interface Long
               * @property {number} low Low bits
               * @property {number} high High bits
               * @property {boolean} unsigned Whether unsigned or not
               */

              /**
               * Long.js's Long class if available.
               * @type {Constructor<Long>}
               */
              util.Long =
                /* istanbul ignore next */ (util.global.dcodeIO &&
                  /* istanbul ignore next */ util.global.dcodeIO.Long) ||
                /* istanbul ignore next */ util.global.Long ||
                util.inquire("long");

              /**
               * Regular expression used to verify 2 bit (`bool`) map keys.
               * @type {RegExp}
               * @const
               */
              util.key2Re = /^true|false|0|1$/;

              /**
               * Regular expression used to verify 32 bit (`int32` etc.) map keys.
               * @type {RegExp}
               * @const
               */
              util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;

              /**
               * Regular expression used to verify 64 bit (`int64` etc.) map keys.
               * @type {RegExp}
               * @const
               */
              util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/;

              /**
               * Converts a number or long to an 8 characters long hash string.
               * @param {Long|number} value Value to convert
               * @returns {string} Hash
               */
              util.longToHash = function longToHash(value) {
                return value
                  ? util.LongBits.from(value).toHash()
                  : util.LongBits.zeroHash;
              };

              /**
               * Converts an 8 characters long hash string to a long or number.
               * @param {string} hash Hash
               * @param {boolean} [unsigned=false] Whether unsigned or not
               * @returns {Long|number} Original value
               */
              util.longFromHash = function longFromHash(hash, unsigned) {
                var bits = util.LongBits.fromHash(hash);
                if (util.Long)
                  return util.Long.fromBits(bits.lo, bits.hi, unsigned);
                return bits.toNumber(Boolean(unsigned));
              };

              /**
               * Merges the properties of the source object into the destination object.
               * @memberof util
               * @param {Object.<string,*>} dst Destination object
               * @param {Object.<string,*>} src Source object
               * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
               * @returns {Object.<string,*>} Destination object
               */
              function merge(dst, src, ifNotSet) {
                // used by converters
                for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
                  if (dst[keys[i]] === undefined || !ifNotSet)
                    dst[keys[i]] = src[keys[i]];
                return dst;
              }

              util.merge = merge;

              /**
               * Converts the first character of a string to lower case.
               * @param {string} str String to convert
               * @returns {string} Converted string
               */
              util.lcFirst = function lcFirst(str) {
                return str.charAt(0).toLowerCase() + str.substring(1);
              };

              /**
               * Creates a custom error constructor.
               * @memberof util
               * @param {string} name Error name
               * @returns {Constructor<Error>} Custom error constructor
               */
              function newError(name) {
                function CustomError(message, properties) {
                  if (!(this instanceof CustomError))
                    return new CustomError(message, properties);

                  // Error.call(this, message);
                  // ^ just returns a new error instance because the ctor can be called as a function

                  Object.defineProperty(this, "message", {
                    get: function () {
                      return message;
                    },
                  });

                  /* istanbul ignore next */
                  if (Error.captureStackTrace)
                    // node
                    Error.captureStackTrace(this, CustomError);
                  else
                    Object.defineProperty(this, "stack", {
                      value: new Error().stack || "",
                    });

                  if (properties) merge(this, properties);
                }

                (CustomError.prototype = Object.create(
                  Error.prototype
                )).constructor = CustomError;

                Object.defineProperty(CustomError.prototype, "name", {
                  get: function () {
                    return name;
                  },
                });

                CustomError.prototype.toString = function toString() {
                  return this.name + ": " + this.message;
                };

                return CustomError;
              }

              util.newError = newError;

              /**
               * Constructs a new protocol error.
               * @classdesc Error subclass indicating a protocol specifc error.
               * @memberof util
               * @extends Error
               * @template T extends Message<T>
               * @constructor
               * @param {string} message Error message
               * @param {Object.<string,*>} [properties] Additional properties
               * @example
               * try {
               *     MyMessage.decode(someBuffer); // throws if required fields are missing
               * } catch (e) {
               *     if (e instanceof ProtocolError && e.instance)
               *         console.log("decoded so far: " + JSON.stringify(e.instance));
               * }
               */
              util.ProtocolError = newError("ProtocolError");

              /**
               * So far decoded message instance.
               * @name util.ProtocolError#instance
               * @type {Message<T>}
               */

              /**
               * A OneOf getter as returned by {@link util.oneOfGetter}.
               * @typedef OneOfGetter
               * @type {function}
               * @returns {string|undefined} Set field name, if any
               */

              /**
               * Builds a getter for a oneof's present field name.
               * @param {string[]} fieldNames Field names
               * @returns {OneOfGetter} Unbound getter
               */
              util.oneOfGetter = function getOneOf(fieldNames) {
                var fieldMap = {};
                for (var i = 0; i < fieldNames.length; ++i)
                  fieldMap[fieldNames[i]] = 1;

                /**
                 * @returns {string|undefined} Set field name, if any
                 * @this Object
                 * @ignore
                 */
                return function () {
                  // eslint-disable-line consistent-return
                  for (
                    var keys = Object.keys(this), i = keys.length - 1;
                    i > -1;
                    --i
                  )
                    if (
                      fieldMap[keys[i]] === 1 &&
                      this[keys[i]] !== undefined &&
                      this[keys[i]] !== null
                    )
                      return keys[i];
                };
              };

              /**
               * A OneOf setter as returned by {@link util.oneOfSetter}.
               * @typedef OneOfSetter
               * @type {function}
               * @param {string|undefined} value Field name
               * @returns {undefined}
               */

              /**
               * Builds a setter for a oneof's present field name.
               * @param {string[]} fieldNames Field names
               * @returns {OneOfSetter} Unbound setter
               */
              util.oneOfSetter = function setOneOf(fieldNames) {
                /**
                 * @param {string} name Field name
                 * @returns {undefined}
                 * @this Object
                 * @ignore
                 */
                return function (name) {
                  for (var i = 0; i < fieldNames.length; ++i)
                    if (fieldNames[i] !== name) delete this[fieldNames[i]];
                };
              };

              /**
               * Default conversion options used for {@link Message#toJSON} implementations.
               *
               * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
               *
               * - Longs become strings
               * - Enums become string keys
               * - Bytes become base64 encoded strings
               * - (Sub-)Messages become plain objects
               * - Maps become plain objects with all string keys
               * - Repeated fields become arrays
               * - NaN and Infinity for float and double fields become strings
               *
               * @type {IConversionOptions}
               * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
               */
              util.toJSONOptions = {
                longs: String,
                enums: String,
                bytes: String,
                json: true,
              };

              // Sets up buffer utility according to the environment (called in index-minimal)
              util._configure = function () {
                var Buffer = util.Buffer;
                /* istanbul ignore if */
                if (!Buffer) {
                  util._Buffer_from = util._Buffer_allocUnsafe = null;
                  return;
                }
                // because node 4.x buffers are incompatible & immutable
                // see: https://github.com/dcodeIO/protobuf.js/pull/665
                util._Buffer_from =
                  (Buffer.from !== Uint8Array.from && Buffer.from) ||
                  /* istanbul ignore next */
                  function Buffer_from(value, encoding) {
                    return new Buffer(value, encoding);
                  };
                util._Buffer_allocUnsafe =
                  Buffer.allocUnsafe ||
                  /* istanbul ignore next */
                  function Buffer_allocUnsafe(size) {
                    return new Buffer(size);
                  };
              };
            }.call(this));
          }.call(
            this,
            typeof global !== "undefined"
              ? global
              : typeof self !== "undefined"
              ? self
              : typeof window !== "undefined"
              ? window
              : {}
          ));
        },
        {
          "./longbits": 145,
          "@protobufjs/aspromise": 4,
          "@protobufjs/base64": 5,
          "@protobufjs/eventemitter": 6,
          "@protobufjs/float": 7,
          "@protobufjs/inquire": 8,
          "@protobufjs/pool": 9,
          "@protobufjs/utf8": 10,
        },
      ],
      147: [
        function (require, module, exports) {
          "use strict";
          module.exports = Writer;

          var util = require("./util/minimal");

          var BufferWriter; // cyclic

          var LongBits = util.LongBits,
            base64 = util.base64,
            utf8 = util.utf8;

          /**
           * Constructs a new writer operation instance.
           * @classdesc Scheduled writer operation.
           * @constructor
           * @param {function(*, Uint8Array, number)} fn Function to call
           * @param {number} len Value byte length
           * @param {*} val Value to write
           * @ignore
           */
          function Op(fn, len, val) {
            /**
             * Function to call.
             * @type {function(Uint8Array, number, *)}
             */
            this.fn = fn;

            /**
             * Value byte length.
             * @type {number}
             */
            this.len = len;

            /**
             * Next operation.
             * @type {Writer.Op|undefined}
             */
            this.next = undefined;

            /**
             * Value to write.
             * @type {*}
             */
            this.val = val; // type varies
          }

          /* istanbul ignore next */
          function noop() {} // eslint-disable-line no-empty-function

          /**
           * Constructs a new writer state instance.
           * @classdesc Copied writer state.
           * @memberof Writer
           * @constructor
           * @param {Writer} writer Writer to copy state from
           * @ignore
           */
          function State(writer) {
            /**
             * Current head.
             * @type {Writer.Op}
             */
            this.head = writer.head;

            /**
             * Current tail.
             * @type {Writer.Op}
             */
            this.tail = writer.tail;

            /**
             * Current buffer length.
             * @type {number}
             */
            this.len = writer.len;

            /**
             * Next state.
             * @type {State|null}
             */
            this.next = writer.states;
          }

          /**
           * Constructs a new writer instance.
           * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
           * @constructor
           */
          function Writer() {
            /**
             * Current length.
             * @type {number}
             */
            this.len = 0;

            /**
             * Operations head.
             * @type {Object}
             */
            this.head = new Op(noop, 0, 0);

            /**
             * Operations tail
             * @type {Object}
             */
            this.tail = this.head;

            /**
             * Linked forked states.
             * @type {Object|null}
             */
            this.states = null;

            // When a value is written, the writer calculates its byte length and puts it into a linked
            // list of operations to perform when finish() is called. This both allows us to allocate
            // buffers of the exact required size and reduces the amount of work we have to do compared
            // to first calculating over objects and then encoding over objects. In our case, the encoding
            // part is just a linked list walk calling operations with already prepared values.
          }

          var create = function create() {
            return util.Buffer
              ? function create_buffer_setup() {
                  return (Writer.create = function create_buffer() {
                    return new BufferWriter();
                  })();
                }
              : /* istanbul ignore next */
                function create_array() {
                  return new Writer();
                };
          };

          /**
           * Creates a new writer.
           * @function
           * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
           */
          Writer.create = create();

          /**
           * Allocates a buffer of the specified size.
           * @param {number} size Buffer size
           * @returns {Uint8Array} Buffer
           */
          Writer.alloc = function alloc(size) {
            return new util.Array(size);
          };

          // Use Uint8Array buffer pool in the browser, just like node does with buffers
          /* istanbul ignore else */
          if (util.Array !== Array)
            Writer.alloc = util.pool(
              Writer.alloc,
              util.Array.prototype.subarray
            );

          /**
           * Pushes a new operation to the queue.
           * @param {function(Uint8Array, number, *)} fn Function to call
           * @param {number} len Value byte length
           * @param {number} val Value to write
           * @returns {Writer} `this`
           * @private
           */
          Writer.prototype._push = function push(fn, len, val) {
            this.tail = this.tail.next = new Op(fn, len, val);
            this.len += len;
            return this;
          };

          function writeByte(val, buf, pos) {
            buf[pos] = val & 255;
          }

          function writeVarint32(val, buf, pos) {
            while (val > 127) {
              buf[pos++] = (val & 127) | 128;
              val >>>= 7;
            }
            buf[pos] = val;
          }

          /**
           * Constructs a new varint writer operation instance.
           * @classdesc Scheduled varint writer operation.
           * @extends Op
           * @constructor
           * @param {number} len Value byte length
           * @param {number} val Value to write
           * @ignore
           */
          function VarintOp(len, val) {
            this.len = len;
            this.next = undefined;
            this.val = val;
          }

          VarintOp.prototype = Object.create(Op.prototype);
          VarintOp.prototype.fn = writeVarint32;

          /**
           * Writes an unsigned 32 bit value as a varint.
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.uint32 = function write_uint32(value) {
            // here, the call to this.push has been inlined and a varint specific Op subclass is used.
            // uint32 is by far the most frequently used operation and benefits significantly from this.
            this.len += (this.tail = this.tail.next =
              new VarintOp(
                (value = value >>> 0) < 128
                  ? 1
                  : value < 16384
                  ? 2
                  : value < 2097152
                  ? 3
                  : value < 268435456
                  ? 4
                  : 5,
                value
              )).len;
            return this;
          };

          /**
           * Writes a signed 32 bit value as a varint.
           * @function
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.int32 = function write_int32(value) {
            return value < 0
              ? this._push(writeVarint64, 10, LongBits.fromNumber(value)) // 10 bytes per spec
              : this.uint32(value);
          };

          /**
           * Writes a 32 bit value as a varint, zig-zag encoded.
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.sint32 = function write_sint32(value) {
            return this.uint32(((value << 1) ^ (value >> 31)) >>> 0);
          };

          function writeVarint64(val, buf, pos) {
            while (val.hi) {
              buf[pos++] = (val.lo & 127) | 128;
              val.lo = ((val.lo >>> 7) | (val.hi << 25)) >>> 0;
              val.hi >>>= 7;
            }
            while (val.lo > 127) {
              buf[pos++] = (val.lo & 127) | 128;
              val.lo = val.lo >>> 7;
            }
            buf[pos++] = val.lo;
          }

          /**
           * Writes an unsigned 64 bit value as a varint.
           * @param {Long|number|string} value Value to write
           * @returns {Writer} `this`
           * @throws {TypeError} If `value` is a string and no long library is present.
           */
          Writer.prototype.uint64 = function write_uint64(value) {
            var bits = LongBits.from(value);
            return this._push(writeVarint64, bits.length(), bits);
          };

          /**
           * Writes a signed 64 bit value as a varint.
           * @function
           * @param {Long|number|string} value Value to write
           * @returns {Writer} `this`
           * @throws {TypeError} If `value` is a string and no long library is present.
           */
          Writer.prototype.int64 = Writer.prototype.uint64;

          /**
           * Writes a signed 64 bit value as a varint, zig-zag encoded.
           * @param {Long|number|string} value Value to write
           * @returns {Writer} `this`
           * @throws {TypeError} If `value` is a string and no long library is present.
           */
          Writer.prototype.sint64 = function write_sint64(value) {
            var bits = LongBits.from(value).zzEncode();
            return this._push(writeVarint64, bits.length(), bits);
          };

          /**
           * Writes a boolish value as a varint.
           * @param {boolean} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.bool = function write_bool(value) {
            return this._push(writeByte, 1, value ? 1 : 0);
          };

          function writeFixed32(val, buf, pos) {
            buf[pos] = val & 255;
            buf[pos + 1] = (val >>> 8) & 255;
            buf[pos + 2] = (val >>> 16) & 255;
            buf[pos + 3] = val >>> 24;
          }

          /**
           * Writes an unsigned 32 bit value as fixed 32 bits.
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.fixed32 = function write_fixed32(value) {
            return this._push(writeFixed32, 4, value >>> 0);
          };

          /**
           * Writes a signed 32 bit value as fixed 32 bits.
           * @function
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.sfixed32 = Writer.prototype.fixed32;

          /**
           * Writes an unsigned 64 bit value as fixed 64 bits.
           * @param {Long|number|string} value Value to write
           * @returns {Writer} `this`
           * @throws {TypeError} If `value` is a string and no long library is present.
           */
          Writer.prototype.fixed64 = function write_fixed64(value) {
            var bits = LongBits.from(value);
            return this._push(writeFixed32, 4, bits.lo)._push(
              writeFixed32,
              4,
              bits.hi
            );
          };

          /**
           * Writes a signed 64 bit value as fixed 64 bits.
           * @function
           * @param {Long|number|string} value Value to write
           * @returns {Writer} `this`
           * @throws {TypeError} If `value` is a string and no long library is present.
           */
          Writer.prototype.sfixed64 = Writer.prototype.fixed64;

          /**
           * Writes a float (32 bit).
           * @function
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.float = function write_float(value) {
            return this._push(util.float.writeFloatLE, 4, value);
          };

          /**
           * Writes a double (64 bit float).
           * @function
           * @param {number} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.double = function write_double(value) {
            return this._push(util.float.writeDoubleLE, 8, value);
          };

          var writeBytes = util.Array.prototype.set
            ? function writeBytes_set(val, buf, pos) {
                buf.set(val, pos); // also works for plain array values
              }
            : /* istanbul ignore next */
              function writeBytes_for(val, buf, pos) {
                for (var i = 0; i < val.length; ++i) buf[pos + i] = val[i];
              };

          /**
           * Writes a sequence of bytes.
           * @param {Uint8Array|string} value Buffer or base64 encoded string to write
           * @returns {Writer} `this`
           */
          Writer.prototype.bytes = function write_bytes(value) {
            var len = value.length >>> 0;
            if (!len) return this._push(writeByte, 1, 0);
            if (util.isString(value)) {
              var buf = Writer.alloc((len = base64.length(value)));
              base64.decode(value, buf, 0);
              value = buf;
            }
            return this.uint32(len)._push(writeBytes, len, value);
          };

          /**
           * Writes a string.
           * @param {string} value Value to write
           * @returns {Writer} `this`
           */
          Writer.prototype.string = function write_string(value) {
            var len = utf8.length(value);
            return len
              ? this.uint32(len)._push(utf8.write, len, value)
              : this._push(writeByte, 1, 0);
          };

          /**
           * Forks this writer's state by pushing it to a stack.
           * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
           * @returns {Writer} `this`
           */
          Writer.prototype.fork = function fork() {
            this.states = new State(this);
            this.head = this.tail = new Op(noop, 0, 0);
            this.len = 0;
            return this;
          };

          /**
           * Resets this instance to the last state.
           * @returns {Writer} `this`
           */
          Writer.prototype.reset = function reset() {
            if (this.states) {
              this.head = this.states.head;
              this.tail = this.states.tail;
              this.len = this.states.len;
              this.states = this.states.next;
            } else {
              this.head = this.tail = new Op(noop, 0, 0);
              this.len = 0;
            }
            return this;
          };

          /**
           * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
           * @returns {Writer} `this`
           */
          Writer.prototype.ldelim = function ldelim() {
            var head = this.head,
              tail = this.tail,
              len = this.len;
            this.reset().uint32(len);
            if (len) {
              this.tail.next = head.next; // skip noop
              this.tail = tail;
              this.len += len;
            }
            return this;
          };

          /**
           * Finishes the write operation.
           * @returns {Uint8Array} Finished buffer
           */
          Writer.prototype.finish = function finish() {
            var head = this.head.next, // skip noop
              buf = this.constructor.alloc(this.len),
              pos = 0;
            while (head) {
              head.fn(head.val, buf, pos);
              pos += head.len;
              head = head.next;
            }
            // this.head = this.tail = null;
            return buf;
          };

          Writer._configure = function (BufferWriter_) {
            BufferWriter = BufferWriter_;
            Writer.create = create();
            BufferWriter._configure();
          };
        },
        { "./util/minimal": 146 },
      ],
      148: [
        function (require, module, exports) {
          "use strict";
          module.exports = BufferWriter;

          // extends Writer
          var Writer = require("./writer");
          (BufferWriter.prototype = Object.create(
            Writer.prototype
          )).constructor = BufferWriter;

          var util = require("./util/minimal");

          /**
           * Constructs a new buffer writer instance.
           * @classdesc Wire format writer using node buffers.
           * @extends Writer
           * @constructor
           */
          function BufferWriter() {
            Writer.call(this);
          }

          BufferWriter._configure = function () {
            /**
             * Allocates a buffer of the specified size.
             * @function
             * @param {number} size Buffer size
             * @returns {Buffer} Buffer
             */
            BufferWriter.alloc = util._Buffer_allocUnsafe;

            BufferWriter.writeBytesBuffer =
              util.Buffer &&
              util.Buffer.prototype instanceof Uint8Array &&
              util.Buffer.prototype.set.name === "set"
                ? function writeBytesBuffer_set(val, buf, pos) {
                    buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
                    // also works for plain array values
                  }
                : /* istanbul ignore next */
                  function writeBytesBuffer_copy(val, buf, pos) {
                    if (val.copy)
                      // Buffer values
                      val.copy(buf, pos, 0, val.length);
                    else
                      for (
                        var i = 0;
                        i < val.length; // plain array values

                      )
                        buf[pos++] = val[i++];
                  };
          };

          /**
           * @override
           */
          BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
            if (util.isString(value))
              value = util._Buffer_from(value, "base64");
            var len = value.length >>> 0;
            this.uint32(len);
            if (len) this._push(BufferWriter.writeBytesBuffer, len, value);
            return this;
          };

          function writeStringBuffer(val, buf, pos) {
            if (val.length < 40)
              // plain js is faster for short strings (probably due to redundant assertions)
              util.utf8.write(val, buf, pos);
            else if (buf.utf8Write) buf.utf8Write(val, pos);
            else buf.write(val, pos);
          }

          /**
           * @override
           */
          BufferWriter.prototype.string = function write_string_buffer(value) {
            var len = util.Buffer.byteLength(value);
            this.uint32(len);
            if (len) this._push(writeStringBuffer, len, value);
            return this;
          };

          /**
           * Finishes the write operation.
           * @name BufferWriter#finish
           * @function
           * @returns {Buffer} Finished buffer
           */

          BufferWriter._configure();
        },
        { "./util/minimal": 146, "./writer": 147 },
      ],
      149: [
        function (require, module, exports) {
          const { instantiate } = require("@assemblyscript/loader");

          loadWebAssembly.supported = typeof WebAssembly !== "undefined";

          function loadWebAssembly(imp = {}) {
            if (!loadWebAssembly.supported) return null;

            var wasm = new Uint8Array([
              0, 97, 115, 109, 1, 0, 0, 0, 1, 78, 14, 96, 2, 127, 126, 0, 96, 1,
              127, 1, 126, 96, 2, 127, 127, 0, 96, 1, 127, 1, 127, 96, 1, 127,
              0, 96, 2, 127, 127, 1, 127, 96, 3, 127, 127, 127, 1, 127, 96, 0,
              0, 96, 3, 127, 127, 127, 0, 96, 0, 1, 127, 96, 4, 127, 127, 127,
              127, 0, 96, 5, 127, 127, 127, 127, 127, 1, 127, 96, 1, 126, 1,
              127, 96, 2, 126, 126, 1, 126, 2, 13, 1, 3, 101, 110, 118, 5, 97,
              98, 111, 114, 116, 0, 10, 3, 54, 53, 2, 2, 8, 9, 3, 5, 2, 8, 6, 5,
              3, 4, 2, 6, 9, 12, 13, 2, 5, 11, 3, 2, 3, 2, 3, 2, 1, 0, 1, 0, 1,
              0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 6, 7, 7, 4, 4,
              5, 3, 1, 0, 1, 6, 47, 9, 127, 1, 65, 0, 11, 127, 1, 65, 0, 11,
              127, 0, 65, 3, 11, 127, 0, 65, 4, 11, 127, 1, 65, 0, 11, 127, 1,
              65, 0, 11, 127, 1, 65, 0, 11, 127, 0, 65, 240, 2, 11, 127, 0, 65,
              6, 11, 7, 240, 5, 41, 6, 109, 101, 109, 111, 114, 121, 2, 0, 7,
              95, 95, 97, 108, 108, 111, 99, 0, 10, 8, 95, 95, 114, 101, 116,
              97, 105, 110, 0, 11, 9, 95, 95, 114, 101, 108, 101, 97, 115, 101,
              0, 12, 9, 95, 95, 99, 111, 108, 108, 101, 99, 116, 0, 51, 11, 95,
              95, 114, 116, 116, 105, 95, 98, 97, 115, 101, 3, 7, 13, 73, 110,
              116, 51, 50, 65, 114, 114, 97, 121, 95, 73, 68, 3, 2, 13, 85, 105,
              110, 116, 56, 65, 114, 114, 97, 121, 95, 73, 68, 3, 3, 6, 100,
              101, 103, 114, 101, 101, 0, 16, 3, 109, 111, 100, 0, 17, 5, 82,
              97, 98, 105, 110, 3, 8, 16, 82, 97, 98, 105, 110, 35, 103, 101,
              116, 58, 119, 105, 110, 100, 111, 119, 0, 21, 16, 82, 97, 98, 105,
              110, 35, 115, 101, 116, 58, 119, 105, 110, 100, 111, 119, 0, 22,
              21, 82, 97, 98, 105, 110, 35, 103, 101, 116, 58, 119, 105, 110,
              100, 111, 119, 95, 115, 105, 122, 101, 0, 23, 21, 82, 97, 98, 105,
              110, 35, 115, 101, 116, 58, 119, 105, 110, 100, 111, 119, 95, 115,
              105, 122, 101, 0, 24, 14, 82, 97, 98, 105, 110, 35, 103, 101, 116,
              58, 119, 112, 111, 115, 0, 25, 14, 82, 97, 98, 105, 110, 35, 115,
              101, 116, 58, 119, 112, 111, 115, 0, 26, 15, 82, 97, 98, 105, 110,
              35, 103, 101, 116, 58, 99, 111, 117, 110, 116, 0, 27, 15, 82, 97,
              98, 105, 110, 35, 115, 101, 116, 58, 99, 111, 117, 110, 116, 0,
              28, 13, 82, 97, 98, 105, 110, 35, 103, 101, 116, 58, 112, 111,
              115, 0, 29, 13, 82, 97, 98, 105, 110, 35, 115, 101, 116, 58, 112,
              111, 115, 0, 30, 15, 82, 97, 98, 105, 110, 35, 103, 101, 116, 58,
              115, 116, 97, 114, 116, 0, 31, 15, 82, 97, 98, 105, 110, 35, 115,
              101, 116, 58, 115, 116, 97, 114, 116, 0, 32, 16, 82, 97, 98, 105,
              110, 35, 103, 101, 116, 58, 100, 105, 103, 101, 115, 116, 0, 33,
              16, 82, 97, 98, 105, 110, 35, 115, 101, 116, 58, 100, 105, 103,
              101, 115, 116, 0, 34, 21, 82, 97, 98, 105, 110, 35, 103, 101, 116,
              58, 99, 104, 117, 110, 107, 95, 115, 116, 97, 114, 116, 0, 35, 21,
              82, 97, 98, 105, 110, 35, 115, 101, 116, 58, 99, 104, 117, 110,
              107, 95, 115, 116, 97, 114, 116, 0, 36, 22, 82, 97, 98, 105, 110,
              35, 103, 101, 116, 58, 99, 104, 117, 110, 107, 95, 108, 101, 110,
              103, 116, 104, 0, 37, 22, 82, 97, 98, 105, 110, 35, 115, 101, 116,
              58, 99, 104, 117, 110, 107, 95, 108, 101, 110, 103, 116, 104, 0,
              38, 31, 82, 97, 98, 105, 110, 35, 103, 101, 116, 58, 99, 104, 117,
              110, 107, 95, 99, 117, 116, 95, 102, 105, 110, 103, 101, 114, 112,
              114, 105, 110, 116, 0, 39, 31, 82, 97, 98, 105, 110, 35, 115, 101,
              116, 58, 99, 104, 117, 110, 107, 95, 99, 117, 116, 95, 102, 105,
              110, 103, 101, 114, 112, 114, 105, 110, 116, 0, 40, 20, 82, 97,
              98, 105, 110, 35, 103, 101, 116, 58, 112, 111, 108, 121, 110, 111,
              109, 105, 97, 108, 0, 41, 20, 82, 97, 98, 105, 110, 35, 115, 101,
              116, 58, 112, 111, 108, 121, 110, 111, 109, 105, 97, 108, 0, 42,
              17, 82, 97, 98, 105, 110, 35, 103, 101, 116, 58, 109, 105, 110,
              115, 105, 122, 101, 0, 43, 17, 82, 97, 98, 105, 110, 35, 115, 101,
              116, 58, 109, 105, 110, 115, 105, 122, 101, 0, 44, 17, 82, 97, 98,
              105, 110, 35, 103, 101, 116, 58, 109, 97, 120, 115, 105, 122, 101,
              0, 45, 17, 82, 97, 98, 105, 110, 35, 115, 101, 116, 58, 109, 97,
              120, 115, 105, 122, 101, 0, 46, 14, 82, 97, 98, 105, 110, 35, 103,
              101, 116, 58, 109, 97, 115, 107, 0, 47, 14, 82, 97, 98, 105, 110,
              35, 115, 101, 116, 58, 109, 97, 115, 107, 0, 48, 17, 82, 97, 98,
              105, 110, 35, 99, 111, 110, 115, 116, 114, 117, 99, 116, 111, 114,
              0, 20, 17, 82, 97, 98, 105, 110, 35, 102, 105, 110, 103, 101, 114,
              112, 114, 105, 110, 116, 0, 49, 8, 1, 50, 10, 165, 31, 53, 199, 1,
              1, 4, 127, 32, 1, 40, 2, 0, 65, 124, 113, 34, 2, 65, 128, 2, 73,
              4, 127, 32, 2, 65, 4, 118, 33, 4, 65, 0, 5, 32, 2, 65, 31, 32, 2,
              103, 107, 34, 3, 65, 4, 107, 118, 65, 16, 115, 33, 4, 32, 3, 65,
              7, 107, 11, 33, 3, 32, 1, 40, 2, 20, 33, 2, 32, 1, 40, 2, 16, 34,
              5, 4, 64, 32, 5, 32, 2, 54, 2, 20, 11, 32, 2, 4, 64, 32, 2, 32, 5,
              54, 2, 16, 11, 32, 1, 32, 0, 32, 4, 32, 3, 65, 4, 116, 106, 65, 2,
              116, 106, 40, 2, 96, 70, 4, 64, 32, 0, 32, 4, 32, 3, 65, 4, 116,
              106, 65, 2, 116, 106, 32, 2, 54, 2, 96, 32, 2, 69, 4, 64, 32, 0,
              32, 3, 65, 2, 116, 106, 32, 0, 32, 3, 65, 2, 116, 106, 40, 2, 4,
              65, 1, 32, 4, 116, 65, 127, 115, 113, 34, 1, 54, 2, 4, 32, 1, 69,
              4, 64, 32, 0, 32, 0, 40, 2, 0, 65, 1, 32, 3, 116, 65, 127, 115,
              113, 54, 2, 0, 11, 11, 11, 11, 226, 2, 1, 6, 127, 32, 1, 40, 2, 0,
              33, 3, 32, 1, 65, 16, 106, 32, 1, 40, 2, 0, 65, 124, 113, 106, 34,
              4, 40, 2, 0, 34, 5, 65, 1, 113, 4, 64, 32, 3, 65, 124, 113, 65,
              16, 106, 32, 5, 65, 124, 113, 106, 34, 2, 65, 240, 255, 255, 255,
              3, 73, 4, 64, 32, 0, 32, 4, 16, 1, 32, 1, 32, 2, 32, 3, 65, 3,
              113, 114, 34, 3, 54, 2, 0, 32, 1, 65, 16, 106, 32, 1, 40, 2, 0,
              65, 124, 113, 106, 34, 4, 40, 2, 0, 33, 5, 11, 11, 32, 3, 65, 2,
              113, 4, 64, 32, 1, 65, 4, 107, 40, 2, 0, 34, 2, 40, 2, 0, 34, 6,
              65, 124, 113, 65, 16, 106, 32, 3, 65, 124, 113, 106, 34, 7, 65,
              240, 255, 255, 255, 3, 73, 4, 64, 32, 0, 32, 2, 16, 1, 32, 2, 32,
              7, 32, 6, 65, 3, 113, 114, 34, 3, 54, 2, 0, 32, 2, 33, 1, 11, 11,
              32, 4, 32, 5, 65, 2, 114, 54, 2, 0, 32, 4, 65, 4, 107, 32, 1, 54,
              2, 0, 32, 0, 32, 3, 65, 124, 113, 34, 2, 65, 128, 2, 73, 4, 127,
              32, 2, 65, 4, 118, 33, 4, 65, 0, 5, 32, 2, 65, 31, 32, 2, 103,
              107, 34, 2, 65, 4, 107, 118, 65, 16, 115, 33, 4, 32, 2, 65, 7,
              107, 11, 34, 3, 65, 4, 116, 32, 4, 106, 65, 2, 116, 106, 40, 2,
              96, 33, 2, 32, 1, 65, 0, 54, 2, 16, 32, 1, 32, 2, 54, 2, 20, 32,
              2, 4, 64, 32, 2, 32, 1, 54, 2, 16, 11, 32, 0, 32, 4, 32, 3, 65, 4,
              116, 106, 65, 2, 116, 106, 32, 1, 54, 2, 96, 32, 0, 32, 0, 40, 2,
              0, 65, 1, 32, 3, 116, 114, 54, 2, 0, 32, 0, 32, 3, 65, 2, 116,
              106, 32, 0, 32, 3, 65, 2, 116, 106, 40, 2, 4, 65, 1, 32, 4, 116,
              114, 54, 2, 4, 11, 119, 1, 1, 127, 32, 2, 2, 127, 32, 0, 40, 2,
              160, 12, 34, 2, 4, 64, 32, 2, 32, 1, 65, 16, 107, 70, 4, 64, 32,
              2, 40, 2, 0, 33, 3, 32, 1, 65, 16, 107, 33, 1, 11, 11, 32, 1, 11,
              107, 34, 2, 65, 48, 73, 4, 64, 15, 11, 32, 1, 32, 3, 65, 2, 113,
              32, 2, 65, 32, 107, 65, 1, 114, 114, 54, 2, 0, 32, 1, 65, 0, 54,
              2, 16, 32, 1, 65, 0, 54, 2, 20, 32, 1, 32, 2, 106, 65, 16, 107,
              34, 2, 65, 2, 54, 2, 0, 32, 0, 32, 2, 54, 2, 160, 12, 32, 0, 32,
              1, 16, 2, 11, 155, 1, 1, 3, 127, 35, 0, 34, 0, 69, 4, 64, 65, 1,
              63, 0, 34, 0, 74, 4, 127, 65, 1, 32, 0, 107, 64, 0, 65, 0, 72, 5,
              65, 0, 11, 4, 64, 0, 11, 65, 176, 3, 34, 0, 65, 0, 54, 2, 0, 65,
              208, 15, 65, 0, 54, 2, 0, 3, 64, 32, 1, 65, 23, 73, 4, 64, 32, 1,
              65, 2, 116, 65, 176, 3, 106, 65, 0, 54, 2, 4, 65, 0, 33, 2, 3, 64,
              32, 2, 65, 16, 73, 4, 64, 32, 1, 65, 4, 116, 32, 2, 106, 65, 2,
              116, 65, 176, 3, 106, 65, 0, 54, 2, 96, 32, 2, 65, 1, 106, 33, 2,
              12, 1, 11, 11, 32, 1, 65, 1, 106, 33, 1, 12, 1, 11, 11, 65, 176,
              3, 65, 224, 15, 63, 0, 65, 16, 116, 16, 3, 65, 176, 3, 36, 0, 11,
              32, 0, 11, 45, 0, 32, 0, 65, 240, 255, 255, 255, 3, 79, 4, 64, 65,
              32, 65, 224, 0, 65, 201, 3, 65, 29, 16, 0, 0, 11, 32, 0, 65, 15,
              106, 65, 112, 113, 34, 0, 65, 16, 32, 0, 65, 16, 75, 27, 11, 169,
              1, 1, 1, 127, 32, 0, 32, 1, 65, 128, 2, 73, 4, 127, 32, 1, 65, 4,
              118, 33, 1, 65, 0, 5, 32, 1, 65, 248, 255, 255, 255, 1, 73, 4, 64,
              32, 1, 65, 1, 65, 27, 32, 1, 103, 107, 116, 106, 65, 1, 107, 33,
              1, 11, 32, 1, 65, 31, 32, 1, 103, 107, 34, 2, 65, 4, 107, 118, 65,
              16, 115, 33, 1, 32, 2, 65, 7, 107, 11, 34, 2, 65, 2, 116, 106, 40,
              2, 4, 65, 127, 32, 1, 116, 113, 34, 1, 4, 127, 32, 0, 32, 1, 104,
              32, 2, 65, 4, 116, 106, 65, 2, 116, 106, 40, 2, 96, 5, 32, 0, 40,
              2, 0, 65, 127, 32, 2, 65, 1, 106, 116, 113, 34, 1, 4, 127, 32, 0,
              32, 0, 32, 1, 104, 34, 0, 65, 2, 116, 106, 40, 2, 4, 104, 32, 0,
              65, 4, 116, 106, 65, 2, 116, 106, 40, 2, 96, 5, 65, 0, 11, 11, 11,
              111, 1, 1, 127, 63, 0, 34, 2, 32, 1, 65, 248, 255, 255, 255, 1,
              73, 4, 127, 32, 1, 65, 1, 65, 27, 32, 1, 103, 107, 116, 65, 1,
              107, 106, 5, 32, 1, 11, 65, 16, 32, 0, 40, 2, 160, 12, 32, 2, 65,
              16, 116, 65, 16, 107, 71, 116, 106, 65, 255, 255, 3, 106, 65, 128,
              128, 124, 113, 65, 16, 118, 34, 1, 32, 2, 32, 1, 74, 27, 64, 0,
              65, 0, 72, 4, 64, 32, 1, 64, 0, 65, 0, 72, 4, 64, 0, 11, 11, 32,
              0, 32, 2, 65, 16, 116, 63, 0, 65, 16, 116, 16, 3, 11, 113, 1, 2,
              127, 32, 1, 40, 2, 0, 34, 3, 65, 124, 113, 32, 2, 107, 34, 4, 65,
              32, 79, 4, 64, 32, 1, 32, 2, 32, 3, 65, 2, 113, 114, 54, 2, 0, 32,
              2, 32, 1, 65, 16, 106, 106, 34, 1, 32, 4, 65, 16, 107, 65, 1, 114,
              54, 2, 0, 32, 0, 32, 1, 16, 2, 5, 32, 1, 32, 3, 65, 126, 113, 54,
              2, 0, 32, 1, 65, 16, 106, 32, 1, 40, 2, 0, 65, 124, 113, 106, 32,
              1, 65, 16, 106, 32, 1, 40, 2, 0, 65, 124, 113, 106, 40, 2, 0, 65,
              125, 113, 54, 2, 0, 11, 11, 91, 1, 2, 127, 32, 0, 32, 1, 16, 5,
              34, 4, 16, 6, 34, 3, 69, 4, 64, 65, 1, 36, 1, 65, 0, 36, 1, 32, 0,
              32, 4, 16, 6, 34, 3, 69, 4, 64, 32, 0, 32, 4, 16, 7, 32, 0, 32, 4,
              16, 6, 33, 3, 11, 11, 32, 3, 65, 0, 54, 2, 4, 32, 3, 32, 2, 54, 2,
              8, 32, 3, 32, 1, 54, 2, 12, 32, 0, 32, 3, 16, 1, 32, 0, 32, 3, 32,
              4, 16, 8, 32, 3, 11, 13, 0, 16, 4, 32, 0, 32, 1, 16, 9, 65, 16,
              106, 11, 33, 1, 1, 127, 32, 0, 65, 172, 3, 75, 4, 64, 32, 0, 65,
              16, 107, 34, 1, 32, 1, 40, 2, 4, 65, 1, 106, 54, 2, 4, 11, 32, 0,
              11, 18, 0, 32, 0, 65, 172, 3, 75, 4, 64, 32, 0, 65, 16, 107, 16,
              52, 11, 11, 140, 3, 1, 1, 127, 2, 64, 32, 1, 69, 13, 0, 32, 0, 65,
              0, 58, 0, 0, 32, 0, 32, 1, 106, 65, 1, 107, 65, 0, 58, 0, 0, 32,
              1, 65, 2, 77, 13, 0, 32, 0, 65, 1, 106, 65, 0, 58, 0, 0, 32, 0,
              65, 2, 106, 65, 0, 58, 0, 0, 32, 0, 32, 1, 106, 34, 2, 65, 2, 107,
              65, 0, 58, 0, 0, 32, 2, 65, 3, 107, 65, 0, 58, 0, 0, 32, 1, 65, 6,
              77, 13, 0, 32, 0, 65, 3, 106, 65, 0, 58, 0, 0, 32, 0, 32, 1, 106,
              65, 4, 107, 65, 0, 58, 0, 0, 32, 1, 65, 8, 77, 13, 0, 32, 1, 65,
              0, 32, 0, 107, 65, 3, 113, 34, 1, 107, 33, 2, 32, 0, 32, 1, 106,
              34, 0, 65, 0, 54, 2, 0, 32, 0, 32, 2, 65, 124, 113, 34, 1, 106,
              65, 4, 107, 65, 0, 54, 2, 0, 32, 1, 65, 8, 77, 13, 0, 32, 0, 65,
              4, 106, 65, 0, 54, 2, 0, 32, 0, 65, 8, 106, 65, 0, 54, 2, 0, 32,
              0, 32, 1, 106, 34, 2, 65, 12, 107, 65, 0, 54, 2, 0, 32, 2, 65, 8,
              107, 65, 0, 54, 2, 0, 32, 1, 65, 24, 77, 13, 0, 32, 0, 65, 12,
              106, 65, 0, 54, 2, 0, 32, 0, 65, 16, 106, 65, 0, 54, 2, 0, 32, 0,
              65, 20, 106, 65, 0, 54, 2, 0, 32, 0, 65, 24, 106, 65, 0, 54, 2, 0,
              32, 0, 32, 1, 106, 34, 2, 65, 28, 107, 65, 0, 54, 2, 0, 32, 2, 65,
              24, 107, 65, 0, 54, 2, 0, 32, 2, 65, 20, 107, 65, 0, 54, 2, 0, 32,
              2, 65, 16, 107, 65, 0, 54, 2, 0, 32, 0, 32, 0, 65, 4, 113, 65, 24,
              106, 34, 2, 106, 33, 0, 32, 1, 32, 2, 107, 33, 1, 3, 64, 32, 1,
              65, 32, 79, 4, 64, 32, 0, 66, 0, 55, 3, 0, 32, 0, 65, 8, 106, 66,
              0, 55, 3, 0, 32, 0, 65, 16, 106, 66, 0, 55, 3, 0, 32, 0, 65, 24,
              106, 66, 0, 55, 3, 0, 32, 1, 65, 32, 107, 33, 1, 32, 0, 65, 32,
              106, 33, 0, 12, 1, 11, 11, 11, 11, 178, 1, 1, 3, 127, 32, 1, 65,
              240, 255, 255, 255, 3, 32, 2, 118, 75, 4, 64, 65, 144, 1, 65, 192,
              1, 65, 23, 65, 56, 16, 0, 0, 11, 32, 1, 32, 2, 116, 34, 3, 65, 0,
              16, 10, 34, 2, 32, 3, 16, 13, 32, 0, 69, 4, 64, 65, 12, 65, 2, 16,
              10, 34, 0, 65, 172, 3, 75, 4, 64, 32, 0, 65, 16, 107, 34, 1, 32,
              1, 40, 2, 4, 65, 1, 106, 54, 2, 4, 11, 11, 32, 0, 65, 0, 54, 2, 0,
              32, 0, 65, 0, 54, 2, 4, 32, 0, 65, 0, 54, 2, 8, 32, 2, 34, 1, 32,
              0, 40, 2, 0, 34, 4, 71, 4, 64, 32, 1, 65, 172, 3, 75, 4, 64, 32,
              1, 65, 16, 107, 34, 5, 32, 5, 40, 2, 4, 65, 1, 106, 54, 2, 4, 11,
              32, 4, 16, 12, 11, 32, 0, 32, 1, 54, 2, 0, 32, 0, 32, 2, 54, 2, 4,
              32, 0, 32, 3, 54, 2, 8, 32, 0, 11, 46, 1, 2, 127, 65, 12, 65, 5,
              16, 10, 34, 0, 65, 172, 3, 75, 4, 64, 32, 0, 65, 16, 107, 34, 1,
              32, 1, 40, 2, 4, 65, 1, 106, 54, 2, 4, 11, 32, 0, 65, 128, 2, 65,
              3, 16, 14, 11, 9, 0, 65, 63, 32, 0, 121, 167, 107, 11, 49, 1, 2,
              127, 65, 63, 32, 1, 121, 167, 107, 33, 2, 3, 64, 65, 63, 32, 0,
              121, 167, 107, 32, 2, 107, 34, 3, 65, 0, 78, 4, 64, 32, 0, 32, 1,
              32, 3, 172, 134, 133, 33, 0, 12, 1, 11, 11, 32, 0, 11, 40, 0, 32,
              1, 32, 0, 40, 2, 8, 79, 4, 64, 65, 128, 2, 65, 192, 2, 65, 163, 1,
              65, 44, 16, 0, 0, 11, 32, 1, 32, 0, 40, 2, 4, 106, 65, 0, 58, 0,
              0, 11, 38, 0, 32, 1, 32, 0, 40, 2, 8, 79, 4, 64, 65, 128, 2, 65,
              192, 2, 65, 152, 1, 65, 44, 16, 0, 0, 11, 32, 1, 32, 0, 40, 2, 4,
              106, 45, 0, 0, 11, 254, 5, 2, 1, 127, 4, 126, 32, 0, 69, 4, 64,
              65, 232, 0, 65, 6, 16, 10, 34, 0, 65, 172, 3, 75, 4, 64, 32, 0,
              65, 16, 107, 34, 5, 32, 5, 40, 2, 4, 65, 1, 106, 54, 2, 4, 11, 11,
              32, 0, 65, 0, 54, 2, 0, 32, 0, 65, 0, 54, 2, 4, 32, 0, 65, 0, 54,
              2, 8, 32, 0, 66, 0, 55, 3, 16, 32, 0, 66, 0, 55, 3, 24, 32, 0, 66,
              0, 55, 3, 32, 32, 0, 66, 0, 55, 3, 40, 32, 0, 66, 0, 55, 3, 48,
              32, 0, 66, 0, 55, 3, 56, 32, 0, 66, 0, 55, 3, 64, 32, 0, 66, 0,
              55, 3, 72, 32, 0, 66, 0, 55, 3, 80, 32, 0, 66, 0, 55, 3, 88, 32,
              0, 66, 0, 55, 3, 96, 32, 0, 32, 2, 173, 55, 3, 80, 32, 0, 32, 3,
              173, 55, 3, 88, 65, 12, 65, 4, 16, 10, 34, 2, 65, 172, 3, 75, 4,
              64, 32, 2, 65, 16, 107, 34, 3, 32, 3, 40, 2, 4, 65, 1, 106, 54, 2,
              4, 11, 32, 2, 32, 4, 65, 0, 16, 14, 33, 2, 32, 0, 40, 2, 0, 16,
              12, 32, 0, 32, 2, 54, 2, 0, 32, 0, 32, 4, 54, 2, 4, 32, 0, 66, 1,
              32, 1, 173, 134, 66, 1, 125, 55, 3, 96, 32, 0, 66, 243, 130, 183,
              218, 216, 230, 232, 30, 55, 3, 72, 35, 4, 69, 4, 64, 65, 0, 33, 2,
              3, 64, 32, 2, 65, 128, 2, 72, 4, 64, 32, 2, 65, 255, 1, 113, 173,
              33, 6, 32, 0, 41, 3, 72, 34, 7, 33, 8, 65, 63, 32, 7, 121, 167,
              107, 33, 1, 3, 64, 65, 63, 32, 6, 121, 167, 107, 32, 1, 107, 34,
              3, 65, 0, 78, 4, 64, 32, 6, 32, 8, 32, 3, 172, 134, 133, 33, 6,
              12, 1, 11, 11, 65, 0, 33, 4, 3, 64, 32, 4, 32, 0, 40, 2, 4, 65, 1,
              107, 72, 4, 64, 32, 6, 66, 8, 134, 33, 6, 32, 0, 41, 3, 72, 34, 7,
              33, 8, 65, 63, 32, 7, 121, 167, 107, 33, 1, 3, 64, 65, 63, 32, 6,
              121, 167, 107, 32, 1, 107, 34, 3, 65, 0, 78, 4, 64, 32, 6, 32, 8,
              32, 3, 172, 134, 133, 33, 6, 12, 1, 11, 11, 32, 4, 65, 1, 106, 33,
              4, 12, 1, 11, 11, 35, 6, 40, 2, 4, 32, 2, 65, 3, 116, 106, 32, 6,
              55, 3, 0, 32, 2, 65, 1, 106, 33, 2, 12, 1, 11, 11, 65, 63, 32, 0,
              41, 3, 72, 121, 167, 107, 172, 33, 7, 65, 0, 33, 2, 3, 64, 32, 2,
              65, 128, 2, 72, 4, 64, 35, 5, 33, 1, 32, 2, 172, 32, 7, 134, 34,
              8, 33, 6, 65, 63, 32, 0, 41, 3, 72, 34, 9, 121, 167, 107, 33, 3,
              3, 64, 65, 63, 32, 6, 121, 167, 107, 32, 3, 107, 34, 4, 65, 0, 78,
              4, 64, 32, 6, 32, 9, 32, 4, 172, 134, 133, 33, 6, 12, 1, 11, 11,
              32, 1, 40, 2, 4, 32, 2, 65, 3, 116, 106, 32, 6, 32, 8, 132, 55, 3,
              0, 32, 2, 65, 1, 106, 33, 2, 12, 1, 11, 11, 65, 1, 36, 4, 11, 32,
              0, 66, 0, 55, 3, 24, 32, 0, 66, 0, 55, 3, 32, 65, 0, 33, 2, 3, 64,
              32, 2, 32, 0, 40, 2, 4, 72, 4, 64, 32, 0, 40, 2, 0, 32, 2, 16, 18,
              32, 2, 65, 1, 106, 33, 2, 12, 1, 11, 11, 32, 0, 66, 0, 55, 3, 40,
              32, 0, 65, 0, 54, 2, 8, 32, 0, 66, 0, 55, 3, 16, 32, 0, 66, 0, 55,
              3, 40, 32, 0, 40, 2, 0, 32, 0, 40, 2, 8, 16, 19, 33, 1, 32, 0, 40,
              2, 8, 32, 0, 40, 2, 0, 40, 2, 4, 106, 65, 1, 58, 0, 0, 32, 0, 32,
              0, 41, 3, 40, 35, 6, 40, 2, 4, 32, 1, 65, 3, 116, 106, 41, 3, 0,
              133, 55, 3, 40, 32, 0, 32, 0, 40, 2, 8, 65, 1, 106, 32, 0, 40, 2,
              4, 111, 54, 2, 8, 32, 0, 35, 5, 40, 2, 4, 32, 0, 41, 3, 40, 34, 6,
              66, 45, 136, 167, 65, 3, 116, 106, 41, 3, 0, 32, 6, 66, 8, 134,
              66, 1, 132, 133, 55, 3, 40, 32, 0, 11, 38, 1, 1, 127, 32, 0, 40,
              2, 0, 34, 0, 65, 172, 3, 75, 4, 64, 32, 0, 65, 16, 107, 34, 1, 32,
              1, 40, 2, 4, 65, 1, 106, 54, 2, 4, 11, 32, 0, 11, 55, 1, 2, 127,
              32, 1, 32, 0, 40, 2, 0, 34, 2, 71, 4, 64, 32, 1, 65, 172, 3, 75,
              4, 64, 32, 1, 65, 16, 107, 34, 3, 32, 3, 40, 2, 4, 65, 1, 106, 54,
              2, 4, 11, 32, 2, 16, 12, 11, 32, 0, 32, 1, 54, 2, 0, 11, 7, 0, 32,
              0, 40, 2, 4, 11, 9, 0, 32, 0, 32, 1, 54, 2, 4, 11, 7, 0, 32, 0,
              40, 2, 8, 11, 9, 0, 32, 0, 32, 1, 54, 2, 8, 11, 7, 0, 32, 0, 41,
              3, 16, 11, 9, 0, 32, 0, 32, 1, 55, 3, 16, 11, 7, 0, 32, 0, 41, 3,
              24, 11, 9, 0, 32, 0, 32, 1, 55, 3, 24, 11, 7, 0, 32, 0, 41, 3, 32,
              11, 9, 0, 32, 0, 32, 1, 55, 3, 32, 11, 7, 0, 32, 0, 41, 3, 40, 11,
              9, 0, 32, 0, 32, 1, 55, 3, 40, 11, 7, 0, 32, 0, 41, 3, 48, 11, 9,
              0, 32, 0, 32, 1, 55, 3, 48, 11, 7, 0, 32, 0, 41, 3, 56, 11, 9, 0,
              32, 0, 32, 1, 55, 3, 56, 11, 7, 0, 32, 0, 41, 3, 64, 11, 9, 0, 32,
              0, 32, 1, 55, 3, 64, 11, 7, 0, 32, 0, 41, 3, 72, 11, 9, 0, 32, 0,
              32, 1, 55, 3, 72, 11, 7, 0, 32, 0, 41, 3, 80, 11, 9, 0, 32, 0, 32,
              1, 55, 3, 80, 11, 7, 0, 32, 0, 41, 3, 88, 11, 9, 0, 32, 0, 32, 1,
              55, 3, 88, 11, 7, 0, 32, 0, 41, 3, 96, 11, 9, 0, 32, 0, 32, 1, 55,
              3, 96, 11, 172, 4, 2, 5, 127, 1, 126, 32, 2, 65, 172, 3, 75, 4,
              64, 32, 2, 65, 16, 107, 34, 4, 32, 4, 40, 2, 4, 65, 1, 106, 54, 2,
              4, 11, 32, 2, 33, 4, 65, 0, 33, 2, 32, 1, 40, 2, 8, 33, 5, 32, 1,
              40, 2, 4, 33, 6, 3, 64, 2, 127, 65, 0, 33, 3, 3, 64, 32, 3, 32, 5,
              72, 4, 64, 32, 3, 32, 6, 106, 45, 0, 0, 33, 1, 32, 0, 40, 2, 0,
              32, 0, 40, 2, 8, 16, 19, 33, 7, 32, 0, 40, 2, 8, 32, 0, 40, 2, 0,
              40, 2, 4, 106, 32, 1, 58, 0, 0, 32, 0, 32, 0, 41, 3, 40, 35, 6,
              40, 2, 4, 32, 7, 65, 3, 116, 106, 41, 3, 0, 133, 55, 3, 40, 32, 0,
              32, 0, 40, 2, 8, 65, 1, 106, 32, 0, 40, 2, 4, 111, 54, 2, 8, 32,
              0, 35, 5, 40, 2, 4, 32, 0, 41, 3, 40, 34, 8, 66, 45, 136, 167, 65,
              3, 116, 106, 41, 3, 0, 32, 1, 173, 32, 8, 66, 8, 134, 132, 133,
              55, 3, 40, 32, 0, 32, 0, 41, 3, 16, 66, 1, 124, 55, 3, 16, 32, 0,
              32, 0, 41, 3, 24, 66, 1, 124, 55, 3, 24, 32, 0, 41, 3, 16, 32, 0,
              41, 3, 80, 90, 4, 127, 32, 0, 41, 3, 40, 32, 0, 41, 3, 96, 131,
              80, 5, 65, 0, 11, 4, 127, 65, 1, 5, 32, 0, 41, 3, 16, 32, 0, 41,
              3, 88, 90, 11, 4, 64, 32, 0, 32, 0, 41, 3, 32, 55, 3, 48, 32, 0,
              32, 0, 41, 3, 16, 55, 3, 56, 32, 0, 32, 0, 41, 3, 40, 55, 3, 64,
              65, 0, 33, 1, 3, 64, 32, 1, 32, 0, 40, 2, 4, 72, 4, 64, 32, 0, 40,
              2, 0, 32, 1, 16, 18, 32, 1, 65, 1, 106, 33, 1, 12, 1, 11, 11, 32,
              0, 66, 0, 55, 3, 40, 32, 0, 65, 0, 54, 2, 8, 32, 0, 66, 0, 55, 3,
              16, 32, 0, 66, 0, 55, 3, 40, 32, 0, 40, 2, 0, 32, 0, 40, 2, 8, 16,
              19, 33, 1, 32, 0, 40, 2, 8, 32, 0, 40, 2, 0, 40, 2, 4, 106, 65, 1,
              58, 0, 0, 32, 0, 32, 0, 41, 3, 40, 35, 6, 40, 2, 4, 32, 1, 65, 3,
              116, 106, 41, 3, 0, 133, 55, 3, 40, 32, 0, 32, 0, 40, 2, 8, 65, 1,
              106, 32, 0, 40, 2, 4, 111, 54, 2, 8, 32, 0, 35, 5, 40, 2, 4, 32,
              0, 41, 3, 40, 34, 8, 66, 45, 136, 167, 65, 3, 116, 106, 41, 3, 0,
              32, 8, 66, 8, 134, 66, 1, 132, 133, 55, 3, 40, 32, 3, 65, 1, 106,
              12, 3, 11, 32, 3, 65, 1, 106, 33, 3, 12, 1, 11, 11, 65, 127, 11,
              34, 1, 65, 0, 78, 4, 64, 32, 5, 32, 1, 107, 33, 5, 32, 1, 32, 6,
              106, 33, 6, 32, 2, 34, 1, 65, 1, 106, 33, 2, 32, 4, 40, 2, 4, 32,
              1, 65, 2, 116, 106, 32, 0, 41, 3, 56, 62, 2, 0, 12, 1, 11, 11, 32,
              4, 11, 10, 0, 16, 15, 36, 5, 16, 15, 36, 6, 11, 3, 0, 1, 11, 73,
              1, 2, 127, 32, 0, 40, 2, 4, 34, 1, 65, 255, 255, 255, 255, 0, 113,
              34, 2, 65, 1, 70, 4, 64, 32, 0, 65, 16, 106, 16, 53, 32, 0, 32, 0,
              40, 2, 0, 65, 1, 114, 54, 2, 0, 35, 0, 32, 0, 16, 2, 5, 32, 0, 32,
              2, 65, 1, 107, 32, 1, 65, 128, 128, 128, 128, 127, 113, 114, 54,
              2, 4, 11, 11, 58, 0, 2, 64, 2, 64, 2, 64, 32, 0, 65, 8, 107, 40,
              2, 0, 14, 7, 0, 0, 1, 1, 1, 1, 1, 2, 11, 15, 11, 32, 0, 40, 2, 0,
              34, 0, 4, 64, 32, 0, 65, 172, 3, 79, 4, 64, 32, 0, 65, 16, 107,
              16, 52, 11, 11, 15, 11, 0, 11, 11, 137, 3, 7, 0, 65, 16, 11, 55,
              40, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 40, 0, 0, 0, 97, 0, 108, 0,
              108, 0, 111, 0, 99, 0, 97, 0, 116, 0, 105, 0, 111, 0, 110, 0, 32,
              0, 116, 0, 111, 0, 111, 0, 32, 0, 108, 0, 97, 0, 114, 0, 103, 0,
              101, 0, 65, 208, 0, 11, 45, 30, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0,
              30, 0, 0, 0, 126, 0, 108, 0, 105, 0, 98, 0, 47, 0, 114, 0, 116, 0,
              47, 0, 116, 0, 108, 0, 115, 0, 102, 0, 46, 0, 116, 0, 115, 0, 65,
              128, 1, 11, 43, 28, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 28, 0, 0, 0,
              73, 0, 110, 0, 118, 0, 97, 0, 108, 0, 105, 0, 100, 0, 32, 0, 108,
              0, 101, 0, 110, 0, 103, 0, 116, 0, 104, 0, 65, 176, 1, 11, 53, 38,
              0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 38, 0, 0, 0, 126, 0, 108, 0, 105,
              0, 98, 0, 47, 0, 97, 0, 114, 0, 114, 0, 97, 0, 121, 0, 98, 0, 117,
              0, 102, 0, 102, 0, 101, 0, 114, 0, 46, 0, 116, 0, 115, 0, 65, 240,
              1, 11, 51, 36, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 36, 0, 0, 0, 73,
              0, 110, 0, 100, 0, 101, 0, 120, 0, 32, 0, 111, 0, 117, 0, 116, 0,
              32, 0, 111, 0, 102, 0, 32, 0, 114, 0, 97, 0, 110, 0, 103, 0, 101,
              0, 65, 176, 2, 11, 51, 36, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 36, 0,
              0, 0, 126, 0, 108, 0, 105, 0, 98, 0, 47, 0, 116, 0, 121, 0, 112,
              0, 101, 0, 100, 0, 97, 0, 114, 0, 114, 0, 97, 0, 121, 0, 46, 0,
              116, 0, 115, 0, 65, 240, 2, 11, 53, 7, 0, 0, 0, 16, 0, 0, 0, 0, 0,
              0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0, 0, 0, 0, 0, 145, 4, 0,
              0, 2, 0, 0, 0, 49, 0, 0, 0, 2, 0, 0, 0, 17, 1, 0, 0, 2, 0, 0, 0,
              16, 0, 34, 16, 115, 111, 117, 114, 99, 101, 77, 97, 112, 112, 105,
              110, 103, 85, 82, 76, 16, 46, 47, 114, 97, 98, 105, 110, 46, 119,
              97, 115, 109, 46, 109, 97, 112,
            ]);
            // make it work async because browsers throw when a wasm module is bigger than 4kb and load sync
            return instantiate(
              new Response(new Blob([wasm], { type: "application/wasm" })),
              imp
            );
          }
          module.exports = loadWebAssembly;
        },
        { "@assemblyscript/loader": 2 },
      ],
      150: [
        function (require, module, exports) {
          const Rabin = require("./rabin");
          const getRabin = require("../dist/rabin-wasm.node.js");

          const create = async (avg, min, max, windowSize, polynomial) => {
            const compiled = await getRabin();
            return new Rabin(compiled, avg, min, max, windowSize, polynomial);
          };

          module.exports = {
            Rabin,
            create,
          };
        },
        { "../dist/rabin-wasm.node.js": 149, "./rabin": 151 },
      ],
      151: [
        function (require, module, exports) {
          /**
           * Rabin fingerprinting
           *
           * @class Rabin
           */
          class Rabin {
            /**
             * Creates an instance of Rabin.
             * @param { import("./../dist/rabin-wasm") } asModule
             * @param {number} [bits=12]
             * @param {number} [min=8 * 1024]
             * @param {number} [max=32 * 1024]
             * @param {number} polynomial
             * @memberof Rabin
             */
            constructor(
              asModule,
              bits = 12,
              min = 8 * 1024,
              max = 32 * 1024,
              windowSize = 64,
              polynomial
            ) {
              this.bits = bits;
              this.min = min;
              this.max = max;
              this.asModule = asModule;
              this.rabin = new asModule.Rabin(
                bits,
                min,
                max,
                windowSize,
                polynomial
              );
              this.polynomial = polynomial;
            }

            /**
             * Fingerprints the buffer
             *
             * @param {Uint8Array} buf
             * @returns {Array<number>}
             * @memberof Rabin
             */
            fingerprint(buf) {
              const {
                __retain,
                __release,
                __allocArray,
                __getInt32Array,
                Int32Array_ID,
                Uint8Array_ID,
              } = this.asModule;

              const lengths = new Int32Array(Math.ceil(buf.length / this.min));
              const lengthsPtr = __retain(__allocArray(Int32Array_ID, lengths));
              const pointer = __retain(__allocArray(Uint8Array_ID, buf));

              const out = this.rabin.fingerprint(pointer, lengthsPtr);
              const processed = __getInt32Array(out);

              __release(pointer);
              __release(lengthsPtr);

              const end = processed.indexOf(0);
              return end >= 0 ? processed.subarray(0, end) : processed;
            }
          }

          module.exports = Rabin;
        },
        {},
      ],
      152: [
        function (require, module, exports) {
          "use strict";

          // JS treats subjects of bitwise operators as SIGNED 32 bit numbers,
          // which means the maximum amount of bits we can store inside each byte
          // is 7..
          const BITS_PER_BYTE = 7;

          module.exports = class SparseArray {
            constructor() {
              this._bitArrays = [];
              this._data = [];
              this._length = 0;
              this._changedLength = false;
              this._changedData = false;
            }

            set(index, value) {
              let pos = this._internalPositionFor(index, false);
              if (value === undefined) {
                // unsetting
                if (pos !== -1) {
                  // remove item from bit array and array itself
                  this._unsetInternalPos(pos);
                  this._unsetBit(index);
                  this._changedLength = true;
                  this._changedData = true;
                }
              } else {
                let needsSort = false;
                if (pos === -1) {
                  pos = this._data.length;
                  this._setBit(index);
                  this._changedData = true;
                } else {
                  needsSort = true;
                }
                this._setInternalPos(pos, index, value, needsSort);
                this._changedLength = true;
              }
            }

            unset(index) {
              this.set(index, undefined);
            }

            get(index) {
              this._sortData();
              const pos = this._internalPositionFor(index, true);
              if (pos === -1) {
                return undefined;
              }
              return this._data[pos][1];
            }

            push(value) {
              this.set(this.length, value);
              return this.length;
            }

            get length() {
              this._sortData();
              if (this._changedLength) {
                const last = this._data[this._data.length - 1];
                this._length = last ? last[0] + 1 : 0;
                this._changedLength = false;
              }
              return this._length;
            }

            forEach(iterator) {
              let i = 0;
              while (i < this.length) {
                iterator(this.get(i), i, this);
                i++;
              }
            }

            map(iterator) {
              let i = 0;
              let mapped = new Array(this.length);
              while (i < this.length) {
                mapped[i] = iterator(this.get(i), i, this);
                i++;
              }
              return mapped;
            }

            reduce(reducer, initialValue) {
              let i = 0;
              let acc = initialValue;
              while (i < this.length) {
                const value = this.get(i);
                acc = reducer(acc, value, i);
                i++;
              }
              return acc;
            }

            find(finder) {
              let i = 0,
                found,
                last;
              while (i < this.length && !found) {
                last = this.get(i);
                found = finder(last);
                i++;
              }
              return found ? last : undefined;
            }

            _internalPositionFor(index, noCreate) {
              const bytePos = this._bytePosFor(index, noCreate);
              if (bytePos >= this._bitArrays.length) {
                return -1;
              }
              const byte = this._bitArrays[bytePos];
              const bitPos = index - bytePos * BITS_PER_BYTE;
              const exists = (byte & (1 << bitPos)) > 0;
              if (!exists) {
                return -1;
              }
              const previousPopCount = this._bitArrays
                .slice(0, bytePos)
                .reduce(popCountReduce, 0);

              const mask = ~(0xffffffff << (bitPos + 1));
              const bytePopCount = popCount(byte & mask);
              const arrayPos = previousPopCount + bytePopCount - 1;
              return arrayPos;
            }

            _bytePosFor(index, noCreate) {
              const bytePos = Math.floor(index / BITS_PER_BYTE);
              const targetLength = bytePos + 1;
              while (!noCreate && this._bitArrays.length < targetLength) {
                this._bitArrays.push(0);
              }
              return bytePos;
            }

            _setBit(index) {
              const bytePos = this._bytePosFor(index, false);
              this._bitArrays[bytePos] |=
                1 << (index - bytePos * BITS_PER_BYTE);
            }

            _unsetBit(index) {
              const bytePos = this._bytePosFor(index, false);
              this._bitArrays[bytePos] &= ~(
                1 <<
                (index - bytePos * BITS_PER_BYTE)
              );
            }

            _setInternalPos(pos, index, value, needsSort) {
              const data = this._data;
              const elem = [index, value];
              if (needsSort) {
                this._sortData();
                data[pos] = elem;
              } else {
                // new element. just shove it into the array
                // but be nice about where we shove it
                // in order to make sorting it later easier
                if (data.length) {
                  if (data[data.length - 1][0] >= index) {
                    data.push(elem);
                  } else if (data[0][0] <= index) {
                    data.unshift(elem);
                  } else {
                    const randomIndex = Math.round(data.length / 2);
                    this._data = data
                      .slice(0, randomIndex)
                      .concat(elem)
                      .concat(data.slice(randomIndex));
                  }
                } else {
                  this._data.push(elem);
                }
                this._changedData = true;
                this._changedLength = true;
              }
            }

            _unsetInternalPos(pos) {
              this._data.splice(pos, 1);
            }

            _sortData() {
              if (this._changedData) {
                this._data.sort(sortInternal);
              }

              this._changedData = false;
            }

            bitField() {
              const bytes = [];
              let pendingBitsForResultingByte = 8;
              let pendingBitsForNewByte = 0;
              let resultingByte = 0;
              let newByte;
              const pending = this._bitArrays.slice();
              while (pending.length || pendingBitsForNewByte) {
                if (pendingBitsForNewByte === 0) {
                  newByte = pending.shift();
                  pendingBitsForNewByte = 7;
                }

                const usingBits = Math.min(
                  pendingBitsForNewByte,
                  pendingBitsForResultingByte
                );
                const mask = ~(0b11111111 << usingBits);
                const masked = newByte & mask;
                resultingByte |= masked << (8 - pendingBitsForResultingByte);
                newByte = newByte >>> usingBits;
                pendingBitsForNewByte -= usingBits;
                pendingBitsForResultingByte -= usingBits;

                if (
                  !pendingBitsForResultingByte ||
                  (!pendingBitsForNewByte && !pending.length)
                ) {
                  bytes.push(resultingByte);
                  resultingByte = 0;
                  pendingBitsForResultingByte = 8;
                }
              }

              // remove trailing zeroes
              for (var i = bytes.length - 1; i > 0; i--) {
                const value = bytes[i];
                if (value === 0) {
                  bytes.pop();
                } else {
                  break;
                }
              }

              return bytes;
            }

            compactArray() {
              this._sortData();
              return this._data.map(valueOnly);
            }
          };

          function popCountReduce(count, byte) {
            return count + popCount(byte);
          }

          function popCount(_v) {
            let v = _v;
            v = v - ((v >> 1) & 0x55555555); // reuse input as temporary
            v = (v & 0x33333333) + ((v >> 2) & 0x33333333); // temp
            return (((v + (v >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
          }

          function sortInternal(a, b) {
            return a[0] - b[0];
          }

          function valueOnly(elem) {
            return elem[1];
          }
        },
        {},
      ],
      153: [
        function (require, module, exports) {
          //! stable.js 0.1.8, https://github.com/Two-Screen/stable
          //! © 2018 Angry Bytes and contributors. MIT licensed.

          (function (global, factory) {
            typeof exports === "object" && typeof module !== "undefined"
              ? (module.exports = factory())
              : typeof define === "function" && define.amd
              ? define(factory)
              : (global.stable = factory());
          })(this, function () {
            "use strict";

            // A stable array sort, because `Array#sort()` is not guaranteed stable.
            // This is an implementation of merge sort, without recursion.

            var stable = function (arr, comp) {
              return exec(arr.slice(), comp);
            };

            stable.inplace = function (arr, comp) {
              var result = exec(arr, comp);

              // This simply copies back if the result isn't in the original array,
              // which happens on an odd number of passes.
              if (result !== arr) {
                pass(result, null, arr.length, arr);
              }

              return arr;
            };

            // Execute the sort using the input array and a second buffer as work space.
            // Returns one of those two, containing the final result.
            function exec(arr, comp) {
              if (typeof comp !== "function") {
                comp = function (a, b) {
                  return String(a).localeCompare(b);
                };
              }

              // Short-circuit when there's nothing to sort.
              var len = arr.length;
              if (len <= 1) {
                return arr;
              }

              // Rather than dividing input, simply iterate chunks of 1, 2, 4, 8, etc.
              // Chunks are the size of the left or right hand in merge sort.
              // Stop when the left-hand covers all of the array.
              var buffer = new Array(len);
              for (var chk = 1; chk < len; chk *= 2) {
                pass(arr, comp, chk, buffer);

                var tmp = arr;
                arr = buffer;
                buffer = tmp;
              }

              return arr;
            }

            // Run a single pass with the given chunk size.
            var pass = function (arr, comp, chk, result) {
              var len = arr.length;
              var i = 0;
              // Step size / double chunk size.
              var dbl = chk * 2;
              // Bounds of the left and right chunks.
              var l, r, e;
              // Iterators over the left and right chunk.
              var li, ri;

              // Iterate over pairs of chunks.
              for (l = 0; l < len; l += dbl) {
                r = l + chk;
                e = r + chk;
                if (r > len) r = len;
                if (e > len) e = len;

                // Iterate both chunks in parallel.
                li = l;
                ri = r;
                while (true) {
                  // Compare the chunks.
                  if (li < r && ri < e) {
                    // This works for a regular `sort()` compatible comparator,
                    // but also for a simple comparator like: `a > b`
                    if (comp(arr[li], arr[ri]) <= 0) {
                      result[i++] = arr[li++];
                    } else {
                      result[i++] = arr[ri++];
                    }
                  }
                  // Nothing to compare, just flush what's left.
                  else if (li < r) {
                    result[i++] = arr[li++];
                  } else if (ri < e) {
                    result[i++] = arr[ri++];
                  }
                  // Both iterators are at the chunk ends.
                  else {
                    break;
                  }
                }
              }
            };

            return stable;
          });
        },
        {},
      ],
      154: [
        function (require, module, exports) {
          "use strict";

          /**
           * Can be used with Array.sort to sort and array with Uint8Array entries
           *
           * @param {Uint8Array} a
           * @param {Uint8Array} b
           */
          function compare(a, b) {
            for (let i = 0; i < a.byteLength; i++) {
              if (a[i] < b[i]) {
                return -1;
              }

              if (a[i] > b[i]) {
                return 1;
              }
            }

            if (a.byteLength > b.byteLength) {
              return 1;
            }

            if (a.byteLength < b.byteLength) {
              return -1;
            }

            return 0;
          }

          module.exports = compare;
        },
        {},
      ],
      155: [
        function (require, module, exports) {
          "use strict";

          /**
           * Returns true if the two passed Uint8Arrays have the same content
           *
           * @param {Uint8Array} a
           * @param {Uint8Array} b
           */
          function equals(a, b) {
            if (a === b) {
              return true;
            }

            if (a.byteLength !== b.byteLength) {
              return false;
            }

            for (let i = 0; i < a.byteLength; i++) {
              if (a[i] !== b[i]) {
                return false;
              }
            }

            return true;
          }

          module.exports = equals;
        },
        {},
      ],
      156: [
        function (require, module, exports) {
          "use strict";

          const bases = require("./util/bases");

          /**
           * @typedef {import('./util/bases').SupportedEncodings} SupportedEncodings
           */

          /**
           * Create a `Uint8Array` from the passed string
           *
           * Supports `utf8`, `utf-8`, `hex`, and any encoding supported by the multiformats module.
           *
           * Also `ascii` which is similar to node's 'binary' encoding.
           *
           * @param {string} string
           * @param {SupportedEncodings} [encoding=utf8] - utf8, base16, base64, base64urlpad, etc
           * @returns {Uint8Array}
           */
          function fromString(string, encoding = "utf8") {
            const base = bases[encoding];

            if (!base) {
              throw new Error(`Unsupported encoding "${encoding}"`);
            }

            // add multibase prefix
            return base.decoder.decode(`${base.prefix}${string}`);
          }

          module.exports = fromString;
        },
        { "./util/bases": 158 },
      ],
      157: [
        function (require, module, exports) {
          "use strict";

          const bases = require("./util/bases");

          /**
           * @typedef {import('./util/bases').SupportedEncodings} SupportedEncodings
           */

          /**
           * Turns a `Uint8Array` into a string.
           *
           * Supports `utf8`, `utf-8` and any encoding supported by the multibase module.
           *
           * Also `ascii` which is similar to node's 'binary' encoding.
           *
           * @param {Uint8Array} array - The array to turn into a string
           * @param {SupportedEncodings} [encoding=utf8] - The encoding to use
           * @returns {string}
           */
          function toString(array, encoding = "utf8") {
            const base = bases[encoding];

            if (!base) {
              throw new Error(`Unsupported encoding "${encoding}"`);
            }

            // strip multibase prefix
            return base.encoder.encode(array).substring(1);
          }

          module.exports = toString;
        },
        { "./util/bases": 158 },
      ],
      158: [
        function (require, module, exports) {
          "use strict";

          const { bases } = require("multiformats/basics");

          /**
           * @typedef {import('multiformats/bases/interface').MultibaseCodec<any>} MultibaseCodec
           */

          /**
           * @param {string} name
           * @param {string} prefix
           * @param {(buf: Uint8Array) => string} encode
           * @param {(str: string) => Uint8Array} decode
           * @returns {MultibaseCodec}
           */
          function createCodec(name, prefix, encode, decode) {
            return {
              name,
              prefix,
              encoder: {
                name,
                prefix,
                encode,
              },
              decoder: {
                decode,
              },
            };
          }

          const string = createCodec(
            "utf8",
            "u",
            (buf) => {
              const decoder = new TextDecoder("utf8");
              return "u" + decoder.decode(buf);
            },
            (str) => {
              const encoder = new TextEncoder();
              return encoder.encode(str.substring(1));
            }
          );

          const ascii = createCodec(
            "ascii",
            "a",
            (buf) => {
              let string = "a";

              for (let i = 0; i < buf.length; i++) {
                string += String.fromCharCode(buf[i]);
              }
              return string;
            },
            (str) => {
              str = str.substring(1);
              const buf = new Uint8Array(str.length);

              for (let i = 0; i < str.length; i++) {
                buf[i] = str.charCodeAt(i);
              }

              return buf;
            }
          );

          /**
           * @typedef {'utf8' | 'utf-8' | 'hex' | 'latin1' | 'ascii' | 'binary' | keyof bases } SupportedEncodings
           */

          /**
           * @type {Record<SupportedEncodings, MultibaseCodec>}
           */
          const BASES = {
            utf8: string,
            "utf-8": string,
            hex: bases.base16,
            latin1: ascii,
            ascii: ascii,
            binary: ascii,

            ...bases,
          };

          module.exports = BASES;
        },
        { "multiformats/basics": 101 },
      ],
      159: [
        function (require, module, exports) {
          module.exports = read;

          var MSB = 0x80,
            REST = 0x7f;

          function read(buf, offset) {
            var res = 0,
              offset = offset || 0,
              shift = 0,
              counter = offset,
              b,
              l = buf.length;

            do {
              if (counter >= l || shift > 49) {
                read.bytes = 0;
                throw new RangeError("Could not decode varint");
              }
              b = buf[counter++];
              res +=
                shift < 28
                  ? (b & REST) << shift
                  : (b & REST) * Math.pow(2, shift);
              shift += 7;
            } while (b >= MSB);

            read.bytes = counter - offset;

            return res;
          }
        },
        {},
      ],
      160: [
        function (require, module, exports) {
          module.exports = encode;

          var MSB = 0x80,
            REST = 0x7f,
            MSBALL = ~REST,
            INT = Math.pow(2, 31);

          function encode(num, out, offset) {
            if (Number.MAX_SAFE_INTEGER && num > Number.MAX_SAFE_INTEGER) {
              encode.bytes = 0;
              throw new RangeError("Could not encode varint");
            }
            out = out || [];
            offset = offset || 0;
            var oldOffset = offset;

            while (num >= INT) {
              out[offset++] = (num & 0xff) | MSB;
              num /= 128;
            }
            while (num & MSBALL) {
              out[offset++] = (num & 0xff) | MSB;
              num >>>= 7;
            }
            out[offset] = num | 0;

            encode.bytes = offset - oldOffset + 1;

            return out;
          }
        },
        {},
      ],
      161: [
        function (require, module, exports) {
          arguments[4][122][0].apply(exports, arguments);
        },
        {
          "./decode.js": 159,
          "./encode.js": 160,
          "./length.js": 162,
          dup: 122,
        },
      ],
      162: [
        function (require, module, exports) {
          arguments[4][123][0].apply(exports, arguments);
        },
        { dup: 123 },
      ],
      163: [
        function (require, module, exports) {
          "use strict";

          exports.byteLength = byteLength;
          exports.toByteArray = toByteArray;
          exports.fromByteArray = fromByteArray;

          var lookup = [];
          var revLookup = [];
          var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;

          var code =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          for (var i = 0, len = code.length; i < len; ++i) {
            lookup[i] = code[i];
            revLookup[code.charCodeAt(i)] = i;
          }

          // Support decoding URL-safe base64 strings, as Node.js does.
          // See: https://en.wikipedia.org/wiki/Base64#URL_applications
          revLookup["-".charCodeAt(0)] = 62;
          revLookup["_".charCodeAt(0)] = 63;

          function getLens(b64) {
            var len = b64.length;

            if (len % 4 > 0) {
              throw new Error("Invalid string. Length must be a multiple of 4");
            }

            // Trim off extra bytes after placeholder bytes are found
            // See: https://github.com/beatgammit/base64-js/issues/42
            var validLen = b64.indexOf("=");
            if (validLen === -1) validLen = len;

            var placeHoldersLen = validLen === len ? 0 : 4 - (validLen % 4);

            return [validLen, placeHoldersLen];
          }

          // base64 is 4/3 + up to two characters of the original data
          function byteLength(b64) {
            var lens = getLens(b64);
            var validLen = lens[0];
            var placeHoldersLen = lens[1];
            return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
          }

          function _byteLength(b64, validLen, placeHoldersLen) {
            return ((validLen + placeHoldersLen) * 3) / 4 - placeHoldersLen;
          }

          function toByteArray(b64) {
            var tmp;
            var lens = getLens(b64);
            var validLen = lens[0];
            var placeHoldersLen = lens[1];

            var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

            var curByte = 0;

            // if there are placeholders, only get up to the last complete 4 chars
            var len = placeHoldersLen > 0 ? validLen - 4 : validLen;

            var i;
            for (i = 0; i < len; i += 4) {
              tmp =
                (revLookup[b64.charCodeAt(i)] << 18) |
                (revLookup[b64.charCodeAt(i + 1)] << 12) |
                (revLookup[b64.charCodeAt(i + 2)] << 6) |
                revLookup[b64.charCodeAt(i + 3)];
              arr[curByte++] = (tmp >> 16) & 0xff;
              arr[curByte++] = (tmp >> 8) & 0xff;
              arr[curByte++] = tmp & 0xff;
            }

            if (placeHoldersLen === 2) {
              tmp =
                (revLookup[b64.charCodeAt(i)] << 2) |
                (revLookup[b64.charCodeAt(i + 1)] >> 4);
              arr[curByte++] = tmp & 0xff;
            }

            if (placeHoldersLen === 1) {
              tmp =
                (revLookup[b64.charCodeAt(i)] << 10) |
                (revLookup[b64.charCodeAt(i + 1)] << 4) |
                (revLookup[b64.charCodeAt(i + 2)] >> 2);
              arr[curByte++] = (tmp >> 8) & 0xff;
              arr[curByte++] = tmp & 0xff;
            }

            return arr;
          }

          function tripletToBase64(num) {
            return (
              lookup[(num >> 18) & 0x3f] +
              lookup[(num >> 12) & 0x3f] +
              lookup[(num >> 6) & 0x3f] +
              lookup[num & 0x3f]
            );
          }

          function encodeChunk(uint8, start, end) {
            var tmp;
            var output = [];
            for (var i = start; i < end; i += 3) {
              tmp =
                ((uint8[i] << 16) & 0xff0000) +
                ((uint8[i + 1] << 8) & 0xff00) +
                (uint8[i + 2] & 0xff);
              output.push(tripletToBase64(tmp));
            }
            return output.join("");
          }

          function fromByteArray(uint8) {
            var tmp;
            var len = uint8.length;
            var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
            var parts = [];
            var maxChunkLength = 16383; // must be multiple of 3

            // go through the array every three bytes, we'll deal with trailing stuff later
            for (
              var i = 0, len2 = len - extraBytes;
              i < len2;
              i += maxChunkLength
            ) {
              parts.push(
                encodeChunk(
                  uint8,
                  i,
                  i + maxChunkLength > len2 ? len2 : i + maxChunkLength
                )
              );
            }

            // pad the end with zeros, but make sure to not forget the extra bytes
            if (extraBytes === 1) {
              tmp = uint8[len - 1];
              parts.push(lookup[tmp >> 2] + lookup[(tmp << 4) & 0x3f] + "==");
            } else if (extraBytes === 2) {
              tmp = (uint8[len - 2] << 8) + uint8[len - 1];
              parts.push(
                lookup[tmp >> 10] +
                  lookup[(tmp >> 4) & 0x3f] +
                  lookup[(tmp << 2) & 0x3f] +
                  "="
              );
            }

            return parts.join("");
          }
        },
        {},
      ],
      164: [
        function (require, module, exports) {
          (function (Buffer) {
            (function () {
              /*!
               * The buffer module from node.js, for the browser.
               *
               * @author   Feross Aboukhadijeh <https://feross.org>
               * @license  MIT
               */
              /* eslint-disable no-proto */

              "use strict";

              var base64 = require("base64-js");
              var ieee754 = require("ieee754");

              exports.Buffer = Buffer;
              exports.SlowBuffer = SlowBuffer;
              exports.INSPECT_MAX_BYTES = 50;

              var K_MAX_LENGTH = 0x7fffffff;
              exports.kMaxLength = K_MAX_LENGTH;

              /**
               * If `Buffer.TYPED_ARRAY_SUPPORT`:
               *   === true    Use Uint8Array implementation (fastest)
               *   === false   Print warning and recommend using `buffer` v4.x which has an Object
               *               implementation (most compatible, even IE6)
               *
               * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
               * Opera 11.6+, iOS 4.2+.
               *
               * We report that the browser does not support typed arrays if the are not subclassable
               * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
               * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
               * for __proto__ and has a buggy typed array implementation.
               */
              Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

              if (
                !Buffer.TYPED_ARRAY_SUPPORT &&
                typeof console !== "undefined" &&
                typeof console.error === "function"
              ) {
                console.error(
                  "This browser lacks typed array (Uint8Array) support which is required by " +
                    "`buffer` v5.x. Use `buffer` v4.x if you require old browser support."
                );
              }

              function typedArraySupport() {
                // Can typed array instances can be augmented?
                try {
                  var arr = new Uint8Array(1);
                  arr.__proto__ = {
                    __proto__: Uint8Array.prototype,
                    foo: function () {
                      return 42;
                    },
                  };
                  return arr.foo() === 42;
                } catch (e) {
                  return false;
                }
              }

              Object.defineProperty(Buffer.prototype, "parent", {
                enumerable: true,
                get: function () {
                  if (!Buffer.isBuffer(this)) return undefined;
                  return this.buffer;
                },
              });

              Object.defineProperty(Buffer.prototype, "offset", {
                enumerable: true,
                get: function () {
                  if (!Buffer.isBuffer(this)) return undefined;
                  return this.byteOffset;
                },
              });

              function createBuffer(length) {
                if (length > K_MAX_LENGTH) {
                  throw new RangeError(
                    'The value "' + length + '" is invalid for option "size"'
                  );
                }
                // Return an augmented `Uint8Array` instance
                var buf = new Uint8Array(length);
                buf.__proto__ = Buffer.prototype;
                return buf;
              }

              /**
               * The Buffer constructor returns instances of `Uint8Array` that have their
               * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
               * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
               * and the `Uint8Array` methods. Square bracket notation works as expected -- it
               * returns a single octet.
               *
               * The `Uint8Array` prototype remains unmodified.
               */

              function Buffer(arg, encodingOrOffset, length) {
                // Common case.
                if (typeof arg === "number") {
                  if (typeof encodingOrOffset === "string") {
                    throw new TypeError(
                      'The "string" argument must be of type string. Received type number'
                    );
                  }
                  return allocUnsafe(arg);
                }
                return from(arg, encodingOrOffset, length);
              }

              // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
              if (
                typeof Symbol !== "undefined" &&
                Symbol.species != null &&
                Buffer[Symbol.species] === Buffer
              ) {
                Object.defineProperty(Buffer, Symbol.species, {
                  value: null,
                  configurable: true,
                  enumerable: false,
                  writable: false,
                });
              }

              Buffer.poolSize = 8192; // not used by this implementation

              function from(value, encodingOrOffset, length) {
                if (typeof value === "string") {
                  return fromString(value, encodingOrOffset);
                }

                if (ArrayBuffer.isView(value)) {
                  return fromArrayLike(value);
                }

                if (value == null) {
                  throw TypeError(
                    "The first argument must be one of type string, Buffer, ArrayBuffer, Array, " +
                      "or Array-like Object. Received type " +
                      typeof value
                  );
                }

                if (
                  isInstance(value, ArrayBuffer) ||
                  (value && isInstance(value.buffer, ArrayBuffer))
                ) {
                  return fromArrayBuffer(value, encodingOrOffset, length);
                }

                if (typeof value === "number") {
                  throw new TypeError(
                    'The "value" argument must not be of type number. Received type number'
                  );
                }

                var valueOf = value.valueOf && value.valueOf();
                if (valueOf != null && valueOf !== value) {
                  return Buffer.from(valueOf, encodingOrOffset, length);
                }

                var b = fromObject(value);
                if (b) return b;

                if (
                  typeof Symbol !== "undefined" &&
                  Symbol.toPrimitive != null &&
                  typeof value[Symbol.toPrimitive] === "function"
                ) {
                  return Buffer.from(
                    value[Symbol.toPrimitive]("string"),
                    encodingOrOffset,
                    length
                  );
                }

                throw new TypeError(
                  "The first argument must be one of type string, Buffer, ArrayBuffer, Array, " +
                    "or Array-like Object. Received type " +
                    typeof value
                );
              }

              /**
               * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
               * if value is a number.
               * Buffer.from(str[, encoding])
               * Buffer.from(array)
               * Buffer.from(buffer)
               * Buffer.from(arrayBuffer[, byteOffset[, length]])
               **/
              Buffer.from = function (value, encodingOrOffset, length) {
                return from(value, encodingOrOffset, length);
              };

              // Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
              // https://github.com/feross/buffer/pull/148
              Buffer.prototype.__proto__ = Uint8Array.prototype;
              Buffer.__proto__ = Uint8Array;

              function assertSize(size) {
                if (typeof size !== "number") {
                  throw new TypeError('"size" argument must be of type number');
                } else if (size < 0) {
                  throw new RangeError(
                    'The value "' + size + '" is invalid for option "size"'
                  );
                }
              }

              function alloc(size, fill, encoding) {
                assertSize(size);
                if (size <= 0) {
                  return createBuffer(size);
                }
                if (fill !== undefined) {
                  // Only pay attention to encoding if it's a string. This
                  // prevents accidentally sending in a number that would
                  // be interpretted as a start offset.
                  return typeof encoding === "string"
                    ? createBuffer(size).fill(fill, encoding)
                    : createBuffer(size).fill(fill);
                }
                return createBuffer(size);
              }

              /**
               * Creates a new filled Buffer instance.
               * alloc(size[, fill[, encoding]])
               **/
              Buffer.alloc = function (size, fill, encoding) {
                return alloc(size, fill, encoding);
              };

              function allocUnsafe(size) {
                assertSize(size);
                return createBuffer(size < 0 ? 0 : checked(size) | 0);
              }

              /**
               * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
               * */
              Buffer.allocUnsafe = function (size) {
                return allocUnsafe(size);
              };
              /**
               * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
               */
              Buffer.allocUnsafeSlow = function (size) {
                return allocUnsafe(size);
              };

              function fromString(string, encoding) {
                if (typeof encoding !== "string" || encoding === "") {
                  encoding = "utf8";
                }

                if (!Buffer.isEncoding(encoding)) {
                  throw new TypeError("Unknown encoding: " + encoding);
                }

                var length = byteLength(string, encoding) | 0;
                var buf = createBuffer(length);

                var actual = buf.write(string, encoding);

                if (actual !== length) {
                  // Writing a hex string, for example, that contains invalid characters will
                  // cause everything after the first invalid character to be ignored. (e.g.
                  // 'abxxcd' will be treated as 'ab')
                  buf = buf.slice(0, actual);
                }

                return buf;
              }

              function fromArrayLike(array) {
                var length = array.length < 0 ? 0 : checked(array.length) | 0;
                var buf = createBuffer(length);
                for (var i = 0; i < length; i += 1) {
                  buf[i] = array[i] & 255;
                }
                return buf;
              }

              function fromArrayBuffer(array, byteOffset, length) {
                if (byteOffset < 0 || array.byteLength < byteOffset) {
                  throw new RangeError('"offset" is outside of buffer bounds');
                }

                if (array.byteLength < byteOffset + (length || 0)) {
                  throw new RangeError('"length" is outside of buffer bounds');
                }

                var buf;
                if (byteOffset === undefined && length === undefined) {
                  buf = new Uint8Array(array);
                } else if (length === undefined) {
                  buf = new Uint8Array(array, byteOffset);
                } else {
                  buf = new Uint8Array(array, byteOffset, length);
                }

                // Return an augmented `Uint8Array` instance
                buf.__proto__ = Buffer.prototype;
                return buf;
              }

              function fromObject(obj) {
                if (Buffer.isBuffer(obj)) {
                  var len = checked(obj.length) | 0;
                  var buf = createBuffer(len);

                  if (buf.length === 0) {
                    return buf;
                  }

                  obj.copy(buf, 0, 0, len);
                  return buf;
                }

                if (obj.length !== undefined) {
                  if (
                    typeof obj.length !== "number" ||
                    numberIsNaN(obj.length)
                  ) {
                    return createBuffer(0);
                  }
                  return fromArrayLike(obj);
                }

                if (obj.type === "Buffer" && Array.isArray(obj.data)) {
                  return fromArrayLike(obj.data);
                }
              }

              function checked(length) {
                // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
                // length is NaN (which is otherwise coerced to zero.)
                if (length >= K_MAX_LENGTH) {
                  throw new RangeError(
                    "Attempt to allocate Buffer larger than maximum " +
                      "size: 0x" +
                      K_MAX_LENGTH.toString(16) +
                      " bytes"
                  );
                }
                return length | 0;
              }

              function SlowBuffer(length) {
                if (+length != length) {
                  // eslint-disable-line eqeqeq
                  length = 0;
                }
                return Buffer.alloc(+length);
              }

              Buffer.isBuffer = function isBuffer(b) {
                return (
                  b != null && b._isBuffer === true && b !== Buffer.prototype
                ); // so Buffer.isBuffer(Buffer.prototype) will be false
              };

              Buffer.compare = function compare(a, b) {
                if (isInstance(a, Uint8Array))
                  a = Buffer.from(a, a.offset, a.byteLength);
                if (isInstance(b, Uint8Array))
                  b = Buffer.from(b, b.offset, b.byteLength);
                if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                  throw new TypeError(
                    'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
                  );
                }

                if (a === b) return 0;

                var x = a.length;
                var y = b.length;

                for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                  if (a[i] !== b[i]) {
                    x = a[i];
                    y = b[i];
                    break;
                  }
                }

                if (x < y) return -1;
                if (y < x) return 1;
                return 0;
              };

              Buffer.isEncoding = function isEncoding(encoding) {
                switch (String(encoding).toLowerCase()) {
                  case "hex":
                  case "utf8":
                  case "utf-8":
                  case "ascii":
                  case "latin1":
                  case "binary":
                  case "base64":
                  case "ucs2":
                  case "ucs-2":
                  case "utf16le":
                  case "utf-16le":
                    return true;
                  default:
                    return false;
                }
              };

              Buffer.concat = function concat(list, length) {
                if (!Array.isArray(list)) {
                  throw new TypeError(
                    '"list" argument must be an Array of Buffers'
                  );
                }

                if (list.length === 0) {
                  return Buffer.alloc(0);
                }

                var i;
                if (length === undefined) {
                  length = 0;
                  for (i = 0; i < list.length; ++i) {
                    length += list[i].length;
                  }
                }

                var buffer = Buffer.allocUnsafe(length);
                var pos = 0;
                for (i = 0; i < list.length; ++i) {
                  var buf = list[i];
                  if (isInstance(buf, Uint8Array)) {
                    buf = Buffer.from(buf);
                  }
                  if (!Buffer.isBuffer(buf)) {
                    throw new TypeError(
                      '"list" argument must be an Array of Buffers'
                    );
                  }
                  buf.copy(buffer, pos);
                  pos += buf.length;
                }
                return buffer;
              };

              function byteLength(string, encoding) {
                if (Buffer.isBuffer(string)) {
                  return string.length;
                }
                if (
                  ArrayBuffer.isView(string) ||
                  isInstance(string, ArrayBuffer)
                ) {
                  return string.byteLength;
                }
                if (typeof string !== "string") {
                  throw new TypeError(
                    'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
                      "Received type " +
                      typeof string
                  );
                }

                var len = string.length;
                var mustMatch = arguments.length > 2 && arguments[2] === true;
                if (!mustMatch && len === 0) return 0;

                // Use a for loop to avoid recursion
                var loweredCase = false;
                for (;;) {
                  switch (encoding) {
                    case "ascii":
                    case "latin1":
                    case "binary":
                      return len;
                    case "utf8":
                    case "utf-8":
                      return utf8ToBytes(string).length;
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                      return len * 2;
                    case "hex":
                      return len >>> 1;
                    case "base64":
                      return base64ToBytes(string).length;
                    default:
                      if (loweredCase) {
                        return mustMatch ? -1 : utf8ToBytes(string).length; // assume utf8
                      }
                      encoding = ("" + encoding).toLowerCase();
                      loweredCase = true;
                  }
                }
              }
              Buffer.byteLength = byteLength;

              function slowToString(encoding, start, end) {
                var loweredCase = false;

                // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
                // property of a typed array.

                // This behaves neither like String nor Uint8Array in that we set start/end
                // to their upper/lower bounds if the value passed is out of range.
                // undefined is handled specially as per ECMA-262 6th Edition,
                // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
                if (start === undefined || start < 0) {
                  start = 0;
                }
                // Return early if start > this.length. Done here to prevent potential uint32
                // coercion fail below.
                if (start > this.length) {
                  return "";
                }

                if (end === undefined || end > this.length) {
                  end = this.length;
                }

                if (end <= 0) {
                  return "";
                }

                // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
                end >>>= 0;
                start >>>= 0;

                if (end <= start) {
                  return "";
                }

                if (!encoding) encoding = "utf8";

                while (true) {
                  switch (encoding) {
                    case "hex":
                      return hexSlice(this, start, end);

                    case "utf8":
                    case "utf-8":
                      return utf8Slice(this, start, end);

                    case "ascii":
                      return asciiSlice(this, start, end);

                    case "latin1":
                    case "binary":
                      return latin1Slice(this, start, end);

                    case "base64":
                      return base64Slice(this, start, end);

                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                      return utf16leSlice(this, start, end);

                    default:
                      if (loweredCase)
                        throw new TypeError("Unknown encoding: " + encoding);
                      encoding = (encoding + "").toLowerCase();
                      loweredCase = true;
                  }
                }
              }

              // This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
              // to detect a Buffer instance. It's not possible to use `instanceof Buffer`
              // reliably in a browserify context because there could be multiple different
              // copies of the 'buffer' package in use. This method works even for Buffer
              // instances that were created from another copy of the `buffer` package.
              // See: https://github.com/feross/buffer/issues/154
              Buffer.prototype._isBuffer = true;

              function swap(b, n, m) {
                var i = b[n];
                b[n] = b[m];
                b[m] = i;
              }

              Buffer.prototype.swap16 = function swap16() {
                var len = this.length;
                if (len % 2 !== 0) {
                  throw new RangeError(
                    "Buffer size must be a multiple of 16-bits"
                  );
                }
                for (var i = 0; i < len; i += 2) {
                  swap(this, i, i + 1);
                }
                return this;
              };

              Buffer.prototype.swap32 = function swap32() {
                var len = this.length;
                if (len % 4 !== 0) {
                  throw new RangeError(
                    "Buffer size must be a multiple of 32-bits"
                  );
                }
                for (var i = 0; i < len; i += 4) {
                  swap(this, i, i + 3);
                  swap(this, i + 1, i + 2);
                }
                return this;
              };

              Buffer.prototype.swap64 = function swap64() {
                var len = this.length;
                if (len % 8 !== 0) {
                  throw new RangeError(
                    "Buffer size must be a multiple of 64-bits"
                  );
                }
                for (var i = 0; i < len; i += 8) {
                  swap(this, i, i + 7);
                  swap(this, i + 1, i + 6);
                  swap(this, i + 2, i + 5);
                  swap(this, i + 3, i + 4);
                }
                return this;
              };

              Buffer.prototype.toString = function toString() {
                var length = this.length;
                if (length === 0) return "";
                if (arguments.length === 0) return utf8Slice(this, 0, length);
                return slowToString.apply(this, arguments);
              };

              Buffer.prototype.toLocaleString = Buffer.prototype.toString;

              Buffer.prototype.equals = function equals(b) {
                if (!Buffer.isBuffer(b))
                  throw new TypeError("Argument must be a Buffer");
                if (this === b) return true;
                return Buffer.compare(this, b) === 0;
              };

              Buffer.prototype.inspect = function inspect() {
                var str = "";
                var max = exports.INSPECT_MAX_BYTES;
                str = this.toString("hex", 0, max)
                  .replace(/(.{2})/g, "$1 ")
                  .trim();
                if (this.length > max) str += " ... ";
                return "<Buffer " + str + ">";
              };

              Buffer.prototype.compare = function compare(
                target,
                start,
                end,
                thisStart,
                thisEnd
              ) {
                if (isInstance(target, Uint8Array)) {
                  target = Buffer.from(
                    target,
                    target.offset,
                    target.byteLength
                  );
                }
                if (!Buffer.isBuffer(target)) {
                  throw new TypeError(
                    'The "target" argument must be one of type Buffer or Uint8Array. ' +
                      "Received type " +
                      typeof target
                  );
                }

                if (start === undefined) {
                  start = 0;
                }
                if (end === undefined) {
                  end = target ? target.length : 0;
                }
                if (thisStart === undefined) {
                  thisStart = 0;
                }
                if (thisEnd === undefined) {
                  thisEnd = this.length;
                }

                if (
                  start < 0 ||
                  end > target.length ||
                  thisStart < 0 ||
                  thisEnd > this.length
                ) {
                  throw new RangeError("out of range index");
                }

                if (thisStart >= thisEnd && start >= end) {
                  return 0;
                }
                if (thisStart >= thisEnd) {
                  return -1;
                }
                if (start >= end) {
                  return 1;
                }

                start >>>= 0;
                end >>>= 0;
                thisStart >>>= 0;
                thisEnd >>>= 0;

                if (this === target) return 0;

                var x = thisEnd - thisStart;
                var y = end - start;
                var len = Math.min(x, y);

                var thisCopy = this.slice(thisStart, thisEnd);
                var targetCopy = target.slice(start, end);

                for (var i = 0; i < len; ++i) {
                  if (thisCopy[i] !== targetCopy[i]) {
                    x = thisCopy[i];
                    y = targetCopy[i];
                    break;
                  }
                }

                if (x < y) return -1;
                if (y < x) return 1;
                return 0;
              };

              // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
              // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
              //
              // Arguments:
              // - buffer - a Buffer to search
              // - val - a string, Buffer, or number
              // - byteOffset - an index into `buffer`; will be clamped to an int32
              // - encoding - an optional encoding, relevant is val is a string
              // - dir - true for indexOf, false for lastIndexOf
              function bidirectionalIndexOf(
                buffer,
                val,
                byteOffset,
                encoding,
                dir
              ) {
                // Empty buffer means no match
                if (buffer.length === 0) return -1;

                // Normalize byteOffset
                if (typeof byteOffset === "string") {
                  encoding = byteOffset;
                  byteOffset = 0;
                } else if (byteOffset > 0x7fffffff) {
                  byteOffset = 0x7fffffff;
                } else if (byteOffset < -0x80000000) {
                  byteOffset = -0x80000000;
                }
                byteOffset = +byteOffset; // Coerce to Number.
                if (numberIsNaN(byteOffset)) {
                  // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
                  byteOffset = dir ? 0 : buffer.length - 1;
                }

                // Normalize byteOffset: negative offsets start from the end of the buffer
                if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
                if (byteOffset >= buffer.length) {
                  if (dir) return -1;
                  else byteOffset = buffer.length - 1;
                } else if (byteOffset < 0) {
                  if (dir) byteOffset = 0;
                  else return -1;
                }

                // Normalize val
                if (typeof val === "string") {
                  val = Buffer.from(val, encoding);
                }

                // Finally, search either indexOf (if dir is true) or lastIndexOf
                if (Buffer.isBuffer(val)) {
                  // Special case: looking for empty string/buffer always fails
                  if (val.length === 0) {
                    return -1;
                  }
                  return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
                } else if (typeof val === "number") {
                  val = val & 0xff; // Search for a byte value [0-255]
                  if (typeof Uint8Array.prototype.indexOf === "function") {
                    if (dir) {
                      return Uint8Array.prototype.indexOf.call(
                        buffer,
                        val,
                        byteOffset
                      );
                    } else {
                      return Uint8Array.prototype.lastIndexOf.call(
                        buffer,
                        val,
                        byteOffset
                      );
                    }
                  }
                  return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
                }

                throw new TypeError("val must be string, number or Buffer");
              }

              function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
                var indexSize = 1;
                var arrLength = arr.length;
                var valLength = val.length;

                if (encoding !== undefined) {
                  encoding = String(encoding).toLowerCase();
                  if (
                    encoding === "ucs2" ||
                    encoding === "ucs-2" ||
                    encoding === "utf16le" ||
                    encoding === "utf-16le"
                  ) {
                    if (arr.length < 2 || val.length < 2) {
                      return -1;
                    }
                    indexSize = 2;
                    arrLength /= 2;
                    valLength /= 2;
                    byteOffset /= 2;
                  }
                }

                function read(buf, i) {
                  if (indexSize === 1) {
                    return buf[i];
                  } else {
                    return buf.readUInt16BE(i * indexSize);
                  }
                }

                var i;
                if (dir) {
                  var foundIndex = -1;
                  for (i = byteOffset; i < arrLength; i++) {
                    if (
                      read(arr, i) ===
                      read(val, foundIndex === -1 ? 0 : i - foundIndex)
                    ) {
                      if (foundIndex === -1) foundIndex = i;
                      if (i - foundIndex + 1 === valLength)
                        return foundIndex * indexSize;
                    } else {
                      if (foundIndex !== -1) i -= i - foundIndex;
                      foundIndex = -1;
                    }
                  }
                } else {
                  if (byteOffset + valLength > arrLength)
                    byteOffset = arrLength - valLength;
                  for (i = byteOffset; i >= 0; i--) {
                    var found = true;
                    for (var j = 0; j < valLength; j++) {
                      if (read(arr, i + j) !== read(val, j)) {
                        found = false;
                        break;
                      }
                    }
                    if (found) return i;
                  }
                }

                return -1;
              }

              Buffer.prototype.includes = function includes(
                val,
                byteOffset,
                encoding
              ) {
                return this.indexOf(val, byteOffset, encoding) !== -1;
              };

              Buffer.prototype.indexOf = function indexOf(
                val,
                byteOffset,
                encoding
              ) {
                return bidirectionalIndexOf(
                  this,
                  val,
                  byteOffset,
                  encoding,
                  true
                );
              };

              Buffer.prototype.lastIndexOf = function lastIndexOf(
                val,
                byteOffset,
                encoding
              ) {
                return bidirectionalIndexOf(
                  this,
                  val,
                  byteOffset,
                  encoding,
                  false
                );
              };

              function hexWrite(buf, string, offset, length) {
                offset = Number(offset) || 0;
                var remaining = buf.length - offset;
                if (!length) {
                  length = remaining;
                } else {
                  length = Number(length);
                  if (length > remaining) {
                    length = remaining;
                  }
                }

                var strLen = string.length;

                if (length > strLen / 2) {
                  length = strLen / 2;
                }
                for (var i = 0; i < length; ++i) {
                  var parsed = parseInt(string.substr(i * 2, 2), 16);
                  if (numberIsNaN(parsed)) return i;
                  buf[offset + i] = parsed;
                }
                return i;
              }

              function utf8Write(buf, string, offset, length) {
                return blitBuffer(
                  utf8ToBytes(string, buf.length - offset),
                  buf,
                  offset,
                  length
                );
              }

              function asciiWrite(buf, string, offset, length) {
                return blitBuffer(asciiToBytes(string), buf, offset, length);
              }

              function latin1Write(buf, string, offset, length) {
                return asciiWrite(buf, string, offset, length);
              }

              function base64Write(buf, string, offset, length) {
                return blitBuffer(base64ToBytes(string), buf, offset, length);
              }

              function ucs2Write(buf, string, offset, length) {
                return blitBuffer(
                  utf16leToBytes(string, buf.length - offset),
                  buf,
                  offset,
                  length
                );
              }

              Buffer.prototype.write = function write(
                string,
                offset,
                length,
                encoding
              ) {
                // Buffer#write(string)
                if (offset === undefined) {
                  encoding = "utf8";
                  length = this.length;
                  offset = 0;
                  // Buffer#write(string, encoding)
                } else if (length === undefined && typeof offset === "string") {
                  encoding = offset;
                  length = this.length;
                  offset = 0;
                  // Buffer#write(string, offset[, length][, encoding])
                } else if (isFinite(offset)) {
                  offset = offset >>> 0;
                  if (isFinite(length)) {
                    length = length >>> 0;
                    if (encoding === undefined) encoding = "utf8";
                  } else {
                    encoding = length;
                    length = undefined;
                  }
                } else {
                  throw new Error(
                    "Buffer.write(string, encoding, offset[, length]) is no longer supported"
                  );
                }

                var remaining = this.length - offset;
                if (length === undefined || length > remaining)
                  length = remaining;

                if (
                  (string.length > 0 && (length < 0 || offset < 0)) ||
                  offset > this.length
                ) {
                  throw new RangeError(
                    "Attempt to write outside buffer bounds"
                  );
                }

                if (!encoding) encoding = "utf8";

                var loweredCase = false;
                for (;;) {
                  switch (encoding) {
                    case "hex":
                      return hexWrite(this, string, offset, length);

                    case "utf8":
                    case "utf-8":
                      return utf8Write(this, string, offset, length);

                    case "ascii":
                      return asciiWrite(this, string, offset, length);

                    case "latin1":
                    case "binary":
                      return latin1Write(this, string, offset, length);

                    case "base64":
                      // Warning: maxLength not taken into account in base64Write
                      return base64Write(this, string, offset, length);

                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                      return ucs2Write(this, string, offset, length);

                    default:
                      if (loweredCase)
                        throw new TypeError("Unknown encoding: " + encoding);
                      encoding = ("" + encoding).toLowerCase();
                      loweredCase = true;
                  }
                }
              };

              Buffer.prototype.toJSON = function toJSON() {
                return {
                  type: "Buffer",
                  data: Array.prototype.slice.call(this._arr || this, 0),
                };
              };

              function base64Slice(buf, start, end) {
                if (start === 0 && end === buf.length) {
                  return base64.fromByteArray(buf);
                } else {
                  return base64.fromByteArray(buf.slice(start, end));
                }
              }

              function utf8Slice(buf, start, end) {
                end = Math.min(buf.length, end);
                var res = [];

                var i = start;
                while (i < end) {
                  var firstByte = buf[i];
                  var codePoint = null;
                  var bytesPerSequence =
                    firstByte > 0xef
                      ? 4
                      : firstByte > 0xdf
                      ? 3
                      : firstByte > 0xbf
                      ? 2
                      : 1;

                  if (i + bytesPerSequence <= end) {
                    var secondByte, thirdByte, fourthByte, tempCodePoint;

                    switch (bytesPerSequence) {
                      case 1:
                        if (firstByte < 0x80) {
                          codePoint = firstByte;
                        }
                        break;
                      case 2:
                        secondByte = buf[i + 1];
                        if ((secondByte & 0xc0) === 0x80) {
                          tempCodePoint =
                            ((firstByte & 0x1f) << 0x6) | (secondByte & 0x3f);
                          if (tempCodePoint > 0x7f) {
                            codePoint = tempCodePoint;
                          }
                        }
                        break;
                      case 3:
                        secondByte = buf[i + 1];
                        thirdByte = buf[i + 2];
                        if (
                          (secondByte & 0xc0) === 0x80 &&
                          (thirdByte & 0xc0) === 0x80
                        ) {
                          tempCodePoint =
                            ((firstByte & 0xf) << 0xc) |
                            ((secondByte & 0x3f) << 0x6) |
                            (thirdByte & 0x3f);
                          if (
                            tempCodePoint > 0x7ff &&
                            (tempCodePoint < 0xd800 || tempCodePoint > 0xdfff)
                          ) {
                            codePoint = tempCodePoint;
                          }
                        }
                        break;
                      case 4:
                        secondByte = buf[i + 1];
                        thirdByte = buf[i + 2];
                        fourthByte = buf[i + 3];
                        if (
                          (secondByte & 0xc0) === 0x80 &&
                          (thirdByte & 0xc0) === 0x80 &&
                          (fourthByte & 0xc0) === 0x80
                        ) {
                          tempCodePoint =
                            ((firstByte & 0xf) << 0x12) |
                            ((secondByte & 0x3f) << 0xc) |
                            ((thirdByte & 0x3f) << 0x6) |
                            (fourthByte & 0x3f);
                          if (
                            tempCodePoint > 0xffff &&
                            tempCodePoint < 0x110000
                          ) {
                            codePoint = tempCodePoint;
                          }
                        }
                    }
                  }

                  if (codePoint === null) {
                    // we did not generate a valid codePoint so insert a
                    // replacement char (U+FFFD) and advance only 1 byte
                    codePoint = 0xfffd;
                    bytesPerSequence = 1;
                  } else if (codePoint > 0xffff) {
                    // encode to utf16 (surrogate pair dance)
                    codePoint -= 0x10000;
                    res.push(((codePoint >>> 10) & 0x3ff) | 0xd800);
                    codePoint = 0xdc00 | (codePoint & 0x3ff);
                  }

                  res.push(codePoint);
                  i += bytesPerSequence;
                }

                return decodeCodePointsArray(res);
              }

              // Based on http://stackoverflow.com/a/22747272/680742, the browser with
              // the lowest limit is Chrome, with 0x10000 args.
              // We go 1 magnitude less, for safety
              var MAX_ARGUMENTS_LENGTH = 0x1000;

              function decodeCodePointsArray(codePoints) {
                var len = codePoints.length;
                if (len <= MAX_ARGUMENTS_LENGTH) {
                  return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
                }

                // Decode in chunks to avoid "call stack size exceeded".
                var res = "";
                var i = 0;
                while (i < len) {
                  res += String.fromCharCode.apply(
                    String,
                    codePoints.slice(i, (i += MAX_ARGUMENTS_LENGTH))
                  );
                }
                return res;
              }

              function asciiSlice(buf, start, end) {
                var ret = "";
                end = Math.min(buf.length, end);

                for (var i = start; i < end; ++i) {
                  ret += String.fromCharCode(buf[i] & 0x7f);
                }
                return ret;
              }

              function latin1Slice(buf, start, end) {
                var ret = "";
                end = Math.min(buf.length, end);

                for (var i = start; i < end; ++i) {
                  ret += String.fromCharCode(buf[i]);
                }
                return ret;
              }

              function hexSlice(buf, start, end) {
                var len = buf.length;

                if (!start || start < 0) start = 0;
                if (!end || end < 0 || end > len) end = len;

                var out = "";
                for (var i = start; i < end; ++i) {
                  out += toHex(buf[i]);
                }
                return out;
              }

              function utf16leSlice(buf, start, end) {
                var bytes = buf.slice(start, end);
                var res = "";
                for (var i = 0; i < bytes.length; i += 2) {
                  res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
                }
                return res;
              }

              Buffer.prototype.slice = function slice(start, end) {
                var len = this.length;
                start = ~~start;
                end = end === undefined ? len : ~~end;

                if (start < 0) {
                  start += len;
                  if (start < 0) start = 0;
                } else if (start > len) {
                  start = len;
                }

                if (end < 0) {
                  end += len;
                  if (end < 0) end = 0;
                } else if (end > len) {
                  end = len;
                }

                if (end < start) end = start;

                var newBuf = this.subarray(start, end);
                // Return an augmented `Uint8Array` instance
                newBuf.__proto__ = Buffer.prototype;
                return newBuf;
              };

              /*
               * Need to make sure that buffer isn't trying to write out of bounds.
               */
              function checkOffset(offset, ext, length) {
                if (offset % 1 !== 0 || offset < 0)
                  throw new RangeError("offset is not uint");
                if (offset + ext > length)
                  throw new RangeError("Trying to access beyond buffer length");
              }

              Buffer.prototype.readUIntLE = function readUIntLE(
                offset,
                byteLength,
                noAssert
              ) {
                offset = offset >>> 0;
                byteLength = byteLength >>> 0;
                if (!noAssert) checkOffset(offset, byteLength, this.length);

                var val = this[offset];
                var mul = 1;
                var i = 0;
                while (++i < byteLength && (mul *= 0x100)) {
                  val += this[offset + i] * mul;
                }

                return val;
              };

              Buffer.prototype.readUIntBE = function readUIntBE(
                offset,
                byteLength,
                noAssert
              ) {
                offset = offset >>> 0;
                byteLength = byteLength >>> 0;
                if (!noAssert) {
                  checkOffset(offset, byteLength, this.length);
                }

                var val = this[offset + --byteLength];
                var mul = 1;
                while (byteLength > 0 && (mul *= 0x100)) {
                  val += this[offset + --byteLength] * mul;
                }

                return val;
              };

              Buffer.prototype.readUInt8 = function readUInt8(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 1, this.length);
                return this[offset];
              };

              Buffer.prototype.readUInt16LE = function readUInt16LE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 2, this.length);
                return this[offset] | (this[offset + 1] << 8);
              };

              Buffer.prototype.readUInt16BE = function readUInt16BE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 2, this.length);
                return (this[offset] << 8) | this[offset + 1];
              };

              Buffer.prototype.readUInt32LE = function readUInt32LE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 4, this.length);

                return (
                  (this[offset] |
                    (this[offset + 1] << 8) |
                    (this[offset + 2] << 16)) +
                  this[offset + 3] * 0x1000000
                );
              };

              Buffer.prototype.readUInt32BE = function readUInt32BE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 4, this.length);

                return (
                  this[offset] * 0x1000000 +
                  ((this[offset + 1] << 16) |
                    (this[offset + 2] << 8) |
                    this[offset + 3])
                );
              };

              Buffer.prototype.readIntLE = function readIntLE(
                offset,
                byteLength,
                noAssert
              ) {
                offset = offset >>> 0;
                byteLength = byteLength >>> 0;
                if (!noAssert) checkOffset(offset, byteLength, this.length);

                var val = this[offset];
                var mul = 1;
                var i = 0;
                while (++i < byteLength && (mul *= 0x100)) {
                  val += this[offset + i] * mul;
                }
                mul *= 0x80;

                if (val >= mul) val -= Math.pow(2, 8 * byteLength);

                return val;
              };

              Buffer.prototype.readIntBE = function readIntBE(
                offset,
                byteLength,
                noAssert
              ) {
                offset = offset >>> 0;
                byteLength = byteLength >>> 0;
                if (!noAssert) checkOffset(offset, byteLength, this.length);

                var i = byteLength;
                var mul = 1;
                var val = this[offset + --i];
                while (i > 0 && (mul *= 0x100)) {
                  val += this[offset + --i] * mul;
                }
                mul *= 0x80;

                if (val >= mul) val -= Math.pow(2, 8 * byteLength);

                return val;
              };

              Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 1, this.length);
                if (!(this[offset] & 0x80)) return this[offset];
                return (0xff - this[offset] + 1) * -1;
              };

              Buffer.prototype.readInt16LE = function readInt16LE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 2, this.length);
                var val = this[offset] | (this[offset + 1] << 8);
                return val & 0x8000 ? val | 0xffff0000 : val;
              };

              Buffer.prototype.readInt16BE = function readInt16BE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 2, this.length);
                var val = this[offset + 1] | (this[offset] << 8);
                return val & 0x8000 ? val | 0xffff0000 : val;
              };

              Buffer.prototype.readInt32LE = function readInt32LE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 4, this.length);

                return (
                  this[offset] |
                  (this[offset + 1] << 8) |
                  (this[offset + 2] << 16) |
                  (this[offset + 3] << 24)
                );
              };

              Buffer.prototype.readInt32BE = function readInt32BE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 4, this.length);

                return (
                  (this[offset] << 24) |
                  (this[offset + 1] << 16) |
                  (this[offset + 2] << 8) |
                  this[offset + 3]
                );
              };

              Buffer.prototype.readFloatLE = function readFloatLE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 4, this.length);
                return ieee754.read(this, offset, true, 23, 4);
              };

              Buffer.prototype.readFloatBE = function readFloatBE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 4, this.length);
                return ieee754.read(this, offset, false, 23, 4);
              };

              Buffer.prototype.readDoubleLE = function readDoubleLE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 8, this.length);
                return ieee754.read(this, offset, true, 52, 8);
              };

              Buffer.prototype.readDoubleBE = function readDoubleBE(
                offset,
                noAssert
              ) {
                offset = offset >>> 0;
                if (!noAssert) checkOffset(offset, 8, this.length);
                return ieee754.read(this, offset, false, 52, 8);
              };

              function checkInt(buf, value, offset, ext, max, min) {
                if (!Buffer.isBuffer(buf))
                  throw new TypeError(
                    '"buffer" argument must be a Buffer instance'
                  );
                if (value > max || value < min)
                  throw new RangeError('"value" argument is out of bounds');
                if (offset + ext > buf.length)
                  throw new RangeError("Index out of range");
              }

              Buffer.prototype.writeUIntLE = function writeUIntLE(
                value,
                offset,
                byteLength,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                byteLength = byteLength >>> 0;
                if (!noAssert) {
                  var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                  checkInt(this, value, offset, byteLength, maxBytes, 0);
                }

                var mul = 1;
                var i = 0;
                this[offset] = value & 0xff;
                while (++i < byteLength && (mul *= 0x100)) {
                  this[offset + i] = (value / mul) & 0xff;
                }

                return offset + byteLength;
              };

              Buffer.prototype.writeUIntBE = function writeUIntBE(
                value,
                offset,
                byteLength,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                byteLength = byteLength >>> 0;
                if (!noAssert) {
                  var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                  checkInt(this, value, offset, byteLength, maxBytes, 0);
                }

                var i = byteLength - 1;
                var mul = 1;
                this[offset + i] = value & 0xff;
                while (--i >= 0 && (mul *= 0x100)) {
                  this[offset + i] = (value / mul) & 0xff;
                }

                return offset + byteLength;
              };

              Buffer.prototype.writeUInt8 = function writeUInt8(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
                this[offset] = value & 0xff;
                return offset + 1;
              };

              Buffer.prototype.writeUInt16LE = function writeUInt16LE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
                this[offset] = value & 0xff;
                this[offset + 1] = value >>> 8;
                return offset + 2;
              };

              Buffer.prototype.writeUInt16BE = function writeUInt16BE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
                this[offset] = value >>> 8;
                this[offset + 1] = value & 0xff;
                return offset + 2;
              };

              Buffer.prototype.writeUInt32LE = function writeUInt32LE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
                this[offset + 3] = value >>> 24;
                this[offset + 2] = value >>> 16;
                this[offset + 1] = value >>> 8;
                this[offset] = value & 0xff;
                return offset + 4;
              };

              Buffer.prototype.writeUInt32BE = function writeUInt32BE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
                this[offset] = value >>> 24;
                this[offset + 1] = value >>> 16;
                this[offset + 2] = value >>> 8;
                this[offset + 3] = value & 0xff;
                return offset + 4;
              };

              Buffer.prototype.writeIntLE = function writeIntLE(
                value,
                offset,
                byteLength,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) {
                  var limit = Math.pow(2, 8 * byteLength - 1);

                  checkInt(this, value, offset, byteLength, limit - 1, -limit);
                }

                var i = 0;
                var mul = 1;
                var sub = 0;
                this[offset] = value & 0xff;
                while (++i < byteLength && (mul *= 0x100)) {
                  if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                    sub = 1;
                  }
                  this[offset + i] = (((value / mul) >> 0) - sub) & 0xff;
                }

                return offset + byteLength;
              };

              Buffer.prototype.writeIntBE = function writeIntBE(
                value,
                offset,
                byteLength,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) {
                  var limit = Math.pow(2, 8 * byteLength - 1);

                  checkInt(this, value, offset, byteLength, limit - 1, -limit);
                }

                var i = byteLength - 1;
                var mul = 1;
                var sub = 0;
                this[offset + i] = value & 0xff;
                while (--i >= 0 && (mul *= 0x100)) {
                  if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                    sub = 1;
                  }
                  this[offset + i] = (((value / mul) >> 0) - sub) & 0xff;
                }

                return offset + byteLength;
              };

              Buffer.prototype.writeInt8 = function writeInt8(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
                if (value < 0) value = 0xff + value + 1;
                this[offset] = value & 0xff;
                return offset + 1;
              };

              Buffer.prototype.writeInt16LE = function writeInt16LE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert)
                  checkInt(this, value, offset, 2, 0x7fff, -0x8000);
                this[offset] = value & 0xff;
                this[offset + 1] = value >>> 8;
                return offset + 2;
              };

              Buffer.prototype.writeInt16BE = function writeInt16BE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert)
                  checkInt(this, value, offset, 2, 0x7fff, -0x8000);
                this[offset] = value >>> 8;
                this[offset + 1] = value & 0xff;
                return offset + 2;
              };

              Buffer.prototype.writeInt32LE = function writeInt32LE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert)
                  checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
                this[offset] = value & 0xff;
                this[offset + 1] = value >>> 8;
                this[offset + 2] = value >>> 16;
                this[offset + 3] = value >>> 24;
                return offset + 4;
              };

              Buffer.prototype.writeInt32BE = function writeInt32BE(
                value,
                offset,
                noAssert
              ) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert)
                  checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
                if (value < 0) value = 0xffffffff + value + 1;
                this[offset] = value >>> 24;
                this[offset + 1] = value >>> 16;
                this[offset + 2] = value >>> 8;
                this[offset + 3] = value & 0xff;
                return offset + 4;
              };

              function checkIEEE754(buf, value, offset, ext, max, min) {
                if (offset + ext > buf.length)
                  throw new RangeError("Index out of range");
                if (offset < 0) throw new RangeError("Index out of range");
              }

              function writeFloat(buf, value, offset, littleEndian, noAssert) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) {
                  checkIEEE754(
                    buf,
                    value,
                    offset,
                    4,
                    3.4028234663852886e38,
                    -3.4028234663852886e38
                  );
                }
                ieee754.write(buf, value, offset, littleEndian, 23, 4);
                return offset + 4;
              }

              Buffer.prototype.writeFloatLE = function writeFloatLE(
                value,
                offset,
                noAssert
              ) {
                return writeFloat(this, value, offset, true, noAssert);
              };

              Buffer.prototype.writeFloatBE = function writeFloatBE(
                value,
                offset,
                noAssert
              ) {
                return writeFloat(this, value, offset, false, noAssert);
              };

              function writeDouble(buf, value, offset, littleEndian, noAssert) {
                value = +value;
                offset = offset >>> 0;
                if (!noAssert) {
                  checkIEEE754(
                    buf,
                    value,
                    offset,
                    8,
                    1.7976931348623157e308,
                    -1.7976931348623157e308
                  );
                }
                ieee754.write(buf, value, offset, littleEndian, 52, 8);
                return offset + 8;
              }

              Buffer.prototype.writeDoubleLE = function writeDoubleLE(
                value,
                offset,
                noAssert
              ) {
                return writeDouble(this, value, offset, true, noAssert);
              };

              Buffer.prototype.writeDoubleBE = function writeDoubleBE(
                value,
                offset,
                noAssert
              ) {
                return writeDouble(this, value, offset, false, noAssert);
              };

              // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
              Buffer.prototype.copy = function copy(
                target,
                targetStart,
                start,
                end
              ) {
                if (!Buffer.isBuffer(target))
                  throw new TypeError("argument should be a Buffer");
                if (!start) start = 0;
                if (!end && end !== 0) end = this.length;
                if (targetStart >= target.length) targetStart = target.length;
                if (!targetStart) targetStart = 0;
                if (end > 0 && end < start) end = start;

                // Copy 0 bytes; we're done
                if (end === start) return 0;
                if (target.length === 0 || this.length === 0) return 0;

                // Fatal error conditions
                if (targetStart < 0) {
                  throw new RangeError("targetStart out of bounds");
                }
                if (start < 0 || start >= this.length)
                  throw new RangeError("Index out of range");
                if (end < 0) throw new RangeError("sourceEnd out of bounds");

                // Are we oob?
                if (end > this.length) end = this.length;
                if (target.length - targetStart < end - start) {
                  end = target.length - targetStart + start;
                }

                var len = end - start;

                if (
                  this === target &&
                  typeof Uint8Array.prototype.copyWithin === "function"
                ) {
                  // Use built-in when available, missing from IE11
                  this.copyWithin(targetStart, start, end);
                } else if (
                  this === target &&
                  start < targetStart &&
                  targetStart < end
                ) {
                  // descending copy from end
                  for (var i = len - 1; i >= 0; --i) {
                    target[i + targetStart] = this[i + start];
                  }
                } else {
                  Uint8Array.prototype.set.call(
                    target,
                    this.subarray(start, end),
                    targetStart
                  );
                }

                return len;
              };

              // Usage:
              //    buffer.fill(number[, offset[, end]])
              //    buffer.fill(buffer[, offset[, end]])
              //    buffer.fill(string[, offset[, end]][, encoding])
              Buffer.prototype.fill = function fill(val, start, end, encoding) {
                // Handle string cases:
                if (typeof val === "string") {
                  if (typeof start === "string") {
                    encoding = start;
                    start = 0;
                    end = this.length;
                  } else if (typeof end === "string") {
                    encoding = end;
                    end = this.length;
                  }
                  if (encoding !== undefined && typeof encoding !== "string") {
                    throw new TypeError("encoding must be a string");
                  }
                  if (
                    typeof encoding === "string" &&
                    !Buffer.isEncoding(encoding)
                  ) {
                    throw new TypeError("Unknown encoding: " + encoding);
                  }
                  if (val.length === 1) {
                    var code = val.charCodeAt(0);
                    if (
                      (encoding === "utf8" && code < 128) ||
                      encoding === "latin1"
                    ) {
                      // Fast path: If `val` fits into a single byte, use that numeric value.
                      val = code;
                    }
                  }
                } else if (typeof val === "number") {
                  val = val & 255;
                }

                // Invalid ranges are not set to a default, so can range check early.
                if (start < 0 || this.length < start || this.length < end) {
                  throw new RangeError("Out of range index");
                }

                if (end <= start) {
                  return this;
                }

                start = start >>> 0;
                end = end === undefined ? this.length : end >>> 0;

                if (!val) val = 0;

                var i;
                if (typeof val === "number") {
                  for (i = start; i < end; ++i) {
                    this[i] = val;
                  }
                } else {
                  var bytes = Buffer.isBuffer(val)
                    ? val
                    : Buffer.from(val, encoding);
                  var len = bytes.length;
                  if (len === 0) {
                    throw new TypeError(
                      'The value "' + val + '" is invalid for argument "value"'
                    );
                  }
                  for (i = 0; i < end - start; ++i) {
                    this[i + start] = bytes[i % len];
                  }
                }

                return this;
              };

              // HELPER FUNCTIONS
              // ================

              var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

              function base64clean(str) {
                // Node takes equal signs as end of the Base64 encoding
                str = str.split("=")[0];
                // Node strips out invalid characters like \n and \t from the string, base64-js does not
                str = str.trim().replace(INVALID_BASE64_RE, "");
                // Node converts strings with length < 2 to ''
                if (str.length < 2) return "";
                // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
                while (str.length % 4 !== 0) {
                  str = str + "=";
                }
                return str;
              }

              function toHex(n) {
                if (n < 16) return "0" + n.toString(16);
                return n.toString(16);
              }

              function utf8ToBytes(string, units) {
                units = units || Infinity;
                var codePoint;
                var length = string.length;
                var leadSurrogate = null;
                var bytes = [];

                for (var i = 0; i < length; ++i) {
                  codePoint = string.charCodeAt(i);

                  // is surrogate component
                  if (codePoint > 0xd7ff && codePoint < 0xe000) {
                    // last char was a lead
                    if (!leadSurrogate) {
                      // no lead yet
                      if (codePoint > 0xdbff) {
                        // unexpected trail
                        if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                        continue;
                      } else if (i + 1 === length) {
                        // unpaired lead
                        if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                        continue;
                      }

                      // valid lead
                      leadSurrogate = codePoint;

                      continue;
                    }

                    // 2 leads in a row
                    if (codePoint < 0xdc00) {
                      if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                      leadSurrogate = codePoint;
                      continue;
                    }

                    // valid surrogate pair
                    codePoint =
                      (((leadSurrogate - 0xd800) << 10) |
                        (codePoint - 0xdc00)) +
                      0x10000;
                  } else if (leadSurrogate) {
                    // valid bmp char, but last char was a lead
                    if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd);
                  }

                  leadSurrogate = null;

                  // encode utf8
                  if (codePoint < 0x80) {
                    if ((units -= 1) < 0) break;
                    bytes.push(codePoint);
                  } else if (codePoint < 0x800) {
                    if ((units -= 2) < 0) break;
                    bytes.push(
                      (codePoint >> 0x6) | 0xc0,
                      (codePoint & 0x3f) | 0x80
                    );
                  } else if (codePoint < 0x10000) {
                    if ((units -= 3) < 0) break;
                    bytes.push(
                      (codePoint >> 0xc) | 0xe0,
                      ((codePoint >> 0x6) & 0x3f) | 0x80,
                      (codePoint & 0x3f) | 0x80
                    );
                  } else if (codePoint < 0x110000) {
                    if ((units -= 4) < 0) break;
                    bytes.push(
                      (codePoint >> 0x12) | 0xf0,
                      ((codePoint >> 0xc) & 0x3f) | 0x80,
                      ((codePoint >> 0x6) & 0x3f) | 0x80,
                      (codePoint & 0x3f) | 0x80
                    );
                  } else {
                    throw new Error("Invalid code point");
                  }
                }

                return bytes;
              }

              function asciiToBytes(str) {
                var byteArray = [];
                for (var i = 0; i < str.length; ++i) {
                  // Node's code seems to be doing this and not & 0x7F..
                  byteArray.push(str.charCodeAt(i) & 0xff);
                }
                return byteArray;
              }

              function utf16leToBytes(str, units) {
                var c, hi, lo;
                var byteArray = [];
                for (var i = 0; i < str.length; ++i) {
                  if ((units -= 2) < 0) break;

                  c = str.charCodeAt(i);
                  hi = c >> 8;
                  lo = c % 256;
                  byteArray.push(lo);
                  byteArray.push(hi);
                }

                return byteArray;
              }

              function base64ToBytes(str) {
                return base64.toByteArray(base64clean(str));
              }

              function blitBuffer(src, dst, offset, length) {
                for (var i = 0; i < length; ++i) {
                  if (i + offset >= dst.length || i >= src.length) break;
                  dst[i + offset] = src[i];
                }
                return i;
              }

              // ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
              // the `instanceof` check but they should be treated as of that type.
              // See: https://github.com/feross/buffer/issues/166
              function isInstance(obj, type) {
                return (
                  obj instanceof type ||
                  (obj != null &&
                    obj.constructor != null &&
                    obj.constructor.name != null &&
                    obj.constructor.name === type.name)
                );
              }
              function numberIsNaN(obj) {
                // For IE11 support
                return obj !== obj; // eslint-disable-line no-self-compare
              }
            }.call(this));
          }.call(this, require("buffer").Buffer));
        },
        { "base64-js": 163, buffer: 164, ieee754: 165 },
      ],
      165: [
        function (require, module, exports) {
          /*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
          exports.read = function (buffer, offset, isLE, mLen, nBytes) {
            var e, m;
            var eLen = nBytes * 8 - mLen - 1;
            var eMax = (1 << eLen) - 1;
            var eBias = eMax >> 1;
            var nBits = -7;
            var i = isLE ? nBytes - 1 : 0;
            var d = isLE ? -1 : 1;
            var s = buffer[offset + i];

            i += d;

            e = s & ((1 << -nBits) - 1);
            s >>= -nBits;
            nBits += eLen;
            for (
              ;
              nBits > 0;
              e = e * 256 + buffer[offset + i], i += d, nBits -= 8
            ) {}

            m = e & ((1 << -nBits) - 1);
            e >>= -nBits;
            nBits += mLen;
            for (
              ;
              nBits > 0;
              m = m * 256 + buffer[offset + i], i += d, nBits -= 8
            ) {}

            if (e === 0) {
              e = 1 - eBias;
            } else if (e === eMax) {
              return m ? NaN : (s ? -1 : 1) * Infinity;
            } else {
              m = m + Math.pow(2, mLen);
              e = e - eBias;
            }
            return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
          };

          exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
            var e, m, c;
            var eLen = nBytes * 8 - mLen - 1;
            var eMax = (1 << eLen) - 1;
            var eBias = eMax >> 1;
            var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
            var i = isLE ? 0 : nBytes - 1;
            var d = isLE ? 1 : -1;
            var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

            value = Math.abs(value);

            if (isNaN(value) || value === Infinity) {
              m = isNaN(value) ? 1 : 0;
              e = eMax;
            } else {
              e = Math.floor(Math.log(value) / Math.LN2);
              if (value * (c = Math.pow(2, -e)) < 1) {
                e--;
                c *= 2;
              }
              if (e + eBias >= 1) {
                value += rt / c;
              } else {
                value += rt * Math.pow(2, 1 - eBias);
              }
              if (value * c >= 2) {
                e++;
                c /= 2;
              }

              if (e + eBias >= eMax) {
                m = 0;
                e = eMax;
              } else if (e + eBias >= 1) {
                m = (value * c - 1) * Math.pow(2, mLen);
                e = e + eBias;
              } else {
                m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                e = 0;
              }
            }

            for (
              ;
              mLen >= 8;
              buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8
            ) {}

            e = (e << mLen) | m;
            eLen += mLen;
            for (
              ;
              eLen > 0;
              buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8
            ) {}

            buffer[offset + i - d] |= s * 128;
          };
        },
        {},
      ],
      166: [
        function (require, module, exports) {
          // shim for using process in browser
          var process = (module.exports = {});

          // cached from whatever global is present so that test runners that stub it
          // don't break things.  But we need to wrap it in a try catch in case it is
          // wrapped in strict mode code which doesn't define any globals.  It's inside a
          // function because try/catches deoptimize in certain engines.

          var cachedSetTimeout;
          var cachedClearTimeout;

          function defaultSetTimout() {
            throw new Error("setTimeout has not been defined");
          }
          function defaultClearTimeout() {
            throw new Error("clearTimeout has not been defined");
          }
          (function () {
            try {
              if (typeof setTimeout === "function") {
                cachedSetTimeout = setTimeout;
              } else {
                cachedSetTimeout = defaultSetTimout;
              }
            } catch (e) {
              cachedSetTimeout = defaultSetTimout;
            }
            try {
              if (typeof clearTimeout === "function") {
                cachedClearTimeout = clearTimeout;
              } else {
                cachedClearTimeout = defaultClearTimeout;
              }
            } catch (e) {
              cachedClearTimeout = defaultClearTimeout;
            }
          })();
          function runTimeout(fun) {
            if (cachedSetTimeout === setTimeout) {
              //normal enviroments in sane situations
              return setTimeout(fun, 0);
            }
            // if setTimeout wasn't available but was latter defined
            if (
              (cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) &&
              setTimeout
            ) {
              cachedSetTimeout = setTimeout;
              return setTimeout(fun, 0);
            }
            try {
              // when when somebody has screwed with setTimeout but no I.E. maddness
              return cachedSetTimeout(fun, 0);
            } catch (e) {
              try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                return cachedSetTimeout.call(null, fun, 0);
              } catch (e) {
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                return cachedSetTimeout.call(this, fun, 0);
              }
            }
          }
          function runClearTimeout(marker) {
            if (cachedClearTimeout === clearTimeout) {
              //normal enviroments in sane situations
              return clearTimeout(marker);
            }
            // if clearTimeout wasn't available but was latter defined
            if (
              (cachedClearTimeout === defaultClearTimeout ||
                !cachedClearTimeout) &&
              clearTimeout
            ) {
              cachedClearTimeout = clearTimeout;
              return clearTimeout(marker);
            }
            try {
              // when when somebody has screwed with setTimeout but no I.E. maddness
              return cachedClearTimeout(marker);
            } catch (e) {
              try {
                // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                return cachedClearTimeout.call(null, marker);
              } catch (e) {
                // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                return cachedClearTimeout.call(this, marker);
              }
            }
          }
          var queue = [];
          var draining = false;
          var currentQueue;
          var queueIndex = -1;

          function cleanUpNextTick() {
            if (!draining || !currentQueue) {
              return;
            }
            draining = false;
            if (currentQueue.length) {
              queue = currentQueue.concat(queue);
            } else {
              queueIndex = -1;
            }
            if (queue.length) {
              drainQueue();
            }
          }

          function drainQueue() {
            if (draining) {
              return;
            }
            var timeout = runTimeout(cleanUpNextTick);
            draining = true;

            var len = queue.length;
            while (len) {
              currentQueue = queue;
              queue = [];
              while (++queueIndex < len) {
                if (currentQueue) {
                  currentQueue[queueIndex].run();
                }
              }
              queueIndex = -1;
              len = queue.length;
            }
            currentQueue = null;
            draining = false;
            runClearTimeout(timeout);
          }

          process.nextTick = function (fun) {
            var args = new Array(arguments.length - 1);
            if (arguments.length > 1) {
              for (var i = 1; i < arguments.length; i++) {
                args[i - 1] = arguments[i];
              }
            }
            queue.push(new Item(fun, args));
            if (queue.length === 1 && !draining) {
              runTimeout(drainQueue);
            }
          };

          // v8 likes predictible objects
          function Item(fun, array) {
            this.fun = fun;
            this.array = array;
          }
          Item.prototype.run = function () {
            this.fun.apply(null, this.array);
          };
          process.title = "browser";
          process.browser = true;
          process.env = {};
          process.argv = [];
          process.version = ""; // empty string to avoid regexp issues
          process.versions = {};

          function noop() {}

          process.on = noop;
          process.addListener = noop;
          process.once = noop;
          process.off = noop;
          process.removeListener = noop;
          process.removeAllListeners = noop;
          process.emit = noop;
          process.prependListener = noop;
          process.prependOnceListener = noop;

          process.listeners = function (name) {
            return [];
          };

          process.binding = function (name) {
            throw new Error("process.binding is not supported");
          };

          process.cwd = function () {
            return "/";
          };
          process.chdir = function (dir) {
            throw new Error("process.chdir is not supported");
          };
          process.umask = function () {
            return 0;
          };
        },
        {},
      ],
    },
    {},
    [1]
  )(1);
});
