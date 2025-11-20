module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/backend/tests', '<rootDir>/backend/integration'],
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
      maxWorkers: 1,
  setupFilesAfterEnv: ['./backend/integration/jest.setup.js'],

  collectCoverageFrom: ['backend/src/**/*.js', '!backend/src/config/db.js'],
  // Use the real DB pool during tests by default. If you need to use the mock
  // database for quick unit tests, you can temporarily re-enable the
  // `moduleNameMapper` entry below or set up a separate Jest config for
  // mocked tests.
  // moduleNameMapper: {
  //   '^backend/src/config/db$': '<rootDir>/backend/tests/__mocks__/db.js'
  // }
};
