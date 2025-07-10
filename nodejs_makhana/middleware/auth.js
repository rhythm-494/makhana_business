const authenticateUser = (req, res, next) => {
    if (!req.session.logged_in) {
        return res.status(401).json({
            status: 0,
            message: 'Authentication required'
        });
    }
    next();
};

const authenticateAdmin = (req, res, next) => {
    if (!req.session.admin_id) {
        return res.status(401).json({
            status: 0,
            message: 'Admin authentication required'
        });
    }
    next();
};

module.exports = {
    authenticateUser,
    authenticateAdmin
};
