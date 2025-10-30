const mongoose = require('mongoose');
const { database } = require('./index')
const User = require('../models/User');


//  $env:DATABASE_URL = ""

const connectDb = async () => {
  try {
    const currentDB = database.url
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    const dbConnect = await mongoose.connect(currentDB);
    // console.log("Connecting to:", process.env.DATABASE_URL);

    console.log(`Database connected successfully to ${dbConnect.connection.name}`);
  

    // await User.collection.dropIndex("email_1").catch(() => { });
    // await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });

    await User.deleteMany({});


  } catch (error) {
    console.log(error);
    process.exit(1)
  }
}

module.exports = connectDb;
