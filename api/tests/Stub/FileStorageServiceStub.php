<?php

namespace App\Tests\Stub;

use App\Service\FileStorageService;

class FileStorageServiceStub extends FileStorageService
{
    public function __construct() {}

    public function upload(string $storagePath, string $localPath, string $mimeType): void {}

    public function delete(string $storagePath): void {}

    public function getStream(string $storagePath): \Psr\Http\Message\StreamInterface
    {
        return \GuzzleHttp\Psr7\Utils::streamFor('stub-content');
    }
}
