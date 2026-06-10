<?php

namespace App\Tests\Unit\Controller;

use App\Controller\UploadController;
use App\Entity\File;
use App\Entity\User;
use App\Service\FileStorageService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\MockObject\Stub;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class UploadControllerUnitTest extends TestCase
{
    private UploadController $controller;
    private EntityManagerInterface&Stub $em;
    private FileStorageService&Stub $storage;
    private User $user;

    protected function setUp(): void
    {
        $this->em         = $this->createStub(EntityManagerInterface::class);
        $this->storage    = $this->createStub(FileStorageService::class);
        $this->controller = new UploadController();
        $this->user       = new User('test@test.com', 'hashed');
    }

    private function makeUploadedFile(string $name = 'doc.txt', int $size = 100, ?string $ext = null): UploadedFile&Stub
    {
        $mock = $this->createStub(UploadedFile::class);
        $mock->method('isValid')->willReturn(true);
        $mock->method('getClientOriginalName')->willReturn($name);
        $mock->method('getClientOriginalExtension')->willReturn($ext ?? pathinfo($name, PATHINFO_EXTENSION));
        $mock->method('getMimeType')->willReturn('text/plain');
        $mock->method('getSize')->willReturn($size);
        $mock->method('getPathname')->willReturn('/tmp/test');
        return $mock;
    }

    public function testInvalidUploadReturns400(): void
    {
        $mock = $this->createStub(UploadedFile::class);
        $mock->method('isValid')->willReturn(false);
        $mock->method('getError')->willReturn(\UPLOAD_ERR_INI_SIZE);

        $request  = new Request([], [], [], [], ['file' => $mock]);
        $response = ($this->controller)($request, $this->em, $this->storage, $this->user);

        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertSame('UPLOAD_ERROR', json_decode($response->getContent(), true)['error']);
    }

    public function testMissingFileReturns400(): void
    {
        $response = ($this->controller)(new Request(), $this->em, $this->storage, $this->user);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
        $this->assertSame('VALIDATION_ERROR', json_decode($response->getContent(), true)['error']);
    }

    public function testFileTooLargeReturns413(): void
    {
        $request = new Request([], [], [], [], ['file' => $this->makeUploadedFile('big.txt', 1_073_741_825)]);
        $response = ($this->controller)($request, $this->em, $this->storage, $this->user);
        $this->assertSame(Response::HTTP_REQUEST_ENTITY_TOO_LARGE, $response->getStatusCode());
        $this->assertSame('FILE_TOO_LARGE', json_decode($response->getContent(), true)['error']);
    }

    public function testForbiddenExtensionReturns422(): void
    {
        $request = new Request([], [], [], [], ['file' => $this->makeUploadedFile('malware.exe', 100, 'exe')]);
        $response = ($this->controller)($request, $this->em, $this->storage, $this->user);
        $this->assertSame(422, $response->getStatusCode());
        $this->assertSame('FORBIDDEN_FILE_TYPE', json_decode($response->getContent(), true)['error']);
    }

    public function testInvalidExpiryReturns400(): void
    {
        $request = new Request([], ['expires_in_days' => 10], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $this->em, $this->storage, $this->user);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testPasswordTooShortReturns400(): void
    {
        $request = new Request([], ['password' => 'abc'], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $this->em, $this->storage, $this->user);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testTagTooLongReturns400(): void
    {
        $request = new Request([], ['tags' => [str_repeat('a', 31)]], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $this->em, $this->storage, $this->user);
        $this->assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    }

    public function testSuccessfulUploadReturns201(): void
    {
        $storage = $this->createMock(FileStorageService::class);
        $storage->expects($this->once())->method('upload');

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects($this->once())->method('persist')
            ->willReturnCallback(function (File $f): void {
                (new \ReflectionProperty(File::class, 'id'))->setValue($f, 99);
            });
        $em->expects($this->once())->method('flush');

        $request  = new Request([], [], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $em, $storage, $this->user);

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertSame(99, $data['id']);
        $this->assertFalse($data['password_protected']);
        $this->assertStringContainsString('/api/files/', $data['download_url']);
        $this->assertSame([], $data['tags']);
    }

    public function testSuccessWithPasswordAndTags(): void
    {
        $em = $this->createStub(EntityManagerInterface::class);
        $em->method('persist')
            ->willReturnCallback(function (File $f): void {
                (new \ReflectionProperty(File::class, 'id'))->setValue($f, 1);
            });

        $request  = new Request([], ['password' => 'secret123', 'tags' => ['foo', 'bar']], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $em, $this->storage, $this->user);

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertTrue($data['password_protected']);
        $this->assertSame(['foo', 'bar'], $data['tags']);
    }

    public function testAnonUploadReturns201(): void
    {
        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects($this->once())->method('persist')
            ->willReturnCallback(function (File $f): void {
                (new \ReflectionProperty(File::class, 'id'))->setValue($f, 1);
            });
        $em->expects($this->once())->method('flush');

        $request  = new Request([], [], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $em, $this->storage, null);

        $this->assertSame(Response::HTTP_CREATED, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertFalse($data['password_protected']);
    }

    public function testDuplicateTagsAreDeduped(): void
    {
        $em = $this->createStub(EntityManagerInterface::class);
        $em->method('persist')
            ->willReturnCallback(function (File $f): void {
                (new \ReflectionProperty(File::class, 'id'))->setValue($f, 1);
            });

        $request  = new Request([], ['tags' => ['foo', 'foo', 'bar']], [], [], ['file' => $this->makeUploadedFile()]);
        $response = ($this->controller)($request, $em, $this->storage, $this->user);

        $data = json_decode($response->getContent(), true);
        $this->assertSame(['foo', 'bar'], $data['tags']);
    }
}
