import express from "express";
import { metricsController } from "../controllers/metricsController.js";

const router = express.Router();
router.get("/", metricsController);

export default router;
