# S3 CORS (required for fast browser upload)

Direct upload sends the Excel file from the browser to S3. The bucket must allow **PUT** from the app URL.

On server start the API tries to apply this automatically. You can also set it in **AWS S3** → bucket **fastrecovery** → **Permissions** → **Cross-origin resource sharing (CORS)**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "POST"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "https://fastrecovery.in",
      "https://www.fastrecovery.in"
    ],
    "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
    "MaxAgeSeconds": 3000
  }
]
```

If the browser PUT is still blocked, the app uploads the file through the API instead (`/uploads/s3/proxy` or `/bank/uploads/proxy`).
