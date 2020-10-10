'use strict';

//mongoose file must be loaded before all other files in order to provide
// models to other modules
require("dotenv").config()

var express = require('express'),
  router = express.Router(),
  cors = require('cors'),
  bodyParser = require('body-parser'),
  request = require('request'),
  Twit = require('twit'),
  util = require("util");

var firebase = require('firebase/app');
require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyCw1R_BxTh_6hQZWyRJORz1WkubgeauVUs",
  authDomain: "endsarsnow-24674.firebaseapp.com",
  databaseURL: "https://endsarsnow-24674.firebaseio.com",
  projectId: "endsarsnow-24674",
  storageBucket: "endsarsnow-24674.appspot.com",
  messagingSenderId: "2843431791",
  appId: "1:2843431791:web:3595e1716adbe6b3f68e9a",
  measurementId: "G-HPGB4FBS6S"
};
var firebaseapp = firebase.initializeApp(firebaseConfig)

var app = express();
// enable cors
var corsOption = {
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  exposedHeaders: ['x-auth-token']
};
app.use(cors(corsOption));

//rest API requirements
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

let send_single_tweet = require('util').promisify(
  (T, options, data, cb) => T.post(
    options,
    data,
    (err, ...results) => cb(err, results)
  )
);

let send_status = (access_token, access_secret, post) => {
  var T = new Twit({
    consumer_key:         process.env.CONSUMER_KEY,
    consumer_secret:      process.env.CONSUMER_SECRET,
    access_token:         access_token,
    access_token_secret:  access_secret,
    timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
  });
  send_single_tweet(T, 'statuses/update', { status: `${post}` }).catch(e => {
    console.log(e)
  })
}

router.route('/auth/twitter/reverse')
  .post(function(req, res) {
    request.post({
      url: 'https://api.twitter.com/oauth/request_token',
      oauth: {
        oauth_callback: "http%3A%2F%2Flocalhost%3A3000%2Ftwitter-callback",
        consumer_key:   process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
      }
    }, function (err, r, body) {
      if (err) {
        return res.send(500, { message: err.message });
      }
      var jsonStr = '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';
      res.send(JSON.parse(jsonStr));
    });
  });

router.route('/status')
  .post((req, res) => {
    let {post, oauth_token, oauth_token_secret } = req.body;
     send_status(oauth_token, oauth_token_secret, post, res)
     return res.status(200).json({ message: "tweet sent"})
  });

router.route('/auth/twitter')
  .post((req, res) => {
    request.post({
      url: `https://api.twitter.com/oauth/access_token?oauth_verifier`,
      oauth: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        token: req.query.oauth_token
      },
      form: { oauth_verifier: req.query.oauth_verifier }
    }, function (err, r, body) {
      if (err) {
        return res.send(500, { message: err.message });
      }

      const bodyString = '{ "' + body.replace(/&/g, '", "').replace(/=/g, '": "') + '"}';
      const parsedBody = JSON.parse(bodyString);
      const dbObject =  {
        oauth_token: parsedBody.oauth_token,
        oauth_token_secret: parsedBody.oauth_token_secret,
        user_id: parsedBody.user_id
      }
      req.body['oauth_token'] = parsedBody.oauth_token;
      req.body['oauth_token_secret'] = parsedBody.oauth_token_secret;
      req.body['user_id'] = parsedBody.user_id;
      firebase.database().ref().child('users_tokens').child(parsedBody.user_id).set(dbObject)
      const ref = firebase.database().ref().child('statistics')
      ref.once('value', snapshot => {
        if(snapshot.val()) {
          snapshot.ref.update({total_users: snapshot.val().total_users+1})
        }else{
          snapshot.ref.set({total_users: 1})
        }
      })
      res.json(req.body);
    });
  });

  router.route('/summary')
  .get((req, res)=> {
    firebase.database().ref().child('statistics').child('total_users').once('value', (snapshot) => {
      return res.status(200).json({value: snapshot.val()})
    })
  })


  router.route('/bulk_tweet')
  .get((req, res)=> {
    const tweet = 
    `
|￣￣￣￣￣￣￣￣￣￣￣￣|  
#EndSarsProtests
#EndPoliceBrutality
|＿＿＿＿＿＿＿＿＿＿＿＿| 
     \\  (•◡•)  /`;

  firebase.database().ref().child('users_tokens').once('value', (snapshots) => {
    snapshots.forEach((snapshot)=> {
      send_status(snapshot.val().oauth_token, snapshot.val().oauth_token_secret, tweet)
    })
    res.status(200).json({message: "tweet sent"})
  })

  })


app.use('/api/v1', router);
const port = process.env.PORT || 4000
app.listen(port);
console.log("EndSARS running on port:  " + port);
module.exports = app;
