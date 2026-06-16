const RepoCase = require("./repoCase.model");
const User = require("../users/user.model");

const getRepoDashboardStats = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const totalCases = await RepoCase.countDocuments({ companyId });

    const bankStats = await RepoCase.aggregate([
      { $match: { companyId } },
      { $group: { _id: "$bankName", count: { $sum: 1 } } },
      { $project: { bankName: "$_id", count: 1, _id: 0 } },
    ]);

    const branchStats = await RepoCase.aggregate([
      { $match: { companyId } },
      { $group: { _id: "$branchName", count: { $sum: 1 } } },
      { $project: { branchName: "$_id", count: 1, _id: 0 } },
    ]);

    const confirmationStats = await RepoCase.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: "$confirmationStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    let pending = 0,
      confirmed = 0,
      rejected = 0;

    confirmationStats.forEach((item) => {
      if (item._id === "PENDING") pending = item.count;
      if (item._id === "CONFIRMED") confirmed = item.count;
      if (item._id === "REJECTED") rejected = item.count;
    });

    let userData = {};
    
    // Only REPO_ADMIN can see user stats
    if (req.user.role === "REPO_ADMIN") {
      const users = await User.find({
        companyId,
        role: { $in: ["REPO_ADMIN", "REPO_STAFF", "REPO_VIEWER"] },
      });

      const activeUsers = users.filter((u) => u.isActive).length;
      const inactiveUsers = users.length - activeUsers;

      userData = {
        total: users.length,
        active: activeUsers,
        inactive: inactiveUsers,
      };
    }

    const responseData = {
      totalCases,
      bankStats,
      branchStats,
      confirmation: {
        pending,
        confirmed,
        rejected,
      },
    };

    if (Object.keys(userData).length > 0) {
      responseData.users = userData;
    }

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getRepoDashboardStats };