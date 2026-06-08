import mysql from 'mysql2/promise';
import config from '../config.js';

let pool = null;

export async function initDatabase() {
  try {
    pool = mysql.createPool(config.db);
    
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    console.log('[DB] Connected to MySQL successfully');
    return true;
  } catch (error) {
    console.error('[DB] Failed to connect:', error.message);
    console.log('[DB] Running in fallback mode (memory only)');
    pool = null;
    return false;
  }
}

export function getPool() {
  return pool;
}

export function isConnected() {
  return pool !== null;
}

export async function query(sql, params = []) {
  if (!pool) {
    return null;
  }
  
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    throw error;
  }
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

export default { initDatabase, getPool, isConnected, query, queryOne };
