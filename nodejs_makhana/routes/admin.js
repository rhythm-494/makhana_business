const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const router = express.Router();

// POST admin login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 0,
                message: 'Email and password are required'
            });
        }

        const result = await pool.query(
            'SELECT id, name, email, password FROM adminLogin WHERE email = $1',
            [email]
        );

        const admin = result.rows[0];

        if (!admin) {
            return res.status(401).json({
                status: 0,
                message: 'Invalid credentials'
            });
        }

        const isValidPassword = await bcrypt.compare(password, admin.password);

        if (isValidPassword) {
            req.session.admin_id = admin.id;
            req.session.admin_name = admin.name;
            req.session.admin_email = admin.email;

            res.json({
                status: 1,
                message: 'Login successful',
                data: {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email
                }
            });
        } else {
            res.status(401).json({
                status: 0,
                message: 'Invalid credentials'
            });
        }
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: 'Database error: ' + error.message
        });
    }
});

// GET check admin auth
router.get('/check-auth', (req, res) => {
    if (req.session.admin_id) {
        res.json({
            status: 1,
            message: 'Authenticated',
            data: {
                id: req.session.admin_id,
                name: req.session.admin_name,
                email: req.session.admin_email
            }
        });
    } else {
        res.status(401).json({
            status: 0,
            message: 'Not authenticated'
        });
    }
});

// POST admin logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                status: 0,
                message: 'Logout failed'
            });
        }
        res.json({
            status: 1,
            message: 'Logged out successfully'
        });
    });
});

module.exports = router;
