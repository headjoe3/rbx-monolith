const assert = require('chai').assert;
const index = require('../out/index');

describe('Index', function() {
    it('should return no exports', function() {
        assert.deepEqual(index, {})
    })
})