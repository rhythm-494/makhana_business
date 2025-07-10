const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = 'img_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid image type'), false);
        }
    }
});

// GET all products
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
        
        // Check if this is an admin request
        if (req.originalUrl.includes('admin')) {
            res.json({
                status: 1,
                data: result.rows,
                message: 'Products retrieved successfully'
            });
        } else {
            res.json(result.rows);
        }
    } catch (error) {
        res.status(500).json({
            status: 0,
            data: [],
            message: 'Database product retrieval failed: ' + error.message
        });
    }
});

// POST new product
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock_quantity, category = 'makhana', discount_price } = req.body;

        if (!name || !price) {
            return res.status(400).json({
                status: 0,
                message: 'Name and price are required'
            });
        }

        let imagePath = '';
        if (req.file) {
            imagePath = 'uploads/' + req.file.filename;
        }

        const columns = ['name', 'description', 'price', 'stock_quantity', 'category', 'image'];
        const values = [name, description, price, stock_quantity, category, imagePath];
        
        if (discount_price !== undefined && discount_price !== '') {
            columns.push('discount_price');
            values.push(Math.round(discount_price));
        }

        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const query = `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`;
        
        const result = await pool.query(query, values);
        
        res.json({
            status: 1,
            message: 'Product added successfully',
            id: result.rows[0].id,
            image: imagePath
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: 'Product insertion failed: ' + error.message
        });
    }
});

// PUT update product
router.put('/', upload.single('image'), async (req, res) => {
    try {
        const { id, name, description, price, stock_quantity, category, discount_price } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 0,
                message: 'Product ID is required'
            });
        }

        // Check if product exists
        const checkResult = await pool.query('SELECT id, image FROM products WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                status: 0,
                message: 'Product not found'
            });
        }

        let imagePath = checkResult.rows[0].image;
        if (req.file) {
            imagePath = 'uploads/' + req.file.filename;
        }

        const updateFields = [];
        const params = [];
        let paramCount = 1;

        if (name) {
            updateFields.push(`name = $${paramCount++}`);
            params.push(name);
        }
        if (description) {
            updateFields.push(`description = $${paramCount++}`);
            params.push(description);
        }
        if (price) {
            updateFields.push(`price = $${paramCount++}`);
            params.push(price);
        }
        if (stock_quantity) {
            updateFields.push(`stock_quantity = $${paramCount++}`);
            params.push(stock_quantity);
        }
        if (category) {
            updateFields.push(`category = $${paramCount++}`);
            params.push(category);
        }
        if (imagePath) {
            updateFields.push(`image = $${paramCount++}`);
            params.push(imagePath);
        }
        if (discount_price !== undefined && discount_price !== '') {
            updateFields.push(`discount_price = $${paramCount++}`);
            params.push(Math.round(discount_price));
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                status: 0,
                message: 'No fields provided for update'
            });
        }

        params.push(id);
        const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramCount}`;
        
        await pool.query(query, params);
        
        res.json({
            status: 1,
            message: 'Product updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: 'Product update failed: ' + error.message
        });
    }
});

// DELETE product
router.delete('/', async (req, res) => {
    try {
        const id = req.body.id || req.query.id;

        if (!id) {
            return res.status(400).json({
                status: 0,
                message: 'Product ID is required'
            });
        }

        const checkResult = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                status: 0,
                message: 'Product not found'
            });
        }

        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        
        res.json({
            status: 1,
            message: 'Product deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: 'Product deletion failed: ' + error.message
        });
    }
});

// POST find products by IDs
router.post('/find', async (req, res) => {
    try {
        const { productIds } = req.body;

        if (!productIds || !Array.isArray(productIds)) {
            return res.status(400).json({
                status: 0,
                error: 'Product IDs array is required'
            });
        }

        const placeholders = productIds.map((_, index) => `$${index + 1}`).join(',');
        const query = `SELECT * FROM products WHERE id IN (${placeholders})`;
        
        const result = await pool.query(query, productIds);
        
        res.json({
            status: 1,
            products: result.rows
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            error: 'Database error: ' + error.message
        });
    }
});

module.exports = router;
