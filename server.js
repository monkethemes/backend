require('./cronJobs');
const { setup } = require('./setup');

const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const themeRoutes = require('./routes/theme');
const botRoutes = require('./routes/bot');
const userRoutes = require('./routes/user');

const app = express();
app.use(express.json());

const cors = require('cors');

dotenv.config();

require('./passport-setup');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB...'))
    .catch(err => console.error('Could not connect to MongoDB', err));

app.use(session({
    secret: process.env.SESSION_SECRET,
    cookie: {
        maxAge: 60000 * 60 * 24
    },
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI })
}));

app.use(passport.initialize());
app.use(passport.session());

const allowedOrigins = ['https://monkethemes.com', 'http://dev.monkethemes.com'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.get('/api', (req, res) => {
    res.send('<a href="https://monkethemes.com/api/auth/discord">Login</a><br><a href="https://monkethemes.com/api/user">User Response</a>');
});

setup().then(() => {
    app.listen(3001, () => {
      console.log('Server started on port 3001');
    });
  }).catch((error) => {
    console.error(`Failed to setup: ${error}`);
  });

app.get('/api/auth/discord', passport.authenticate('discord'));

app.get('/api/auth/discord/redirect', 
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('connect.sid');
    res.redirect('/');
});

app.use('/api/theme', themeRoutes);
app.use('/api/user', userRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/static', express.static(path.join(__dirname, 'static')));
    
module.exports = app;