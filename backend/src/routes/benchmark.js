import express from "express";
import { benchmarkController } from "../controllers/benchmarkController.js";

const router = express.Router();
router.get("/", benchmarkController);

export default router;
