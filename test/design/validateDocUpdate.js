'use strict';

const validateDocUpdate = require('../../src/design/validateDocUpdate');

describe('validate_doc_update', function () {
    describe('general', function () {
        it('$type', function () {
            assert({$type: 'abc'}, null, 'Invalid type');
            assert({$type: 'entry'}, {$type: 'group'}, /Cannot change the type/);
        });
    });
    describe('$type: entry', function () {
        it('id', function () {
            assert({$type: 'entry'}, null, 'ID is mandatory');
            assert(
                addOwners(addDate({$type: 'entry', $id: 'abc'})),
                addOwners(addDate({$type: 'entry', $id: 'xyz'})),
                'Cannot change the ID'
            );
        });
        it('date', function () {
            assert({$type: 'entry', $id: 'abc'}, null, /dates are mandatory/);
            assert(addOwners(addTypeID({$creationDate: 100})), null, /dates are mandatory/);
            assert(addOwners(addTypeID({$creationDate: 100, $modificationDate: 50})), null, /cannot be before/);
            assert(addOwners(addTypeID({$creationDate: 99, $modificationDate: 100})), addTypeID({$creationDate: 100}), 'Cannot change creation date');
            assert(addOwners(addTypeID({$creationDate: 200, $modificationDate: 220})), addTypeID({$creationDate: 200, $modificationDate: 250}), /cannot change to the past/);
        });
        it('owners', function () {
            assert(addDate(addTypeID({$owners: []})), null, /must be an email/);
            assert(addDate(addTypeID({$owners: ['abc']})), null, /must be an email/);
            assert(addDate(addTypeID({})), null, /Missing owners/);
        });
    });
});

function assert(newDoc, oldDoc, reg) {
    (function () {
        validateDocUpdate(newDoc, oldDoc);
    }).should.throw({forbidden: reg});
}

function addDate(doc) {
    doc.$creationDate = 100;
    doc.$modificationDate = 100;
    return doc;
}

function addTypeID(doc) {
    doc.$type = 'entry';
    doc.$id = 'abc';
    return doc;
}

function addOwners(doc) {
    doc.$owners = ['abc@xyz.com', 'groupname'];
    return doc;
}