const jwt = require("jsonwebtoken");
const User = require("../modules/users/user.model");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Missing token.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    req.user = {
      _id: user._id,
      userId: user._id,
      role: user.role,
      companyId: user.companyId || null,
      bankId: user.bankId || null,
      email: user.email,
      name: user.name,
      phone: user.phone || "",
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || (roles.length && !roles.includes(req.user.role))) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You do not have access.",
      });
    }
    next();
  };
};

const requireCompanyUser = (req, res, next) => {
  if (!req.user?.companyId) {
    return res.status(403).json({
      success: false,
      message: "Company context required.",
    });
  }
  next();
};

const requireAuth = (roles = []) => {
  const middlewares = [protect];

  if (Array.isArray(roles) && roles.length) {
    middlewares.push(authorize(...roles));
  }

  return middlewares;
};

module.exports = {
  protect,
  authorize,
  requireCompanyUser,
  requireAuth,
};