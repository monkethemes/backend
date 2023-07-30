const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');

router.get('/', (req, res) => {
    if (req.user) {
        res.send(req.user);
    } else {
        res.status(401).send({ msg:
            'No user is logged in' });
        }
});

router.get("/:userId", async (req, res) => {
    try {
      const user = await User.findOne({userId: req.params.userId});
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }
  
      res.json({ username: user.username, avatarUrl: user.avatarUrl });
    } catch (error) {
      res.status(500).json({ error: error.toString() });
    }
});

module.exports = router;