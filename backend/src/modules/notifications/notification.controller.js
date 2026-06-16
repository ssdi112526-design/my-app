const Notification = require("./notification.model");

const getMyNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);

    const items = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      userId: req.user.userId,
      isRead: false,
    });

    return res.json({
      success: true,
      data: { items, unreadCount },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { isRead: true },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, isRead: false },
      { isRead: true }
    );

    return res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
