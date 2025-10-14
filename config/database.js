const mongoose = require('mongoose');
const { database } = require('./index')

const connectDb = async () => {
  try {
    const currentDB = database.url
    const dbConnect = await mongoose.connect(currentDB);
    console.log(`Database connected successfully to ${dbConnect.connection.name}`);
  } catch (error) {
    console.log(error);
    process.exit(1)
  }
}

module.exports = connectDb;
