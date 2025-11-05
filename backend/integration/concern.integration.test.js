const request = require('supertest');
const app = require('../src/app');

describe('concern integration placeholders', () => {
	test('placeholder', () => {
		expect(true).toBe(true);
	});
});
