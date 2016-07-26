'use strict';

module.exports = {
    database: 'jdx',
    defaultEntry: {
        molecule: function () {
            return {
                parent: [],
                name: [],
                molecule: [],
                nmr: []
            };
        }
    },
    customDesign: {
        version: 1,
        views: {},
        updates: {}
    },
    rights: {
        read: ['anonymous'],
        createGroup: ['anonymous'],
        create: ['anonymous']
    }
};
