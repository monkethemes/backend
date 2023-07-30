const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
    themeId: String,
    userId: String,
    dateCreated: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Like', likeSchema);
