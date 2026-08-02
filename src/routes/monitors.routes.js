import { Router } from "express";
import * as monitors from "../controllers/monitors.controller.js";

const router = Router();

router.get("/", monitors.listMonitors);
router.post("/", monitors.createMonitor);
router.get("/:id", monitors.getMonitor);
router.patch("/:id", monitors.updateMonitor);
router.delete("/:id", monitors.deleteMonitor);
router.post("/:id/check", monitors.triggerCheck);
router.get("/:id/checks", monitors.listChecks);
router.get("/:id/checks/:checkId", monitors.getCheck);

export default router;
