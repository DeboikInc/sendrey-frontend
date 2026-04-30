// database.js
const mongoose = require('mongoose');
const { database } = require('./index')
const User = require('../models/User');
const Runner = require('../models/Runner')


//  $env:DATABASE_URL = ""
// npm run seed:admin   

const connectDb = async () => {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);

  try {
    const currentDB = database.url
    const dbConnect = await mongoose.connect(currentDB);

    console.log("Connecting to database");

    // console.log(`Database connected successfully to ${dbConnect.connection.name}`);
    const totalUsers = await User.countDocuments({});
    console.log(`Total users in DB: ${totalUsers}`);

    const totalRunners = await Runner.countDocuments({});
    console.log(`Total runners in DB: ${totalRunners}`);
    
    // await User.deleteMany({ role: { $nin: ['super-admin', 'admin'] } });
    // await Runner.deleteMany({});
    // await Runner.findOneAndUpdate({ email:'timivictor565@gmail.com' }, { $set: { isAvailable: true } });
    // await User.findOneAndUpdate({ email:'timivictor565@gmail.com' }, { $set: { isAvailable: true } });
    // await User.findOneAndUpdate({ email:'tinukekareem17@gmail.com' }, { $set: { isAvailable: true } });
    // await Runner.findOneAndUpdate({ email:'tinukareem17@gmail.com' }, { $set: { isAvailable: true } });
    // console.log('Updated runner available status');
    // await Runner.deleteOne({ email: 'timivictor565@gmail.com' });

    // const collections = await mongoose.connection.db.listCollections().toArray();
    // const skip = ['users']; // keep users collection intact

    // for (const col of collections) {
    //   if (!skip.includes(col.name)) {
    //     await mongoose.connection.db.collection(col.name).deleteOne({Orders: { $exists: true }}); // only delete documents with Orders field
    //     console.log(`Cleared: ${col.name}`);
    //   }
    // }
    // console.log('Cascade cleanup done');

  } catch (error) {
    console.error('MongoDB connection error DETAILS:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    process.exit(1)
  }
}

module.exports = connectDb;


// only online runners should be sent to users requesting service
