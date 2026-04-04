const express = require("express");
const { suggestController } = require("../controllers/suggestController");

const router = express.Router();
router.get("/", suggestController);

module.exports = router;
