const pool = require("../config/db");

// ===========================================
// GET: View medicine inventory (All roles)
// ===========================================
exports.getInventory = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, stock, price FROM medicines ORDER BY name ASC`
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// PUT: Update medicine inventory (Pharmacy Staff Only)
// ===========================================
exports.updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  try {
    const result = await pool.query(
      `UPDATE medicines SET stock = $1 WHERE id = $2 RETURNING *`,
      [quantity, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating inventory:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// POST: Student places a medicine order
// ===========================================
exports.placeOrder = async (req, res) => {
  const studentId = req.user.id;
  const { medicine_id, quantity } = req.body;

  try {
    // Get student name
    const userResult = await pool.query("SELECT name FROM users WHERE id = $1", [studentId]);
    const studentName = userResult.rows[0].name;

    // Get medicine details
    const medResult = await pool.query("SELECT * FROM medicines WHERE id = $1", [medicine_id]);
    if (medResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "Medicine not found" });

    const medicine = medResult.rows[0];

    if (medicine.stock < quantity)
      return res.status(400).json({ success: false, message: "Not enough stock available" });

    const total = medicine.price * quantity;

    // Create order
    const orderResult = await pool.query(
      `INSERT INTO orders (student_id, student_name, total)
       VALUES ($1, $2, $3) RETURNING id`,
      [studentId, studentName, total]
    );

    const orderId = orderResult.rows[0].id;

    // Insert into order_medicines
    await pool.query(
      `INSERT INTO order_medicines (order_id, medicine_id, quantity)
       VALUES ($1, $2, $3)`,
      [orderId, medicine_id, quantity]
    );

    // Decrease stock
    await pool.query(
      `UPDATE medicines SET stock = stock - $1 WHERE id = $2`,
      [quantity, medicine_id]
    );

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order_id: orderId
    });
  } catch (err) {
    console.error("Error placing order:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// GET: Pharmacy staff views all orders
// ===========================================
exports.getAllOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM orders ORDER BY ordered_at DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// GET: Student views their own orders
// ===========================================
exports.getStudentOrders = async (req, res) => {
  const studentId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT * FROM orders WHERE student_id = $1 ORDER BY ordered_at DESC`,
      [studentId]
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching student orders:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// PUT: Update order status (Pharmacy Staff Only)
// ===========================================
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Order not found" });

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
