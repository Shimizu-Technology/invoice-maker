"""S3 service for image upload and storage."""

import boto3
import uuid
from datetime import datetime
from typing import Optional
from botocore.exceptions import ClientError

from ..config import settings


class S3Service:
    """Service for uploading and managing images in S3."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        """Lazy initialization of S3 client."""
        if self._client is None:
            if not settings.aws_access_key_id or not settings.aws_secret_access_key:
                raise ValueError("AWS credentials not configured")
            
            self._client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_s3_region,
            )
        return self._client

    @property
    def bucket(self) -> str:
        """Get the configured S3 bucket name."""
        if not settings.aws_s3_bucket:
            raise ValueError("AWS S3 bucket not configured")
        return settings.aws_s3_bucket

    def upload_image(
        self,
        file_content: bytes,
        content_type: str,
        original_filename: Optional[str] = None,
    ) -> str:
        """
        Upload an image to S3 and return the public URL.

        Args:
            file_content: The raw bytes of the image
            content_type: MIME type (e.g., 'image/png')
            original_filename: Original filename for reference

        Returns:
            The public URL of the uploaded image
        """
        # Generate unique filename
        extension = self._get_extension(content_type, original_filename)
        timestamp = datetime.utcnow().strftime("%Y/%m/%d")
        unique_id = str(uuid.uuid4())[:8]
        key = f"chat-images/{timestamp}/{unique_id}{extension}"

        try:
            # Upload to S3
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_content,
                ContentType=content_type,
            )

            # Generate the public URL
            url = f"https://{self.bucket}.s3.{settings.aws_s3_region}.amazonaws.com/{key}"
            return url

        except ClientError as e:
            raise Exception(f"Failed to upload image to S3: {str(e)}")

    def _get_extension(
        self, content_type: str, filename: Optional[str] = None
    ) -> str:
        """Get file extension from content type or filename."""
        # Try to get from content type first
        content_type_map = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
            "image/svg+xml": ".svg",
        }

        if content_type in content_type_map:
            return content_type_map[content_type]

        # Fallback to filename extension
        if filename and "." in filename:
            return "." + filename.rsplit(".", 1)[-1].lower()

        # Default to .png
        return ".png"

    def is_configured(self) -> bool:
        """Check if S3 is properly configured."""
        return bool(
            settings.aws_access_key_id
            and settings.aws_secret_access_key
            and settings.aws_s3_bucket
        )


# Singleton instance
s3_service = S3Service()
