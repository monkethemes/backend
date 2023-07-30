const mongoose = require('mongoose');

const themeSchema = new mongoose.Schema({
    title: { type: String, es_indexed: true },
    description: { type: String, es_indexed: true },
    url: String,
    userId: String,
    dateCreated: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    themeData: mongoose.Schema.Types.Mixed,
    brightness: Number
});

const Theme = mongoose.model('Theme', themeSchema);

module.exports = Theme;
