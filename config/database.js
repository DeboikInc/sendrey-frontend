const mongoose = require('mongoose');
const { database } = require('./index')


//  $env:DATABASE_URL = ""

const connectDb = async () => {
  try {
    const currentDB = database.url
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    const dbConnect = await mongoose.connect(currentDB);
    // console.log("Connecting to:", process.env.DATABASE_URL);

    console.log(`Database connected successfully to ${dbConnect.connection.name}`);
  } catch (error) {
    console.log(error);
    process.exit(1)
  }
}

module.exports = connectDb;
