const mongoose = require('mongoose');

const MetadataSchema = new mongoose.Schema({
    key: String,
    value: String
});

module.exports = mongoose.model('Metadata', MetadataSchema);
