const { Kafka } = require('kafkajs');

const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';

const kafka = KAFKA_ENABLED
  ? new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'sendrey-api',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    })
  : null;

module.exports = { kafka, KAFKA_ENABLED };