<?php

namespace App\Tests\Controller;

use App\Entity\File;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class DownloadControllerTest extends WebTestCase
{
    private $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        $conn = static::getContainer()->get('doctrine')->getConnection();
        $conn->executeStatement('TRUNCATE users, files, tags RESTART IDENTITY CASCADE');
    }

    private function getJwt(): string
    {
        $this->client->request('POST', '/api/auth/register', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => 'download@test.com', 'password' => 'password1']));

        $this->client->request('POST', '/api/auth/login', [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['email' => 'download@test.com', 'password' => 'password1']));

        return json_decode($this->client->getResponse()->getContent(), true)['token'];
    }

    private function makeFile(string $name = 'test.txt', string $content = 'hello'): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'dl_test_');
        file_put_contents($tmp, $content);
        return new UploadedFile($tmp, $name, 'text/plain', null, true);
    }

    private function uploadAndGetToken(?string $password = null): string
    {
        $jwt    = $this->getJwt();
        $params = $password !== null ? ['password' => $password] : [];

        $this->client->request(
            'POST', '/api/files', $params, ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );

        return json_decode($this->client->getResponse()->getContent(), true)['token'];
    }

    public function testDownloadSuccess(): void
    {
        $token = $this->uploadAndGetToken();

        $this->client->request('GET', "/api/files/{$token}/download");

        $this->assertResponseStatusCodeSame(200);
        $this->assertResponseHeaderSame('content-disposition', 'attachment; filename="test.txt"');
        $this->assertSame('stub-content', $this->client->getInternalResponse()->getContent());
    }

    public function testDownloadNotFound(): void
    {
        $this->client->request('GET', '/api/files/nonexistent-token/download');

        $this->assertResponseStatusCodeSame(404);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('FILE_NOT_FOUND', $data['error']);
    }

    public function testDownloadExpiredFile(): void
    {
        $token = $this->uploadAndGetToken();

        $em   = static::getContainer()->get('doctrine')->getManager();
        $file = $em->getRepository(File::class)->findOneBy(['token' => $token]);
        $file->setExpiresAt(new \DateTimeImmutable('-1 day'));
        $em->flush();

        $this->client->request('GET', "/api/files/{$token}/download");

        $this->assertResponseStatusCodeSame(404);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('FILE_NOT_FOUND', $data['error']);
    }

    public function testDownloadWithoutPassword(): void
    {
        $token = $this->uploadAndGetToken('secret123');

        $this->client->request('GET', "/api/files/{$token}/download");

        $this->assertResponseStatusCodeSame(401);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('WRONG_PASSWORD', $data['error']);
    }

    public function testDownloadWrongPassword(): void
    {
        $token = $this->uploadAndGetToken('secret123');

        $this->client->request('GET', "/api/files/{$token}/download?password=wrong");

        $this->assertResponseStatusCodeSame(401);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame('WRONG_PASSWORD', $data['error']);
    }

    public function testDownloadCorrectPassword(): void
    {
        $token = $this->uploadAndGetToken('secret123');

        $this->client->request('GET', "/api/files/{$token}/download?password=secret123");

        $this->assertResponseStatusCodeSame(200);
        $this->assertSame('stub-content', $this->client->getInternalResponse()->getContent());
    }
}
