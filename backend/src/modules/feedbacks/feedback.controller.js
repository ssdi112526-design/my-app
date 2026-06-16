const Feedback = require("./feedback.model");
const { publicUploadUrl } = require("../../utils/profileImageStorage");

function mapUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    photoUrl: publicUploadUrl(user.photoUrl),
  };
}

function mapCompany(company) {
  if (!company) return null;
  return {
    _id: company._id,
    companyName: company.companyName,
    companyCode: company.companyCode,
    photoUrl: publicUploadUrl(company.photoUrl),
  };
}

const createFeedback = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    const rating = Number(req.body.rating);

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5 stars.",
      });
    }

    const doc = await Feedback.create({
      companyId: req.user.companyId,
      userId: req.user.userId,
      message,
      rating,
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getFeedbacks = async (req, res) => {
  try {
    const query = { companyId: req.user.companyId };

    if (req.user.role !== "REPO_ADMIN") {
      query.userId = req.user.userId;
    }

    const docs = await Feedback.find(query)
      .populate("userId", "name email role photoUrl")
      .sort({ createdAt: -1 })
      .lean();

    const data = docs.map((doc) => ({
      ...doc,
      userId: mapUser(doc.userId),
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listAllForSsdi = async (req, res) => {
  try {
    const docs = await Feedback.find({})
      .populate("userId", "name email role photoUrl")
      .populate("companyId", "companyName companyCode photoUrl")
      .sort({ createdAt: -1 })
      .lean();

    const data = docs.map((doc) => ({
      ...doc,
      userId: mapUser(doc.userId),
      companyId: mapCompany(doc.companyId),
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createFeedback,
  getFeedbacks,
  listAllForSsdi,
};
