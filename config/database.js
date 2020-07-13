const mongoose = require('mongoose')
const DB_URL = process.env.DATABASE_URI
const loadModels = require('../app/models')
const CONST_TIMEOUT = 5000

module.exports = () => {
  const connect = () => {
    mongoose.Promise = global.Promise
    console.log('config/database/process.env.DATABASE_URI', process.env.DATABASE_URI)
    mongoose.connect(
      DB_URL,
      {
        keepAlive: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS : CONST_TIMEOUT
      },
      (err) => {
        let dbStatus = ''
        if (err) {
          dbStatus = `* Error connecting to DB: ${err}`
        }
        dbStatus = `* DB Connection: OK`
        if (process.env.NODE_ENV !== 'test') {
          // Prints initialization
          console.log(`* Database: MongoDB`)
          console.log(dbStatus)
        }
      }
    )
    mongoose.set('useCreateIndex', true)
    mongoose.set('useFindAndModify', false)
  }
  connect()

  mongoose.connection.once('open', function() {
    console.log('Database connection successful.')            
  })
  mongoose.connection.on('error', console.log)
  mongoose.connection.on('disconnected', connect)

  loadModels()
}
