const firestore = require('./index');

// Converts Firestore Timestamp fields to native JS Dates so res.json(...) serializes them
// as ISO strings, matching the shape Mongoose's timestamps: true used to produce.
function convertTimestamps(data) {
    for (const key of Object.keys(data)) {
        const value = data[key];
        if (value && typeof value.toDate === 'function') {
            data[key] = value.toDate();
        }
    }
    return data;
}

function createModel(collectionName) {
    const collection = () => firestore.collection(collectionName);

    function attachSave(doc, id) {
        Object.defineProperty(doc, 'save', {
            enumerable: false,
            value: async function save() {
                // Strip both id aliases so they're never persisted as real Firestore fields.
                const { id: _id, _id: _mongoId, ...fields } = this;
                fields.updatedAt = new Date();
                await collection().doc(id).set(fields, { merge: true });
                Object.assign(this, fields);
                return this;
            },
        });
        return doc;
    }

    function toDoc(snapshot) {
        if (!snapshot.exists) return null;
        // _id is kept alongside id for backward compatibility with clients (e.g. the
        // backoffice) written against the old Mongoose-backed API, which returned _id.
        const data = convertTimestamps({ id: snapshot.id, _id: snapshot.id, ...snapshot.data() });
        return attachSave(data, snapshot.id);
    }

    function applyConditions(query, conditions) {
        for (const [field, value] of Object.entries(conditions)) {
            query = query.where(field, '==', value);
        }
        return query;
    }

    return {
        collection,

        async create(fields) {
            const now = new Date();
            // Preserve explicit createdAt/updatedAt when passed (e.g. UserBackup copying a
            // user's original timestamps), matching Mongoose's timestamps: true behavior.
            const data = { createdAt: now, updatedAt: now, ...fields };
            const ref = await collection().add(data);
            return attachSave({ id: ref.id, _id: ref.id, ...data }, ref.id);
        },

        async findById(id) {
            if (!id || typeof id !== 'string') return null;
            const snapshot = await collection().doc(id).get();
            return toDoc(snapshot);
        },

        async findOne(conditions = {}) {
            const snapshot = await applyConditions(collection(), conditions).limit(1).get();
            if (snapshot.empty) return null;
            return toDoc(snapshot.docs[0]);
        },

        async find(conditions = {}) {
            const snapshot = await applyConditions(collection(), conditions).get();
            return snapshot.docs.map(toDoc);
        },

        async deleteMany(conditions = {}) {
            const snapshot = await applyConditions(collection(), conditions).get();

            // Firestore batches are capped at 500 writes.
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 500) {
                const batch = firestore.batch();
                for (const doc of docs.slice(i, i + 500)) {
                    batch.delete(doc.ref);
                }
                await batch.commit();
            }
        },
    };
}

module.exports = createModel;
module.exports.convertTimestamps = convertTimestamps;
