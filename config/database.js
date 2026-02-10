// database.js
const mongoose = require('mongoose');
const { database } = require('./index')
const User = require('../models/User');
const Runner = require('../models/Runner')


//  $env:DATABASE_URL = ""

const connectDb = async () => {
  try {
    const currentDB = database.url
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    const dbConnect = await mongoose.connect(currentDB);
    // console.log("Connecting to:", process.env.DATABASE_URL);

    console.log(`Database connected successfully to ${dbConnect.connection.name}`);
    const totalUsers = await User.countDocuments({});
    console.log(`Total users in DB: ${totalUsers}`);

    const totalRunners = await Runner.countDocuments({});
    console.log(`Total runners in DB: ${totalRunners}`);

    await User.deleteMany({});
    await Runner.deleteMany({})


  } catch (error) {
    console.log(error);
    process.exit(1)
  }
}

module.exports = connectDb;


// runners should be notified of services, accept or decline
// only runners available within 2km(trekable) to user should be notified
// only online runners should be sent to users requesting service
