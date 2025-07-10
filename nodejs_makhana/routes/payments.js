const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../config/database');

const router = express.Router();

const RAZORPAY_KEY_ID = 'rzp_test_4cKrGm177Aynlx';
const RAZORPAY_KEY_SECRET = 'A4CipNFdGSZE7cFWWzbn9Z94';

// POST create payment
router.post('/create', async (req, res) => {
    try {
        const { amount, currency = 'INR' } = req.body;

        if (!amount || amount <= 0) {
            throw new Error('Invalid amount');
        }

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay credentials not configured');
        }

        const orderData = {
            receipt: 'order_' + Date.now(),
            amount: amount,
            currency: currency,
            payment_capture: 1
        };

        const response = await axios.post('https://api.razorpay.com/v1/orders', orderData, {
            auth: {
                username: RAZORPAY_KEY_ID,
                password: RAZORPAY_KEY_SECRET
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json({
            success: true,
            order: response.data,
            key_id: RAZORPAY_KEY_ID
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

// POST verify payment
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new Error('Missing payment verification data');
        }

        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            throw new Error('Payment signature verification failed');
        }

        await pool.query(
            'INSERT INTO payments (order_id, payment_id, signature, amount, status, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
            [razorpay_order_id, razorpay_payment_id, razorpay_signature, 0, 'success']
        );

        res.json({
            success: true,
            message: 'Payment verified successfully'
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
