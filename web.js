var express = require('express');
var hat = require('hat');
var knox = require('knox');
var fs = require('fs');
var crack = require('crack');

var rack = hat.rack();

var app = express.createServer(express.logger());
app.configure(function() {
  app.use(express.methodOverride());
  app.use(express.bodyParser());
});

var s3client =  knox.createClient({
  key: process.env.S3_KEY,
  secret: process.env.S3_SECRET,
  bucket: process.env.S3_BUCKET,
  secure: false
});


// Static files
function sendFile(response, filename, type) {
  fs.readFile('static/' + filename, function(err, data) {
    if (err) {
      console.log(err.message);
      response.send(500);
      return;
    }
    response.header('Content-Type', type);
    response.send(data);
  });
}

app.get('/', function(req, response) {
  response.redirect('/static/upload.html');
});

app.get(/\/static\/(.*)/, function(req, response) {
  var path = req.params[0];
  var index = path.lastIndexOf('.');
  var format = '';
  if (index > -1) {
    format = path.substring(index);
  }

  var type;
  switch (format) {
  case '.html':
    type = 'text/html';
    break;
  case '.css':
    type = 'text/css';
    break;
  case '.js':
    type = 'application/javascript';
    break;
  case '.gif':
    type = 'image/gif';
    break;
  default:
    type = 'text/html';
  }

  sendFile(response, path, type);
});

app.post('/upload', function(req, response) {
  console.log('Client is uploading a file');
  var filename = req.headers['x-file-name'];
  var id = rack();
  var name = id + '_' + filename;
  var buffers = [];
  console.log('Original filename: ' + filename);
  console.log('Assigned ID: ' + id);
  console.log('S3 object name: ' + name);

  // Store the image data in buffers
  req.on('data', function(data) {
    buffers.push(data);
  });

  // When the upload has finished, we can figure out the content length
  // and send to Amazon.
  // TODO: use S3 Multipart uploads so we don't have to keep the whole
  // file around in Buffer objects.
  req.on('end', function() {
    var contentLength = buffers.reduce(function(len,el) { return len + el.length; }, 0);
    var s3request = s3client.put(name, {
      'Content-Length': contentLength,
      'Content-Type': req.headers['x-mime-type']
    });

    // Set up S3 response handlers.
    // When we receive the S3 response, we're done.
    s3request.on('response', function(res) {
      s3respdata = '';
      res
      .on('data', function(chunk) {
        console.log(chunk.toString());
        s3respdata = s3respdata + chunk.toString();
      })
      .on('close', function(error) {
        console.log();
        console.log(error.message);
        console.log('Sending back failure info.');
        console.log();
        body = JSON.stringify({success: 'false'});
        response.end(body);
      })
      .on('end', function() {
        var s3resp_doc = null;
        if (s3respdata.length > 0)
          s3resp_doc = crack(s3respdata);
        if (s3resp_doc != null && s3resp_doc.find('Error')[0]) {
          body = JSON.stringify({success: 'false', error: 'Error from S3'});
          console.log('Received Error status from S3. Sending failure info to client.');
        } else if (s3resp_doc == null || s3resp_doc.find('Success')[0]) {
          body = JSON.stringify({success: 'true', name: name});
          console.log('Done uploading ' + name);
        }
        response.end(body);
        console.log();
      });
    });

    // Write to the S3 request.
    for (var i=0; i<buffers.length; i++) {
      console.log('Writing chunk ' + i + ' of ' + buffers.length + ' to S3.');
      s3request.write(buffers[i]);
    }
    s3request.end();

  });
});


var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
