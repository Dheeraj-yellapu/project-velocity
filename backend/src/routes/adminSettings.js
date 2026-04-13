import express from "express";
import {
  verifyAdminController,
  changePasswordController,
  clearLogsController,
  passwordMetaController,
} from "../controllers/adminSettingsController.js";

const router = express.Router();

router.post("/verify", verifyAdminController);
router.post("/change-password", changePasswordController);
router.post("/clear-logs", clearLogsController);
router.get("/password-meta", passwordMetaController);

export default router;
