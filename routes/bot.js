const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Theme = require('../models/theme');
const User = require('../models/user');
const Like = require('../models/like');
const {client} = require('../middlewares/meilisearch');

router.get('/themes', async (req, res) => {
    try {
        const headerSecret = req.header('X-BOT-SECRET');
        if (headerSecret === undefined || process.env.X_BOT_SECRET === undefined || headerSecret !== process.env.X_BOT_SECRET) {
            return res.status(403).json({error: 'Unauthorized request.'});
        }

        const themes = await Theme.find({});
        res.json(themes);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

router.post('/user', async (req, res) => {
    try {
        const headerSecret = req.header('X-BOT-SECRET');
        if (headerSecret === undefined || process.env.X_BOT_SECRET === undefined || headerSecret !== process.env.X_BOT_SECRET) {
            return res.status(403).json({error: 'Unauthorized request.'});
        }

        const {userId, username, avatarUrl} = req.body;

        if (!userId || !username || !avatarUrl) {
            return res.status(400).json({error: 'userId, username, and avatarUrl are required.'});
        }

        const user = await User.findOne({userId});

        if (! user) {
            const newUser = new User({userId, username, avatarUrl});
            await newUser.save();
            res.json({user: newUser, message: 'User created.'});
        } else if (user.username !== username || user.avatarUrl !== avatarUrl) {
            user.username = username;
            user.avatarUrl = avatarUrl;
            await user.save();
            res.json({user, message: 'User updated.'});
        } else {
            res.json({user, message: 'No changes made.'});
        }
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

router.post('/like/:id', async (req, res) => {
    try {
        const headerSecret = req.header('X-BOT-SECRET');
        if (headerSecret === undefined || process.env.X_BOT_SECRET === undefined || headerSecret !== process.env.X_BOT_SECRET) {
            return res.status(403).json({error: 'Unauthorized request.'});
        }

        const themeId = req.params.id;
        const userId = req.body.userId;

        if (! userId) {
            return res.status(400).json({error: 'userId is required.'});
        }

        const theme = await Theme.findById(themeId);
        if (! theme) {
            return res.status(404).send('Theme not found.');
        }

        const existingLike = await Like.findOne({themeId, userId});

        if (existingLike) {
            await Like.findOneAndDelete({themeId, userId});

            theme.likes -= 1;
            await theme.save();

            const index = client.index('themes');
            const themeInMeili = await index.getDocument(themeId);

            const updatedLikesList = themeInMeili.likesList.filter(like => like !== userId);
            const likeDateCreated = existingLike.dateCreated;
            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;
            const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

            const likesDay = themeInMeili.likesDay || 0;
            const likesWeek = themeInMeili.likesWeek || 0;
            const updatedLikesDay = likeDateCreated > oneDayAgo ? likesDay - 1 : likesDay;
            const updatedLikesWeek = likeDateCreated > oneWeekAgo ? likesWeek - 1 : likesWeek;

            await index.updateDocuments([{
                    id: themeId,
                    likes: theme.likes,
                    likesList: updatedLikesList,
                    likesDay: updatedLikesDay,
                    likesWeek: updatedLikesWeek
                }]);

            res.json({theme, liked: false});
        } else {
            const like = new Like({themeId, userId});
            await like.save();

            theme.likes += 1;
            await theme.save();

            const index = client.index('themes');
            const document = await index.getDocument(themeId);
            const likesList = document.likesList || [];
            const likesDay = document.likesDay || 0;
            const likesWeek = document.likesWeek || 0;

            likesList.push(userId);
            const update = {
                id: themeId,
                likes: theme.likes,
                likesList: likesList,
                likesDay: likesDay + 1,
                likesWeek: likesWeek + 1
            };
            await index.updateDocuments(update).catch((error) => {
                console.error("MeiliSearch error:", error);
            });

            res.json({theme, liked: true});
        }
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

module.exports = router;
