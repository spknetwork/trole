!(function (e) {
  if ("object" == typeof exports && "undefined" != typeof module)
    module.exports = e();
  else if ("function" == typeof define && define.amd) define([], e);
  else {
    ("undefined" != typeof window
      ? window
      : "undefined" != typeof global
      ? global
      : "undefined" != typeof self
      ? self
      : this
    ).dragDrop = e();
  }
})(function () {
  return (function () {
    return function e(t, r, n) {
      function o(a, f) {
        if (!r[a]) {
          if (!t[a]) {
            var u = "function" == typeof require && require;
            if (!f && u) return u(a, !0);
            if (i) return i(a, !0);
            var l = new Error("Cannot find module '" + a + "'");
            throw ((l.code = "MODULE_NOT_FOUND"), l);
          }
          var s = (r[a] = { exports: {} });
          t[a][0].call(
            s.exports,
            function (e) {
              return o(t[a][1][e] || e);
            },
            s,
            s.exports,
            e,
            t,
            r,
            n
          );
        }
        return r[a].exports;
      }
      for (
        var i = "function" == typeof require && require, a = 0;
        a < n.length;
        a++
      )
        o(n[a]);
      return o;
    };
  })()(
    {
      1: [
        function (e, t, r) {
          var n,
            o,
            i = (t.exports = {});

          function a() {
            throw new Error("setTimeout has not been defined");
          }

          function f() {
            throw new Error("clearTimeout has not been defined");
          }

          function u(e) {
            if (n === setTimeout) return setTimeout(e, 0);
            if ((n === a || !n) && setTimeout)
              return (n = setTimeout), setTimeout(e, 0);
            try {
              return n(e, 0);
            } catch (t) {
              try {
                return n.call(null, e, 0);
              } catch (t) {
                return n.call(this, e, 0);
              }
            }
          }
          !(function () {
            try {
              n = "function" == typeof setTimeout ? setTimeout : a;
            } catch (e) {
              n = a;
            }
            try {
              o = "function" == typeof clearTimeout ? clearTimeout : f;
            } catch (e) {
              o = f;
            }
          })();
          var l,
            s = [],
            c = !1,
            d = -1;

          function p() {
            c &&
              l &&
              ((c = !1),
              l.length ? (s = l.concat(s)) : (d = -1),
              s.length && h());
          }

          function h() {
            if (!c) {
              var e = u(p);
              c = !0;
              for (var t = s.length; t; ) {
                for (l = s, s = []; ++d < t; ) l && l[d].run();
                (d = -1), (t = s.length);
              }
              (l = null),
                (c = !1),
                (function (e) {
                  if (o === clearTimeout) return clearTimeout(e);
                  if ((o === f || !o) && clearTimeout)
                    return (o = clearTimeout), clearTimeout(e);
                  try {
                    o(e);
                  } catch (t) {
                    try {
                      return o.call(null, e);
                    } catch (t) {
                      return o.call(this, e);
                    }
                  }
                })(e);
            }
          }

          function m(e, t) {
            (this.fun = e), (this.array = t);
          }

          function g() {}
          (i.nextTick = function (e) {
            var t = new Array(arguments.length - 1);
            if (arguments.length > 1)
              for (var r = 1; r < arguments.length; r++)
                t[r - 1] = arguments[r];
            s.push(new m(e, t)), 1 !== s.length || c || u(h);
          }),
            (m.prototype.run = function () {
              this.fun.apply(null, this.array);
            }),
            (i.title = "browser"),
            (i.browser = !0),
            (i.env = {}),
            (i.argv = []),
            (i.version = ""),
            (i.versions = {}),
            (i.on = g),
            (i.addListener = g),
            (i.once = g),
            (i.off = g),
            (i.removeListener = g),
            (i.removeAllListeners = g),
            (i.emit = g),
            (i.prependListener = g),
            (i.prependOnceListener = g),
            (i.listeners = function (e) {
              return [];
            }),
            (i.binding = function (e) {
              throw new Error("process.binding is not supported");
            }),
            (i.cwd = function () {
              return "/";
            }),
            (i.chdir = function (e) {
              throw new Error("process.chdir is not supported");
            }),
            (i.umask = function () {
              return 0;
            });
        },
        {},
      ],
      2: [
        function (e, t, r) {
          t.exports = function (e, t) {
            if ("string" == typeof e) {
              const t = e;
              if (!(e = window.document.querySelector(e)))
                throw new Error(`"${t}" does not match any HTML elements`);
            }
            if (!e) throw new Error(`"${e}" is not a valid HTML element`);
            "function" == typeof t && (t = { onDrop: t });
            let r;
            return (
              e.addEventListener("dragenter", i, !1),
              e.addEventListener("dragover", a, !1),
              e.addEventListener("dragleave", f, !1),
              e.addEventListener("drop", u, !1),
              function () {
                l(),
                  e.removeEventListener("dragenter", i, !1),
                  e.removeEventListener("dragover", a, !1),
                  e.removeEventListener("dragleave", f, !1),
                  e.removeEventListener("drop", u, !1);
              }
            );

            function i(e) {
              return (
                t.onDragEnter && t.onDragEnter(e),
                e.stopPropagation(),
                e.preventDefault(),
                !1
              );
            }

            function a(n) {
              if (
                (n.stopPropagation(),
                n.preventDefault(),
                t.onDragOver && t.onDragOver(n),
                n.dataTransfer.items || n.dataTransfer.types)
              ) {
                const e = Array.from(n.dataTransfer.items),
                  r = Array.from(n.dataTransfer.types);
                let o, i;
                if (
                  (e.length
                    ? ((o = e.filter((e) => "file" === e.kind)),
                      (i = e.filter((e) => "string" === e.kind)))
                    : r.length &&
                      ((o = r.filter((e) => "Files" === e)),
                      (i = r.filter((e) => e.startsWith("text/")))),
                  0 === o.length && !t.onDropText)
                )
                  return;
                if (0 === i.length && !t.onDrop) return;
                if (0 === o.length && 0 === i.length) return;
              }
              return (
                e.classList.add("drag"),
                clearTimeout(r),
                (n.dataTransfer.dropEffect = "copy"),
                !1
              );
            }

            function f(e) {
              return (
                e.stopPropagation(),
                e.preventDefault(),
                t.onDragLeave && t.onDragLeave(e),
                clearTimeout(r),
                (r = setTimeout(l, 50)),
                !1
              );
            }

            function u(e) {
              e.stopPropagation(),
                e.preventDefault(),
                t.onDragLeave && t.onDragLeave(e),
                clearTimeout(r),
                l();
              const i = { x: e.clientX, y: e.clientY },
                a = e.dataTransfer.getData("text");
              if (
                (a && t.onDropText && t.onDropText(a, i),
                t.onDrop && e.dataTransfer.items)
              ) {
                const r = e.dataTransfer.files,
                  a = Array.from(e.dataTransfer.items).filter(
                    (e) => "file" === e.kind
                  );
                if (0 === a.length) return;
                n(
                  a.map((e) => (t) => {
                    !(function (e, t) {
                      let r = [];
                      if (e.isFile)
                        e.file(
                          (r) => {
                            (r.fullPath = e.fullPath),
                              (r.isFile = !0),
                              (r.isDirectory = !1),
                              t(null, r);
                          },
                          (e) => {
                            t(e);
                          }
                        );
                      else if (e.isDirectory) {
                        const i = e.createReader();
                        !(function i(a) {
                          a.readEntries((f) => {
                            f.length > 0
                              ? ((r = r.concat(Array.from(f))), i(a))
                              : n(
                                  r.map((e) => (t) => {
                                    o(e, t);
                                  }),
                                  (r, n) => {
                                    r
                                      ? t(r)
                                      : (n.push({
                                          fullPath: e.fullPath,
                                          name: e.name,
                                          isFile: !1,
                                          isDirectory: !0,
                                        }),
                                        t(null, n));
                                  }
                                );
                          });
                        })(i);
                      }
                    })(e.webkitGetAsEntry(), t);
                  }),
                  (e, n) => {
                    if (e) throw e;
                    const o = n.flat(1 / 0),
                      a = o.filter((e) => e.isFile),
                      f = o.filter((e) => e.isDirectory);
                    t.onDrop(a, i, r, f);
                  }
                );
              }
              return !1;
            }

            function l() {
              e.classList.remove("drag");
            }
          };
          const n = e("run-parallel");

          function o(e, t) {
            let r = [];
            if (e.isFile) {
              e.file(
                (r) => {
                  r.fullPath = e.fullPath;
                  r.isFile = true;
                  r.isDirectory = false;
                  t(null, r);
                },
                (e) => {
                  t(e);
                }
              );
            } else if (e.isDirectory) {
              const t = e.createReader();
              i(t);
            }

            function i(e) {
              e.readEntries((t) => {
                if (t.length > 0) {
                  r = r.concat(Array.from(t));
                  i(e);
                } else {
                  a();
                }
              });
            }

            function a() {
              n(
                r.map((e) => {
                  return (t) => {
                    o(e, t);
                  };
                }),
                (r, n) => {
                  if (r) {
                    t(r);
                  } else {
                    n.push({
                      fullPath: e.fullPath,
                      name: e.name,
                      isFile: false,
                      isDirectory: true,
                    });
                    t(null, n);
                  }
                }
              );
            }
          }
        },
        { "run-parallel": 3 },
      ],
      3: [
        function (e, t, r) {
          (function (e) {
            t.exports = function (t, r) {
              var n,
                o,
                i,
                a = !0;
              Array.isArray(t)
                ? ((n = []), (o = t.length))
                : ((i = Object.keys(t)), (n = {}), (o = i.length));

              function f(t) {
                function o() {
                  r && r(t, n), (r = null);
                }
                a ? e.nextTick(o) : o();
              }

              function u(e, t, r) {
                (n[e] = r), (0 == --o || t) && f(t);
              }
              o
                ? i
                  ? i.forEach(function (e) {
                      t[e](function (t, r) {
                        u(e, t, r);
                      });
                    })
                  : t.forEach(function (e, t) {
                      e(function (e, r) {
                        u(t, e, r);
                      });
                    })
                : f(null);
              a = !1;
            };
          }.call(this, e("_process")));
        },
        { _process: 1 },
      ],
    },
    {},
    [2]
  )(2);
});
