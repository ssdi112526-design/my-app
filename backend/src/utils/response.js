module.exports.ok = (res, data = {}, message = "OK") =>
  res.json({ success: true, message, data });

module.exports.fail = (res, status = 400, message = "Bad Request", data = {}) =>
  res.status(status).json({ success: false, message, data });
