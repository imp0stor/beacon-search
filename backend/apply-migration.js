#!/usr/bin/env node
/**
 * Apply database migrations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Try to load dotenv from parent directory
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  console.log('Dotenv not available, using environment variables');
}

async function applyMigration(migrationFile) {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://beacon:beacon_secret@localhost:5432/beacon_search';
  const pool = new Pool({
    connectionString: dbUrl
  });

  try {
    console.log(`Applying migration: ${migrationFile}`);
    
    // Handle both absolute and relative paths
    const migrationPath = path.isAbsolute(migrationFile) 
      ? migrationFile
      : path.join(__dirname, migrationFile);
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    console.log('✓ Migration applied successfully!');
    
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Apply the migration
const migrationFile = process.argv[2] || '003_unique_event_id.sql';
applyMigration(migrationFile);
