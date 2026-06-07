<?php

namespace App\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class FileHistoryControllerTest extends WebTestCase
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

    private function makeFile(string $name = 'test.txt'): UploadedFile
    {
        $tmp = tempnam(sys_get_temp_dir(), 'history_test_');
        file_put_contents($tmp, 'hello');
        return new UploadedFile($tmp, $name, 'text/plain', null, true);
    }

    private function upload(string $jwt, string $name = 'test.txt'): array
    {
        $this->client->request(
            'POST', '/api/files', [], ['file' => $this->makeFile($name)],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );

        return json_decode($this->client->getResponse()->getContent(), true);
    }

    public function testReturns401WhenUnauthenticated(): void
    {
        $this->client->request('GET', '/api/files');

        $this->assertResponseStatusCodeSame(401);
    }

    public function testReturnsEmptyListWhenNoUploads(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $this->assertResponseStatusCodeSame(200);
        $data = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertSame([], $data['data']);
    }

    public function testReturnsUploadedFiles(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');

        $this->upload($jwt, 'doc.pdf');
        $this->upload($jwt, 'photo.jpg');

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $this->assertResponseStatusCodeSame(200);
        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertCount(2, $data);

        $first = $data[0];
        $this->assertArrayHasKey('id', $first);
        $this->assertArrayHasKey('token', $first);
        $this->assertArrayHasKey('original_name', $first);
        $this->assertArrayHasKey('mime_type', $first);
        $this->assertArrayHasKey('size', $first);
        $this->assertArrayHasKey('expires_at', $first);
        $this->assertArrayHasKey('uploaded_at', $first);
        $this->assertArrayHasKey('is_expired', $first);
        $this->assertArrayHasKey('password_protected', $first);
        $this->assertArrayHasKey('download_url', $first);
        $this->assertArrayHasKey('tags', $first);
    }

    public function testFilesReturnedNewestFirst(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');

        $this->upload($jwt, 'first.txt');
        $this->upload($jwt, 'second.txt');

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertSame('second.txt', $data[0]['original_name']);
        $this->assertSame('first.txt', $data[1]['original_name']);
    }

    public function testIsExpiredFalseForActiveFile(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');
        $this->upload($jwt);

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertFalse($data[0]['is_expired']);
    }

    public function testDoesNotReturnOtherUsersFiles(): void
    {
        $this->register('alice@test.com');
        $this->register('bob@test.com');
        $jwtAlice = $this->login('alice@test.com');
        $jwtBob   = $this->login('bob@test.com');

        $this->upload($jwtAlice, 'alice-file.txt');

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwtBob"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertSame([], $data);
    }

    public function testDownloadUrlFormat(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');
        $uploaded = $this->upload($jwt);

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $expectedUrl = sprintf('/api/files/%s/download', $uploaded['token']);
        $this->assertSame($expectedUrl, $data[0]['download_url']);
    }

    public function testIsExpiredTrueForExpiredFile(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');
        $uploaded = $this->upload($jwt);

        $em   = static::getContainer()->get('doctrine')->getManager();
        $file = $em->getRepository(\App\Entity\File::class)->findOneBy(['token' => $uploaded['token']]);
        $file->setExpiresAt(new \DateTimeImmutable('-1 day'));
        $em->flush();

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertTrue($data[0]['is_expired']);
    }

    public function testPasswordProtectedFlagInHistory(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');

        $this->client->request(
            'POST', '/api/files', ['password' => 'secret123'], ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertTrue($data[0]['password_protected']);
    }

    public function testTagsAppearsInHistory(): void
    {
        $this->register('history@test.com');
        $jwt = $this->login('history@test.com');

        $this->client->request(
            'POST', '/api/files',
            ['tags' => ['invoice', 'project-a']],
            ['file' => $this->makeFile()],
            ['HTTP_AUTHORIZATION' => "Bearer $jwt"]
        );

        $this->client->request('GET', '/api/files', [], [], ['HTTP_AUTHORIZATION' => "Bearer $jwt"]);

        $data = json_decode($this->client->getResponse()->getContent(), true)['data'];
        $this->assertEqualsCanonicalizing(['invoice', 'project-a'], $data[0]['tags']);
    }
}
