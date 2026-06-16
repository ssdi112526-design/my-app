const mongoose = require("mongoose");

module.exports = async function connectDB(uri) {
  if (!uri) throw new Error("MONGO_URI missing in .env");
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
    console.log("✅ MongoDB connected");
  } catch (err) {
    const hint =
      uri.includes("mongodb.net") || uri.includes("mongodb+srv")
        ? "MongoDB Atlas → Network Access → Add IP Address (use “Add Current IP” or 0.0.0.0/0 for dev)."
        : "Start local MongoDB or fix MONGO_URI in backend/.env (see .env.example).";
    err.message = `${err.message}\n\nFix: ${hint}`;
    throw err;
  }
};
