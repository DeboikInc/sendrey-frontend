const { Kafka } = require('kafkajs');

const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';

const kafka = KAFKA_ENABLED
  ? new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'sendrey-api',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    })
  : null;

module.exports = { kafka, KAFKA_ENABLED };

// Request comes in
//       ↓
// Payment service runs, escrow created in DB
//       ↓
// Producer drops message in Kafka ("escrow.created") ← happens in milliseconds
//       ↓
// API responds to user "Payment successful"

//                     Meanwhile, separately...
//                           ↓
//                     Consumer picks up message
//                           ↓
//                     Sends push to runner
//                     Sends email to user  
//                     Sends SMS to runner