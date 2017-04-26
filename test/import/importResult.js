'use strict';

const ImportResult = require('../../src/import/ImportResult');
const constants = require('../../src/constants');


function getValidResult(importType) {
    const result = new ImportResult();
    switch (importType) {
        case constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT:
            Object.assign(result, {
                id: 'test',
                kind: 'test',
                reference: 'testRef',
                owner: 'a@a.com',
                groups: ['groupRead'],
                jpath: ['jpath', 'in', 'document'],
                field: 'text',
                metadata: {
                    metaField: 'test'
                }
            });
            result.skipAttachment();
            break;
        case constants.IMPORT_UPDATE_$CONTENT_ONLY:
            Object.assign(result, {
                id: 'test',
                kind: 'test',
                reference: 'testRef',
                owner: 'a@a.com'
            });
            result.skipAttachment();
            result.skipMetadata();
            break;
        case constants.IMPORT_UPDATE_FULL:
            Object.assign(result, {
                id: 'test',
                kind: 'test',
                reference: 'testRef',
                owner: 'a@a.com',
                jpath: ['jpath', 'in', 'document'],
                field: 'text',
                content_type: 'text/plain',
                metadata: {
                    metaField: 'test'
                }
            });
            result.addAttachment({
                jpath: ['jpath'],
                content_type: 'text/plain',
                contents: new Buffer('the contents', 'utf-8'),
                filename: 'filename.txt',
                field: 'field',
                reference: 'ref'
            });
            result.addGroup('group2');
            break;
        default:
            throw new Error('Invalid import type');
    }

    return result;
}

describe('ImportResult', function () {
    it('valid import results', function () {
        // Valid results shouldn't throw
        getValidResult(constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT).check();
        getValidResult(constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT).check();
        getValidResult(constants.IMPORT_UPDATE_$CONTENT_ONLY).check();
    });

    it('valid update type', function () {
        // Check type of update
        getValidResult(constants.IMPORT_UPDATE_FULL).getUpdateType().should.equal(constants.IMPORT_UPDATE_FULL);
        getValidResult(constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT).getUpdateType().should.equal(constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT);
        getValidResult(constants.IMPORT_UPDATE_$CONTENT_ONLY).getUpdateType().should.equal(constants.IMPORT_UPDATE_$CONTENT_ONLY);
    });


    it('throws when fields are missing - full upload', function () {
        // Mandotory fields
        checkWithoutPropShouldThrow('id', 'id should be defined', constants.IMPORT_UPDATE_FULL);
        checkWithoutPropShouldThrow('kind', 'kind should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutPropShouldThrow('owner', 'owner should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutPropShouldThrow('groups', 'groups should be Array', constants.IMPORT_UPDATE_FULL);

        // Additional attachments
        checkWithoutAttachmentPropShouldThrow('filename', 'In attachment: filename should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutAttachmentPropShouldThrow('jpath', 'In attachment: jpath should be Array', constants.IMPORT_UPDATE_FULL);
        checkWithoutAttachmentPropShouldThrow('field', 'In attachment: field should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutAttachmentPropShouldThrow('reference', 'In attachment: reference should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutAttachmentPropShouldThrow('contents', 'In attachment: contents should be defined', constants.IMPORT_UPDATE_FULL);
        checkWithoutAttachmentPropShouldThrow('content_type', 'In attachment: content_type should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutAttachmentPropShouldThrow('metadata', 'In attachment: metadata should be Object', constants.IMPORT_UPDATE_FULL);

        // Full import
        checkWithoutPropShouldThrow('content_type', 'content_type should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutPropShouldThrow('metadata', 'metadata should be Object', constants.IMPORT_UPDATE_FULL);
        checkWithoutPropShouldThrow('field', 'field should be String', constants.IMPORT_UPDATE_FULL);
        checkWithoutPropShouldThrow('reference', 'reference should be String', constants.IMPORT_UPDATE_FULL);

        // Import without attachment
    });

    it('throws when fields are missing - without attachment', function () {
        checkWithoutPropShouldThrow('id', 'id should be defined', constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT);
        checkWithoutPropShouldThrow('kind', 'kind should be String', constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT);
        checkWithoutPropShouldThrow('owner', 'owner should be String', constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT);
        checkWithoutPropShouldThrow('groups', 'groups should be Array', constants.IMPORT_UPDATE_WITHOUT_ATTACHMENT);
    });

    it('throws when fields aer missing - content only', function () {
        checkWithoutPropShouldThrow('id', 'id should be defined', constants.IMPORT_UPDATE_$CONTENT_ONLY);
        checkWithoutPropShouldThrow('kind', 'kind should be String', constants.IMPORT_UPDATE_$CONTENT_ONLY);
        checkWithoutPropShouldThrow('owner', 'owner should be String', constants.IMPORT_UPDATE_$CONTENT_ONLY);
        checkWithoutPropShouldThrow('groups', 'groups should be Array', constants.IMPORT_UPDATE_$CONTENT_ONLY);
    });

    it('Cannot skip metadata without skipping attachment', function () {
        const result = new ImportResult();
        result.skipMetadata();
        (function () {
            result.getUpdateType();
        }).should.throw('Cannot skip metadata without skipping attachment');
    });
});

function checkWithoutPropShouldThrow(prop, message, importType) {
    const importResult = getValidResult(importType);

    delete importResult[prop];
    (function () {
        importResult.check();
    }).should.throw(message);
}

function checkWithoutAttachmentPropShouldThrow(prop, message, importType) {
    const importResult = getValidResult(importType);
    delete importResult.attachments[0][prop];
    (function () {
        importResult.check();
    }).should.throw(message);
}