// Import the installed modules.
const express = require('express');
const responseTime = require('response-time')
const axios = require('axios');
const redis = require('redis');

const app = express();
const AWS = require('aws-sdk');

const bucketname = 'qqq-wikipedia-store';

const bucketPromise = new AWS.S3({apiVersion: '2006-03-01'}).createBucket({Bucket: bucketname}).promise();

bucketPromise.then(function(data){
  console.log("Successfully created " + bucketname);
})
.catch(function(err){
  console.err(err, err.stack);
})

// create and connect redis client to local instance.
const redisClient = redis.createClient();

// Print redis errors to the console
redisClient.on('error', (err) => {
  console.log("Error " + err);
});

// use response-time as a middleware
app.use(responseTime());


// create an api/search route
app.get('/api/search', (req, res) => {
  // Extract the query from url and trim trailing spaces
  const query = (req.query.query).trim();
  // Build the Wikipedia API url
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${query}`;
  const key = `wikipedia:${query}`;

  // Try fetching the result from Redis first in case we have it cached
  return redisClient.get(key, (err, result) => {
    // If that key exist in Redis store
    if (result) {
      const resultJSON = JSON.parse(result);
      return res.status(200).json({source: 'Redis Cache', ...resultJSON});
    }
    else if(!result){
        // Key does not exist in Redis store
        // Fetch directly from Wikipedia API
    } else {
      return axios.get(searchUrl)
      .then(response => {
        const responseJSON = response.data;
        // Save the Wikipedia API response in Redis store
        redisClient.setex(redisKey, 3600, JSON.stringify({ source: 'Redis Cache', ...responseJSON, }));
        // Send JSON response to redisClient
        return res.status(200).json({ source: 'Wikipedia API', ...responseJSON, });
      })
      .catch(err => {
        return res.json(err);
      });
    }
  });
});

app.get('/api/store', (req, res) => {
    const key = (req.query.key).trim();

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${key}`

    const s3key = `wikipedia-${key}`;

    const params = {Bucket: bucketname, Key: s3key};

    return new AWS.S3({apiVersion: '2006-03-01'}).getObject(params, (err, result) => {
      if(result){
        console.log(result);
        const resultJSON = JSON.parse(result.Body);
        return res.status(200).json(resultJSON);
      }
      else{
        return axios.get(searchUrl)
        .then(response => {
          const responseJSON = response.data;
          const body = JSON.stringify({source: 'S3 Bucket', ...responseJSON});
          const objectParams = {Bucket: bucketname, Key: s3key, Body: body};
          const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();

          uploadPromise.then(function(data) {
            console.log("Successfully uploaded data to " + bucketname + "/" + s3key);
          });
          return res.status(200).json({source: 'Wikipedia API', ...responseJSON});
        })
        .catch(err => {
          return res.json(err);
        })
      }
    })
});

app.listen(3000, () => {
  console.log('Server listening on port: ', 3000);
});