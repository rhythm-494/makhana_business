const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const { pool } = require('./config/database');

const app = express();

// CORS configuration
const allowedOrigins = [
    'https://makhana-frontend.vercel.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with PostgreSQL store
app.use(session({
    store: new pgSession({
        pool: pool, // Use your existing database pool
        tableName: 'session', // Table name for sessions
        createTableIfMissing: true // Automatically create session table
    }),
    secret: 'makhana-delight-session-secret-2025',
    resave: false,
    saveUninitialized: false,
    name: 'makhana.sid',
    cookie: {
        secure: true, // Set to true for Render (HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'none' // Required for cross-origin cookies
    },
    rolling: true // Refresh session on each request
}));

// Trust proxy for secure cookies on Render
app.set('trust proxy', 1);
// Serve static files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));

// Handle preflight OPTIONS requests
app.options('/*path', (req, res) => {
    res.status(200).end();
});

// 404 handler
app.get('/*path', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
