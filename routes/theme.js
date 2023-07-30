const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Theme = require('../models/theme');
const Like = require('../models/like');
const User = require('../models/user');

const {client} = require('../middlewares/meilisearch');
const {
    checkThemeId,
    checkUserAuthenticated,
    verifyOwner,
    checkTitleLength,
    checkDescriptionLength
} = require('../middlewares/middlewares');
const {imageBrightness, downloadAndProcessImage, generatePreview} = require('../middlewares/imageMiddlewares')

router.get('/:themeId', checkThemeId, async (req, res) => {
    try {
        const theme = await Theme.findById(req.params.themeId);
        if (! theme) {
            return res.status(404).json({error: 'Theme not found.'});
        }

        if (req.user) {
            const like = await Like.findOne({themeId: req.params.themeId, userId: req.user.userId});
            const userLiked = !! like;

            const themeWithUserLiked = {
                ... theme._doc,
                userLiked
            };

            res.json(themeWithUserLiked);
        } else {
            res.json(theme);
        }
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

router.get('/extra/:themeId', async (req, res) => {
    const {themeId} = req.params;
    let userId = null;

    if (req.user) {
        userId = req.user.userId; // Assuming you are storing authenticated user's ID in req.user object
    }

    try { // Find the Theme (you need to replace Theme with your actual Theme model)
        const theme = await Theme.findById(themeId);

        // If theme does not exist
        if (! theme) {
            return res.status(404).json({error: "Theme not found"});
        }

        // Find the user of this theme
        const user = await User.findOne({userId: theme.userId});

        let userLiked = false;
        // Check if the authenticated user liked this theme only if the user is logged in
        if (userId) {
            const userLikedTheme = await Like.findOne({userId, themeId});
            userLiked = Boolean(userLikedTheme); // Convert to boolean. If userLikedTheme is null, it will return false
        }

        // Response
        res.json({username: user.username, userLiked: userLiked, likes: theme.likes});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: error.toString()});
    }
});

router.put('/:_id', checkThemeId, checkUserAuthenticated, verifyOwner, checkTitleLength, checkDescriptionLength, async (req, res) => {
    const fetch = (await import ('node-fetch')).default;
    
    const themeId = req.params._id;
    try {
        const update = {
            id: themeId,
            title: req.body.title,
            description: req.body.description
        };

        const updatedTheme = await Theme.findByIdAndUpdate(themeId, update, {new: true});

        // Get the index
        const index = client.index('themes');

        // Update the document in MeiliSearch
        await index.updateDocuments(update).catch((error) => {
            console.error("MeiliSearch error:", error);
        });

        const botResponse = fetch('http://bot.kenn.pro/webhook/theme-edited', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BOT-SECRET': process.env.X_BOT_SECRET
            },
            body: JSON.stringify({ themeId, title: req.body.title, description: req.body.description })
        });

        res.json(updatedTheme);
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

router.delete('/:_id', checkThemeId, checkUserAuthenticated, verifyOwner, async (req, res) => {
    const fetch = (await import ('node-fetch')).default;
    
    try {
        const deletedTheme = await Theme.findByIdAndRemove(req.params._id);

        // Get the index
        const index = client.index('themes');

        // Delete the document from MeiliSearch
        await index.deleteDocument(req.params._id).catch((error) => {
            console.error("MeiliSearch error:", error);
        });

        const botResponse = fetch('http://bot.kenn.pro/webhook/theme-deleted', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BOT-SECRET': process.env.X_BOT_SECRET
            },
            body: JSON.stringify({ themeId: req.params._id })
        });

        res.json(deletedTheme);
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
})

router.put('/like/:_id', checkThemeId, checkUserAuthenticated, async (req, res) => {
    const fetch = (await import ('node-fetch')).default;

    try {
        const themeId = req.params._id;
        const userId = req.user.userId;

        const theme = await Theme.findById(themeId);
        if (! theme) {
            return res.status(404).send('Theme not found.');
        }

        const existingLike = await Like.findOne({themeId, userId});
        if (existingLike) {
            return res.status(400).json({error: 'User has already liked this theme.'});
        }

        const like = new Like({themeId, userId});
        await like.save();

        theme.likes += 1;
        await theme.save();

        // Get the index
        const index = client.index('themes');

        // Fetch the document
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

        // Send POST request to the webhook
        const webhookResponse = fetch('http://bot.kenn.pro/webhook/theme-liked', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BOT-SECRET': process.env.X_BOT_SECRET
            },
            body: JSON.stringify(
                {themeId, likes: theme.likes}
            )
        });

        res.json(theme);
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

router.delete('/unlike/:_id', checkThemeId, checkUserAuthenticated, async (req, res) => {
    const fetch = (await import ('node-fetch')).default;

    try {
        const themeId = req.params._id;
        const userId = req.user.userId;

        const theme = await Theme.findById(themeId);
        if (! theme) {
            return res.status(404).send('Theme not found.');
        }

        const existingLike = await Like.findOneAndDelete({themeId, userId});
        if (! existingLike) {
            return res.status(400).json({error: 'User has not liked this theme.'});
        }

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

        // Send POST request to the webhook
        const webhookResponse = fetch('http://bot.kenn.pro/webhook/theme-liked', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BOT-SECRET': process.env.X_BOT_SECRET
            },
            body: JSON.stringify(
                {themeId, likes: theme.likes}
            )
        });

        res.json(theme);
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

router.post('/create', checkUserAuthenticated, checkTitleLength, checkDescriptionLength, async (req, res) => {
    const fetch = (await import ('node-fetch')).default;
    
    try {
        const headerSecret = req.header('X-BOT-SECRET');
        const isBot = headerSecret === process.env.X_BOT_SECRET;

        const {
            title,
            description = '',
            url,
            userId: bodyUserId 
        } = req.body;

        const {userId: sessionUserId} = req.user || {};
        const userId = isBot && bodyUserId ? bodyUserId : sessionUserId;


        if (!title || !url) {
            return res.status(400).json({error: 'Title and URL are required'});
        }

        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            fullUrl = 'https://' + url;
        }

        let urlObj;
        try {
            urlObj = new URL(fullUrl);
        } catch (_) {
            return res.status(400).json({error: 'Invalid URL'});
        }

        if (!['monkeytype.com', 'www.monkeytype.com'].includes(urlObj.hostname) || ! urlObj.searchParams.has('customTheme')) {
            return res.status(400).json({error: 'URL must be a valid Monkeytype URL with a custom theme'});
        }

        urlObj.protocol = 'https:';
        urlObj.hostname = 'monkeytype.com';
        const formattedUrl = urlObj.toString();

        // Check if theme already exists
        const existingTheme = await Theme.findOne({url: formattedUrl});
        if (existingTheme) {
            return res.status(400).json({error: 'Theme already exists', id: existingTheme._id});
        }

        const customThemeBase64 = urlObj.searchParams.get('customTheme');
        let themeData;
        try {
            const themeDataJson = Buffer.from(customThemeBase64, 'base64').toString('utf8');
            themeData = JSON.parse(themeDataJson);
        } catch (_) {
            return res.status(400).json({error: 'Invalid custom theme data'});
        }

        const newId = new mongoose.Types.ObjectId();
        const theme = new Theme({
            _id: newId,
            themeId: newId.toHexString(),
            userId,
            title,
            description,
            url: formattedUrl,
            themeData,
            likes: 0
        });

        const index = client.index('themes')

        let processedImage;
        let brightnessValue;
        if (themeData.i) {
            try {
                processedImage = await downloadAndProcessImage(themeData.i, themeData.f[1], themeData.f[2], themeData.f[0], themeData.s, themeData.c, newId.toHexString(), themeData.f[3], title);
                brightnessValue = await imageBrightness(processedImage);
            } catch (error) {
                if (error.message === 'Invalid image URL') {
                    return res.status(400).json({error: 'Invalid background image URL'});
                } else {
                    throw error;
                }
            }
        } else {
            try {
                let r = parseInt(themeData.c[0].substring(1, 3), 16);
                let g = parseInt(themeData.c[0].substring(3, 5), 16);
                let b = parseInt(themeData.c[0].substring(5, 7), 16);
                if (isNaN(r) || isNaN(g) || isNaN(b)) {
                    throw new Error("Invalid color value in theme data");
                }
                brightnessValue = (r + g + b) / (3 * 255);
                generatePreview({themeid: newId.toHexString(), colorlist: themeData.c, opacity: 0, title: title});
            } catch (error) {
                return res.status(400).json({error: 'Invalid theme data', detail: error.toString()});
            }
        } theme.brightness = brightnessValue;
        await theme.save();

        let createdAt = Math.floor(new Date().getTime() / 1000);
        let hasImage = themeData.i ? true : false;
        await index.addDocuments([
            {
                id: newId.toHexString(),
                userId: userId,
                title: title,
                description: description,
                url: formattedUrl,
                themeData: themeData,
                brightness: brightnessValue * 100,
                likes: 0,
                likesDay: 0,
                likesWeek: 0,
                likesList: [],
                createdAt: createdAt,
                hasImage: hasImage
            }
        ], {primaryKey: 'id'}).catch((error) => {
            console.error("MeiliSearch error:", error);
        });

        // Make POST request to webhook
        const webhookResponse = fetch('http://bot.kenn.pro/webhook/theme-uploaded', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BOT-SECRET': process.env.X_BOT_SECRET
            },
            body: JSON.stringify(
                {
                    themeId: newId.toHexString(),
                    title,
                    description,
                    userId,
                    color: themeData.c[0],
                    themeLink: formattedUrl
                }
            )
        });

        res.json(theme);
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

router.get('/page/:pageNum', async (req, res) => {
    try {
        let pageNum = parseInt(req.params.pageNum);
        if (pageNum < 1) 
            pageNum = 1;

        let query = {};
        let validIds = [];

        if (req.query.userId) {
            query.userId = req.query.userId;
        }

        const minBrightness = req.query.minBrightness ? parseFloat(req.query.minBrightness) : 0;
        const maxBrightness = req.query.maxBrightness ? parseFloat(req.query.maxBrightness) : 1;
        query.brightness = {
            $gte: minBrightness,
            $lte: maxBrightness
        };

        const withBG = req.query.withBG !== 'false';
        const withoutBG = req.query.withoutBG !== 'false';
        let existsConditions = [];
        if (withBG && ! withoutBG) {
            existsConditions.push({
                'themeData.i': {
                    $exists: true
                }
            });
        }
        if (! withBG && withoutBG) {
            existsConditions.push({
                'themeData.i': {
                    $exists: false
                }
            });
        }
        if (existsConditions.length > 0) {
            query.$or = existsConditions;
        }

        let userLikedThemeIds = [];
        if (req.user) {
            userLikedThemeIds = (await Like.find({userId: req.user.userId})).map(like => like.themeId);
        }

        let searchResultIds = [];
        if (req.query.search) {
            const results = await Theme.search({
                query_string: {
                    query: req.query.search
                }
            }, {hydrate: true});
            searchResultIds = results.body.hits.hydrated.map(hit => hit._id.toString());
            validIds = validIds.length ? validIds.filter(id => searchResultIds.includes(id)) : searchResultIds;
        }

        let sortQuery = {};
        switch (req.query.sort) {
            case 'topLikesWeek':
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const likesThisWeek = await Like.aggregate([
                    {
                        $match: {
                            dateCreated: {
                                $gte: oneWeekAgo
                            }
                        }
                    }, {
                        $group: {
                            _id: "$themeId",
                            count: {
                                $sum: 1
                            }
                        }
                    }, {
                        $sort: {
                            count: -1
                        }
                    }
                ]);
                const themeLikesCount = likesThisWeek.map(like => like._id.toString());
                validIds = validIds.length ? validIds.filter(id => themeLikesCount.includes(id)) : themeLikesCount;
                break;
            case 'topLikesAllTime': sortQuery = {
                    likes: -1
                };
                break;
            case 'oldest': sortQuery = {
                    dateCreated: 1
                };
                break;
            case 'newest':
            default: sortQuery = {
                    dateCreated: -1
                };
                break;
        }

        if (validIds.length > 0) {
            query._id = {
                $in: validIds
            };
        }

        const totalCount = await Theme.countDocuments(query);
        const totalPages = Math.ceil(totalCount / 12);

        const themes = await Theme.find(query).sort(sortQuery).skip((pageNum - 1) * 12).limit(12);

        const themesWithUserLiked = themes.map(theme => {
            return {
                ...theme._doc,
                userLiked: userLikedThemeIds.includes(theme._id.toString())
            };
        });

        res.json({currentPage: pageNum, totalPages: totalPages, themes: themesWithUserLiked});
    } catch (error) {
        res.status(500).json({error: error.toString()});
    }
});

module.exports = router;
