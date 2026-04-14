import express from "express";
import { searchController, topicFacetsController } from "../controllers/searchController.js";

const router = express.Router();
router.get("/", searchController);
router.get("/types", topicFacetsController);

export default router;
