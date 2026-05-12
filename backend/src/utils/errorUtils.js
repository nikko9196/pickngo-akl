function getErrorStatus(error) {
  return error?.statusCode || 500;
}

module.exports = {
  getErrorStatus,
};
