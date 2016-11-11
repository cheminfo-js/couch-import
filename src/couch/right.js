'use strict';

const CouchError = require('../util/CouchError');
const debug = require('../util/debug')('main:right');
const nanoPromise = require('../util/nanoPromise');
const constants = require('../constants');
const util = require('./util');

const methods = {
    async editGlobalRight(type, user, action) {
        if (action !== 'add' && action !== 'remove') {
            throw new CouchError('Edit global right invalid action', 'bad argument');
        }
        let e = checkGlobalTypeAndUser(type, user);
        if (e) {
            throw e;
        }

        const doc = await nanoPromise.getDocument(this._db, constants.RIGHTS_DOC_ID);
        if (!doc) throw new Error('Rights document should always exist', 'unreachable');
        if (action === 'add') {
            if (!doc[type]) doc[type] = [];
            if (doc[type].indexOf(user) === -1) {
                doc[type].push(user);
            }
        }
        if (action === 'remove') {
            if (doc[type]) {
                const idx = doc[type].indexOf(user);
                if (idx !== -1) {
                    doc[type].splice(idx, 1);
                }
            }
        }

        return nanoPromise.insertDocument(this._db, doc);
    },

    addGlobalRight(type, user) {
        debug(`addGlobalRight (${type}, ${user})`);
        return this.editGlobalRight(type, user, 'add');
    },

    removeGlobalRight(type, user) {
        debug(`addGlobalRight (${type}, ${user})`);
        return this.editGlobalRight(type, user, 'remove');
    },

    async hasRightForEntry(uuid, user, right, options) {
        debug(`has right for entry (${uuid}, ${user}, ${right})`);
        try {
            await this.getEntryByUuidAndRights(uuid, user, right, options);
            return true;
        } catch (e) {
            if (e.reason === 'unauthorized') return false;
            // Propagate
            throw e;
        }
    }
};

function checkGlobalTypeAndUser(type, user) {
    if (!util.isValidGlobalRightType(type)) {
        return new CouchError('Invalid global right type', 'bad argument');
    }
    if (!util.isValidGlobalRightUser(user)) {
        return new CouchError('Invalid global right user', 'bad argument');
    }
    return null;
}

module.exports = {
    methods
};