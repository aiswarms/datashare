<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class FileMetaControllerTest extends WebTestCase
{
    private $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        $conn = static::getContainer()->get('doctrine')->getConnection();
        $conn->executeStatement('TRUNCATE users, files, tags RESTART IDENTITY CASCADE');
    }

    private function register(string $email, string $password = 'password1'): void
    {
        $this->client->request('POST', '/api/auth/register', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => $email, 'password' => $password]));
    }

    private function login(string $email, string $password = 'password1'): string
    {
        $this->client->request('POST', '/api/auth/login', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => $email, 'password' => $password]));

        return json_decode($this->client->getResponse()->getContent(), true)['token'];
    }

    private function upload(string $jwt, string $name = 'test.txt', array $extra = []): array
    {
        $tmp = tempnam(sys_get_temp_dir(), 'meta_test_');
        file_put_contents($tmp, 'hello');
        $file = new UploadedFile($tmp, $name, 'text/plain', null, true);

        $this->client->request(
            'POST', '/api/files',
            $extra,
            ['file' => $file],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );

        return json_decode($this->client->getResponse()->getContent(), true);
    }

    public function testReturnsMetadataForValidToken(): void
    {
        $this->register('meta@test.com');
        $jwt  = $this->login('meta@test.com');
        $data = $this->upload($jwt, 'document.pdf');

        $this->client->request('GET', "/api/files/{$data['token']}");

        $this->assertResponseStatusCodeSame(200);
        $body = json_decode($this->client->getResponse()->getContent(), true);

        $this->assertSame($data['token'], $body['token']);
        $this->assertSame('document.pdf', $body['original_name']);
        $this->assertSame('text/plain', $body['mime_type']);
        $this->assertIsInt($body['size']);
        $this->assertArrayHasKey('expires_at', $body);
        $this->assertFalse($body['is_expired']);
        $this->assertFalse($body['password_protected']);
        $this->assertStringContainsString($data['token'], $body['download_url']);
    }

    public function testReturns404ForUnknownToken(): void
    {
        $this->client->request('GET', '/api/files/no-such-token-xyz');

        $this->assertResponseStatusCodeSame(404);
        $body = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('FILE_NOT_FOUND', $body['error']);
    }

    public function testAccessibleWithoutAuthentication(): void
    {
        $this->register('meta@test.com');
        $jwt  = $this->login('meta@test.com');
        $data = $this->upload($jwt);

        // No Authorization header
        $this->client->request('GET', "/api/files/{$data['token']}");

        $this->assertResponseStatusCodeSame(200);
    }

    public function testPasswordProtectedFlagIsTrue(): void
    {
        $this->register('meta@test.com');
        $jwt  = $this->login('meta@test.com');
        $data = $this->upload($jwt, 'secret.txt', ['password' => 'mypassword']);

        $this->client->request('GET', "/api/files/{$data['token']}");

        $body = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertTrue($body['password_protected']);
    }

    public function testIsExpiredFalseForFreshFile(): void
    {
        $this->register('meta@test.com');
        $jwt  = $this->login('meta@test.com');
        $data = $this->upload($jwt);

        $this->client->request('GET', "/api/files/{$data['token']}");

        $body = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertFalse($body['is_expired']);
    }

    public function testDownloadUrlPointsToDownloadEndpoint(): void
    {
        $this->register('meta@test.com');
        $jwt  = $this->login('meta@test.com');
        $data = $this->upload($jwt);

        $this->client->request('GET', "/api/files/{$data['token']}");

        $body = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame("/api/files/{$data['token']}/download", $body['download_url']);
    }
}
