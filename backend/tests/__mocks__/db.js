// Minimal mock for pg Pool used in unit tests
// Exports an object with query, connect and end methods.
module.exports = {
  query: async () => ({ rows: [], rowCount: 0 }),
  connect: async () => {},
  end: async () => {}
};
