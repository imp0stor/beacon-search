#!/usr/bin/env node
/**
 * Apply database migrations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration(migrationFile) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log(`Applying migration: ${migrationFile}`);
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', migrationFile),
      'utf8'
    );
    
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
