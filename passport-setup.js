const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const dotenv = require('dotenv');
const User = require('./models/user');

dotenv.config();

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI,
    scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.webp`;

        let user = await User.findOne({ userId: profile.id });

        if (!user) {
            user = new User({
                userId: profile.id,
                username: profile.username,
                avatarUrl
            });
        } else {
            user.username = profile.username;
            user.avatarUrl = avatarUrl;
        }

        await user.save();

        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));