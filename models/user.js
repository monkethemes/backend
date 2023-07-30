const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    username: String,
    avatarUrl: String,
});

const User = mongoose.model('User', userSchema);

module.exports = User;
