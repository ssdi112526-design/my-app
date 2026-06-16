# S3 CORS (required for fast browser upload)

Direct upload sends the Excel file from the browser to S3. Your bucket must allow **PUT** from your app URL.

In **AWS S3** → bucket **fastrecovery** → **Permissions** → **Cross-origin resource sharing (CORS)**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3001",
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Save, then retry upload from Bank Details.
