import {
  clearSearchMetrics,
  getAdminPasswordMeta,
  setAdminPassword,
  verifyAdminPassword,
} from "../utils/redisClient.js";

async function verifyAdminController(req, res) {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ ok: false, error: "Access code is required" });
    }

    const valid = await verifyAdminPassword(code);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "Invalid access code" });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("[AdminSettings] verify error:", error);
    return res.status(500).json({ ok: false, error: "Failed to verify access code" });
  }
}

async function changePasswordController(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ ok: false, error: "All password fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "New password must be at least 6 characters" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ ok: false, error: "New password and confirmation do not match" });
    }

    const validCurrent = await verifyAdminPassword(currentPassword);
    if (!validCurrent) {
      return res.status(401).json({ ok: false, error: "Current password is incorrect" });
    }

    await setAdminPassword(newPassword);
    return res.json({ ok: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("[AdminSettings] changePassword error:", error);
    return res.status(500).json({ ok: false, error: "Failed to update password" });
  }
}

async function clearLogsController(_req, res) {
  try {
    await clearSearchMetrics();
    return res.json({ ok: true, message: "All logs have been cleared" });
  } catch (error) {
    console.error("[AdminSettings] clearLogs error:", error);
    return res.status(500).json({ ok: false, error: "Failed to clear logs", details: error.message });
  }
}

async function passwordMetaController(_req, res) {
  try {
    const meta = await getAdminPasswordMeta();
    return res.json({ ok: true, changedAt: meta.changedAt });
  } catch (error) {
    console.error("[AdminSettings] passwordMeta error:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch password metadata" });
  }
}

export { verifyAdminController, changePasswordController, clearLogsController, passwordMetaController };
