// AWS Lambda handler for s3://business-insurance-prep-worksheet-2026/
//  - File uploaded  -> save a record (file name + size) to DynamoDB
//  - File deleted   -> remove that record from DynamoDB
// Runtime: Node.js 20.x (or newer) - the AWS SDK v3 is built in.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME || 'UploadedFiles';

export const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // Keys arrive URL-encoded (spaces become "+")
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    if (record.eventName.startsWith('ObjectCreated')) {
      const item = {
        fileName: key,                    // partition key
        fileSize: record.s3.object.size,  // bytes
        bucket,
        uploadedAt: record.eventTime
      };
      await db.send(new PutCommand({ TableName: TABLE, Item: item }));
      console.log('Saved to DynamoDB:', JSON.stringify(item));

    } else if (record.eventName.startsWith('ObjectRemoved')) {
      await db.send(new DeleteCommand({ TableName: TABLE, Key: { fileName: key } }));
      console.log('Deleted from DynamoDB:', key);

    } else {
      console.log('Ignored event:', record.eventName, key);
    }
  }

  return { status: 'ok' };
};
