'use strict';

module.exports = function (newDoc, oldDoc) {
    // allow to delete documents
    if (newDoc._deleted) {
        return;
    }
    var validTypes = ['entry', 'group', 'db'];
    // see http://emailregex.com/
    var validEmail = /^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?$/i;
    if (!newDoc.$type || validTypes.indexOf(newDoc.$type) === -1) {
        throw({forbidden: 'Invalid type'});
    }
    if (oldDoc && newDoc.$type !== oldDoc.$type) {
        throw({forbidden: 'Cannot change the type of document'});
    }
    if (newDoc.$type === 'entry') {
        if (!newDoc.$id) {
            throw({forbidden: 'ID is mandatory'});
        }
        if (typeof newDoc.$creationDate !== 'number' || typeof newDoc.$modificationDate !== 'number') {
            throw({forbidden: 'Creation and modification dates are mandatory'});
        }
        if (newDoc.$modificationDate < newDoc.$creationDate) {
            throw({forbidden: 'Modification date cannot be before creation date'});
        }
        if (!Array.isArray(newDoc.$owners)) {
            throw({forbidden: 'Missing owners array'});
        }
        if (!validEmail.test(newDoc.$owners[0])) {
            throw({forbidden: 'First owner must be an email'});
        }
        if (oldDoc) {
            if (newDoc.$creationDate !== oldDoc.$creationDate) {
                throw({forbidden: 'Cannot change creation date'});
            }
            if (newDoc.$modificationDate < oldDoc.$modificationDate) {
                throw({forbidden: 'Modification date cannot change to the past'});
            }
            if (newDoc.$id !== oldDoc.$id) {
                throw({forbidden: 'Cannot change the ID'});
            }
        }
    }
};