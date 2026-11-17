/**
 * Middleware to protect admin routes
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) {
    return next();
  }
  // Store original URL to redirect after login
  req.session.returnTo = req.originalUrl || '/admin';
  return res.redirect('/admin/login');
}

module.exports = {
  requireAdmin
};
