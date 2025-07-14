const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const router = express.Router();

// POST signup
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, confirmPassword, fullName, phone, address } = req.body;

        if (!username || !email || !password) {
            return res.json({
                status: 0,
                message: 'Username, email, and password are required'
            });
        }

        if (password !== confirmPassword) {
            return res.json({
                status: 0,
                message: 'Passwords do not match'
            });
        }

        if (password.length < 6) {
            return res.json({
                status: 0,
                message: 'Password must be at least 6 characters long'
            });
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.json({
                status: 0,
                message: 'Invalid email format'
            });
        }

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.json({
                status: 0,
                message: 'Username or email already exists'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, full_name, phone, address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id`,
            [username, email, passwordHash, fullName, phone, address]
        );

        const userId = result.rows[0].id;

        // Set session
        req.session.user_id = userId;
        req.session.username = username;
        req.session.email = email;
        req.session.full_name = fullName;
        req.session.logged_in = true;
        req.session.login_time = Date.now();

        res.json({
            status: 1,
            message: 'Account created successfully!',
            user: {
                id: userId,
                username: username,
                email: email,
                full_name: fullName
            },
            logged_in: true
        });
    } catch (error) {
        console.error('Signup error:', error.message);
        res.json({
            status: 0,
            message: 'Database error occurred'
        });
    }
});

// POST login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.json({
                status: 0,
                message: 'Username/Email and password are required'
            });
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );

        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.user_id = user.id;
            req.session.username = user.username;
            req.session.email = user.email;
            req.session.full_name = user.full_name;
            req.session.logged_in = true;
            req.session.login_time = Date.now();

            res.json({
                status: 1,
                message: 'Login successful!',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name
                },
                logged_in: true
            });
        } else {
            res.json({
                status: 0,
                message: 'Invalid username/email or password'
            });
        }
    } catch (error) {
        console.error('Login error:', error.message);
        res.json({
            status: 0,
            message: 'Database error occurred'
        });
    }
});

// POST logout
router.post('/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                return res.json({
                    status: 0,
                    message: 'Logout failed'
                });
            }
            res.json({
                status: 1,
                message: 'Logged out successfully',
                logged_in: false
            });
        });
    } catch (error) {
        console.error('Logout error:', error.message);
        res.json({
            status: 0,
            message: 'Logout failed'
        });
    }
});

// GET check session
router.get('/check_session', (req, res) => {
    console.log('Session check - Session data:', req.session);
    if (req.session.logged_in) {
        res.json({
            status: 1,
            isAuthenticated: true,
            user: req.session.user
        });
    } else if (req.session.admin_id) {
        res.json({
            status: 1,
            isAuthenticated: true,
            isAdmin: true,
            admin: req.session.admin
        });
    } else {
        res.json({
            status: 0,
            isAuthenticated: false,
            message: 'No active session'
        });
    }
});


// GET profile data
router.get('/seeProfileData', async (req, res) => {
    try {
        const { user_id } = req.query;
        
        if (!user_id) {
            return res.json({
                status: 0,
                message: 'User ID required'
            });
        }
        
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
        const user = result.rows[0];

        if (user) {
            res.json({
                status: 1,
                result: user,
                message: 'User data retrieved successfully'
            });
        } else {
            res.json({
                status: 0,
                message: 'User not found'
            });
        }
    } catch (error) {
        console.error('Database error:', error.message);
        res.json({
            status: 0,
            message: 'Database error occurred'
        });
    }
});

// PUT update profile
router.put('/update_profile', async (req, res) => {
    if (!req.session.logged_in) {
        return res.json({
            status: 0,
            message: 'Not authenticated'
        });
    }

    try {
        const userId = req.session.user_id;
        const { full_name, phone, address, email } = req.body;

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return res.json({
                status: 0,
                message: 'Valid email is required'
            });
        }

        // Check if email is already in use
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND id != $2',
            [email, userId]
        );

        if (existingUser.rows.length > 0) {
            return res.json({
                status: 0,
                message: 'Email already in use'
            });
        }

        await pool.query(
            'UPDATE users SET full_name = $1, phone = $2, address = $3, email = $4 WHERE id = $5',
            [full_name, phone, address, email, userId]
        );

        // Update session values
        req.session.full_name = full_name;
        req.session.phone = phone;
        req.session.address = address;
        req.session.email = email;

        res.json({
            status: 1,
            message: 'Profile updated successfully',
            user: {
                id: userId,
                username: req.session.username,
                email: email,
                full_name: full_name,
                phone: phone,
                address: address
            }
        });
    } catch (error) {
        console.error('Update profile error:', error.message);
        res.json({
            status: 0,
            message: 'Database error occurred'
        });
    }
});

module.exports = router;
