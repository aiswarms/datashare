<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class UploadControllerTest extends WebTestCase
{
    private $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        $conn = static::getContainer()->get('doctrine')->getConnection();
        $conn->executeStatement('TRUNCATE users, files, tags RESTART IDENTITY CASCADE');
    }

    private function getToken(): string
    {
        $this->client->request('POST', '/api/auth/register', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => 'upload@test.com', 'password' => 'password1']));

        $this->client->request('POST', '/api/auth/login', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => 'upload@test.com', 'password' => 'password1']));

        return json_decode($this->client->getResponse()->getContent(), true)['token'];
    }

    private function makeFile(string $name = 'test.txt', string $content = 'hello'): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'upload_test_');
        file_put_contents($tmp, $content);
        return new UploadedFile($tmp, $name, 'text/plain', null, true);
    }

    public function testUploadSuccess(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files', [], ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertArrayHasKey('download_url', $data);
        $this->assertSame('test.txt', $data['original_name']);
        $this->assertFalse($data['password_protected']);
        $this->assertSame([], $data['tags']);
    }

    public function testUploadWithTagsAndPassword(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files',
            ['tags' => ['invoice', 'report'], 'password' => 'secret123', 'expires_in_days' => 3],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['password_protected']);
        $this->assertSame(['invoice', 'report'], $data['tags']);
        $this->assertSame(3, (int) (new \DateTimeImmutable($data['expires_at'])
            ->diff(new \DateTimeImmutable($data['uploaded_at']))->days));
    }

    public function testUploadDedupTags(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files',
            ['tags' => ['foo', 'foo', 'bar']],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame(['foo', 'bar'], $data['tags']);
    }

    public function testAnonUploadSuccess(): void
    {
        $this->client->request('POST', '/api/files', [], ['file' => $this->makeFile()]);

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertArrayHasKey('download_url', $data);
        $this->assertFalse($data['password_protected']);
    }

    public function testAnonUploadWithPassword(): void
    {
        $this->client->request(
            'POST', '/api/files',
            ['password' => 'secret123'],
            ['file' => $this->makeFile()]
        );

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($data['password_protected']);
    }

    public function testUploadMissingFile(): void
    {
        $token = $this->getToken();
        $this->client->request('POST', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $token"]);
        $this->assertResponseStatusCodeSame(400);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('VALIDATION_ERROR', $data['error']);
    }

    public function testUploadForbiddenExtension(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files', [],
            ['file' => $this->makeFile('virus.exe')],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(422);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('FORBIDDEN_FILE_TYPE', $data['error']);
    }

    public function testUploadInvalidExpiry(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files',
            ['expires_in_days' => 10],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(400);
    }

    public function testUploadPasswordTooShort(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files',
            ['password' => 'abc'],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(400);
    }

    public function testUploadTagTooLong(): void
    {
        $token = $this->getToken();

        $this->client->request(
            'POST', '/api/files',
            ['tags' => [str_repeat('a', 31)]],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $token"]
        );

        $this->assertResponseStatusCodeSame(400);
    }
}
