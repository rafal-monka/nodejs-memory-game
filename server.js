require('dotenv').config()
const express = require("express");
const cors = require('cors')
const bodyParser = require("body-parser");
const path = require('path')
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const cookieParser = require('cookie-parser')
const expressSession = require('express-session')

const initDatabase = require('./config/database')
const wss = require('./wss')
const auth = require('./auth')
const Game = require('./app/models/game-model') //temp for testing -> /play
const app = express();

const PlayMemoryGame = require('./app/controllers/play-memory-game')

app.use(cors())
app.use(bodyParser.json());                                     
app.use(bodyParser.urlencoded({extended: true}));               
app.use(bodyParser.text());                                    
app.use(bodyParser.json({ type: 'application/json'})); 

//Auth0 configuration
const authConfig = {
  domain: "ang-auth.eu.auth0.com",
  audience: "https://ang-auth.eu.auth0.com/api/v2/"
};

//Middleware that validates incoming bearer tokens using JWKS from YOUR_DOMAIN
//@@@AUTH0
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`
    }),
    audience: authConfig.audience,
    issuer: `https://${authConfig.domain}/`,
    algorithms: ["RS256"]
});


app.get("/api/home", (req, res) => {
    res.json({ message: "Welcome to Memory Game API" });
});

app.get("/.well-known/pki-validation/56221AE0572BBB39573885EFB10287B1.txt" , (req, res) => {
    res.send('42802478CEC865DB11418BF7251A26DAB62A8B635B87CA0BC8EBCB60323FE5B1\ncomodoca.com\n925a96af9760bd4')
})

// -------------------------------- temp
app.get("/api/wssclients", (req, res) => {   
    let arr = wss.getWssClients()
    res.json({
        clients: arr.map(item => item.clientInfo)
    } )    
})

// -------------------------------- temp
app.get("/play/:gameid", (req, res) => {  
    console.log('/play/:gameid', req.params.gameid)
    // Game.findOneAndUpdate({gameid: req.params.gameid}, {status: 'STARTED'}, {new: true})
    //     .then(function (result) { 
    //         let playMemoryGame = new PlayMemoryGame(result, res)
    //         playMemoryGame.playGame()                               
    //     })
    new PlayMemoryGame(req.params.gameid, res)
}) 

//###App API endpoints BEFORE JWT
// app.use("/api", require('./app/routes/'))

app.use(cookieParser(process.env.COOKIESECRET))
app.use(expressSession({
    resave: false,
    saveUninitialized: false,
    secret: process.env.COOKIESECRET
}))

//make default URL for SPA
const buildLocation = 'public'; //include public folder with SPA app
app.use(express.static(path.join(__dirname, buildLocation)));

//Endpoints that must be called with an access token
//@@@AUTH0
if (true) app.use(checkJwt, (req, res, next) => {
    try {
        //throw new Error('test')
        const token = req.headers.authorization.split(' ')[1];
    // console.log(`app.use(checkJwt, token=`+token)
//console.log(`app.use(checkJwt) req.session.userProfile=`+JSON.stringify(req.session.userProfile))
        if (!req.session.userProfile) {
            auth.getUserProfile(token, (arg) => {
//console.log('SETTING app.use(checkJwt) req.session.userProfile')
                req.session.userProfile = arg
                // req.userProfile = arg
                next()               
            })
        } else {
//console.log('USING SESSION req.session.userProfile')
            next()
        }  

    } catch(err) {
        res.status(404).json({msg:err})
    }       
})
//@@@AUTH0
if (false) app.use((req, res, next) => {
    req.userProfile = {
        sub: 'google-oauth2|103332170467986196787',
        email: 'monka.rafal@gmail.com',
        name: 'Test user RM',
        email_verified: true
    }
    next()
})

//App API endpoints
app.use("/api", require('./app/routes/'))

//###temp/TO-DELETE
app.get("/api/external", (req, res) => {
    console.log('req.user', req.user)
    //console.log('req.session.userInfo', req.session.userInfo) 
    res.send({
        msg: new Date()+"Your Access Token was successfully validated!"
    });
});

//errors
app.use(function (err, req, res, next) {
    if (err.name === 'UnauthorizedError') {
        res.status(401).send('JWT Unauthorized access. Invalid token...');
    } else {
        res.status(404).json('ERROR! '+err.stack)
    }
});

// Start the app
//port
const port = process.env.PORT
var server = app.listen(port, () => {
    wss.init(server)
    console.log(`Node Memory Game API listening on ${port}`)
});

//init database
initDatabase()

