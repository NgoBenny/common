const { load } = require("./load-ts.cjs");
module.exports = (db, validation = load("app/lib/validation.ts")) =>
  load("app/lib/restrictions.ts", {
    "server-only": {},
    "./db": db,
    "./validation": validation,
  });
