const mongoose = require('mongoose');
const Filter = require('bad-words');

const Theme = require('../models/theme');
const User = require('../models/user');

exports.checkThemeId = (req, res, next) => {
    const themeId = req.params.themeId || req.params._id;
    
    if (!mongoose.Types.ObjectId.isValid(themeId)) {
        return res.status(400).json({ status: 400, error: 'Invalid Theme ID.' });
    }

    next();
};

exports.checkUserAuthenticated = (req, res, next) => {
    const headerSecret = req.header('X-BOT-SECRET');

    if (req.user || (headerSecret !== undefined && headerSecret === process.env.X_BOT_SECRET)) {
        return next();
    }

    return res.status(401).json({ status: 401, error: 'User is not authenticated' });
};

exports.verifyOwner = async (req, res, next) => {
    const themeId = req.params._id;
    const theme = await Theme.findById(themeId);

    if (!theme) {
        return res.status(404).json({ status: 404, error: 'Theme not found.' });
    }

    if (theme.userId.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ status: 403, error: 'You are not the owner of this theme.' });
    }

    next();
};

exports.checkBotSecret = (req, res, next) => {
    const botSecret = req.headers['x-bot-secret'];

    if (!botSecret || botSecret !== process.env.BOT_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    next();
};

exports.checkTitleLength = (req, res, next) => {
    const { title } = req.body;
    let filter = new Filter();

    if (!title || title.length < 3 || title.length > 24) {
        return res.status(400).json({ status: 400, error: 'Title should be between 3 to 24 characters.' });
    }

    if (filter.isProfane(title)) {
        return res.status(400).json({ status: 400, error: 'Title must not contain profanity.' });
    }

    next();
};

exports.checkDescriptionLength = (req, res, next) => {
    const { description = '' } = req.body;
    let filter = new Filter();

    if (description === null) {
        next();
        return;
    }

    if (description.length > 64) {
        return res.status(400).json({ status: 400, error: 'Description should be up to 64 characters.' });
    }

    if (filter.isProfane(description)) {
        return res.status(400).json({ status: 400, error: 'Description must not contain profanity.' });
    }

    next();
};