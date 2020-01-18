const AWS = require('aws-sdk');

const bucketname = '*';
const key = "*";
const s3key = `wikipedia-${key}`;

const bucketPromise = new AWS.S3({apiVersion: '2006-03-01'}).createBucket({Bucket: bucketname}).promise();

bucketPromise.then(function(data) {
    const objectParams = {Bucket: bucketname, Key: s3key, Body: 'Wonder Doge'};

    const uploadPromise = new AWS.S3({apiVersion: '2006-03-01'}).putObject(objectParams).promise();

    uploadPromise.then(function(data) {
        console.log("Successfully uploaded data to " + bucketname + "/" + s3key);
    })
}).catch(function(err) {
    console.error(err, err.stack);
});
