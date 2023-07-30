const cron = require('node-cron');
const { client } = require('./middlewares/meilisearch');
const moment = require('moment');
const Like = require('./models/like');

const updateTopLikesDay = async () => {
    console.log("Counting daily likes");
    const index = client.index('themes');

    const oneDayAgo = moment().subtract(1, 'days');
    const likesPastDay = await Like.find({ 
        dateCreated: { 
            $gte: oneDayAgo.toDate(),
            $lt: oneDayAgo.add(59, 'minutes').add(59.999, 'seconds').toDate()
        }
    });

    const likesPerTheme = likesPastDay.reduce((groupedLikes, like) => {
        groupedLikes[like.themeId] = (groupedLikes[like.themeId] || 0) + 1;
        return groupedLikes;
    }, {});

    for (const themeId in likesPerTheme) {
        const themeInMeili = await index.getDocument(themeId);
        const updatedLikesDay = themeInMeili.likesDay - likesPerTheme[themeId];

        const update = {
            id: themeId,
            likesDay: updatedLikesDay >= 0 ? updatedLikesDay : 0
        };

        console.log(`Updating daily likes for theme: ${themeId}`);
        await index.updateDocuments([update]).catch((error) => {
            console.error("MeiliSearch updateDocuments error:", error);
        });
    }
}

const updateTopLikesWeek = async () => {
    console.log("Counting weekly likes");
    const index = client.index('themes');

    const oneWeekAgo = moment().subtract(1, 'weeks');
    const likesPastWeek = await Like.find({ 
        dateCreated: { 
            $gte: oneWeekAgo.toDate(),
            $lt: oneWeekAgo.add(59, 'minutes').add(59.999, 'seconds').toDate()
        }
    });

    const likesPerTheme = likesPastWeek.reduce((groupedLikes, like) => {
        groupedLikes[like.themeId] = (groupedLikes[like.themeId] || 0) + 1;
        return groupedLikes;
    }, {});

    for (const themeId in likesPerTheme) {
        const themeInMeili = await index.getDocument(themeId);
        const updatedLikesWeek = themeInMeili.likesWeek - likesPerTheme[themeId];

        const update = {
            id: themeId,
            likesWeek: updatedLikesWeek >= 0 ? updatedLikesWeek : 0
        };

        console.log(`Updating weekly likes for theme: ${themeId}`);
        await index.updateDocuments([update]).catch((error) => {
            console.error("MeiliSearch updateDocuments error:", error);
        });
    }
}

cron.schedule('0 * * * *', updateTopLikesDay);
cron.schedule('0 * * * *', updateTopLikesWeek);
