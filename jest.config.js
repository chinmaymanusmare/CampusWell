module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/backend/tests'],
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverageFrom: ['backend/src/**/*.js']
};
