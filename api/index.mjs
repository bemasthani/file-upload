// file-api Lambda: the backend for the GitHub Pages site.
// Exposed through a Lambda Function URL (auth NONE, CORS set on the Function URL).
//
// Routes
//   POST   /upload-url   body {fileName, contentType} -> {url, key}  (browser PUTs the file to url)
//   GET    /files                                     -> [ {fileName, fileSize, uploadedAt, ...} ]
//   DELETE /files?name=<key>                          -> deletes from S3 and DynamoDB
//
// Environment variables: S3_BUCKET, TABLE_NAME
// Runtime: Node.js 20.x (or newer)

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const s3 = new S3Client({});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.S3_BUCKET;
const TABLE = process.env.TABLE_NAME || 'UploadedFiles';

// CORS headers are added by the Function URL settings, not here (duplicates break browsers)
const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.rawPath || '/';

  try {
    // ---- Get a signed upload link ----
    if (method === 'POST' && path === '/upload-url') {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : event.body;
      const { fileName, contentType } = JSON.parse(raw || '{}');
      if (!fileName) return reply(400, { error: 'fileName is required' });

      const safeName = String(fileName).split(/[\\/]/).pop().replace(/[^\w.\-]/g, '_');
      const key = `${Date.now()}-${safeName}`;
      const url = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType || 'application/octet-stream' }),
        { expiresIn: 300 } // 5 minutes
      );
      return reply(200, { url, key });
    }

    // ---- List files ----
    if (method === 'GET' && path === '/files') {
      const items = [];
      let lastKey;
      do {
        const out = await db.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }));
        items.push(...(out.Items || []));
        lastKey = out.LastEvaluatedKey;
      } while (lastKey);
      items.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
      return reply(200, items);
    }

    // ---- Delete a file ----
    if (method === 'DELETE' && path === '/files') {
      const key = event.queryStringParameters?.name;
      if (!key) return reply(400, { error: 'name is required' });
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      await db.send(new DeleteCommand({ TableName: TABLE, Key: { fileName: key } }));
      return reply(200, { message: `Deleted "${key}" from S3 and DynamoDB` });
    }

    return reply(404, { error: `No route for ${method} ${path}` });
  } catch (err) {
    console.error(err);
    return reply(500, { error: err.message });
  }
};
