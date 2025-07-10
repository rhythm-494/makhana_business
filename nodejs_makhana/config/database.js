const { Pool } = require('pg');

const dbConfig = {
    host: 'pg-89b47ae-rhythmcoder966-2788.j.aivencloud.com',
    port: 24699,
    database: 'defaultdb',
    user: 'avnadmin',
    password: 'AVNS_oxamWh3FNHts46mCDOW'
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
