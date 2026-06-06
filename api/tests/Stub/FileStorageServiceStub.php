<?php

namespace App\Tests\Stub;

use App\Service\FileStorageService;

class FileStorageServiceStub extends FileStorageService
{
    public function __construct() {}

    public function upload(string $storagePath, string $localPath, string $mimeType): void {}
}
