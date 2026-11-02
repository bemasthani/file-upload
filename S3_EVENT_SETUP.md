# Keep DynamoDB in sync with the S3 bucket

Bucket: `business-insurance-prep-worksheet-2026` · Region: **US East (Ohio) us-east-2**

- Upload a file → a row is added to the `UploadedFiles` table
- Delete a file → its row is removed

Do every step in region **us-east-2**.

## 1. Create the DynamoDB table (once)
1. **DynamoDB** → **Tables** → **Create table**
   - Table name: `UploadedFiles`
   - Partition key: `fileName` (String)
2. **Create table**, wait until status is **Active**.

## 2. Create / update the Lambda function
1. **Lambda** → open `on-file-uploaded` (or **Create function** → Author from scratch,
   name `on-file-uploaded`, runtime **Node.js 20.x** or newer).
2. **Code** tab → replace `index.mjs` with `lambda/index.mjs` from this project → **Deploy**.
3. **Configuration** → **Environment variables** → `TABLE_NAME` = `UploadedFiles`.

## 3. Permissions for the Lambda role
**Configuration** → **Permissions** → click the role name → edit (or create) the inline policy
`dynamodb-put-uploaded-files` so it contains both actions:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:PutItem", "dynamodb:DeleteItem"],
    "Resource": "arn:aws:dynamodb:us-east-2:410729353310:table/UploadedFiles"
  }]
}
```

## 4. S3 triggers (two of them)
On the function page → **Add trigger** → **S3**:
1. Bucket `business-insurance-prep-worksheet-2026`, Event types **All object create events** → **Add**
2. **Add trigger** again → S3, same bucket, Event types **All object delete events** → **Add**

The function diagram should now show S3 on the left (2 triggers).

## 5. Test
1. Upload a file at http://localhost:3000 → **DynamoDB** → `UploadedFiles` → **Explore table items** → row appears.
2. **S3** → bucket → select the file → **Delete** → refresh the table → row is gone.
3. Problems? Lambda → **Monitor** → **View CloudWatch logs**.

Note: if bucket **Versioning** is on, deleting in the console adds a "delete marker";
this still sends a delete event, so the row is removed.
