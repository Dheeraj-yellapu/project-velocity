const express = require("express");
const { analyticsController } = require("../controllers/analyticsController");

const router = express.Router();
router.get("/", analyticsController);

module.exports = router;
