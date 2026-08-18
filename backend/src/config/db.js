const mongoose = require("../db/mongoose");

module.exports = async function connectDB(uri) {
  const url = uri || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing in .env (PostgreSQL connection string)."
    );
  }

  try {
    await mongoose.connect(url);
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    const hint = url.includes("render.com")
      ? "Check DATABASE_URL, Render Postgres status, and SSL. Use the External Database URL from local machines."
      : "Fix DATABASE_URL in backend/.env (see .env.example).";
    err.message = `${err.message}\n\nFix: ${hint}`;
    throw err;
  }
};
