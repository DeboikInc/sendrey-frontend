// scripts/check.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.DATABASE_URL);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name).sort());

  // Check all ledger entries
  const all = await db.collection('ledgerentries').find({}).limit(5).toArray();
  console.log('Sample ledger entries:', all.length);
  if (all.length) console.log('First:', all[0]);

  await mongoose.disconnect();
}

main().catch(console.error);