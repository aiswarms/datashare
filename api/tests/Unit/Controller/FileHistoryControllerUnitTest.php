<?php

namespace App\Tests\Unit\Controller;

use App\Controller\FileHistoryController;
use App\Entity\File;
use App\Entity\Tag;
use App\Entity\User;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Response;

class FileHistoryControllerUnitTest extends TestCase
{
    private FileHistoryController $controller;
    private EntityManagerInterface $em;
    private EntityRepository $repository;

    protected function setUp(): void
    {
        $this->em = $this->createMock(EntityManagerInterface::class);
        $this->repository = $this->createMock(EntityRepository::class);

        $this->controller = new FileHistoryController();
    }

    public function testInvokeWithEmptyFileList(): void
    {
        $user = $this->createStub(User::class);

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertJsonStringEqualsJsonString(
            json_encode(['data' => []]),
            $response->getContent()
        );
    }

    public function testInvokeWithSingleFile(): void
    {
        $user = $this->createStub(User::class);
        $file = $this->createMock(File::class);

        $file->expects($this->once())->method('getId')->willReturn(1);
        $file->expects($this->atLeastOnce())->method('getToken')->willReturn('test-token');
        $file->expects($this->once())->method('getOriginalName')->willReturn('document.pdf');
        $file->expects($this->once())->method('getMimeType')->willReturn('application/pdf');
        $file->expects($this->once())->method('getSize')->willReturn(1024);
        $file->expects($this->atLeastOnce())->method('getExpiresAt')
            ->willReturn(new \DateTimeImmutable('+1 day'));
        $file->expects($this->once())->method('getUploadedAt')
            ->willReturn(new \DateTimeImmutable());
        $file->expects($this->once())->method('getPasswordHash')->willReturn(null);
        $file->expects($this->once())->method('getTags')
            ->willReturn(new ArrayCollection([]));

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([$file]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertCount(1, $data['data']);

        $fileData = $data['data'][0];
        $this->assertSame(1, $fileData['id']);
        $this->assertSame('test-token', $fileData['token']);
        $this->assertSame('document.pdf', $fileData['original_name']);
        $this->assertSame('application/pdf', $fileData['mime_type']);
        $this->assertSame(1024, $fileData['size']);
        $this->assertFalse($fileData['is_expired']);
        $this->assertFalse($fileData['password_protected']);
        $this->assertSame('/api/files/test-token/download', $fileData['download_url']);
        $this->assertEmpty($fileData['tags']);
    }

    public function testInvokeWithPasswordProtectedFile(): void
    {
        $user = $this->createStub(User::class);
        $file = $this->createMock(File::class);

        $file->expects($this->once())->method('getId')->willReturn(1);
        $file->expects($this->atLeastOnce())->method('getToken')->willReturn('protected-token');
        $file->expects($this->once())->method('getOriginalName')->willReturn('secret.txt');
        $file->expects($this->once())->method('getMimeType')->willReturn('text/plain');
        $file->expects($this->once())->method('getSize')->willReturn(256);
        $file->expects($this->atLeastOnce())->method('getExpiresAt')
            ->willReturn(new \DateTimeImmutable('+7 days'));
        $file->expects($this->once())->method('getUploadedAt')
            ->willReturn(new \DateTimeImmutable());
        $file->expects($this->once())->method('getPasswordHash')
            ->willReturn('$2y$10$somehash');
        $file->expects($this->once())->method('getTags')
            ->willReturn(new ArrayCollection([]));

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([$file]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $fileData = $data['data'][0];

        $this->assertTrue($fileData['password_protected']);
    }

    public function testInvokeWithExpiredFile(): void
    {
        $user = $this->createStub(User::class);
        $file = $this->createMock(File::class);

        $file->expects($this->once())->method('getId')->willReturn(1);
        $file->expects($this->atLeastOnce())->method('getToken')->willReturn('expired-token');
        $file->expects($this->once())->method('getOriginalName')->willReturn('old.txt');
        $file->expects($this->once())->method('getMimeType')->willReturn('text/plain');
        $file->expects($this->once())->method('getSize')->willReturn(100);
        $file->expects($this->atLeastOnce())->method('getExpiresAt')
            ->willReturn(new \DateTimeImmutable('-1 day'));
        $file->expects($this->once())->method('getUploadedAt')
            ->willReturn(new \DateTimeImmutable('-10 days'));
        $file->expects($this->once())->method('getPasswordHash')->willReturn(null);
        $file->expects($this->once())->method('getTags')
            ->willReturn(new ArrayCollection([]));

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([$file]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $fileData = $data['data'][0];

        $this->assertTrue($fileData['is_expired']);
    }

    public function testInvokeWithMultipleFiles(): void
    {
        $user = $this->createStub(User::class);

        $file1 = $this->createMock(File::class);
        $file1->expects($this->once())->method('getId')->willReturn(1);
        $file1->expects($this->once())->method('getToken')->willReturn('token1');
        $file1->expects($this->once())->method('getOriginalName')->willReturn('file1.txt');
        $file1->expects($this->once())->method('getMimeType')->willReturn('text/plain');
        $file1->expects($this->once())->method('getSize')->willReturn(100);
        $file1->expects($this->exactly(2))->method('getExpiresAt')
            ->willReturn(new \DateTimeImmutable('+1 day'));
        $file1->expects($this->once())->method('getUploadedAt')
            ->willReturn(new \DateTimeImmutable('-1 day'));
        $file1->expects($this->once())->method('getPasswordHash')->willReturn(null);
        $file1->expects($this->once())->method('getTags')
            ->willReturn(new ArrayCollection([]));

        $file2 = $this->createMock(File::class);
        $file2->expects($this->once())->method('getId')->willReturn(2);
        $file2->expects($this->once())->method('getToken')->willReturn('token2');
        $file2->expects($this->once())->method('getOriginalName')->willReturn('file2.txt');
        $file2->expects($this->once())->method('getMimeType')->willReturn('text/plain');
        $file2->expects($this->once())->method('getSize')->willReturn(200);
        $file2->expects($this->exactly(2))->method('getExpiresAt')
            ->willReturn(new \DateTimeImmutable('+2 days'));
        $file2->expects($this->once())->method('getUploadedAt')
            ->willReturn(new \DateTimeImmutable('-2 days'));
        $file2->expects($this->once())->method('getPasswordHash')->willReturn(null);
        $file2->expects($this->once())->method('getTags')
            ->willReturn(new ArrayCollection([]));

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([$file1, $file2]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $this->assertCount(2, $data['data']);
        $this->assertSame('token1', $data['data'][0]['token']);
        $this->assertSame('token2', $data['data'][1]['token']);
    }

    public function testInvokeWithFileTags(): void
    {
        $user = $this->createStub(User::class);
        $file = $this->createMock(File::class);

        $tag1 = $this->createMock(Tag::class);
        $tag1->expects($this->once())->method('getName')->willReturn('important');

        $tag2 = $this->createMock(Tag::class);
        $tag2->expects($this->once())->method('getName')->willReturn('project-a');

        $tags = new ArrayCollection([$tag1, $tag2]);

        $file->expects($this->once())->method('getId')->willReturn(1);
        $file->expects($this->once())->method('getToken')->willReturn('tagged-token');
        $file->expects($this->once())->method('getOriginalName')->willReturn('tagged.txt');
        $file->expects($this->once())->method('getMimeType')->willReturn('text/plain');
        $file->expects($this->once())->method('getSize')->willReturn(500);
        $file->expects($this->exactly(2))->method('getExpiresAt')
            ->willReturn(new \DateTimeImmutable('+5 days'));
        $file->expects($this->once())->method('getUploadedAt')
            ->willReturn(new \DateTimeImmutable());
        $file->expects($this->once())->method('getPasswordHash')->willReturn(null);
        $file->expects($this->once())->method('getTags')
            ->willReturn($tags);

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([$file]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());

        $data = json_decode($response->getContent(), true);
        $fileData = $data['data'][0];

        $this->assertCount(2, $fileData['tags']);
        $this->assertContains('important', $fileData['tags']);
        $this->assertContains('project-a', $fileData['tags']);
    }

    public function testResponseHeaderAndStatusCode(): void
    {
        $user = $this->createStub(User::class);

        $this->em->expects($this->once())
            ->method('getRepository')
            ->with(File::class)
            ->willReturn($this->repository);

        $this->repository->expects($this->once())
            ->method('findBy')
            ->with(['user' => $user], ['uploadedAt' => 'DESC', 'id' => 'DESC'])
            ->willReturn([]);

        $response = $this->controller->__invoke($this->em, $user);

        $this->assertSame(Response::HTTP_OK, $response->getStatusCode());
        $this->assertSame('application/json', $response->headers->get('Content-Type'));
    }
}
