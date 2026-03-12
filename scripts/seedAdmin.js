// scripts/seedAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { database } = require('../config/index');
const User = require('../models/User');

const seedAdmin = async () => {
    try {
        await mongoose.connect(database.url);
        console.log('Connected to DB');

        const existing = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL });
        if (existing) {
            console.log('Admin already exists, skipping.');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);

        await User.create({
            firstName: 'Super',
            lastName: 'Admin',
            email: process.env.SEED_ADMIN_EMAIL,
            password: hashedPassword,
            role: 'super-admin',
            isEmailVerified: true,
            isPhoneVerified: true,
        });

        console.log(`Super-admin created: ${process.env.SEED_ADMIN_EMAIL}`);
        process.exit(0);
    } catch (err) {
        console.error('Seed failed:', err);
        process.exit(1);
    }
};

seedAdmin();