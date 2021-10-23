import boto3


class AWSUtils():

    def __init__(self, access_key=None, secret_key=None, region=None):
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        self.aws_config = {
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region,
        }

    def get_client(self, service=''):
        if self.access_key:
            return boto3.client(
                service,
                **self.aws_config
            )
        else:
            return boto3.client(service)

    def upload_file_to_s3(self, bucket=None, local_file_path=None, s3_file_path=None):
        client = self.get_client('s3')
        client.upload_file(
            local_file_path,
            bucket,
            s3_file_path
        )

    def download_file_from_s3(self, bucket=None, local_file_path=None, s3_file_path=None):
        client = self.get_client('s3')
        client.download_file(
            bucket,
            s3_file_path,
            local_file_path
        )