import { setupSolr } from "../services/solrAdminService.js";

async function solrSetupController(req, res, next) {
  try {
    const configuredToken = process.env.ADMIN_TOKEN;
    const headerToken = req.header("x-admin-token");

    if (configuredToken && headerToken !== configuredToken) {
      return res.status(401).json({
        error: "Unauthorized",
        detail: "Invalid admin token",
      });
    }

    const { skipIndex, inputFile, schemaFile, startLocal } = req.body || {};
    const result = await setupSolr({
      skipIndex,
      inputFile,
      schemaFile,
      startLocal,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export { solrSetupController };