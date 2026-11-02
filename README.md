# File Upload to AWS S3

## 1. AWS setup
1. Create an S3 bucket in the AWS console (keep "Block all public access" on).
2. Create an IAM user (or use an existing one) with this policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::business-insurance-prep-worksheet-2026/*"
  }]
}
```
3. Create an access key for that user.

## 2. Configure
Copy `.env.example` to `.env` and fill in your region, bucket name and access key.

## 3. Run
```
npm init -y
npm install express multer @aws-sdk/client-s3 dotenv
node server.js
```
Open http://localhost:3000, drop or browse a file, and click Submit.
Files are stored at the root of s3://business-insurance-prep-worksheet-2026/.
