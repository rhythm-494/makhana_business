const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { pool } = require('../config/database');

const router = express.Router();

// Configure multer for memory storage (not disk)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid image type'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer, originalname) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'makhana-products',
                public_id: `product_${Date.now()}_${Math.round(Math.random() * 1E9)}`,
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' },
                    { quality: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        uploadStream.end(buffer);
    });
};

// GET all products (unchanged)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
        
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

// POST new product with Cloudinary upload
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name, description, price, stock_quantity, category = 'makhana', discount_price } = req.body;

        if (!name || !price) {
            return res.status(400).json({
                status: 0,
                message: 'Name and price are required'
            });
        }

        let imageUrl = '';
        let cloudinaryPublicId = '';

        // Upload image to Cloudinary if provided
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
                imageUrl = uploadResult.secure_url;
                cloudinaryPublicId = uploadResult.public_id;
            } catch (uploadError) {
                return res.status(500).json({
                    status: 0,
                    message: 'Image upload failed: ' + uploadError.message
                });
            }
        }

        const columns = ['name', 'description', 'price', 'stock_quantity', 'category', 'image', 'cloudinary_public_id'];
        const values = [name, description, price, stock_quantity, category, imageUrl, cloudinaryPublicId];
        
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
            image: imageUrl
        });
    } catch (error) {
        res.status(500).json({
            status: 0,
            message: 'Product insertion failed: ' + error.message
        });
    }
});

// PUT update product with Cloudinary upload
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
        const checkResult = await pool.query('SELECT id, image, cloudinary_public_id FROM products WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                status: 0,
                message: 'Product not found'
            });
        }

        let imageUrl = checkResult.rows[0].image;
        let cloudinaryPublicId = checkResult.rows[0].cloudinary_public_id;

        // Upload new image to Cloudinary if provided
        if (req.file) {
            try {
                // Delete old image from Cloudinary if it exists
                if (cloudinaryPublicId) {
                    await cloudinary.uploader.destroy(cloudinaryPublicId);
                }

                const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
                imageUrl = uploadResult.secure_url;
                cloudinaryPublicId = uploadResult.public_id;
            } catch (uploadError) {
                return res.status(500).json({
                    status: 0,
                    message: 'Image upload failed: ' + uploadError.message
                });
            }
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
        if (req.file) {
            updateFields.push(`image = $${paramCount++}`);
            params.push(imageUrl);
            updateFields.push(`cloudinary_public_id = $${paramCount++}`);
            params.push(cloudinaryPublicId);
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

// DELETE product with Cloudinary cleanup
router.delete('/', async (req, res) => {
    try {
        const id = req.body.id || req.query.id;

        if (!id) {
            return res.status(400).json({
                status: 0,
                message: 'Product ID is required'
            });
        }

        const checkResult = await pool.query('SELECT id, cloudinary_public_id FROM products WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                status: 0,
                message: 'Product not found'
            });
        }

        // Delete image from Cloudinary if it exists
        const cloudinaryPublicId = checkResult.rows[0].cloudinary_public_id;
        if (cloudinaryPublicId) {
            try {
                await cloudinary.uploader.destroy(cloudinaryPublicId);
            } catch (cloudinaryError) {
                console.log('Cloudinary deletion error:', cloudinaryError);
                // Continue with database deletion even if Cloudinary fails
            }
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

// POST find products by IDs (unchanged)
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
