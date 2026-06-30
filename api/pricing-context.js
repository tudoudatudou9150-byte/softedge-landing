const { getPricingContext } = require("./currency-utils");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.status(200).json(getPricingContext(req));
};
