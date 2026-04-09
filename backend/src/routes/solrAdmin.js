import express from "express";
import { solrSetupController } from "../controllers/solrAdminController.js";

const router = express.Router();

router.post("/setup", solrSetupController);

export default router;