import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

// Create connection pool
export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test connection (no leak)
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL database connected');
    client.release(); // ✅ VERY IMPORTANT
  } catch (err) {
    console.error('DB connection error', err);
    process.exit(1);
  }
};