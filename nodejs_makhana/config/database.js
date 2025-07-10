const { Pool } = require('pg');

const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'makhana_db',
    user: 'postgres',
    password: 'root'
};

const pool = new Pool(dbConfig);

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    } else {
        console.log('Database connected successfully');
        release();
    }
});

module.exports = { pool };
