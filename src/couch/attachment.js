'use strict';

const extend = require('extend');

const CouchError = require('../util/CouchError');
const debug = require('../util/debug')('main:attachment');
const nanoPromise = require('../util/nanoPromise');
const nanoMethods = require('./nano');

const methods = {
    async addAttachments(uuid, user, attachments) {
        debug(`addAttachments (${uuid}, ${user})`);
        if (!Array.isArray(attachments)) {
            attachments = [attachments];
        }
        const entry = await this.getEntryWithRights(uuid, user, ['write', 'addAttachment']);
        return nanoPromise.attachFiles(this._db, entry, attachments);
    },

    async deleteAttachment(uuid, user, attachmentName) {
        debug(`deleteAttachment (${uuid}, ${user})`);
        const entry = await this.getEntryWithRights(uuid, user, ['delete', 'addAttachment']);
        if (!entry._attachments[attachmentName]) {
            return false;
        }
        delete entry._attachments[attachmentName];
        return nanoMethods.saveEntry(this._db, entry, user);
    },

    async getAttachmentByName(uuid, name, user, asStream, options) {
        debug(`getAttachmentByName (${uuid}, ${name}, ${user})`);
        const entry = await this.getEntry(uuid, user, options);
        return getAttachmentFromEntry(entry, this, name, asStream);
    },

    async addFileToJpath(id, user, jpath, json, file, newContent) {
        if (!Array.isArray(jpath)) {
            throw new CouchError('jpath must be an array');
        }
        if (typeof json !== 'object') {
            throw new CouchError('json must be an object');
        }
        if (typeof file !== 'object') {
            throw new CouchError('file must be an object');
        }
        if (!file.field || !file.name || !file.data) {
            throw new CouchError('file must have field, name and data properties');
        }

        const entry = await this.getEntryById(id, user);
        let current = entry.$content || {};

        if (newContent) {
            extend(current, newContent);
        }

        for (var i = 0; i < jpath.length; i++) {
            let newCurrent = current[jpath[i]];
            if (!newCurrent) {
                if (i < jpath.length - 1) {
                    newCurrent = current[jpath[i]] = {};
                } else {
                    newCurrent = current[jpath[i]] = [];
                }
            }
            current = newCurrent;
        }
        if (!Array.isArray(current)) {
            throw new CouchError('jpath must point to an array');
        }

        if (file.reference) {
            let found = current.find(el => el.reference === file.reference);
            if (found) {
                Object.assign(found, json);
                json = found;
            } else {
                json.reference = file.reference;
                current.push(json);
            }
        } else {
            current.push(json);
        }

        json[file.field] = {
            filename: file.name
        };

        if (!entry._attachments) entry._attachments = {};

        entry._attachments[file.name] = {
            content_type: file.content_type,
            data: (typeof file.data === 'string') ? file.data : file.data.toString('base64')
        };
        return this.insertEntry(entry, user);
    }
};

methods.addAttachment = methods.addAttachments;

async function getAttachmentFromEntry(entry, ctx, name, asStream) {
    if (entry._attachments && entry._attachments[name]) {
        return nanoPromise.getAttachment(ctx._db, entry._id, name, asStream, {rev: entry._rev});
    } else {
        throw new CouchError(`attachment ${name} not found`, 'not found');
    }
}

module.exports = {
    methods
};
