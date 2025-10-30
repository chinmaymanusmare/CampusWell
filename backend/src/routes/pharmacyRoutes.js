const express = require("express");
const router = express.Router();

const {
  getInventory,
  updateInventoryItem,
  placeOrder,
  getAllOrders,
  getStudentOrders,
  updateOrderStatus
} = require("../controllers/pharmacyController");

const verifyToken = require("../middleware/auth");
const { authorize } = require("../middleware/authorize");

router.get("/inventory", verifyToken, getInventory);
router.put("/inventory/:id", verifyToken, authorize("pharmacy"), updateInventoryItem);
router.post("/orders", verifyToken, authorize("student"), placeOrder);
router.get("/orders", verifyToken, authorize("pharmacy"), getAllOrders);
router.get("/orders/student", verifyToken, authorize("student"), getStudentOrders);
router.put("/orders/:id/status", verifyToken, authorize("pharmacy"), updateOrderStatus);

module.exports = router;
