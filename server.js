// Upload server: stores files in AWS S3 and lists them from DynamoDB
// Setup: npm install express multer @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb dotenv
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max
});

// Credentials come from .env (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
const s3 = new S3Client({ region: process.env.AWS_REGION });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const BUCKET = process.env.S3_BUCKET;
const TABLE = process.env.TABLE_NAME || 'UploadedFiles';

app.use(express.static(__dirname));

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file received.');

  const safeName = path.basename(req.file.originalname).replace(/[^\w.\-]/g, '_');
  const key = `${Date.now()}-${safeName}`; // stored at bucket root

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));
    res.send(`Uploaded "${req.file.originalname}" to s3://${BUCKET}/${key}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('S3 upload failed: ' + err.message);
  }
});

// List uploaded files (records written by the Lambda)
app.get('/files', async (req, res) => {
  try {
    const items = [];
    let lastKey;
    do {
      const out = await db.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }));
      items.push(...(out.Items || []));
      lastKey = out.LastEvaluatedKey;
    } while (lastKey);

    items.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt))); // newest first
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a file from S3 and its record from DynamoDB
app.delete('/files/:name', async (req, res) => {
  const key = req.params.name;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    // Remove the row right away (the Lambda delete trigger would also do this)
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { fileName: key } }));
    res.send(`Deleted "${key}" from S3 and DynamoDB`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Delete failed: ' + err.message);
  }
});

app.listen(3000, () => console.log('Open http://localhost:3000'));
