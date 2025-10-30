const pool = require("../config/db");

// ===========================================
// GET: Fetch user notifications
// ===========================================
exports.getUserNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// POST: Send a notification (Admin/System)
// ===========================================
exports.sendNotification = async (req, res) => {
  const { user_id, message } = req.body;

  if (!user_id || !message)
    return res.status(400).json({ success: false, message: "Missing fields" });

  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, message)
       VALUES ($1, $2)
       RETURNING *`,
      [user_id, message]
    );

    res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error sending notification:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===========================================
// (Optional) Mark a notification as read
// ===========================================
exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Notification not found" });

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating notification:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
