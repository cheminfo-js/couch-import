'use strict';

const data = require('./data/data');
const noRights = require('./data/noRights');

describe('Query default data', function () {
    before(data);
    it('Should query by user id', function () {
        return couch.queryViewByUser('a@a.com', 'entryById')
            .then(rows => {
                rows.length.should.equal(2);
            });
    });

    it('Should query by user id with key', function () {
        return couch.queryViewByUser('a@a.com', 'entryById', { key: 'A'})
            .then(rows => {
                rows.length.should.equal(1);
            });
    });
});

describe('Query no rights data', function () {
    before(noRights);

    it.only('Should not grant access to all entries', function () {
        return couch.queryViewByUser('a@a.com', 'entryById')
            .then(rows => {
                rows.length.should.equal(1);
            });
    });
});