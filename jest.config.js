module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/backend/tests'],
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: ['backend/src/**/*.js', '!backend/src/config/db.js'],
  moduleNameMapper: {
    '^backend/src/config/db$': '<rootDir>/backend/tests/__mocks__/db.js'
  }
};
