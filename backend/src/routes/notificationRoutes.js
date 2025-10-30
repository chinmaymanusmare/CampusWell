const express = require("express");
const router = express.Router();

const {
  getUserNotifications,
  sendNotification,
  markAsRead
} = require("../controllers/notificationController");

const verifyToken = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

router.get("/", verifyToken, getUserNotifications);
router.post("/send", verifyToken, authorize("admin"), sendNotification);
router.put("/:id/read", verifyToken, markAsRead);

module.exports = router;
