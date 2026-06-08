<?php

namespace App\Service;

use Aws\S3\S3Client;
use Aws\S3\Exception\S3Exception;

class FileStorageService
{
    private S3Client $client;
    private string $bucket;

    public function __construct(
        private readonly string $endpoint,
        private readonly string $accessKey,
        private readonly string $secretKey,
        private readonly string $region,
        string $bucket,
    ) {
        $this->bucket = $bucket;
        $this->client = new S3Client([
            'version'                  => 'latest',
            'region'                   => $this->region,
            'endpoint'                 => $this->endpoint,
            'use_path_style_endpoint'  => true,
            'credentials'              => [
                'key'    => $this->accessKey,
                'secret' => $this->secretKey,
            ],
        ]);
    }

    public function upload(string $storagePath, string $localPath, string $mimeType): void
    {
        $this->ensureBucketExists();

        $this->client->putObject([
            'Bucket'      => $this->bucket,
            'Key'         => $storagePath,
            'SourceFile'  => $localPath,
            'ContentType' => $mimeType,
        ]);
    }

    public function delete(string $storagePath): void
    {
        $this->client->deleteObject([
            'Bucket' => $this->bucket,
            'Key'    => $storagePath,
        ]);
    }

    public function getStream(string $storagePath): \Psr\Http\Message\StreamInterface
    {
        $result = $this->client->getObject([
            'Bucket' => $this->bucket,
            'Key'    => $storagePath,
        ]);

        return $result['Body'];
    }

    private function ensureBucketExists(): void
    {
        try {
            $this->client->headBucket(['Bucket' => $this->bucket]);
        } catch (S3Exception) {
            $this->client->createBucket(['Bucket' => $this->bucket]);
        }
    }
}
