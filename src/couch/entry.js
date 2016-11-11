'use strict';

const CouchError = require('../util/CouchError');
const debug = require('../util/debug')('main:entry');
const nanoPromise = require('../util/nanoPromise');
const validateMethods = require('./validate');
const nanoMethods = require('./nano');
const util = require('./util');

const methods = {
    async getEntryByIdAndRights(id, user, rights, options = {}) {
        debug(`getEntryByIdAndRights (${id}, ${user}, ${rights})`);
        await this.open();

        const owners = await getOwnersById(this._db, id);
        if (owners.length === 0) {
            debug.trace(`no entry matching id ${id}`);
            throw new CouchError('document not found', 'not found');
        }
        let hisEntry = owners.find(own => own.value[0] === user);
        if (!hisEntry) {
            hisEntry = owners[0];
        }

        if (await validateMethods.validateTokenOrRights(this._db, hisEntry.id, hisEntry.value, rights, user, options.token)) {
            debug.trace(`user ${user} has access`);
            return nanoPromise.getDocument(this._db, hisEntry.id, options);
        }

        debug.trace(`user ${user} has no ${rights} access`);
        throw new CouchError('user has no access', 'unauthorized');
    },

    async getEntryByUuidAndRights(uuid, user, rights, options = {}) {
        debug(`getEntryByUuidAndRights (${uuid}, ${user}, ${rights})`);
        await this.open();

        const doc = await nanoPromise.getDocument(this._db, uuid);
        if (!doc) {
            debug.trace('document not found');
            throw new CouchError('document not found', 'not found');
        }
        if (doc.$type !== 'entry') {
            debug.trace('document is not an entry');
            throw new CouchError('document is not an entry', 'not entry');
        }

        debug.trace('check rights');
        if (await validateMethods.validateTokenOrRights(this._db, uuid, doc.$owners, rights, user, options.token)) {
            debug.trace(`user ${user} has access`);
            if (!options) {
                return doc;
            } else {
                return nanoPromise.getDocument(this._db, uuid, options);
            }
        }

        debug.trace(`user ${user} has no ${rights} access`);
        throw new CouchError('user has no access', 'unauthorized');
    },

    getEntryByUuid(uuid, user, options) {
        return this.getEntryByUuidAndRights(uuid, user, 'read', options);
    },

    getEntryById(id, user, options) {
        return this.getEntryByIdAndRights(id, user, 'read', options);
    },

    async deleteEntryByUuid(uuid, user) {
        debug(`deleteEntryByUuid (${uuid}, ${user})`);
        await this.getEntryByUuidAndRights(uuid, user, 'delete');
        return nanoPromise.destroyDocument(this._db, uuid);
    },

    async deleteEntryById(id, user) {
        debug(`deleteEntryById (${id}, ${user})`);
        const doc = await this.getEntryByIdAndRights(id, user, 'delete');
        return nanoPromise.destroyDocument(this._db, doc._id);
    },

    async createEntry(id, user, options) {
        options = options || {};
        debug(`createEntry (id: ${id}, user: ${user}, kind: ${options.kind})`);
        await this.open();
        const result = await nanoPromise.queryView(this._db, 'entryByOwnerAndId', {
            key: [user, id],
            reduce: false,
            include_docs: true
        });
        if (result.length === 0) {
            const hasRight = await validateMethods.checkRightAnyGroup(this._db, user, 'create');
            if (!hasRight) {
                throw new CouchError('user is missing create right', 'unauthorized');
            }
            let newEntry;
            const defaultEntry = this._defaultEntry;
            if (typeof defaultEntry === 'function') {
                newEntry = defaultEntry.apply(null, options.createParameters || []);
            } else if (typeof defaultEntry[options.kind] === 'function') {
                newEntry = defaultEntry[options.kind].apply(null, options.createParameters || []);
            } else {
                throw new CouchError('unexpected type for default entry');
            }
            const owners = options.owners || [];
            const entry = await Promise.resolve(newEntry);
            const toInsert = {
                $id: id,
                $type: 'entry',
                $owners: [user].concat(owners),
                $content: entry,
                $kind: options.kind
            };
            return nanoMethods.saveEntry(this._db, toInsert, user);
        }
        debug.trace('entry already exists');
        if (options.throwIfExists) {
            throw new CouchError('entry already exists', 'conflict');
        }
        // Return something similar to insertDocument
        return {
            ok: true,
            id: result[0].doc._id,
            rev: result[0].doc._rev,
            $modificationDate: result[0].doc.$modificationDate,
            $creationDate: result[0].doc.$creationDate
        };
    },

    async getEntriesByUserAndRights(user, rights, options = {}) {
        debug(`getEntriesByUserAndRights (${user}, ${rights})`);
        const limit = options.limit;
        const skip = options.skip;

        await this.open();

        // First we get a list of owners for each document
        const owners = await nanoPromise.queryView(this._db, 'ownersById', {
            reduce: false,
            include_docs: false
        });

        // Check rights for current user and keep only documents with granted access
        const hasRights = await validateMethods.validateRights(this._db, owners.map(r => r.value), user, rights || 'read');
        let allowedDocs = owners.filter((r, idx) => hasRights[idx]);

        // Apply pagination options
        if (skip) allowedDocs = allowedDocs.slice(skip);
        if (limit) allowedDocs = allowedDocs.slice(0, limit);

        // Get each document from CouchDB
        return Promise.all(allowedDocs.map(doc => nanoPromise.getDocument(this._db, doc.id)));
    },

    async _doUpdateOnEntry(id, user, update, updateBody) {
        // Call update handler
        await this.open();
        const doc = await this.getEntryById(id, user);
        const hasRight = validateMethods.isOwner(doc.$owners, user);
        if (!hasRight) {
            throw new CouchError('unauthorized to edit group (only owner can)', 'unauthorized');
        }
        return nanoPromise.updateWithHandler(this._db, update, doc._id, updateBody);
    },

    async _doUpdateOnEntryByUuid(uuid, user, update, updateBody) {
        await this.open();
        const doc = await this.getEntryByUuid(uuid, user);
        const hasRight = validateMethods.isOwner(doc.$owners, user);
        if (!hasRight) {
            throw new CouchError('unauthorized to edit group (only owner can)', 'unauthorized');
        }
        return nanoPromise.updateWithHandler(this._db, update, uuid, updateBody);
    },

    async insertEntry(entry, user, options) {
        debug(`insertEntry (id: ${entry._id}, user: ${user}, options: ${options})`);
        await this.open();

        options = options || {};
        options.groups = options.groups || [];
        if (!entry.$content) throw new CouchError('entry has no content');
        if (options.groups !== undefined && !Array.isArray(options.groups)) throw new CouchError('options.groups should be an array if defined', 'invalid argument');

        if (entry._id && options.isNew) {
            debug.trace('new entry has _id');
            throw new CouchError('entry should not have _id', 'bad argument');
        }

        const notFound = onNotFound(this, entry, user, options);

        let result;
        let action = 'updated';
        if (entry._id) {
            try {
                const doc = await this.getEntryByUuidAndRights(entry._id, user, ['write']);
                result = await updateEntry(this, doc, entry, user, options);
            } catch (e) {
                result = await notFound(e);
                action = 'created';
            }
        } else if (entry.$id) {
            debug.trace('entry has no _id but has $id');
            try {
                const doc = await this.getEntryByIdAndRights(entry.$id, user, ['write']);
                result = await updateEntry(this, doc, entry, user, options);
            } catch (e) {
                result = await notFound(e);
                action = 'created';
            }
        } else {
            debug.trace('entry has no _id nor $id');
            if (options.isUpdate) {
                throw new CouchError('entry should have an _id', 'bad argument');
            }
            const res = await createNew(this, entry, user);
            action = 'created';
            await util.addGroups(res, this, user, options.groups);
            result = res;
        }

        return {info: result, action};
    }
};

async function getOwnersById(db, id) {
    return nanoPromise.queryView(db, 'ownersById', {key: id});
}

function onNotFound(ctx, entry, user, options) {
    return async (error) => {
        if (error.reason === 'not found') {
            debug.trace('doc not found');
            if (options.isUpdate) {
                throw new CouchError('Document does not exist', 'not found');
            }

            const res = await createNew(ctx, entry, user);
            await util.addGroups(res, ctx, user, options.groups);
            return res;
        } else {
            throw error;
        }
    };
}

async function createNew(ctx, entry, user) {
    debug.trace('create new');
    const ok = await validateMethods.checkGlobalRight(ctx._db, user, 'create');
    if (ok) {
        debug.trace('has right, create new');
        const newEntry = {
            $type: 'entry',
            $id: entry.$id,
            $kind: entry.$kind,
            $owners: [user],
            $content: entry.$content,
            _attachments: entry._attachments
        };
        return nanoMethods.saveEntry(ctx._db, newEntry, user);
    } else {
        let msg = `${user} not allowed to create`;
        debug.trace(msg);
        throw new CouchError(msg, 'unauthorized');
    }
}

async function updateEntry(ctx, oldDoc, newDoc, user, options) {
    debug.trace('update entry');
    if (oldDoc._rev !== newDoc._rev) {
        debug.trace('document and entry _rev differ');
        throw new CouchError('document and entry _rev differ', 'conflict');
    }
    if (options.merge) {
        for (let key in newDoc.$content) {
            oldDoc.$content[key] = newDoc.$content[key];
        }
    } else {
        oldDoc.$content = newDoc.$content;
    }
    if (newDoc._attachments) {
        oldDoc._attachments = newDoc._attachments;
    }
    for (let key in newDoc) {
        if (util.isAllowedFirstLevelKey(key)) {
            oldDoc[key] = newDoc[key];
        }
    }
    // Doc validation will fail $kind changed
    oldDoc.$kind = newDoc.$kind;
    const res = await nanoMethods.saveEntry(ctx._db, oldDoc, user);
    await util.addGroups(res, ctx, user, options.groups);
    return res;
}

module.exports = {
    methods
};
