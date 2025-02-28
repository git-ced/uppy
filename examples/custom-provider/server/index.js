const express = require('express')
// the ../../../packages is just to use the local version
// instead of the npm version—in a real app use `require('@uppy/companion')`
const bodyParser = require('body-parser')
const session = require('express-session')
const uppy = require('../../../packages/@uppy/companion')

const app = express()

app.use(bodyParser.json())
app.use(session({
  secret: 'some-secret',
  resave: true,
  saveUninitialized: true,
}))

// Routes
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('Welcome to my uppy companion service')
})

// source https://unsplash.com/documentation#user-authentication
const AUTHORIZE_URL = 'https://unsplash.com/oauth/authorize'
const ACCESS_URL = 'https://unsplash.com/oauth/token'

// initialize uppy
const uppyOptions = {
  providerOptions: {
    drive: {
      key: 'your google drive key',
      secret: 'your google drive secret',
    },
  },
  customProviders: {
    myunsplash: {
      config: {
        // your oauth handlers
        authorize_url: AUTHORIZE_URL,
        access_url: ACCESS_URL,
        oauth: 2,
        key: 'your unsplash key here',
        secret: 'your unsplash secret here',
      },
      // you provider module
      module: require('./customprovider'),
    },
  },
  server: {
    host: 'localhost:3020',
    protocol: 'http',
  },
  filePath: './output',
  secret: 'some-secret',
  debug: true,
}

app.use(uppy.app(uppyOptions))

// handle 404
app.use((req, res) => {
  return res.status(404).json({ message: 'Not Found' })
})

// handle server errors
app.use((err, req, res) => {
  console.error('\x1b[31m', err.stack, '\x1b[0m')
  res.status(err.status || 500).json({ message: err.message, error: err })
})

uppy.socket(app.listen(3020), uppyOptions)

console.log('Welcome to Companion!')
console.log(`Listening on http://0.0.0.0:${3020}`)
